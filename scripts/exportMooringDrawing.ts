/**
 * Writes the mooring layout drawing and the anchor schedule of the design as
 * it stands in the repository (9 rafts, shore bored piles D350, lake-bed RC
 * bases with screw piles) — the same files the web buttons "Xuất CAD" and
 * "Bảng Neo" download, produced without a browser.
 *
 *   npx vite-node scripts/exportMooringDrawing.ts [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { buildMooringScrewBaseDxf } from '../src/lib/io/screwBaseDxf';
import { buildScrewBaseScheduleWorkbook } from '../src/lib/io/screwBaseExcel';
import { buildAnchorPointSchedule } from '../src/lib/io/anchorPointSchedule';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? path.join(here, '../docs/mat-bang-neo-9-be');
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => {
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  return { raft, state: st, results: calculateProject(st) };
});
const results = calculateProject(state);
const built = buildMooringScrewBaseDxf(state, results, batch);
const wb = buildScrewBaseScheduleWorkbook(state, results, batch);

fs.mkdirSync(outDir, { recursive: true });
const write = (name: string, data: string | Buffer) => {
  try { fs.writeFileSync(path.join(outDir, name), data); return name; } catch (e: any) {
    if (e?.code !== 'EBUSY') throw e;
    const alt = name.replace(/(\.\w+)$/, '_moi$1'); // the file is open in AutoCAD / Excel
    fs.writeFileSync(path.join(outDir, alt), data);
    return alt;
  }
};
const dxfName = write('mat_bang_neo_9_be.dxf', built.dxf);
const xlsName = write('bang_thong_ke_neo_9_be.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
const T = built.schedule.totals;
const pts = buildAnchorPointSchedule(state, results, batch);
console.log('PER-POINT', JSON.stringify(pts.totals), 'bed depth at MNC min/max', Math.min(...pts.bed.map((b) => b.depthLow_m)).toFixed(2), Math.max(...pts.bed.map((b) => b.depthLow_m)).toFixed(2), 'at MNLKT', Math.min(...pts.bed.map((b) => b.depthHigh_m)).toFixed(2), Math.max(...pts.bed.map((b) => b.depthHigh_m)).toFixed(2), 'worst util', Math.max(...pts.bed.map((b) => b.util)).toFixed(2), 'failing', pts.bed.filter((b) => !b.base.ok).map((b) => b.code).join(','), 'shore ground min/max', Math.min(...pts.shore.map((p) => p.ground_m ?? 999)).toFixed(2), Math.max(...pts.shore.map((p) => p.ground_m ?? -999)).toFixed(2), 'steep-down', pts.shore.filter((p) => (p.slopeLow_deg ?? 0) < -25).length);
console.log(JSON.stringify({
  files: [dxfName, xlsName], rafts: built.raftCount, shorePoints: built.shorePileCount,
  shorePiles: built.schedule.shorePiles.reduce((s, r) => s + r.pileCount, 0), bases: built.baseCount,
  concrete_m3: +T.concrete_m3.toFixed(1), rebar_t: +(T.rebar_kg / 1000).toFixed(1), screws: T.screws, screw_m: +T.screwLength_m.toFixed(0),
  maxLift_t: +T.maxLiftMass_t.toFixed(1), okBases: T.okBases, clashes: built.schedule.clashes.map((c) => `${c.a}/${c.b} ${c.distance_m.toFixed(2)}`),
  verdicts: batch.map((b) => `${b.raft.name}:${b.results.overallVerdict}`).join(' '),
  ascii: !/[^\x0A\x20-\x7E]/.test(built.dxf), bytes: built.dxf.length
}, null, 1));
