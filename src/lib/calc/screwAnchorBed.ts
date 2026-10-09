/**
 * Option 3 (PA3) — lake-bed anchor: a square reinforced-concrete base resting
 * on the mud, held by screw piles driven through four corner holes.
 *
 * Formulas follow sheet "6.DE_NEO_VIT" of the owner's workbook
 * BANG_TINH_NEO_DE_VIT_XOAN.xlsx (2026-10-08), cell by cell; the reference
 * case of that sheet (T = 70 kN, B = 2.5 m, t = 0.4 m, 4 screws Ø89×5, L = 3 m,
 * c_u = 20 kPa) is pinned by the tests.
 *
 * Two load cases, with the cable taken as a straight taut line from the padeye
 * to the raft edge at the water surface:
 *   LOW water  — flattest cable, largest horizontal pull  → sliding governs
 *   HIGH water — steepest cable, largest uplift           → uplift / overturning govern
 *
 *   SV-1 uplift       Tv ≤ k_W·W' + n·Q_a            (Q_a = Q_u / FS)
 *   SV-2 sliding      FS·Th ≤ α·c_u·B² + B·(γ'd²/2 + 2·c_u·d) + n·H_u
 *                     (base adhesion counts only while W' > Tv)
 *   SV-3 overturning  FS·M_o ≤ M_r about the far bottom edge
 *   SV-4 one screw    N_1 ≤ Q_a
 *   SV-5 bearing      W'/B² ≤ 5.14·c_u / FS_b
 *   SV-6 slab steel   A_s provided ≥ max(A_s required, 0.1 %)
 * plus the fit of the screw through the hole.
 *
 * Assumed until a lake-bed survey exists: c_u, γ', the two adhesion factors
 * and the 0.9 weight factor. Not modelled (as stated in the workbook):
 * punching at the padeye, corrosion, cyclic / fatigue loading, group effect of
 * closely spaced screws; base adhesion and the lateral capacity of the screws
 * peak at different displacements, so adding them is a first approximation.
 */

export interface ScrewBaseParams {
  /** Side of the square base B and its thickness t, m. With `autoSize` these are the SMALLEST values tried. */
  side_m: number;
  thickness_m: number;
  /** Enlarge B, then t, until every check passes (the workbook's 2.5 × 0.4 m base only suits T ≈ 70 kN). */
  autoSize: boolean;
  /** Height of the padeye above the top of the base, m. */
  padeyeHeight_m: number;
  gammaConcrete_kNm3: number;
  gammaWater_kNm3: number;
  /** Corner holes: diameter and centre-to-edge distance, m. */
  holeDia_m: number;
  holeEdge_m: number;
  /** Mud: c_u right under the base, average c_u along the screw, kPa; buoyant unit weight, kN/m³. */
  cuSurface_kPa: number;
  cuAverage_kPa: number;
  gammaSubMud_kNm3: number;
  /** Base–mud adhesion factor, and depth of the skirt under the base, m. */
  alphaBase: number;
  skirtDepth_m: number;
  /** Screws: count, embedded length, tube Ø × wall, thread Ø, m. */
  screwCount: number;
  screwLength_m: number;
  tubeDia_m: number;
  tubeThk_m: number;
  threadDia_m: number;
  /** Large helix plates at the tip (0 = thread only) and their diameter, m. */
  helixCount: number;
  helixDia_m: number;
  alphaShaft: number;
  fy_kPa: number;
  sfScrewUplift: number;
  /** Factor on the base weight in the uplift / single-screw checks. */
  weightFactor: number;
  sfSlide: number;
  sfOverturn: number;
  sfBearing: number;
  /** Slab reinforcement: cover + half bar, m; Rs, kPa; bar Ø, mm; spacing, m (two layers, both ways). */
  rebarCover_m: number;
  rebarRs_kPa: number;
  rebarDia_mm: number;
  rebarSpacing_m: number;
}

