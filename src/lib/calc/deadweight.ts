/**
 * Option 2 (PA2) — gravity anchor: a concrete block resting on the lake bed in
 * place of a driven lake-bed pile. Shore anchors stay piles in both options
 * (a block would slide down the 20–40° bank).
 *
 * The block is loaded by the governing line tension T of the raft at the bed
 * cable angle α (the same T and α the lake-bed pile is checked with):
 *   H = T·cos α (drag along the bed),  V = T·sin α (lift),  N = W_sub − V.
 * Submerged weight: W_sub = W_air · (1 − ρ_w / ρ_c).
 *
 *   DW-1 sliding, two models:
 *     'friction'  — a flat-bottomed block: μ · N / H ≥ SF_slide.
 *     'shear_key' — a block with skirts pushed into the mud: the soil shears
 *                   at the skirt tips, R = c_u·A + 2·c_u·z_s·B (base adhesion
 *                   plus the passive wedge on the leading skirt; NCEL deadweight
 *                   anchors on cohesive seafloor), R / H ≥ SF_slide. The
 *                   resistance comes from the mud strength c_u, not from the
 *                   weight — so the block is far lighter, and the result is
 *                   only as good as the c_u of the top half metre of mud.
 *   DW-2 uplift:       W_sub / V                        ≥ SF_uplift
 *   DW-3 overturning:  N · (L/2) / (H · h_tie)          ≥ SF_overturn
 *   DW-4 bearing:      q_contact ≤ q_allow, where q_contact is the larger of
 *        the still-water pressure W_sub / A (no cable load) and the EDGE
 *        pressure under the design load (N at eccentricity e = H·h_tie / N;
 *        trapezoidal while e ≤ L/6, triangular beyond).
 *   h_tie is the height of the cable padeye above the base of the block.
 *
 * Note on the cable angle: for a friction block, a FLATTER cable does not make
 * the block lighter — it raises H, and H/μ dominates the required weight.
 *
 * Not modelled: settlement / long-term sinking of the block in soft mud,
 * suction, bed slope, cyclic degradation, and the penetration of the skirts.
 * μ, c_u and q_allow are assumed values until a lake-bed survey exists.
 */

export const G_MS2 = 9.81;

export type SlidingModel = 'friction' | 'shear_key';

/** Engineering inputs of the gravity block (all editable; defaults are assumptions, not survey data). */
export interface DeadweightParams {
  /** How the block resists sliding. */
  slidingModel: SlidingModel;
  /** Block–mud friction coefficient ('friction' model). */
  mu: number;
  /** Undrained shear strength of the mud the skirts sit in, kPa ('shear_key' model). */
  cuSurface_kPa: number;
  /** Depth of the skirts below the base, m ('shear_key' model). */
  keyDepth_m: number;
  /** Height of the cable padeye above the base, m. */
  tieHeight_m: number;
  sfSlide: number;
  sfUplift: number;
  sfOverturn: number;
  /** Allowable bearing pressure of the lake-bed mud, kPa. */
  qAllow_kPa: number;
  /** Concrete density, t/m³. */
  rhoConcrete_tm3: number;
}

