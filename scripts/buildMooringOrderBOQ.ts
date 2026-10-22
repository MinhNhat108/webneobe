/**
 * Procurement BOQ of the mooring system of the settled design, with the
 * two-branch bridle at the raft (owner's choice, 2026-10-16), computed from the
 * engine instead of typed numbers:
 *
 *   npx vite-node scripts/buildMooringOrderBOQ.ts -- <out.xlsx>                    (Hồ Huổi Vanh)
 *   npx vite-node scripts/buildMooringOrderBOQ.ts -- <out.xlsx> --lake=ban-mong    (Hồ Bản Mòng)
 *
 * Bridle: each line ends in a 3-hole delta plate about 3 m from the raft edge,
 * from which two branches of BRIDLE.branch_m go to two cleats BRIDLE.cleatGap_m
 * apart (angle between the branches BRIDLE.angle_deg). The main line, the pile
 * and the base carry the same tension T as before; the engine does not model
 * the bridle, so the branch check below is the only check of it.
 */
import './selectLake';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { ACTIVE_LAKE } from '../src/data/lakes';
import { groundAt } from '../src/components/simulation/sceneModel';
import { designShorePileHead } from '../src/lib/calc/shorePileHead';
import { designTwinPileCap } from '../src/lib/calc/twinPileCap';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { buildFinalDesign } from '../src/lib/io/finalDesignWorkbook';
import { buildCableCuttingSchedule } from '../src/lib/io/cableCuttingSchedule';

const out = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'BANG_THONG_KE_VAT_TU_ORDER_NEO_BE.xlsx';
const HV = ACTIVE_LAKE.id === 'huoi-vanh';
const LV = ACTIVE_LAKE.levels;
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => { const st = buildRaftProjectState(state, raft, dflt().anchor); return { raft, state: st, results: calculateProject(st) }; });
const d = buildFinalDesign(state, calculateProject(state), batch);
const cut = buildCableCuttingSchedule(state);

// ---------------------------------------------------------------- assumptions
const BRIDLE = {
  branch_m: 3.5, // pin to pin
  angle_deg: 60, // between the two branches
  unequal: 0.7, // share of T a branch is checked for (unequal branch lengths / angles); 0.58 if equal
  sfIntact: 3.0, sfOneBranch: 2.0,
  plateWLL_t: 12
};
const half = (BRIDLE.angle_deg / 2) * Math.PI / 180;
// plan reach of the bridle from the cleat line, and cleat spacing
const reach_m = BRIDLE.branch_m * Math.cos(half);
const cleatGap_m = 2 * BRIDLE.branch_m * Math.sin(half);
const EYE_ROPE_M = 1.0; // rope used by one spliced eye (eye + splice tail), m — ASSUMED
const WASTE = 0.05;
const MBL: Record<string, number> = { 'PES-24': 172, 'PES-28': 235, 'PES-32': 305, 'PES-36': 385, 'PES-40': 475 };
const SHACKLE_WLL_T = [4.75, 6.5, 9.5, 12, 17]; // few sizes on purpose: simpler to order and to fit on site
const g = 9.81;
const wll = (kN: number) => SHACKLE_WLL_T.find((w) => w * g >= kN) ?? 25;

// ---------------------------------------------------------------- per raft
const rafts = d.rafts.map((r) => {
  const T = r.tMax_kN;
  const fEq = T / (2 * Math.cos(half)), fDes = BRIDLE.unequal * T;
  const branch = ['PES-24', 'PES-28', 'PES-32', 'PES-36'].find((c) => MBL[c] / fDes >= BRIDLE.sfIntact && MBL[c] / T >= BRIDLE.sfOneBranch) ?? 'PES-40';
  return { name: r.name, T, cable: r.cable, mbl: r.mbl_kN, fEq, fDes, branch, sfB: MBL[branch] / fDes, sf1: MBL[branch] / T,
    mainShackle: wll(T), branchShackle: wll(fDes), plate: Math.max(BRIDLE.plateWLL_t, wll(T)), lines: r.lines, shore: r.shoreLines, bed: r.bedLines };
});
const R = Object.fromEntries(rafts.map((r) => [r.name, r]));

