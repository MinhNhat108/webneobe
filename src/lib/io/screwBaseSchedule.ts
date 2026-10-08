import { calculateProject } from '../calc';
import type { CalcResults, ProjectState } from '../calc/types';
import { designScrewBaseForLines, type BaseLoadCombination, type ScrewBaseResult } from '../calc/screwAnchorBed';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2, bedAnchorsOf } from '../../data/huoiVanhLayout';
import { buildPileSchedule, PileScheduleBatchLike, PileScheduleRow } from './pileSchedule';

/** Reservoir levels the bases are checked at: flattest cable at MNC, steepest at MNLKT (project datum, m). */
export const BASE_LOW_WATER_M = 380.0;
export const BASE_HIGH_WATER_M = 386.0;

/** One cable tied to a base. */
export interface ScrewBaseLine {
  code: string;
  raft: string;
  xRaft: number;
  yRaft: number;
  span_m: number;
  /** Bearing of the cable from the raft to the base, degrees clockwise from north (+Y). */
  azimuth_deg: number;
  /** Governing line tension of the raft, kN. */
  tension_kN: number;
}

/** One lake-bed base (RC base + screw piles) — a row of the CAD table and of the Excel sheet. */
export interface ScrewBaseRow {
  /** Sequential drawing id, HV-DV001… */
  baseId: string;
  /** Line code(s) tied to this base, e.g. "B1-D15 + B2-D13". */
  code: string;
  /** Raft(s) of those lines, e.g. "BÈ 1 + BÈ 2". */
  raft: string;
  /** Two facing lines of two rafts on this one base. */
  shared: boolean;
  lines: ScrewBaseLine[];
  x: number;
  y: number;
  /** DESIGN lake-bed level the base stands on, m. */
  z: number;
  /** Water depth over the base at the low and high water levels, m. */
  depthLow_m: number;
  depthHigh_m: number;
  /** Plan orientation of the base: bearing of its first cable. */
  azimuth_deg: number;
  /** Shortest cable of the base, m. */
  span_m: number;
  side_m: number;
  thickness_m: number;
  concrete_m3: number;
  rebar_kg: number;
  liftMass_t: number;
  screwCount: number;
  /** Total screw length of this base, m. */
  screwLength_m: number;
  /** Largest line tension on the base, kN. */
  Tmax_kN: number;
  upliftUtil: number;
  slideUtil: number;
  overturnUtil: number;
  screwUtil: number;
  bearingUtil: number;
  rebarUtil: number;
  /** The load combinations checked and the one that governs. */
  combinations: BaseLoadCombination[];
  governing: string;
  /** The base as designed (worst utilisation over the combinations). */
  design: ScrewBaseResult;
  ok: boolean;
  /** Ids of the neighbouring bases this one overlaps on plan (empty when it fits). */
  clashWith: string[];
}

export interface ScrewBaseClash { a: string; b: string; distance_m: number }

export interface ScrewBaseTotals {
  bases: number;
  sharedBases: number;
  /** Lake-bed lines tied to those bases. */
  lines: number;
  concrete_m3: number;
  rebar_kg: number;
  screws: number;
  screwLength_m: number;
  /** Heaviest base to lift, t. */
  maxLiftMass_t: number;
  /** Smallest and largest base side, m. */
  side_m: [number, number];
  okBases: number;
}

/** Quantities of the bases attributed to a raft (a shared base counts half for each of its two rafts). */
export interface RaftBaseQuantities { name: string; bases: number; concrete_m3: number; rebar_kg: number; screwLength_m: number }

export interface ScrewBaseSchedule {
  /** The shore piles, with the ids of the pile schedule. */
  shorePiles: PileScheduleRow[];
  bases: ScrewBaseRow[];
  /** The base the ENGINE checks for each raft (one line, the raft's shortest lake-bed line) — the SV rows of Tab 4. */
  baseByRaft: Map<string, ScrewBaseResult>;
  byRaft: RaftBaseQuantities[];
  clashes: ScrewBaseClash[];
  totals: ScrewBaseTotals;
}

