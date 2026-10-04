import { BromsResult, PileSectionInput } from './types';

const DEFAULT_REBAR_FY_MPA = 300; // CB300-V — only for the legacy total-area input
/** TCVN 5574:2018 design strengths. */
export const DEFAULT_REBAR_RS_MPA = 350; // CB400-V
export const DEFAULT_REBAR_COVER_MM = 50; // concrete face to bar centre
/** Share of a LEGACY total bar area counted on the tension face (3 of the 8 bars of a ring). */
const LEGACY_TENSION_SHARE = 3 / 8;

/** Rbt of the concrete class whose Rb is given (TCVN 5574:2018, B15…B40), MPa. */
export function concreteRbtFromRb_MPa(rb_MPa: number): number {
  const table: Array<[number, number]> = [[8.5, 0.75], [11.5, 0.9], [14.5, 1.05], [17, 1.15], [19.5, 1.3], [22, 1.4]];
  if (rb_MPa <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (rb_MPa <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (rb_MPa - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Σ|y_i| / r for n bars equally spaced on a circle, in the WORST orientation
 * of the cage against the bending axis. A round pile's cage is not oriented
 * when it is lowered into a bored hole, so the bending check may not rely on
 * a favourable one. (4 bars: 2.0 with a bar on the axis, 2.83 at 45° — the
 * check uses 2.0.)
 */
export function ringLeverFactor(n: number): number {
  const count = Math.floor(n);
  if (count < 2) return 0;
  let worst = Infinity;
  const steps = 720;
  for (let s = 0; s < steps; s++) {
    const phase = ((2 * Math.PI) / count) * (s / steps);
    let sum = 0;
    for (let i = 0; i < count; i++) sum += Math.abs(Math.sin(phase + (2 * Math.PI * i) / count));
    worst = Math.min(worst, sum);
  }
  return worst;
}

/** Bars of diameter d that fit on the cage circle of a round pile: spacing along the circle ≥ max(2d, d + 30 mm). */
export function maxBarsOnRing(dia_m: number, bar_mm: number, cover_mm: number = DEFAULT_REBAR_COVER_MM): number {
  const r = dia_m * 1000 / 2 - cover_mm;
  if (r <= 0) return 0;
  return Math.floor((2 * Math.PI * r) / Math.max(2 * bar_mm, bar_mm + 30) + 1e-9);
}

/** Bars of diameter d that fit in ONE layer on a face of side `side_m`: spacing ≥ max(2d, d + 30 mm). */
export function maxBarsPerFace(side_m: number, dia_mm: number, cover_mm: number = DEFAULT_REBAR_COVER_MM): number {
  const width = side_m * 1000 - 2 * cover_mm;
  if (width < 0) return 0;
  return Math.floor(width / Math.max(2 * dia_mm, dia_mm + 30) + 1e-9) + 1;
}

/**
 * Effective width the soil "sees" for lateral (Broms) resistance, m.
 * Square: the side itself. Circular/pipe: the outer diameter — the classic
 * simplification (Broms 1964 §"circular piles") that avoids a separate shape
 * factor while remaining conservative for design.
 */
export function pileEffectiveWidth_m(section: PileSectionInput): number {
  return Math.max(0.05, section.D_m);
}

/** Outer skin perimeter used for shaft-friction uplift, m. */
export function pilePerimeter_m(section: PileSectionInput): number {
  const D = Math.max(0.05, section.D_m);
  if (section.shape === 'square') return 4 * D;
  return Math.PI * D; // circular and pipe share the same outer perimeter
}

/** Elastic section modulus W = I / (D/2), m3 — the concrete-only value. */
export function pileSectionModulus_m3(section: PileSectionInput): number {
  const D = Math.max(0.05, section.D_m);
  if (section.shape === 'square') {
    return Math.pow(D, 3) / 6.0;
  }
  if (section.shape === 'pipe') {
    const tWall = Math.max(0.01, Math.min(D / 2 - 0.01, section.tWall_m ?? 0.08));
    const Din = Math.max(0.01, D - 2 * tWall);
    return (Math.PI * (Math.pow(D, 4) - Math.pow(Din, 4))) / (32 * D);
  }
  // circular solid
  return (Math.PI * Math.pow(D, 3)) / 32.0;
}

/** Concrete cross-section area, m2 (for ordered-concrete-volume reporting). */
export function pileCrossSectionArea_m2(section: PileSectionInput): number {
  const D = Math.max(0.05, section.D_m);
  if (section.shape === 'square') return D * D;
  if (section.shape === 'pipe') {
    const tWall = Math.max(0.01, Math.min(D / 2 - 0.01, section.tWall_m ?? 0.08));
    const Din = Math.max(0.01, D - 2 * tWall);
    return (Math.PI / 4) * (D * D - Din * Din);
  }
  return (Math.PI / 4) * (D * D);
}

/**
 * Bending capacity of the pile section, kNm — TCVN 5574:2018.
 *
 *  - REINFORCED (symmetric bars, pure bending — the axial load of a mooring
 *    pile is negligible): the compression zone is taken by the compression
 *    bars (x ≈ 0 since As = As'), so
 *        M_rd = Rs · As_tension · (h0 − a') = Rs · As_tension · (D − 2·a_s)
 *    with As_tension the bars of ONE face. Cracked concrete carries no tension,
 *    so nothing is added for the concrete.
 *  - ROUND pile (bored / circular / pipe) with n bars equally spaced on a
 *    circle of radius r_s = D/2 − a_s: the same steel couple,
 *        M_rd = Rs · A_bar · r_s · Σ|sin θ_i|,
 *    taken in the WORST orientation of the cage (see ringLeverFactor). With 4
 *    bars that is Rs · A_bar · 2·r_s — HALF of a square pile of the same size
 *    and bars, whose 2 tension bars sit a full D − 2·a_s from the compression
 *    bars. A round pile therefore needs more bars for the same moment.
 *  - UNREINFORCED: a plain section fails when it cracks, M_crc = Rbt · W. (The
 *    compressive strength Rb is irrelevant to it.)
 *
 * Until 2026-10-03 this returned 0.9·Rb·W + As_total·fy·0.85·D, which
 * overstated the capacity 5–12× (compressive strength for a tension failure,
 * concrete and steel added together, all bars counted, characteristic fy and a
 * lever arm that ignored the cover).
 */
export function pileMrd_kNm(
  section: PileSectionInput,
  concreteRb_MPa: number
): { Mrd_kNm: number; MrdConcrete_kNm: number; MrdSteel_kNm: number; AsTension_mm2: number } {
  const D = Math.max(0.05, section.D_m);
  const cover_m = (section.rebarCover_mm ?? DEFAULT_REBAR_COVER_MM) / 1000;
  const lever_m = Math.max(0, D - 2 * cover_m);

  let AsTension_mm2 = 0;
  let Rs_MPa = section.rebarRs_MPa ?? DEFAULT_REBAR_RS_MPA;

  if (section.shape !== 'square') {
    // Round pile: bars on a circle. Without an explicit count, a square-style
    // "k per face" input is read as the 4·(k − 1) bars it would build.
    const n = Math.floor(section.rebarTotalCount ?? ((section.rebarFaceCount ?? 0) >= 2 ? 4 * (section.rebarFaceCount! - 1) : 0));
    if (n >= 2 && (section.rebarDia_mm ?? 0) > 0) {
      const Abar_mm2 = (Math.PI * section.rebarDia_mm! * section.rebarDia_mm!) / 4;
      const r_m = Math.max(0, D / 2 - cover_m);
      const MrdSteel_kNm = (Abar_mm2 / 1_000_000) * (Rs_MPa * 1000) * r_m * ringLeverFactor(n);
      return { Mrd_kNm: MrdSteel_kNm, MrdConcrete_kNm: 0, MrdSteel_kNm, AsTension_mm2: (n / 2) * Abar_mm2 };
    }
  }

  if (section.shape === 'square' && (section.rebarFaceCount ?? 0) > 0 && (section.rebarDia_mm ?? 0) > 0) {
    AsTension_mm2 = section.rebarFaceCount! * (Math.PI * section.rebarDia_mm! * section.rebarDia_mm!) / 4;
  } else if ((section.rebarArea_mm2 ?? 0) > 0) {
    AsTension_mm2 = section.rebarArea_mm2! * LEGACY_TENSION_SHARE;
    Rs_MPa = section.rebarRs_MPa ?? (section.rebarFy_MPa ?? DEFAULT_REBAR_FY_MPA) / 1.15;
  }

  if (AsTension_mm2 > 0) {
    const MrdSteel_kNm = (AsTension_mm2 / 1_000_000) * (Rs_MPa * 1000) * lever_m;
    return { Mrd_kNm: MrdSteel_kNm, MrdConcrete_kNm: 0, MrdSteel_kNm, AsTension_mm2 };
  }

  const rbt_MPa = section.concreteRbt_MPa ?? concreteRbtFromRb_MPa(concreteRb_MPa);
  const MrdConcrete_kNm = rbt_MPa * 1000 * pileSectionModulus_m3(section);
  return { Mrd_kNm: MrdConcrete_kNm, MrdConcrete_kNm, MrdSteel_kNm: 0, AsTension_mm2: 0 };
}

/**
 * Calculates lateral capacity and section check of a free-head pile in
 * COHESIVE soil (clay/mud, cu) based on Broms' method.
 *
 * @param cu Soil undrained shear strength in kPa (kN/m²)
 * @param e Eccentric load arm in meters
 * @param D Pile side width (square) or outer diameter, meters
 * @param L Pile embedment length in meters
 * @param FS Safety factor (default 2.5)
 * @param appliedH Applied lateral load in kN
 * @param appliedTv Optional applied uplift load in kN
 * @param concreteRb_MPa Concrete design compressive strength in MPa (e.g. 14.5 for B25)
 * @param alpha Adhesion factor for shaft friction (default 0.7)
 * @param section Optional pile shape / reinforcement. Omit for the original
 *   square, plain-concrete behaviour (backward compatible).
 */
export function calculateBromsCohesivePile(
  cu: number,
  e: number,
  D: number,
  L: number,
  FS: number,
  appliedH: number,
  appliedTv: number = 0,
  concreteRb_MPa: number = 14.5,
  alpha: number = 0.7,
  section?: PileSectionInput
): BromsResult {
  const sec: PileSectionInput = section ?? { shape: 'square', D_m: D };
  const safeD = pileEffectiveWidth_m(sec);
  const safeL = Math.max(0.5, L);
  const safeCu = Math.max(1, cu);
  const safeFS = Math.max(1, FS);
  const perimeter = pilePerimeter_m(sec);

  // Broms effective embedment g = L - 1.5*D (upper 1.5D zone has zero lateral resistance)
  const g = Math.max(0.1, safeL - 1.5 * safeD);
  const p = 9 * safeCu * safeD; // ultimate soil resistance per meter (kN/m)

  // Broms quadratic equation: 0.5/p * Hu^2 + (e + 1.5*D + g)*Hu - 0.5*p*g^2 = 0
  const A = 0.5 / p;
  const B = e + 1.5 * safeD + g;
  const C = -0.5 * p * g * g;

  const delta = Math.max(0, B * B - 4 * A * C);
  const Hu = (-B + Math.sqrt(delta)) / (2 * A);
  const H_allow = Hu / safeFS;

  // Maximum bending moment in pile
  const f = Hu / p; // depth to maximum moment below 1.5D
  const Mmax = appliedH * (e + 1.5 * safeD + 0.5 * (appliedH / p));

  // Section moment resistance (concrete + reinforcement, per pileMrd_kNm)
  const { Mrd_kNm, MrdConcrete_kNm, MrdSteel_kNm } = pileMrd_kNm(sec, concreteRb_MPa);
  const Mrd = Mrd_kNm;

  // Uplift capacity (shaft friction): Qs = alpha * cu * perimeter * L
  const upliftCapacity_ult = alpha * safeCu * (perimeter * safeL);
  const upliftCapacity_all = upliftCapacity_ult / 2.0; // FS=2.0 for uplift

  const utilization_H = H_allow > 0 ? appliedH / H_allow : 999;
  const utilization_M = Mrd > 0 ? ((sec.bendingLoadFactor ?? 1.0) * Mmax) / Mrd : 999;
  const utilization_Uplift = upliftCapacity_all > 0 ? appliedTv / upliftCapacity_all : 0;

  // Concrete volume
  const orderedLength_m = safeL + (e > 0 ? e + 1.0 : 1.0);
  const sectionArea_m2 = pileCrossSectionArea_m2(sec);
  const concreteVolume_m3 = sectionArea_m2 * orderedLength_m;

  const isPassed = utilization_H <= 1.0 && utilization_M <= 1.0 && utilization_Uplift <= 1.0;

  return {
    g: Math.round(g * 100) / 100,
    p: Math.round(p * 10) / 10,
    Hu: Math.round(Hu * 100) / 100,
    H_allow: Math.round(H_allow * 100) / 100,
    f: Math.round(f * 100) / 100,
    Mmax: Math.round(Mmax * 100) / 100,
    Mrd: Math.round(Mrd * 100) / 100,
    utilization_H: Math.round(utilization_H * 1000) / 1000,
    utilization_M: Math.round(utilization_M * 1000) / 1000,
    upliftCapacity_all: Math.round(upliftCapacity_all * 100) / 100,
    utilization_Uplift: Math.round(utilization_Uplift * 1000) / 1000,
    concreteVolume_m3: Math.round(concreteVolume_m3 * 100) / 100,
    orderedLength_m: Math.round(orderedLength_m * 10) / 10,
    isPassed,
    soilModel: 'clay',
    shape: sec.shape,
    effectiveWidth_m: safeD,
    perimeter_m: Math.round(perimeter * 100) / 100,
    MrdConcrete_kNm: Math.round(MrdConcrete_kNm * 100) / 100,
    MrdSteel_kNm: Math.round(MrdSteel_kNm * 100) / 100
  };
}

/**
 * Calculates lateral capacity and section check of a free-head pile in
 * COHESIONLESS soil (sand, phi/gamma_sub) based on Broms' method.
 *
 * Ultimate soil resistance grows linearly with depth (Rankine passive
 * pressure): p(z) = 3 * Kp * gamma_sub * D * z, Kp = tan²(45° + phi/2).
 *
 * For a short (rigid) free-head pile, taking moments of the triangular
 * resistance about the toe gives the closed-form Broms ultimate load:
 *   Hu = 0.5 * Kp * gamma_sub * D * L³ / (e + L)
 * The depth of zero shear f (where the resistance mobilised above balances
 * Hu) and the resulting max moment follow from the same triangular profile:
 *   f = sqrt( Hu / (1.5 * Kp * gamma_sub * D) )
 *   Mmax = Hu * (e + 2f/3)
 *
 * Shaft-friction uplift capacity uses a simplified API-style skin-friction
 * model: Qs = perimeter * K0 * tan(delta) * gamma_sub * L² / 2, with
 * K0 = 1 − sin(phi) and delta = 0.75 * phi (typical pile/sand interface
 * friction ratio).
 *
 * @param phi_deg Internal friction angle of the sand, degrees
 * @param gamma_sub Submerged unit weight of the sand, kN/m3
 * @param e Eccentric load arm in meters
 * @param D Pile side width (square) or outer diameter, meters
 * @param L Pile embedment length in meters
 * @param FS Safety factor (default 2.5)
 * @param appliedH Applied lateral load in kN
 * @param appliedTv Optional applied uplift load in kN
 * @param concreteRb_MPa Concrete design compressive strength in MPa
 * @param section Optional pile shape / reinforcement (defaults to square, plain concrete)
 */
export function calculateBromsSandPile(
  phi_deg: number,
  gamma_sub: number,
  e: number,
  D: number,
  L: number,
  FS: number,
  appliedH: number,
  appliedTv: number = 0,
  concreteRb_MPa: number = 14.5,
  section?: PileSectionInput
): BromsResult {
  const sec: PileSectionInput = section ?? { shape: 'square', D_m: D };
  const safeD = pileEffectiveWidth_m(sec);
  const safeL = Math.max(0.5, L);
  const safePhi = Math.min(45, Math.max(15, phi_deg)); // sane bracket for a granular soil
  const safeGamma = Math.max(1, gamma_sub);
  const safeFS = Math.max(1, FS);
  const perimeter = pilePerimeter_m(sec);

  const phiRad = (safePhi * Math.PI) / 180;
  const Kp = Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);

  // Hu = 0.5 * Kp * gamma_sub * D * L^3 / (e + L)
  const denom = Math.max(0.1, e + safeL);
  const Hu = (0.5 * Kp * safeGamma * safeD * Math.pow(safeL, 3)) / denom;
  const H_allow = Hu / safeFS;

  // Depth of zero shear (max moment) from the same triangular pressure profile.
  const coeff = 1.5 * Kp * safeGamma * safeD;
  const f = coeff > 0 ? Math.sqrt(Hu / coeff) : 0;
  const Mmax = appliedH * (e + (2 * f) / 3);

  const { Mrd_kNm, MrdConcrete_kNm, MrdSteel_kNm } = pileMrd_kNm(sec, concreteRb_MPa);
  const Mrd = Mrd_kNm;

  // Shaft friction uplift capacity (simplified API-style skin friction in sand).
  const K0 = Math.max(0.2, 1 - Math.sin(phiRad));
  const deltaRad = 0.75 * phiRad;
  const upliftCapacity_ult = perimeter * K0 * Math.tan(deltaRad) * safeGamma * (Math.pow(safeL, 2) / 2);
  const upliftCapacity_all = upliftCapacity_ult / 2.0; // FS = 2.0 for uplift, matching the clay model

  const utilization_H = H_allow > 0 ? appliedH / H_allow : 999;
  const utilization_M = Mrd > 0 ? ((sec.bendingLoadFactor ?? 1.0) * Mmax) / Mrd : 999;
  const utilization_Uplift = upliftCapacity_all > 0 ? appliedTv / upliftCapacity_all : 0;

  const orderedLength_m = safeL + (e > 0 ? e + 1.0 : 1.0);
  const sectionArea_m2 = pileCrossSectionArea_m2(sec);
  const concreteVolume_m3 = sectionArea_m2 * orderedLength_m;

  const isPassed = utilization_H <= 1.0 && utilization_M <= 1.0 && utilization_Uplift <= 1.0;

  return {
    g: Math.round(f * 100) / 100, // no "1.5D dead zone" in the sand model; report f here too for table symmetry
    p: Math.round(3 * Kp * safeGamma * safeD * safeL * 10) / 10, // ultimate pressure at the toe, kN/m — reference value
    Hu: Math.round(Hu * 100) / 100,
    H_allow: Math.round(H_allow * 100) / 100,
    f: Math.round(f * 100) / 100,
    Mmax: Math.round(Mmax * 100) / 100,
    Mrd: Math.round(Mrd * 100) / 100,
    utilization_H: Math.round(utilization_H * 1000) / 1000,
    utilization_M: Math.round(utilization_M * 1000) / 1000,
    upliftCapacity_all: Math.round(upliftCapacity_all * 100) / 100,
    utilization_Uplift: Math.round(utilization_Uplift * 1000) / 1000,
    concreteVolume_m3: Math.round(concreteVolume_m3 * 100) / 100,
    orderedLength_m: Math.round(orderedLength_m * 10) / 10,
    isPassed,
    soilModel: 'sand',
    shape: sec.shape,
    effectiveWidth_m: safeD,
    perimeter_m: Math.round(perimeter * 100) / 100,
    MrdConcrete_kNm: Math.round(MrdConcrete_kNm * 100) / 100,
    MrdSteel_kNm: Math.round(MrdSteel_kNm * 100) / 100,
    Kp: Math.round(Kp * 1000) / 1000
  };
}

/**
 * Dispatches to the clay or sand Broms model by soil type — the single entry
 * point `index.ts` should call so a per-raft/per-pile soil choice ('sand' vs
 * clay/mud) picks the right physics without the caller branching itself.
 */
export function calculateBromsPile(
  soilType: 'clay' | 'mud' | 'sand' | 'rock' | undefined,
  params: {
    cu_kPa?: number;
    phi_deg?: number;
    gammaSub_kNm3?: number;
    e: number;
    D: number;
    L: number;
    FS: number;
    appliedH: number;
    appliedTv?: number;
    concreteRb_MPa?: number;
    section?: PileSectionInput;
  }
): BromsResult {
  if (soilType === 'sand') {
    return calculateBromsSandPile(
      params.phi_deg ?? 30,
      params.gammaSub_kNm3 ?? 10,
      params.e,
      params.D,
      params.L,
      params.FS,
      params.appliedH,
      params.appliedTv ?? 0,
      params.concreteRb_MPa ?? 14.5,
      params.section
    );
  }
  // Clay / mud / rock (rock treated conservatively as stiff clay) all use the
  // cohesive branch — rock has no cu of its own in this simplified tool, so
  // the caller's cuShore/cuBed value (badged as a default) governs.
  return calculateBromsCohesivePile(
    params.cu_kPa ?? 40,
    params.e,
    params.D,
    params.L,
    params.FS,
    params.appliedH,
    params.appliedTv ?? 0,
    params.concreteRb_MPa ?? 14.5,
    0.7,
    params.section
  );
}