/** The workbook's yellow cells. */
export const SCREW_BASE_DEFAULTS: ScrewBaseParams = {
  side_m: 2.5,
  thickness_m: 0.4,
  autoSize: true,
  padeyeHeight_m: 0.15,
  gammaConcrete_kNm3: 25,
  gammaWater_kNm3: 10,
  holeDia_m: 0.12,
  holeEdge_m: 0.15,
  cuSurface_kPa: 20,
  cuAverage_kPa: 20,
  gammaSubMud_kNm3: 6,
  alphaBase: 0.5,
  skirtDepth_m: 0.15,
  screwCount: 4,
  screwLength_m: 3,
  tubeDia_m: 0.089,
  tubeThk_m: 0.005,
  threadDia_m: 0.105,
  helixCount: 0,
  helixDia_m: 0.25,
  alphaShaft: 0.8,
  fy_kPa: 235000,
  sfScrewUplift: 2,
  weightFactor: 0.9,
  sfSlide: 1.5,
  sfOverturn: 1.5,
  sfBearing: 2.5,
  rebarCover_m: 0.05,
  rebarRs_kPa: 260000,
  rebarDia_mm: 12,
  rebarSpacing_m: 0.2
};

/** Largest base the sizing tries before reporting that none works, m. */
export const SCREW_BASE_MAX_SIDE_M = 8;
const SIDE_STEP_M = 0.25;
const THICKNESSES_M = [0.4, 0.5, 0.6, 0.8];
/** Slab meshes tried in turn when the base grows (Ø mm, spacing m). */
const MESHES: Array<[number, number]> = [[12, 0.2], [12, 0.15], [14, 0.15], [16, 0.15], [16, 0.1], [20, 0.1]];

export interface ScrewBaseInput extends Partial<ScrewBaseParams> {
  /** Design tension on the base, kN (one line; opposing lines of two rafts do not add). */
  tension_kN: number;
  /** Horizontal distance from the base to the cable attachment on the raft, m. */
  span_m: number;
  /** Water depth above the lake bed at the base in the two cases, m. */
  depthLow_m: number;
  depthHigh_m: number;
}

export interface ScrewBaseCase {
  id: 'low' | 'high';
  depth_m: number;
  /** Rise from the padeye to the raft edge, m, and cable angle above the horizontal, degrees. */
  rise_m: number;
  angle_deg: number;
  Th_kN: number;
  Tv_kN: number;
  upliftResistance_kN: number;
  upliftUtil: number;
  adhesion_kN: number;
  slideResistance_kN: number;
  slideUtil: number;
  overturningMoment_kNm: number;
  resistingMoment_kNm: number;
  overturnUtil: number;
  screwPull_kN: number;
  screwUtil: number;
}

export interface ScrewBaseResult {
  params: ScrewBaseParams;
  /** The load the base was checked for (so it can be re-checked at another tension). */
  load: { tension_kN: number; span_m: number; depthLow_m: number; depthHigh_m: number };
  /** Base as designed (after auto-sizing). */
  side_m: number;
  thickness_m: number;
  /** The base had to be made larger than the starting size. */
  enlarged: boolean;
  volume_m3: number;
  weightAir_kN: number;
  /** Buoyant weight W', kN. */
  weightSub_kN: number;
  holeSpacing_m: number;
  holeFits: boolean;
  /** One screw: ultimate / allowable pull-out and ultimate lateral capacity, kN. */
  screwShaftFriction_kN: number;
  screwHelix_kN: number;
  screwSteelTension_kN: number;
  screwQu_kN: number;
  screwQa_kN: number;
  screwHuSoil_kN: number;
  screwHuSteel_kN: number;
  screwHu_kN: number;
  skirtResistance_kN: number;
  cases: [ScrewBaseCase, ScrewBaseCase];
  /** Worst of the two cases. */
  upliftUtil: number;
  slideUtil: number;
  overturnUtil: number;
  screwUtil: number;
  bearingPressure_kPa: number;
  bearingAllow_kPa: number;
  bearingUtil: number;
  /** Slab steel, mm²/m each way, each layer. */
  slabMoment_kNm_m: number;
  rebarRequired_mm2: number;
  rebarMin_mm2: number;
  rebarProvided_mm2: number;
  rebarDia_mm: number;
  rebarSpacing_m: number;
  rebarUtil: number;
  /** Quantities of ONE base. */
  concrete_m3: number;
  rebar_kg: number;
  liftMass_t: number;
  screwTotalLength_m: number;
  ok: boolean;
}

export const resolveScrewBaseParams = (p: Partial<ScrewBaseParams> = {}): ScrewBaseParams => ({
  ...SCREW_BASE_DEFAULTS,
  ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
});