type Pt = { x: number; y: number };
/** Corners of a square base centred on `c`, one side along the cable direction. */
export function baseCorners(c: Pt, side_m: number, azimuth_deg: number): Pt[] {
  const a = (azimuth_deg * Math.PI) / 180;
  const u = { x: Math.sin(a), y: Math.cos(a) }, v = { x: Math.cos(a), y: -Math.sin(a) };
  const h = side_m / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({ x: c.x + (i * u.x + j * v.x) * h, y: c.y + (i * u.y + j * v.y) * h }));
}

/** Separating-axis test for two convex quadrilaterals. */
function overlap(p: Pt[], q: Pt[]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const n = { x: b.y - a.y, y: a.x - b.x };
      const proj = (pts: Pt[]) => pts.map((pt) => pt.x * n.x + pt.y * n.y);
      const pp = proj(p), qq = proj(q);
      if (Math.max(...pp) <= Math.min(...qq) + 1e-9 || Math.max(...qq) <= Math.min(...pp) + 1e-9) return false;
    }
  }
  return true;
}

/** Pairs of bases that physically overlap when each is laid with one side along its cable. */
export function findBaseClashes(bases: Array<Pick<ScrewBaseRow, 'baseId' | 'x' | 'y' | 'side_m' | 'azimuth_deg'>>): ScrewBaseClash[] {
  const out: ScrewBaseClash[] = [];
  const corners = bases.map((b) => baseCorners(b, b.side_m, b.azimuth_deg));
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      const d = Math.hypot(bases[i].x - bases[j].x, bases[i].y - bases[j].y);
      if (d > (bases[i].side_m + bases[j].side_m) * 0.7072) continue; // further apart than the two half-diagonals
      if (overlap(corners[i], corners[j])) out.push({ a: bases[i].baseId, b: bases[j].baseId, distance_m: d });
    }
  }
  return out;
}

/**
 * Lake-bed anchor schedule: one row per BASE. Every base is designed for the
 * line(s) actually tied to it, at its own position:
 *  - span and bearing of each cable from the layout;
 *  - the base stands on the DESIGN lake bed (the layout's zAnchor: MNDB minus
 *    the raft's design depth — the owner's basis, "neo đế vít xoắn luôn ở đáy
 *    hồ"); water levels MNC 380.0 (flattest cable) and MNLKT 386.0 (steepest);
 *  - the tension of a line is the governing tension of ITS raft (the engine
 *    has no force distribution per line);
 *  - a base shared by two facing rafts is checked for one line taut with the
 *    other at the pretension, and for both taut (see designScrewBaseForLines).
 * Shore piles come from the pile schedule unchanged.
 */
