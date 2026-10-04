/**
 * From the reinforcement the bending check uses (k bars on the tension face)
 * to the cage that is actually built, and its quantities.
 *
 * A square pile is reinforced symmetrically on all four faces — it has to
 * resist bending whichever way it ends up facing, and in handling. With k bars
 * on every face and the corner bars shared, the cage has 4·(k − 1) bars:
 *     k = 2 → 4 bars (corners);  k = 3 → 8 bars;  k = 4 → 12 bars.
 * Never fewer: 8 bars for a face that was calculated with 4 would leave only 3
 * on the tension face.
 *
 * What is CALCULATED here: the main bars (from the bending check) and the
 * handling moment of a pile lifted at two points. What is CONSTRUCTIVE (not
 * calculated — no shear design exists in this tool): stirrups, lifting hooks.
 */

export const STEEL_DENSITY_KG_M3 = 7850;
/** Stirrup: Φ8, 100 mm pitch over the end zones, 200 mm over the shaft (constructive). */
export const STIRRUP_DIA_MM = 8;
export const STIRRUP_END_PITCH_M = 0.1;
export const STIRRUP_BODY_PITCH_M = 0.2;
export const STIRRUP_END_ZONE_M = 1.5;
/** Two Φ16 lifting hooks per pile, about 3.8 kg together (constructive). */
export const LIFTING_HOOKS_KG = 3.8;
/** Lifting points at 0.207 L from each end: M = 0.0214 · q · L². */
export const LIFT_POINT_RATIO = 0.207;
const HANDLING_MOMENT_COEF = 0.0214;
/** Dynamic factor on self-weight while lifting. */
const HANDLING_DYNAMIC_FACTOR = 1.5;
const RC_UNIT_WEIGHT_KN_M3 = 25;
/** Longest pile cast and driven in one piece (a standard precast length). */
export const MAX_SINGLE_SEGMENT_M = 12;

export const barUnitWeight_kg_m = (dia_mm: number) => ((Math.PI * dia_mm * dia_mm) / 4 / 1e6) * STEEL_DENSITY_KG_M3;

/** Steel grade whose design strength Rs is given (TCVN 5574:2018). */
export function rebarGradeOf(rs_MPa: number): string {
  if (rs_MPa >= 430) return 'CB500-V';
  if (rs_MPa >= 345) return 'CB400-V';
  if (rs_MPa >= 255) return 'CB300-V';
  return `Rs ${rs_MPa} MPa`;
}

export interface PileCageInput {
  /** Side of the square pile, m. */
  side_m: number;
  /** Bars on the tension face used by the bending check. */
  faceCount: number;
  /** Bar diameter, mm. */
  dia_mm: number;
  /** Design strength of the bars, MPa. */
  rs_MPa: number;
  /** Concrete face to main-bar centre, mm. */
  cover_mm: number;
  /** Full pile length: embedment + stick-up, m. */
  totalLength_m: number;
}

export interface PileCage {
  /** Bars in the cage, 4·(k − 1); 0 for an unreinforced pile. */
  totalBars: number;
  /** e.g. "8Φ25". */
  label: string;
  grade: string;
  /** Main steel area / concrete area. */
  steelRatio: number;
  /** e.g. "Φ8 a100/a200". */
  stirrupLabel: string;
  stirrupCount: number;
  /** Segments the pile is cast in, m (one entry = one piece). */
  segments_m: number[];
  /** e.g. "1 đoạn (L = 9.5 m)". */
  segmentNote: string;
  concreteVol_m3: number;
  mainSteel_kg: number;
  stirrupSteel_kg: number;
  hookSteel_kg: number;
  /** Steel of one pile, kg. */
  steel_kg: number;
  /** Lifting moment of the whole pile at two points, with the dynamic factor, kNm. */
  handlingMoment_kNm: number;
}

export function buildPileCage(input: PileCageInput): PileCage {
  const { side_m: a, faceCount, dia_mm, rs_MPa, cover_mm, totalLength_m: L } = input;
  const k = Math.max(0, Math.floor(faceCount));
  const totalBars = k >= 2 ? 4 * (k - 1) : 0;

  // Stirrups: closed Φ8 hoops around the main bars, plus one inner tie set per
  // hoop when the cage has intermediate bars to restrain (8 or 12 bars).
  const endZone = Math.min(STIRRUP_END_ZONE_M, L / 2);
  const stirrupCount =
    2 * (Math.floor(endZone / STIRRUP_END_PITCH_M) + 1) + Math.max(0, Math.floor((L - 2 * endZone) / STIRRUP_BODY_PITCH_M) - 1);
  const hoopSide_m = Math.max(0, a - 2 * (cover_mm / 1000) + (dia_mm + STIRRUP_DIA_MM) / 1000);
  const hoopLength_m = 4 * hoopSide_m + 0.16; // two 135° hooks
  const tieLength_m = totalBars > 4 ? 4 * (hoopSide_m / Math.SQRT2) + 0.16 : 0; // diamond tie on the mid-side bars
  const stirrupSteel_kg = stirrupCount * (hoopLength_m + tieLength_m) * barUnitWeight_kg_m(STIRRUP_DIA_MM);

  const mainSteel_kg = totalBars * L * barUnitWeight_kg_m(dia_mm);
  const hookSteel_kg = totalBars > 0 ? LIFTING_HOOKS_KG : 0;

  const q_kN_m = a * a * RC_UNIT_WEIGHT_KN_M3;
  const single = L <= MAX_SINGLE_SEGMENT_M + 1e-9;
  const half = Math.floor((L / 2) * 2) / 2; // lower segment on a 0.5 m step
  const segments_m = single ? [L] : [half, L - half];

  return {
    totalBars,
    label: totalBars > 0 ? `${totalBars}Φ${dia_mm}` : 'Không cốt thép',
    grade: rebarGradeOf(rs_MPa),
    steelRatio: totalBars > 0 ? (totalBars * Math.PI * dia_mm * dia_mm) / 4 / (a * a * 1e6) : 0,
    stirrupLabel: `Φ${STIRRUP_DIA_MM} a${STIRRUP_END_PITCH_M * 1000}/a${STIRRUP_BODY_PITCH_M * 1000}`,
    stirrupCount,
    segments_m,
    segmentNote: single
      ? `1 đoạn (L = ${L.toFixed(1)} m)`
      : `${segments_m.length} đoạn (${segments_m.map((s) => s.toFixed(1)).join(' + ')} m) — mối nối CHƯA thiết kế`,
    concreteVol_m3: a * a * L,
    mainSteel_kg,
    stirrupSteel_kg,
    hookSteel_kg,
    steel_kg: mainSteel_kg + stirrupSteel_kg + hookSteel_kg,
    handlingMoment_kNm: HANDLING_DYNAMIC_FACTOR * HANDLING_MOMENT_COEF * q_kN_m * L * L
  };
}
