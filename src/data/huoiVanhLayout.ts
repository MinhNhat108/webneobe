/**
 * The Huổi Vanh V2 mooring layout — the SINGLE entry point every consumer
 * (calculation catalogue, layout map, pile schedule, Excel, CAD export) reads.
 *
 *  - `RAFT_POLYGONS_V2`: the 9 raft-cluster outlines (95.873 m²). This is the
 *    only information taken from the client's CAD/Revit export.
 *  - `MOORING_LINES_V2`: the mooring network, a DESIGN OUTPUT of
 *    `scripts/planMooringLayoutV2.mjs` (the pile objects in the Revit DXF are
 *    placeholders and are never read). 292 lines, so every raft meets C9
 *    (P / N <= 15 m): 231 to bored shore piles and 61 to 32 lake-bed bases, 29
 *    of them shared by two facing rafts (owner's rule of 2026-10-08: bored
 *    piles near the shore, lake-bed bases only between two rafts).
 *
 * The V1 files (`huoiVanhCoordinates.json`, `huoiVanhRaftPolygons.json`, 298
 * lines) are no longer read by any code: the 3D simulation's V1/V2 toggle was
 * retired on 2026-09-30 once the 304-pile layout was final. They remain only
 * as history for the V1 scripts (`extractRaftPolygons.mjs`,
 * `repairMooringLayout.mjs`).
 */
import polygonsV2 from './huoiVanhRaftPolygons_v2.json';
import linesV2 from './huoiVanhCoordinates_v2.json';
import type { MooringCoordinate } from './huoiVanhProject';

export interface RaftPolygonV2 {
  id: number;
  name: string;
  area_m2: number;
  perimeter_m: number;
  centroid: { x: number; y: number };
  points: Array<{ x: number; y: number }>;
}

export const RAFT_POLYGONS_V2: RaftPolygonV2[] = polygonsV2 as RaftPolygonV2[];
export const MOORING_LINES_V2: MooringCoordinate[] = linesV2 as MooringCoordinate[];

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
    anchorPoints: shore.length + bases.length
  };
})();
