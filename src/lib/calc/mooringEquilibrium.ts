/**
 * Quasi-static equilibrium of ONE raft on its real mooring lines, at every
 * reservoir level — the line-tension model of Hồ Bản Mòng (deep water, a
 * 19.55 m level range), where the single-angle model of `loads.ts`
 * (T = F / (N_eff cos 30°), or a calibrated focus factor) is unsafe: a
 * lake-bed cable taut at MNLKT stands 45–74° steep, so it needs 1.5–3.5 times
 * the tension of a 30° cable to give the same horizontal hold.
 *
 * Model
 *  - The raft is a rigid body that TRANSLATES in plan (no yaw); the
 *    environmental load F (wind + current + wave, the engine's F_env) acts in
 *    a given direction. 24 directions, every 15°.
 *  - Each line runs straight from the cleat (waterline + freeboard) to the pin
 *    of its anchor (shore pile neck / base padeye). It is an elastic rope
 *    with no compression: T = EA (d − L0) / L0 when the cleat–pin distance d
 *    exceeds the unstretched length L0, else 0. Sag (weight of the polyester
 *    rope in water is ~0) and dynamics are not modelled.
 *  - EA = `eaPerMbl` × MBL. Polyester quasi-static stiffness is of the order
 *    of 10–20 × MBL; 15 is an ASSUMPTION (a stiffer rope gives less drift and
 *    about the same tensions).
 *  - Unstretched length L0:
 *      'fixed'    — cut once to the longest cleat–pin distance between MNC
 *                   and MNLKT (the cable cutting schedule): slack elsewhere.
 *      'seasonal' — re-tensioned as the water moves: the level range is cut
 *                   into bands of `adjustStep_m` from MNC up, and in each
 *                   band the line is set to its longest cleat–pin distance
 *                   in the band (0 = re-set at every level).
 *  - Levels are scanned from the lowest level at which the raft floats to
 *    MNLKT, every `levelStep_m` and at MNDB / MNLKT exactly.
 *      'device'   — a passive constant-tension device on every line (hanging
 *                   counterweight, Hồ Bản Mòng): the line is paid out or
 *                   reeled in at the tension `deviceTension_kN` (W) while the
 *                   chord stays within ±`deviceStroke_m` of its still-water value
 *                   at that level; the slow level change is taken up by the same
 *                   device (extra stroke, reported). Past the stroke the rope is
 *                   elastic (W + k·excess); reeled in past the other end the
 *                   weight rests on its stop and the line goes slack. The tension
 *                   is therefore W everywhere in the range: what moves the raft
 *                   is only the geometric stiffness of the lines (≈ N·W / 2L): a hanging
 *                   counterweight alone does NOT hold the raft (drift to the end
 *                   of the stroke, tension 2–3 times the locked value). The model
 *                   is used for the LOCK-FAILURE check (catalogue `lockFailure`):
 *                   the design assumes the device locks in a storm.
 * The equilibrium offset minimises the (convex) potential energy
 * Π(u) = Σ ½ k_i (d_i − L_i)₊² − F·u, by Newton steps with a step limit.
 */

export interface EqLine {
  code: string;
  type: 'SHORE' | 'BED';
  /** Bearing cleat → anchor, degrees clockwise from north (+y). */
  azimuth_deg: number;
  /** Plan distance cleat – anchor, m. */
  span_m: number;
  /** Level of the pin on the anchor, m. */
  pin_m: number;
}

export interface EqInput {
  lines: EqLine[];
  /** Environmental load on the raft, kN (the same in every direction). */
  force_kN: number;
  mnc_m: number;
  mndb_m: number;
  mnlkt_m: number;
  /** Lowest level at which the raft floats (design bed + draft). */
  floatLevel_m: number;
  /** Height of the cleat above the waterline, m. */
  cleatHeight_m: number;
  mbl_kN: number;
  compensation: 'fixed' | 'seasonal' | 'device';
  /** 'device': tension kept by the counterweight of each line, kN. */
  deviceTension_kN?: number;
  /** 'device': stroke each way about the still-water chord, m (default 6). */
  deviceStroke_m?: number;
  /** 'seasonal': the water-level change between two re-tensionings, m (0 = continuous). */
  adjustStep_m?: number;
  eaPerMbl?: number;
  levelStep_m?: number;
  directionStep_deg?: number;
}

