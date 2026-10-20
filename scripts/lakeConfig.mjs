/**
 * The lakes the data scripts can work on. Every script that reads or writes a
 * layout file takes `--lake=<id>` (default `huoi-vanh`, so the Huổi Vanh
 * commands of CLAUDE.md are unchanged) and gets its file paths and levels here.
 *
 *   node scripts/importRaftLayoutBanMong.mjs "<plan.dxf>"
 *   node scripts/planMooringLayoutV2.mjs --lake=ban-mong
 *   npx vite-node scripts/buildRaftCatalogue.ts -- --lake=ban-mong
 *
 * The web app has its own copy of the levels in src/data/lakes.ts; the two are
 * pinned equal by src/data/__tests__/lakes.test.ts.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const LAKES = {
  'huoi-vanh': {
    id: 'huoi-vanh',
    files: {
      polygons: 'src/data/huoiVanhRaftPolygons_v2.json',
      coords: 'src/data/huoiVanhCoordinates_v2.json',
      piles: 'src/data/huoiVanhPiles_v2.json',
      terrain: 'src/data/huoiVanhTerrainMesh.json',
      catalogue: 'src/data/huoiVanhRaftCatalogue.json'
    },
    mndb: 384.5,
    // Lake-bed level under each raft = MNDB - design water depth (the IFC reads
    // ~396 m under the rafts, above the water, so it cannot supply it here).
    waterDepth: { 'BÈ 1': 6.0 },
    defaultDepth: 6.2,
    bedOnTerrain: false,
    // the merged rafts of the 9-raft plan (2026-10-08): no cleat step over 15 m
    gapLimited: ['BÈ 3A', 'BÈ 5A', 'BÈ 8']
  },
  'ban-mong': {
    id: 'ban-mong',
    files: {
      polygons: 'src/data/banMong/raftPolygons.json',
      coords: 'src/data/banMong/coordinates.json',
      piles: 'src/data/banMong/piles.json',
      terrain: 'src/data/banMong/terrainMesh.json',
      catalogue: 'src/data/banMong/raftCatalogue.json'
    },
    // Pre-FS "26.11.10 Pre Fs ĐMT nổi hồ Bản Mòng", thông số hồ chứa.
    mndb: 662.76,
    // The design bed of each raft is the median IFC ground under its outline,
    // written by importRaftLayoutBanMong.mjs into the polygon file (`designBed_m`).
    waterDepth: {},
    defaultDepth: null,
    // A lake-bed base only where the IFC terrain is known and under water at
    // MNDB (below the shore level MNDB - 0.5 of rule R1); its level is that
    // ground. "At or below MNC" was tried: too strict, BÈ 2, 5, 7, 8 then
    // cannot reach C9 (the rafts float over ground near or above MNC).
    bedOnTerrain: true,
    bedMaxGround: 662.26,
    gapLimited: []
  }
};

/** The lake named by `--lake=<id>` on the command line (default Huổi Vanh). */
export function lakeFromArgv(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith('--lake='));
  const id = arg ? arg.slice('--lake='.length) : 'huoi-vanh';
  const lake = LAKES[id];
  if (!lake) throw new Error(`unknown lake "${id}" (known: ${Object.keys(LAKES).join(', ')})`);
  const abs = Object.fromEntries(Object.entries(lake.files).map(([k, f]) => [k, path.join(ROOT, f)]));
  return { ...lake, abs };
}
