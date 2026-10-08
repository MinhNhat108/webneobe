/**
 * Standalone drawing of the bored shore piles (D350, cast in place) with the
 * construction method notes. NOT part of the web app.
 *
 *   npx vite-node scripts/buildShorePileDrawing.ts [outDir]
 *
 * Every number on the sheet comes from the calculation engine (pile schedule,
 * cage, head detail) so the drawing cannot drift from the design. Output:
 * docs/coc-ven-bo/coc_khoan_nhoi_ven_bo.dxf (millimetres) and
 * BIEN_PHAP_THI_CONG.md (the same notes).
 *
 * Vietnamese text: the file stays pure ASCII, every accented character is
 * written as a DXF Unicode escape (\U+XXXX) and all TEXT uses the style
 * "VN" (Arial TrueType), because the default txt.shx has no Vietnamese glyphs.
 *
 * Model space is in mm. The slope section is drawn 1:1; details are enlarged
 * (factor stated in each title) so one text height reads on the whole sheet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { buildPileSchedule, PileScheduleRow } from '../src/lib/io/pileSchedule';
import { buildShorePileHead } from '../src/lib/io/shorePileHeadDetail';
import { Pt, line, circle, closedPolyline, pair } from '../src/lib/io/dxfExport';
import { designWindCaveat } from '../src/lib/calc/designWind';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? path.join(here, '../docs/coc-ven-bo');

// ------------------------------------------------------------------ design data from the engine
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => {
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  return { raft, state: st, results: calculateProject(st) };
});
const schedule = buildPileSchedule(state, calculateProject(state), batch);
const shore = schedule.filter((r) => r.type === 'SHORE');
const head = buildShorePileHead(state, schedule, batch);
if (!head) throw new Error('shore piles are not round bored piles: this drawing does not apply');
const gamma = state.anchor.pileBendingLoadFactor ?? 1.2;
const sf = state.anchor.sfPileCapacity ?? 1.0;
const groupEff = state.anchor.pileGroupEfficiency ?? 0.9;
const cover_mm = state.anchor.pileRebarCover_mm ?? 50; // concrete face to main-bar centre
const armE_mm = Math.round((state.anchor.shoreArm_e_m ?? 0.1) * 1000);
const SPIRAL_MM = 8;
const vn = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

interface RaftRow { raft: string; points: number; piles: number; perPoint: number; D: number; Ltk: number; Ltot: number; bars: number; dia: number; label: string; grade: string; T: number; pullPerPile: number; util: number | null; conc: number; steel: number; clearCover: number; clearGap: number; }
const rows: RaftRow[] = [];
for (const b of batch) {
  const rs = shore.filter((r) => r.raft === b.raft.name);
  if (rs.length === 0) continue;
  const r: PileScheduleRow = rs[0];
  const bp = (b.results as any).checks?.find((c: any) => c.id === 'BP-2');
  const ringR = (r.D_m * 1000) / 2 - cover_mm;
  rows.push({
    raft: r.raft, points: rs.length, perPoint: r.pileCount, piles: rs.reduce((s, q) => s + q.pileCount, 0),
    D: Math.round(r.D_m * 1000), Ltk: r.Linput_m, Ltot: r.Ltotal_m,
    bars: r.cage.totalBars, dia: r.rebarDia_mm, label: r.cage.label, grade: r.cage.grade,
    T: r.Tmax_kN, pullPerPile: (r.Preq_kN / (sf > 0 ? sf : 1)) * gamma,
    util: typeof bp?.utilization === 'number' ? bp.utilization : null,
    conc: r.cage.concreteVol_m3, steel: r.cage.steel_kg,
    clearCover: cover_mm - r.rebarDia_mm / 2 - SPIRAL_MM,
    clearGap: (2 * Math.PI * ringR) / r.cage.totalBars - r.rebarDia_mm
  });
}
const totalPoints = rows.reduce((s, r) => s + r.points, 0);
const totalPiles = rows.reduce((s, r) => s + r.piles, 0);
const totalLen = rows.reduce((s, r) => s + r.piles * r.Ltot, 0);
const totalConc = rows.reduce((s, r) => s + r.piles * r.conc, 0);
const totalSteel = rows.reduce((s, r) => s + r.piles * r.steel, 0);
const D = rows[0].D;
const LtkMax = Math.max(...rows.map((r) => r.Ltk)), LtkMin = Math.min(...rows.map((r) => r.Ltk));
const minClearCover = Math.min(...rows.map((r) => r.clearCover)), maxClearCover = Math.max(...rows.map((r) => r.clearCover));
const minGap = Math.min(...rows.map((r) => r.clearGap));
const barCounts = [...new Set(rows.map((r) => r.bars))].sort((a, b) => a - b);

// ------------------------------------------------------------------ drawing helpers
const STYLE = 'VN';
const LY = { frame: 'CVB_00_KHUNG', ground: 'CVB_01_DIA_HINH', water: 'CVB_02_MUC_NUOC', pile: 'CVB_03_COC_BE_TONG', bar: 'CVB_04_COT_THEP', steel: 'CVB_05_BAN_MA_TAI_NEO', cable: 'CVB_06_CAP_BE', dim: 'CVB_07_KICH_THUOC', note: 'CVB_08_GHI_CHU', step: 'CVB_09_BUOC_THI_CONG' };
const LAYERS = [
  { name: LY.frame, color: 7 }, { name: LY.ground, color: 34 }, { name: LY.water, color: 5 }, { name: LY.pile, color: 8 }, { name: LY.bar, color: 1 },
  { name: LY.steel, color: 6 }, { name: LY.cable, color: 3 }, { name: LY.dim, color: 2 }, { name: LY.note, color: 7 }, { name: LY.step, color: 4 }
];
/** Keeps the file ASCII: every character outside printable ASCII becomes a DXF Unicode escape. */
const esc = (s: string) => [...s].map((ch) => { const c = ch.codePointAt(0)!; return c >= 0x20 && c <= 0x7e ? ch : `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`; }).join('');
const num = (v: number) => (Math.round(v * 1000) / 1000).toString();
const H = 180; // text height, mm of model space
const CW = 0.6; // average Arial character width / height, for layout estimates
let out = '';
const P = (x: number, y: number): Pt => ({ x, y });
const ln = (ly: string, x0: number, y0: number, x1: number, y1: number) => { out += line(ly, P(x0, y0), P(x1, y1)); };
const rc = (ly: string, x0: number, y0: number, x1: number, y1: number) => { out += closedPolyline(ly, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]); };
const ci = (ly: string, x: number, y: number, r: number) => { out += circle(ly, P(x, y), r); };
const tx = (ly: string, x: number, y: number, s: string, h = H) => {
  out += pair(0, 'TEXT') + pair(8, ly) + pair(10, num(x)) + pair(20, num(y)) + pair(30, '0.0') + pair(40, num(h)) + pair(1, esc(s)) + pair(7, STYLE);
};
/** Dimension drawn as a line with end ticks and a label. */
const dimV = (x: number, y0: number, y1: number, label: string) => { ln(LY.dim, x, y0, x, y1); ln(LY.dim, x - 120, y0, x + 120, y0); ln(LY.dim, x - 120, y1, x + 120, y1); tx(LY.dim, x + 160, (y0 + y1) / 2 - H / 2, label); };
const dimH = (y: number, x0: number, x1: number, label: string) => { ln(LY.dim, x0, y, x1, y); ln(LY.dim, x0, y - 120, x0, y + 120); ln(LY.dim, x1, y - 120, x1, y + 120); tx(LY.dim, (x0 + x1) / 2 - (label.length * H * CW) / 2, y + 140, label); };
const leader = (x0: number, y0: number, x1: number, y1: number, s: string) => { ln(LY.note, x0, y0, x1, y1); tx(LY.note, x1 + 80, y1 - H / 2, s); };
const title = (x: number, y: number, s: string, sub?: string) => { tx(LY.note, x, y, s, H * 1.6); ln(LY.note, x, y - 110, x + s.length * H * 1.6 * CW, y - 110); if (sub) tx(LY.note, x, y - 420, sub); };