/** Checks one base of the given size (no sizing). */
export function evaluateScrewBase(input: ScrewBaseInput, side_m: number, thickness_m: number, mesh?: [number, number]): ScrewBaseResult {
  const { tension_kN: T, span_m, depthLow_m, depthHigh_m, ...rest } = input;
  const p = resolveScrewBaseParams(rest);
  const B = side_m, t = thickness_m, n = p.screwCount;
  const [barDia, barSpacing] = mesh ?? [p.rebarDia_mm, p.rebarSpacing_m];

  // B. base
  const volume = B * B * t;
  const weightAir = volume * p.gammaConcrete_kNm3;
  const W = volume * (p.gammaConcrete_kNm3 - p.gammaWater_kNm3);
  const s = B - 2 * p.holeEdge_m;
  const holeFits = p.holeDia_m >= (p.helixCount > 0 ? Math.max(p.threadDia_m, p.helixDia_m) : p.threadDia_m) + 0.01 - 1e-12;

  // D1. pull-out of one screw
  const shaft = p.alphaShaft * p.cuAverage_kPa * Math.PI * p.threadDia_m * p.screwLength_m;
  const helix = p.helixCount * (Math.PI / 4) * (p.helixDia_m ** 2 - p.tubeDia_m ** 2) * (9 * p.cuAverage_kPa + p.gammaSubMud_kNm3 * p.screwLength_m);
  const steelTension = (Math.PI / 4) * (p.tubeDia_m ** 2 - (p.tubeDia_m - 2 * p.tubeThk_m) ** 2) * p.fy_kPa;
  const Qu = Math.min(shaft + helix, steelTension);
  const Qa = Qu / p.sfScrewUplift;

  // D2. lateral capacity of one screw (Broms, free head at the mud line, e = 0)
  const Dr = p.threadDia_m, cu = p.cuAverage_kPa;
  const g = p.screwLength_m - 1.5 * Dr;
  const qa = 0.02778 / (cu * Dr), qb = 1.5 * Dr + 0.5 * g, qc = -2.25 * Dr * cu * g * g;
  const HuSoil = (-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa);
  const Mp = ((p.tubeDia_m ** 3 - (p.tubeDia_m - 2 * p.tubeThk_m) ** 3) / 6) * p.fy_kPa;
  const HuSteel = (-1.5 * Dr + Math.sqrt((1.5 * Dr) ** 2 + (4 * Mp) / (18 * cu * Dr))) / (2 / (18 * cu * Dr));
  const Hu = Math.min(HuSoil, HuSteel);

  const skirt = B * (0.5 * p.gammaSubMud_kNm3 * p.skirtDepth_m ** 2 + 2 * p.cuSurface_kPa * p.skirtDepth_m);
  const upliftResistance = p.weightFactor * W + n * Qa;
  // far row at (B − c), near row at c from the rotation edge
  const Mr = (W * B) / 2 + (n / 2) * Qu * (B - p.holeEdge_m) + (n / 2) * Qu * p.holeEdge_m;

  const loadCase = (id: 'low' | 'high', depth: number): ScrewBaseCase => {
    const rise = Math.max(0, depth - t - p.padeyeHeight_m);
    const angle = Math.atan(rise / Math.max(0.1, span_m));
    const Th = T * Math.cos(angle), Tv = T * Math.sin(angle);
    const adhesion = W > Tv ? p.alphaBase * p.cuSurface_kPa * B * B : 0;
    const slideResistance = adhesion + skirt + n * Hu;
    const Mo = Th * (t + p.padeyeHeight_m) + (Tv * B) / 2;
    const N1 = Math.max(
      Math.max(0, Tv - p.weightFactor * W) / n,
      Math.max(0, Mo - (p.weightFactor * W * B) / 2) / (B - p.holeEdge_m) / (n / 2)
    );
    return {
      id, depth_m: depth, rise_m: rise, angle_deg: (angle * 180) / Math.PI, Th_kN: Th, Tv_kN: Tv,
      upliftResistance_kN: upliftResistance, upliftUtil: Tv / upliftResistance,
      adhesion_kN: adhesion, slideResistance_kN: slideResistance, slideUtil: (Th * p.sfSlide) / slideResistance,
      overturningMoment_kNm: Mo, resistingMoment_kNm: Mr, overturnUtil: (Mo * p.sfOverturn) / Mr,
      screwPull_kN: N1, screwUtil: Qa > 0 ? N1 / Qa : Infinity
    };
  };
  const cases: [ScrewBaseCase, ScrewBaseCase] = [loadCase('low', depthLow_m), loadCase('high', depthHigh_m)];
  const worst = (k: 'upliftUtil' | 'slideUtil' | 'overturnUtil' | 'screwUtil') => Math.max(cases[0][k], cases[1][k]);

  const bearingPressure = W / (B * B);
  const bearingAllow = (5.14 * p.cuSurface_kPa) / p.sfBearing;

  // F. slab: padeye pulls up at the centre, the screws hold the corners
  const slabMoment = ((n / 2) * Qu * (s / 2)) / B;
  const h0 = t - p.rebarCover_m;
  const rebarRequired = (slabMoment / (0.9 * h0 * p.rebarRs_kPa)) * 1e6;
  const rebarMin = 0.001 * h0 * 1e6;
  const rebarProvided = (Math.PI * barDia * barDia) / 4 / barSpacing;
  const rebarUtil = Math.max(rebarRequired, rebarMin) / rebarProvided;

  const upliftUtil = worst('upliftUtil'), slideUtil = worst('slideUtil'), overturnUtil = worst('overturnUtil'), screwUtil = worst('screwUtil');
  const bearingUtil = bearingPressure / bearingAllow;
  const TOL = 1 + 1e-9;

  return {
    params: { ...p, side_m: B, thickness_m: t, rebarDia_mm: barDia, rebarSpacing_m: barSpacing },
    load: { tension_kN: T, span_m, depthLow_m, depthHigh_m },
    side_m: B, thickness_m: t, enlarged: false,
    volume_m3: volume, weightAir_kN: weightAir, weightSub_kN: W, holeSpacing_m: s, holeFits,
    screwShaftFriction_kN: shaft, screwHelix_kN: helix, screwSteelTension_kN: steelTension, screwQu_kN: Qu, screwQa_kN: Qa,
    screwHuSoil_kN: HuSoil, screwHuSteel_kN: HuSteel, screwHu_kN: Hu, skirtResistance_kN: skirt,
    cases, upliftUtil, slideUtil, overturnUtil, screwUtil,
    bearingPressure_kPa: bearingPressure, bearingAllow_kPa: bearingAllow, bearingUtil,
    slabMoment_kNm_m: slabMoment, rebarRequired_mm2: rebarRequired, rebarMin_mm2: rebarMin, rebarProvided_mm2: rebarProvided,
    rebarDia_mm: barDia, rebarSpacing_m: barSpacing, rebarUtil,
    concrete_m3: volume - n * (Math.PI / 4) * p.holeDia_m ** 2 * t,
    rebar_kg: 2 * 2 * (Math.ceil(B / barSpacing - 1e-9) + 1) * (B - 0.1) * 0.00617 * barDia * barDia,
    liftMass_t: weightAir / 9.81,
    screwTotalLength_m: n * (p.screwLength_m + t + 0.3),
    ok: holeFits && upliftUtil <= TOL && slideUtil <= TOL && overturnUtil <= TOL && screwUtil <= TOL && bearingUtil <= TOL && rebarUtil <= TOL
  };
}

