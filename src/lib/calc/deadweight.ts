/**
 * Option 2 (PA2) — gravity anchor: a concrete block resting on the lake bed in
 * place of a driven lake-bed pile. Shore anchors stay piles in both options
 * (a block would slide down the 20–40° bank).
 *
 * The block is loaded by the governing line tension T of the raft at the bed
 * cable angle α (the same T and α the lake-bed pile is checked with):
 *   H = T·cos α (drag along the bed),  V = T·sin α (lift).
 * Submerged weight: W_sub = W_air · (1 − ρ_w / ρ_c).
 *   DW-1 sliding:      μ · (W_sub − V) / H            ≥ SF_slide
 *   DW-2 uplift:       W_sub / V                      ≥ SF_uplift
 *   DW-3 overturning:  (W_sub − V) · (L/2) / (H · h)  ≥ SF_overturn   (cable at the top centre)
 *   DW-4 bearing:      q_contact ≤ q_allow, where q_contact is the larger of
 *        the still-water pressure W_sub / A (no cable load) and the EDGE
 *        pressure under the design load (N = W_sub − V acting at eccentricity
 *        e = H·h / N; trapezoidal while e ≤ L/6, triangular beyond).
 *
 * Not modelled: settlement / long-term sinking of the block in soft mud,
 * suction and embedment gains, bed slope, and cyclic degradation of the
 * friction. μ and q_allow are assumed values until a lake-bed survey exists.
 */

export const G_MS2 = 9.81;

/** Engineering inputs of the gravity block (all editable; defaults are assumptions, not survey data). */
export interface DeadweightParams {
  /** Block–mud friction coefficient. */
  mu: number;
  sfSlide: number;
  sfUplift: number;
  sfOverturn: number;
  /** Allowable bearing pressure of the lake-bed mud, kPa. */
  qAllow_kPa: number;
  /** Concrete density, t/m³. */
  rhoConcrete_tm3: number;
}

export const DEADWEIGHT_DEFAULTS: DeadweightParams = {
  mu: 0.35,
  sfSlide: 1.5,
  sfUplift: 1.5,
  sfOverturn: 1.5,
  qAllow_kPa: 40,
  rhoConcrete_tm3: 2.4
};

const RHO_WATER_TM3 = 1.0;
/** The design mass is rounded UP to this step, t; plan side and height UP to this step, m. */
const MASS_STEP_T = 0.5;
const DIM_STEP_M = 0.05;
/** Starting proportion of the box (L = W = ratio · h); it is flattened further when bearing governs. */
const PLAN_TO_HEIGHT = 1.4;
/** A slab thinner than this is not a practical gravity anchor. */
const MIN_HEIGHT_M = 0.5;

export interface DeadweightInput extends Partial<DeadweightParams> {
  /** Governing line tension, kN. */
  tension_kN: number;
  /** Cable angle above the horizontal at the anchor, degrees. */
  cableAngle_deg: number;
}

export interface DeadweightEvaluation {
  H_kN: number;
  V_kN: number;
  sfSlide: number;
  sfUplift: number;
  sfOverturn: number;
  /** W_sub / A with no cable load, kPa. */
  qStatic_kPa: number;
  /** Edge pressure under the load, kPa (Infinity when the resultant leaves the base). */
  qEdge_kPa: number;
  /** max(qStatic, qEdge), kPa. */
  qContact_kPa: number;
}

export interface DeadweightResult extends DeadweightEvaluation {
  params: DeadweightParams;
  /** 1 − ρ_w/ρ_c. */
  buoyancyFactor: number;
  /** Mass in air needed by each criterion, t (before rounding). */
  massUplift_t: number;
  massSlide_t: number;
  /** What sets the mass. */
  governing: 'uplift' | 'sliding';
  /** The footprint had to be widened beyond L = 1.4·h to keep the mud pressure within q_allow. */
  bearingGovernsShape: boolean;
  /** max of the two masses, rounded up, t. */
  designMass_t: number;
  /** Box as built: L = W (plan), H (height), rounded up — so its mass ≥ designMass_t. */
  L_m: number;
  W_m: number;
  H_m: number;
  baseArea_m2: number;
  volume_m3: number;
  /** Mass in air, t, and weights in air / submerged, kN. */
  mass_t: number;
  weightAir_kN: number;
  weightSub_kN: number;
  /** All four criteria met. */
  ok: boolean;
}

const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

/**
 * Safety factors and mud pressure of an EXISTING block under a load (e.g. the
 * wind chosen in the 3D simulation). A block lifted off the bed (V ≥ W_sub)
 * has no friction and no overturning resistance.
 */
