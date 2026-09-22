import { ProjectState, CalcResults, PileSectionInput } from './types';
import { calculateLoads } from './loads';
import { calculateCatenary } from './catenary';
import { calculateAnchor } from './anchor';
import { calculateBromsPile } from './broms';
import { optimizePileEmbedment, pileAllowableTension } from './pileOptimizer';
import { runChecks } from './checks';
import { round, roundOrNull } from './constants';

export * from './types';
export * from './constants';
export * from './loads';
export * from './catenary';
export * from './anchor';
export * from './broms';
export * from './pileOptimizer';
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
  let shorePileOpt;
  let bedPileOpt;
  let shorePileCapacity;
  let bedPileCapacity;

  if (state.anchor.mode === 'pile' || isSolar) {
    const shoreSection: PileSectionInput = {
      shape: state.anchor.shorePileShape ?? 'square',
      D_m: state.anchor.shoreD_m ?? 0.45,
      tWall_m: state.anchor.shorePileTWall_m,
      rebarArea_mm2: state.anchor.shoreRebarArea_mm2,
      rebarFy_MPa: state.anchor.shoreRebarFy_MPa
    };
    const bedSection: PileSectionInput = {
      shape: state.anchor.bedPileShape ?? 'square',
      D_m: state.anchor.bed1D_m ?? 0.35,
      tWall_m: state.anchor.bedPileTWall_m,
      rebarArea_mm2: state.anchor.bedRebarArea_mm2,
      rebarFy_MPa: state.anchor.bedRebarFy_MPa
    };

    shorePile = calculateBromsPile(state.anchor.soilShore ?? 'clay', {
      cu_kPa: state.anchor.cuShore_kPa ?? 40.0,
      phi_deg: state.anchor.phiShore_deg,
      gammaSub_kNm3: state.anchor.gammaSubShore_kNm3,
      e: state.anchor.shoreArm_e_m ?? 0.5,
      D: state.anchor.shoreD_m ?? 0.45,
      L: state.anchor.shoreL_m ?? 6.5,
      FS: state.anchor.sfPile ?? 2.5,
      appliedH: loads.t_max_intact_kN,
      appliedTv: 0, // the shore line is essentially horizontal at the pile head
      concreteRb_MPa: state.anchor.concreteRb_MPa ?? 14.5,
      section: shoreSection
    });

    // Cable inclination at the lake-bed pile head, from depth and plan offset.
    const waterDepth = state.env.waterDepth_m ?? 6.0;
    const bedDist = state.raft.westDist_m ? state.raft.westDist_m / 2.0 : 13.5;
    const angleRad = Math.atan(waterDepth / Math.max(1, bedDist));
    bedCableAngle_deg = (angleRad * 180) / Math.PI;

    bedCableTh_kN = loads.t_max_intact_kN * Math.cos(angleRad);
    bedCableTv_kN = loads.t_max_intact_kN * Math.sin(angleRad);

    bedPile1 = calculateBromsPile(state.anchor.soilBed ?? 'mud', {
      cu_kPa: state.anchor.cuBed_kPa ?? 20.0,
      phi_deg: state.anchor.phiBed_deg,
      gammaSub_kNm3: state.anchor.gammaSubBed_kNm3,
      e: state.anchor.bed1Arm_e_m ?? 0.0,
      D: state.anchor.bed1D_m ?? 0.35,
      L: state.anchor.bed1L_m ?? 8.0,
      FS: state.anchor.sfPile ?? 2.5,
      appliedH: bedCableTh_kN,
      appliedTv: bedCableTv_kN,
      concreteRb_MPa: state.anchor.concreteRb_MPa ?? 14.5,
      section: bedSection
    });

    bedPile2 = calculateBromsPile(state.anchor.soilBed ?? 'mud', {
      cu_kPa: state.anchor.cuBed_kPa ?? 20.0,
      phi_deg: state.anchor.phiBed_deg,
      gammaSub_kNm3: state.anchor.gammaSubBed_kNm3,
      e: waterDepth + 0.8,
      D: state.anchor.bed2D_m ?? 0.70,
      L: state.anchor.bed2L_m ?? 9.0,
      FS: state.anchor.sfPile ?? 2.5,
      appliedH: loads.t_max_intact_kN, // roughly horizontal through the slider ring
      appliedTv: 0,
      concreteRb_MPa: state.anchor.concreteRb_MPa ?? 14.5,
      section: { ...bedSection, D_m: state.anchor.bed2D_m ?? 0.70 }
    });

    // ---- Broms INVERSE solve: shallowest constructible embedment ----------
    // Advisory only — `shorePile`/`bedPile1` above keep the L the user typed,
    // so no existing result or check changes because of this block. It also
    // produces P_max (max allowable pile holding capacity) at that depth.
    const optCommon = {
      FS: state.anchor.sfPile ?? 2.5,
      concreteRb_MPa: state.anchor.concreteRb_MPa ?? 14.5,
      step_m: state.anchor.pileDepthStep_m,
      minL_m: state.anchor.pileMinL_m,
      maxL_m: state.anchor.pileMaxL_m,
      sfPileCapacity: state.anchor.sfPileCapacity
    };

    shorePileOpt = optimizePileEmbedment({
      ...optCommon,
      soilType: state.anchor.soilShore ?? 'clay',
      cu_kPa: state.anchor.cuShore_kPa ?? 40.0,
      phi_deg: state.anchor.phiShore_deg,
      gammaSub_kNm3: state.anchor.gammaSubShore_kNm3,
      e: state.anchor.shoreArm_e_m ?? 0.5,
      D: state.anchor.shoreD_m ?? 0.45,
      section: shoreSection,
      appliedH: loads.t_max_intact_kN,
      appliedTv: 0,
      cableTension_kN: loads.t_max_intact_kN,
      cableAngle_deg: 0, // the shore line is essentially horizontal at the pile head
      ratedPmax_kN: state.anchor.pileRatedPmaxShore_kN
    });

    // P_max of the pile AS BUILT. `shorePile` / `bedPile1` above are computed
    // at the DESIGN embedment, so the capacity derived from them is the one a
    // pile schedule must quote. (`shorePileOpt.capacity` is the capacity at
    // L_opt — the bare minimum depth — and only means anything next to L_opt
    // itself: it is always within a few percent of the demand.)
    shorePileCapacity = pileAllowableTension(
      shorePile,
      state.anchor.shoreArm_e_m ?? 0.5,
      shoreSection,
      state.anchor.concreteRb_MPa ?? 14.5,
      0
    );
    bedPileCapacity = pileAllowableTension(
      bedPile1,
      state.anchor.bed1Arm_e_m ?? 0.0,
      bedSection,
      state.anchor.concreteRb_MPa ?? 14.5,
      bedCableAngle_deg
    );

    bedPileOpt = optimizePileEmbedment({
      ...optCommon,
      soilType: state.anchor.soilBed ?? 'mud',
      cu_kPa: state.anchor.cuBed_kPa ?? 20.0,
      phi_deg: state.anchor.phiBed_deg,
      gammaSub_kNm3: state.anchor.gammaSubBed_kNm3,
      e: state.anchor.bed1Arm_e_m ?? 0.0,
      D: state.anchor.bed1D_m ?? 0.35,
      section: bedSection,
      appliedH: bedCableTh_kN,
      appliedTv: bedCableTv_kN,
      cableTension_kN: loads.t_max_intact_kN,
      cableAngle_deg: bedCableAngle_deg,
      ratedPmax_kN: state.anchor.pileRatedPmaxBed_kN
    });
  }

  // ---- C8 / C9 geometry: bed clearance and average line spacing ---------
  const perimeter_m = 2 * ((state.raft.length_m ?? 0) + (state.raft.width_m ?? 0));
  const lineCount = state.line.count ?? 0;
  const avgLineSpacing_m = lineCount > 0 && perimeter_m > 0 ? perimeter_m / lineCount : null;

  // Always the physically-measured gap (water depth minus raft draft) — NOT
  // env.minWaterDepthUnderRaft_m, which is the design REQUIREMENT ("Độ sâu
  // tối thiểu cần dưới đáy bè"), i.e. the threshold C8 checks against, not
  // the actual clearance itself.
  const bedClearanceRaw = (state.env.waterDepth_m ?? 0) - (state.raft.draft_m ?? 0);
  const bedClearance_m = Number.isFinite(bedClearanceRaw) ? bedClearanceRaw : null;

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
    bedCableTv_kN,
    shorePileOpt,
    bedPileOpt,
    shorePileCapacity,
    bedPileCapacity,
    bedClearance_m,
    avgLineSpacing_m
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
    bedClearance_m: roundOrNull(raw.bedClearance_m),
    avgLineSpacing_m: roundOrNull(raw.avgLineSpacing_m, 1),
    ...checkResults
  };
}