// ------------------------------------------------------------------ A. section through the shore (1:1)
{
  const slope = 27, tan = Math.tan((slope * Math.PI) / 180);
  const gy = (x: number) => -tan * x;
  const yMNDB = -3000, yMNLKT = yMNDB + 1500, yMNC = yMNDB - 4500; // MNLKT 386.0, MNDB 384.5, MNC 380.0
  const L = LtkMax * 1000, r = D / 2, raftX = 14000;
  title(-7000, 5200, 'A. MẶT CẮT ĐIỂN HÌNH CỌC KHOAN NHỒI VEN BỜ (TỶ LỆ 1:1, SƠ ĐỒ)', `Độ dốc taluy vẽ minh họa ${slope}°; thực tế 20–35° theo khảo sát từng vị trí. Cao độ đầu cọc và tọa độ theo bảng tọa độ cọc của dự án.`);
  ln(LY.ground, -7000, gy(-7000), 17000, gy(17000));
  for (let x = -6500; x < 17000; x += 700) ln(LY.ground, x, gy(x), x - 250, gy(x) - 250); // ground hatch ticks
  tx(LY.ground, -6800, gy(-6800) + 250, 'Mặt đất tự nhiên (sét dẻo cứng: φ = 28°, c = 12 kPa, γ = 18 kN/m³ — GIẢ ĐỊNH, chưa có khoan khảo sát)');
  for (const [y, s] of [[yMNLKT, 'MNLKT 386,0'], [yMNDB, 'MNDB 384,5'], [yMNC, 'MNC 380,0']] as Array<[number, string]>) {
    const x0 = -y / tan; // where the level meets the ground
    ln(LY.water, x0, y, 17500, y); tx(LY.water, 15200, y + 80, s);
  }
  // pile, collar, head
  rc(LY.pile, -r, -L, r, head.pileTopAboveGround_mm);
  rc(LY.pile, -head.collarSide_mm / 2, head.pileTopAboveGround_mm - head.collarDepth_mm, head.collarSide_mm / 2, head.pileTopAboveGround_mm);
  ln(LY.bar, -r + cover_mm, -L + 100, -r + cover_mm, -50); ln(LY.bar, r - cover_mm, -L + 100, r - cover_mm, -50);
  ln(LY.pile, 0, -L - 300, 0, 600); // axis
  rc(LY.steel, -head.plateSide_mm / 2, head.pileTopAboveGround_mm, head.plateSide_mm / 2, head.pileTopAboveGround_mm + head.plateThk_mm);
  rc(LY.steel, -head.padeyeWidth_mm / 2, head.pileTopAboveGround_mm + head.plateThk_mm, head.padeyeWidth_mm / 2, head.pileTopAboveGround_mm + head.plateThk_mm + head.padeyeHeight_mm);
  // raft and cable
  rc(LY.cable, raftX, yMNDB - 150, raftX + 3200, yMNDB + 250);
  tx(LY.cable, raftX + 200, yMNDB + 350, 'Bè pin nổi (mép bè)');
  ln(LY.cable, 70, head.pinAboveGround_mm, raftX, yMNDB + 200);
  tx(LY.cable, 6200, -1050, 'Cáp neo polyester (PES) về điểm móc trên bè');
  dimV(-2600, -L, 0, `L_tk = ${vn(LtkMin)} – ${vn(LtkMax)} m (theo bảng E)`);
  leader(r, -L / 2, 1500, -L / 2 - 600, `Cọc khoan nhồi D${D}, bê tông B25 đổ tại chỗ`);
  leader(0, head.pinAboveGround_mm, 1500, 1900, `Tim chốt cáp cách mặt đất e ≤ ${armE_mm} mm (BẮT BUỘC)`);
  leader(head.collarSide_mm / 2, -100, 1500, 2700, `Mũ cọc ${head.collarSide_mm}×${head.collarSide_mm}×${head.collarDepth_mm} + bản mã + tai neo: xem chi tiết D`);
  leader(1200, gy(1200), 3200, 900, 'Sàn công tác tạm / bậc đất 2,0 × 2,0 m, hoàn trả và gia cố taluy sau thi công');
  tx(LY.note, -7000, -L - 900, 'Cọc đặt THẲNG ĐỨNG. Đầu cọc nên nằm trên MNLKT; nếu đầu cọc thấp hơn MNLKT thì bê tông mũ cọc và bản mã phải được bảo vệ chống gỉ.');
}

