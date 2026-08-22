import { RaftInput, EnvInput, LineInput } from './types';

export interface LoadsResult {
  q_wind_Pa: number;
  a_wind_m2: number;
  a_current_m2: number;
  f_wind_panel_kN: number;
  f_wind_float_kN: number;
  f_wind_total_kN: number;
  f_current_kN: number;
  f_wave_kN: number;
  f_env_total_kN: number;
  /** Line tension by the calibrated load-concentration method, kN. */
  t_focus_kN: number;
  /** Line tension by the geometric N_eff / cos(alpha) distribution, kN. */
  t_geometric_kN: number;
  /** Which of the two methods governs (the more onerous one). */
  tensionMethod: 'focus' | 'geometric';
  t_max_intact_kN: number;
  t_max_damaged_kN: number;
  h_line_intact_kN: number;
  h_line_damaged_kN: number;
  v_line_intact_kN: number;
  mbl_required_kN: number;
  cableUtilization: number | null;
}

/**
 * Environmental loads and line tensions for both Solar FPV and Marine Floating platforms.
 *
 * TENSION MODEL (single source of truth)
 * --------------------------------------
 * The line tension T is computed by two independent methods and the MORE
 * ONEROUS one governs:
 *   focus     : T = F_env * focusFactor + pretension   (calibrated share of the
 *               total environmental load taken by the worst line)
 *   geometric : T = F_env / (N_eff * cos a) + pretension
 * H and V are then the components of that ONE tension:
 *   H = T * cos a      V = T * sin a
 * Anchor checks (C1/C5) and line checks (C2/C6) must be fed from the same T:
 * a line and the anchor it pulls on cannot carry two different forces.
 *
 * All internal arithmetic is unrounded. Rounding happens once, at the display
 * boundary in `calculateProject`.
 */
