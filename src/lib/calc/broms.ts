import { BromsResult, PileSectionInput } from './types';

const DEFAULT_REBAR_FY_MPA = 300; // CB300-V, common Vietnamese pile reinforcement grade

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
 * Reinforced-concrete bending capacity, kNm.
 * Mrd = Mrd_concrete (0.9 * Rb * W_section, the existing plain-concrete
 * estimate) + Mrd_steel, a simplified strength contribution from the
 * longitudinal reinforcement acting at an internal lever arm ~0.85D
 * (symmetric reinforcement, both faces active in tension/compression at the
 * ultimate limit state — a standard hand-calc simplification, NOT a full
 * RC section design; always verify against the governing concrete code).
 */
export function pileMrd_kNm(
  section: PileSectionInput,
  concreteRb_MPa: number
): { Mrd_kNm: number; MrdConcrete_kNm: number; MrdSteel_kNm: number } {
  const D = Math.max(0.05, section.D_m);
  const W = pileSectionModulus_m3(section);
  const MrdConcrete_kNm = 0.9 * (concreteRb_MPa * 1000) * W;

  const As_mm2 = section.rebarArea_mm2 ?? 0;
  let MrdSteel_kNm = 0;
  if (As_mm2 > 0) {
    const fy_kPa = (section.rebarFy_MPa ?? DEFAULT_REBAR_FY_MPA) * 1000;
    const As_m2 = As_mm2 / 1_000_000;
    const leverArm_m = 0.85 * D;
    MrdSteel_kNm = As_m2 * fy_kPa * leverArm_m;
  }

  return { Mrd_kNm: MrdConcrete_kNm + MrdSteel_kNm, MrdConcrete_kNm, MrdSteel_kNm };
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
  const utilization_M = Mrd > 0 ? Mmax / Mrd : 999;
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
  const utilization_M = Mrd > 0 ? Mmax / Mrd : 999;
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
