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
  sfPile: number;
  sfUplift: number;
  concreteRb_MPa: number;
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
