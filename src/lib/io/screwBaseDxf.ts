import type { CalcResults, ProjectState } from '../calc/types';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import { buildRaftOutlines, PileScheduleBatchLike, PileScheduleRow } from './pileSchedule';
import { buildScrewBaseSchedule, baseCorners, ScrewBaseRow, ScrewBaseSchedule } from './screwBaseSchedule';
import { ACI, Pt, line, circle, point, square, closedPolyline, dxfStampedName, downloadDxf } from './dxfExport';
import { vnText as text, dxfDocumentVn } from './dxfVn';
import { designWindCaveat } from '../calc/designWind';

/**
 * Setting-out drawing of the 9-raft plan: shore anchors on bored piles D350,
 * lake-bed anchors on RC bases held by screw piles (option 3). ASCII DXF R12
 * in site-local metres, Vietnamese text with diacritics (see dxfVn.ts).
 *
 * Every number comes from the calculation: base sizes and utilisations from
 * `results.bedScrewBase`, pile values from the pile schedule. The base detail
 * shows the geometry the checks are made with; the padeye, the screw head
 * lock and the lifting points are NOT designed and are drawn as symbols only.
 */
export const DXF_LAYERS_PA3 = {
  raft: { name: '01_BE_PIN', color: ACI.cyan },
  shoreLine: { name: '02_DAY_NEO_BO', color: ACI.green },
  bedLine: { name: '03_DAY_NEO_DAY', color: ACI.red },
  shorePile: { name: '04_COC_KHOAN_NHOI_BO', color: ACI.yellow },
  base: { name: '05_DE_NEO_VIT_XOAN', color: ACI.magenta },
  text: { name: '06_TOA_DO_TEXT', color: ACI.white },
  shoreTable: { name: '07_BANG_THONG_KE_COC_BO', color: ACI.white },
  baseTable: { name: '08_BANG_THONG_KE_DE_NEO', color: ACI.white },
  detail: { name: '09_CHI_TIET_DE_NEO', color: ACI.yellow }
} as const;

interface Column<T> { title: string; width: number; value: (r: T) => string }
const vn = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '∞');

const SHORE_COLUMNS: Column<PileScheduleRow>[] = [
  { title: 'MÃ CỌC', width: 14, value: (r) => r.pileId },
  { title: 'KÝ HIỆU', width: 12, value: (r) => r.code },
  { title: 'BÈ', width: 9, value: (r) => r.raft },
  { title: 'X (m)', width: 12, value: (r) => vn(r.x) },
  { title: 'Y (m)', width: 12, value: (r) => vn(r.y) },
  { title: 'Z (m)', width: 10, value: (r) => vn(r.z) },
  { title: 'SỐ CỌC', width: 8, value: (r) => String(r.pileCount) },
  { title: 'D (mm)', width: 9, value: (r) => String(Math.round(r.D_m * 1000)) },
  { title: 'L_tk (m)', width: 10, value: (r) => vn(r.Linput_m, 1) },
  { title: 'T dây (kN)', width: 12, value: (r) => vn(r.Tmax_kN, 1) },
  { title: 'P_max (kN)', width: 12, value: (r) => vn(r.Pmax_kN, 1) },
  { title: 'KẾT LUẬN', width: 11, value: (r) => (r.isPmaxOk ? 'ĐẠT' : 'KIỂM TRA') },
  { title: 'THÉP CHỦ', width: 18, value: (r) => (r.cage.totalBars > 0 ? `${r.cage.totalBars}Φ${r.rebarDia_mm} ${r.cage.grade}` : 'KHÔNG') },
  { title: 'ĐAI', width: 14, value: (r) => (r.cage.shape === 'circular' ? 'XOẮN Φ8 a150' : 'Φ8 a100/200') }
];

