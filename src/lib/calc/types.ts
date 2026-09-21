export type SystemType = 'solar_fpv' | 'general_catenary' | 'aquaculture_catenary';

export interface ProjectMeta {
  name: string;
  code: string;
  location: string;
  designer: string;
  date: string;
  note: string;
}

export interface RaftInput {
  length_m: number;
  width_m: number;
  draft_m: number;
  freeboardHeight_m: number;
  displacement_t: number;
  // Solar specific
  solarPanelCount?: number;
  solarPanelArea_m2?: number;
  solarTilt_deg?: number;
  solarShieldFactor?: number;
  cdPanel?: number;
  cdFloat?: number;
  // Overrides
  windAreaOverride_m2?: number;
  currentAreaOverride_m2?: number;
  // Distances to shores / other rafts
  southDist_m?: number;
  northDist_m?: number;
  eastDist_m?: number;
  westDist_m?: number;
}

export interface EnvInput {
  mndbt_m?: number;
  mncn_m?: number;
  maxDepth_m?: number;
  minWaterDepthUnderRaft_m?: number;
  bankSlope_m?: number; // 1:m
  waterDepth_m: number;
  tideRange_m: number;
  windSpeed_ms: number;
  windCd: number;
  currentSpeed_ms: number;
  currentCd: number;
  waveHs_m: number;
  waveTp_s: number;
  waveCd: number;
  waveCurrentFactor?: number;
  combinationFactor: number;
  airDensity: number;
  waterDensity: number;
  gravity: number;
  /**
   * How wind/current/wave are combined for a Solar-FPV raft (`isSolarFPV &&
   * solarPanelCount > 0` in `loads.ts`).
   *  - 'fpv_combined' (default when omitted): current + wave are folded into
   *    a single surcharge on the wind load via `waveCurrentFactor` (1.05) —
   *    the historical FPV shortcut, cheap and conservative for a sheltered
   *    reservoir.
   *  - 'separate': wind, current and wave are each computed with their own
   *    textbook drag/wave-drift formula (same physics as the general
   *    hydrodynamic branch) and simply summed — use when the site has real
   *    current/wave data worth modelling on its own.
   * Non-solar rafts always use the separate-term formulas regardless of this
   * flag; it only selects between the two FPV shortcuts.
   */
  loadCombinationMode?: 'separate' | 'fpv_combined';
}

export interface LineInput {
  count: number;
  longSideCount?: number;
  shortSideCount?: number;
  shoreLineCount?: number;
  bedLineCount?: number;
  effectiveCount: number;
  horizontalAngle_deg: number;
  type: 'cable' | 'chain' | 'combo';
  cableCode?: string;
  /**
   * Bulk density of the line material, kg/m³ (steel 7850, polyester 1380, ...).
   * Drives the submerged unit weight. Omit to derive it from `type`.
   */
  materialDensity_kgpm3?: number;
  /**
   * Mooring model actually used for this line.
   *  - 'catenary'  : slack line resting on the bed (chain/rope + drag anchor)
   *  - 'taut_pile' : straight tensioned cable to a pile — no catenary, no
   *                  grounded length, no seabed friction.
   * Omit to derive it from the anchor mode.
   */
  mooringModel?: 'catenary' | 'taut_pile';
  chainDiameter_mm: number;
  chainGrade: 'U1' | 'U2' | 'U3' | 'custom';
  mbl_kN: number;
  unitWeightAir_kgpm: number;
  pretension_kN: number;
  focusFactor: number;
  totalLength_m: number;
  groundedLengthMin_m: number;
  seabedFrictionCoef: number;
}

