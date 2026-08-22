import { ProjectState, CalcResults } from './types';
import { calculateLoads } from './loads';
import { calculateCatenary } from './catenary';
import { calculateAnchor } from './anchor';
import { calculateBromsCohesivePile } from './broms';
import { runChecks } from './checks';
import { round, roundOrNull } from './constants';

export * from './types';
export * from './constants';
export * from './loads';
export * from './catenary';
export * from './anchor';
export * from './broms';
export * from './checks';

/**
 * Main project calculation.
 *
 * Pipeline: loads -> catenary -> anchor -> piles -> checks.
 * Every stage passes UNROUNDED values to the next one; the results are rounded
 * exactly once, at the end, for display. Rounding mid-chain (as the first
 * implementation did) both corrupts the downstream numbers and makes the
 * report unauditable.
 */
export function calculateProject(state: ProjectState): CalcResults {
  const isSolar = state.systemType === 'solar_fpv' || (state.raft.solarPanelCount ?? 0) > 0;

  // The mooring model is a property of the system, not a silent assumption:
  // a cable tensioned to a pile has no catenary and no grounded length.
  const mooringModel = state.line.mooringModel
    ?? (state.anchor.mode === 'pile' ? 'taut_pile' : 'catenary');

  // 1. Environmental loads and the governing line tension.
  const loads = calculateLoads(
    state.raft,
    state.env,
    state.line,
    isSolar,
    state.criteria.sfLineIntact
  );

  // 2. Catenary profile (returns catenaryApplies: false when it does not hold).
  const catenary = calculateCatenary(
    state.line,
    state.env,
    loads.h_line_intact_kN,
    loads.h_line_damaged_kN,
    mooringModel
  );

  // 3. Anchor holding resistance (drag / deadweight; piles handled below).
  const anchor = calculateAnchor(
    state.anchor,
    state.env,
    catenary.frictionResistance_kN ?? 0
  );

  // 4. Broms pile capacity, for pile moorings and floating-solar systems.
  let shorePile;
  let bedPile1;
  let bedPile2;
  let bedCableAngle_deg;
  let bedCableTh_kN;
  let bedCableTv_kN;

  if (state.anchor.mode === 'pile' || isSolar) {
    shorePile = calculateBromsCohesivePile(
      state.anchor.cuShore_kPa ?? 40.0,
      state.anchor.shoreArm_e_m ?? 0.5,
      state.anchor.shoreD_m ?? 0.45,
      state.anchor.shoreL_m ?? 6.5,
      state.anchor.sfPile ?? 2.5,
      loads.t_max_intact_kN,
      0, // the shore line is essentially horizontal at the pile head
      state.anchor.concreteRb_MPa ?? 14.5
    );

    // Cable inclination at the lake-bed pile head, from depth and plan offset.
    const waterDepth = state.env.waterDepth_m ?? 6.0;
    const bedDist = state.raft.westDist_m ? state.raft.westDist_m / 2.0 : 13.5;
    const angleRad = Math.atan(waterDepth / Math.max(1, bedDist));
    bedCableAngle_deg = (angleRad * 180) / Math.PI;

    bedCableTh_kN = loads.t_max_intact_kN * Math.cos(angleRad);
    bedCableTv_kN = loads.t_max_intact_kN * Math.sin(angleRad);

    bedPile1 = calculateBromsCohesivePile(
      state.anchor.cuBed_kPa ?? 20.0,
      state.anchor.bed1Arm_e_m ?? 0.0,
      state.anchor.bed1D_m ?? 0.35,
      state.anchor.bed1L_m ?? 8.0,
      state.anchor.sfPile ?? 2.5,
      bedCableTh_kN,
      bedCableTv_kN,
      state.anchor.concreteRb_MPa ?? 14.5
    );

    bedPile2 = calculateBromsCohesivePile(
      state.anchor.cuBed_kPa ?? 20.0,
      waterDepth + 0.8,
      state.anchor.bed2D_m ?? 0.70,
      state.anchor.bed2L_m ?? 9.0,
      state.anchor.sfPile ?? 2.5,
      loads.t_max_intact_kN, // roughly horizontal through the slider ring
      0,
      state.anchor.concreteRb_MPa ?? 14.5
    );
  }

  // Unrounded intermediate state — this is what the checks are computed from.
  const raw: Omit<CalcResults, 'checks' | 'overallVerdict' | 'governingCheck'> = {
    ...loads,
    ...catenary,
    ...anchor,
    shorePile,
    bedPile1,
    bedPile2,
    bedCableAngle_deg,
    bedCableTh_kN,
    bedCableTv_kN
  };

  // 5. Checks run on the FULL-PRECISION values.
  const checkResults = runChecks(state, raw);

  // 6. Round once, here, for display.
  return {
    ...raw,
    q_wind_Pa: round(raw.q_wind_Pa, 1),
    a_wind_m2: round(raw.a_wind_m2),
    a_current_m2: round(raw.a_current_m2),
    f_wind_panel_kN: round(raw.f_wind_panel_kN ?? 0),
    f_wind_float_kN: round(raw.f_wind_float_kN ?? 0),
    f_wind_total_kN: round(raw.f_wind_total_kN),
    f_current_kN: round(raw.f_current_kN),
    f_wave_kN: round(raw.f_wave_kN),
    f_env_total_kN: round(raw.f_env_total_kN),
    t_focus_kN: round(raw.t_focus_kN),
    t_geometric_kN: round(raw.t_geometric_kN),
    t_max_intact_kN: round(raw.t_max_intact_kN),
    t_max_damaged_kN: round(raw.t_max_damaged_kN),
    h_line_intact_kN: round(raw.h_line_intact_kN),
    h_line_damaged_kN: round(raw.h_line_damaged_kN),
    v_line_intact_kN: round(raw.v_line_intact_kN),
    mbl_required_kN: round(raw.mbl_required_kN),
    cableUtilization: roundOrNull(raw.cableUtilization, 3),
    submergedWeight_N_per_m: roundOrNull(raw.submergedWeight_N_per_m),
    verticalDrop_d_m: roundOrNull(raw.verticalDrop_d_m),
    suspendedLength_s_m: roundOrNull(raw.suspendedLength_s_m),
    topTension_kN: roundOrNull(raw.topTension_kN),
    topTension_damaged_kN: roundOrNull(raw.topTension_damaged_kN),
    suspendedProjection_m: roundOrNull(raw.suspendedProjection_m),
    groundedLength_m: roundOrNull(raw.groundedLength_m),
    frictionResistance_kN: roundOrNull(raw.frictionResistance_kN),
    lengthDeficit_m: roundOrNull(raw.lengthDeficit_m),
    scopeRatio: roundOrNull(raw.scopeRatio, 1),
    submergedWeight_t: roundOrNull(raw.submergedWeight_t),
    anchorResistance_kN: roundOrNull(raw.anchorResistance_kN),
    totalResistance_kN: roundOrNull(raw.totalResistance_kN),
    bedCableAngle_deg: bedCableAngle_deg !== undefined ? round(bedCableAngle_deg, 1) : undefined,
    bedCableTh_kN: bedCableTh_kN !== undefined ? round(bedCableTh_kN) : undefined,
    bedCableTv_kN: bedCableTv_kN !== undefined ? round(bedCableTv_kN) : undefined,
    ...checkResults
  };
}