// ------------------------------------------------------------------ B. pile elevation with cage (enlarged 4:1, broken)
{
  const k = 4, ox = 26000, oy = 3000, r = (D / 2) * k, topLen = 1700 * k, botLen = 900 * k, gap = 500;
  title(ox - 1500, 5200, 'B. CẤU TẠO CỌC VÀ LỒNG THÉP (TỶ LỆ PHÓNG 4:1, CẮT NGẮN)', 'Lồng thép gia công sẵn thành một đoạn, không nối thép chủ (L ≤ 11,7 m).');
  const yTop = oy, yBreak1 = oy - topLen, yBreak2 = yBreak1 - gap, yBot = yBreak2 - botLen;
  for (const [a, b] of [[yTop, yBreak1], [yBreak2, yBot]]) { ln(LY.pile, ox - r, a, ox - r, b); ln(LY.pile, ox + r, a, ox + r, b); }
  ln(LY.pile, ox - r, yTop, ox + r, yTop); ln(LY.pile, ox - r, yBot, ox + r, yBot);
  for (const y of [yBreak1, yBreak2]) { ln(LY.pile, ox - r - 150, y - 60, ox, y + 60); ln(LY.pile, ox, y + 60, ox + r + 150, y - 60); }
  const bx = (D / 2 - cover_mm) * k;
  for (const [a, b] of [[yTop - 50 * k, yBreak1], [yBreak2, yBot + 100 * k]]) { ln(LY.bar, ox - bx, a, ox - bx, b); ln(LY.bar, ox + bx, a, ox + bx, b); ln(LY.bar, ox, a, ox, b); }
  for (let y = yTop - 100 * k; y > yBreak1 + 50; y -= 150 * k) ln(LY.bar, ox - bx, y, ox + bx, y - 75 * k); // spiral, pitch 150
  for (let y = yBreak2 - 50; y > yBot + 150 * k; y -= 150 * k) ln(LY.bar, ox - bx, y, ox + bx, y - 75 * k);
  for (const y of [yTop - 500 * k, yBot + 400 * k]) { ci(LY.bar, ox - r + 20 * k, y, 22 * k); ci(LY.bar, ox + r - 20 * k, y, 22 * k); } // spacers
  ln(LY.ground, ox - r - 2500, yTop - head.pileTopAboveGround_mm * k, ox - r, yTop - head.pileTopAboveGround_mm * k);
  ln(LY.ground, ox + r, yTop - head.pileTopAboveGround_mm * k, ox + r + 1500, yTop - head.pileTopAboveGround_mm * k);
  tx(LY.ground, ox - r - 2500, yTop - head.pileTopAboveGround_mm * k + 80, 'Mặt đất');
  for (const sx of [-1, 1]) ln(LY.steel, ox + (sx * head.anchorBarSpacing_mm * k) / 2, yTop, ox + (sx * head.anchorBarSpacing_mm * k) / 2, yTop - head.anchorBarLength_mm * k);
  leader(ox + (head.anchorBarSpacing_mm * k) / 2, yTop - 300 * k, ox + r + 1200, yTop - 300 * k, `${head.anchorBarCount}Φ${head.anchorBarDia_mm} neo bản mã, cắm ${head.anchorBarLength_mm} mm vào bê tông (nằm TRONG lồng thép)`);
  leader(ox + bx, yTop - 900 * k, ox + r + 1200, yTop - 900 * k, 'Thép chủ: n thanh trên vòng tròn, số thanh và đường kính theo bảng E');
  leader(ox + bx / 2, yTop - 1250 * k, ox + r + 1200, yTop - 1250 * k, `Đai xoắn Φ${SPIRAL_MM} a150 suốt chiều dài (cấu tạo, chưa tính lực cắt); hàn đính / buộc chắc vào thép chủ`);
  leader(ox + r - 20 * k, yTop - 500 * k, ox + r + 1200, yTop - 600 * k, 'Con kê bê tông dạng bánh xe: 3 con / mặt cắt, cách nhau ≤ 2,0 m');
  leader(ox + bx, yBot + 100 * k, ox + r + 1200, yBot + 300 * k, 'Thép chủ dừng cách đáy lỗ 100 mm');
  dimH(yBot - 500, ox - r, ox + r, `D${D}`);
  dimV(ox - r - 1500, yBot, yTop, 'L cọc = L_tk + đầu cọc (theo bảng E)');
}

// ------------------------------------------------------------------ C. cross-sections (enlarged 10:1)
{
  const k = 10, r = (D / 2) * k, ox0 = 45000, oy = 500;
  title(ox0 - r, 5200, 'C. MẶT CẮT NGANG THÂN CỌC (TỶ LỆ PHÓNG 10:1)', `a_s = ${cover_mm} mm từ mặt bê tông đến tim thép chủ (giá trị dùng trong tính toán uốn).`);
  barCounts.forEach((n, i) => {
    const cx = ox0 + i * (2 * r + 4500), cy = oy;
    const rr = rows.filter((q) => q.bars === n);
    const dias = [...new Set(rr.map((q) => q.dia))].sort((a, b) => a - b);
    ci(LY.pile, cx, cy, r);
    ci(LY.bar, cx, cy, (D / 2 - cover_mm) * k + (Math.max(...dias) / 2 + SPIRAL_MM / 2) * k); // spiral
    for (let j = 0; j < n; j++) {
      const t = Math.PI / 2 + (2 * Math.PI * j) / n;
      ci(LY.bar, cx + (D / 2 - cover_mm) * k * Math.cos(t), cy + (D / 2 - cover_mm) * k * Math.sin(t), (Math.max(...dias) / 2) * k);
    }
    for (let j = 0; j < 3; j++) { const t = Math.PI / 6 + (2 * Math.PI * j) / 3; ci(LY.bar, cx + (r - 15 * k) * Math.cos(t), cy + (r - 15 * k) * Math.sin(t), 14 * k); }
    tx(LY.note, cx - r, cy + r + 500, `MẶT CẮT ${i + 1}-${i + 1}: ${n} THANH`, H * 1.3);
    tx(LY.note, cx - r, cy - r - 400, `${n}Φ${dias.join(' / Φ')} — ${[...new Set(rr.map((q) => q.grade))].join(', ')}`);
    tx(LY.note, cx - r, cy - r - 750, `Áp dụng: ${rr.map((q) => q.raft).join(', ')}`);
    tx(LY.note, cx - r, cy - r - 1100, `Đai xoắn Φ${SPIRAL_MM} a150; 3 con kê / mặt cắt`);
    dimH(cy - r - 1700, cx - r, cx + r, `D${D}`);
  });
}

