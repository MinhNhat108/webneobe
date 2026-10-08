/**
 * The RC bases + screw piles of option 3 and the project totals — one function,
 * so Tab 9, the report and the quotation show the same bases.
 *
 * Two things are reported, and they are not the same:
 *  - `rows[].base`: the base the ENGINE checks for a raft (one line, the raft's
 *    shortest lake-bed line) — the SV-1…SV-6 rows of Tab 4;
 *  - the quantities and totals: the bases of the anchor schedule, one per
 *    anchor POINT, each designed for the line(s) actually tied to it. A base
 *    shared by two facing rafts is one base; it counts half for each raft.
 *
 * The active raft uses the inputs being edited in Tab 2, the others the frozen
 * catalogue (`resolveRaftState`).
 */
import { calculateProject } from './index';
import { resolveRaftState } from './raftState';
import type { ScrewBaseResult } from './screwAnchorBed';
import type { AnchorInput, ProjectState } from './types';
import type { MooringCoordinate, RaftSummaryItem } from '../../data/huoiVanhProject';
import { buildScrewBaseSchedule } from '../io/screwBaseSchedule';

export interface ScrewBaseRaftRow {
  name: string;
  isTrial: boolean;
  /** Lake-bed lines of the raft. */
  bedCount: number;
  /** Of which lines tied to a base shared with the facing raft. */
  sharedLines: number;
  /** Bases attributed to the raft (a shared base counts 0.5). */
  bases: number;
  concrete_m3: number;
  rebar_kg: number;
  screwLength_m: number;
  /** Smallest and largest side of the bases this raft is tied to, m. */
  side_m: [number, number];
  tension_kN: number;
  /** The engine's raft-level base (one line, shortest lake-bed line). */
  base: ScrewBaseResult;
  /** Every base this raft is tied to passes. */
  ok: boolean;
}

export interface ScrewBaseSummary {
  rows: ScrewBaseRaftRow[];
  /** Number of bases (anchor points on the lake bed). */
  bases: number;
  sharedBases: number;
  /** Lake-bed lines tied to those bases. */
  lines: number;
  concrete_m3: number;
  rebar_kg: number;
  screws: number;
  screwLength_m: number;
  /** Smallest and largest base side, m; heaviest base to lift, t. */
  side_m: [number, number];
  maxLiftMass_t: number;
  /** Bases per side length, e.g. { '2.50': 40 }. */
  basesBySide: Record<string, number>;
  allOk: boolean;
  failingRafts: string[];
  /** Rafts tied to at least one base larger than the starting size. */
  enlargedRafts: string[];
}

export function summariseScrewBases(
  current: ProjectState,
  activeRaftId: number,
  rafts: RaftSummaryItem[],
  defaultAnchor: AnchorInput,
  coordinates?: MooringCoordinate[]
): ScrewBaseSummary {
  const resolved = rafts.map((raft) => {
    const { state, deviations } = resolveRaftState(current, activeRaftId, raft, defaultAnchor);
    const st: ProjectState = { ...state, anchor: { ...state.anchor, bedAnchorOption: 'PA3_SCREW_BASE' } };
    return { raft, state: st, results: calculateProject(st), isTrial: deviations.length > 0 };
  });
  const first = resolved[0];
  const schedule = buildScrewBaseSchedule(first?.state ?? current, first?.results ?? calculateProject(current), resolved, coordinates);

  const rows: ScrewBaseRaftRow[] = [];
  for (const r of resolved) {
    const mine = schedule.bases.filter((b) => b.lines.some((l) => l.raft === r.raft.name));
    if (mine.length === 0 || !r.results.bedScrewBase) continue;
    const q = schedule.byRaft.find((x) => x.name === r.raft.name);
    const sides = mine.map((b) => b.side_m);
    rows.push({
      name: r.raft.name, isTrial: r.isTrial,
      bedCount: mine.reduce((s, b) => s + b.lines.filter((l) => l.raft === r.raft.name).length, 0),
      sharedLines: mine.filter((b) => b.shared).length,
      bases: q?.bases ?? 0, concrete_m3: q?.concrete_m3 ?? 0, rebar_kg: q?.rebar_kg ?? 0, screwLength_m: q?.screwLength_m ?? 0,
      side_m: [Math.min(...sides), Math.max(...sides)],
      tension_kN: r.results.t_max_intact_kN, base: r.results.bedScrewBase,
      ok: mine.every((b) => b.ok)
    });
  }
  const T = schedule.totals;
  const bySide: Record<string, number> = {};
  for (const b of schedule.bases) bySide[b.side_m.toFixed(2)] = (bySide[b.side_m.toFixed(2)] ?? 0) + 1;
  return {
    rows,
    bases: T.bases, sharedBases: T.sharedBases, lines: T.lines,
    concrete_m3: T.concrete_m3, rebar_kg: T.rebar_kg, screws: T.screws, screwLength_m: T.screwLength_m,
    side_m: T.side_m, maxLiftMass_t: T.maxLiftMass_t,
    basesBySide: Object.fromEntries(Object.entries(bySide).sort((a, b) => Number(a[0]) - Number(b[0]))),
    allOk: T.okBases === T.bases,
    failingRafts: rows.filter((x) => !x.ok).map((x) => x.name),
    enlargedRafts: rows.filter((x) => x.side_m[1] > (x.base.params.side_m ?? 0) + 1e-9 || x.base.enlarged).map((x) => x.name)
  };
}