const BASE_COLUMNS: Column<ScrewBaseRow>[] = [
  { title: 'MÃ ĐẾ', width: 14, value: (r) => r.baseId },
  { title: 'DÂY NEO', width: 20, value: (r) => r.code },
  { title: 'BÈ', width: 15, value: (r) => r.raft },
  { title: 'LOẠI', width: 12, value: (r) => (r.shared ? 'DÙNG CHUNG' : 'ĐƠN') },
  { title: 'X (m)', width: 12, value: (r) => vn(r.x) },
  { title: 'Y (m)', width: 12, value: (r) => vn(r.y) },
  { title: 'Z (m)', width: 10, value: (r) => vn(r.z) },
  { title: 'B (m)', width: 8, value: (r) => vn(r.side_m) },
  { title: 't (m)', width: 8, value: (r) => vn(r.thickness_m) },
  { title: 'BT (m³)', width: 9, value: (r) => vn(r.concrete_m3, 1) },
  { title: 'CẨU (T)', width: 9, value: (r) => vn(r.liftMass_t, 1) },
  { title: 'T dây (kN)', width: 12, value: (r) => vn(r.Tmax_kN, 1) },
  { title: 'NHỔ', width: 8, value: (r) => vn(r.upliftUtil) },
  { title: 'TRƯỢT', width: 9, value: (r) => vn(r.slideUtil) },
  { title: 'LẬT', width: 8, value: (r) => vn(r.overturnUtil) },
  { title: '1 VÍT', width: 8, value: (r) => vn(r.screwUtil) },
  { title: 'KẾT LUẬN', width: 12, value: (r) => (r.ok ? 'ĐẠT' : 'KHÔNG ĐẠT') },
  { title: 'CHỒNG LẤN VỚI', width: 22, value: (r) => (r.clashWith.length ? r.clashWith.join(', ') : '-') }
];

/** A grid table (LINEs + TEXT cells); returns the entities and the table's width. */
function table<T>(layer: string, titles: string[], columns: Column<T>[], rows: T[], origin: Pt, h: number): { dxf: string; width: number; bottom: number } {
  const rowH = h * 2.2, pad = h * 0.4;
  const widths = columns.map((c) => c.width * h * 0.75);
  const totalW = widths.reduce((s, w) => s + w, 0);
  let out = '';
  let y = origin.y;
  for (const t of titles) { out += text(layer, { x: origin.x, y }, h * 1.3, t); y -= rowH; }
  y -= rowH * 0.3;
  const top = y;
  const drawRow = (cells: string[], rowTop: number) => {
    let x = origin.x, s = '';
    for (let i = 0; i < cells.length; i++) { s += text(layer, { x: x + pad, y: rowTop - rowH + pad * 1.6 }, h, cells[i]); x += widths[i]; }
    return s;
  };
  out += drawRow(columns.map((c) => c.title), top);
  rows.forEach((r, i) => { out += drawRow(columns.map((c) => c.value(r)), top - (i + 1) * rowH); });
  const rowCount = rows.length + 1;
  for (let i = 0; i <= rowCount; i++) out += line(layer, { x: origin.x, y: top - i * rowH }, { x: origin.x + totalW, y: top - i * rowH });
  let x = origin.x;
  for (let i = 0; i <= widths.length; i++) { out += line(layer, { x, y: top }, { x, y: top - rowCount * rowH }); if (i < widths.length) x += widths[i]; }
  return { dxf: out, width: totalW, bottom: top - rowCount * rowH };
}

const rect = (layer: string, x0: number, y0: number, x1: number, y1: number) =>
  closedPolyline(layer, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]);

