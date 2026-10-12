/**
 * Checks the live formulas of the calculation workbook against the engine.
 *
 *   1. npx vite-node scripts/verifyLiveWorkbook.ts -- --write <dir>
 *        writes <dir>/live_in.xlsx and <dir>/live_inputs.json (the input cells)
 *   2. powershell -File scripts/recalcLiveWorkbook.ps1 <dir>\live_in.xlsx <dir>\live_out.xlsx <dir>\live_inputs.json
 *        Excel recalculates every formula, fills the input cells yellow, saves live_out.xlsx
 *   3. npx vite-node scripts/verifyLiveWorkbook.ts -- --compare <dir>/live_out.xlsx
 *        every formula cell: value recalculated by Excel vs value of the engine
 *
 * live_out.xlsx is the file to publish (formulas + fresh values + yellow inputs).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { buildFinalDesign, buildFinalDesignWorkbook } from '../src/lib/io/finalDesignWorkbook';
import { buildLiveCalcSheets } from '../src/lib/io/liveCalcSheets';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => {
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  return { raft, state: st, results: calculateProject(st) };
});
const d = buildFinalDesign(state, calculateProject(state), batch);
const live = buildLiveCalcSheets(d);
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

const dir = arg('--write');
if (dir) {
  fs.writeFileSync(path.join(dir, 'live_in.xlsx'), XLSX.write(buildFinalDesignWorkbook(d), { type: 'buffer', bookType: 'xlsx' }));
  fs.writeFileSync(path.join(dir, 'live_inputs.json'), JSON.stringify(live.inputs));
  console.log('written', dir, Object.entries(live.inputs).map(([k, v]) => `${k}: ${v.length} input cells`).join(', '));
}

const out = arg('--compare');
if (out) {
  const wb = XLSX.read(fs.readFileSync(out));
  let cells = 0;
  const bad: string[] = [];
  for (const s of live.sheets) {
    const ws = wb.Sheets[s.name];
    for (const addr of Object.keys(s.ws)) {
      const src = s.ws[addr];
      if (addr[0] === '!' || !src.f) continue;
      cells++;
      const got = ws?.[addr]?.v, want = src.v;
      // the engine rounds its per-raft results to 0.01 for display
      const ok = typeof want === 'number'
        ? typeof got === 'number' && Math.abs(got - want) <= Math.max(0.006, 1.5e-3 * Math.abs(want))
        : got === want;
      if (!ok) bad.push(`${s.name}!${addr}: Excel ${got} vs engine ${want}   =${src.f.slice(0, 90)}`);
    }
  }
  console.log(`${cells} formula cells compared, ${bad.length} differ`);
  for (const b of bad.slice(0, 40)) console.log('  ' + b);
  if (bad.length) process.exit(1);
}