export interface AnchorInput {
  mode: 'pile' | 'drag' | 'deadweight';
  pileBedType?: 'method1' | 'method2';
  soilShore?: 'clay' | 'mud' | 'sand' | 'rock';
  soilBed?: 'clay' | 'mud' | 'sand' | 'rock';
  soil: 'sand' | 'mud' | 'clay' | 'rock';
  cuShore_kPa: number;
  cuBed_kPa: number;
  // Cohesionless (sand) Broms parameters — used when soilShore/soilBed === 'sand'.
  phiShore_deg?: number;       // internal friction angle of the shore soil, degrees
  gammaSubShore_kNm3?: number; // submerged unit weight of the shore soil, kN/m3
  phiBed_deg?: number;         // internal friction angle of the lake-bed soil, degrees
  gammaSubBed_kNm3?: number;   // submerged unit weight of the lake-bed soil, kN/m3
  sfPile: number;
  sfUplift: number;
  concreteRb_MPa: number;
  // Pile cross-section shape — applies to both the shore and lake-bed piles.
  // 'square' (default): D = side; 'circular': D = outer diameter, solid;
  // 'pipe': D = outer diameter, hollow, wall thickness tWall_m.
  shorePileShape?: 'square' | 'circular' | 'pipe';
  shorePileTWall_m?: number;
  shoreRebarArea_mm2?: number; // total longitudinal reinforcement area As, mm2 (0/undefined = plain concrete)
  shoreRebarFy_MPa?: number;   // reinforcement yield strength, MPa (default 300 = CB300-V)
  bedPileShape?: 'square' | 'circular' | 'pipe';
  bedPileTWall_m?: number;
  bedRebarArea_mm2?: number;
  bedRebarFy_MPa?: number;
  // Shore pile
  shoreArm_e_m: number;
  shoreD_m: number;
  shoreL_m: number;
  // Lake bed pile Method 1
  bed1Arm_e_m: number;
  bed1D_m: number;
  bed1L_m: number;
  bed1Stickup_m: number;
  // Lake bed pile Method 2
  bed2D_m: number;
  bed2L_m: number;
  /**
   * P_max — rated allowable holding capacity of ONE pile, kN, from the
   * precast-pile catalogue or a site pull-out test. When given, it caps the
   * computed Broms capacity and enables check C10 (T_dây <= P_max).
   * Omit to check against the computed capacity only.
   */
  pileRatedPmaxShore_kN?: number;
  pileRatedPmaxBed_kN?: number;
  /** Safety factor applied to T_max to obtain P_req = T_max * SF. Default 1.0. */
  sfPileCapacity?: number;
  /** Construction rounding step for the optimised embedment, m (0.25 / 0.5). */
  pileDepthStep_m?: number;
  /** Search bounds of the embedment optimiser, m. Defaults 2.0 / 20.0. */
  pileMinL_m?: number;
  pileMaxL_m?: number;

  // Drag / Deadweight
  anchorType: string;
  weight_t: number;
  holdingCoef?: number;
  frictionCoef?: number;
  concreteDensity: number;
}

export interface Criteria {
  sfLineIntact: number;
  sfLineDamaged: number;
  sfAnchorIntact: number;
  sfAnchorDamaged: number;
  sfPileLateral: number;
  sfPileUplift: number;
  sfPileSection: number;
  maxLineSpacing_m: number;
  minScopeRatio: number;
  maxOffset_m: number;
  /** C8 — minimum safe clearance between raft draft and the lake bed, m. Default 1.0. */
  minBedClearance_m?: number;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: 'pdf' | 'image' | 'dxf' | 'other';
  blobUrl?: string;
  remoteUrl?: string;
}

/**
 * PASS / FAIL : the check ran and produced a verdict.
 * NA          : the check APPLIES but could not be evaluated (missing or
 *               invalid input) — this poisons the overall verdict on purpose.
 * SKIP        : the check does NOT apply to this configuration (e.g. catenary
 *               checks on a taut pile mooring). Shown, but neutral.
 */
export type CheckStatus = 'PASS' | 'FAIL' | 'NA' | 'SKIP';

export interface CheckItem {
  id: string;
  label: string;
  formula: string;
  actual: number | null;
  displayActual: string;
  unit: string;
  threshold: number | string;
  status: CheckStatus;
  margin: number | null;
  /**
   * Demand / capacity, normalised so that <= 1.0 is safe for EVERY check,
   * whether the raw criterion reads ">= SF" or "<= limit". This is the only
   * quantity comparable across checks, so it — not `margin` — selects the
   * governing check.
   */
  utilization: number | null;
  isMandatory: boolean;
  note?: string;
}