/** Plan + section of the base (enlarged), the size of every raft's base and the notes. */
function baseDetail(schedule: ScrewBaseSchedule, origin: Pt, h: number, windSpeed_ms: number): string {
  const layer = DXF_LAYERS_PA3.detail.name;
  const rafts = [...schedule.baseByRaft.entries()];
  const first = rafts[0]?.[1];
  if (!first) return '';
  const p = first.params;
  // Drawn for the LARGEST base, enlarged so it reads beside 1.2 m text.
  const big = rafts.reduce((a, b) => (b[1].side_m > a[1].side_m ? b : a), rafts[0])[1];
  const k = (40 * h) / big.side_m; // drawing metres per metre of base
  const B = big.side_m * k, t = big.thickness_m * k, c = p.holeEdge_m * k, L = p.screwLength_m * k;
  let out = '';
  let y = origin.y;
  out += text(layer, { x: origin.x, y }, h * 1.6, 'CHI TIẾT ĐẾ NEO ĐÁY HỒ: ĐẾ BTCT + VÍT XOẮN');
  y -= h * 3;
  out += text(layer, { x: origin.x, y }, h, `Vẽ cho đế ${vn(big.side_m)} × ${vn(big.side_m)} × ${vn(big.thickness_m)} m (tỷ lệ phóng ${vn(k, 1)}:1). Kích thước B, t từng đế: xem bảng thống kê đế. Đế dùng chung: hai tai neo đặt hai bên tâm đế, theo phương hai dây.`);
  y -= h * 5;

  // ---- plan
  const px = origin.x, py = y - B;
  out += text(layer, { x: px, y: y + h * 0.8 }, h * 1.2, 'MẶT BẰNG ĐẾ');
  out += rect(layer, px, py, px + B, py + B);
  const sk = p.skirtDepth_m > 0 ? 0.2 * k : 0; // skirt shown 0.2 m in from the edge (schematic)
  if (sk > 0) out += rect(layer, px + sk, py + sk, px + B - sk, py + B - sk);
  for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    out += circle(layer, { x: px + c + i * (B - 2 * c), y: py + c + j * (B - 2 * c) }, (p.holeDia_m / 2) * k);
  }
  out += square(layer, { x: px + B / 2, y: py + B / 2 }, 0.3 * k);
  out += text(layer, { x: px + B / 2 + 0.25 * k, y: py + B / 2 + 0.2 * k }, h, 'Tai neo cáp (tâm đế)');
  out += text(layer, { x: px + c + 0.15 * k, y: py + c + 0.1 * k }, h, `Lỗ Ø${Math.round(p.holeDia_m * 1000)}, tim cách mép ${Math.round(p.holeEdge_m * 1000)} mm`);
  if (sk > 0) out += text(layer, { x: px + sk + 0.1 * k, y: py + B - sk - 0.35 * k }, h, `Gờ chống trượt quanh chu vi đáy, sâu ${Math.round(p.skirtDepth_m * 1000)} mm`);
  out += line(layer, { x: px, y: py - 2 * h }, { x: px + B, y: py - 2 * h });
  out += text(layer, { x: px + B / 2 - 2 * h, y: py - 4 * h }, h * 1.2, 'B');

  // ---- section
  const sx = origin.x + B + 20 * h, bedY = y - 14 * h;
  out += text(layer, { x: sx, y: y + h * 0.8 }, h * 1.2, 'MẶT CẮT ĐẾ');
  out += line(layer, { x: sx - 8 * h, y: bedY }, { x: sx + B + 8 * h, y: bedY });
  out += text(layer, { x: sx + B + 2 * h, y: bedY - 2 * h }, h, 'Mặt bùn đáy hồ');
  out += rect(layer, sx, bedY, sx + B, bedY + t);
  const skd = p.skirtDepth_m * k;
  if (skd > 0) { out += rect(layer, sx, bedY - skd, sx + 0.2 * k, bedY); out += rect(layer, sx + B - 0.2 * k, bedY - skd, sx + B, bedY); }
  for (const x of [sx + c, sx + B - c]) {
    out += line(layer, { x, y: bedY + t + 0.3 * k }, { x, y: bedY - L });
    for (let d = 0.3 * k; d < L; d += 0.35 * k) out += line(layer, { x: x - (p.threadDia_m / 2) * k * 1.5, y: bedY - d }, { x: x + (p.threadDia_m / 2) * k * 1.5, y: bedY - d - 0.1 * k });
    out += rect(layer, x - 0.12 * k, bedY + t, x + 0.12 * k, bedY + t + 0.05 * k); // lock plate (symbol)
  }
  const padTop = bedY + t + p.padeyeHeight_m * k;
  out += rect(layer, sx + B / 2 - 0.1 * k, bedY + t, sx + B / 2 + 0.1 * k, padTop);
  out += line(layer, { x: sx + B / 2, y: padTop }, { x: sx + B + 6 * h, y: padTop + 5 * h });
  out += text(layer, { x: sx + B + 6.5 * h, y: padTop + 5 * h }, h, 'Cáp neo T');
  out += text(layer, { x: sx + B / 2 + 0.2 * k, y: padTop + 0.5 * h }, h, `Tai neo cao ${Math.round(p.padeyeHeight_m * 1000)} mm`);
  out += text(layer, { x: sx + B + 2 * h, y: bedY + t / 2 }, h, `Đế BTCT B25, dày t; lưới thép 2 lớp, 2 phương`);
  out += text(layer, { x: sx + B - c + 1.5 * h, y: bedY - L / 2 }, h, `Vít xoắn ống Ø${Math.round(p.tubeDia_m * 1000)}×${Math.round(p.tubeThk_m * 1000)}, ren Ø${Math.round(p.threadDia_m * 1000)}, ngập bùn L = ${vn(p.screwLength_m, 1)} m`);
  out += text(layer, { x: sx + c + 1.5 * h, y: bedY + t + 0.4 * k }, h, 'Khóa đầu vít: bản mã + đai ốc; chèn kín khe lỗ');

  // ---- per-raft sizes
  const tbl = table<[string, typeof first]>(
    layer,
    ['KIỂM TRA THEO BÈ — đế cho MỘT dây, với dây đáy ngắn nhất của bè (các dòng SV-1…SV-6 trên web). Cỡ đế từng điểm: xem bảng thống kê đế.'],
    [
      { title: 'BÈ', width: 9, value: ([name]) => name },
      { title: 'B (m)', width: 8, value: ([, b]) => vn(b.side_m) },
      { title: 't (m)', width: 8, value: ([, b]) => vn(b.thickness_m) },
      { title: 'BT (m³)', width: 9, value: ([, b]) => vn(b.concrete_m3, 1) },
      { title: 'CẨU (T)', width: 9, value: ([, b]) => vn(b.liftMass_t, 1) },
      { title: 'LƯỚI THÉP', width: 14, value: ([, b]) => `Ø${b.rebarDia_mm} a${Math.round(b.rebarSpacing_m * 1000)}` },
      { title: 'THÉP (kg)', width: 11, value: ([, b]) => vn(b.rebar_kg, 0) },
      { title: 'NHỔ', width: 8, value: ([, b]) => vn(b.upliftUtil) },
      { title: 'TRƯỢT', width: 9, value: ([, b]) => vn(b.slideUtil) },
      { title: 'LẬT', width: 8, value: ([, b]) => vn(b.overturnUtil) },
      { title: '1 VÍT', width: 8, value: ([, b]) => vn(b.screwUtil) },
      { title: 'NỀN', width: 8, value: ([, b]) => vn(b.bearingUtil) },
      { title: 'KL', width: 12, value: ([, b]) => (b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT') }
    ],
    rafts,
    { x: sx + B + 60 * h, y: origin.y - h * 8 },
    h
  );
  out += tbl.dxf;

  // ---- notes
  let ny = Math.min(py - 7 * h, bedY - L - 6 * h);
  const T = schedule.totals;
  const notes = [
    'GHI CHÚ:',
    `0. ĐẾ DÙNG CHUNG (${T.sharedBases} / ${T.bases} đế): đặt ở tim khe giữa hai bè, có HAI tai neo, mỗi tai nối một dây về một bè. Kiểm tra: một dây căng cực đại + dây kia ở lực căng trước; và cả hai dây cùng căng (lực ngang triệt tiêu, lực nhổ cộng lại). Tai neo đôi CHƯA thiết kế.`,
    `1. Tính theo bảng tính 6.DE_NEO_VIT của Chủ đầu tư: chống nhổ, trượt, lật, lực nhổ một vít, áp lực nền, thép bản đế — ở hai mực nước (thấp: dây thoải, trượt lớn nhất; cao: dây dốc, nhổ lớn nhất).`,
    `2. Thông số: c_u bùn = ${p.cuSurface_kPa} kPa; γ' bùn = ${p.gammaSubMud_kNm3} kN/m³; α đáy đế = ${p.alphaBase}; α thân vít = ${p.alphaShaft}; hệ số trọng lượng đế ${p.weightFactor}; FS trượt ${p.sfSlide}, lật ${p.sfOverturn}, nhổ vít ${p.sfScrewUplift}, nền ${p.sfBearing}.`,
    '3. c_u, γ\' và các hệ số bám dính là GIẢ ĐỊNH, chưa có khảo sát đáy hồ. Bùn mặt lòng hồ thường chỉ 2–10 kPa: phải cắt cánh / xuyên tĩnh trước khi chốt kích thước đế.',
    `4. Đế mẫu 2,5 × 2,5 × 0,4 m chỉ đạt với lực dây khoảng 70 kN. Điểm có lực dây lớn hơn hoặc dây dốc dùng đế LỚN HƠN (cạnh ${vn(T.side_m[0])}–${vn(T.side_m[1])} m, nặng tới ${vn(T.maxLiftMass_t, 1)} tấn khi cẩu).`,
    '5. Đế đặt một cạnh song song phương cáp. Sau khi hạ đế: vặn 4 vít qua lỗ chờ, chèn kín khe lỗ – thân vít, khóa đầu vít bằng bản mã và đai ốc.',
    '6. CHƯA THIẾT KẾ: tai neo cáp và chọc thủng tại tai neo, khóa đầu vít, móc cẩu, chống ăn mòn vít (cần mạ kẽm nhúng nóng), tải động / mỏi, hiệu ứng nhóm vít.',
    `7. Tổng: ${T.bases} đế (${T.sharedBases} đế dùng chung) cho ${T.lines} tuyến cáp đáy, ${vn(T.concrete_m3, 1)} m³ bê tông, ${vn(T.rebar_kg / 1000, 1)} tấn thép bản, ${T.screws} vít (${vn(T.screwLength_m, 0)} m).`,
    schedule.clashes.length > 0
      ? `8. CẢNH BÁO: ${schedule.clashes.length} cặp đế CHỒNG LẤN nhau trên mặt bằng — xem cột CHỒNG LẤN VỚI trong bảng thống kê. Phải dời điểm neo trước khi thi công.`
      : '8. Không có đế nào chồng lấn nhau trên mặt bằng.',
    `9. Gió tính toán: V = ${vn(windSpeed_ms, 1)} m/s. ${designWindCaveat(windSpeed_ms) ?? 'Bằng hoặc cao hơn gió tiêu chuẩn TCVN 2737:2023 vùng II-B.'}`
  ];
  for (const s of notes) { out += text(layer, { x: origin.x, y: ny }, h, s); ny -= h * 2.2; }
  return out;
}

export interface ScrewBaseDxfOptions {
  labelHeight_m?: number;
  shorePileRadius_m?: number;
  includeTables?: boolean;
  includeDetail?: boolean;
  coordinates?: MooringCoordinate[];
}

export interface ScrewBaseDxfResult {
  dxf: string;
  schedule: ScrewBaseSchedule;
  shorePileCount: number;
  baseCount: number;
  raftCount: number;
}

export function buildMooringScrewBaseDxf(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  options: ScrewBaseDxfOptions = {}
): ScrewBaseDxfResult {
  const h = options.labelHeight_m ?? 1.2;
  const shoreR = options.shorePileRadius_m ?? 0.5;
  const L = DXF_LAYERS_PA3;
  const schedule = buildScrewBaseSchedule(state, results, batchResults, options.coordinates);
  const outlines = buildRaftOutlines(options.coordinates);
  let e = '';

  for (const o of outlines) {
    e += closedPolyline(L.raft.name, o.points);
    if (o.points.length > 0) {
      const cx = o.points.reduce((s, q) => s + q.x, 0) / o.points.length;
      const cy = o.points.reduce((s, q) => s + q.y, 0) / o.points.length;
      e += text(L.raft.name, { x: cx, y: cy }, h * 2.5, o.raft);
      if (o.source === 'hull') e += text(L.raft.name, { x: cx, y: cy - h * 3 }, h, '(đường bao gần đúng theo điểm neo)');
    }
  }

  // Shore piles at true size, plus a locating circle so they stay visible when zoomed out.
  for (const r of schedule.shorePiles) {
    const p = { x: r.x, y: r.y };
    e += line(L.shoreLine.name, { x: r.xRaft, y: r.yRaft }, p);
    const mark = (c: Pt) => (r.cage.shape === 'circular' ? circle(L.shorePile.name, c, r.D_m / 2) : square(L.shorePile.name, c, r.D_m));
    if (r.pileCount > 1) {
      // Several piles: side by side ACROSS the cable, 3 diameters centre to centre.
      const dx = p.x - r.xRaft, dy = p.y - r.yRaft, len = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < r.pileCount; i++) {
        const off = (i - (r.pileCount - 1) / 2) * 3 * r.D_m;
        e += mark({ x: p.x + (-dy / len) * off, y: p.y + (dx / len) * off });
      }
    } else e += mark(p);
    e += circle(L.shorePile.name, p, shoreR) + point(L.shorePile.name, p);
    e += text(L.text.name, { x: p.x + shoreR + 0.4, y: p.y + shoreR + 0.4 }, h,
      `${r.pileId} (${r.code}) ${r.pileCount > 1 ? `${r.pileCount}×` : ''}D${Math.round(r.D_m * 1000)}`);
  }

  // Lake-bed bases at true plan size, one side along the first cable, with the four screw holes.
  // A shared base carries two padeyes, one towards each raft, and both cables are drawn to it.
  for (const b of schedule.bases) {
    const p = { x: b.x, y: b.y };
    const prm = b.design.params;
    for (const l of b.lines) e += line(L.bedLine.name, { x: l.xRaft, y: l.yRaft }, p);
    e += closedPolyline(L.base.name, baseCorners(p, b.side_m, b.azimuth_deg));
    for (const hole of baseCorners(p, b.side_m - 2 * prm.holeEdge_m, b.azimuth_deg)) e += circle(L.base.name, hole, prm.holeDia_m / 2);
    if (b.shared) {
      for (const l of b.lines) {
        const a = (l.azimuth_deg * Math.PI) / 180; // from the raft to the base: the padeye sits on the raft's side
        e += square(L.base.name, { x: p.x - Math.sin(a) * 0.4, y: p.y - Math.cos(a) * 0.4 }, 0.3);
      }
    }
    e += point(L.base.name, p);
    e += text(L.text.name, { x: p.x + b.side_m * 0.75, y: p.y + b.side_m * 0.75 }, h,
      `${b.baseId} (${b.code}) ${vn(b.side_m)}×${vn(b.side_m)}×${vn(b.thickness_m)}${b.shared ? ' DÙNG CHUNG' : ''}`);
  }

  const xs = [...schedule.shorePiles.flatMap((r) => [r.x, r.xRaft]), ...schedule.bases.flatMap((b) => [b.x, ...b.lines.map((l) => l.xRaft)])];
  const ys = [...schedule.shorePiles.flatMap((r) => [r.y, r.yRaft]), ...schedule.bases.flatMap((b) => [b.y, ...b.lines.map((l) => l.yRaft)])];
  let cursorX = (xs.length ? Math.max(...xs) : 0) + 30;
  const top = ys.length ? Math.max(...ys) : 0;
  const code = state.meta.code || state.code || 'DA';
  const piles = schedule.shorePiles.reduce((s, r) => s + r.pileCount, 0);

  if (options.includeTables !== false) {
    const t1 = table(L.shoreTable.name, [
      `BẢNG THỐNG KÊ CỌC KHOAN NHỒI NEO BỜ (${schedule.shorePiles.length} ĐIỂM NEO, ${piles} CỌC) — ${code}`,
      'Quy tắc của Chủ đầu tư (08/10/2026): gần bờ, kể cả chỗ mấp mé nước, neo bằng cọc khoan nhồi; đế vít xoắn chỉ dùng giữa hai bè. Vị trí cọc mới lấy theo địa hình IFC (≥ 384,0 m), chưa phải khảo sát.',
      'D: đường kính cọc khoan nhồi | L_tk: chiều sâu thiết kế | P_max: sức chịu tải cho phép của MỘT cọc tại L_tk | SỐ CỌC > 1: cụm cọc đặt vuông góc phương cáp, cách nhau ≥ 3D',
      `Cáp móc sát cổ cọc, tim chốt cách mặt đất ≤ ${Math.round((state.anchor.shoreArm_e_m ?? 0.1) * 1000)} mm (điều kiện của thiết kế cốt thép).`
    ], SHORE_COLUMNS, schedule.shorePiles, { x: cursorX, y: top }, h);
    e += t1.dxf;
    cursorX += t1.width + 30;
    const t2 = table(L.baseTable.name, [
      `BẢNG THỐNG KÊ ĐẾ NEO ĐÁY HỒ: ĐẾ BTCT + VÍT XOẮN (${schedule.bases.length} ĐẾ, ${schedule.totals.sharedBases} ĐẾ DÙNG CHUNG, ${schedule.totals.lines} TUYẾN CÁP) — ${code}`,
      'B, t: cạnh và chiều dày đế | CẨU: khối lượng đế khi cẩu lắp | NHỔ, TRƯỢT, LẬT, 1 VÍT: hệ số sử dụng (≤ 1,00 là đạt), lấy trường hợp bất lợi hơn trong hai mực nước',
      schedule.clashes.length > 0
        ? `CẢNH BÁO: ${schedule.clashes.length} cặp đế CHỒNG LẤN nhau trên mặt bằng — xem cột cuối.`
        : 'Không có đế nào chồng lấn nhau trên mặt bằng.',
      ...(designWindCaveat(state.env.windSpeed_ms) ? [`CHÚ Ý: ${designWindCaveat(state.env.windSpeed_ms)}`] : [])
    ], BASE_COLUMNS, schedule.bases, { x: cursorX, y: top }, h);
    e += t2.dxf;
    cursorX += t2.width + 30;
  }
  if (options.includeDetail !== false && schedule.bases.length > 0) e += baseDetail(schedule, { x: cursorX, y: top }, h, state.env.windSpeed_ms);

  return { dxf: dxfDocumentVn(Object.values(L), e), schedule, shorePileCount: schedule.shorePiles.length, baseCount: schedule.bases.length, raftCount: outlines.length };
}

/** `mat-bang-he-neo-de-vit-xoan_<code>_<YYYYMMDD>.dxf` */
export function dxfFileNamePA3(state: ProjectState, now: Date = new Date()): string {
  return dxfStampedName('mat-bang-he-neo-de-vit-xoan', state, now);
}

/** Builds the option 3 drawing and triggers the browser download. */
export function exportMooringScrewBaseDxf(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  options: ScrewBaseDxfOptions = {}
): ScrewBaseDxfResult {
  const built = buildMooringScrewBaseDxf(state, results, batchResults, options);
  downloadDxf(built.dxf, dxfFileNamePA3(state));
  return built;
}
