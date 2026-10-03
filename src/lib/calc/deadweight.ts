/**
 * Option 2 (PA2) — gravity anchor: a concrete block resting on the lake bed in
 * place of a driven lake-bed pile. Shore anchors stay piles in both options
 * (a block would slide down the 20–40° bank).
 *
 * The block is loaded by the governing line tension T of the raft at the bed
 * cable angle α (the same T and α the lake-bed pile is checked with):
 *   H = T·cos α (drag along the bed),  V = T·sin α (lift).
 * Submerged weight: W_sub = W_air · (1 − ρ_w / ρ_c).
 *   Uplift:   W_sub ≥ SF_uplift · V
 *   Sliding:  μ · (W_sub − V) ≥ SF_slide · H   →  W_sub ≥ SF_slide · H / μ + V
 *
 * Not modelled (stated wherever the result is shown): bearing capacity and
 * settlement of the block in soft mud, suction / embedment gains, bed slope,
 * and cyclic degradation of the friction. μ is an assumed interface value,
 * not a site measurement.
 */

export const G_MS2 = 9.81;

export interface DeadweightInput {
  /** Governing line tension, kN. */
  tension_kN: number;
  /** Cable angle above the horizontal at the anchor, degrees. */
  cableAngle_deg: number;
  /** Block–mud friction coefficient (assumed). */
  mu?: number;
  sfUplift?: number;
  sfSlide?: number;
  /** Concrete / water density, t/m³. */
  rhoConcrete_tm3?: number;
  rhoWater_tm3?: number;
  /** The design mass is rounded UP to this step, t. */
  massStep_t?: number;
  /** Plan side / height of the box (L = W = ratio · H). */
  planToHeight?: number;
  /** Plan side and height are rounded UP to this step, m. */
  dimStep_m?: number;
}

export interface DeadweightResult {
  H_kN: number;
  V_kN: number;
  /** 1 − ρ_w/ρ_c. */
  buoyancyFactor: number;
  /** Mass in air needed by each criterion, t (before rounding). */
  massUplift_t: number;
  massSlide_t: number;
  governing: 'uplift' | 'sliding';
  /** max of the two, rounded up to the mass step, t. */
  designMass_t: number;
  /** Box as built: L = W (plan), H (height), rounded up — so its mass ≥ designMass_t. */
  L_m: number;
  W_m: number;
  H_m: number;
  volume_m3: number;
  mass_t: number;
  weightSub_kN: number;
  /** Safety factors of the box as built. */
  sfUplift: number;
  sfSlide: number;
  /** Overturning about the toe with the cable at the top centre (worst lever arm). */
  sfOverturn: number;
  ok: boolean;
}

export const DEADWEIGHT_DEFAULTS = {
  mu: 0.35,
  sfUplift: 1.5,
  sfSlide: 1.5,
  rhoConcrete_tm3: 2.4,
  rhoWater_tm3: 1.0,
  massStep_t: 0.5,
  planToHeight: 1.4,
  dimStep_m: 0.05
} as const;

const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

/**
 * Safety factors of an EXISTING block under another load (e.g. the wind chosen
 * in the 3D simulation). A block lifted off the bed (V ≥ W_sub) has no friction.
 */
export function evaluateDeadweightBlock(
  block: Pick<DeadweightResult, 'weightSub_kN' | 'L_m' | 'H_m'>,
  tension_kN: number,
  cableAngle_deg: number,
  mu: number = DEADWEIGHT_DEFAULTS.mu
): { H_kN: number; V_kN: number; sfUplift: number; sfSlide: number; sfOverturn: number } {
  const a = (cableAngle_deg * Math.PI) / 180;
  const H = tension_kN * Math.cos(a);
  const V = tension_kN * Math.sin(a);
  const net = Math.max(0, block.weightSub_kN - V);
  return {
    H_kN: H,
    V_kN: V,
    sfUplift: V > 0 ? block.weightSub_kN / V : Infinity,
    sfSlide: H > 0 ? (mu * net) / H : Infinity,
    sfOverturn: H > 0 ? (net * (block.L_m / 2)) / (H * block.H_m) : Infinity
  };
}

export function sizeDeadweightBlock(input: DeadweightInput): DeadweightResult {
  const d = DEADWEIGHT_DEFAULTS;
  const mu = input.mu ?? d.mu;
  const sfU = input.sfUplift ?? d.sfUplift;
  const sfS = input.sfSlide ?? d.sfSlide;
  const rhoC = input.rhoConcrete_tm3 ?? d.rhoConcrete_tm3;
  const rhoW = input.rhoWater_tm3 ?? d.rhoWater_tm3;
  const massStep = input.massStep_t ?? d.massStep_t;
  const ratio = input.planToHeight ?? d.planToHeight;
  const dimStep = input.dimStep_m ?? d.dimStep_m;
  if (!(mu > 0) || !(rhoC > rhoW)) throw new Error('Deadweight block: need mu > 0 and concrete denser than water');

  const a = (input.cableAngle_deg * Math.PI) / 180;
  const H = input.tension_kN * Math.cos(a);
  const V = input.tension_kN * Math.sin(a);
  const k = 1 - rhoW / rhoC;

  const massUplift = (sfU * V) / (k * G_MS2);
  const massSlide = ((sfS * H) / mu + V) / (k * G_MS2);
  const designMass = ceilTo(Math.max(massUplift, massSlide), massStep);

  // Box L = W = ratio·h with volume = designMass / ρ_c, then rounded up.
  const h = ceilTo(Math.cbrt(designMass / rhoC / (ratio * ratio)), dimStep);
  const side = ceilTo(Math.sqrt(designMass / rhoC / h), dimStep);
  const volume = side * side * h;
  const mass = volume * rhoC;
  const wSub = mass * k * G_MS2;

  const built = evaluateDeadweightBlock({ weightSub_kN: wSub, L_m: side, H_m: h }, input.tension_kN, input.cableAngle_deg, mu);
  const sfUpliftBuilt = built.sfUplift, sfSlideBuilt = built.sfSlide, sfOverturn = built.sfOverturn;

  return {
    H_kN: H,
    V_kN: V,
    buoyancyFactor: k,
    massUplift_t: massUplift,
    massSlide_t: massSlide,
    governing: massSlide >= massUplift ? 'sliding' : 'uplift',
    designMass_t: designMass,
    L_m: side,
    W_m: side,
    H_m: h,
    volume_m3: volume,
    mass_t: mass,
    weightSub_kN: wSub,
    sfUplift: sfUpliftBuilt,
    sfSlide: sfSlideBuilt,
    sfOverturn,
    ok: sfUpliftBuilt >= sfU && sfSlideBuilt >= sfS
  };
}
