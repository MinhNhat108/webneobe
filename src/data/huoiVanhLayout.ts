/**
 * The Huổi Vanh V2 mooring layout — the SINGLE entry point every consumer
 * (calculation catalogue, layout map, pile schedule, Excel, CAD export) reads.
 *
 *  - `RAFT_POLYGONS_V2`: the 12 raft-cluster outlines (93.693 m²). This is the
 *    only information taken from the client's CAD/Revit export.
 *  - `MOORING_LINES_V2`: the mooring network, a DESIGN OUTPUT of
 *    `scripts/planMooringLayoutV2.mjs` (the pile objects in the Revit DXF are
 *    placeholders and are never read). 304 lines = 129 shore + 175 lake-bed
 *    square RC piles, sized so every raft meets C9 (P / N <= 15 m).
 *
 * The V1 files (`huoiVanhCoordinates.json`, `huoiVanhRaftPolygons.json`) are
 * kept only for the V1/V2 comparison toggle of the 3D simulation.
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
