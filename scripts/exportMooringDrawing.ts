/**
 * Writes the mooring layout drawing and the anchor schedule of the design as
 * it stands in the repository (9 rafts, shore bored piles D350, lake-bed RC
 * bases with screw piles) — the same files the web buttons "Xuất CAD" and
 * "Bảng Neo" download, produced without a browser.
 *
 *   npx vite-node scripts/exportMooringDrawing.ts [outDir]                    (Hồ Huổi Vanh, docs/mat-bang-neo-9-be)
 *   npx vite-node scripts/exportMooringDrawing.ts -- [outDir] --lake=ban-mong (Hồ Bản Mòng, docs/mat-bang-neo-ban-mong)
 */
import './selectLake';
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
import { buildFinalDesign, buildFinalDesignWorkbook, finalDesignNote } from '../src/lib/io/finalDesignWorkbook';
import { ACTIVE_LAKE_ID } from '../src/data/lakes';

const here = path.dirname(fileURLToPath(import.meta.url));
const HV = ACTIVE_LAKE_ID === 'huoi-vanh';
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(here, HV ? '../docs/mat-bang-neo-9-be' : `../docs/mat-bang-neo-${ACTIVE_LAKE_ID}`);
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
const nb = `${HUOI_VANH_RAFTS.length}_be`;
const dxfName = write(`mat_bang_neo_${nb}.dxf`, built.dxf);
const xlsName = write(`bang_thong_ke_neo_${nb}.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
const final = buildFinalDesign(state, results, batch);
const calcName = write(HV ? 'bang_tinh_phuong_an_chot.xlsx' : 'bang_tinh_neo.xlsx', XLSX.write(buildFinalDesignWorkbook(final), { type: 'buffer', bookType: 'xlsx' }));
const noteName = write('THUYET_MINH_TINH_TOAN.md', ['# Thuyết minh tính toán hệ neo: cọc khoan nhồi ven bờ + đế BTCT vít xoắn', '', ...finalDesignNote(final).flatMap((sec) => [`## ${sec.title}`, '', ...sec.lines.map((l) => `- ${l}`), ''])].join(String.fromCharCode(10)));
console.log('FINAL', calcName, noteName, JSON.stringify(final.totals), 'grand', final.cost.grandTotal_VND, 'unpriced', final.cost.unpriced.length);
const T = built.schedule.totals;
const pts = buildAnchorPointSchedule(state, results, batch);
console.log('PER-POINT', JSON.stringify(pts.totals), 'bed depth at MNC min/max', Math.min(...pts.bed.map((b) => b.base.depthLow_m)).toFixed(2), Math.max(...pts.bed.map((b) => b.base.depthLow_m)).toFixed(2), 'at MNLKT', Math.min(...pts.bed.map((b) => b.base.depthHigh_m)).toFixed(2), Math.max(...pts.bed.map((b) => b.base.depthHigh_m)).toFixed(2), 'worst util', Math.max(...pts.bed.map((b) => b.util)).toFixed(2), 'failing', pts.bed.filter((b) => !b.base.ok).map((b) => b.code).join(','), 'shore ground min/max', Math.min(...pts.shore.map((p) => p.ground_m ?? 999)).toFixed(2), Math.max(...pts.shore.map((p) => p.ground_m ?? -999)).toFixed(2), 'steep-down', pts.shore.filter((p) => (p.slopeLow_deg ?? 0) < -25).length);
console.log(JSON.stringify({
  files: [dxfName, xlsName], rafts: built.raftCount, shorePoints: built.shorePileCount,
  shorePiles: built.schedule.shorePiles.reduce((s, r) => s + r.pileCount, 0), bases: built.baseCount,
  concrete_m3: +T.concrete_m3.toFixed(1), rebar_t: +(T.rebar_kg / 1000).toFixed(1), screws: T.screws, screw_m: +T.screwLength_m.toFixed(0),
  maxLift_t: +T.maxLiftMass_t.toFixed(1), okBases: T.okBases, clashes: built.schedule.clashes.map((c) => `${c.a}/${c.b} ${c.distance_m.toFixed(2)}`),
  verdicts: batch.map((b) => `${b.raft.name}:${b.results.overallVerdict}`).join(' '),
  ascii: !/[^\x0A\x20-\x7E]/.test(built.dxf), bytes: built.dxf.length
}, null, 1));