export function evaluateDeadweightBlock(
  block: Pick<DeadweightResult, 'weightSub_kN' | 'L_m' | 'W_m' | 'H_m'>,
  tension_kN: number,
  cableAngle_deg: number,
  mu: number = DEADWEIGHT_DEFAULTS.mu
): DeadweightEvaluation {
  const a = (cableAngle_deg * Math.PI) / 180;
  const H = tension_kN * Math.cos(a);
  const V = tension_kN * Math.sin(a);
  const N = Math.max(0, block.weightSub_kN - V);
  const area = block.L_m * block.W_m;
  const qStatic = block.weightSub_kN / area;

  let qEdge: number;
  if (N <= 0) qEdge = H > 0 ? Infinity : 0;
  else {
    const e = (H * block.H_m) / N;
    if (e <= block.L_m / 6) qEdge = (N / area) * (1 + (6 * e) / block.L_m);
    else if (e < block.L_m / 2) qEdge = (2 * N) / (3 * block.W_m * (block.L_m / 2 - e));
    else qEdge = Infinity;
  }

  return {
    H_kN: H,
    V_kN: V,
    sfUplift: V > 0 ? block.weightSub_kN / V : Infinity,
    sfSlide: H > 0 ? (mu * N) / H : Infinity,
    sfOverturn: H > 0 ? (N * (block.L_m / 2)) / (H * block.H_m) : Infinity,
    qStatic_kPa: qStatic,
    qEdge_kPa: qEdge,
    qContact_kPa: Math.max(qStatic, qEdge)
  };
}

/** True when an evaluation meets all four criteria of `p`. */
export function deadweightOk(e: DeadweightEvaluation, p: DeadweightParams): boolean {
  return e.sfSlide >= p.sfSlide && e.sfUplift >= p.sfUplift && e.sfOverturn >= p.sfOverturn && e.qContact_kPa <= p.qAllow_kPa;
}

/**
 * Sizes the block: mass from sliding / uplift (rounded up), then the flattest
 * box needed so that overturning and the mud pressure are also satisfied.
 */
export function sizeDeadweightBlock(input: DeadweightInput): DeadweightResult {
  const params: DeadweightParams = {
    mu: input.mu ?? DEADWEIGHT_DEFAULTS.mu,
    sfSlide: input.sfSlide ?? DEADWEIGHT_DEFAULTS.sfSlide,
    sfUplift: input.sfUplift ?? DEADWEIGHT_DEFAULTS.sfUplift,
    sfOverturn: input.sfOverturn ?? DEADWEIGHT_DEFAULTS.sfOverturn,
    qAllow_kPa: input.qAllow_kPa ?? DEADWEIGHT_DEFAULTS.qAllow_kPa,
    rhoConcrete_tm3: input.rhoConcrete_tm3 ?? DEADWEIGHT_DEFAULTS.rhoConcrete_tm3
  };
  const { mu, rhoConcrete_tm3: rhoC } = params;
  if (!(mu > 0) || !(rhoC > RHO_WATER_TM3)) throw new Error('Deadweight block: need mu > 0 and concrete denser than water');

  const a = (input.cableAngle_deg * Math.PI) / 180;
  const H = input.tension_kN * Math.cos(a);
  const V = input.tension_kN * Math.sin(a);
  const k = 1 - RHO_WATER_TM3 / rhoC;

  const massUplift = (params.sfUplift * V) / (k * G_MS2);
  const massSlide = ((params.sfSlide * H) / mu + V) / (k * G_MS2);
  const designMass = ceilTo(Math.max(massUplift, massSlide), MASS_STEP_T);
  const volumeNeeded = designMass / rhoC;

  const build = (side: number, h: number) => {
    const volume = side * side * h;
    const mass = volume * rhoC;
    const weightSub = mass * k * G_MS2;
    const ev = evaluateDeadweightBlock({ weightSub_kN: weightSub, L_m: side, W_m: side, H_m: h }, input.tension_kN, input.cableAngle_deg, mu);
    return { side, h, volume, mass, weightSub, ev };
  };

  // Start from L = W = 1.4·h; widen (and thin) the box while overturning or the mud pressure fail.
  const h0 = ceilTo(Math.cbrt(volumeNeeded / (PLAN_TO_HEIGHT * PLAN_TO_HEIGHT)), DIM_STEP_M);
  let side = ceilTo(Math.sqrt(volumeNeeded / h0), DIM_STEP_M);
  let b = build(side, h0);
  let widened = false;
  while ((b.ev.qContact_kPa > params.qAllow_kPa || b.ev.sfOverturn < params.sfOverturn) && b.h > MIN_HEIGHT_M) {
    side += DIM_STEP_M;
    side = Math.round(side / DIM_STEP_M) * DIM_STEP_M;
    b = build(side, Math.max(MIN_HEIGHT_M, ceilTo(volumeNeeded / (side * side), DIM_STEP_M)));
    widened = true;
  }

  return {
    ...b.ev,
    params,
    buoyancyFactor: k,
    massUplift_t: massUplift,
    massSlide_t: massSlide,
    governing: massSlide >= massUplift ? 'sliding' : 'uplift',
    bearingGovernsShape: widened,
    designMass_t: designMass,
    L_m: b.side,
    W_m: b.side,
    H_m: b.h,
    baseArea_m2: b.side * b.side,
    volume_m3: b.volume,
    mass_t: b.mass,
    weightAir_kN: b.mass * G_MS2,
    weightSub_kN: b.weightSub,
    ok: deadweightOk(b.ev, params)
  };
}