// ------------------------------------------------------------------ D. pile head (enlarged 10:1)
{
  const k = 10, ox = 33000, oy = -22000;
  const X = (v: number) => ox + v * k, Y = (v: number) => oy + v * k;
  const top = head.pileTopAboveGround_mm, half = head.collarSide_mm / 2, r = D / 2, plateTop = top + head.plateThk_mm, pin = head.pinAboveGround_mm;
  title(X(-900), Y(700), 'D. CHI TIẾT ĐẦU CỌC, BẢN MÃ VÀ TAI NEO CÁP (TỶ LỆ PHÓNG 10:1)', 'Chi tiết ĐỀ XUẤT, đã kiểm tra sơ bộ; bản vẽ gia công do kỹ sư kết cấu phát hành.');
  tx(LY.note, X(-half), Y(pin + 330), 'MẶT ĐỨNG (cắt dọc tim cọc, theo phương cáp)', H * 1.2);
  ln(LY.ground, X(-900), Y(0), X(-half), Y(0)); ln(LY.ground, X(half), Y(0), X(1100), Y(0)); tx(LY.ground, X(650), Y(-45), 'Mặt đất');
  rc(LY.pile, X(-half), Y(top - head.collarDepth_mm), X(half), Y(top));
  ln(LY.pile, X(-r), Y(top - head.collarDepth_mm), X(-r), Y(-800)); ln(LY.pile, X(r), Y(top - head.collarDepth_mm), X(r), Y(-800));
  ln(LY.pile, X(-r - 30), Y(-800), X(0), Y(-770)); ln(LY.pile, X(0), Y(-770), X(r + 30), Y(-800));
  rc(LY.steel, X(-half), Y(top), X(half), Y(plateTop));
  rc(LY.steel, X(-head.padeyeWidth_mm / 2), Y(plateTop), X(head.padeyeWidth_mm / 2), Y(plateTop + head.padeyeHeight_mm));
  ci(LY.steel, X(0), Y(pin), (head.holeDia_mm / 2) * k);
  for (const sx of [-1, 1]) ln(LY.steel, X((sx * head.anchorBarSpacing_mm) / 2), Y(top), X((sx * head.anchorBarSpacing_mm) / 2), Y(top - head.anchorBarLength_mm));
  for (const sx of [-1, 1]) ln(LY.bar, X(sx * (r - cover_mm)), Y(top - 50), X(sx * (r - cover_mm)), Y(-780));
  ci(LY.cable, X(75), Y(pin), 55 * k); ln(LY.cable, X(130), Y(pin), X(1100), Y(pin - 110));
  tx(LY.cable, X(700), Y(pin + 10), 'Cáp về phía bè');
  leader(X(75), Y(pin + 55), X(half + 150), Y(pin + 230), `Ma-ní móng ngựa WLL ${vn(head.shackleWll_t, head.shackleWll_t % 1 === 0 ? 0 : 1)} T, chốt Φ${head.shacklePin_mm}`);
  leader(X(head.padeyeWidth_mm / 2), Y(plateTop + 30), X(half + 150), Y(plateTop + 150), `Tai neo t = ${head.padeyeThk_mm}, ${head.padeyeWidth_mm}×${head.padeyeHeight_mm}, lỗ Φ${head.holeDia_mm}; hàn góc hf = ${head.weldLeg_mm} hai mặt, hàn kín`);
  leader(X(half), Y(top + 10), X(half + 150), Y(top - 110), `Bản mã ${head.plateSide_mm}×${head.plateSide_mm}×${head.plateThk_mm}, thép SS400`);
  leader(X(half), Y(top - 200), X(half + 150), Y(top - 230), `Mũ cọc bê tông B25 ${head.collarSide_mm}×${head.collarSide_mm}, sâu ${head.collarDepth_mm}, đổ liền khối với đầu cọc`);
  leader(X(head.anchorBarSpacing_mm / 2), Y(top - 450), X(half + 150), Y(top - 400), `${head.anchorBarCount}Φ${head.anchorBarDia_mm} CB400-V hàn vào bản mã (hàn lỗ / hàn góc chu vi), neo ${head.anchorBarLength_mm} mm`);
  leader(X(r - cover_mm), Y(-650), X(half + 150), Y(-600), 'Thép chủ cọc kéo lên đến cách đỉnh cọc 50 mm');
  ln(LY.dim, X(-half - 150), Y(0), X(-half - 150), Y(pin)); ln(LY.dim, X(-half - 190), Y(0), X(-half - 110), Y(0)); ln(LY.dim, X(-half - 190), Y(pin), X(-half - 110), Y(pin));
  tx(LY.dim, X(-half - 850), Y(pin / 2 - 10), `e = ${pin} mm`);
  // plan
  const px = X(2900), py = Y(-150);
  tx(LY.note, px - half * k, py + (half + 110) * k, 'MẶT BẰNG ĐỈNH CỌC', H * 1.2);
  rc(LY.pile, px - half * k, py - half * k, px + half * k, py + half * k);
  ci(LY.pile, px, py, r * k);
  rc(LY.steel, px - (head.padeyeWidth_mm / 2) * k, py - (head.padeyeThk_mm / 2) * k, px + (head.padeyeWidth_mm / 2) * k, py + (head.padeyeThk_mm / 2) * k);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) ci(LY.steel, px + ((sx * head.anchorBarSpacing_mm) / 2) * k, py + ((sy * head.anchorBarSpacing_mm) / 2) * k, (head.anchorBarDia_mm / 2) * k);
  ln(LY.cable, px + (head.padeyeWidth_mm / 2) * k, py, px + (half + 280) * k, py); tx(LY.cable, px + (half + 40) * k, py + 30 * k, 'Phương cáp');
  tx(LY.note, px - half * k, py - (half + 60) * k, `Tai neo đặt ĐÚNG PHƯƠNG CÁP (theo góc phương vị trong bảng tọa độ). Thép neo trên ô vuông ${head.anchorBarSpacing_mm}×${head.anchorBarSpacing_mm}.`);
  // checks
  let y = Y(-1000);
  tx(LY.note, X(-900), y, `KIỂM TRA SƠ BỘ — lực kéo thiết kế ${vn(head.designPull_kN)} kN (cọc bờ chịu lực lớn nhất × hệ số ${vn(gamma)})`, H * 1.2);
  for (const c of head.checks) { y -= 380; tx(LY.note, X(-900), y, `${c.id}  ${c.label}: ${vn(c.demand, c.unit === '-' ? 2 : 1)} / ${vn(c.capacity, c.unit === '-' ? 2 : 1)} ${c.unit === '-' ? '' : c.unit}  →  ${vn(c.utilization, 2)}  ${c.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`); }
}