/** Pile cross-section shape shared by the shore and lake-bed piles. */
export type PileShape = 'square' | 'circular' | 'pipe';

export interface PileSectionInput {
  shape: PileShape;
  /** Square: side length. Circular/pipe: OUTER diameter. */
  D_m: number;
  /** Pipe only: wall thickness. Ignored otherwise. */
  tWall_m?: number;
  /** Total longitudinal reinforcement area As, mm2. 0/undefined = plain concrete section. */
  rebarArea_mm2?: number;
  /** Reinforcement yield strength, MPa. Default 300 (CB300-V) when rebarArea_mm2 > 0. */
  rebarFy_MPa?: number;
}

export interface BromsResult {
  g: number;
  p: number;
  Hu: number; // kN
  H_allow: number; // kN
  f: number;
  Mmax: number; // kNm
  Mrd: number; // kNm
  utilization_H: number;
  utilization_M: number;
  upliftCapacity_all?: number; // kN
  utilization_Uplift?: number;
  concreteVolume_m3: number;
  orderedLength_m: number;
  isPassed: boolean;
  /** Diagnostic breakdown — present when a PileSectionInput was supplied. */
  soilModel?: 'clay' | 'sand';
  shape?: PileShape;
  effectiveWidth_m?: number;
  perimeter_m?: number;
  MrdConcrete_kNm?: number;
  MrdSteel_kNm?: number;
  Kp?: number; // Rankine passive coefficient (sand model only)
}

/** Which criterion limits a pile's allowable tension / governs its depth. */
export type PileGoverningCriterion = 'lateral' | 'uplift' | 'moment' | 'none';

/**
 * P_max breakdown — the maximum cable tension the pile can hold, split by the
 * three capacities that can limit it. All kN.
 */
export interface PileCapacityBreakdown {
  /** P_max = min(lateral, moment, uplift) — the value to compare T_dây against. */
  Pmax_kN: number;
  Pmax_lateral_kN: number;
  Pmax_moment_kN: number;
  /** +Infinity for a horizontal cable (no uplift component to exhaust). */
  Pmax_uplift_kN: number;
  governing: PileGoverningCriterion;
  /** Cable inclination above the horizontal at the pile head, degrees. */
  cableAngle_deg: number;
}

export interface PileOptimizationInput {
  soilType: 'clay' | 'mud' | 'sand' | 'rock' | undefined;
  cu_kPa?: number;
  phi_deg?: number;
  gammaSub_kNm3?: number;
  /** Load eccentricity / free-standing arm above the soil surface, m. */
  e: number;
  /** Pile side width (square) or outer diameter, m. */
  D: number;
  /** Safety factor on the Broms lateral capacity. */
  FS: number;
  concreteRb_MPa?: number;
  section?: PileSectionInput;
  /** Horizontal component of the cable load at the pile head, kN. */
  appliedH: number;
  /** Vertical (uplift) component of the cable load at the pile head, kN. */
  appliedTv?: number;
  /** Full cable tension used for the P_req / P_max check, kN. Defaults to appliedH. */
  cableTension_kN?: number;
  /** Cable inclination above the horizontal at the pile head, degrees. Default 0. */
  cableAngle_deg?: number;
  /** Search bounds and construction step for the embedment sweep, m. */
  minL_m?: number;
  maxL_m?: number;
  step_m?: number;
  /** Rated (catalogue / load-test) allowable holding capacity of the pile, kN. */
  ratedPmax_kN?: number;
  /** Safety factor applied to T_max to obtain P_req. Default 1.0. */
  sfPileCapacity?: number;
}