export interface EqCase {
  level_m: number;
  /** Direction the load PUSHES the raft towards, degrees clockwise from north. */
  direction_deg: number;
  /** Horizontal offset of the raft at equilibrium, m (Infinity: nothing holds it). */
  drift_m: number;
  maxTension_kN: number;
  maxLine: string;
  /** Lines carrying load. */
  taut: number;
}

export interface EqLevelSummary {
  level_m: number;
  maxTension_kN: number;
  maxLine: string;
  direction_deg: number;
  maxDrift_m: number;
  /** Fewest lines carrying load over the directions. */
  minTaut: number;
}

export interface EqResult {
  compensation: 'fixed' | 'seasonal' | 'device';
  ea_kN: number;
  /** Governing case of the intact system. */
  governing: EqCase;
  /** Damaged system: at every level the most loaded line of that level is lost, every direction re-run; the worst case. */
  damaged: EqCase;
  levels: EqLevelSummary[];
  /** Largest drift over all levels and directions, m. */
  maxDrift_m: number;
  /** Largest vertical component at an anchor pin over all cases, kN. */
  maxUplift_kN: number;
  /** Largest tension of EACH line over every level and direction (intact system), kN, by line code. */
  lineMax_kN: Record<string, number>;
  /** Cases where the Newton solver stopped before equilibrium (expected 0). */
  unconverged: number;
  /** 'device': largest pay-out / reel-in of a line about its still-water chord, m (storm motion; the level change comes on top). */
  deviceTravel?: { payOut_m: number; reelIn_m: number };
}

const rad = (d: number) => (d * Math.PI) / 180;

interface Prepared { ax: number; ay: number; h: number; L0: number; k: number; code: string; dev?: { W: number; S: number; chord0: number } }

/** Smoothing of the step from slack to the device tension, m (keeps the energy twice differentiable enough for Newton). */
const DEV_RAMP_M = 0.05;
/** Tension, its slope and the stored energy of a constant-tension line whose chord is `delta` longer than its still-water value. */
function deviceLine(delta: number, W: number, S: number, k: number) {
  const r = DEV_RAMP_M;
  if (delta <= -S - r) return { t: 0, dt: 0, e: 0 };
  if (delta < -S) return { t: (W * (delta + S + r)) / r, dt: W / r, e: (W * (delta + S + r) ** 2) / (2 * r) };
  const base = (W * r) / 2 + W * (delta + S);
  if (delta <= S) return { t: W, dt: 0, e: base };
  const x = delta - S;
  return { t: W + k * x, dt: k, e: base + 0.5 * k * x * x };
}

function prepare(inp: EqInput, level: number, skip?: string): Prepared[] {
  const ea = (inp.eaPerMbl ?? 15) * inp.mbl_kN;
  const cleatZ = (w: number) => w + inp.cleatHeight_m;
  return inp.lines.filter((l) => l.code !== skip).map((l) => {
    const ax = l.span_m * Math.sin(rad(l.azimuth_deg)), ay = l.span_m * Math.cos(rad(l.azimuth_deg));
    const chord = (w: number) => Math.hypot(l.span_m, l.pin_m - cleatZ(w));
    let L0: number;
    if (inp.compensation === 'device') L0 = chord(level);
    else if (inp.compensation === 'seasonal') {
      // the chord is V-shaped in the level, so its largest value in a band is at one of the band ends
      const step = inp.adjustStep_m ?? 0;
      if (step <= 0) L0 = chord(level);
      else {
        const k = Math.min(Math.floor((level - inp.mnc_m) / step + 1e-9), Math.ceil((inp.mnlkt_m - inp.mnc_m) / step) - 1);
        const lo = inp.mnc_m + Math.max(0, k) * step, hi = Math.min(lo + step, inp.mnlkt_m);
        L0 = Math.max(chord(lo), chord(hi));
      }
    } else L0 = Math.max(chord(inp.mnc_m), chord(inp.mndb_m), chord(inp.mnlkt_m));
    return {
      ax, ay, h: l.pin_m - cleatZ(level), L0, k: ea / L0, code: l.code,
      ...(inp.compensation === 'device' ? { dev: { W: inp.deviceTension_kN ?? 0, S: inp.deviceStroke_m ?? 6, chord0: L0 } } : {})
    };
  });
}