// ------------------------------------------------------------------ E. schedule table
{
  const ox = -7000, oy = -11500, rowH = 420;
  const cols: Array<[string, number]> = [['Bè', 1500], ['Điểm neo', 1400], ['Cọc/điểm', 1400], ['Số cọc', 1200], ['D (mm)', 1200], ['L_tk (m)', 1400], ['Thép chủ', 1500], ['Mác thép', 1500], ['T dây (kN)', 1600], ['γ·T/cọc (kN)', 2000], ['HSSD uốn', 1500], ['BT/cọc (m³)', 1800], ['Thép/cọc (kg)', 1900]];
  const W = cols.reduce((s, c) => s + c[1], 0);
  title(ox, oy + 1100, `E. BẢNG THỐNG KÊ CỌC KHOAN NHỒI VEN BỜ (mặt bằng ${rows.length} bè, bản 08/10/2026)`, `γ = ${vn(gamma)}; cọc đôi: mỗi cọc chịu T / (2 × ${vn(groupEff)}). HSSD uốn = γ·M_max / M_rd (TCVN 5574:2018, hướng lồng thép bất lợi nhất).`);
  const cells = (y: number, vals: string[]) => { let x = ox; vals.forEach((v, i) => { tx(LY.note, x + 80, y + 110, v); x += cols[i][1]; }); };
  cells(oy, cols.map((c) => c[0]));
  rows.forEach((r, i) => cells(oy - (i + 1) * rowH, [r.raft, String(r.points), String(r.perPoint), String(r.piles), String(r.D), vn(r.Ltk), r.label, r.grade, vn(r.T), vn(r.pullPerPile), r.util === null ? '–' : vn(r.util, 2), vn(r.conc, 2), vn(r.steel, 0)]));
  const yEnd = oy - (rows.length + 1) * rowH;
  cells(yEnd, ['TỔNG', String(totalPoints), '', String(totalPiles), '', `${vn(totalLen)} m`, '', '', '', '', '', `${vn(totalConc)} m³`, `${vn(totalSteel / 1000)} tấn`]);
  for (let i = 0; i <= rows.length + 2; i++) ln(LY.frame, ox, oy + rowH - i * rowH, ox + W, oy + rowH - i * rowH);
  let x = ox; ln(LY.frame, x, oy + rowH, x, yEnd);
  for (const c of cols) { x += c[1]; ln(LY.frame, x, oy + rowH, x, yEnd); }
}

