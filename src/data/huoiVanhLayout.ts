/**
 * The Huổi Vanh V2 mooring layout — the SINGLE entry point every consumer
 * (calculation catalogue, layout map, pile schedule, Excel, CAD export) reads.
 *
 *  - `RAFT_POLYGONS_V2`: the raft-cluster outlines — 4 rafts, 98.803 m², plan of
 *    2026-10-27 ("CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ.dwg"). This
 *    is the only information taken from the client's CAD/Revit export.
 *  - `MOORING_LINES_V2`: the mooring network, a DESIGN OUTPUT of
 *    `scripts/planMooringLayoutV2.mjs` (the pile objects in the Revit DXF are
 *    placeholders and are never read). 219 lines, so every raft meets C9
 *    (P / N <= 15 m): 201 to bored shore piles and 18 to 11 lake-bed bases, 7 of
 *    them shared by the two facing rafts BÈ 2 – BÈ 4 (owner's rule of 2026-10-08:
 *    bored piles near the shore).
 *
 * The V1 files (`huoiVanhCoordinates.json`, `huoiVanhRaftPolygons.json`, 298
 * lines) are no longer read by any code: the 3D simulation's V1/V2 toggle was
 * retired on 2026-09-30 once the 304-pile layout was final. They remain only
 * as history for the V1 scripts (`extractRaftPolygons.mjs`,
 * `repairMooringLayout.mjs`).
 *
 * With Hồ Bản Mòng selected (src/data/lakes.ts) the same exports hold the
 * Bản Mòng layout: src/data/banMong/raftPolygons.json and coordinates.json,
 * made by scripts/importRaftLayoutBanMong.mjs and
 * `planMooringLayoutV2.mjs --lake=ban-mong` (8 rafts, 268 lines).
 */
import polygonsV2 from './huoiVanhRaftPolygons_v2.json';
import linesV2 from './huoiVanhCoordinates_v2.json';
import banMongPolygons from './banMong/raftPolygons.json';
import banMongLines from './banMong/coordinates.json';
import banMongTies from './banMong/ties.json';
import type { MooringCoordinate } from './huoiVanhProject';
import { ACTIVE_LAKE_ID } from './lakes';

const BAN_MONG = ACTIVE_LAKE_ID === 'ban-mong';

export interface RaftPolygonV2 {
  id: number;
  name: string;
  area_m2: number;
  perimeter_m: number;
  centroid: { x: number; y: number };
  points: Array<{ x: number; y: number }>;
  /** Bản Mòng: design lake bed of the raft, median IFC ground under the outline (m). */
  designBed_m?: number;
}

/** The active lake's raft outlines and mooring lines. */
export const RAFT_POLYGONS_V2: RaftPolygonV2[] = (BAN_MONG ? banMongPolygons : polygonsV2) as RaftPolygonV2[];
export const MOORING_LINES_V2: MooringCoordinate[] = (BAN_MONG ? banMongLines : linesV2) as MooringCoordinate[];

/** A tie rope joining two rafts cleat to cleat across a narrow gap, in place of a shared lake-bed base (Hồ Bản Mòng, lakeConfig raftTies). */
export interface RaftTie {
  code: string;
  rafts: [string, string];
  length_m: number;
  a: { code: string; raft: string; x: number; y: number };
  b: { code: string; raft: string; x: number; y: number };
  /** Where the shared base stood before the tie replaced it. */
  base: { x: number; y: number; z: number };
}
/** The ties of the active lake (none at Huổi Vanh). */
export const RAFT_TIES: RaftTie[] = (BAN_MONG ? banMongTies : []) as RaftTie[];

/** One lake-bed base with the line(s) tied to it: one, or two facing lines of two rafts (a shared base). */
export interface BedAnchor {
  /** Layout id of the base, e.g. "DV-012". */
  id: string;
  x: number;
  y: number;
  z: number;
  lines: MooringCoordinate[];
  shared: boolean;
}

/** The lake-bed bases of a line set: lines carrying the same `anchorId` are tied to one base. */
export function bedAnchorsOf(lines: MooringCoordinate[] = MOORING_LINES_V2): BedAnchor[] {
  const byId = new Map<string, MooringCoordinate[]>();
  for (const l of lines) {
    if (l.type !== 'BED') continue;
    const id = l.anchorId ?? l.code; // a line with no id has a base of its own
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(l);
  }
  return [...byId.entries()].map(([id, ls]) => ({ id, x: ls[0].xAnchor, y: ls[0].yAnchor, z: ls[0].zAnchor, lines: ls, shared: ls.length > 1 }));
}

/** Counts of the layout, for the labels of the app. */
export const LAYOUT_COUNTS = (() => {
  const shore = MOORING_LINES_V2.filter((l) => l.type === 'SHORE');
  const bases = bedAnchorsOf();
  return {
    lines: MOORING_LINES_V2.length,
    shorePoints: shore.length,
    convertedShorePoints: shore.filter((l) => l.converted).length,
    bedLines: MOORING_LINES_V2.length - shore.length,
    bedBases: bases.length,
    sharedBases: bases.filter((b) => b.shared).length,
    anchorPoints: shore.length + bases.length,
    ties: RAFT_TIES.length
  };
})();

/**
 * Angle in plan between a line and the outward normal of the raft edge its cleat is on, degrees (0 for a cleat
 * on a convex corner whose cable leaves inside the corner's wedge).
 */
export function lineObliquity(l: MooringCoordinate, polygons: RaftPolygonV2[] = RAFT_POLYGONS_V2): number {
  const ring = polygons.find((p) => p.name === l.raft)?.points;
  if (!ring) return 0;
  const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a.x * b.y - b.x * a.y; }, 0);
  const L = Math.hypot(l.xAnchor - l.xRaft, l.yAnchor - l.yRaft);
  const d = { x: (l.xAnchor - l.xRaft) / L, y: (l.yAnchor - l.yRaft) / L };
  const dots: number[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const u = Math.max(0, Math.min(len, (l.xRaft - a.x) * ux + (l.yRaft - a.y) * uy));
    if (Math.hypot(l.xRaft - a.x - ux * u, l.yRaft - a.y - uy * u) < 0.05) dots.push(area > 0 ? d.x * uy - d.y * ux : -d.x * uy + d.y * ux);
  });
  if (!dots.length) return 0;
  if (dots.length > 1 && dots.every((v) => v >= 0)) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, Math.max(...dots)))) * 180) / Math.PI;
}

/** Shore lines more than `limit_deg` off the normal of their raft edge (the planner straightens new piles to 60° where the bank allows). */
export function obliqueShoreLines(limit_deg = 60, lines: MooringCoordinate[] = MOORING_LINES_V2): Array<{ code: string; deg: number; staked: boolean }> {
  return lines.filter((l) => l.type === 'SHORE').map((l) => ({ code: l.code, deg: lineObliquity(l), staked: !l.converted }))
    .filter((x) => x.deg > limit_deg + 0.05);
}
