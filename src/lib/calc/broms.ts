import { BromsResult } from './types';

/**
 * Calculates lateral capacity and section check of a free-head square pile in cohesive soil
 * based on Broms method.
 * 
 * @param cu Soil undrained shear strength in kPa (kN/m²)
 * @param e Eccentric load arm in meters
 * @param D Pile side width in meters (square cross-section)
 * @param L Pile embedment length in meters
 * @param FS Safety factor (default 2.5)
 * @param appliedH Applied lateral load in kN
 * @param appliedTv Optional applied uplift load in kN
 * @param concreteRb_MPa Concrete design compressive strength in MPa (e.g. 14.5 for B25)
 * @param alpha Adhesion factor for shaft friction (default 0.7)
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
  alpha: number = 0.7
): BromsResult {
  const safeD = Math.max(0.1, D);
  const safeL = Math.max(0.5, L);
  const safeCu = Math.max(1, cu);
  const safeFS = Math.max(1, FS);

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

  // Section moment resistance: Mrd = 0.9 * Rb * W_section = 0.9 * Rb * (D^3 / 6)
  // Rb in MPa = 1000 kPa, D in m -> Mrd in kNm
  const W_section = Math.pow(safeD, 3) / 6.0;
  const Mrd = 0.9 * (concreteRb_MPa * 1000) * W_section;

  // Uplift capacity (Sức chịu nhổ từ ma sát thân cọc)
  // Perimeter = 4 * D, Area of shaft = 4 * D * L
  // Qs = alpha * cu * (4*D*L)
  const upliftCapacity_ult = alpha * safeCu * (4 * safeD * safeL);
  const upliftCapacity_all = upliftCapacity_ult / 2.0; // FS=2.0 for uplift

  const utilization_H = H_allow > 0 ? appliedH / H_allow : 999;
  const utilization_M = Mrd > 0 ? Mmax / Mrd : 999;
  const utilization_Uplift = upliftCapacity_all > 0 ? appliedTv / upliftCapacity_all : 0;

  // Concrete volume
  const orderedLength_m = safeL + (e > 0 ? e + 1.0 : 1.0);
  const concreteVolume_m3 = safeD * safeD * orderedLength_m;

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
    isPassed
  };
}