// ---------------------------------------------------------------- per line
const lines = cut.rows.map((c) => {
  const r = R[c.raft];
  const dz2 = Math.max(0, c.cutLength_m ** 2 - c.span_m ** 2);
  const main = Math.hypot(Math.max(0, c.span_m - reach_m), Math.sqrt(dz2));
  return { ...c, main_m: main, mainRope_m: main + 2 * EYE_ROPE_M, branchRope_m: 2 * (BRIDLE.branch_m + 2 * EYE_ROPE_M), mainCable: r.cable, branchCable: r.branch, T: r.T,
    flag: main < 3 ? 'Cáp chính rất ngắn — rút nhánh còn 2,5 m hoặc neo thẳng' : '' };
});
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const byCable = (sel: (l: typeof lines[0]) => boolean, key: 'mainCable' | 'branchCable', len: (l: typeof lines[0]) => number) => {
  const m = new Map<string, number>();
  for (const l of lines.filter(sel)) m.set(l[key], (m.get(l[key]) ?? 0) + len(l));
  return [...m.entries()].sort();
};
const shoreMain = byCable((l) => l.type === 'SHORE', 'mainCable', (l) => l.mainRope_m);
const bedMain = byCable((l) => l.type === 'BED', 'mainCable', (l) => l.mainRope_m);
const branches = byCable(() => true, 'branchCable', (l) => l.branchRope_m);
const nLines = lines.length, nShore = lines.filter((l) => l.type === 'SHORE').length, nBed = nLines - nShore;
const countBy = (f: (r: typeof rafts[0]) => number, key: (r: typeof rafts[0]) => number | string) => {
  const m = new Map<string, number>(); for (const r of rafts) m.set(String(key(r)), (m.get(String(key(r))) ?? 0) + f(r)); return [...m.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
};

// ---------------------------------------------------------------- piles, bases
const piles = d.schedule.shorePiles;
const pileMain_kg = sum(piles, (p) => p.pileCount * p.cage.mainSteel_kg);
const pileStir_kg = sum(piles, (p) => p.pileCount * p.cage.stirrupSteel_kg);
const T = d.totals;
const bp = d.schedule.bases[0].design.params;
const vn = (v: number, k = 1) => Number(v.toFixed(k));
const tx = (v: number, k = 1) => v.toFixed(k).replace('.', ','); // number inside Vietnamese text
const twinPoints = piles.filter((p) => p.pileCount > 1);
const belowMndb = piles.filter((p) => (groundAt(p.x, p.y) ?? p.z) < LV.mndb_m).length; // IFC terrain at the pile
const tMaxAll = Math.max(...rafts.map((r) => r.T));
const bases0 = d.schedule.bases;
const sharedBases = bases0.filter((b) => b.shared).length;
const baseZ = bases0.map((b) => b.z);
const zText = [...new Set([Math.min(...baseZ), Math.max(...baseZ)].map((z) => tx(z, 1)))].join('–') + ' m';
const maxDepth = Math.ceil(LV.mnlkt_m - Math.min(...baseZ));
const sizeText = [...new Set(bases0.map((b) => b.side_m))].sort((a, b) => a - b).map((s) => `${bases0.filter((b) => b.side_m === s).length} đế ${tx(s, 2)} m`).join(', ');
const thkText = [...new Set(bases0.map((b) => b.thickness_m))].sort((a, b) => a - b).map((t) => tx(t, 1)).join(' / ');
// lines kept just taut at every level by a compensating device (Bản Mòng, 19.55 m level range)
const compensated = state.line.levelCompensation === 'seasonal' && !(state.line.adjustStep_m ?? 0);
const travel = (type: string) => Math.max(0, ...cut.rows.filter((c) => c.type === type).map((c) => c.cutLength_m - Math.min(c.chordLow_m, c.chordNormal_m, c.chordHigh_m)));
const ORDER_REF = HV ? 'Theo bảng order 15/10' : 'Lấy theo chi tiết của Huổi Vanh (bảng order 15/10)';
// Bản Mòng: the heads are designed (Huổi Vanh keeps the order of 15/10): single pile -> pile head,
// twin piles -> RC cap tying the two heads with the same padeye on it, lake-bed base -> padeye per line
// for the cable slope at MNLKT, anchor bars cut to the slab.
const LF = state.anchor.pileBendingLoadFactor ?? 1.2, E_PIN = state.anchor.shoreArm_e_m ?? 0.1;
const heads = HV ? [] : piles.filter((p) => p.pileCount === 1).map((p) => designShorePileHead({ tension_kN: R[p.raft].T, loadFactor: LF, pileDia_m: p.D_m, attachHeight_m: E_PIN, cableMbl_kN: R[p.raft].mbl }));
const caps = HV ? [] : twinPoints.map((p) => designTwinPileCap({ tension_kN: R[p.raft].T, loadFactor: LF, pileDia_m: p.D_m, attachHeight_m: E_PIN, cableMbl_kN: R[p.raft].mbl, pileBarDia_mm: p.rebarDia_mm }));
const slopeOf = (code: string) => { const c = cut.rows.find((q) => q.code === code); return c ? Math.max(0, c.slopeLow_deg, c.slopeNormal_deg, c.slopeHigh_deg) : 0; };
const eyes = HV ? [] : bases0.flatMap((b) => b.lines.map((l) => designShorePileHead({
  tension_kN: l.tension_kN, loadFactor: LF, pileDia_m: 0.35, attachHeight_m: bp.padeyeHeight_m, cableMbl_kN: R[l.raft].mbl,
  inclination_deg: slopeOf(l.code), anchorLengthLimit_mm: b.thickness_m * 1000 - 50
})));
const allHeads = [...heads, ...caps.map((c) => c.head), ...eyes];
const failed = [...heads.filter((h) => !h.ok).map(() => 'đầu cọc'), ...caps.filter((c) => !c.ok).map(() => 'đài cọc đôi'), ...eyes.filter((e) => !e.ok).map(() => 'tai neo đế')];
if (failed.length) throw new Error(`thiết kế chi tiết không đạt: ${failed.join(', ')}`);
// strength checks only: H-8 is the pin height, met exactly by construction
const maxUtil = (hs: { checks: { id: string; utilization: number }[] }[]) => Math.max(0, ...hs.flatMap((h) => h.checks.filter((c) => c.id !== 'H-8').map((c) => c.utilization)));
const holes = (hs: Head[]) => [...new Set(hs.map((h) => `Ø${h.holeDia_mm}`))].sort().join(' / ');
type Head = typeof allHeads[number];
const plateKg = (h: Head) => h.plateSide_mm ** 2 * h.plateThk_mm * 7850e-9;
const eyeKg = (h: Head) => h.padeyeWidth_mm * h.padeyeHeight_mm * h.padeyeThk_mm * 7850e-9;
const barsKg = (h: Head) => h.anchorBarCount * (h.anchorBarLength_mm / 1000) * (Math.PI * h.anchorBarDia_mm ** 2 / 4) * 7850e-6;
const shackleRange = (hs: Head[]) => [...new Set(hs.map((h) => h.shackleWll_t))].sort((a, b) => a - b).join(' / ');

// ---------------------------------------------------------------- summary sheet
const order = (q: number, w: number) => Math.ceil(q * (1 + w));
const rows: (string | number)[][] = [
  [`BẢNG THỐNG KÊ VẬT TƯ ĐẶT HÀNG HỆ NEO BÈ — ${ACTIVE_LAKE.name.toUpperCase()} (phương án chốt 12/10/2026 + cáp 2 nhánh chữ Y)`],
  [`Lấy số từ engine tính toán (gió ${d.wind_ms} m/s): ${nLines} dây (${nShore} dây bờ, ${nBed} dây đáy), ${T.shorePiles} cọc khoan nhồi D350${twinPoints.length ? ` tại ${piles.length} điểm neo bờ (${twinPoints.length} điểm cọc đôi)` : ''}, ${T.bases} đế BTCT + ${T.screws} vít xoắn. Mỗi dây chia 2 nhánh ${tx(BRIDLE.branch_m)} m tại tấm chia tam giác, góc giữa 2 nhánh ${BRIDLE.angle_deg}°, 2 bích bè cách nhau ${tx(cleatGap_m, 2)} m.`],
  ['Chưa gồm: kết cấu bè pin, phao nổi, hộp gia cường tai neo trên bè (xem bảng thống kê vật tư bè), khảo sát, thử tải, vận chuyển.'],
  [''],
  ['STT', 'TÊN HẠNG MỤC VẬT TƯ', 'QUY CÁCH KỸ THUẬT', 'ĐVT', 'KHỐI LƯỢNG THIẾT KẾ', 'HAO HỤT / DỰ PHÒNG', 'KHỐI LƯỢNG ĐẶT HÀNG', 'NGUỒN / GHI CHÚ']
];
let stt = 0;
const sec = (s: string, t: string) => rows.push([s, t]);
const it = (name: string, spec: string, unit: string, q: number, w: number | string, note: string, k = 1) => {
  stt++;
  const ord = typeof w === 'number' ? (unit === 'kg' ? Math.ceil(q * (1 + w)) : unit === 'md' || unit === 'm³' ? vn(q * (1 + w), k) : order(q, w)) : q;
  rows.push([stt, name, spec, unit, vn(q, k), typeof w === 'number' ? `${Math.round(w * 100)}%` : w, ord, note]);
};
sec('I', 'CÁP NEO POLYESTER (cắt theo bảng chiều dài, mỗi mắt cáp tính thêm ' + EYE_ROPE_M + ' m dây bện)');
for (const [c, L] of shoreMain) it(`Cáp chính dây bờ ${c}`, `Polyester ${c}, MBL ${MBL[c]} kN, bện 8–12 tao, chống UV`, 'md', L, WASTE, `${lines.filter((l) => l.type === 'SHORE' && l.mainCable === c).length} dây; từ tấm chia Y tới chốt cọc bờ (dài nhất ở MNC)`);
for (const [c, L] of bedMain) it(`Cáp chính dây đáy ${c}`, `Polyester ${c}, MBL ${MBL[c]} kN`, 'md', L, WASTE, `${lines.filter((l) => l.type === 'BED' && l.mainCable === c).length} dây; tới tai neo đế (dài nhất ở MNLKT). ĐO CAO ĐỘ ĐÁY trước khi cắt`);
for (const [c, L] of branches) it(`Cáp nhánh chữ Y ${c}`, `Polyester ${c}, MBL ${MBL[c]} kN, mỗi dây 2 nhánh × ${tx(BRIDLE.branch_m)} m chốt–chốt`, 'md', L, WASTE, `${lines.filter((l) => l.branchCable === c).length * 2} nhánh (${rafts.filter((r) => r.branch === c).map((r) => r.name).join(', ')}); xem sheet KiemTra_Nhanh`);
sec('II', 'CỌC KHOAN NHỒI D350 VEN BỜ');
it('Khoan tạo lỗ cọc D350 (có ống vách)', `D350, tổng dài mỗi cọc ${tx(piles[0].Ltotal_m)} m`, 'md', T.shoreLength_m, 0, `${T.shorePiles} cọc${twinPoints.length ? ` (${piles.length} điểm, cọc đôi ở ${[...new Set(twinPoints.map((p) => p.raft))].join(', ')})` : ''}; ${belowMndb}/${piles.length} điểm đất thấp hơn MNDB → thi công mùa nước thấp`);
it('Bê tông cọc', 'C25/30, đá 1×2, đổ tại chỗ bằng ống tremie', 'm³', T.shoreConcrete_m3, 0.05, 'Engine: thể tích hình học');
const cageGrades = [...new Set(piles.map((p) => p.cage.grade))].join(', ');
it(`Thép chủ lồng cọc ${cageGrades}`, [...new Set(piles.map((p) => p.cage.label))].join(', '), 'kg', pileMain_kg, 0.03, `Engine (theo bè: ${[...new Set(piles.map((p) => p.cage.label))].sort().join(', ')})`, 0);
it('Thép đai xoắn CB240-T', piles[0].cage.stirrupLabel, 'kg', pileStir_kg, 0.05, 'Engine', 0);
if (HV) {
  it('Bản nắp thép đầu cọc mạ kẽm', 'SS400 400×400×20', 'tấm', T.shorePiles, 0, `${ORDER_REF} — chưa có bản vẽ chi tiết đầu cọc`);
  it('Tai neo đầu cọc (padeye đơn)', 'SS400 t = 25, lỗ chốt Ø40; tim chốt cách mặt đất 0,1 m', 'cái', piles.length, 0, `Như trên; 1 cái mỗi điểm neo, phải chịu T_max của bè (tới ${tx(tMaxAll)} kN)`);
  it('Râu thép ngàm bản nắp', '4Φ25 L = 600 mỗi cọc', 'thanh', T.shorePiles * 4, 0.02, 'Như trên');
} else {
  const pileHeads = [...heads, ...caps.map((c) => c.head)], h0 = pileHeads[0];
  it('Bản mã đầu cọc mạ kẽm (cọc đơn và đài cọc đôi)', `SS400 ${h0.plateSide_mm}×${h0.plateSide_mm}×${h0.plateThk_mm}`, 'tấm', piles.length, 0.02,
    `${heads.length} đầu cọc đơn + ${caps.length} đài cọc đôi; thiết kế sơ bộ src/lib/calc/shorePileHead.ts (γ = ${LF}, T của bè), mức sử dụng lớn nhất ${tx(maxUtil(pileHeads), 2)}`);
  it('Tai neo đầu cọc / đài (padeye)', `SS400 t = ${h0.padeyeThk_mm}, rộng ${h0.padeyeWidth_mm}, lỗ chốt ${holes(pileHeads)} (= chốt ma-nê + 4 mm); tim chốt cách mặt đất ${Math.round(E_PIN * 1000)} mm; hàn góc ${h0.weldLeg_mm} mm hai phía`, 'cái', piles.length, 0.02,
    `1 cái mỗi điểm neo, chịu cả T của dây (tới ${tx(tMaxAll)} kN); ma-nê ${shackleRange(pileHeads)} t`);
  it('Thép neo bản mã vào bê tông', `${h0.anchorBarCount}Φ${h0.anchorBarDia_mm} CB400-V L = ${h0.anchorBarLength_mm} mỗi bản mã`, 'thanh', piles.length * h0.anchorBarCount, 0.02, 'Theo thiết kế đầu cọc (H-6, H-7)');
  if (caps.length) {
    const c0 = caps[0];
    it('Đài cọc đôi BTCT đổ tại chỗ', `C25/30; ${c0.length_mm}×${c0.width_mm}×${c0.depth_mm} (dài × rộng × cao), 2 cọc D350 cách ${c0.spacing_mm} mm; ${c0.faceBars.count}Φ${c0.faceBars.dia_mm} mỗi mặt chịu kéo, ${c0.topBottomBars.count}Φ${c0.topBottomBars.dia_mm} cấu tạo, đai Φ${c0.stirrup.dia_mm} a${c0.stirrup.spacing_mm}; thép chủ cọc móc 90° vào đài`, 'm³', sum(caps, (c) => c.concrete_m3), 0.05,
      `${caps.length} điểm cọc đôi; thiết kế sơ bộ src/lib/calc/twinPileCap.ts (TC-1…TC-4), mức sử dụng lớn nhất ${tx(maxUtil(caps), 2)}; đỉnh đài ngang mặt đất`);
    it('Thép đài cọc đôi', 'CB400-V Φ16, Φ12 + đai CB240-T Φ10', 'kg', sum(caps, (c) => c.steel_kg), 0.05, 'twinPileCap.ts', 0);
  }
}
sec('III', 'ĐẾ NEO ĐÁY BTCT + VÍT XOẮN');
it('Bê tông đế đúc sẵn', `C25/30 chống thấm; ${sizeText}; dày ${thkText} m`, 'm³', T.baseConcrete_m3, 0.03, `${T.bases} đế, đế nặng nhất ${tx(T.maxLift_t)} t khi cẩu`);
it('Thép bản đế', `Φ${bp.rebarDia_mm} a${Math.round(bp.rebarSpacing_m * 1000)}`, 'kg', T.baseRebar_kg, 0.03, 'Engine (kiểm tra SV-6)', 0);
it('Vít xoắn ống thép mạ kẽm', `Ống Ø${bp.tubeDia_m * 1000}×${bp.tubeThk_m * 1000}, ren Ø${bp.threadDia_m * 1000}, ngàm ${bp.screwLength_m} m; 4 vít/đế`, 'md', T.screwLength_m, 0.05, `${T.screws} vít`);
it('Nắp chụp khóa đầu vít vào đế', 'Ống lồng Ø114×6 + bản bích chặn', 'bộ', T.screws, 0, 'Chưa thiết kế chi tiết');
if (HV) {
  if (sharedBases) it('Tai neo đôi mặt đế', 'SS400 t = 25, 2 lỗ chốt Ø40', 'bộ', sharedBases, 0, 'Mỗi đế 2 dây của 2 bè; CHƯA thiết kế');
  if (T.bases > sharedBases) it('Tai neo đơn mặt đế', 'SS400 t = 25, 1 lỗ chốt Ø40', 'bộ', T.bases - sharedBases, 0, 'Đế một dây; CHƯA thiết kế');
} else {
  const e0 = eyes[0];
  const steepest = Math.max(...bases0.flatMap((b) => b.lines.map((l) => slopeOf(l.code))));
  it('Tai neo mặt đế (bản mã + tai + thép neo, 1 bộ mỗi dây)', `Bản mã SS400 ${e0.plateSide_mm}×${e0.plateSide_mm}×${e0.plateThk_mm}, tai t = ${e0.padeyeThk_mm} lỗ ${holes(eyes)}, ${e0.anchorBarCount}Φ${e0.anchorBarDia_mm} L = ${Math.min(...eyes.map((e) => e.anchorBarLength_mm))}–${Math.max(...eyes.map((e) => e.anchorBarLength_mm))} móc vào lưới đáy đế; đặt sẵn khi đúc đế`, 'bộ', eyes.length, 0.02,
    `${sharedBases} đế dùng chung có 2 bộ, ${T.bases - sharedBases} đế đơn có 1 bộ; tính cho lực lớn nhất của chính dây, cáp dốc tới ${tx(steepest, 0)}° (có thành phần nhổ); mức sử dụng lớn nhất ${tx(maxUtil(eyes), 2)}`);
}
sec('IV', 'PHỤ KIỆN CHẠC CHỮ Y TẠI BÈ');
for (const [w, n] of countBy((r) => r.lines, (r) => r.plate)) it(`Tấm chia tam giác 3 lỗ (delta plate)${rafts.some((r) => r.plate !== BRIDLE.plateWLL_t) ? ` WLL ${w} t` : ''}`, `Thép tấm mạ kẽm nhúng nóng, WLL ${w} t, 3 lỗ chốt`, 'cái', n, 0.02, '1 tấm mỗi dây; chọn thay cho vòng khuyên vì mỗi mắt cáp có lỗ riêng');
it('Ống bọc chống mài nhánh cáp tại bích', 'Ống bọc polyurethane / vải bọc cáp, dài 1 m', 'đoạn', 2 * nLines, 0.05, 'Chỗ nhánh cáp cọ mép phao, khung thép');
sec('V', 'MA-NÊ, KHUYÊN LÓT, TĂNG ĐƠ, XÍCH');
for (const [w, n] of countBy((r) => 2 * r.lines, (r) => r.mainShackle)) it(`Ma-nê thân cong WLL ${w} t (cáp chính)`, 'Thép rèn mạ kẽm, chốt an toàn (bulông + đai ốc + chốt chẻ)', 'cái', n, 0.03, '2 cái mỗi dây: tại tấm chia Y và tại cọc / đế; WLL ≥ T_max của bè');
for (const [w, n] of countBy((r) => 2 * r.lines, (r) => r.branchShackle)) it(`Ma-nê thân cong WLL ${w} t (nhánh)`, 'Thép rèn mạ kẽm, chốt an toàn', 'cái', n, 0.03, `2 cái mỗi dây, tại tấm chia; WLL ≥ ${tx(BRIDLE.unequal)} T. Đầu nhánh phía bè móc thẳng vào ma-nê chữ U Mibet làm bích (${2 * nLines} cái, đã tính ở bảng thống kê vật tư bè)`);
it('Khuyên lót mắt cáp (thimble)', 'Thép mạ kẽm rãnh sâu, theo cỡ cáp', 'cái', 6 * nLines, 0.05, '6 mắt mỗi dây: 2 cáp chính + 4 nhánh');
// turnbuckle and chain sized like the shackles: WLL >= T of the raft (10 t covers every Huổi Vanh raft)
const fitting = (r: typeof rafts[0]) => Math.max(10, wll(r.T));
const CHAIN: Record<number, string> = { 10: 'Ø18 (WLL 10 t)', 12: 'Ø22 (WLL 15 t)', 17: 'Ø26 (WLL 21,2 t)' };
const oneFitting = new Set(rafts.map(fitting)).size === 1;
for (const [w, n] of countBy((r) => r.shore, fitting)) it(`Tăng đơ đầu cọc bờ${oneFitting ? '' : ` WLL ${w} t`}`, `Thép rèn mạ kẽm, 2 đầu ngàm, WLL ≥ ${w} t, hành trình ±300 mm`, 'bộ', n, 0.02, 'Chỉnh độ căng dây bờ');
for (const [w, n] of countBy((r) => r.bed, fitting)) it(`Đoạn xích chỉnh chiều dài dây đáy${oneFitting ? '' : ` ${CHAIN[+w] ?? `WLL ≥ ${w} t`}`}`, `Xích Grade 80 ${CHAIN[+w] ?? `WLL ≥ ${w} t`} mạ kẽm, L = 1,2 m`, 'đoạn', n, 0.03, 'Giữa tấm chia Y và mắt cáp chính dây đáy — chỉnh trên mặt nước; dây bờ không cần (đã có tăng đơ)');
it('Phao treo cáp đáy (TÙY CHỌN)', `Phao xốp đặc chịu ngập ≥ ${maxDepth} m, sức nổi 15–20 kg`, 'quả', 0, 'tùy chọn', `Không bắt buộc, chưa tính toán; nếu dùng: ${nBed} quả, treo cách đế 3 m`);
it('Phao đánh dấu vị trí đế', 'Phao nhỏ có số hiệu, dây buộc riêng (không nối vào dây neo)', 'quả', T.bases, 0.1, 'Định vị khi thi công, bảo dưỡng; báo cho thuyền bè');
if (compensated) {
  sec('VI', 'THIẾT BỊ BÙ DAO ĐỘNG MỰC NƯỚC (BẮT BUỘC, CHƯA THIẾT KẾ — KHÔNG ĐẶT HÀNG THEO MỤC NÀY)');
  it('Thiết bị bù dao động mực nước mỗi dây', `Đối trọng treo / bộ tự căng giữ dây vừa căng ở mọi mực nước (${tx(LV.mnc_m, 2)}–${tx(LV.mnlkt_m, 2)} m); hành trình thu–xả: dây đáy tới ${tx(travel('BED'))} m, dây bờ tới ${tx(travel('SHORE'))} m; phải KHÓA được khi bão`, 'bộ', nLines, 'CHƯA thiết kế',
    `Lực dây ${tx(Math.min(...rafts.map((r) => r.T)))}–${tx(tMaxAll)} kN của engine CHỈ đúng khi có thiết bị này (cáp cắt cố định thì không cáp PES nào đủ — bảng so sánh ở Mục 4 trên web). Pre-FS gợi ý phao chỉ hướng ~2,5 t`);
}

// ---------------------------------------------------------------- detail sheets
const kt = [
  ['KIỂM TRA CÁP NHÁNH CHỮ Y (engine KHÔNG mô hình chạc Y — đây là kiểm tra riêng)'],
  [`Lực một nhánh khi chia đều: T / (2 cos ${BRIDLE.angle_deg / 2}°) = ${tx(1 / (2 * Math.cos(half)), 3)} T. Kiểm tra với ${BRIDLE.unequal} T (hai nhánh dài lệch nhau). Đạt khi HSAT ≥ ${BRIDLE.sfIntact} (đủ 2 nhánh) và ≥ ${BRIDLE.sfOneBranch} khi đứt 1 nhánh (nhánh còn lại chịu cả T).`],
  ['Bè', 'T dây (kN)', 'Cáp chính', 'MBL cáp chính (kN)', 'Lực nhánh chia đều (kN)', `Lực nhánh kiểm tra ${BRIDLE.unequal}T (kN)`, 'Cáp nhánh', 'MBL nhánh (kN)', 'HSAT đủ 2 nhánh', 'HSAT đứt 1 nhánh', 'Ma-nê cáp chính (t)', 'Ma-nê nhánh (t)', 'Kết luận'],
  ...rafts.map((r) => [r.name, vn(r.T), r.cable, r.mbl, vn(r.fEq), vn(r.fDes), r.branch, MBL[r.branch], vn(r.sfB, 2), vn(r.sf1, 2), r.mainShackle, r.branchShackle,
    r.sfB >= BRIDLE.sfIntact && r.sf1 >= BRIDLE.sfOneBranch ? 'ĐẠT' : 'KHÔNG ĐẠT'])
];
const ct = [
  ['CHIỀU DÀI CẮT CÁP TỪNG DÂY VỚI CHẠC CHỮ Y'],
  [`Cáp chính = khoảng cách thẳng từ tấm chia Y (cách mép bè ${tx(reach_m, 2)} m theo phương dây) tới chốt neo, ở mực nước làm dây dài nhất. Chưa gồm phần dây bện mắt (${EYE_ROPE_M} m mỗi mắt, cộng ở bảng tổng hợp).`],
  ['STT', 'Mã dây', 'Bè', 'Loại', 'Neo vào', 'Tầm vươn (m)', 'Mực nước bất lợi', 'Dài chốt–chốt không chạc Y (m)', 'Cáp chính chốt–chốt (m)', 'Cáp chính', '2 nhánh (m)', 'Cáp nhánh', 'Ghi chú'],
  ...lines.map((l) => [l.no, l.code, l.raft, l.type === 'SHORE' ? 'Cọc bờ' : 'Đế đáy', l.anchorId, vn(l.span_m, 2), l.governing, vn(l.cutLength_m, 2), vn(l.main_m, 2), l.mainCable, `2 × ${BRIDLE.branch_m}`, l.branchCable, [l.flag, l.note].filter(Boolean).join('; ')])
];
// ---------------------------------------------------------------- shore piles, bases, steel (detail sheets)
const BAR_KG_M = (d: number) => (Math.PI * d * d / 4) * 7850e-6; // kg/m of a round bar of d mm
const PLATE_KG = 0.4 * 0.4 * 0.02 * 7850; // cap plate 400x400x20
const ANCHOR_BARS_KG = 4 * 0.6 * BAR_KG_M(25); // 4Φ25 L600 per pile
const SCREW_KG_M = (Math.PI * (89 ** 2 - 79 ** 2) / 4) * 7850e-6; // tube Ø89x5
const pileRafts = d.rafts.map((r) => {
  const own = piles.filter((p) => p.raft === r.name);
  const n = sum(own, (p) => p.pileCount);
  return { r, own, n, L: own[0]?.Ltotal_m ?? 0, len: sum(own, (p) => p.pileCount * p.Ltotal_m), conc: sum(own, (p) => p.pileCount * p.cage.concreteVol_m3),
    main: sum(own, (p) => p.pileCount * p.cage.mainSteel_kg), stir: sum(own, (p) => p.pileCount * p.cage.stirrupSteel_kg) };
});
const cb = [
  ['CỌC KHOAN NHỒI D350 VEN BỜ — THỐNG KÊ THEO BÈ (engine, gió 20 m/s)'],
  ['Mỗi cọc: D350 đổ tại chỗ, lồng thép theo bè, đai xoắn Φ8 a150 CB240-T, mũ cọc + bản nắp 400×400×20 + tai neo + 4Φ25 L600 ngàm bản nắp.'],
  ['Bè', 'Số cọc', 'Đường kính (mm)', 'Dài 1 cọc (m)', 'Tổng dài khoan (m)', 'Bê tông (m³)', 'Lồng thép chủ', 'Thép chủ (kg)', 'Đai xoắn Φ8 CB240-T (kg)', 'Râu thép 4Φ25 L600 (kg)', 'Bản nắp SS400 (kg)', 'Tổng thép (kg)', 'T dây (kN)', 'BP-1 ngang', 'BP-2 uốn'],
  ...pileRafts.map(({ r, n, L, len, conc, main, stir }) => [r.name, n, 350, vn(L), vn(len), vn(conc, 2), `${r.cage} ${r.grade}`, Math.round(main), Math.round(stir), Math.round(n * ANCHOR_BARS_KG), Math.round(n * PLATE_KG),
    Math.round(main + stir + n * (ANCHOR_BARS_KG + PLATE_KG)), vn(r.tMax_kN), vn(r.bp1, 2), vn(r.bp2, 2)]),
  ['TỔNG', T.shorePiles, '', '', vn(T.shoreLength_m), vn(T.shoreConcrete_m3, 2), '', Math.round(pileMain_kg), Math.round(pileStir_kg), Math.round(T.shorePiles * ANCHOR_BARS_KG), Math.round(T.shorePiles * PLATE_KG),
    Math.round(pileMain_kg + pileStir_kg + T.shorePiles * (ANCHOR_BARS_KG + PLATE_KG)), '', '', '']
];
const ct2 = [
  [`CỌC KHOAN NHỒI — TỪNG ĐIỂM NEO BỜ (${piles.length} điểm, ${T.shorePiles} cọc)`], ['Thép, bê tông ghi cho MỘT cọc; điểm cọc đôi có 2 cọc giống nhau.'],
  ['STT', 'Mã cọc', 'Bè', 'X (m)', 'Y (m)', 'Cao độ mặt đất (m)', 'Số cọc', 'Dài cọc (m)', 'Lồng thép', 'Thép chủ (kg)', 'Đai xoắn (kg)', 'Bê tông (m³)'],
  ...piles.map((p, i) => [i + 1, p.pileId, p.raft, vn(p.x, 2), vn(p.y, 2), vn(p.z, 2), p.pileCount, vn(p.Ltotal_m), `${p.cage.label} ${p.cage.grade}`, vn(p.cage.mainSteel_kg), vn(p.cage.stirrupSteel_kg), vn(p.cage.concreteVol_m3, 3)])
];
const bases = d.schedule.bases;
const sizes = [...new Set(bases.map((b) => b.side_m))].sort((a, b) => a - b);
const de = [
  [`ĐẾ NEO ĐÁY BTCT + VÍT XOẮN — TỪNG ĐẾ (${bases.length} đế${sharedBases === bases.length ? ' dùng chung' : `: ${sharedBases} đế dùng chung, ${bases.length - sharedBases} đế một dây`})`],
  [`Bê tông C25/30 chống thấm; thép bản Φ${bp.rebarDia_mm} a${Math.round(bp.rebarSpacing_m * 1000)}; 4 vít ống Ø89×5 ren Ø105 ngàm ${bp.screwLength_m} m mỗi đế; tai neo đôi (đế dùng chung) / đơn. Cao độ đặt đế ${zText}.`],
  ['STT', 'Mã đế', 'Dây neo', 'Bè', 'Cạnh B (m)', 'Dày t (m)', 'Bê tông (m³)', 'Thép bản (kg)', 'Số vít', 'Dài vít (m)', 'Thép ống vít (kg)', 'Khối lượng cẩu (t)', 'Mức sử dụng lớn nhất'],
  ...bases.map((b, i) => [i + 1, b.baseId, b.code, b.raft, b.side_m, b.thickness_m, vn(b.concrete_m3, 2), vn(b.rebar_kg), b.screwCount, vn(b.screwLength_m, 2), Math.round(b.screwLength_m * SCREW_KG_M), vn(b.liftMass_t, 2),
    vn(Math.max(b.upliftUtil, b.slideUtil, b.overturnUtil, b.screwUtil), 2)]),
  ['TỔNG', `${bases.length} đế`, '', '', '', '', vn(T.baseConcrete_m3, 2), Math.round(T.baseRebar_kg), T.screws, vn(T.screwLength_m, 1), Math.round(T.screwLength_m * SCREW_KG_M), '', ''],
  [''],
  ['THEO CỠ ĐẾ', '', '', 'Số đế', 'Cạnh B (m)', 'Dày t (m)', 'Bê tông (m³)', 'Thép bản (kg)', 'Số vít'],
  ...sizes.map((s) => { const g = bases.filter((b) => b.side_m === s); return [`Đế ${tx(s, 2)} m`, '', '', g.length, s, g[0].thickness_m, vn(sum(g, (b) => b.concrete_m3), 2), Math.round(sum(g, (b) => b.rebar_kg)), sum(g, (b) => b.screwCount)]; })
];
// steel by type and diameter
const byDia = new Map<string, number>();
for (const p of piles) { const k = `${String(p.rebarDia_mm).padStart(3, '0')}|${p.cage.grade}`; byDia.set(k, (byDia.get(k) ?? 0) + p.pileCount * p.cage.mainSteel_kg); }
const oneGradePerDia = new Set([...byDia.keys()].map((k) => k.split('|')[0])).size === byDia.size;
const steelRows: (string | number)[][] = [
  ...[...byDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, kg]) => { const [dia, grade] = k.split('|'); return [`Thép chủ cọc Φ${+dia}${oneGradePerDia ? '' : ` ${grade}`}`, `${grade}, thanh vằn`, kg, 0.03, 'Lồng thép cọc khoan nhồi (engine)']; }),
  ...(HV ? [[`Thép râu ngàm bản nắp Φ25`, 'CB400-V, 4 thanh L600 mỗi cọc', T.shorePiles * ANCHOR_BARS_KG, 0.02, ORDER_REF]] : []),
  ['Thép đai xoắn Φ8', 'CB240-T, thép cuộn', pileStir_kg, 0.05, 'Cọc khoan nhồi (engine)'],
  [`Thép bản đế Φ${bp.rebarDia_mm}`, 'CB400-V (lưới đế)', T.baseRebar_kg, 0.03, 'Đế BTCT (engine)'],
  ['Thép ống vít Ø89×5', 'Ống thép mạ kẽm nhúng nóng', T.screwLength_m * SCREW_KG_M, 0.05, `${tx(SCREW_KG_M, 2)} kg/m`],
  ...(HV ? [['Thép tấm bản nắp 400×400×20', 'SS400 mạ kẽm', T.shorePiles * PLATE_KG, 0.02, `${tx(PLATE_KG, 1)} kg/tấm`]] : [
    ['Thép tấm bản mã + tai neo (đầu cọc, đài, đế)', 'SS400 mạ kẽm nhúng nóng', sum(allHeads, (h) => plateKg(h) + eyeKg(h)), 0.05, `${allHeads.length} bộ`],
    [`Thép neo bản mã Φ${allHeads[0].anchorBarDia_mm}`, 'CB400-V', sum(allHeads, barsKg), 0.03, `${allHeads.length} bộ × ${allHeads[0].anchorBarCount} thanh`],
    ...(caps.length ? [['Thép đài cọc đôi', 'CB400-V Φ16, Φ12; CB240-T Φ10', sum(caps, (c) => c.steel_kg), 0.05, 'twinPileCap.ts']] : [])
  ])
];
const steel = [
  ['TỔNG HỢP THÉP HỆ NEO THEO LOẠI VÀ ĐƯỜNG KÍNH'],
  [HV ? 'Chưa gồm: tai neo đầu cọc, tai neo của đế, nắp khóa vít, tấm chia tam giác (chưa có kích thước chi tiết).' : 'Chưa gồm: nắp khóa vít, tấm chia tam giác (chưa có kích thước chi tiết).'],
  ['Loại thép', 'Quy cách', 'Khối lượng thiết kế (kg)', 'Hao hụt', 'Khối lượng đặt hàng (kg)', 'Ghi chú'],
  ...steelRows.map(([a, b, kg, w, n]) => [a, b, Math.round(kg as number), `${Math.round((w as number) * 100)}%`, Math.ceil((kg as number) * (1 + (w as number))), n]),
  ['TỔNG', '', Math.round(sum(steelRows, (r) => r[2] as number)), '', sum(steelRows, (r) => Math.ceil((r[2] as number) * (1 + (r[3] as number)))), '']
];
sec(compensated ? 'VII' : 'VI', 'TỔNG THÉP HỆ NEO (chi tiết theo đường kính: sheet TongHop_Thep)');
for (const [a, b, kg, w, n] of steelRows) it(a as string, b as string, 'kg', kg as number, w as number, n as string, 0);
stt++; rows.push([stt, 'TỔNG THÉP HỆ NEO', 'Thép thanh + thép ống vít + thép tấm bản nắp', 'kg', Math.round(sum(steelRows, (r) => r[2] as number)), 'theo từng loại', sum(steelRows, (r) => Math.ceil((r[2] as number) * (1 + (r[3] as number)))), HV ? 'Chưa gồm tai neo, nắp khóa vít, tấm chia (chưa có kích thước chi tiết)' : 'Chưa gồm nắp khóa vít, tấm chia (chưa có kích thước chi tiết)']);
const headSheet = HV ? null : [
  ['KIỂM TRA ĐẦU CỌC, ĐÀI CỌC ĐÔI, TAI NEO MẶT ĐẾ (thiết kế sơ bộ, γ = ' + LF + ')'],
  ['Mức sử dụng = tải / khả năng; ≤ 1 là đạt. H-1…H-7: shorePileHead.ts (ma-nê, ép mặt, xé mép, hàn, thép neo, chiều dài neo); TC-1…TC-4: twinPileCap.ts. Mỗi dòng là một nhóm giống nhau (cùng bè, cùng loại).'],
  ['Loại', 'Bè', 'Số bộ', 'T (kN)', 'Góc cáp (°)', 'Ma-nê WLL (t)', 'Lỗ chốt (mm)', 'Thép neo L (mm)', 'H-1', 'H-3', 'H-4', 'H-5', 'H-6', 'H-7', 'TC-1', 'TC-2', 'TC-3', 'TC-4'],
  ...(() => {
    const out: (string | number)[][] = [];
    const u = (h: { checks: { id: string; utilization: number }[] }, id: string) => { const c = h.checks.find((k) => k.id === id); return c ? vn(c.utilization, 2) : ''; };
    const add = (kind: string, raft: string, items: { h: Head; T: number; inc: number; cap?: typeof caps[number] }[]) => {
      if (!items.length) return;
      const w = items.reduce((a, b) => (maxUtil([b.cap ?? b.h]) > maxUtil([a.cap ?? a.h]) ? b : a));
      const src = w.cap ?? w.h;
      out.push([kind, raft, items.length, vn(w.T), vn(w.inc, 0), w.h.shackleWll_t, w.h.holeDia_mm, w.h.anchorBarLength_mm,
        ...['H-1', 'H-3', 'H-4', 'H-5', 'H-6', 'H-7', 'TC-1', 'TC-2', 'TC-3', 'TC-4'].map((id) => u(src, id))]);
    };
    for (const r of rafts) {
      const single = piles.filter((p) => p.raft === r.name && p.pileCount === 1);
      add('Đầu cọc đơn', r.name, single.map((p) => ({ h: heads[piles.filter((q) => q.pileCount === 1).indexOf(p)], T: r.T, inc: 0 })));
      add('Đài cọc đôi', r.name, twinPoints.filter((p) => p.raft === r.name).map((p) => { const c = caps[twinPoints.indexOf(p)]; return { h: c.head, T: r.T, inc: 0, cap: c }; }));
      let k = 0; const own: { h: Head; T: number; inc: number }[] = [];
      for (const b of bases0) for (const l of b.lines) { const h = eyes[k++]; if (l.raft === r.name) own.push({ h, T: l.tension_kN, inc: slopeOf(l.code) }); }
      add('Tai neo mặt đế', r.name, own);
    }
    return out;
  })()
];
const notes = [
  ['GHI CHÚ VÀ GIẢ ĐỊNH'], [''],
  ['1', `Số cọc, đế, bê tông, thép, vít, chiều dài cáp lấy từ engine tính toán của web (${ACTIVE_LAKE.name}, phương án chốt 12/10/2026, gió ${d.wind_ms} m/s) — không gõ tay. Chạy lại: npx vite-node scripts/buildMooringOrderBOQ.ts -- <file.xlsx>${HV ? '' : ` --lake=${ACTIVE_LAKE.id}`}.`],
  ['2', `Cáp 2 nhánh chữ Y (Chủ đầu tư chọn 16/10/2026${HV ? '' : ' cho Huổi Vanh, áp dụng tạm cho ' + ACTIVE_LAKE.name}): tấm chia tam giác 3 lỗ WLL ${[...new Set(rafts.map((r) => r.plate))].sort((a, b) => a - b).join(' / ')} t; nhánh ${tx(BRIDLE.branch_m)} m, góc giữa 2 nhánh ${BRIDLE.angle_deg}°, 2 bích cách nhau ${tx(cleatGap_m, 2)} m. Lực trong cáp chính, cọc bờ, đế đáy không đổi so với tính toán. Engine CHƯA mô hình chạc Y: cỡ cáp nhánh và ma-nê kiểm tra riêng ở sheet KiemTra_Nhanh.`],
  ['3', `Mỗi mắt cáp bện tính thêm ${EYE_ROPE_M} m dây (GIẢ ĐỊNH, theo nhà cung cấp cáp); hao hụt cáp ${WASTE * 100}%.`],
  ['4', HV
    ? `Dây đáy: cao độ đáy hồ tại đế là GIẢ ĐỊNH (${zText}) — đo thực tế trước khi cắt; đoạn xích 1,2 m giữa tấm chia Y và cáp chính để chỉnh trên mặt nước.`
    : `Dây đáy: đế đặt trên mặt đất theo địa hình IFC (${zText}), CHƯA khảo sát — đo thực tế trước khi cắt; đoạn xích 1,2 m giữa tấm chia Y và cáp chính để chỉnh trên mặt nước.`],
  ['5', HV
    ? 'Bản nắp, tai neo, râu thép đầu cọc và nắp khóa vít, tai neo của đế lấy theo bảng order ngày 15/10 — CHƯA có bản vẽ / tính toán chi tiết.'
    : 'Đầu cọc, đài cọc đôi và tai neo mặt đế là THIẾT KẾ SƠ BỘ của web (shorePileHead.ts, twinPileCap.ts: ma-nê, ép mặt, xé mép lỗ, đường hàn, thép neo kéo + cắt, chiều dài neo, uốn / cắt / xoắn của đài) cho γ·T, T là lực lớn nhất của bè (đầu cọc) hoặc của chính dây (đế); bản vẽ chế tạo phải được kỹ sư kết cấu lập và kiểm tra. Nắp khóa vít vẫn CHƯA thiết kế.'],
  ...(HV
    ? [['6', 'Bỏ so với bảng order 15/10: vòng khuyên chủ (thay bằng tấm chia tam giác), xích ở 590 bích (chỉ giữ 64 đoạn cho dây đáy), phao treo chuyển thành tùy chọn. Sửa: cánh/ren vít Ø105 (không phải Ø250–300), thép bản đế theo engine, cọc 1.524,6 m.']]
    : [['6', `Dao động mực nước ${tx(LV.mnlkt_m - LV.mnc_m, 2)} m (${tx(LV.mnc_m, 2)}–${tx(LV.mnlkt_m, 2)} m): lực dây của engine là cân bằng tĩnh với giả định MỌI dây được giữ vừa căng ở mọi mực nước bằng thiết bị bù (mục VI) — thiết bị này CHƯA thiết kế, chưa có trong khối lượng đặt hàng. Tăng đơ và đoạn xích chỉ để chỉnh tinh, không thay được thiết bị bù.`],
       ['6b', `${twinPoints.length} điểm neo bờ dùng cọc đôi (${T.shorePiles} cọc / ${piles.length} điểm); đài nối đầu cọc đôi: thiết kế sơ bộ ở mục II. ${T.bases - sharedBases}/${T.bases} đế là đế một dây ở vùng nước trống; đế nặng nhất ${tx(T.maxLift_t)} t — cần sà lan / cẩu phù hợp.`],
       ['6c', 'Mặt bằng bè theo bản vẽ "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG" (đường bao tờ MB-B01-01; so với PA2 19/10 chỉ BÈ 4 và BÈ 6 đổi hình), số tấm pin từng bè theo bảng các tờ CT-BP — ĐÃ CHỐT 18.240 tấm (Chủ đầu tư 22/10/2026). Vị trí dây, cọc, đế là thiết kế của web (scripts/planMooringLayoutV2.mjs), CHƯA khảo sát.']]),
  ['7', 'Dây có cáp chính ngắn dưới 3 m (dây bờ rất ngắn) được ghi chú ở sheet ChieuDaiCat: rút nhánh còn 2,5 m hoặc neo thẳng không chạc Y.']
];

