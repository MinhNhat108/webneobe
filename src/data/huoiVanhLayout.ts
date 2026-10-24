/**
 * The Huổi Vanh V2 mooring layout — the SINGLE entry point every consumer
 * (calculation catalogue, layout map, pile schedule, Excel, CAD export) reads.
 *
 *  - `RAFT_POLYGONS_V2`: the 9 raft-cluster outlines (95.873 m²). This is the
 *    only information taken from the client's CAD/Revit export.
 *  - `MOORING_LINES_V2`: the mooring network, a DESIGN OUTPUT of
 *    `scripts/planMooringLayoutV2.mjs` (the pile objects in the Revit DXF are
 *    placeholders and are never read). 295 lines, so every raft meets C9
 *    (P / N <= 15 m): 231 to bored shore piles and 64 to 32 lake-bed bases, every one
 *    of them shared by two facing rafts (owner's rule of 2026-10-08: bored
 *    piles near the shore, lake-bed bases only between two rafts).
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