// ------------------------------------------------------------------ F. construction sequence (schematic panels)
const STEPS: Array<[string, string[]]> = [
  ['1. ĐỊNH VỊ, LÀM SÀN CÔNG TÁC', ['Trắc đạc tim cọc theo bảng tọa độ (sai số ≤ 75 mm).', 'Đào bậc / đắp sàn tạm 2,0 × 2,0 m, phẳng, chắc.', 'Làm rãnh chặn nước mặt phía trên và bờ bao phía hồ.']],
  ['2. KHOAN TẠO LỖ + ỐNG VÁCH TẠM', [`Khoan mini (gầu xoắn / guồng xoắn) D${D}, thẳng đứng.`, 'Ống vách thép tạm D400 dài 1,0–1,5 m giữ miệng lỗ.', 'Đất khoan gom gọn, KHÔNG đẩy xuống hồ.']],
  ['3. VỆ SINH VÀ NGHIỆM THU LỖ', ['Đo chiều sâu bằng thước dây: ≥ L_tk theo bảng.', 'Vét sạch đất rơi đáy lỗ (cặn lắng ≤ 50 mm).', 'Độ thẳng đứng ≤ 1%. Lỗ sạt thành: dừng, báo thiết kế.']],
  ['4. HẠ LỒNG THÉP', ['Lồng thép gia công sẵn, nghiệm thu trước khi hạ.', 'Gắn con kê bánh xe; hạ thẳng, không xoắn, không chạm thành.', 'Treo lồng cách đáy lỗ 100 mm, cố định tim.']],
  ['5. ĐỔ BÊ TÔNG', ['Đổ trong vòng 4 giờ sau khi khoan xong.', 'Lỗ có nước: ống đổ (tremie) D114–140, miệng ống ngập ≥ 1,5 m.', 'Lỗ khô: ống đổ / máng vòi, rơi tự do ≤ 1,5 m. Đổ liên tục.']],
  ['6. RÚT ỐNG VÁCH, ĐẦU CỌC', ['Rút ống vách khi bê tông còn dẻo, bù bê tông đỉnh cọc.', 'Đổ cao hơn cao độ thiết kế, loại bỏ lớp bê tông xấu.', 'Bảo dưỡng ẩm ≥ 7 ngày.']],
  ['7. MŨ CỌC, BẢN MÃ, TAI NEO', [`Đặt cụm bản mã + ${head.anchorBarCount}Φ${head.anchorBarDia_mm} bằng dưỡng gá, tai neo đúng phương cáp.`, `Đổ mũ cọc ${head.collarSide_mm}×${head.collarSide_mm}×${head.collarDepth_mm} liền khối với đầu cọc.`, `Kiểm tra: tim lỗ chốt cách mặt đất ≤ ${armE_mm} mm.`]],
  ['8. HOÀN TRẢ, LẮP CÁP', ['Lắp ma-ní và cáp khi bê tông đạt ≥ 90% cường độ (hoặc 28 ngày).', 'Hoàn trả đất, đầm chặt quanh cọc, gia cố / trồng cỏ taluy.', 'Thử kéo ngang cọc thử theo đề cương được duyệt.']]
];
{
  const ox = -7000, oy = -19500, pw = 7000, ph = 7400;
  title(ox, oy + 1100, 'F. TRÌNH TỰ THI CÔNG CỌC KHOAN NHỒI VEN BỜ (SƠ ĐỒ NGUYÊN LÝ, KHÔNG THEO TỶ LỆ)');
  STEPS.forEach(([name, linesOfText], i) => {
    const col = i % 4, row = Math.floor(i / 4), x0 = ox + col * pw, y0 = oy - row * ph;
    rc(LY.frame, x0, y0 - ph + 300, x0 + pw - 300, y0);
    tx(LY.step, x0 + 150, y0 - 350, name, H * 1.15);
    const cx = x0 + 2600, gy = y0 - 1700, depth = 3300, w = 420; // schematic: ground at gy, hole below
    const g = (x: number) => gy - 0.35 * (x - cx);
    ln(LY.ground, x0 + 300, g(x0 + 300), cx - 900, g(cx - 900)); ln(LY.ground, cx - 900, gy, cx + 900, gy); ln(LY.ground, cx + 900, gy, x0 + pw - 600, g(x0 + pw - 600) + 315);
    ln(LY.ground, cx - 900, g(cx - 900), cx - 900, gy); // bench cut
    if (i >= 1) { ln(LY.pile, cx - w / 2, gy, cx - w / 2, gy - depth); ln(LY.pile, cx + w / 2, gy, cx + w / 2, gy - depth); ln(LY.pile, cx - w / 2, gy - depth, cx + w / 2, gy - depth); }
    if (i === 0) { ln(LY.step, cx, gy, cx, gy + 700); ln(LY.step, cx - 200, gy + 700, cx + 200, gy + 700); tx(LY.step, cx + 250, gy + 500, 'Cọc tim'); }
    if (i >= 1 && i <= 4) { rc(LY.step, cx - w / 2 - 60, gy - 900, cx - w / 2, gy + 250); rc(LY.step, cx + w / 2, gy - 900, cx + w / 2 + 60, gy + 250); } // casing
    if (i === 1) { ln(LY.step, cx, gy + 1300, cx, gy - depth + 200); for (let y = gy - 300; y > gy - depth + 200; y -= 350) ln(LY.step, cx - 150, y, cx + 150, y - 150); tx(LY.step, cx + 300, gy + 1000, 'Cần khoan xoắn'); }
    if (i === 2) { ln(LY.dim, cx + 900, gy, cx + 900, gy - depth); ln(LY.dim, cx + 800, gy - depth, cx + 1000, gy - depth); tx(LY.dim, cx + 1000, gy - depth / 2, '≥ L_tk'); }
    if (i >= 3) { for (const sx of [-1, 1]) ln(LY.bar, cx + sx * (w / 2 - 70), gy - 60, cx + sx * (w / 2 - 70), gy - depth + 120); for (let y = gy - 200; y > gy - depth + 150; y -= 300) ln(LY.bar, cx - w / 2 + 70, y, cx + w / 2 - 70, y - 150); }
    if (i === 4) { rc(LY.step, cx - 50, gy - depth + 500, cx + 50, gy + 900); ln(LY.step, cx - 300, gy + 1200, cx - 50, gy + 900); ln(LY.step, cx + 300, gy + 1200, cx + 50, gy + 900); ln(LY.step, cx - 300, gy + 1200, cx + 300, gy + 1200); tx(LY.step, cx + 400, gy + 1000, 'Phễu + ống đổ'); }
    if (i >= 4) { const fill = i === 4 ? gy - depth + 1500 : gy; for (let y = gy - depth + 150; y < fill; y += 220) ln(LY.pile, cx - w / 2 + 20, y, cx + w / 2 - 20, y); }
    if (i >= 6) { rc(LY.pile, cx - 260, gy - 330, cx + 260, gy + 30); rc(LY.steel, cx - 260, gy + 30, cx + 260, gy + 70); rc(LY.steel, cx - 130, gy + 70, cx + 130, gy + 260); }
    if (i === 7) { ln(LY.cable, cx + 60, gy + 160, x0 + pw - 700, gy - 900); tx(LY.cable, cx + 1300, gy - 250, 'Cáp về bè'); }
    linesOfText.forEach((s, j) => tx(LY.note, x0 + 150, y0 - ph + 1500 - j * 340, s, H * 0.9));
  });
}