/**
 * Designs the base for a line. With `autoSize` (default) it returns the base
 * of least concrete volume, among B = start … 8 m (0.25 m steps) and
 * t = start … 0.8 m, that passes every check, with the lightest slab mesh
 * that satisfies SV-6. When none passes, the largest base tried is returned
 * with `ok: false` — never a base that silently fails.
 */
/** Worst utilisation of a base (uplift, sliding, overturning, one screw, bearing, slab steel). */
export const screwBaseUtilisation = (r: ScrewBaseResult): number =>
  Math.max(r.upliftUtil, r.slideUtil, r.overturnUtil, r.screwUtil, r.bearingUtil, r.rebarUtil);

/** The SAME base (size, mesh, soil) under another line tension — e.g. the wind chosen in the 3D view. */
export function recheckScrewBase(r: ScrewBaseResult, tension_kN: number): ScrewBaseResult {
  return evaluateScrewBase({ ...r.params, ...r.load, tension_kN }, r.side_m, r.thickness_m, [r.rebarDia_mm, r.rebarSpacing_m]);
}

export function designScrewBase(input: ScrewBaseInput): ScrewBaseResult {
  const p = resolveScrewBaseParams(input);
  const withMesh = (B: number, t: number): ScrewBaseResult => {
    let r = evaluateScrewBase(input, B, t);
    if (!p.autoSize || r.rebarUtil <= 1) return r;
    for (const m of MESHES) {
      r = evaluateScrewBase(input, B, t, m);
      if (r.rebarUtil <= 1) break;
    }
    return r;
  };
  const first = withMesh(p.side_m, p.thickness_m);
  if (!p.autoSize || first.ok) return first;

  let best: ScrewBaseResult | undefined;
  let last = first;
  for (const t of THICKNESSES_M.filter((v) => v >= p.thickness_m - 1e-9)) {
    for (let B = p.side_m; B <= SCREW_BASE_MAX_SIDE_M + 1e-9; B += SIDE_STEP_M) {
      const r = withMesh(Math.round(B * 100) / 100, t);
      last = r;
      if (r.ok) {
        if (!best || r.volume_m3 < best.volume_m3 - 1e-9) best = r;
        break; // a wider base of the same thickness only costs more concrete
      }
    }
  }
  return { ...(best ?? last), enlarged: true };
}