/** Equilibrium offset (ux, uy) under the load (fx, fy); returns the line tensions too. */
function solve(lines: Prepared[], fx: number, fy: number) {
  let ux = 0, uy = 0;
  const state = (x: number, y: number) => {
    let e = -(fx * x + fy * y), gx = -fx, gy = -fy, hxx = 0, hxy = 0, hyy = 0;
    const T: number[] = [];
    for (const l of lines) {
      const a = l.ax - x, b = l.ay - y, d = Math.sqrt(a * a + b * b + l.h * l.h);
      let t: number, dt: number;
      if (l.dev) {
        const q = deviceLine(d - l.dev.chord0, l.dev.W, l.dev.S, l.k);
        if (q.t <= 0) { T.push(0); continue; }
        t = q.t; dt = q.dt; e += q.e;
      } else {
        const ext = d - l.L0;
        if (ext <= 0) { T.push(0); continue; }
        t = l.k * ext; dt = l.k;
        e += 0.5 * l.k * ext * ext;
      }
      T.push(t);
      // force of the line on the raft is t (a, b) / d towards the anchor; dΠ/du = -t (a, b)/d
      gx -= (t * a) / d; gy -= (t * b) / d;
      const c = t / d, kk = dt / (d * d);
      hxx += kk * a * a + c * (1 - (a * a) / (d * d));
      hyy += kk * b * b + c * (1 - (b * b) / (d * d));
      hxy += kk * a * b - c * ((a * b) / (d * d));
    }
    return { e, gx, gy, hxx, hxy, hyy, T };
  };
  let s = state(ux, uy), converged = false;
  for (let it = 0; it < 300; it++) {
    const gn = Math.hypot(s.gx, s.gy);
    if (gn < 1e-6 * Math.max(1, Math.hypot(fx, fy))) { converged = true; break; }
    const reg = 1e-9 + 1e-6 * (s.hxx + s.hyy);
    const a = s.hxx + reg, b = s.hxy, c = s.hyy + reg, det = a * c - b * b;
    let dx: number, dy: number;
    if (det > 1e-12) { dx = -(c * s.gx - b * s.gy) / det; dy = -(-b * s.gx + a * s.gy) / det; } else { dx = -s.gx / gn; dy = -s.gy / gn; }
    // no line taut yet in that direction: move along the load, at most 2 m a step
    const len = Math.hypot(dx, dy), maxStep = 2;
    if (len > maxStep) { dx *= maxStep / len; dy *= maxStep / len; }
    let step = 1, next = state(ux + dx, uy + dy);
    while (next.e > s.e && step > 1e-6) { step /= 2; next = state(ux + dx * step, uy + dy * step); }
    ux += dx * step; uy += dy * step; s = next;
    if (Math.hypot(ux, uy) > 500) return { ux: Infinity, uy: Infinity, T: lines.map(() => 0), lines, converged: true };
  }
  return { ux, uy, T: s.T, lines, converged };
}

type SolvedCase = EqCase & { uplift: number; converged: boolean; payOut: number; reelIn: number };

function solveCase(inp: EqInput, level: number, dir: number, skip?: string, lineMax?: Record<string, number>): SolvedCase {
  const lines = prepare(inp, level, skip);
  const fx = inp.force_kN * Math.sin(rad(dir)), fy = inp.force_kN * Math.cos(rad(dir));
  const r = solve(lines, fx, fy);
  let maxT = 0, maxLine = '-', taut = 0, uplift = 0, payOut = 0, reelIn = 0;
  r.T.forEach((t, i) => {
    if (lineMax && Number.isFinite(r.ux)) lineMax[lines[i].code] = Math.max(lineMax[lines[i].code] ?? 0, t);
    if (t > 0) taut++;
    if (t > maxT) { maxT = t; maxLine = lines[i].code; }
    const l = lines[i];
    if (l.dev && Number.isFinite(r.ux)) {
      const delta = Math.sqrt((l.ax - r.ux) ** 2 + (l.ay - r.uy) ** 2 + l.h * l.h) - l.dev.chord0;
      payOut = Math.max(payOut, delta); reelIn = Math.max(reelIn, -delta);
    }
    if (t > 0 && Number.isFinite(r.ux)) {
      const d = Math.sqrt((l.ax - r.ux) ** 2 + (l.ay - r.uy) ** 2 + l.h * l.h);
      uplift = Math.max(uplift, (t * Math.max(0, -l.h)) / d);
    }
  });
  return { level_m: level, direction_deg: dir, drift_m: Math.hypot(r.ux, r.uy), maxTension_kN: maxT, maxLine, taut, uplift, converged: r.converged, payOut, reelIn };
}