// ------------------------------------------------------------------ G. notes
const NOTES: Array<[string, string[]]> = [
  ['1. PHẠM VI VÀ SỐ LIỆU THIẾT KẾ', [
    `Cọc khoan nhồi tròn D${D} đổ tại chỗ, ${totalPiles} cọc tại ${totalPoints} điểm neo ven bờ, tổng chiều dài ${vn(totalLen)} m, bê tông ${vn(totalConc)} m³, thép khoảng ${vn(totalSteel / 1000)} tấn.`,
    `Tải trọng: gió tính toán V = ${vn(state.env.windSpeed_ms, 0)} m/s, giàn pin nghiêng 12°. Lực căng dây và số thép từng bè theo bảng E. Hệ số tải trọng uốn cọc γ = ${vn(gamma)}.`,
    designWindCaveat(state.env.windSpeed_ms) ? `CHÚ Ý: ${designWindCaveat(state.env.windSpeed_ms)}` : 'Gió tính toán không thấp hơn gió tiêu chuẩn TCVN 2737:2023 vùng II-B.',
    'Sức chịu tải ngang theo Broms với đất sét dẻo cứng φ = 28°, c = 12 kPa, γ = 18 kN/m³: GIẢ ĐỊNH, chưa có khoan khảo sát địa chất tại vị trí cọc.',
    'Uốn cọc theo TCVN 5574:2018 với lồng thép ở hướng bất lợi nhất (lồng không định hướng khi thả vào lỗ).',
    rows.some((r) => r.perPoint > 1) ? `Cọc đôi (${rows.filter((r) => r.perPoint > 1).map((r) => r.raft).join(', ')}): 2 cọc cách nhau ≥ 3D = ${vn((3 * D) / 1000, 2)} m, vuông góc phương cáp. Đài / bích neo chung CHƯA THIẾT KẾ.` : ''
  ]],
  ['2. VẬT LIỆU', [
    'Bê tông cọc và mũ cọc: B25 (M350), đá 1×2 (D_max 20 mm), độ sụt 16–18 cm khi đổ qua ống, 10–14 cm khi lỗ khô đổ trực tiếp. Lấy mẫu thử nén mỗi đợt đổ.',
    `Thép chủ: CB400-V${rows.some((r) => r.grade !== 'CB400-V') ? ` (riêng ${rows.filter((r) => r.grade !== 'CB400-V').map((r) => `${r.raft}: ${r.grade}`).join(', ')})` : ''}, theo TCVN 1651-2:2018. Thép đai xoắn Φ8 CB240-T. Không hàn nối thép chủ tại công trường.`,
    `Bản mã, tai neo: thép tấm SS400 / CT38; que hàn E42. Ma-ní móng ngựa WLL ${vn(head.shackleWll_t, head.shackleWll_t % 1 === 0 ? 0 : 1)} T có chốt an toàn, mạ kẽm nhúng nóng.`,
    'Bản mã, tai neo và đường hàn: mạ kẽm nhúng nóng hoặc sơn epoxy 2 lớp (làm việc trong vùng mực nước dao động).'
  ]],
  ['3. YÊU CẦU BẮT BUỘC CỦA THIẾT KẾ', [
    `Tim chốt cáp cách mặt đất hoàn thiện ≤ ${armE_mm} mm. Móc cáp cao hơn thì mômen uốn cọc tăng và số thép trong bảng E KHÔNG còn đủ.`,
    'Không đào hạ thấp mặt đất quanh cọc sau khi thi công. Nếu taluy bị xói lở làm lộ thân cọc: dừng khai thác điểm neo đó và báo thiết kế.',
    'Tai neo đặt đúng phương cáp (góc phương vị trong bảng tọa độ), sai lệch ≤ 5°.',
    'Thép chủ đúng số thanh, đường kính, mác thép theo bảng E cho TỪNG BÈ; không dùng chung một loại lồng cho mọi bè.'
  ]],
  ['4. SAI SỐ CHO PHÉP (đề xuất theo TCVN 9395:2012 — kỹ sư thiết kế xác nhận)', [
    'Vị trí tim cọc trên mặt bằng: ≤ 75 mm. Độ nghiêng: ≤ 1%. Đường kính lỗ: không nhỏ hơn thiết kế. Chiều sâu lỗ: không nhỏ hơn L_tk.',
    'Lồng thép: khoảng cách thép chủ ±10 mm; bước đai ±20 mm; đường kính lồng ±10 mm; chiều dài ±50 mm. Cao độ đỉnh cọc: ±30 mm.'
  ]],
  ['5. NGHIỆM THU VÀ THỬ TẢI', [
    'Nghiệm thu từng cọc: tọa độ, chiều sâu, độ sạch đáy lỗ, lồng thép, khối lượng bê tông thực tế so với lý thuyết (hao hụt bất thường = sạt thành).',
    'Thử kéo ngang ít nhất 2 cọc thử (hoặc 1% số cọc) đến 1,5 lần lực kéo thiết kế trước khi thi công đại trà, để kiểm chứng thông số đất giả định.',
    'Ghi nhật ký khoan: loại đất gặp theo độ sâu. Đất yếu / bùn / đá tảng khác giả định: dừng và báo thiết kế.'
  ]],
  ['6. AN TOÀN TALUY VÀ BẢO VỆ NƯỚC HỒ', [
    'Không thi công khi mưa lớn hoặc mực nước hồ lên nhanh. Máy khoan đặt trên sàn phẳng, có neo / chèn chống trượt; không đặt máy trên mép taluy chưa gia cố.',
    'Miệng lỗ khoan chưa đổ bê tông phải có nắp đậy và rào cảnh báo. Công nhân làm việc trên bờ dốc đeo dây an toàn và áo phao.',
    'Đất khoan, nước rửa, bê tông thừa, dầu mỡ: thu gom đưa lên bãi thải, không xả xuống hồ. Có phao quây / lưới chắn bùn phía hồ tại mỗi vị trí thi công.',
    'Hoàn trả mặt bằng, đầm chặt đất quanh cọc, trồng cỏ hoặc gia cố đá hộc taluy sau khi thi công.'
  ]],
  ['7. GIỚI HẠN CỦA BẢN VẼ — PHẢI ĐỌC', [
    `LỚP BÊ TÔNG BẢO VỆ: với a_s = ${cover_mm} mm, lớp bảo vệ thực tế đến đai xoắn chỉ còn ${vn(minClearCover, 0)}–${vn(maxClearCover, 0)} mm, nhỏ hơn mức thông thường ≥ 50 mm của cọc khoan nhồi.`,
    `Nếu tăng lớp bảo vệ lên 50 mm mà giữ D${D} thì cánh tay đòn thép giảm khoảng 20% và thép trong bảng E KHÔNG còn đủ: phải tăng đường kính lỗ khoan (D400) hoặc tính lại thép. CẦN CHỦ ĐẦU TƯ / THIẾT KẾ QUYẾT ĐỊNH TRƯỚC KHI THI CÔNG.`,
    `Khoảng hở giữa các thép chủ nhỏ nhất ${vn(minGap, 0)} mm (lồng ${Math.max(...barCounts)} thanh): dùng đá 1×2, bê tông độ sụt cao, đảm bảo bê tông chui qua lồng.`,
    `Chưa thiết kế: lực cắt thân cọc (đai xoắn là cấu tạo), ${rows.some((r) => r.perPoint > 1) ? 'đài cọc đôi, ' : ''}bảo vệ chống ăn mòn chi tiết, bê tông cục bộ mũ cọc.`,
    `Bản vẽ theo mặt bằng ${rows.length} bè của Chủ đầu tư (HỒ HUỔI VANH.dxf, 08/10/2026). Neo đáy hồ (đế BTCT + vít xoắn) thể hiện ở bản vẽ mặt bằng hệ neo, không thuộc bản vẽ này.`,
    'Đây là bản vẽ đề xuất phục vụ trao đổi; hồ sơ thi công phải do đơn vị thiết kế có chứng chỉ phát hành.'
  ]]
];
{
  const ox = 80000, oy = 4000;
  title(ox, oy + 1100, 'G. THUYẾT MINH VÀ GHI CHÚ BIỆN PHÁP THI CÔNG');
  let y = oy;
  for (const [headText, items] of NOTES) {
    tx(LY.note, ox, y, headText, H * 1.2); y -= 420;
    for (const s of items.filter(Boolean)) {
      // wrap at ~150 characters so a line stays readable on the sheet
      const words = s.split(' '); let cur = '– ';
      for (const w of words) { if ((cur + w).length > 150) { tx(LY.note, ox + 150, y, cur.trimEnd()); y -= 330; cur = '   ' + w + ' '; } else cur += w + ' '; }
      tx(LY.note, ox + 150, y, cur.trimEnd()); y -= 330;
    }
    y -= 200;
  }
}