export const DEADWEIGHT_DEFAULTS: DeadweightParams = {
  slidingModel: 'friction',
  mu: 0.35,
  cuSurface_kPa: 10,
  keyDepth_m: 0.5,
  tieHeight_m: 0.3,
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
/** Starting proportion of a friction block (L = W = ratio · h); it is flattened further when bearing governs. */
const PLAN_TO_HEIGHT = 1.4;
/** A slab thinner than this is not a practical gravity anchor. */
const MIN_HEIGHT_M = 0.5;
/** Widest block the sizing will try before reporting that none works, m. */
const MAX_SIDE_M = 15;

export interface DeadweightInput extends Partial<DeadweightParams> {
  /** Governing line tension, kN. */
  tension_kN: number;
  /** Cable angle above the horizontal at the anchor, degrees. */
  cableAngle_deg: number;
}

export interface DeadweightEvaluation {
  H_kN: number;
  V_kN: number;
  /** Sliding resistance available, kN (μ·N, or c_u·A + 2·c_u·z_s·B). */
  slideResistance_kN: number;
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
  /** Mass in air needed against uplift and against sliding, t (before rounding; sliding is 0 for the shear-key model, where the BASE AREA resists sliding). */
  massUplift_t: number;
  massSlide_t: number;
  /** What sets the mass. */
  governing: 'uplift' | 'sliding';
  /** The footprint had to be widened beyond its starting size to satisfy bearing / overturning. */
  bearingGovernsShape: boolean;
  /** Mass the sliding / uplift criteria ask for, rounded up, t. */
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
const snap = (v: number) => Math.round(v / DIM_STEP_M) * DIM_STEP_M;

export const resolveDeadweightParams = (p: Partial<DeadweightParams> = {}): DeadweightParams => ({
  ...DEADWEIGHT_DEFAULTS,
  ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
});

/**
 * Safety factors and mud pressure of an EXISTING block under a load (e.g. the
 * wind chosen in the 3D simulation). A block lifted off the bed (V ≥ W_sub)
 * has no sliding or overturning resistance in either model.
 */
export function evaluateDeadweightBlock(
  block: Pick<DeadweightResult, 'weightSub_kN' | 'L_m' | 'W_m' | 'H_m'>,
  tension_kN: number,
  cableAngle_deg: number,
  params: Partial<DeadweightParams> = {}
): DeadweightEvaluation {
  const p = resolveDeadweightParams(params);
  const a = (cableAngle_deg * Math.PI) / 180;
  const H = tension_kN * Math.cos(a);
  const V = tension_kN * Math.sin(a);
  const N = Math.max(0, block.weightSub_kN - V);
  const area = block.L_m * block.W_m;
  const qStatic = block.weightSub_kN / area;
  // The padeye cannot be above the block.
  const hTie = Math.min(Math.max(0, p.tieHeight_m), block.H_m);

  let qEdge: number;
  if (N <= 0) qEdge = H > 0 ? Infinity : 0;
  else {
    const e = (H * hTie) / N;
    if (e <= block.L_m / 6) qEdge = (N / area) * (1 + (6 * e) / block.L_m);
    else if (e < block.L_m / 2) qEdge = (2 * N) / (3 * block.W_m * (block.L_m / 2 - e));
    else qEdge = Infinity;
  }

  const slideResistance =
    N <= 0 ? 0
      : p.slidingModel === 'shear_key'
        ? p.cuSurface_kPa * area + 2 * p.cuSurface_kPa * p.keyDepth_m * block.W_m
        : p.mu * N;

  return {
    H_kN: H,
    V_kN: V,
    slideResistance_kN: slideResistance,
    sfUplift: V > 0 ? block.weightSub_kN / V : Infinity,
    sfSlide: H > 0 ? slideResistance / H : Infinity,
    sfOverturn: H > 0 ? (hTie > 0 ? (N * (block.L_m / 2)) / (H * hTie) : N > 0 ? Infinity : 0) : Infinity,
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
 * Sizes the block.
 *  - 'friction': the mass comes from sliding / uplift (rounded up); the box
 *    starts at L = W = 1.4·h and is widened (and thinned) until overturning
 *    and the mud pressure are satisfied too.
 *  - 'shear_key': the base side comes from sliding (c_u·A + 2·c_u·z_s·B ≥
 *    SF·H) and the mass from uplift; the box is then widened until every
 *    criterion holds, which also adds weight once it is down to 0.5 m thick.
 */
export function sizeDeadweightBlock(input: DeadweightInput): DeadweightResult {
  const { tension_kN, cableAngle_deg, ...rest } = input;
  const params = resolveDeadweightParams(rest);
  const { mu, rhoConcrete_tm3: rhoC } = params;
  if (!(rhoC > RHO_WATER_TM3)) throw new Error('Deadweight block: concrete must be denser than water');
  if (params.slidingModel === 'friction' && !(mu > 0)) throw new Error('Deadweight block: need mu > 0');
  if (params.slidingModel === 'shear_key' && !(params.cuSurface_kPa > 0)) throw new Error('Deadweight block: need c_u > 0');

  const a = (cableAngle_deg * Math.PI) / 180;
  const H = tension_kN * Math.cos(a);
  const V = tension_kN * Math.sin(a);
  const k = 1 - RHO_WATER_TM3 / rhoC;
  const keyed = params.slidingModel === 'shear_key';

  const massUplift = (params.sfUplift * V) / (k * G_MS2);
  const massSlide = keyed ? 0 : ((params.sfSlide * H) / mu + V) / (k * G_MS2);
  const designMass = Math.max(MASS_STEP_T, ceilTo(Math.max(massUplift, massSlide), MASS_STEP_T));
  const volumeNeeded = designMass / rhoC;

  const build = (side: number, h: number) => {
    const volume = side * side * h;
    const mass = volume * rhoC;
    const weightSub = mass * k * G_MS2;
    const ev = evaluateDeadweightBlock({ weightSub_kN: weightSub, L_m: side, W_m: side, H_m: h }, tension_kN, cableAngle_deg, params);
    return { side, h, volume, mass, weightSub, ev };
  };
  const heightFor = (side: number) => Math.max(MIN_HEIGHT_M, ceilTo(volumeNeeded / (side * side), DIM_STEP_M));

  let side: number;
  let b: ReturnType<typeof build>;
  if (keyed) {
    // c_u·s² + 2·c_u·z_s·s = SF·H
    const cu = params.cuSurface_kPa, zs = params.keyDepth_m;
    side = Math.max(DIM_STEP_M, ceilTo((-2 * cu * zs + Math.sqrt((2 * cu * zs) ** 2 + 4 * cu * params.sfSlide * H)) / (2 * cu), DIM_STEP_M));
    b = build(side, heightFor(side));
  } else {
    const h0 = ceilTo(Math.cbrt(volumeNeeded / (PLAN_TO_HEIGHT * PLAN_TO_HEIGHT)), DIM_STEP_M);
    side = ceilTo(Math.sqrt(volumeNeeded / h0), DIM_STEP_M);
    b = build(side, h0);
  }
  const startSide = side;

  // Widen until everything holds. While the box is thicker than 0.5 m widening
  // only flattens it; once at 0.5 m, widening adds weight (which is what a
  // keyed block needs when it is close to being lifted).
  const fails = (x: typeof b) =>
    x.ev.qContact_kPa > params.qAllow_kPa || x.ev.sfOverturn < params.sfOverturn || x.ev.sfUplift < params.sfUplift || x.ev.sfSlide < params.sfSlide;
  while (fails(b) && side < MAX_SIDE_M) {
    // A friction block that is already a 0.5 m slab cannot be helped by widening: the static pressure is fixed.
    if (!keyed && b.h <= MIN_HEIGHT_M) break;
    side = snap(side + DIM_STEP_M);
    b = build(side, heightFor(side));
  }

  return {
    ...b.ev,
    params,
    buoyancyFactor: k,
    massUplift_t: massUplift,
    massSlide_t: massSlide,
    governing: massSlide >= massUplift ? 'sliding' : 'uplift',
    bearingGovernsShape: b.side > startSide + 1e-9,
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
