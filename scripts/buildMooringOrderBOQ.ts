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
import { RAFT_TIES } from '../src/data/huoiVanhLayout';
import { STANDBY_SLACK_M } from '../src/lib/calc/mooringEquilibrium';

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
    mainShackle: wll(T), branchShackle: wll(fDes), plate: Math.max(BRIDLE.plateWLL_t, wll(T)), lockFailure: HUOI_VANH_RAFTS.find((q) => q.name === r.name)?.lockFailure, lines: r.lines, shore: r.shoreLines, bed: r.bedLines };
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
// The heads are designed for both lakes (Huổi Vanh used the order of 15/10 until the equilibrium tension of
// 2026-10-23 raised its line forces): single pile -> pile head, twin piles -> RC cap tying the two heads with the
// same padeye on it, lake-bed base -> padeye per line for the cable slope at MNLKT, anchor bars cut to the slab.
const LF = state.anchor.pileBendingLoadFactor ?? 1.2, E_PIN = state.anchor.shoreArm_e_m ?? 0.1;
const heads = piles.filter((p) => p.pileCount === 1).map((p) => designShorePileHead({ tension_kN: p.Tmax_kN, loadFactor: LF, pileDia_m: p.D_m, attachHeight_m: E_PIN, cableMbl_kN: R[p.raft].mbl }));
const caps = twinPoints.map((p) => designTwinPileCap({ tension_kN: p.Tmax_kN, loadFactor: LF, pileDia_m: p.D_m, attachHeight_m: E_PIN, cableMbl_kN: R[p.raft].mbl, pileBarDia_mm: p.rebarDia_mm }));
const slopeOf = (code: string) => { const c = cut.rows.find((q) => q.code === code); return c ? Math.max(0, c.slopeLow_deg, c.slopeNormal_deg, c.slopeHigh_deg) : 0; };
const eyes = bases0.flatMap((b) => b.lines.map((l) => designShorePileHead({
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
{
  const pileHeads = [...heads, ...caps.map((c) => c.head)], h0 = pileHeads[0];
  it('Bản mã đầu cọc mạ kẽm (cọc đơn và đài cọc đôi)', `SS400 ${h0.plateSide_mm}×${h0.plateSide_mm}×${h0.plateThk_mm}`, 'tấm', piles.length, 0.02,
    `${heads.length} đầu cọc đơn + ${caps.length} đài cọc đôi; thiết kế sơ bộ src/lib/calc/shorePileHead.ts (γ = ${LF}, T của loại cọc: lực của bè, hoặc lực thiết kế của cọc đơn ở điểm dây nhẹ), mức sử dụng lớn nhất ${tx(maxUtil(pileHeads), 2)}`);
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
{
  const e0 = eyes[0];
  const steepest = Math.max(...bases0.flatMap((b) => b.lines.map((l) => slopeOf(l.code))));
  it('Tai neo mặt đế (bản mã + tai + thép neo, 1 bộ mỗi dây)', `Bản mã SS400 ${e0.plateSide_mm}×${e0.plateSide_mm}×${e0.plateThk_mm}, tai t = ${e0.padeyeThk_mm} lỗ ${holes(eyes)}, ${e0.anchorBarCount}Φ${e0.anchorBarDia_mm} L = ${Math.min(...eyes.map((e) => e.anchorBarLength_mm))}–${Math.max(...eyes.map((e) => e.anchorBarLength_mm))} móc vào lưới đáy đế; hàn góc ${[...new Set(eyes.map((e) => e.weldLeg_mm))].sort((x, y) => x - y).map((w) => `${w} mm (${eyes.filter((e) => e.weldLeg_mm === w).length} bộ)`).join(', ')} hai phía; đặt sẵn khi đúc đế`, 'bộ', eyes.length, 0.02,
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
// Huổi Vanh: the lines are re-tensioned every adjustStep_m of level change — the chain must take up the whole
// seasonal change of the line (cut length − shortest chord) plus 0.5 m; a turnbuckle alone gives ±0.3 m
const adjusted = !compensated && state.line.levelCompensation === 'seasonal' && (state.line.adjustStep_m ?? 0) > 0;
const travelOf = (c: typeof cut.rows[0]) => c.cutLength_m - Math.min(c.chordLow_m, c.chordNormal_m, c.chordHigh_m);
const TURNBUCKLE_M = 0.6;
const halfUp = (v: number) => Math.ceil(v * 2 - 1e-9) / 2;
const bedChain_m = adjusted ? halfUp(travel('BED') + 0.5) : 1.2;
const longShore = adjusted ? cut.rows.filter((c) => c.type === 'SHORE' && travelOf(c) > TURNBUCKLE_M) : [];
const shoreChain_m = longShore.length ? halfUp(Math.max(...longShore.map(travelOf)) + 0.5) : 0;
for (const [w, n] of countBy((r) => r.shore, fitting)) it(`Tăng đơ đầu cọc bờ${oneFitting ? '' : ` WLL ${w} t`}`, `Thép rèn mạ kẽm, 2 đầu ngàm, WLL ≥ ${w} t, hành trình ±300 mm`, 'bộ', n, 0.02, 'Chỉnh độ căng dây bờ');
for (const [w, n] of countBy((r) => r.bed, fitting)) it(`Đoạn xích chỉnh chiều dài dây đáy${oneFitting ? '' : ` ${CHAIN[+w] ?? `WLL ≥ ${w} t`}`}`, `Xích Grade 80 ${CHAIN[+w] ?? `WLL ≥ ${w} t`} mạ kẽm, L = ${tx(bedChain_m)} m`, 'đoạn', n, 0.03,
  adjusted
    ? `Giữa tấm chia Y và mắt cáp chính dây đáy — chỉnh trên mặt nước mỗi khi mực nước đổi ${tx(state.line.adjustStep_m!)} m; dây đáy đổi chiều dài tới ${tx(travel('BED'))} m cả mùa (+0,5 m dư)`
    : 'Giữa tấm chia Y và mắt cáp chính dây đáy — chỉnh trên mặt nước; dây bờ không cần (đã có tăng đơ)');
if (longShore.length) {
  const wByRaft = new Map(rafts.map((r) => [r.name, fitting(r)]));
  const m = new Map<number, number>(); for (const c of longShore) m.set(wByRaft.get(c.raft)!, (m.get(wByRaft.get(c.raft)!) ?? 0) + 1);
  for (const [w, n] of [...m.entries()].sort((a, b) => a[0] - b[0])) it(`Đoạn xích chỉnh dây bờ ngắn${oneFitting ? '' : ` ${CHAIN[w] ?? `WLL ≥ ${w} t`}`}`, `Xích Grade 80 ${CHAIN[w] ?? `WLL ≥ ${w} t`} mạ kẽm, L = ${tx(shoreChain_m)} m`, 'đoạn', n, 0.03,
    `Dây bờ đổi chiều dài quá hành trình tăng đơ (${tx(TURNBUCKLE_M)} m) theo mực nước, tới ${tx(Math.max(...longShore.map(travelOf)))} m: thêm đoạn xích nối tiếp tăng đơ`);
}
it('Phao treo cáp đáy (TÙY CHỌN)', `Phao xốp đặc chịu ngập ≥ ${maxDepth} m, sức nổi 15–20 kg`, 'quả', 0, 'tùy chọn', `Không bắt buộc, chưa tính toán; nếu dùng: ${nBed} quả, treo cách đế 3 m`);
if (RAFT_TIES.length) {
  // tie ropes raft to raft (Hồ Bản Mòng BÈ 3 – BÈ 4): fixed length, cleat to cleat, smallest PES with MBL / design ≥ 3
  const tieDesign = HUOI_VANH_RAFTS.find((r) => r.mooringLayout?.group)?.mooringLayout?.group?.tieDesign_kN ?? 0;
  const tieCable = Object.keys(MBL).sort((p, q) => MBL[p] - MBL[q]).find((c) => MBL[c] / tieDesign >= 3) ?? 'PES-40';
  const tieLen = sum(RAFT_TIES, (t) => t.length_m + 2 * EYE_ROPE_M);
  it(`Cáp dây nối hai bè ${tieCable}`, `Polyester ${tieCable}, MBL ${MBL[tieCable]} kN; ${RAFT_TIES.length} dây ${tx(Math.min(...RAFT_TIES.map((t) => t.length_m)))}–${tx(Math.max(...RAFT_TIES.map((t) => t.length_m)))} m bích – bích`, 'md', tieLen, WASTE,
    `Nối ${[...new Set(RAFT_TIES.flatMap((t) => t.rafts))].join(' – ')} thay cho ${RAFT_TIES.length} đế dùng chung; mỗi dây kiểm tra ${tx(tieDesign, 0)} kN (GIẢ ĐỊNH), HSAT ${tx(MBL[tieCable] / tieDesign, 2)}; dài cố định, không cần bù mực nước`);
  it('Ma-nê dây nối hai bè', `Thép rèn mạ kẽm, WLL ≥ ${wll(tieDesign)} t`, 'cái', 2 * RAFT_TIES.length, 0.03, '2 cái mỗi dây nối, tại hai bích bè');
  it('Đệm chống va giữa hai bè (fender)', 'Đệm cao su / phao đệm treo mép bè, theo nhà sản xuất bè', 'bộ', RAFT_TIES.length, 0.1, 'Khi gió đẩy hai bè lại gần nhau dây nối chùng: đệm giữ hai bè không va nhau — CHƯA chọn loại');
}
it('Phao đánh dấu vị trí đế', 'Phao nhỏ có số hiệu, dây buộc riêng (không nối vào dây neo)', 'quả', T.bases, 0.1, 'Định vị khi thi công, bảo dưỡng; báo cho thuyền bè');
if (compensated) {
  sec('VI', 'THIẾT BỊ BÙ DAO ĐỘNG MỰC NƯỚC (BẮT BUỘC — CHỈ MỚI CÓ YÊU CẦU KỸ THUẬT, CHƯA CHỌN LOẠI: KHÔNG ĐẶT HÀNG THEO MỤC NÀY)');
  const lock = rafts.filter((r) => r.lockFailure);
  const pre = state.line.pretension_kN;
  const lockCables = [...new Set(rafts.map((r) => r.cable))].sort();
  it('Bộ tự căng / thu xả cáp mỗi dây (đối trọng hoặc tời)', `Giữ lực căng đặt ${tx(pre, 0)} kN ở mọi mực nước ${tx(LV.mnc_m, 2)}–${tx(LV.mnlkt_m, 2)} m; hành trình thu–xả: dây đáy ${tx(travel('BED'))} m, dây bờ ${tx(travel('SHORE'))} m, cộng ${tx(lock[0]?.lockFailure?.stroke_m ?? 3, 0)} m dư mỗi chiều`, 'bộ', nLines, 'CHƯA chọn loại',
    `Yêu cầu của mô hình cân bằng (mooringEquilibrium.ts): dây luôn vừa căng ở mọi mực nước. Đối trọng treo một mình KHÔNG giữ được bè: nếu không khóa, bè trôi ${tx(Math.min(...lock.map((r) => r.lockFailure!.drift_m)))}–${tx(Math.max(...lock.map((r) => r.lockFailure!.drift_m)))} m hết hành trình dư rồi lực dây vọt tới ${Math.min(...lock.map((r) => r.lockFailure!.maxTension_kN))}–${Math.max(...lock.map((r) => r.lockFailure!.maxTension_kN))} kN`);
  it('Bộ khóa / phanh cáp chống bão mỗi dây (fail-safe)', `Khóa cáp khi gió vượt ngưỡng, giữ tới lực đứt của cáp chính (${lockCables.map((c) => `${c}: ${MBL[c]} kN`).join('; ')}) để khóa không yếu hơn cáp; mất điện / mất tín hiệu thì tự khóa (lò xo ép phanh)`, 'bộ', nLines, 'CHƯA chọn loại',
    `Lực dây, đế, cọc của bảng này chỉ đúng khi khóa làm việc. Cần: tín hiệu gió + dự phòng, kiểm tra định kỳ, thử tải; khóa hỏng thì hệ số an toàn cáp chỉ còn ${tx(Math.min(...lock.map((r) => MBL[r.cable] / r.lockFailure!.maxTension_kN)))}–${tx(Math.max(...lock.map((r) => MBL[r.cable] / r.lockFailure!.maxTension_kN)))} (xem cảnh báo ở Header). Pre-FS gợi ý phao chỉ hướng ~2,5 t — chưa đánh giá`);
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
const SCREW_KG_M = (Math.PI * (89 ** 2 - 79 ** 2) / 4) * 7850e-6; // tube Ø89x5
// the designed head of every shore point: a pile head (single pile) or the cap of a twin-pile point
const headOf = new Map<string, { h: Head; cap_kg: number }>();
piles.filter((p) => p.pileCount === 1).forEach((p, i) => headOf.set(p.pileId, { h: heads[i], cap_kg: 0 }));
twinPoints.forEach((p, i) => headOf.set(p.pileId, { h: caps[i].head, cap_kg: caps[i].steel_kg }));
const pileRafts = d.rafts.map((r) => {
  const own = piles.filter((p) => p.raft === r.name);
  const n = sum(own, (p) => p.pileCount);
  const hd = own.map((p) => headOf.get(p.pileId)!);
  return { r, own, n, L: own[0]?.Ltotal_m ?? 0, len: sum(own, (p) => p.pileCount * p.Ltotal_m), conc: sum(own, (p) => p.pileCount * p.cage.concreteVol_m3),
    main: sum(own, (p) => p.pileCount * p.cage.mainSteel_kg), stir: sum(own, (p) => p.pileCount * p.cage.stirrupSteel_kg),
    bars: sum(hd, (x) => barsKg(x.h)), plate: sum(hd, (x) => plateKg(x.h) + eyeKg(x.h)), cap: sum(hd, (x) => x.cap_kg) };
});
const PR = (k: 'bars' | 'plate' | 'cap') => sum(pileRafts, (x) => x[k]);
const cb = [
  ['CỌC KHOAN NHỒI D350 VEN BỜ — THỐNG KÊ THEO BÈ (engine, gió 20 m/s)'],
  ['Mỗi cọc: D350 đổ tại chỗ, lồng thép theo bè, đai xoắn Φ8 a150 CB240-T. Mỗi điểm neo một đầu cọc (bản mã + tai neo + thép neo, shorePileHead.ts) hoặc, ở điểm cọc đôi, một đài BTCT nối hai đầu cọc (twinPileCap.ts).'],
  ['Bè', 'Số cọc', 'Đường kính (mm)', 'Dài 1 cọc (m)', 'Tổng dài khoan (m)', 'Bê tông (m³)', 'Lồng thép chủ', 'Thép chủ (kg)', 'Đai xoắn Φ8 CB240-T (kg)', 'Thép neo bản mã (kg)', 'Bản mã + tai neo SS400 (kg)', 'Thép đài cọc đôi (kg)', 'Tổng thép (kg)', 'T dây (kN)', 'BP-1 ngang', 'BP-2 uốn'],
  ...pileRafts.map(({ r, n, L, len, conc, main, stir, bars, plate, cap }) => [r.name, n, 350, vn(L), vn(len), vn(conc, 2), `${r.cage} ${r.grade}`, Math.round(main), Math.round(stir), Math.round(bars), Math.round(plate), Math.round(cap),
    Math.round(main + stir + bars + plate + cap), vn(r.tMax_kN), vn(r.bp1, 2), vn(r.bp2, 2)]),
  ['TỔNG', T.shorePiles, '', '', vn(T.shoreLength_m), vn(T.shoreConcrete_m3, 2), '', Math.round(pileMain_kg), Math.round(pileStir_kg), Math.round(PR('bars')), Math.round(PR('plate')), Math.round(PR('cap')),
    Math.round(pileMain_kg + pileStir_kg + PR('bars') + PR('plate') + PR('cap')), '', '', '']
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
  ['Thép đai xoắn Φ8', 'CB240-T, thép cuộn', pileStir_kg, 0.05, 'Cọc khoan nhồi (engine)'],
  [`Thép bản đế Φ${bp.rebarDia_mm}`, 'CB400-V (lưới đế)', T.baseRebar_kg, 0.03, 'Đế BTCT (engine)'],
  ['Thép ống vít Ø89×5', 'Ống thép mạ kẽm nhúng nóng', T.screwLength_m * SCREW_KG_M, 0.05, `${tx(SCREW_KG_M, 2)} kg/m`],
  ['Thép tấm bản mã + tai neo (đầu cọc, đài, đế)', 'SS400 mạ kẽm nhúng nóng', sum(allHeads, (h) => plateKg(h) + eyeKg(h)), 0.05, `${allHeads.length} bộ`],
  [`Thép neo bản mã Φ${allHeads[0].anchorBarDia_mm}`, 'CB400-V', sum(allHeads, barsKg), 0.03, `${allHeads.length} bộ × ${allHeads[0].anchorBarCount} thanh`],
  ...(caps.length ? [['Thép đài cọc đôi', 'CB400-V Φ16, Φ12; CB240-T Φ10', sum(caps, (c) => c.steel_kg), 0.05, 'twinPileCap.ts']] : [])
];
const steel = [
  ['TỔNG HỢP THÉP HỆ NEO THEO LOẠI VÀ ĐƯỜNG KÍNH'],
  ['Chưa gồm: nắp khóa vít, tấm chia tam giác (chưa có kích thước chi tiết).'],
  ['Loại thép', 'Quy cách', 'Khối lượng thiết kế (kg)', 'Hao hụt', 'Khối lượng đặt hàng (kg)', 'Ghi chú'],
  ...steelRows.map(([a, b, kg, w, n]) => [a, b, Math.round(kg as number), `${Math.round((w as number) * 100)}%`, Math.ceil((kg as number) * (1 + (w as number))), n]),
  ['TỔNG', '', Math.round(sum(steelRows, (r) => r[2] as number)), '', sum(steelRows, (r) => Math.ceil((r[2] as number) * (1 + (r[3] as number)))), '']
];
sec(compensated ? 'VII' : 'VI', 'TỔNG THÉP HỆ NEO (chi tiết theo đường kính: sheet TongHop_Thep)');
for (const [a, b, kg, w, n] of steelRows) it(a as string, b as string, 'kg', kg as number, w as number, n as string, 0);
stt++; rows.push([stt, 'TỔNG THÉP HỆ NEO', 'Thép thanh + thép ống vít + thép tấm bản nắp', 'kg', Math.round(sum(steelRows, (r) => r[2] as number)), 'theo từng loại', sum(steelRows, (r) => Math.ceil((r[2] as number) * (1 + (r[3] as number)))), 'Chưa gồm nắp khóa vít, tấm chia (chưa có kích thước chi tiết)']);
const headSheet = [
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
      add('Đầu cọc đơn', r.name, single.map((p) => ({ h: heads[piles.filter((q) => q.pileCount === 1).indexOf(p)], T: p.Tmax_kN, inc: 0 })));
      add('Đài cọc đôi', r.name, twinPoints.filter((p) => p.raft === r.name).map((p) => { const c = caps[twinPoints.indexOf(p)]; return { h: c.head, T: p.Tmax_kN, inc: 0, cap: c }; }));
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
    ? `Dây đáy: cao độ đáy hồ tại đế là GIẢ ĐỊNH (${zText}) — đo thực tế trước khi cắt; đoạn xích ${tx(bedChain_m)} m giữa tấm chia Y và cáp chính để chỉnh trên mặt nước.`
    : `Dây đáy: đế đặt trên mặt đất theo địa hình IFC (${zText}), CHƯA khảo sát — đo thực tế trước khi cắt; đoạn xích ${tx(bedChain_m)} m giữa tấm chia Y và cáp chính để chỉnh trên mặt nước.`],
  ['5', 'Đầu cọc, đài cọc đôi và tai neo mặt đế là THIẾT KẾ SƠ BỘ của web (shorePileHead.ts, twinPileCap.ts: ma-nê, ép mặt, xé mép lỗ, đường hàn, thép neo kéo + cắt, chiều dài neo, uốn / cắt / xoắn của đài) cho γ·T, T là lực lớn nhất của bè (đầu cọc) hoặc của chính dây (đế); bản vẽ chế tạo phải được kỹ sư kết cấu lập và kiểm tra. Nắp khóa vít vẫn CHƯA thiết kế.'],
  ...(HV
    ? [['6', `LỰC DÂY TÍNH LẠI 23/10/2026 bằng cân bằng tĩnh của bè trên từng dây theo mực nước (thay cách góc 30° + hệ số tập trung): T = ${tx(Math.min(...rafts.map((r) => r.T)))}–${tx(tMaxAll)} kN. Điều kiện BẮT BUỘC: chỉnh lại mọi dây cho vừa căng mỗi khi mực nước đổi ${tx(state.line.adjustStep_m ?? 0)} m (đoạn xích, tăng đơ ở mục V). Nếu cắt một lần rồi để nguyên: lực dây tới ${Math.max(...HUOI_VANH_RAFTS.map((r) => r.noAdjust?.maxTension_kN ?? 0))} kN, cáp không đủ hệ số an toàn.`],
       ['6b', `${twinPoints.length ? `${twinPoints.length} điểm neo bờ dùng cọc đôi (${T.shorePiles} cọc / ${piles.length} điểm, ở ${[...new Set(twinPoints.map((p) => p.raft))].join(', ')}); đài nối đầu cọc đôi: thiết kế sơ bộ ở mục II. ` : ''}Đầu cọc, tai neo đế thay cho chi tiết của bảng order 15/10 (bản nắp 400×400×20, tai neo lỗ Ø40) vì lực dây tăng. Dây ngắn hơn 4 m là dây dự phòng (cắt dài thêm ${tx(STANDBY_SLACK_M)} m, xem ChieuDaiCat). ${T.bases - sharedBases}/${T.bases} đế là đế một dây (mép nam BÈ 2, đầu trên BÈ 4, khe rộng). Vị trí đế theo chỉ đạo Chủ đầu tư 28/10/2026: mép nam BÈ 2, mép trên cùng BÈ 4; chỗ nào neo bờ được thì neo bờ, đế vít chỉ ở chỗ không neo bờ được (khe BÈ 2–4, giữa khe BÈ 2–3), dùng chung giữa hai bè khi được. Cọc đôi chỉ ở điểm có lực của chính dây vượt sức một cọc; các điểm khác cọc đơn.`],
       ['6c', `Mặt bằng bè theo bản vẽ "CHUGIAP-HOHUOIVANH ver 3 - Floor Plan - BỐ TRÍ PHAO BÈ" (27/10/2026): ${HUOI_VANH_RAFTS.length} bè ${HUOI_VANH_RAFTS.map((r) => r.name).join(', ')}, ${tx(HUOI_VANH_RAFTS.reduce((a, r) => a + r.area_m2, 0), 0)} m². Số tấm pin từng bè theo bảng các tờ CT-BE của bản vẽ "HOHUOIVANH.BỐ TRÍ BÈ PIN 281026": ${HUOI_VANH_RAFTS.map((r) => `${r.name} ${tx(r.solarPanelCount ?? 0, 0)}`).join(', ')}, tổng ${tx(HUOI_VANH_RAFTS.reduce((a, r) => a + (r.solarPanelCount ?? 0), 0), 0)} tấm. Hộp 40x60 gia cường tai neo trên bè: bảng thống kê vật tư bè pin và sơ đồ GC-01. Vị trí dây, cọc, đế là thiết kế của web (scripts/planMooringLayoutV2.mjs), CHƯA khảo sát.`]]
    : [['6', `Dao động mực nước ${tx(LV.mnlkt_m - LV.mnc_m, 2)} m (${tx(LV.mnc_m, 2)}–${tx(LV.mnlkt_m, 2)} m): lực dây của engine là cân bằng tĩnh với giả định MỌI dây được giữ vừa căng ở mọi mực nước bằng thiết bị bù (mục VI) — thiết bị này CHƯA thiết kế, chưa có trong khối lượng đặt hàng. Tăng đơ và đoạn xích chỉ để chỉnh tinh, không thay được thiết bị bù.`],
       ['6b', `${twinPoints.length} điểm neo bờ dùng cọc đôi (${T.shorePiles} cọc / ${piles.length} điểm); đài nối đầu cọc đôi: thiết kế sơ bộ ở mục II. ${T.bases - sharedBases}/${T.bases} đế là đế một dây ở vùng nước trống; đế nặng nhất ${tx(T.maxLift_t)} t — cần sà lan / cẩu phù hợp.`],
       ['6c', 'Mặt bằng bè theo bản vẽ "221026 BỐ TRÍ BÈ PIN HỒ BẢN MÒNG" (đường bao tờ MB-B01-01; so với PA2 19/10 chỉ BÈ 4 và BÈ 6 đổi hình), số tấm pin từng bè theo bảng các tờ CT-BP — ĐÃ CHỐT 18.240 tấm (Chủ đầu tư 22/10/2026). Vị trí dây, cọc, đế là thiết kế của web (scripts/planMooringLayoutV2.mjs), CHƯA khảo sát.']]),
  ['7', 'Dây có cáp chính ngắn dưới 3 m (dây bờ rất ngắn) được ghi chú ở sheet ChieuDaiCat: rút nhánh còn 2,5 m hoặc neo thẳng không chạc Y.']
];

const wb = XLSX.utils.book_new();
const add = (aoa: (string | number)[][], name: string, cols: number[]) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map((wch) => ({ wch })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(rows, 'TONG_HOP_VAT_TU_ORDER', [6, 44, 52, 7, 14, 12, 14, 70]);
add(steel, 'TongHop_Thep', [30, 32, 16, 9, 16, 40]);
add(cb, 'CocBo_TheoBe', [8, 7, 9, 9, 12, 10, 14, 14, 14, 14, 14, 12, 12, 9, 9, 9]);
add(ct2, 'CocBo_TungCoc', [6, 10, 8, 12, 12, 12, 9, 10, 10, 10, 10]);
add(de, 'DeDay_TungDe', [10, 10, 22, 16, 9, 8, 10, 11, 7, 9, 11, 11, 11]);
add(kt, 'KiemTra_Nhanh', [8, 10, 10, 12, 14, 14, 10, 10, 12, 12, 12, 12, 12]);
add(ct, 'ChieuDaiCat', [6, 10, 8, 8, 10, 10, 10, 14, 14, 10, 10, 10, 60]);
add(headSheet, 'KiemTra_DauCoc_De', [16, 8, 7, 8, 9, 10, 9, 10, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
add(notes, 'GhiChu', [4, 170]);
fs.writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(JSON.stringify({ out, lines: nLines, reach_m: vn(reach_m, 3), cleatGap_m: vn(cleatGap_m, 2), shoreMain, bedMain, branches, shortMain: lines.filter((l) => l.flag).map((l) => `${l.code} ${vn(l.main_m, 2)}`), rafts: rafts.map((r) => `${r.name} ${r.branch} ${vn(r.sfB, 2)}/${vn(r.sf1, 2)} sh ${r.mainShackle}/${r.branchShackle}`) }, null, 1));