// ---------------------------------------------------------------------------
// A base under ONE or TWO lines (a base shared by two facing rafts)
// ---------------------------------------------------------------------------

/** One cable arriving at a base. */
export interface BaseLineLoad {
  /** Line code, for the notes. */
  label: string;
  /** Governing tension of the line's raft, kN. */
  tension_kN: number;
  /** Plan distance from the base to the cleat on the raft, m. */
  span_m: number;
  /** Bearing of the cable from the raft to the base, degrees clockwise from north. */
  azimuth_deg: number;
}

export interface BaseLoadCombination {
  name: string;
  level: 'low' | 'high';
  /** Resultant horizontal pull and total uplift on the base, kN. */
  Th_kN: number;
  Tv_kN: number;
  /** Worst of uplift, sliding, overturning, single screw and bearing for this combination. */
  util: number;
}

export interface BaseForLinesInput extends Partial<ScrewBaseParams> {
  lines: BaseLineLoad[];
  depthLow_m: number;
  depthHigh_m: number;
  /** Tension of the slack line of a shared base, kN (the line pretension). */
  pretension_kN: number;
  /**
   * Also check both lines at their maximum together (default true). Switching it off is for
   * sensitivity studies only: the design always keeps the envelope.
   */
  bothTaut?: boolean;
}

export interface BaseForLinesResult {
  /** The base as designed; its utilisations are the worst over every combination. */
  base: ScrewBaseResult;
  combinations: BaseLoadCombination[];
  governing: string;
  shared: boolean;
}

/**
 * Designs the base for the lines it holds.
 *
 * One line: the two water-level cases of `designScrewBase`.
 *
 * Two lines (a base shared by two facing rafts). When the wind blows across the
 * gap the windward raft drifts towards it and its line goes slack, while the
 * leeward raft pulls its line taut: the two lines do not reach their maximum
 * together. Combinations, at both water levels:
 *   - line 1 at its maximum, line 2 at the pretension;
 *   - line 2 at its maximum, line 1 at the pretension;
 *   - BOTH at their maximum — an envelope for oblique wind or a raft out of
 *     position: the horizontal pulls largely cancel, the uplifts add.
 * The horizontal pulls are added as vectors (the two cables need not be exactly
 * opposite); the uplifts add. The slack line still lifts the base, so a shared
 * base is not smaller than a single one — what is saved is the number of bases.
 *
 * Each combination is checked with the same formulas as a single line, through
 * the equivalent single cable having the same horizontal and vertical components.
 */
