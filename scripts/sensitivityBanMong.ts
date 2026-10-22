/**
 * Hồ Bản Mòng: how much the result depends on what the survey will replace.
 *
 *   npx vite-node scripts/sensitivityBanMong.ts -- --lake=ban-mong
 *
 * 1. Undrained strength of the bank soil under the shore piles (default 40 kPa) and of the lake-bed mud
 *    under the bases (default 20 kPa): the piles' BP-1 / BP-2 and the bases' auto-sized concrete.
 * 3. Rope stiffness EA = k × MBL (assumed 15).
 * 2. Level of the lake bed / bank under the anchors (IFC grid ~10 m): every pin moved ±1 m and ±2 m.
 * Nothing is written.
 */
import './selectLake';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, type RaftSummaryItem } from '../src/data/huoiVanhProject';
import { buildFinalDesign } from '../src/lib/io/finalDesignWorkbook';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const f = (v: number, d = 2) => v.toFixed(d);
const util = (r: ReturnType<typeof calculateProject>, id: string) => r.checks.find((c) => c.id === id)?.utilization ?? NaN;

function scenario(label: string, anchor: Partial<ProjectState['anchor']>, pinShift_m = 0, ea?: number) {
  const rafts: RaftSummaryItem[] = HUOI_VANH_RAFTS.map((r) => pinShift_m === 0 ? r
    : { ...r, mooringLayout: { ...r.mooringLayout!, lines: r.mooringLayout!.lines.map((l) => ({ ...l, pin_m: l.pin_m + pinShift_m })) } });
  const base = dflt();
  if (ea !== undefined) base.line.eaPerMbl = ea;
  const state = buildRaftProjectState({ ...base, anchor: { ...base.anchor, ...anchor } }, rafts[0], { ...base.anchor, ...anchor });
  const batch = rafts.map((raft) => { const st = buildRaftProjectState(state, raft, state.anchor); return { raft, state: st, results: calculateProject(st) }; });
  const d = buildFinalDesign(state, calculateProject(state), batch);
  const bad = batch.filter((b) => b.results.overallVerdict !== 'PASS').map((b) => `${b.raft.name}(${b.results.checks.filter((c) => c.status === 'FAIL').map((c) => c.id).join(',')})`);
  const T = batch.map((b) => b.results.t_max_intact_kN);
  console.log(
    `${label.padEnd(26)} | T ${f(Math.min(...T), 0)}–${f(Math.max(...T), 0)} kN | BP-1 max ${f(Math.max(...batch.map((b) => util(b.results, 'BP-1'))))} BP-2 max ${f(Math.max(...batch.map((b) => util(b.results, 'BP-2'))))}` +
    ` | drift ${f(Math.max(...batch.map((b) => b.results.mooringAnalysis?.maxDrift_m ?? 0)), 1)} m (C12 limit = half the gap)` +
    ` | bases ${d.totals.bases}: ${f(d.totals.baseConcrete_m3, 0)} m3, heaviest ${f(d.totals.maxLift_t, 1)} t, allOk ${d.totals.allOk}` +
    ` | rafts not PASS: ${bad.length ? bad.join(' ') : 'none'}`
  );
}

console.log('--- bank soil cu (default 40 kPa) ---');
for (const c of [40, 30, 20, 10]) scenario(`cuShore ${c} kPa`, { cuShore_kPa: c });
console.log('--- lake-bed mud cu (default 20 kPa) ---');
for (const c of [20, 10, 5]) scenario(`cuBed ${c} kPa`, { cuBed_kPa: c });
console.log('--- anchor levels (IFC grid ~10 m) ---');
for (const m of [-2, -1, 0, 1, 2]) scenario(`pins ${m >= 0 ? '+' : ''}${m} m`, {}, m);
console.log('--- rope stiffness EA / MBL (assumed 15; polyester 10–20) ---');
for (const e of [8, 10, 15, 20, 30]) scenario(`EA = ${e} × MBL`, {}, 0, e);