// ------------------------------------------------------------------ frame and title block
{
  const x0 = -8500, x1 = 105000, y0 = -36500, y1 = 6800;
  rc(LY.frame, x0, y0, x1, y1);
  rc(LY.frame, x1 - 22000, y0, x1, y0 + 2600);
  tx(LY.frame, x1 - 21700, y0 + 1850, 'DỰ ÁN: ĐIỆN MẶT TRỜI NỔI HỒ THỦY ĐIỆN HUỔI VANH', H * 1.2);
  tx(LY.frame, x1 - 21700, y0 + 1250, 'BẢN VẼ: CỌC KHOAN NHỒI VEN BỜ D350 — CẤU TẠO VÀ BIỆN PHÁP THI CÔNG', H * 1.2);
  tx(LY.frame, x1 - 21700, y0 + 650, 'Số bản vẽ: CVB-01   |   Đơn vị: mm   |   Bản ĐỀ XUẤT, chưa phát hành thi công');
  tx(LY.frame, x1 - 21700, y0 + 200, `Sinh từ bộ tính của dự án ngày ${new Date().toISOString().slice(0, 10)} (scripts/buildShorePileDrawing.ts)`);
}

// ------------------------------------------------------------------ write
let tables = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length + 1) + pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, 7) + pair(6, 'CONTINUOUS');
for (const l of LAYERS) tables += pair(0, 'LAYER') + pair(2, l.name) + pair(70, 0) + pair(62, l.color) + pair(6, 'CONTINUOUS');
tables += pair(0, 'ENDTAB');
// Text style with a TrueType font: txt.shx (the default) has no Vietnamese glyphs.
tables += pair(0, 'TABLE') + pair(2, 'STYLE') + pair(70, 1) + pair(0, 'STYLE') + pair(2, STYLE) + pair(70, 0) + pair(40, 0) + pair(41, 1) + pair(50, 0) + pair(71, 0) + pair(42, H) + pair(3, 'arial.ttf') + pair(4, '') + pair(0, 'ENDTAB');
const dxf = pair(0, 'SECTION') + pair(2, 'HEADER') + pair(9, '$ACADVER') + pair(1, 'AC1009') + pair(9, '$INSUNITS') + pair(70, 4) + pair(9, '$MEASUREMENT') + pair(70, 1) + pair(0, 'ENDSEC')
  + pair(0, 'SECTION') + pair(2, 'TABLES') + tables + pair(0, 'ENDSEC')
  + pair(0, 'SECTION') + pair(2, 'ENTITIES') + out + pair(0, 'ENDSEC') + pair(0, 'EOF');

const md = [
  '# Cọc khoan nhồi ven bờ D350 — số liệu và ghi chú biện pháp thi công',
  '',
  'Sinh bởi `scripts/buildShorePileDrawing.ts`. Bản vẽ: `coc_khoan_nhoi_ven_bo.dxf` (đơn vị mm, chữ tiếng Việt có dấu, font Arial). Nội dung ghi chú giống trên bản vẽ.',
  '',
  `## Bảng thống kê (mặt bằng ${rows.length} bè, bản 08/10/2026)`,
  '',
  '| Bè | Điểm neo | Cọc/điểm | Số cọc | L_tk (m) | Thép chủ | Mác | T dây (kN) | γ·T/cọc (kN) | HSSD uốn | BT/cọc (m³) | Thép/cọc (kg) | Lớp bảo vệ thực tới đai (mm) |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.raft} | ${r.points} | ${r.perPoint} | ${r.piles} | ${vn(r.Ltk)} | ${r.label} | ${r.grade} | ${vn(r.T)} | ${vn(r.pullPerPile)} | ${r.util === null ? '–' : vn(r.util, 2)} | ${vn(r.conc, 2)} | ${vn(r.steel, 0)} | ${vn(r.clearCover, 0)} |`),
  `| **Tổng** | ${totalPoints} | | ${totalPiles} | ${vn(totalLen)} m | | | | | | ${vn(totalConc)} m³ | ${vn(totalSteel / 1000)} tấn | |`,
  '',
  '## Trình tự thi công',
  '',
  ...STEPS.flatMap(([n, ls]) => [`**${n}**`, ...ls.map((l) => `- ${l}`), '']),
  '## Ghi chú',
  '',
  ...NOTES.flatMap(([n, ls]) => [`**${n}**`, ...ls.filter(Boolean).map((l) => `- ${l}`), ''])
].join('\n');
fs.mkdirSync(outDir, { recursive: true });
let dxfName = 'coc_khoan_nhoi_ven_bo.dxf';
try {
  fs.writeFileSync(path.join(outDir, dxfName), dxf);
} catch (e: any) {
  if (e?.code !== 'EBUSY') throw e;
  // The drawing is open in AutoCAD, which locks it: write beside it instead of failing.
  dxfName = 'coc_khoan_nhoi_ven_bo_moi.dxf';
  fs.writeFileSync(path.join(outDir, dxfName), dxf);
}
console.log('wrote', dxfName);
fs.writeFileSync(path.join(outDir, 'BIEN_PHAP_THI_CONG.md'), md);
console.log(JSON.stringify({ totalPoints, totalPiles, totalLen: +totalLen.toFixed(1), totalConc: +totalConc.toFixed(1), totalSteel_t: +(totalSteel / 1000).toFixed(1), headOk: head.ok, ascii: !/[^\x0A\x20-\x7E]/.test(dxf), bytes: dxf.length }));