export function calculateLoads(
  raft: RaftInput,
  env: EnvInput,
  line: LineInput,
  isSolarFPV: boolean = true,
  sfLineIntact: number = 3.0
): LoadsResult {
  // `??` and not `||`: a deliberate 0 entered by the user must survive.
  const g = env.gravity ?? 9.81;
  const rho_air = env.airDensity ?? 1.25;
  const rho_water = env.waterDensity ?? 1000.0;
  const windV = Math.max(0, env.windSpeed_ms ?? 0);
  const currentV = Math.max(0, env.currentSpeed_ms ?? 0);

  // Dynamic wind pressure q = 0.5 * rho_air * V^2 (N/m²)
  const q_wind_Pa = 0.5 * rho_air * windV * windV;

  let f_wind_panel_N = 0;
  let f_wind_float_N = 0;
  let a_wind_m2 = 0;
  let a_current_m2 = 0;
  let f_wind_total_N = 0;
  let f_current_N = 0;
  let f_wave_N = 0;
  let f_env_total_N = 0;

  if (isSolarFPV && (raft.solarPanelCount ?? 0) > 0) {
    // ---- SOLAR FPV MODE -------------------------------------------------
    // Wind on the tilted panel array + wind on the float freeboard.
    // Current and wave are NOT modelled separately here: they are folded into
    // `waveCurrentFactor` as a surcharge on the wind load, which is why
    // f_current_kN and f_wave_kN are reported as 0 in this mode.
    const panelCount = raft.solarPanelCount ?? 0;
    const panelArea1 = raft.solarPanelArea_m2 ?? 2.701;
    const tiltDeg = raft.solarTilt_deg ?? 12.0;
    const tiltRad = (tiltDeg * Math.PI) / 180.0;
    const cdPanel = raft.cdPanel ?? env.windCd ?? 1.3;
    const shieldFactor = raft.solarShieldFactor ?? 0.55;

    const a_panel_proj = panelCount * panelArea1 * Math.sin(tiltRad);
    f_wind_panel_N = q_wind_Pa * cdPanel * a_panel_proj * shieldFactor;

    const cdFloat = raft.cdFloat ?? 1.1;
    const freeboard = Math.max(0.05, raft.freeboardHeight_m ?? 0.35);
    const avgSpan = ((raft.length_m ?? 0) + (raft.width_m ?? 0)) / 2.0;
    const a_float = avgSpan * freeboard;
    f_wind_float_N = q_wind_Pa * cdFloat * a_float;

    a_wind_m2 = a_panel_proj + a_float;
    f_wind_total_N = f_wind_panel_N + f_wind_float_N;

    const waveCurrentFactor = env.waveCurrentFactor ?? 1.05;
    f_env_total_N = f_wind_total_N * waveCurrentFactor * (env.combinationFactor ?? 1.0);
  } else {
    // ---- GENERAL / HYDRODYNAMIC FLOATING RAFT MODE ----------------------
    const wOverride = raft.windAreaOverride_m2;
    const cOverride = raft.currentAreaOverride_m2;
    a_wind_m2 = wOverride !== undefined && wOverride > 0
      ? wOverride
      : Math.max(0, (raft.width_m ?? 0) * (raft.freeboardHeight_m ?? 0));

    a_current_m2 = cOverride !== undefined && cOverride > 0
      ? cOverride
      : Math.max(0, (raft.width_m ?? 0) * (raft.draft_m ?? 0));

    f_wind_total_N = 0.5 * rho_air * (env.windCd ?? 1.2) * a_wind_m2 * windV * windV;
    f_current_N = 0.5 * rho_water * (env.currentCd ?? 1.2) * a_current_m2 * currentV * currentV;

    // Mean wave-drift (reflection model): 0.5 * rho_w * g * (Hs/2)^2 * B * Cd
    // B is the real beam. No `max(1, B)` clamp: silently doubling the wave
    // force on a 0.5 m float is not a safety factor, it is a wrong number.
    const hs = Math.max(0, env.waveHs_m ?? 0);
    const beam = Math.max(0, raft.width_m ?? 0);
    f_wave_N = 0.5 * rho_water * g * Math.pow(hs / 2.0, 2) * beam * (env.waveCd ?? 1.0);

    f_env_total_N = (env.combinationFactor ?? 1.0) * (f_wind_total_N + f_current_N + f_wave_N);
  }

  const f_env_total_kN = f_env_total_N / 1000.0;

  // ---- Line tension ------------------------------------------------------
  const pretension_kN = line.pretension_kN ?? 0;
  const angle_deg = Math.min(80, Math.max(0, line.horizontalAngle_deg ?? 30));
  const angleRad = (angle_deg * Math.PI) / 180.0;
  const cosAlpha = Math.cos(angleRad);
  const sinAlpha = Math.sin(angleRad);

  const n_eff = Math.max(1, line.effectiveCount ?? 1);
  const n_eff_damaged = Math.max(1, n_eff - 1);

  // Method A — calibrated load concentration on the worst line.
  const focusFactor = line.focusFactor ?? 0;
  const t_focus_kN = focusFactor > 0
    ? f_env_total_kN * focusFactor + pretension_kN
    : 0;

  // Method B — geometric distribution over the effective lines.
  const t_geometric_kN = f_env_total_kN / (n_eff * cosAlpha) + pretension_kN;

  // The more onerous method governs.
  const useFocus = t_focus_kN > t_geometric_kN;
  const t_max_intact_kN = useFocus ? t_focus_kN : t_geometric_kN;

  // Damaged case: one effective line is lost.
  //  - focus method     : the concentration factor grows (empirical 1.33)
  //  - geometric method : the load redistributes over n_eff - 1 lines
  const t_focus_damaged_kN = focusFactor > 0
    ? f_env_total_kN * focusFactor * 1.33 + pretension_kN
    : 0;
  const t_geometric_damaged_kN = f_env_total_kN / (n_eff_damaged * cosAlpha) + pretension_kN;
  const t_max_damaged_kN = Math.max(t_focus_damaged_kN, t_geometric_damaged_kN);

  // H and V are components of that SAME tension.
  const h_line_intact_kN = t_max_intact_kN * cosAlpha;
  const h_line_damaged_kN = t_max_damaged_kN * cosAlpha;
  const v_line_intact_kN = t_max_intact_kN * sinAlpha;

  // Required MBL follows the user's own criterion, not a hardcoded 3.0.
  const sf = sfLineIntact > 0 ? sfLineIntact : 3.0;
  const mbl_required_kN = t_max_intact_kN * sf;
  const cableUtilization = line.mbl_kN > 0 ? mbl_required_kN / line.mbl_kN : null;

  return {
    q_wind_Pa,
    a_wind_m2,
    a_current_m2,
    f_wind_panel_kN: f_wind_panel_N / 1000.0,
    f_wind_float_kN: f_wind_float_N / 1000.0,
    f_wind_total_kN: f_wind_total_N / 1000.0,
    f_current_kN: f_current_N / 1000.0,
    f_wave_kN: f_wave_N / 1000.0,
    f_env_total_kN,
    t_focus_kN,
    t_geometric_kN,
    tensionMethod: useFocus ? 'focus' : 'geometric',
    t_max_intact_kN,
    t_max_damaged_kN,
    h_line_intact_kN,
    h_line_damaged_kN,
    v_line_intact_kN,
    mbl_required_kN,
    cableUtilization
  };
}
