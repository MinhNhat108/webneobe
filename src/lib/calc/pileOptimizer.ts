import {
  BromsResult,
  PileSectionInput,
  PileOptimizationInput,
  PileOptimizationResult,
  PileCapacityBreakdown,
  PileGoverningCriterion
} from './types';
import { calculateBromsPile, pileEffectiveWidth_m, pileMrd_kNm } from './broms';

/** Depth steps the site crew can actually drive to. */
export const DEFAULT_PILE_DEPTH_STEP_M = 0.25;
export const DEFAULT_PILE_MIN_L_M = 2.0;
export const DEFAULT_PILE_MAX_L_M = 20.0;

const EPS = 1e-6;

/** Rounds a length UP to the next multiple of `step` (construction rounding). */
export function roundUpToStep(value: number, step: number): number {
  const s = step > 0 ? step : DEFAULT_PILE_DEPTH_STEP_M;
  return Math.round(Math.ceil(value / s - EPS) * s * 1e6) / 1e6;
}

/**
 * Largest lateral load H the SECTION can carry before M_max reaches M_rd.
 *
 * This is the inverse of the `Mmax` expression each Broms branch uses, so it
 * stays consistent with `calculateBromsPile`:
 *  - cohesive: Mmax(H) = H*(e + 1.5D) + 0.5*H^2/p  -> solve the quadratic for H
 *  - sand:     Mmax(H) = H*(e + 2f/3)              -> H = Mrd / (e + 2f/3)
 *
 * Unlike the soil capacities, this limit does NOT grow with embedment depth:
 * a pile that fails in bending can only be fixed with a bigger section or
 * more reinforcement, never with a deeper hole. `optimizePileEmbedment`
 * relies on that fact to stop early instead of iterating to `maxL_m`.
 */
export function pileMomentLimitedH_kN(
  broms: BromsResult,
  e_m: number,
  section: PileSectionInput,
  concreteRb_MPa: number
): number {
  const { Mrd_kNm } = pileMrd_kNm(section, concreteRb_MPa);
  if (Mrd_kNm <= 0) return 0;

  if (broms.soilModel === 'sand') {
    const arm = e_m + (2 * broms.f) / 3;
    return arm > EPS ? Mrd_kNm / arm : Number.POSITIVE_INFINITY;
  }

  const D = pileEffectiveWidth_m(section);
  const p = broms.p; // ultimate soil resistance per metre, kN/m (cohesive branch)
  if (p <= EPS) return 0;
  const a = 0.5 / p;
  const b = e_m + 1.5 * D;
  // a*H^2 + b*H - Mrd = 0
  return (-b + Math.sqrt(b * b + 4 * a * Mrd_kNm)) / (2 * a);
}

/**
 * P_max - maximum allowable HOLDING CAPACITY of the pile, expressed as the
 * largest cable tension T the pile head can take, kN.
 *
 * The cable pulls at `cableAngle_deg` above the horizontal, so each capacity
 * is converted into the tension that would exhaust it:
 *   T_lateral = H_allow / cos(theta)        (Broms lateral soil capacity, with FS)
 *   T_moment  = H_mrd   / cos(theta)        (section bending capacity)
 *   T_uplift  = Q_uplift,all / sin(theta)   (shaft friction, its own FS = 2.0)
 * P_max is the smallest of the three - the criterion that actually governs.
 */
export function pileAllowableTension(
  broms: BromsResult,
  e_m: number,
  section: PileSectionInput,
  concreteRb_MPa: number,
  cableAngle_deg: number
): PileCapacityBreakdown {
  const angle = Math.max(0, Math.min(89.9, cableAngle_deg));
  const theta = (angle * Math.PI) / 180;
  const cos = Math.max(0.05, Math.cos(theta)); // a ~vertical cable is not a mooring line
  const sin = Math.sin(theta);

  const Pmax_lateral_kN = broms.H_allow / cos;
  const Pmax_moment_kN = pileMomentLimitedH_kN(broms, e_m, section, concreteRb_MPa) / cos;
  const Pmax_uplift_kN =
    sin > 0.01 && (broms.upliftCapacity_all ?? 0) > 0
      ? (broms.upliftCapacity_all as number) / sin
      : Number.POSITIVE_INFINITY;

  let Pmax_kN = Pmax_lateral_kN;
  let governing: PileGoverningCriterion = 'lateral';
  if (Pmax_moment_kN < Pmax_kN) {
    Pmax_kN = Pmax_moment_kN;
    governing = 'moment';
  }
  if (Pmax_uplift_kN < Pmax_kN) {
    Pmax_kN = Pmax_uplift_kN;
    governing = 'uplift';
  }

  const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
  return {
    Pmax_kN: r2(Pmax_kN),
    Pmax_lateral_kN: r2(Pmax_lateral_kN),
    Pmax_moment_kN: r2(Pmax_moment_kN),
    Pmax_uplift_kN: r2(Pmax_uplift_kN),
    governing,
    cableAngle_deg: Math.round(angle * 10) / 10
  };
}

