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
    // BÈ 1 of the 4-raft plan (2026-10-27) holds the old BÈ 1 (6.0 m): the shallower depth is kept.
    waterDepth: { 'BÈ 1': 6.0 },
    defaultDepth: 6.2,
    // panel count of each raft from the tables of "HOHUOIVANH.BỐ TRÍ BÈ PIN 281026.pdf" (sheets CT-BE01…04): 18,914
    // panels. Before 2026-10-28 the 4-raft plan gave none and the 18,354 of 2026-10-08 were shared by area.
    panelsByRaft: { 'BÈ 1': 2800, 'BÈ 2': 9114, 'BÈ 3': 1400, 'BÈ 4': 5600 },
    bedOnTerrain: false,
    // no cleat step over 15 m: the merged rafts of the 9-raft plan (2026-10-08: 3A, 5A, 8); every raft of the
    // 4-raft plan (2026-10-27) is a merged one
    gapLimited: ['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 4'],
    // Owner 2026-10-28 (sketch on the 4-raft plan): screw-pile bases along the south edge of BÈ 2 (the red ring) and
    // the top of BÈ 4. Second review the same day: "cái nào mà ko neo bờ đc thì neo bản đế vít giữa bè pin" — in the
    // gaps BÈ 1–2, 2–4, 2–3 a line goes to the bank where it can (the planner's own rule R1), a base only where it
    // cannot; so no bedGaps any more. A zone holds only the edges facing `facing` (± facingTol, outward normal
    // azimuth): the east / west ends of the BÈ 2 south block and the sides of the BÈ 4 top go to the bank.
    bedGaps: [],
    // "chỗ này bố trí đc neo bờ" (owner 2026-10-28, inner corner of the BÈ 2 south-west step): the bank is 61–70 m away,
    // past the 60 m reach, so these two lines may be up to 70 m long
    shoreSpanFor: { 'B2-D74': 70, 'B2-D75': 70 },
    bedGapLimit: 80,
    bedZones: [
      { id: 'be2-south', raft: 'BÈ 2', note: 'mép nam BÈ 2 (vùng khoanh đỏ)', facing: 180, polygon: [{ x: -90, y: -205 }, { x: 420, y: -205 }, { x: 420, y: -320 }, { x: -90, y: -320 }] },
      // "phần trên cùng bè 4 (xem xét)": compared 2026-10-28 — with bases here BÈ 4 drops from 147 to 107 kN
      // (PES-40 -> PES-36, piles 6Φ28 CB500-V -> 6Φ25): the short stiff shore lines of the top took the load. Kept
      // for the top edge only.
      { id: 'be4-top', raft: 'BÈ 4', note: 'mép trên cùng BÈ 4', facing: 0, polygon: [{ x: 55, y: 275 }, { x: 170, y: 275 }, { x: 170, y: 300 }, { x: 55, y: 300 }] },
      // comparison only (`--bed-zone=be1-gap`): B1-D44 / D45 at the BÈ 1 – BÈ 2 gap kept on bases
      { id: 'be1-gap', raft: 'BÈ 1', optional: true, note: 'B1-D44, D45 khe BÈ 1 – BÈ 2', facing: 130, polygon: [{ x: -20, y: -75 }, { x: 0, y: -75 }, { x: 0, y: -55 }, { x: -20, y: -55 }] }
    ],
    // a base only where the IFC ground is below the shore level (MNDB - 0.5); its level is the lower of its rafts'
    // design beds, or the IFC ground where that is higher (gap BÈ 2 – BÈ 3: 381–383 m, above MNC)
    bedMaxGround: 384.0,
    bedLevelAtLeastTerrain: true,
    // a base facing the other raft of a wide gap that cannot take a partner line stays single (reported)
    singleBaseFacingOk: true,
    // new shore piles set back to at least 6 m from the cleat (2026-10-28, tilt 10°): BÈ 1 134 -> 92 kN (PES-40 ->
    // PES-32, single piles), BÈ 3 58 -> 51 kN, for 16 m more shore cable; 8 / 12 m gain nothing more
    minShoreSpan: 6
  },
  'ban-mong': {
    id: 'ban-mong',
    files: {
      polygons: 'src/data/banMong/raftPolygons.json',
      coords: 'src/data/banMong/coordinates.json',
      piles: 'src/data/banMong/piles.json',
      terrain: 'src/data/banMong/terrainMesh.json',
      catalogue: 'src/data/banMong/raftCatalogue.json',
      ties: 'src/data/banMong/ties.json'
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
    gapLimited: [],
    // Rule R3 (no single base facing another raft) is the Huổi Vanh owner's; here single bases in
    // open water are normal, so a base facing a raft that has no room for a partner line stays single.
    singleBaseFacingOk: true,
    // Rule R1 reach: the bank is 60–110 m from several rafts (BÈ 3 west end, BÈ 6, BÈ 8 south). Owner 2026-10-24:
    // anchor to the bank wherever possible, settled on 80 m shore cables (Huổi Vanh 60 m). 100 m gives 48 bases
    // but loads BÈ 8 to 179 kN (short stiff bed lines left among long shore lines: PES-48, 3 piles per point).
    maxShoreSpan: 80,
    // Rafts tied to each other across a narrow gap (owner 2026-10-24): every shared base of the pair is replaced by a
    // tie rope cleat to cleat (src/data/banMong/ties.json) and the pair is calculated as ONE group on its outer lines.
    // BÈ 3 – BÈ 4 (gap 12.9 m): BÈ 3 163 -> ~96 kN, 8 bases fewer; tying the other pairs raises the line forces.
    raftTies: [['BÈ 3', 'BÈ 4']],
    // Panels of each raft, tables "THỐNG KÊ TẤM PIN MẶT TRỜI" of the sheets CT-BP-01…08 of
    // "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG.pdf": 18 240 panels, SETTLED by the owner 2026-10-22 (the Pre-FS had 16 892).
    panelsByRaft: { 'BÈ 1': 2352, 'BÈ 2': 2380, 'BÈ 3': 3136, 'BÈ 4': 2252, 'BÈ 5': 784, 'BÈ 6': 1568, 'BÈ 7': 2884, 'BÈ 8': 2884 }
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