const wb = XLSX.utils.book_new();
const add = (aoa: (string | number)[][], name: string, cols: number[]) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map((wch) => ({ wch })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(rows, 'TONG_HOP_VAT_TU_ORDER', [6, 44, 52, 7, 14, 12, 14, 70]);
add(steel, 'TongHop_Thep', [30, 32, 16, 9, 16, 40]);
add(cb, 'CocBo_TheoBe', [8, 7, 9, 9, 12, 10, 14, 14, 14, 14, 12, 12, 9, 9, 9]);
add(ct2, 'CocBo_TungCoc', [6, 10, 8, 12, 12, 12, 9, 10, 10, 10, 10]);
add(de, 'DeDay_TungDe', [10, 10, 22, 16, 9, 8, 10, 11, 7, 9, 11, 11, 11]);
add(kt, 'KiemTra_Nhanh', [8, 10, 10, 12, 14, 14, 10, 10, 12, 12, 12, 12, 12]);
add(ct, 'ChieuDaiCat', [6, 10, 8, 8, 10, 10, 10, 14, 14, 10, 10, 10, 60]);
if (headSheet) add(headSheet, 'KiemTra_DauCoc_De', [16, 8, 7, 8, 9, 10, 9, 10, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
add(notes, 'GhiChu', [4, 170]);
fs.writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(JSON.stringify({ out, lines: nLines, reach_m: vn(reach_m, 3), cleatGap_m: vn(cleatGap_m, 2), shoreMain, bedMain, branches, shortMain: lines.filter((l) => l.flag).map((l) => `${l.code} ${vn(l.main_m, 2)}`), rafts: rafts.map((r) => `${r.name} ${r.branch} ${vn(r.sfB, 2)}/${vn(r.sf1, 2)} sh ${r.mainShackle}/${r.branchShackle}`) }, null, 1));