/**
 * Broms INVERSE solver - finds the shallowest embedment L that carries the
 * cable loads of THIS line.
 *
 * Search: L is stepped from `minL_m` to `maxL_m` by the construction step
 * (0.25 m / 0.5 m), and the first depth where all three Broms criteria hold
 * simultaneously wins:
 *   H_allow(L)      >= H     (lateral, FS applied inside the Broms model)
 *   Q_uplift,all(L) >= Tv    (shaft friction, FS = 2.0 inside the model)
 *   M_max           <= M_rd  (section bending - depth-independent)
 *
 * A linear scan (not a bisection) is deliberate: the capacities are monotonic
 * in L but the answer must land exactly on a constructible step anyway, and a
 * 20 m / 0.25 m sweep is ~72 closed-form evaluations - cheaper than the
 * bookkeeping a bracketed solve would need, and it cannot miss a step.
 *
 * Bending is checked FIRST and aborts the sweep: M_max depends on the applied
 * load and the section, not on L, so a section that cannot take the moment
 * will never pass however deep it is driven. Returning `converged: false`
 * with `governing: 'moment'` tells the user to enlarge the section instead of
 * silently reporting `maxL_m`.
 */
export function optimizePileEmbedment(params: PileOptimizationInput): PileOptimizationResult {
  const step = params.step_m && params.step_m > 0 ? params.step_m : DEFAULT_PILE_DEPTH_STEP_M;
  const minL = roundUpToStep(Math.max(0.5, params.minL_m ?? DEFAULT_PILE_MIN_L_M), step);
  const maxL = Math.max(minL, params.maxL_m ?? DEFAULT_PILE_MAX_L_M);
  const concreteRb_MPa = params.concreteRb_MPa ?? 14.5;
  const section: PileSectionInput = params.section ?? { shape: 'square', D_m: params.D };
  const appliedH = Math.max(0, params.appliedH);
  const appliedTv = Math.max(0, params.appliedTv ?? 0);

  const evaluateAt = (L: number): BromsResult =>
    calculateBromsPile(params.soilType, {
      cu_kPa: params.cu_kPa,
      phi_deg: params.phi_deg,
      gammaSub_kNm3: params.gammaSub_kNm3,
      e: params.e,
      D: params.D,
      L,
      FS: params.FS,
      appliedH,
      appliedTv,
      concreteRb_MPa,
      section
    });

  let iterations = 0;
  let L_opt_m: number | null = null;
  let best: BromsResult = evaluateAt(minL);
  let governing: PileGoverningCriterion = 'none';
  let note: string | undefined;

  for (let L = minL; L <= maxL + EPS; L = Math.round((L + step) * 1e6) / 1e6) {
    iterations += 1;
    const broms = iterations === 1 ? best : evaluateAt(L);
    best = broms;

    // Bending is depth-independent - a failure here is terminal for this section.
    if (broms.utilization_M > 1.0) {
      governing = 'moment';
      note =
        `Tiết diện cọc không đủ khả năng chịu uốn (M_max = ${broms.Mmax} kNm > M_rd = ${broms.Mrd} kNm). ` +
        'Tăng chiều sâu đóng cọc KHÔNG khắc phục được — cần tăng kích thước tiết diện hoặc bố trí thêm cốt thép.';
      break;
    }

    const lateralOK = broms.utilization_H <= 1.0;
    const upliftOK = (broms.utilization_Uplift ?? 0) <= 1.0;
    if (lateralOK && upliftOK) {
      L_opt_m = L;
      // Report which criterion was the binding one at the optimum.
      const uH = broms.utilization_H;
      const uU = broms.utilization_Uplift ?? 0;
      const uM = broms.utilization_M;
      governing = uH >= uU && uH >= uM ? 'lateral' : uU >= uM ? 'uplift' : 'moment';
      break;
    }
    governing = lateralOK ? 'uplift' : 'lateral';
  }

  const converged = L_opt_m !== null;

  if (!converged && governing !== 'moment') {
    note =
      `Không tìm được chiều sâu ngàm thỏa mãn trong khoảng ${minL}–${maxL} m ` +
      `(tiêu chí chi phối: ${governing === 'uplift' ? 'sức chịu nhổ' : 'sức chịu tải ngang'}). ` +
      'Cần tăng đường kính cọc, đổi loại cọc hoặc mở rộng giới hạn chiều sâu.';
  }

  const capacity = pileAllowableTension(
    best,
    params.e,
    section,
    concreteRb_MPa,
    params.cableAngle_deg ?? 0
  );

  // P_max actually usable = the smaller of the computed soil/section capacity
  // and the pile's rated (catalogue / load-test) value when the user gave one.
  const rated = params.ratedPmax_kN && params.ratedPmax_kN > 0 ? params.ratedPmax_kN : undefined;
  const effectivePmax_kN = rated !== undefined ? Math.min(capacity.Pmax_kN, rated) : capacity.Pmax_kN;

  const cableTension_kN = params.cableTension_kN ?? appliedH;
  const sf = params.sfPileCapacity && params.sfPileCapacity > 0 ? params.sfPileCapacity : 1.0;
  const Preq_kN = cableTension_kN * sf;
  const utilization_Pmax = effectivePmax_kN > 0 ? Preq_kN / effectivePmax_kN : Number.POSITIVE_INFINITY;

  const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);

  return {
    L_opt_m,
    converged,
    governing,
    note,
    iterations,
    step_m: step,
    minL_m: minL,
    maxL_m: maxL,
    broms: best,
    capacity,
    ratedPmax_kN: rated,
    effectivePmax_kN: r2(effectivePmax_kN),
    Preq_kN: r2(Preq_kN),
    sfPileCapacity: sf,
    cableTension_kN: r2(cableTension_kN),
    utilization_Pmax: Number.isFinite(utilization_Pmax)
      ? Math.round(utilization_Pmax * 1000) / 1000
      : utilization_Pmax,
    isPmaxOk: utilization_Pmax <= 1.0
  };
}
