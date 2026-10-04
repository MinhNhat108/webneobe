import { CalcResults, ProjectState } from '../calc/types';
import { RaftSummaryItem, MooringCoordinate } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2, RAFT_POLYGONS_V2 } from '../../data/huoiVanhLayout';
import { buildPileCage, PileCage, STIRRUP_DIA_MM, barUnitWeight_kg_m } from '../calc/pileCage';

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
  /** The inputs the raft was calculated with (the active raft carries its Tab 2 values). */
  state?: ProjectState;
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
  /** Piles at this anchor point (1, or 2 for a twin-pile point). Loads and capacities below are PER PILE. */
  pileCount: number;
  /** Pile diameter / side width, m. */
  D_m: number;
  /**
   * Minimum embedment the loads require (Broms inverse solve), m — advisory,
   * null if the solver did not converge. NOT the depth that gets driven.
   */
  Lopt_m: number | null;
  /** Design embedment — the depth this pile is actually built to, m. */
  Linput_m: number;
  /** Governing line tension of the raft this pile belongs to, kN (the whole line, not per pile). */
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
  /** Full pile length = L_tk + stick-up, m. */
  Ltotal_m: number;
  /** Bars on the tension face used by the bending check, and their diameter. */
  rebarFaceCount: number;
  rebarDia_mm: number;
  /** The cage as built (4·(k − 1) bars), its stirrups, casting segments and the quantities of ONE pile. */
  cage: PileCage;
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
  const coords = coordinates ?? MOORING_LINES_V2;
  const byRaft = new Map<string, PileScheduleBatchLike>();
  for (const b of batchResults ?? []) byRaft.set(b.raft.name, b);

  return coords.map((c, i) => {
    const batch = byRaft.get(c.raft);
    const res = batch?.results ?? results;
    const isShore = c.type === 'SHORE';

    const opt = isShore ? res.shorePileOpt : res.bedPileOpt;
    const D_m = isShore
      ? batch?.state?.anchor.shoreD_m ?? batch?.raft.shorePileD_m ?? state.anchor.shoreD_m ?? 0.45
      : batch?.state?.anchor.bed1D_m ?? batch?.raft.bedPileD_m ?? state.anchor.bed1D_m ?? 0.35;
    const Linput_m = isShore
      ? batch?.state?.anchor.shoreL_m ?? batch?.raft.shorePileL_m ?? state.anchor.shoreL_m ?? 6.5
      : batch?.state?.anchor.bed1L_m ?? batch?.raft.bedPileL_m ?? state.anchor.bed1L_m ?? 8.0;

    const anchorIn = (batch?.state ?? state).anchor;
    const stickup_m = (isShore ? anchorIn.shoreArm_e_m : anchorIn.bed1Stickup_m) ?? 0;
    const rebarFaceCount = (isShore ? anchorIn.shoreRebarFaceCount : anchorIn.bedRebarFaceCount) ?? 0;
    const rebarDia_mm = (isShore ? anchorIn.shoreRebarDia_mm : anchorIn.bedRebarDia_mm) ?? 0;
    const Ltotal_m = Linput_m + stickup_m;
    const cage = buildPileCage({
      side_m: D_m,
      faceCount: rebarFaceCount,
      dia_mm: rebarDia_mm,
      rs_MPa: anchorIn.pileRebarRs_MPa ?? 350,
      cover_mm: anchorIn.pileRebarCover_mm ?? 50,
      totalLength_m: Ltotal_m
    });

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
      pileCount: Math.max(1, Math.floor(
        (isShore ? (batch?.state ?? state).anchor.shorePilesPerPoint : (batch?.state ?? state).anchor.bedPilesPerPoint) ?? 1
      )),
      D_m: round(D_m),
      Lopt_m: opt?.L_opt_m ?? null,
      Linput_m: round(Linput_m),
      Tmax_kN: round(Tmax_kN),
      Preq_kN: round(Preq_kN),
      Pmax_kN: round(Pmax_kN),
      PmaxAtLopt_kN: round(PmaxAtLopt_kN),
      PmaxRated_kN: opt?.ratedPmax_kN,
      Ltotal_m: round(Ltotal_m),
      rebarFaceCount,
      rebarDia_mm,
      cage,
      // Checked against the as-built capacity, so this column can actually fail.
      isPmaxOk: Pmax_kN > 0 && Preq_kN <= Pmax_kN,
      note: opt?.converged === false ? opt.note : undefined
    };
  });
}

/** Bill of materials of a pile schedule: every pile of every anchor point. */
export interface PileMaterials {
  anchorPoints: number;
  piles: number;
  shorePiles: number;
  bedPiles: number;
  totalLength_m: number;
  concrete_m3: number;
  /** Main bars by diameter, kg (key = diameter in mm). */
  mainSteelByDia_kg: Record<number, number>;
  stirrupSteel_kg: number;
  hookSteel_kg: number;
  steel_kg: number;
}

export function summarisePileMaterials(rows: PileScheduleRow[]): PileMaterials {
  const m: PileMaterials = {
    anchorPoints: rows.length, piles: 0, shorePiles: 0, bedPiles: 0, totalLength_m: 0, concrete_m3: 0,
    mainSteelByDia_kg: {}, stirrupSteel_kg: 0, hookSteel_kg: 0, steel_kg: 0
  };
  for (const r of rows) {
    const n = r.pileCount;
    m.piles += n;
    if (r.type === 'SHORE') m.shorePiles += n; else m.bedPiles += n;
    m.totalLength_m += n * r.Ltotal_m;
    m.concrete_m3 += n * r.cage.concreteVol_m3;
    if (r.cage.totalBars > 0) m.mainSteelByDia_kg[r.rebarDia_mm] = (m.mainSteelByDia_kg[r.rebarDia_mm] ?? 0) + n * r.cage.mainSteel_kg;
    m.stirrupSteel_kg += n * r.cage.stirrupSteel_kg;
    m.hookSteel_kg += n * r.cage.hookSteel_kg;
    m.steel_kg += n * r.cage.steel_kg;
  }
  return m;
}

/** "Φ8", unit weight etc. re-exported for the tables. */
export { STIRRUP_DIA_MM, barUnitWeight_kg_m };

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
 * PREFERRED: the 12 V2 raft-cluster outlines (`huoiVanhRaftPolygons_v2.json`,
 * via `huoiVanhLayout.ts`), same site-local frame as the anchor coordinates,
 * one polygon per raft.
 *
 * FALLBACK: any raft with no surveyed polygon gets the convex hull of its
 * mooring-line attachment points (`xRaft`/`yRaft`). That is an anchor-layout
 * envelope, not a pontoon edge, so the outline carries `source: 'hull'` and
 * the drawing says so — an approximated boundary must never be indis-
 * tinguishable from a surveyed one on a setting-out sheet.
 */
export function buildRaftOutlines(coordinates?: MooringCoordinate[]): RaftOutline[] {
  const coords = coordinates ?? MOORING_LINES_V2;
  const polygons: RaftPolygon[] = RAFT_POLYGONS_V2.map((p) => ({
    id: p.id,
    rafts: [p.name],
    area_m2: p.area_m2,
    points: p.points
  }));

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