/** The levels analysed: from the lowest floating level to MNLKT, plus MNDB and MNLKT exactly. */
export function analysisLevels(inp: EqInput): number[] {
  const step = inp.levelStep_m ?? 1;
  const lo = Math.max(inp.mnc_m, inp.floatLevel_m);
  const out = new Set<number>();
  for (let w = Math.ceil(lo / step) * step; w < inp.mnlkt_m; w += step) out.add(Math.round(w * 100) / 100);
  for (const w of [lo, inp.mndb_m, inp.mnlkt_m]) if (w >= lo) out.add(Math.round(w * 100) / 100);
  return [...out].sort((a, b) => a - b);
}

export function analyseMooring(inp: EqInput): EqResult {
  const dirStep = inp.directionStep_deg ?? 15;
  const levels: EqLevelSummary[] = [];
  let gov: SolvedCase | null = null, damaged: SolvedCase | null = null, maxDrift = 0, maxUplift = 0, unconverged = 0, payOut = 0, reelIn = 0;
  const lineMax: Record<string, number> = Object.fromEntries(inp.lines.map((l) => [l.code, 0]));
  for (const w of analysisLevels(inp)) {
    let lv: EqLevelSummary = { level_m: w, maxTension_kN: 0, maxLine: '-', direction_deg: 0, maxDrift_m: 0, minTaut: Infinity };
    for (let dir = 0; dir < 360; dir += dirStep) {
      const c = solveCase(inp, w, dir, undefined, lineMax);
      if (!c.converged) unconverged++;
      if (c.maxTension_kN > lv.maxTension_kN) lv = { ...lv, maxTension_kN: c.maxTension_kN, maxLine: c.maxLine, direction_deg: dir };
      lv.maxDrift_m = Math.max(lv.maxDrift_m, c.drift_m);
      lv.minTaut = Math.min(lv.minTaut, c.taut);
      maxUplift = Math.max(maxUplift, c.uplift);
      payOut = Math.max(payOut, c.payOut); reelIn = Math.max(reelIn, c.reelIn);
      if (!gov || c.maxTension_kN > gov.maxTension_kN) gov = c;
    }
    maxDrift = Math.max(maxDrift, lv.maxDrift_m);
    levels.push(lv);
    // damaged: the most loaded line of this level is lost; every direction at this level is re-run
    for (let dir = 0; dir < 360; dir += dirStep) {
      const c = solveCase(inp, w, dir, lv.maxLine);
      if (!c.converged) unconverged++;
      if (!damaged || c.maxTension_kN > damaged.maxTension_kN) damaged = c;
    }
  }
  if (!gov || !damaged) throw new Error('analyseMooring: the raft floats at no level between MNC and MNLKT');
  const strip = ({ uplift: _u, converged: _c, payOut: _p, reelIn: _r, ...c }: SolvedCase): EqCase => c;
  return {
    compensation: inp.compensation,
    ea_kN: (inp.eaPerMbl ?? 15) * inp.mbl_kN,
    governing: strip(gov),
    damaged: strip(damaged),
    levels,
    maxDrift_m: maxDrift,
    maxUplift_kN: maxUplift,
    lineMax_kN: lineMax,
    unconverged,
    ...(inp.compensation === 'device' ? { deviceTravel: { payOut_m: payOut, reelIn_m: reelIn } } : {})
  };
}

/** The per-raft layout data the engine needs (stored in the raft catalogue). */
export interface MooringLayoutInput {
  /** Lowest level at which the raft floats: design bed (median IFC ground under it) + draft, m. */
  floatLevel_m: number;
  /** Smallest clear distance from the raft to another raft, m (drift check: half of it). */
  minGap_m: number;
  lines: EqLine[];
}