export function buildScrewBaseSchedule(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): ScrewBaseSchedule {
  const coords = coordinates ?? MOORING_LINES_V2;
  const all = buildPileSchedule(state, results, batchResults, coords);
  const byRaftBatch = new Map<string, PileScheduleBatchLike>();
  for (const b of batchResults ?? []) byRaftBatch.set(b.raft.name, b);

  // One engine run per raft under the screw-base option: its governing tension and its raft-level base.
  const cache = new Map<string, { st: ProjectState; res: CalcResults }>();
  const raftOf = (raft: string) => {
    const hit = cache.get(raft);
    if (hit) return hit;
    const batch = byRaftBatch.get(raft);
    const st = batch?.state ?? state;
    let res = batch?.results ?? results;
    if (!res.bedScrewBase) res = calculateProject({ ...st, anchor: { ...st.anchor, bedAnchorOption: 'PA3_SCREW_BASE' } });
    const out = { st, res };
    cache.set(raft, out);
    return out;
  };

  const bases: ScrewBaseRow[] = [];
  for (const anchor of bedAnchorsOf(coords)) {
    const lines: ScrewBaseLine[] = anchor.lines.map((l) => ({
      code: l.code, raft: l.raft, xRaft: l.xRaft, yRaft: l.yRaft, span_m: l.span, azimuth_deg: l.azimuth,
      tension_kN: raftOf(l.raft).res.t_max_intact_kN
    }));
    const { st } = raftOf(lines[0].raft);
    const depthLow = Math.max(0, BASE_LOW_WATER_M - anchor.z), depthHigh = Math.max(0, BASE_HIGH_WATER_M - anchor.z);
    const d = designScrewBaseForLines({
      lines: lines.map((l) => ({ label: l.code, tension_kN: l.tension_kN, span_m: l.span_m, azimuth_deg: l.azimuth_deg })),
      depthLow_m: depthLow, depthHigh_m: depthHigh, pretension_kN: st.line.pretension_kN ?? 5,
      cuSurface_kPa: st.anchor.cuBed_kPa, cuAverage_kPa: st.anchor.cuBed_kPa,
      ...(st.anchor.screwBase ?? {})
    });
    const b = d.base;
    bases.push({
      baseId: `HV-DV${String(bases.length + 1).padStart(3, '0')}`,
      code: lines.map((l) => l.code).join(' + '), raft: [...new Set(lines.map((l) => l.raft))].join(' + '),
      shared: d.shared, lines, x: anchor.x, y: anchor.y, z: anchor.z, depthLow_m: depthLow, depthHigh_m: depthHigh,
      azimuth_deg: lines[0].azimuth_deg, span_m: Math.min(...lines.map((l) => l.span_m)),
      side_m: b.side_m, thickness_m: b.thickness_m, concrete_m3: b.concrete_m3, rebar_kg: b.rebar_kg, liftMass_t: b.liftMass_t,
      screwCount: b.params.screwCount, screwLength_m: b.screwTotalLength_m,
      Tmax_kN: Math.max(...lines.map((l) => l.tension_kN)),
      upliftUtil: b.upliftUtil, slideUtil: b.slideUtil, overturnUtil: b.overturnUtil, screwUtil: b.screwUtil, bearingUtil: b.bearingUtil, rebarUtil: b.rebarUtil,
      combinations: d.combinations, governing: d.governing, design: b, ok: b.ok, clashWith: []
    });
  }

  const clashes = findBaseClashes(bases);
  const byId = new Map(bases.map((b) => [b.baseId, b]));
  for (const c of clashes) { byId.get(c.a)!.clashWith.push(c.b); byId.get(c.b)!.clashWith.push(c.a); }

  // quantities per raft: a shared base counts half for each of its two rafts
  const q = new Map<string, RaftBaseQuantities>();
  for (const b of bases) {
    for (const l of b.lines) {
      if (!q.has(l.raft)) q.set(l.raft, { name: l.raft, bases: 0, concrete_m3: 0, rebar_kg: 0, screwLength_m: 0 });
      const r = q.get(l.raft)!, f = 1 / b.lines.length;
      r.bases += f; r.concrete_m3 += f * b.concrete_m3; r.rebar_kg += f * b.rebar_kg; r.screwLength_m += f * b.screwLength_m;
    }
  }
  const baseByRaft = new Map<string, ScrewBaseResult>();
  for (const [raft, v] of cache) if (v.res.bedScrewBase) baseByRaft.set(raft, v.res.bedScrewBase);
  const sides = bases.map((b) => b.side_m);

  return {
    shorePiles: all.filter((r) => r.type === 'SHORE'),
    bases,
    baseByRaft,
    byRaft: [...q.values()],
    clashes,
    totals: {
      bases: bases.length,
      sharedBases: bases.filter((b) => b.shared).length,
      lines: bases.reduce((s, b) => s + b.lines.length, 0),
      concrete_m3: bases.reduce((s, b) => s + b.concrete_m3, 0),
      rebar_kg: bases.reduce((s, b) => s + b.rebar_kg, 0),
      screws: bases.reduce((s, b) => s + b.screwCount, 0),
      screwLength_m: bases.reduce((s, b) => s + b.screwLength_m, 0),
      maxLiftMass_t: bases.reduce((s, b) => Math.max(s, b.liftMass_t), 0),
      side_m: sides.length ? [Math.min(...sides), Math.max(...sides)] : [0, 0],
      okBases: bases.filter((b) => b.ok).length
    }
  };
}