export function designScrewBaseForLines(input: BaseForLinesInput): BaseForLinesResult {
  const { lines, depthLow_m, depthHigh_m, pretension_kN, bothTaut = true, ...rest } = input;
  if (lines.length < 1 || lines.length > 2) throw new Error('A screw-pile base holds one or two lines');
  const p = resolveScrewBaseParams(rest);
  const levels: Array<['low' | 'high', number, string]> = [['low', depthLow_m, 'MN thấp'], ['high', depthHigh_m, 'MN cao']];

  const combosFor = (t: number): Array<{ name: string; level: 'low' | 'high'; Th: number; Tv: number }> => {
    const out: Array<{ name: string; level: 'low' | 'high'; Th: number; Tv: number }> = [];
    for (const [level, depth, levelName] of levels) {
      const rise = Math.max(0, depth - t - p.padeyeHeight_m);
      const comp = (l: BaseLineLoad, T: number) => {
        const a = Math.atan(rise / Math.max(0.1, l.span_m));
        const az = (l.azimuth_deg * Math.PI) / 180;
        // the cable pulls the base back towards its raft
        return { hx: -T * Math.cos(a) * Math.sin(az), hy: -T * Math.cos(a) * Math.cos(az), v: T * Math.sin(a) };
      };
      const sum = (parts: Array<{ hx: number; hy: number; v: number }>) => ({
        Th: Math.hypot(parts.reduce((s, q) => s + q.hx, 0), parts.reduce((s, q) => s + q.hy, 0)),
        Tv: parts.reduce((s, q) => s + q.v, 0)
      });
      if (lines.length === 1) {
        out.push({ name: `${lines[0].label} căng (${levelName})`, level, ...sum([comp(lines[0], lines[0].tension_kN)]) });
      } else {
        const [a, b] = lines;
        out.push({ name: `${a.label} căng, ${b.label} chùng (${levelName})`, level, ...sum([comp(a, a.tension_kN), comp(b, Math.min(pretension_kN, b.tension_kN))]) });
        out.push({ name: `${b.label} căng, ${a.label} chùng (${levelName})`, level, ...sum([comp(b, b.tension_kN), comp(a, Math.min(pretension_kN, a.tension_kN))]) });
        if (bothTaut) out.push({ name: `cả hai dây căng (${levelName})`, level, ...sum([comp(a, a.tension_kN), comp(b, b.tension_kN)]) });
      }
    }
    return out;
  };

  /** The base of side B and thickness t under one (Th, Tv): an equivalent cable with those two components. */
  const check = (Th: number, Tv: number, B: number, t: number, mesh?: [number, number]) => {
    const h = Math.max(Th, 1e-6), span = 10, depth = t + p.padeyeHeight_m + (span * Tv) / h;
    return evaluateScrewBase({ ...p, tension_kN: Math.hypot(h, Tv), span_m: span, depthLow_m: depth, depthHigh_m: depth }, B, t, mesh);
  };
  const structural = (r: ScrewBaseResult) => Math.max(r.upliftUtil, r.slideUtil, r.overturnUtil, r.screwUtil, r.bearingUtil);

  const build = (B: number, t: number): BaseForLinesResult => {
    const combos = combosFor(t);
    // the slab mesh depends on the base and the screws only, not on the load
    let mesh: [number, number] = [p.rebarDia_mm, p.rebarSpacing_m];
    if (p.autoSize && check(combos[0].Th, combos[0].Tv, B, t, mesh).rebarUtil > 1) {
      mesh = MESHES.find((m) => check(combos[0].Th, combos[0].Tv, B, t, m).rebarUtil <= 1) ?? MESHES[MESHES.length - 1];
    }
    const results = combos.map((c) => ({ c, r: check(c.Th, c.Tv, B, t, mesh) }));
    const worst = results.reduce((w, x) => (structural(x.r) > structural(w.r) ? x : w), results[0]);
    const max = (f: (r: ScrewBaseResult) => number) => Math.max(...results.map((x) => f(x.r)));
    const base: ScrewBaseResult = {
      ...worst.r,
      upliftUtil: max((r) => r.upliftUtil), slideUtil: max((r) => r.slideUtil), overturnUtil: max((r) => r.overturnUtil),
      screwUtil: max((r) => r.screwUtil), bearingUtil: max((r) => r.bearingUtil), rebarUtil: max((r) => r.rebarUtil),
      ok: results.every((x) => x.r.ok),
      // the load a later re-check scales: the heaviest line, on its own span
      load: { tension_kN: Math.max(...lines.map((l) => l.tension_kN)), span_m: Math.min(...lines.map((l) => l.span_m)), depthLow_m, depthHigh_m }
    };
    return {
      base,
      combinations: results.map((x) => ({ name: x.c.name, level: x.c.level, Th_kN: x.c.Th, Tv_kN: x.c.Tv, util: structural(x.r) })),
      governing: worst.c.name,
      shared: lines.length === 2
    };
  };

  const first = build(p.side_m, p.thickness_m);
  if (!p.autoSize || first.base.ok) return first;
  let best: BaseForLinesResult | undefined;
  let last = first;
  for (const t of THICKNESSES_M.filter((v) => v >= p.thickness_m - 1e-9)) {
    for (let B = p.side_m; B <= SCREW_BASE_MAX_SIDE_M + 1e-9; B += SIDE_STEP_M) {
      const r = build(Math.round(B * 100) / 100, t);
      last = r;
      if (r.base.ok) {
        if (!best || r.base.volume_m3 < best.base.volume_m3 - 1e-9) best = r;
        break;
      }
    }
  }
  const out = best ?? last;
  return { ...out, base: { ...out.base, enlarged: true } };
}
