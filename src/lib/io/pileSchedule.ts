import { CalcResults, ProjectState } from '../calc/types';
import { RaftSummaryItem, MooringCoordinate } from '../../data/huoiVanhProject';
import huoiVanhCoordinatesData from '../../data/huoiVanhCoordinates.json';
import huoiVanhRaftPolygons from '../../data/huoiVanhRaftPolygons.json';

/** A surveyed raft-cluster boundary, site-local metres. */
export interface RaftPolygon {
  id: number;
  /** Raft(s) this drawn cluster contains — usually one, #8 holds two. */
  rafts: string[];
  area_m2: number;
  points: Array<{ x: number; y: number }>;
}

export interface PileScheduleBatchLike {
  raft: RaftSummaryItem;
  results: CalcResults;
}

/** One row of the Pile Schedule — what goes into the CAD table and Excel. */
export interface PileScheduleRow {
  /** Sequential drawing id, e.g. HV-P001. */
  pileId: string;
  /** Original anchor-point code from the survey data, e.g. N1-02. */
  code: string;
  raft: string;
  type: 'SHORE' | 'BED';
  x: number;
  y: number;
  z: number;
  /** Attachment point on the raft edge (start of the mooring line). */
  xRaft: number;
  yRaft: number;
  span_m: number;
  azimuth_deg: number;
  /** Pile diameter / side width, m. */
  D_m: number;
  /**
   * Minimum embedment the loads require (Broms inverse solve), m — advisory,
   * null if the solver did not converge. NOT the depth that gets driven.
   */
  Lopt_m: number | null;
  /** Design embedment — the depth this pile is actually built to, m. */
  Linput_m: number;
  /** Governing line tension of the raft this pile belongs to, kN. */
  Tmax_kN: number;
  /** P_req = T_max * SF, kN. */
  Preq_kN: number;
  /**
   * P_max used for the check, kN: the allowable holding capacity at the DESIGN
   * embedment `Linput_m` (capped by a rated catalogue value when one is given).
   *
   * Deliberately NOT the capacity at `Lopt_m`: that is the capacity at the
   * shallowest depth that merely carries the load, so it sits within a few
   * percent of `Preq_kN` for every pile and makes a schedule read as if
   * everything were 95-100 % utilised, when the pile actually driven is
   * deeper and roughly twice as strong.
   */
  Pmax_kN: number;
  /** P_max at the minimum depth `Lopt_m`, kN — for reference beside L_opt. */
  PmaxAtLopt_kN: number;
  /** Rated catalogue / load-test P_max, kN (undefined when not supplied). */
  PmaxRated_kN?: number;
  /** T_dây <= P_max. */
  isPmaxOk: boolean;
  note?: string;
}