export interface PileOptimizationResult {
  /** Shallowest constructible embedment that satisfies every criterion, m. */
  L_opt_m: number | null;
  /** False when no depth in [minL_m, maxL_m] works — see `note`. */
  converged: boolean;
  governing: PileGoverningCriterion;
  note?: string;
  iterations: number;
  step_m: number;
  minL_m: number;
  maxL_m: number;
  /** Broms results at L_opt (or at the depth the sweep stopped on). */
  broms: BromsResult;
  capacity: PileCapacityBreakdown;
  /** Rated P_max the user entered, kN (undefined when not supplied). */
  ratedPmax_kN?: number;
  /** min(computed P_max, rated P_max) — what the check actually uses, kN. */
  effectivePmax_kN: number;
  /** P_req = T_dây * SF, kN. */
  Preq_kN: number;
  sfPileCapacity: number;
  cableTension_kN: number;
  utilization_Pmax: number;
  isPmaxOk: boolean;
}

export interface CalcResults {
  // Environmental loads
  q_wind_Pa: number;
  a_wind_m2: number;
  a_current_m2: number;
  f_wind_panel_kN?: number;
  f_wind_float_kN?: number;
  f_wind_total_kN: number;
  f_current_kN: number;
  f_wave_kN: number;
  f_env_total_kN: number;

  // Line tension
  /** Tension by the calibrated load-concentration method, kN. */
  t_focus_kN: number;
  /** Tension by the geometric N_eff / cos(alpha) distribution, kN. */
  t_geometric_kN: number;
  /** Which method governed (the more onerous one). */
  tensionMethod: 'focus' | 'geometric';
  t_max_intact_kN: number;
  t_max_damaged_kN: number;
  h_line_intact_kN: number;
  h_line_damaged_kN: number;
  /** Vertical component of the governing line tension, kN. */
  v_line_intact_kN: number;
  mbl_required_kN: number;
  cableUtilization: number | null;

  // Catenary (if applicable)
  /** False when the catenary model does not apply (taut pile, buoyant rope, ...). */
  catenaryApplies: boolean;
  catenaryNote?: string;
  materialDensity_kgpm3: number | null;
  submergedWeight_N_per_m: number | null;
  verticalDrop_d_m: number | null;
  suspendedLength_s_m: number | null;
  topTension_kN: number | null;
  topTension_damaged_kN: number | null;
  suspendedProjection_m: number | null;
  groundedLength_m: number | null;
  frictionResistance_kN: number | null;
  lengthDeficit_m: number | null;
  scopeRatio: number | null;

  // Anchor results
  /** False for a pile anchor: its capacity is the Broms block instead. */
  anchorApplies: boolean;
  anchorNote?: string;
  submergedWeight_t: number | null;
  anchorResistance_kN: number | null;
  totalResistance_kN: number | null;

  // Broms Piles (for floating solar / pile mooring)
  shorePile?: BromsResult;
  bedPile1?: BromsResult;
  bedPile2?: BromsResult;
  bedCableAngle_deg?: number;
  bedCableTh_kN?: number;
  bedCableTv_kN?: number;

  /**
   * Broms inverse solve — shallowest constructible embedment and the
   * resulting P_max, for the shore and the lake-bed pile. Advisory: the
   * `shorePile`/`bedPile1` results above still use the L the user entered.
   */
  shorePileOpt?: PileOptimizationResult;
  bedPileOpt?: PileOptimizationResult;

  // C8 / C9 geometry
  /** Clearance between raft draft and the lake bed, m (C8). */
  bedClearance_m: number | null;
  /** Average spacing between mooring lines around the raft perimeter, m (C9). */
  avgLineSpacing_m: number | null;

  // Checks & Summary
  checks: CheckItem[];
  overallVerdict: CheckStatus;
  governingCheck: CheckItem | null;
}

export interface ProjectState {
  id: string;
  name: string;
  code: string;
  systemType: SystemType;
  meta: ProjectMeta;
  raft: RaftInput;
  env: EnvInput;
  line: LineInput;
  anchor: AnchorInput;
  criteria: Criteria;
  attachments: Attachment[];
  activeRaftId?: number;
}