const round = (v: number, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

/**
 * Builds the Pile Schedule from the real survey coordinates and the batch
 * calculation, one row per anchor point.
 *
 * Each point inherits the pile geometry and P_max of its raft's calculation:
 * SHORE points from the shore pile, BED points from the lake-bed pile. Rafts
 * with no batch result fall back to the active project's own numbers, so the
 * schedule is never silently short of rows.
 */
export function buildPileSchedule(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): PileScheduleRow[] {
  const coords = coordinates ?? (huoiVanhCoordinatesData as MooringCoordinate[]);
  const byRaft = new Map<string, PileScheduleBatchLike>();
  for (const b of batchResults ?? []) byRaft.set(b.raft.name, b);

  return coords.map((c, i) => {
    const batch = byRaft.get(c.raft);
    const res = batch?.results ?? results;
    const isShore = c.type === 'SHORE';

    const opt = isShore ? res.shorePileOpt : res.bedPileOpt;
    const D_m = isShore
      ? batch?.raft.shorePileD_m ?? state.anchor.shoreD_m ?? 0.45
      : batch?.raft.bedPileD_m ?? state.anchor.bed1D_m ?? 0.35;
    const Linput_m = isShore
      ? batch?.raft.shorePileL_m ?? state.anchor.shoreL_m ?? 6.5
      : batch?.raft.bedPileL_m ?? state.anchor.bed1L_m ?? 8.0;

    const Tmax_kN = res.t_max_intact_kN;
    const Preq_kN = opt ? opt.Preq_kN : Tmax_kN * (state.anchor.sfPileCapacity ?? 1.0);

    // Capacity AT THE DESIGN DEPTH — what this pile will really hold once built.
    const designCapacity = isShore ? res.shorePileCapacity : res.bedPileCapacity;
    const rated = isShore ? state.anchor.pileRatedPmaxShore_kN : state.anchor.pileRatedPmaxBed_kN;
    const computedPmax = designCapacity?.Pmax_kN ?? opt?.effectivePmax_kN ?? 0;
    const Pmax_kN = rated && rated > 0 ? Math.min(computedPmax, rated) : computedPmax;
    const PmaxAtLopt_kN = opt?.effectivePmax_kN ?? 0;

    return {
      pileId: `HV-P${String(i + 1).padStart(3, '0')}`,
      code: c.code,
      raft: c.raft,
      type: c.type,
      x: c.xAnchor,
      y: c.yAnchor,
      z: c.zAnchor,
      xRaft: c.xRaft,
      yRaft: c.yRaft,
      span_m: c.span,
      azimuth_deg: c.azimuth,
      D_m: round(D_m),
      Lopt_m: opt?.L_opt_m ?? null,
      Linput_m: round(Linput_m),
      Tmax_kN: round(Tmax_kN),
      Preq_kN: round(Preq_kN),
      Pmax_kN: round(Pmax_kN),
      PmaxAtLopt_kN: round(PmaxAtLopt_kN),
      PmaxRated_kN: opt?.ratedPmax_kN,
      // Checked against the as-built capacity, so this column can actually fail.
      isPmaxOk: Pmax_kN > 0 && Preq_kN <= Pmax_kN,
      note: opt?.converged === false ? opt.note : undefined
    };
  });
}

/** Convex hull (monotone chain) of the raft-edge attachment points. */
export function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length < 3) return pts;
  const cross = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Array<{ x: number; y: number }> = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export interface RaftOutline {
  /** Label to draw — a raft name, or "BÈ 8 + BÈ 9" where one drawn cluster holds two. */
  raft: string;
  points: Array<{ x: number; y: number }>;
  /**
   * 'surveyed' — the real boundary polygon from the client's CAD file.
   * 'hull'     — fallback: convex hull of the mooring attachment points.
   */
  source: 'surveyed' | 'hull';
}

/**
 * Raft outlines for the drawing.
 *
 * PREFERRED: the surveyed boundary polygons in `huoiVanhRaftPolygons.json`,
 * extracted from layer `A-DETL-THIN` of the client's floor-plan DXF (12
 * closed polygons, mm converted to m, same site-local frame as the anchor
 * coordinates). Polygon #8 encloses BOTH "BÈ 8" and "BÈ 9" — they are one
 * drawn cluster but two calculation rafts — so it is drawn once under a
 * combined label rather than duplicated.
 *
 * FALLBACK: any raft with no surveyed polygon gets the convex hull of its
 * mooring-line attachment points (`xRaft`/`yRaft`). That is an anchor-layout
 * envelope, not a pontoon edge, so the outline carries `source: 'hull'` and
 * the drawing says so — an approximated boundary must never be indis-
 * tinguishable from a surveyed one on a setting-out sheet.
 */
export function buildRaftOutlines(coordinates?: MooringCoordinate[]): RaftOutline[] {
  const coords = coordinates ?? (huoiVanhCoordinatesData as MooringCoordinate[]);
  const polygons = huoiVanhRaftPolygons as RaftPolygon[];

  const outlines: RaftOutline[] = [];
  const covered = new Set<string>();

  // Only use a surveyed polygon for rafts this coordinate set actually has.
  const present = new Set(coords.map((c) => c.raft));
  for (const poly of polygons) {
    const rafts = poly.rafts.filter((r) => present.has(r));
    if (rafts.length === 0) continue;
    rafts.forEach((r) => covered.add(r));
    outlines.push({ raft: rafts.join(' + '), points: poly.points, source: 'surveyed' });
  }

  const groups = new Map<string, Array<{ x: number; y: number }>>();
  for (const c of coords) {
    if (covered.has(c.raft)) continue;
    if (!groups.has(c.raft)) groups.set(c.raft, []);
    groups.get(c.raft)!.push({ x: c.xRaft, y: c.yRaft });
  }
  for (const [raft, points] of groups) {
    outlines.push({ raft, points: convexHull(points), source: 'hull' });
  }

  return outlines;
}
