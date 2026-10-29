/**
 * Construction drawing set of the bored shore piles of Hồ Huổi Vanh (owner
 * 2026-10-29: "tạo giúp t bản vẽ thi công cọc khoan nhồi"). NOT part of the web app.
 *
 *   npx vite-node scripts/buildShorePileConstructionSet.ts [outDir]
 *
 * Five A1 sheets drawn in PAPER millimetres side by side in model space (plot
 * each frame at 1:1); every view states its own scale:
 *   CVB-01 setting-out plan (C1… marks = the same marks as the mooring plan),
 *   CVB-02 coordinates and levels of every pile,
 *   CVB-03 pile types, elevation, cross-sections and bar schedule,
 *   CVB-04 pile head (cap plate, padeye) and the twin-pile cap,
 *   CVB-05 construction sequence and notes.
 * Every number comes from the calculation engine (pile schedule, per-point
 * schedule, head and twin-cap design), so the sheets cannot drift from the design.
 * Ground levels are the IFC terrain (not a survey): stated on the sheets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { ACTIVE_LAKE_ID } from '../src/data/lakes';
import { buildPileSchedule, buildRaftOutlines, PileScheduleRow } from '../src/lib/io/pileSchedule';
import { buildAnchorPointSchedule } from '../src/lib/io/anchorPointSchedule';
import { buildShorePileHead } from '../src/lib/io/shorePileHeadDetail';
import { designTwinPileCap, TwinPileCap } from '../src/lib/calc/twinPileCap';
import { designWindCaveat } from '../src/lib/calc/designWind';
import { Pt, pair, line, circle, closedPolyline } from '../src/lib/io/dxfExport';
import { escapeDxfUnicode, VN_TEXT_STYLE } from '../src/lib/io/dxfVn';

if (ACTIVE_LAKE_ID !== 'huoi-vanh') throw new Error('this drawing set is for Hồ Huổi Vanh');
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(here, '../docs/coc-ven-bo-thi-cong');
const ISSUE_DATE = '29/10/2026';

// ------------------------------------------------------------------ design data from the engine
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => {
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  return { raft, state: st, results: calculateProject(st) };
});
const results = calculateProject(state);
const schedule = buildPileSchedule(state, results, batch);
const shore = schedule.filter((r) => r.type === 'SHORE');
const points = buildAnchorPointSchedule(state, results, batch).shore;
const head0 = buildShorePileHead(state, schedule, batch);
if (!head0) throw new Error('shore piles are not round bored piles');
const head = head0;
const gamma = state.anchor.pileBendingLoadFactor ?? 1.2;
const cover_mm = state.anchor.pileRebarCover_mm ?? 50; // concrete face to main-bar centre
const armE_m = state.anchor.shoreArm_e_m ?? 0.1;
const mblOf = (raft: string) => batch.find((b) => b.raft.name === raft)?.state.line.mbl_kN ?? state.line.mbl_kN;
const SPIRAL = { dia: 8, pitch: 150 };
const RING = { dia: 14, step_m: 2.0 }; // stiffener rings welded inside the cage (constructive)
const BOTTOM_GAP_M = 0.1, TOP_GAP_M = 0.05; // main bars stop 100 mm above the hole bottom, 50 mm below the pile top
const kgPerM = (d: number) => (Math.PI * d * d) / 4 * 1e-6 * 7850;
const vn = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

/** C1, C2 … in the order of the mooring plan (screwBaseDxf.ts writes the same marks). */
const markOf = new Map(shore.map((r, i) => [r.code, `C${i + 1}`]));
const groundOf = new Map(points.map((p) => [p.code, p.ground_m]));

// pile types: one per pile cage / count
interface PileType { id: string; rows: PileScheduleRow[]; perPoint: number; label: string; grade: string; bars: number; dia: number; Ltk: number; rafts: string[] }
const typeKey = (r: PileScheduleRow) => `${r.pileCount}|${r.cage.label}|${r.cage.grade}|${r.Linput_m}`;
const typeMap = new Map<string, PileScheduleRow[]>();
for (const r of shore) typeMap.set(typeKey(r), [...(typeMap.get(typeKey(r)) ?? []), r]);
const types: PileType[] = [...typeMap.values()]
  .sort((a, b) => a[0].pileCount - b[0].pileCount || b[0].rebarDia_mm - a[0].rebarDia_mm || a[0].cage.grade.localeCompare(b[0].cage.grade))
  .map((rows) => ({ id: '', rows, perPoint: rows[0].pileCount, label: rows[0].cage.label, grade: rows[0].cage.grade, bars: rows[0].cage.totalBars, dia: rows[0].rebarDia_mm, Ltk: rows[0].Linput_m, rafts: [...new Set(rows.map((r) => r.raft))] }));
let nSingle = 0, nTwin = 0;
for (const t of types) t.id = t.perPoint > 1 ? `CĐ${++nTwin}` : `CN${++nSingle}`;
const typeOf = (r: PileScheduleRow) => types.find((t) => t.rows.includes(r))!;

// twin-pile caps, one per twin point, grouped where the design is the same
const twinRows = shore.filter((r) => r.pileCount > 1);
const caps = twinRows.map((r) => ({ r, cap: designTwinPileCap({ tension_kN: r.Tmax_kN, loadFactor: gamma, pileDia_m: r.D_m, attachHeight_m: armE_m, cableMbl_kN: mblOf(r.raft), pileBarDia_mm: r.rebarDia_mm }) }));
if (caps.some((c) => !c.cap.ok) || !head.ok) throw new Error('pile head / twin cap design does not pass');
const capKey = (c: TwinPileCap) => `${c.length_mm}|${c.width_mm}|${c.depth_mm}|${c.faceBars.count}Φ${c.faceBars.dia_mm}|${c.stirrup.spacing_mm}|${c.head.plateThk_mm}|${c.head.padeyeThk_mm}`;
const capTypes: Array<{ id: string; cap: TwinPileCap; codes: string[] }> = [];
for (const c of caps) {
  const k = capKey(c.cap);
  const found = capTypes.find((t) => capKey(t.cap) === k);
  if (found) found.codes.push(c.r.code); else capTypes.push({ id: `Đ${capTypes.length + 1}`, cap: c.cap, codes: [c.r.code] });
}

// ------------------------------------------------------------------ bar schedule of one pile of each type
interface Bar { no: string; name: string; dia: number; len_m: number; count: number; shape: string }
const cageDia_mm = 350 - 2 * cover_mm; // main-bar centre circle
function pileBars(t: PileType): Bar[] {
  const D = Math.round(t.rows[0].D_m * 1000);
  const ringDia = (D - 2 * cover_mm) - t.dia - RING.dia; // inside the main bars
  const spiralDia = (D - 2 * cover_mm) + t.dia + SPIRAL.dia; // around the main bars
  const bodyLen = t.Ltk + head.pileTopAboveGround_mm / 1000; // toe to pile top
  const barLen = bodyLen - BOTTOM_GAP_M - TOP_GAP_M;
  const turns = Math.ceil((barLen * 1000) / SPIRAL.pitch) + 3; // + 1.5 closing turns at each end
  const rings = Math.floor(barLen / RING.step_m) + 1;
  return [
    { no: '1', name: 'Thép chủ', dia: t.dia, len_m: barLen, count: t.bars, shape: 'Thẳng' },
    { no: '2', name: `Đai xoắn a${SPIRAL.pitch} (cuộn ${turns} vòng, Ø${spiralDia} tim)`, dia: SPIRAL.dia, len_m: (turns * Math.PI * spiralDia) / 1000, count: 1, shape: 'Xoắn' },
    { no: '3', name: `Vành cứng a${RING.step_m * 1000}, hàn trong lồng (Ø${ringDia} tim)`, dia: RING.dia, len_m: (Math.PI * ringDia) / 1000 + 0.1, count: rings, shape: 'Vòng' }
  ];
}
const headBars: Bar[] = [
  { no: '4', name: `Thép neo bản mã, hàn vào bản mã`, dia: head.anchorBarDia_mm, len_m: head.anchorBarLength_mm / 1000, count: head.anchorBarCount, shape: 'Thẳng' }
];
const plateKg = (head.plateSide_mm ** 2 * head.plateThk_mm + head.padeyeWidth_mm * head.padeyeHeight_mm * head.padeyeThk_mm - (Math.PI * head.holeDia_mm ** 2 / 4) * head.padeyeThk_mm) * 1e-9 * 7850;
function capBars(c: TwinPileCap): Bar[] {
  const cover = 50, len = (c.length_mm - 2 * cover) / 1000;
  const stirrupLen = (2 * ((c.width_mm - 2 * cover) + (c.depth_mm - 2 * cover)) + 200) / 1000;
  const stirrupN = Math.floor((c.length_mm - 2 * cover) / c.stirrup.spacing_mm) + 1;
  return [
    { no: '5', name: 'Thép mặt bên (chịu uốn ngang), mỗi mặt', dia: c.faceBars.dia_mm, len_m: len, count: 2 * c.faceBars.count, shape: 'Thẳng' },
    { no: '6', name: 'Thép trên / dưới (cấu tạo)', dia: c.topBottomBars.dia_mm, len_m: len, count: c.topBottomBars.count, shape: 'Thẳng' },
    { no: '7', name: `Đai kín a${c.stirrup.spacing_mm}, móc 135°`, dia: c.stirrup.dia_mm, len_m: stirrupLen, count: stirrupN, shape: 'Đai kín' }
  ];
}
const barKg = (b: Bar) => b.len_m * b.count * kgPerM(b.dia);

// ------------------------------------------------------------------ paper-mm drawing helpers
const LY = {
  frame: 'CVB_00_KHUNG', raft: 'CVB_01_BE', cable: 'CVB_02_CAP', pile: 'CVB_03_COC', bar: 'CVB_04_COT_THEP', steel: 'CVB_05_BAN_MA_TAI_NEO',
  dim: 'CVB_06_KICH_THUOC', text: 'CVB_07_CHU', mark: 'CVB_08_KY_HIEU_COC', ground: 'CVB_09_DIA_HINH', water: 'CVB_10_MUC_NUOC', table: 'CVB_11_BANG', grid: 'CVB_12_LUOI_TOA_DO', step: 'CVB_13_BUOC_THI_CONG'
};
const LAYERS = [
  { name: LY.frame, color: 7 }, { name: LY.raft, color: 4 }, { name: LY.cable, color: 3 }, { name: LY.pile, color: 2 }, { name: LY.bar, color: 1 },
  { name: LY.steel, color: 6 }, { name: LY.dim, color: 8 }, { name: LY.text, color: 7 }, { name: LY.mark, color: 2 }, { name: LY.ground, color: 34 },
  { name: LY.water, color: 5 }, { name: LY.table, color: 7 }, { name: LY.grid, color: 8 }, { name: LY.step, color: 4 }
];
const SHEET_W = 841, SHEET_H = 594, SHEET_GAP = 60;
let OX = 0; // origin of the current sheet
let out = '';
const num = (v: number) => (Math.round(v * 1000) / 1000).toString();
const P = (x: number, y: number): Pt => ({ x: OX + x, y });
const L = (ly: string, x0: number, y0: number, x1: number, y1: number) => { out += line(ly, P(x0, y0), P(x1, y1)); };
const R = (ly: string, x0: number, y0: number, x1: number, y1: number) => { out += closedPolyline(ly, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]); };
const C = (ly: string, x: number, y: number, r: number) => { out += circle(ly, P(x, y), r); };
/** TEXT; align 'C' / 'R' uses the R12 justification point. */
const T = (ly: string, x: number, y: number, s: string, h = 2.5, align: 'L' | 'C' | 'R' = 'L') => {
  const p = P(x, y);
  out += pair(0, 'TEXT') + pair(8, ly) + pair(10, num(p.x)) + pair(20, num(p.y)) + pair(30, '0.0') + pair(40, num(h)) + pair(1, escapeDxfUnicode(s)) + pair(7, VN_TEXT_STYLE);
  if (align !== 'L') out += pair(72, align === 'C' ? 1 : 2) + pair(11, num(p.x)) + pair(21, num(p.y)) + pair(31, '0.0');
};
const CW = 0.62; // Arial width / height, for layout estimates
const WRAP_CW = 0.68; // wider for wrapping: Vietnamese capitals and diacritics run long
const wrap = (s: string, maxChars: number): string[] => {
  const lines: string[] = []; let cur = '';
  for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
};
/** Paragraphs wrapped to a width; returns the y below the last line. */
const para = (x: number, y: number, width: number, items: string[], h = 2.5, gap = 1.6): number => {
  const max = Math.floor(width / (h * WRAP_CW));
  for (const s of items) {
    wrap(s, max).forEach((l, i) => { T(LY.text, x + (i ? 3 : 0), y, l, h); y -= h * gap; });
    y -= h * 0.3;
  }
  return y;
};
const viewTitle = (x: number, y: number, s: string, scale?: string) => {
  T(LY.text, x, y, s, 4); L(LY.text, x, y - 1.5, x + s.length * 4 * CW, y - 1.5);
  if (scale) T(LY.text, x, y - 6.5, scale, 2.8);
};
const dimV = (x: number, y0: number, y1: number, label: string, side: 1 | -1 = -1) => {
  L(LY.dim, x, y0, x, y1); L(LY.dim, x - 1.2, y0 - 1.2, x + 1.2, y0 + 1.2); L(LY.dim, x - 1.2, y1 - 1.2, x + 1.2, y1 + 1.2);
  T(LY.dim, x + side * 2, (y0 + y1) / 2 - 1, label, 2.2, side < 0 ? 'R' : 'L');
};
const dimH = (y: number, x0: number, x1: number, label: string) => {
  L(LY.dim, x0, y, x1, y); L(LY.dim, x0 - 1.2, y - 1.2, x0 + 1.2, y + 1.2); L(LY.dim, x1 - 1.2, y - 1.2, x1 + 1.2, y + 1.2);
  T(LY.dim, (x0 + x1) / 2, y + 1.5, label, 2.2, 'C');
};
const leader = (x0: number, y0: number, x1: number, y1: number, s: string, h = 2.3) => {
  L(LY.text, x0, y0, x1, y1); L(LY.text, x1, y1, x1 + 3, y1); T(LY.text, x1 + 4, y1 - h / 2, s, h);
};
interface Col<T> { title: string; w: number; v: (r: T) => string; align?: 'L' | 'C' | 'R' }
/** Grid table, top-left corner at (x, y); returns its bottom y. */
function table<T>(x: number, y: number, cols: Col<T>[], rows: T[], rowH = 6, h = 2.4, headH = rowH * 1.6): number {
  const W = cols.reduce((s, c) => s + c.w, 0);
  let cx = x;
  for (const c of cols) {
    const lines = wrap(c.title, Math.max(4, Math.floor((c.w - 1.5) / (h * CW))));
    lines.forEach((l, i) => T(LY.table, cx + c.w / 2, y - headH / 2 + ((lines.length - 1) / 2 - i) * h * 1.3 - h / 2, l, h, 'C'));
    cx += c.w;
  }
  rows.forEach((r, i) => {
    let cx2 = x; const yy = y - headH - (i + 1) * rowH + (rowH - h) / 2;
    for (const c of cols) {
      const a = c.align ?? 'C';
      T(LY.table, a === 'L' ? cx2 + 1.2 : a === 'R' ? cx2 + c.w - 1.2 : cx2 + c.w / 2, yy, c.v(r), h, a);
      cx2 += c.w;
    }
  });
  const bottom = y - headH - rows.length * rowH;
  L(LY.table, x, y, x + W, y); L(LY.table, x, y - headH, x + W, y - headH);
  for (let i = 1; i <= rows.length; i++) L(LY.table, x, y - headH - i * rowH, x + W, y - headH - i * rowH);
  cx = x; L(LY.table, cx, y, cx, bottom); for (const c of cols) { cx += c.w; L(LY.table, cx, y, cx, bottom); }
  return bottom;
}

/** A1 frame with the title block. */
function sheet(no: number, name: string, scale: string) {
  OX = (no - 1) * (SHEET_W + SHEET_GAP);
  R(LY.frame, 0, 0, SHEET_W, SHEET_H);
  R(LY.frame, 20, 10, SHEET_W - 10, SHEET_H - 10);
  const x0 = SHEET_W - 10 - 185, y0 = 10, y1 = 62;
  R(LY.frame, x0, y0, SHEET_W - 10, y1);
  for (const yy of [52, 42, 32, 22]) L(LY.frame, x0, yy, SHEET_W - 10, yy);
  L(LY.frame, x0 + 120, y0, x0 + 120, 22);
  T(LY.frame, x0 + 3, 55, 'DỰ ÁN: ĐIỆN MẶT TRỜI NỔI HỒ THỦY ĐIỆN HUỔI VANH — TỈNH ĐIỆN BIÊN', 3);
  T(LY.frame, x0 + 3, 45, 'HẠNG MỤC: HỆ NEO BÈ — CỌC KHOAN NHỒI VEN BỜ D350', 3);
  T(LY.frame, x0 + 3, 35, `TÊN BẢN VẼ: ${name}`, 3);
  T(LY.frame, x0 + 3, 25, `TỶ LỆ: ${scale}   |   ĐƠN VỊ: mm, cao độ m   |   NGÀY: ${ISSUE_DATE}`, 2.5);
  T(LY.frame, x0 + 3, 17, 'Thiết kế: ..............   Kiểm tra: ..............', 2.5);
  T(LY.frame, x0 + 3, 12.5, 'Chủ trì: ..............    Duyệt: ..............', 2.5);
  T(LY.frame, x0 + 152, 13, `CVB-0${no}`, 6, 'C');
  T(LY.frame, x0 + 3, y1 + 2, 'BẢN VẼ THI CÔNG — DỰ THẢO: đơn vị thiết kế có chứng chỉ ký, đóng dấu trước khi phát hành thi công.', 2.5);
}

/** Pile symbols, cables and C… marks of the setting-out plan at a given scale (k = symbol size factor). */
function drawPiles(X: (x: number) => number, Y: (y: number) => number, k: number, keep: (r: PileScheduleRow) => boolean = () => true, clip?: (a: Pt, b: Pt) => [Pt, Pt] | null): PileScheduleRow[] {
  const crowded: PileScheduleRow[] = [];
  // pile symbols are obstacles for the labels too
  const placed: number[][] = shore.filter(keep).map((r) => { const e = (r.pileCount > 1 ? 2.4 : 1.0 * k) + 0.2; return [X(r.x) - e, Y(r.y) - e, X(r.x) + e, Y(r.y) + e]; });
  for (const r of shore.filter(keep)) {
    const px = X(r.x), py = Y(r.y), rx = X(r.xRaft), ry = Y(r.yRaft);
    const sg = clip ? clip({ x: r.x, y: r.y }, { x: r.xRaft, y: r.yRaft }) : null;
    if (clip) { if (sg) L(LY.cable, X(sg[0].x), Y(sg[0].y), X(sg[1].x), Y(sg[1].y)); } else L(LY.cable, px, py, rx, ry);
    const ux = (px - rx) / (Math.hypot(px - rx, py - ry) || 1), uy = (py - ry) / (Math.hypot(px - rx, py - ry) || 1);
    if (r.pileCount > 1) {
      const tf = X(1) - X(0); // paper mm per metre: true size in the insets
      if (k > 1) { for (const s of [-1, 1]) C(LY.pile, px - uy * s * 0.525 * tf, py + ux * s * 0.525 * tf, Math.max(0.175 * tf, 0.4)); }
      else for (const s of [-1, 1]) C(LY.pile, px - uy * s * 1.1, py + ux * s * 1.1, 0.9);
      R(LY.pile, px - 2.4, py - 2.4, px + 2.4, py + 2.4);
    } else { C(LY.pile, px, py, 1.0 * k); C(LY.pile, px, py, 0.35 * k); }
    // label beyond the pile, away from the raft; slid sideways until it clears the labels already placed
    const label = markOf.get(r.code)!, lh = 1.8, lw = label.length * lh * 0.78; // generous: digits run wider than the average
    const align: 'L' | 'R' | 'C' = ux < -0.3 ? 'R' : ux > 0.3 ? 'L' : 'C';
    const box = (lx: number, ly: number) => { const x0 = align === 'L' ? lx : align === 'R' ? lx - lw : lx - lw / 2; return [x0 - 0.5, ly - 0.5, x0 + lw + 0.5, ly + lh + 0.5]; };
    const d0 = 3.2 + 1.0 * k;
    let best = { lx: px + ux * d0, ly: py + uy * d0 - 0.9 }, first = true;
    search: for (const d of [d0, d0 + 2.3, d0 + 4.8, d0 + 7.5, d0 + 10]) for (const side of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
      const lx = px + ux * d - uy * side * 2.3, ly = py + uy * d + ux * side * 2.3 - 0.9;
      const b0 = box(lx, ly);
      if (!placed.some((q) => b0[0] < q[2] && q[0] < b0[2] && b0[1] < q[3] && q[1] < b0[3])) { best = { lx, ly }; break search; }
      first = false;
    }
    if (!first) crowded.push(r);
    placed.push(box(best.lx, best.ly));
    if (Math.hypot(best.lx - px, best.ly + 0.9 - py) > d0 + 1) L(LY.mark, px + ux * 1.2 * k, py + uy * 1.2 * k, best.lx, best.ly + 0.9);
    T(LY.mark, best.lx, best.ly, label, lh, align);
  }
  return crowded;
}

// ------------------------------------------------------------------ CVB-01 setting-out plan
{
  sheet(1, 'MẶT BẰNG ĐỊNH VỊ CỌC KHOAN NHỒI VEN BỜ', '1:1250 (A1)');
  const outlines = buildRaftOutlines();
  const xs = [...outlines.flatMap((o) => o.points.map((p) => p.x)), ...shore.map((r) => r.x)];
  const ys = [...outlines.flatMap((o) => o.points.map((p) => p.y)), ...shore.map((r) => r.y)];
  const f = 1000 / 1250; // paper mm per metre
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const ax = 30, ay = 70; // bottom-left of the plan area
  const X = (x: number) => ax + (x - minX) * f + 12, Y = (y: number) => ay + (y - minY) * f + 14;
  viewTitle(30, SHEET_H - 22, 'MẶT BẰNG ĐỊNH VỊ CỌC KHOAN NHỒI VEN BỜ — 4 BÈ, 175 ĐIỂM NEO, 178 CỌC', 'TỶ LỆ 1:1250. Ký hiệu C1… giống bản vẽ mặt bằng hệ neo; tọa độ, cao độ từng cọc: tờ CVB-02.');
  // coordinate grid every 100 m
  const g0x = Math.ceil(minX / 100) * 100, g0y = Math.ceil(minY / 100) * 100;
  for (let gx = g0x; gx <= maxX; gx += 100) for (let gy = g0y; gy <= maxY; gy += 100) {
    L(LY.grid, X(gx) - 2, Y(gy), X(gx) + 2, Y(gy)); L(LY.grid, X(gx), Y(gy) - 2, X(gx), Y(gy) + 2);
  }
  for (let gx = g0x; gx <= maxX; gx += 100) { L(LY.grid, X(gx), ay + 5, X(gx), ay + 9); T(LY.grid, X(gx), ay + 1, `X=${gx}`, 2, 'C'); }
  for (let gy = g0y; gy <= maxY; gy += 100) { L(LY.grid, ax + 2, Y(gy), ax + 6, Y(gy)); T(LY.grid, ax + 1, Y(gy) + 1, `Y=${gy}`, 2, 'L'); }
  for (const o of outlines) {
    out += closedPolyline(LY.raft, o.points.map((p) => P(X(p.x), Y(p.y))));
    const cx = o.points.reduce((s, q) => s + q.x, 0) / o.points.length, cy = o.points.reduce((s, q) => s + q.y, 0) / o.points.length;
    T(LY.raft, X(cx), Y(cy), o.raft, 6, 'C');
  }
  const crowded = drawPiles(X, Y, 1);
  // enlarged insets where the marks had to be pushed aside: the three most crowded corners
  const near = (r: PileScheduleRow) => crowded.filter((q) => Math.hypot(q.x - r.x, q.y - r.y) < 15).length;
  const centres: PileScheduleRow[] = [];
  for (const r of [...crowded].sort((a, b) => near(b) - near(a))) {
    if (centres.length < 3 && centres.every((c) => Math.hypot(c.x - r.x, c.y - r.y) > 30)) centres.push(r);
  }
  const IN_SCALE = 500, IN_M = 30, fi = 1000 / IN_SCALE; // window side in metres
  centres.forEach((c, n) => {
    const cxm = shore.filter((q) => Math.hypot(q.x - c.x, q.y - c.y) < 15).reduce((s2, q, _, arr) => s2 + q.x / arr.length, 0);
    const cym = shore.filter((q) => Math.hypot(q.x - c.x, q.y - c.y) < 15).reduce((s2, q, _, arr) => s2 + q.y / arr.length, 0);
    const w0 = { x0: cxm - IN_M / 2, y0: cym - IN_M / 2, x1: cxm + IN_M / 2, y1: cym + IN_M / 2 };
    R(LY.text, X(w0.x0), Y(w0.y0), X(w0.x1), Y(w0.y1));
    T(LY.text, X(w0.x1) + 1, Y(w0.y1) + 1, `CT${n + 1}`, 2.5);
    const bx0 = 648 + n * 62, by0 = 80, side = IN_M * fi;
    R(LY.text, bx0, by0, bx0 + side, by0 + side);
    T(LY.text, bx0, by0 + side + 2, `CT${n + 1} — TỶ LỆ 1:${IN_SCALE}`, 2.5);
    const Xi = (x: number) => bx0 + (x - w0.x0) * fi, Yi = (y: number) => by0 + (y - w0.y0) * fi;
    const clip = (a: Pt, b: Pt): [Pt, Pt] | null => { // Liang–Barsky in metres
      let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
      for (const [pp, qq] of [[-dx, a.x - w0.x0], [dx, w0.x1 - a.x], [-dy, a.y - w0.y0], [dy, w0.y1 - a.y]]) {
        if (pp === 0) { if (qq < 0) return null; continue; }
        const t = qq / pp; if (pp < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
      return [{ x: a.x + t0 * dx, y: a.y + t0 * dy }, { x: a.x + t1 * dx, y: a.y + t1 * dy }];
    };
    for (const o of outlines) o.points.forEach((p, k) => { const q = o.points[(k + 1) % o.points.length]; const sg = clip(p, q); if (sg) L(LY.raft, Xi(sg[0].x), Yi(sg[0].y), Xi(sg[1].x), Yi(sg[1].y)); });
    drawPiles(Xi, Yi, 1.6, (r) => r.x > w0.x0 + 1 && r.x < w0.x1 - 1 && r.y > w0.y0 + 1 && r.y < w0.y1 - 1, clip);
  });
  // +Y arrow and legend on the right
  const lgx = 645, lgy = 545;
  L(LY.text, lgx + 150, lgy - 30, lgx + 150, lgy); L(LY.text, lgx + 150, lgy, lgx + 147, lgy - 6); L(LY.text, lgx + 150, lgy, lgx + 153, lgy - 6);
  T(LY.text, lgx + 150, lgy + 3, '+Y', 3.5, 'C');
  T(LY.text, lgx, lgy, 'CHÚ THÍCH', 3.5);
  C(LY.pile, lgx + 3, lgy - 10, 1.0); C(LY.pile, lgx + 3, lgy - 10, 0.35); T(LY.text, lgx + 9, lgy - 11, 'Cọc khoan nhồi đơn D350', 2.5);
  C(LY.pile, lgx + 2, lgy - 19, 0.9); C(LY.pile, lgx + 4.2, lgy - 19, 0.9); R(LY.pile, lgx + 0.7, lgy - 21.4, lgx + 5.5, lgy - 16.6); T(LY.text, lgx + 9, lgy - 20, 'Cọc đôi + đài BTCT (tờ CVB-04)', 2.5);
  L(LY.cable, lgx, lgy - 28, lgx + 6, lgy - 28); T(LY.text, lgx + 9, lgy - 29, 'Tuyến cáp neo về bè (phương đặt tai neo)', 2.5);
  T(LY.mark, lgx + 3, lgy - 38, 'C12', 1.8, 'C'); T(LY.text, lgx + 9, lgy - 38, 'Ký hiệu cọc', 2.5);
  let ny = lgy - 52;
  T(LY.text, lgx, ny, 'SỐ LƯỢNG THEO LOẠI CỌC', 3); ny -= 6;
  for (const t of types) { T(LY.text, lgx, ny, `${t.id}: ${t.rows.length} điểm × ${t.perPoint} cọc — ${t.perPoint > 1 ? 'cọc đôi ' : ''}${t.label} ${t.grade} — ${t.rafts.join(', ')}`, 2.3); ny -= 4.5; }
  ny -= 4;
  ny = para(lgx, ny, 182, [
    'GHI CHÚ:',
    '1. Tọa độ X, Y theo hệ tọa độ mặt bằng của dự án (cùng hệ với bản vẽ mặt bằng hệ neo và bản vẽ bố trí bè), đơn vị m. Chuyển sang VN-2000 theo mốc khống chế do Chủ đầu tư cấp trước khi định vị.',
    '2. Tim cọc định vị bằng toàn đạc điện tử từ ít nhất 2 mốc; sai số vị trí ≤ 75 mm. Cọc đôi: hai tim cách nhau 3D = 1.050 mm, vuông góc phương cáp, đối xứng qua tim điểm neo.',
    '3. Tai neo trên đầu cọc quay đúng phương cáp về bè (cột "Hướng tai neo" tờ CVB-02), sai lệch ≤ 5°.',
    '4. Cao độ mặt đất lấy từ mô hình địa hình IFC, CHƯA phải số đo. Đo lại cao độ thực tại từng tim cọc; nếu lệch > 0,5 m so với tờ CVB-02 thì báo thiết kế.',
    '5. Neo đáy hồ (đế BTCT + vít xoắn, D1…) không thuộc bộ bản vẽ này: xem bản vẽ mặt bằng hệ neo.',
    '6. Chỗ cọc dày (khung CT1…CT3 trên mặt bằng): đọc ký hiệu ở các chi tiết phóng to 1:500 góc dưới bên phải.'
  ], 2.3);
}

// ------------------------------------------------------------------ CVB-02 coordinates and levels
{
  sheet(2, 'BẢNG TỌA ĐỘ VÀ CAO ĐỘ CỌC KHOAN NHỒI', 'KHÔNG TỶ LỆ');
  viewTitle(30, SHEET_H - 22, 'BẢNG TỌA ĐỘ VÀ CAO ĐỘ CỌC KHOAN NHỒI VEN BỜ', `Cao độ đỉnh cọc = mặt đất + ${head.pileTopAboveGround_mm} mm; mũi cọc = mặt đất − L_tk. Hướng tai neo: góc từ trục +Y, theo chiều kim đồng hồ, từ cọc về bè.`);
  const fmt = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? '—' : vn(v, d));
  const bearing = (r: PileScheduleRow) => ((Math.atan2(r.xRaft - r.x, r.yRaft - r.y) * 180) / Math.PI + 360) % 360;
  const cols: Col<PileScheduleRow>[] = [
    { title: 'KH', w: 11, v: (r) => markOf.get(r.code)! },
    { title: 'Mã cọc', w: 17, v: (r) => r.pileId },
    { title: 'Dây', w: 15, v: (r) => r.code },
    { title: 'Bè', w: 11, v: (r) => r.raft.replace('BÈ ', 'B') },
    { title: 'Loại', w: 10, v: (r) => typeOf(r).id },
    { title: 'X (m)', w: 17, v: (r) => fmt(r.x), align: 'R' },
    { title: 'Y (m)', w: 17, v: (r) => fmt(r.y), align: 'R' },
    { title: 'Mặt đất (m)', w: 15, v: (r) => fmt(groundOf.get(r.code)), align: 'R' },
    { title: 'Đỉnh cọc (m)', w: 15, v: (r) => { const g = groundOf.get(r.code); return g == null ? '—' : vn(g + head.pileTopAboveGround_mm / 1000, 2); }, align: 'R' },
    { title: 'Mũi cọc (m)', w: 15, v: (r) => { const g = groundOf.get(r.code); return g == null ? '—' : vn(g - r.Linput_m, 2); }, align: 'R' },
    { title: 'L_tk (m)', w: 11, v: (r) => vn(r.Linput_m, 1) },
    { title: 'Hướng tai neo (°)', w: 15, v: (r) => vn(bearing(r), 1) }
  ];
  const W = cols.reduce((s, c) => s + c.w, 0);
  const perBlock = Math.ceil(shore.length / 3);
  for (let b = 0; b < 3; b++) table(25 + b * (W + 6), SHEET_H - 40, cols, shore.slice(b * perBlock, (b + 1) * perBlock), 7.4, 2.2, 10);
  T(LY.text, 25, 70, `Tổng: ${shore.length} điểm neo, ${shore.reduce((s, r) => s + r.pileCount, 0)} cọc. Cao độ mặt đất theo địa hình IFC (chưa khảo sát): đo lại tại hiện trường. Mực nước: MNC 380,0 — MNDB 384,5 — MNLKT 386,0 m.`, 2.5);
  T(LY.text, 25, 65, 'Cọc đôi (loại CĐ): tọa độ trong bảng là tim điểm neo; hai cọc đặt cách tim 525 mm về hai phía, vuông góc phương cáp.', 2.5);
}

// ------------------------------------------------------------------ CVB-03 pile types, elevation, sections, bar schedule
{
  sheet(3, 'CẤU TẠO CỌC KHOAN NHỒI D350 VÀ THỐNG KÊ CỐT THÉP', '1:20, 1:5 (A1)');
  const D = 350, k = 1 / 20;
  const t0 = types[0];
  const bodyLen = (t0.Ltk * 1000 + head.pileTopAboveGround_mm);
  // elevation 1:25
  const ex = 70, eyTop = SHEET_H - 75, r = (D / 2) * k, eyBot = eyTop - bodyLen * k;
  viewTitle(30, SHEET_H - 22, 'A. MẶT ĐỨNG CỌC ĐIỂN HÌNH', 'TỶ LỆ 1:20');
  const yGround = eyTop - head.pileTopAboveGround_mm * k;
  L(LY.ground, ex - 30, yGround, ex - r, yGround); L(LY.ground, ex + r, yGround, ex + 35, yGround);
  for (let x = ex - 28; x < ex - r; x += 4) L(LY.ground, x, yGround, x - 2, yGround - 2);
  for (let x = ex + r + 2; x < ex + 35; x += 4) L(LY.ground, x, yGround, x - 2, yGround - 2);
  T(LY.ground, ex - 30, yGround + 1.5, 'Mặt đất hoàn thiện', 2.2);
  R(LY.pile, ex - r, eyBot, ex + r, eyTop);
  R(LY.pile, ex - (head.collarSide_mm / 2) * k, eyTop - head.collarDepth_mm * k, ex + (head.collarSide_mm / 2) * k, eyTop);
  const bx = ((D - 2 * cover_mm) / 2) * k;
  const yBarTop = eyTop - TOP_GAP_M * 1000 * k, yBarBot = eyBot + BOTTOM_GAP_M * 1000 * k;
  L(LY.bar, ex - bx, yBarTop, ex - bx, yBarBot); L(LY.bar, ex + bx, yBarTop, ex + bx, yBarBot); L(LY.bar, ex, yBarTop, ex, yBarBot);
  for (let y = yBarTop - 1; y > yBarBot + 3; y -= SPIRAL.pitch * k) L(LY.bar, ex - bx, y, ex + bx, y - (SPIRAL.pitch / 2) * k);
  for (let d = 0.5; d < (bodyLen / 1000 - 0.2); d += RING.step_m) { const y = yBarTop - d * 1000 * k; L(LY.bar, ex - bx + 0.4, y, ex + bx - 0.4, y); }
  for (const y of [yGround - 1000 * k, yBarBot + 600 * k]) { C(LY.bar, ex - r + 0.6, y, 0.6); C(LY.bar, ex + r - 0.6, y, 0.6); }
  L(LY.pile, ex, eyBot - 5, ex, eyTop + 8);
  dimV(ex - 22, eyBot, yGround, `L_tk = ${vn(t0.Ltk * 1000, 0)}`);
  dimV(ex + 24, yBarBot, yBarTop, `Thép chủ ${vn((bodyLen - (TOP_GAP_M + BOTTOM_GAP_M) * 1000), 0)}`, 1);
  dimV(ex + 12, eyBot, yBarBot, `${BOTTOM_GAP_M * 1000}`, 1);
  leader(ex + r, eyTop - 2, ex + 40, eyTop + 6, `Mũ cọc, bản mã, tai neo: tờ CVB-04`);
  leader(ex + r, yGround, ex + 40, eyTop - 4, `Đỉnh cọc cao hơn mặt đất ${head.pileTopAboveGround_mm} mm`);
  leader(ex + bx, eyTop - 900 * k, ex + 40, eyTop - 14, '(1) Thép chủ: theo bảng loại cọc');
  leader(ex + bx / 2, eyTop - 1700 * k, ex + 40, eyTop - 24, `(2) Đai xoắn Φ${SPIRAL.dia} a${SPIRAL.pitch}, 1,5 vòng kín mỗi đầu`);
  leader(ex, yBarTop - 2500 * k, ex + 40, eyTop - 34, `(3) Vành cứng Φ${RING.dia} a${RING.step_m * 1000} hàn trong lồng`);
  leader(ex + r - 0.6, yGround - 1000 * k, ex + 40, eyTop - 44, 'Con kê bánh xe 3 con / mặt cắt, a ≤ 2.000');
  leader(ex + r, (eyTop + eyBot) / 2, ex + 40, eyTop - 54, `Bê tông B25 đổ tại chỗ; cặn lắng ≤ 50 mm`);
  { const ys = (eyTop + eyBot) / 2 - 20; for (const s of [-1, 1]) { L(LY.text, ex + s * (r + 2), ys, ex + s * (r + 8), ys); T(LY.text, ex + s * (r + 10), ys - 1.2, '1', 2.8, s < 0 ? 'R' : 'L'); } } // section mark

  // sections 1:5
  const sx0 = 300, sy = SHEET_H - 95, ks = 1 / 5, rs = (D / 2) * ks;
  viewTitle(240, SHEET_H - 22, 'B. MẶT CẮT 1-1 (THÂN CỌC)', 'TỶ LỆ 1:5');
  const sectionTypes = [...new Map(types.map((t) => [`${t.bars}Φ${t.dia}`, t])).values()];
  sectionTypes.forEach((t, i) => {
    const cx = sx0 + i * 105, cy = sy;
    C(LY.pile, cx, cy, rs);
    C(LY.bar, cx, cy, ((D - 2 * cover_mm) / 2 + t.dia / 2 + SPIRAL.dia / 2) * ks);
    for (let j = 0; j < t.bars; j++) { const a = Math.PI / 2 + (2 * Math.PI * j) / t.bars; C(LY.bar, cx + ((D - 2 * cover_mm) / 2) * ks * Math.cos(a), cy + ((D - 2 * cover_mm) / 2) * ks * Math.sin(a), (t.dia / 2) * ks); }
    for (let j = 0; j < 3; j++) { const a = Math.PI / 6 + (2 * Math.PI * j) / 3; C(LY.bar, cx + (rs - 3) * Math.cos(a), cy + (rs - 3) * Math.sin(a), 2.6); }
    dimH(cy - rs - 7, cx - rs, cx + rs, `D${D}`);
    dimH(cy + rs + 4, cx - ((D - 2 * cover_mm) / 2) * ks, cx + ((D - 2 * cover_mm) / 2) * ks, `Ø${cageDia_mm} (tim thép chủ)`);
    T(LY.text, cx, cy - rs - 15, `${t.bars}Φ${t.dia} — ${[...new Set(types.filter((q) => q.bars === t.bars && q.dia === t.dia).map((q) => q.grade))].join(' / ')}`, 2.8, 'C');
    T(LY.text, cx, cy - rs - 20, `Loại: ${types.filter((q) => q.bars === t.bars && q.dia === t.dia).map((q) => q.id).join(', ')}`, 2.4, 'C');
    T(LY.text, cx, cy - rs - 25, `a_s = ${cover_mm} mm mặt BT → tim thép chủ`, 2.4, 'C');
  });

  // pile types table
  let ty = SHEET_H - 175;
  T(LY.text, 205, ty + 6, 'C. BẢNG LOẠI CỌC', 4);
  const tcols: Col<PileType>[] = [
    { title: 'Loại', w: 14, v: (t) => t.id },
    { title: 'Kiểu', w: 25, v: (t) => (t.perPoint > 1 ? 'Cọc đôi + đài' : 'Cọc đơn') },
    { title: 'Bè / điểm áp dụng', w: 58, v: (t) => (t.perPoint > 1 ? t.rows.map((r) => `${markOf.get(r.code)} (${r.code})`).join(', ') : t.rafts.join(', ')), align: 'L' },
    { title: 'Số điểm', w: 14, v: (t) => String(t.rows.length) },
    { title: 'Số cọc', w: 14, v: (t) => String(t.rows.length * t.perPoint) },
    { title: 'D (mm)', w: 13, v: () => '350' },
    { title: 'L_tk (m)', w: 14, v: (t) => vn(t.Ltk, 1) },
    { title: 'Thép chủ', w: 17, v: (t) => t.label },
    { title: 'Mác thép chủ', w: 18, v: (t) => t.grade },
    { title: 'T dây thiết kế (kN)', w: 20, v: (t) => vn(Math.max(...t.rows.map((r) => r.Tmax_kN)), 1) },
    { title: 'HSSD uốn BP-2', w: 17, v: (t) => vn(Math.max(...t.rows.map((r) => r.bp2 ?? 0)), 2) }
  ];
  ty = table(205, ty, tcols, types, 6.5, 2.3, 10);
  T(LY.text, 205, ty - 5, `Thép ${types.some((t) => t.grade !== types[0].grade) ? 'CB400-V và CB500-V cùng đường kính: đánh dấu sơn màu đầu thanh / lồng theo mác, KHÔNG dùng lẫn.' : `${types[0].grade}.`} HSSD uốn = γ·M_max / M_rd, γ = ${vn(gamma, 1)}.`, 2.3);

  // bar schedule
  let by = ty - 24;
  T(LY.text, 205, by + 6, 'D. BẢNG THỐNG KÊ CỐT THÉP (1 CỌC VÀ TOÀN BỘ)', 4);
  interface BRow { type: string; b: Bar; piles: number }
  const brows: BRow[] = [];
  for (const t of types) for (const b of pileBars(t)) brows.push({ type: t.id, b, piles: t.rows.length * t.perPoint });
  const singlePoints = shore.filter((r) => r.pileCount === 1).length;
  for (const b of headBars) brows.push({ type: 'Đầu cọc đơn', b, piles: singlePoints });
  const bcols: Col<BRow>[] = [
    { title: 'Loại cọc', w: 22, v: (r) => r.type },
    { title: 'Số hiệu', w: 12, v: (r) => r.b.no },
    { title: 'Tên thanh', w: 92, v: (r) => r.b.name, align: 'L' },
    { title: 'Hình dạng', w: 16, v: (r) => r.b.shape },
    { title: 'Φ (mm)', w: 12, v: (r) => String(r.b.dia) },
    { title: 'Dài 1 thanh (m)', w: 18, v: (r) => vn(r.b.len_m, 2) },
    { title: 'Số thanh / cọc', w: 16, v: (r) => String(r.b.count) },
    { title: 'kg / cọc', w: 16, v: (r) => vn(barKg(r.b), 1) },
    { title: 'Số cọc', w: 13, v: (r) => String(r.piles) },
    { title: 'Tổng (kg)', w: 18, v: (r) => vn(barKg(r.b) * r.piles, 0) }
  ];
  by = table(205, by, bcols, brows, 6, 2.3, 10);
  const totalKg = brows.reduce((s, r) => s + barKg(r.b) * r.piles, 0);
  const byDia = new Map<number, number>(); for (const r of brows) byDia.set(r.b.dia, (byDia.get(r.b.dia) ?? 0) + barKg(r.b) * r.piles);
  T(LY.text, 205, by - 6, `TỔNG THÉP TRÒN THÂN CỌC (178 cọc) + THÉP NEO ĐẦU CỌC: ${vn(totalKg / 1000, 2)} tấn  (${[...byDia].sort((a, b) => a[0] - b[0]).map(([d, kg]) => `Φ${d}: ${vn(kg, 0)} kg`).join('; ')})`, 2.6);
  T(LY.text, 205, by - 11, `Bản mã + tai neo thép tấm SS400: ${vn(plateKg, 1)} kg / đầu cọc × ${singlePoints} = ${vn(plateKg * singlePoints, 0)} kg. Thép đài cọc đôi: tờ CVB-04. Chưa gồm hao hụt, nối, con kê.`, 2.4);
  T(LY.text, 205, by - 16, 'Vành cứng (3) là cấu tạo thi công, không có trong bảng thống kê vật tư neo (thêm khoảng 3 kg / cọc).', 2.4);
  const concrete = shore.reduce((s, r) => s + r.pileCount * (Math.PI * 0.35 ** 2 / 4) * (r.Linput_m + head.pileTopAboveGround_mm / 1000), 0);
  const collar = singlePoints * ((head.collarSide_mm / 1000) ** 2 - Math.PI * 0.35 ** 2 / 4) * head.collarDepth_mm / 1000;
  T(LY.text, 205, by - 21, `Bê tông B25 thân cọc (lý thuyết): ${vn(concrete, 1)} m³; mũ cọc phần ngoài thân cọc: ${vn(collar, 2)} m³. Khối lượng đổ thực tế ghi theo từng cọc (hao hụt bất thường = sạt thành lỗ).`, 2.4);
}

// ------------------------------------------------------------------ CVB-04 pile head and twin cap
{
  sheet(4, 'CHI TIẾT ĐẦU CỌC, TAI NEO VÀ ĐÀI CỌC ĐÔI', '1:5, 1:20 (A1)');
  const k = 1 / 5, ox = 95, oy = SHEET_H - 150;
  const X = (v: number) => ox + v * k, Y = (v: number) => oy + v * k;
  const top = head.pileTopAboveGround_mm, half = head.collarSide_mm / 2, r = 175, plateTop = top + head.plateThk_mm, pin = head.pinAboveGround_mm;
  viewTitle(30, SHEET_H - 22, 'A. ĐẦU CỌC ĐƠN — MẶT ĐỨNG THEO PHƯƠNG CÁP', 'TỶ LỆ 1:5');
  L(LY.ground, X(-700), Y(0), X(-half), Y(0)); L(LY.ground, X(half), Y(0), X(700), Y(0)); T(LY.ground, X(-690), Y(0) + 1.5, 'Mặt đất hoàn thiện', 2.2);
  R(LY.pile, X(-half), Y(top - head.collarDepth_mm), X(half), Y(top));
  L(LY.pile, X(-r), Y(top - head.collarDepth_mm), X(-r), Y(-900)); L(LY.pile, X(r), Y(top - head.collarDepth_mm), X(r), Y(-900));
  L(LY.pile, X(-r - 20), Y(-900), X(0), Y(-880)); L(LY.pile, X(0), Y(-880), X(r + 20), Y(-900));
  R(LY.steel, X(-head.plateSide_mm / 2), Y(top), X(head.plateSide_mm / 2), Y(plateTop));
  R(LY.steel, X(-head.padeyeWidth_mm / 2), Y(plateTop), X(head.padeyeWidth_mm / 2), Y(plateTop + head.padeyeHeight_mm));
  C(LY.steel, X(0), Y(pin), (head.holeDia_mm / 2) * k);
  for (const s of [-1, 1]) L(LY.steel, X((s * head.anchorBarSpacing_mm) / 2), Y(top), X((s * head.anchorBarSpacing_mm) / 2), Y(top - head.anchorBarLength_mm));
  for (const s of [-1, 1]) L(LY.bar, X(s * (r - cover_mm)), Y(top - TOP_GAP_M * 1000), X(s * (r - cover_mm)), Y(-880));
  L(LY.cable, X(60), Y(pin), X(700), Y(pin - 70)); T(LY.cable, X(450), Y(pin - 40) - 4, 'Cáp về bè', 2.2);
  dimV(X(-half) - 8, Y(0), Y(pin), `e = ${pin} (≤ ${Math.round(armE_m * 1000)})`);
  dimV(X(half) + 6, Y(top - head.collarDepth_mm), Y(top), `${head.collarDepth_mm}`, 1);
  dimH(Y(-900) - 6, X(-half), X(half), `${head.collarSide_mm}`);
  leader(X(head.padeyeWidth_mm / 2), Y(plateTop + 60), X(half) + 30, Y(pin) + 18, `Tai neo thép tấm t = ${head.padeyeThk_mm}, ${head.padeyeWidth_mm}×${head.padeyeHeight_mm}, lỗ Ø${head.holeDia_mm}; hàn góc hf = ${head.weldLeg_mm} hai mặt, hàn kín`);
  leader(X(0), Y(pin), X(half) + 30, Y(pin) + 10, `Ma-ní móng ngựa WLL ${vn(head.shackleWll_t, head.shackleWll_t % 1 ? 1 : 0)} T, chốt Ø${head.shacklePin_mm}, chốt an toàn`);
  leader(X(half), Y(top + 10), X(half) + 30, Y(top) + 1, `Bản mã ${head.plateSide_mm}×${head.plateSide_mm}×${head.plateThk_mm} SS400`);
  leader(X(half), Y(top - 150), X(half) + 30, Y(top) - 9, `Mũ cọc BT B25 ${head.collarSide_mm}×${head.collarSide_mm}×${head.collarDepth_mm}, đổ liền khối với đầu cọc`);
  leader(X(head.anchorBarSpacing_mm / 2), Y(top - 400), X(half) + 30, Y(top) - 19, `(4) ${head.anchorBarCount}Φ${head.anchorBarDia_mm} CB400-V L = ${head.anchorBarLength_mm}, hàn vào bản mã, nằm trong lồng thép`);
  leader(X(r - cover_mm), Y(-700), X(half) + 30, Y(top) - 29, `(1) Thép chủ cọc dừng cách đỉnh cọc ${TOP_GAP_M * 1000} mm`);
  // plan
  const px = 300, py = oy - 25;
  T(LY.text, px - half * k, py + half * k + 8, 'MẶT BẰNG ĐỈNH CỌC (1:5)', 3);
  R(LY.pile, px - half * k, py - half * k, px + half * k, py + half * k); C(LY.pile, px, py, r * k);
  R(LY.steel, px - (head.padeyeWidth_mm / 2) * k, py - (head.padeyeThk_mm / 2) * k, px + (head.padeyeWidth_mm / 2) * k, py + (head.padeyeThk_mm / 2) * k);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) C(LY.steel, px + ((sx * head.anchorBarSpacing_mm) / 2) * k, py + ((sy * head.anchorBarSpacing_mm) / 2) * k, (head.anchorBarDia_mm / 2) * k);
  L(LY.cable, px + (head.padeyeWidth_mm / 2) * k, py, px + half * k + 25, py); T(LY.cable, px + half * k + 5, py + 1.5, 'Phương cáp', 2.2);
  dimH(py - half * k - 6, px - (head.anchorBarSpacing_mm / 2) * k, px + (head.anchorBarSpacing_mm / 2) * k, `${head.anchorBarSpacing_mm}`);
  T(LY.text, px - half * k, py - half * k - 15, 'Tai neo song song phương cáp (hướng tai neo: tờ CVB-02).', 2.3);
  // checks
  let cy = 238;
  T(LY.text, 30, cy, `KIỂM TRA ĐẦU CỌC — lực kéo thiết kế ${vn(head.designPull_kN, 1)} kN (cọc chịu lực lớn nhất × γ = ${vn(gamma, 1)})`, 3); cy -= 6;
  for (const c of head.checks) { T(LY.text, 33, cy, `${c.id}  ${c.label}: ${vn(c.demand, c.unit === '-' ? 2 : 1)} / ${vn(c.capacity, c.unit === '-' ? 2 : 1)} ${c.unit === '-' ? '' : c.unit} → ${vn(c.utilization, 2)} ${c.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`, 2.3); cy -= 4.4; }
  T(LY.text, 33, cy - 2, 'Một chi tiết đầu cọc cho mọi cọc đơn (thiết kế với cọc chịu lực lớn nhất).', 2.3);

  // twin cap 1:20
  const ct = capTypes[0];
  if (ct) {
    const c = ct.cap, kc = 1 / 20, qx = 520, qy = SHEET_H - 95;
    viewTitle(470, SHEET_H - 22, `B. ĐÀI CỌC ĐÔI ${capTypes.map((t) => t.id).join(', ')} — MẶT BẰNG VÀ MẶT CẮT`, 'TỶ LỆ 1:20 (mặt bằng), 1:10 (mặt cắt)');
    const Lc = c.length_mm * kc, Wc = c.width_mm * kc;
    R(LY.pile, qx - Lc / 2, qy - Wc / 2, qx + Lc / 2, qy + Wc / 2);
    for (const s of [-1, 1]) { C(LY.pile, qx + (s * c.spacing_mm / 2) * kc, qy, 175 * kc); }
    R(LY.steel, qx - (c.head.padeyeWidth_mm / 2) * kc, qy - 1, qx + (c.head.padeyeWidth_mm / 2) * kc, qy + 1);
    L(LY.cable, qx, qy + Wc / 2, qx, qy + Wc / 2 + 20); T(LY.cable, qx + 2, qy + Wc / 2 + 15, 'Phương cáp (vuông góc trục đài)', 2.2);
    dimH(qy - Wc / 2 - 6, qx - Lc / 2, qx + Lc / 2, `${c.length_mm}`);
    dimH(qy - Wc / 2 - 13, qx - (c.spacing_mm / 2) * kc, qx + (c.spacing_mm / 2) * kc, `${c.spacing_mm} = 3D`);
    dimV(qx + Lc / 2 + 6, qy - Wc / 2, qy + Wc / 2, `${c.width_mm}`, 1);
    // section 1:10 across the beam
    const k2 = 1 / 10, sx = 560, sy = SHEET_H - 175;
    const w = c.width_mm * k2, d = c.depth_mm * k2;
    T(LY.text, sx - w / 2 - 20, sy + d / 2 + 9, 'MẶT CẮT NGANG ĐÀI (1:10)', 3);
    R(LY.pile, sx - w / 2, sy - d / 2, sx + w / 2, sy + d / 2);
    L(LY.ground, sx - w / 2 - 20, sy + d / 2, sx - w / 2, sy + d / 2); L(LY.ground, sx + w / 2, sy + d / 2, sx + w / 2 + 20, sy + d / 2);
    R(LY.bar, sx - w / 2 + 5, sy - d / 2 + 5, sx + w / 2 - 5, sy + d / 2 - 5);
    const n = c.faceBars.count;
    for (let i = 0; i < n; i++) { const yy = sy - d / 2 + 5 + 1 + ((d - 12) * i) / Math.max(1, n - 1); C(LY.bar, sx - w / 2 + 6.3, yy, (c.faceBars.dia_mm / 2) * k2); C(LY.bar, sx + w / 2 - 6.3, yy, (c.faceBars.dia_mm / 2) * k2); }
    for (const s of [-1, 1]) for (const t of [-1, 1]) C(LY.bar, sx + s * (w / 2 - 14), sy + t * (d / 2 - 6.3), (c.topBottomBars.dia_mm / 2) * k2);
    L(LY.pile, sx - 175 * k2, sy - d / 2, sx - 175 * k2, sy - d / 2 - 25); L(LY.pile, sx + 175 * k2, sy - d / 2, sx + 175 * k2, sy - d / 2 - 25);
    T(LY.text, sx, sy - d / 2 - 30, 'Cọc D350 ngàm vào đài 100 mm', 2.2, 'C');
    R(LY.steel, sx - (c.head.plateSide_mm / 2) * k2, sy + d / 2, sx + (c.head.plateSide_mm / 2) * k2, sy + d / 2 + c.head.plateThk_mm * k2);
    R(LY.steel, sx - (c.head.padeyeThk_mm / 2) * k2, sy + d / 2 + c.head.plateThk_mm * k2, sx + (c.head.padeyeThk_mm / 2) * k2, sy + d / 2 + (c.head.plateThk_mm + c.head.padeyeHeight_mm) * k2);
    dimH(sy - d / 2 - 38, sx - w / 2, sx + w / 2, `${c.width_mm}`);
    dimV(sx + w / 2 + 6, sy - d / 2, sy + d / 2, `${c.depth_mm}`, 1);
    leader(sx + w / 2 - 6.3, sy, sx + w / 2 + 30, sy + 8, `(5) ${c.faceBars.count}Φ${c.faceBars.dia_mm} mỗi mặt bên`);
    leader(sx + w / 2 - 14, sy + d / 2 - 6.3, sx + w / 2 + 30, sy + 16, `(6) ${c.topBottomBars.count}Φ${c.topBottomBars.dia_mm} trên / dưới`);
    leader(sx - w / 2 + 5, sy - d / 2 + 15, sx - w / 2 - 15, sy - d / 2 - 12, `(7) Đai kín Φ${c.stirrup.dia_mm} a${c.stirrup.spacing_mm}`);
    leader(sx, sy + d / 2 + 3, sx + w / 2 + 30, sy + d / 2 + 10, `Bản mã + tai neo như đầu cọc đơn (t tai neo ${c.head.padeyeThk_mm})`);
    T(LY.text, 470, sy - d / 2 - 48, `Thép chủ cọc neo vào đài: móc 90°, đoạn thẳng 20d = ${20 * Math.max(...twinRows.map((q) => q.rebarDia_mm))} mm. Đỉnh đài ngang mặt đất hoàn thiện.`, 2.3);
    // cap checks and bars
    let qy2 = sy - d / 2 - 58;
    T(LY.text, 470, qy2, `KIỂM TRA ĐÀI ${ct.id} — áp dụng: ${ct.codes.map((q) => `${markOf.get(q)} (${q})`).join(', ')}`, 2.8); qy2 -= 5.5;
    for (const ch of c.checks.filter((q) => q.id.startsWith('TC'))) { T(LY.text, 473, qy2, `${ch.id}  ${ch.label}: ${vn(ch.utilization, 2)} ${ch.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`, 2.3); qy2 -= 4.4; }
    for (const other of capTypes.slice(1)) { T(LY.text, 473, qy2, `Đài ${other.id} (${other.codes.join(', ')}): ${other.cap.length_mm}×${other.cap.width_mm}×${other.cap.depth_mm}, ${other.cap.faceBars.count}Φ${other.cap.faceBars.dia_mm} mỗi mặt, đai a${other.cap.stirrup.spacing_mm}`, 2.3); qy2 -= 4.4; }
    qy2 -= 4;
    interface CRow { id: string; b: Bar; n: number }
    const crow: CRow[] = capTypes.flatMap((t) => capBars(t.cap).map((b) => ({ id: t.id, b, n: t.codes.length })));
    qy2 = table(470, qy2, [
      { title: 'Đài', w: 10, v: (q) => q.id },
      { title: 'SH', w: 9, v: (q) => q.b.no },
      { title: 'Tên thanh', w: 70, v: (q) => q.b.name, align: 'L' },
      { title: 'Φ', w: 9, v: (q) => String(q.b.dia) },
      { title: 'Dài (m)', w: 14, v: (q) => vn(q.b.len_m, 2) },
      { title: 'SL / đài', w: 13, v: (q) => String(q.b.count) },
      { title: 'kg / đài', w: 14, v: (q) => vn(barKg(q.b), 1) },
      { title: 'Số đài', w: 12, v: (q) => String(q.n) },
      { title: 'Tổng (kg)', w: 16, v: (q) => vn(barKg(q.b) * q.n, 0) }
    ], crow, 6, 2.2, 9);
    const capConc = capTypes.reduce((s, t) => s + t.cap.concrete_m3 * t.codes.length, 0);
    T(LY.text, 470, qy2 - 6, `Bê tông đài B25: ${vn(capConc, 2)} m³ (${caps.length} đài). Thép đài: ${vn(crow.reduce((s, q) => s + barKg(q.b) * q.n, 0), 0)} kg. Bản mã + tai neo đài: ${caps.length} bộ như đầu cọc đơn.`, 2.3);
    T(LY.text, 470, qy2 - 11, 'Đài cọc đôi là THIẾT KẾ SƠ BỘ (twinPileCap.ts): uốn ngang, cắt, xoắn, neo thép cọc — kỹ sư kết cấu kiểm tra lại.', 2.3);
  }
}

// ------------------------------------------------------------------ CVB-05 sequence and notes
const STEPS: Array<[string, string[]]> = [
  ['1. ĐỊNH VỊ, SÀN CÔNG TÁC', ['Trắc đạc tim cọc theo tờ CVB-02, sai số ≤ 75 mm.', 'Đào bậc / đắp sàn tạm 2,0 × 2,0 m phẳng, chắc.', 'Rãnh chặn nước mặt phía trên, bờ bao phía hồ.']],
  ['2. KHOAN TẠO LỖ, ỐNG VÁCH', ['Khoan xoắn D350 thẳng đứng, ống vách thép', 'tạm D400 dài 1,0–1,5 m giữ miệng lỗ.', 'Đất khoan gom lên bãi, KHÔNG đẩy xuống hồ.']],
  ['3. NGHIỆM THU LỖ', ['Chiều sâu ≥ L_tk; độ thẳng đứng ≤ 1 %.', 'Vét sạch đáy, cặn lắng ≤ 50 mm.', 'Sạt thành / gặp đất khác giả định: dừng, báo TK.']],
  ['4. HẠ LỒNG THÉP', ['Nghiệm thu lồng đúng LOẠI cọc (CVB-03).', 'Gắn con kê; hạ thẳng, không xoắn, không chạm', 'thành; treo lồng cách đáy 100 mm.']],
  ['5. ĐỔ BÊ TÔNG', ['Đổ trong 4 giờ sau khi khoan xong, liên tục.', 'Lỗ có nước: ống tremie, ngập ≥ 1,5 m.', 'Lỗ khô: ống / máng, rơi tự do ≤ 1,5 m.']],
  ['6. RÚT ỐNG VÁCH', ['Rút ống vách khi bê tông còn dẻo, bù BT.', 'Đổ vượt cao độ, đục bỏ lớp BT xấu.', 'Bảo dưỡng ẩm ≥ 7 ngày.']],
  ['7. MŨ CỌC, BẢN MÃ', ['Đặt bản mã + thép neo bằng dưỡng gá;', 'tai neo đúng hướng (CVB-02). Đổ mũ cọc / đài', `liền khối; tim chốt cách đất ≤ ${Math.round(armE_m * 1000)} mm.`]],
  ['8. HOÀN TRẢ, LẮP CÁP', ['Lắp ma-ní, cáp khi BT ≥ 90 % cường độ.', 'Đầm chặt đất quanh cọc, gia cố taluy.', 'Thử kéo ngang cọc thử theo đề cương.']]
];
const singleT = Math.max(...shore.filter((r) => r.pileCount === 1).map((r) => r.Tmax_kN));
const NOTES: Array<[string, string[]]> = [
  ['1. CƠ SỞ THIẾT KẾ', [
    `Mặt bằng 4 bè theo bản vẽ CAD của Chủ đầu tư 27/10/2026, 18.914 tấm pin nghiêng ${vn(state.raft.solarTilt_deg ?? 10, 0)}°. Lực dây theo mô hình cân bằng tĩnh ở mọi mực nước (MNC 380,0 – MNLKT 386,0 m); điều kiện bắt buộc: chỉnh lại mọi dây cho vừa căng mỗi khi mực nước đổi 1 m.`,
    `Gió tính toán V = ${vn(state.env.windSpeed_ms, 0)} m/s. ${designWindCaveat(state.env.windSpeed_ms) ?? ''}`,
    `Cọc chọn theo lực của chính dây nối vào cọc (lực dây lớn nhất cọc đơn ${vn(singleT, 1)} kN); hệ số tải trọng uốn γ = ${vn(gamma, 1)}; cọc đôi: mỗi cọc chịu T / (2 × ${vn(state.anchor.pileGroupEfficiency ?? 0.9, 1)}) (hệ số nhóm GIẢ ĐỊNH).`,
    'Sức chịu ngang theo Broms, uốn theo TCVN 5574:2018 với lồng thép ở hướng bất lợi nhất. Đất sét dẻo cứng φ = 28°, c = 12 kPa, c_u = 40 kPa, γ = 18 kN/m³: GIẢ ĐỊNH, chưa khoan khảo sát.'
  ]],
  ['2. VẬT LIỆU', [
    'Bê tông cọc, mũ cọc, đài: B25, đá 1×2, độ sụt 16–18 cm khi đổ qua ống tremie. Lấy mẫu nén mỗi đợt đổ.',
    'Thép chủ CB400-V / CB500-V theo bảng loại cọc (TCVN 1651-2:2018); đai, vành cứng CB240-T / CB300-V. Không hàn nối thép chủ (lồng một đoạn).',
    `Bản mã, tai neo SS400, que hàn E42; ma-ní WLL ${vn(head.shackleWll_t, head.shackleWll_t % 1 ? 1 : 0)} T có chốt an toàn. Bản mã, tai neo, đường hàn mạ kẽm nhúng nóng hoặc sơn epoxy 2 lớp (đầu cọc ngập khi hồ ở MNLKT).`
  ]],
  ['3. YÊU CẦU BẮT BUỘC', [
    `Tim chốt cáp cách mặt đất hoàn thiện ≤ ${Math.round(armE_m * 1000)} mm; không đào hạ mặt đất quanh cọc sau thi công. Taluy xói lộ thân cọc: dừng khai thác điểm neo, báo thiết kế.`,
    'Đúng loại lồng thép từng điểm (cột "Loại" tờ CVB-02). CB400-V và CB500-V cùng Φ28: đánh dấu màu, nghiệm thu từng lồng.',
    'Thử kéo ngang ít nhất 2 cọc thử (hoặc 1 % số cọc) tới 1,5 lần lực thiết kế TRƯỚC khi thi công đại trà, để kiểm chứng đất giả định.'
  ]],
  ['4. SAI SỐ (đề xuất theo TCVN 9395:2012)', [
    'Tim cọc ≤ 75 mm; nghiêng ≤ 1 %; đường kính, chiều sâu lỗ không nhỏ hơn thiết kế; cao độ đỉnh cọc ± 30 mm.',
    'Lồng thép: khoảng cách thép chủ ± 10 mm; bước đai ± 20 mm; đường kính lồng ± 10 mm; chiều dài ± 50 mm.'
  ]],
  ['5. AN TOÀN VÀ MÔI TRƯỜNG', [
    'Không thi công khi mưa lớn hoặc nước hồ lên nhanh; máy khoan trên sàn phẳng có chèn chống trượt. Miệng lỗ có nắp đậy và rào; công nhân đeo dây an toàn, áo phao.',
    'Đất khoan, nước rửa, bê tông thừa, dầu mỡ thu gom lên bãi thải; quây phao / lưới chắn bùn phía hồ.'
  ]],
  ['6. VẤN ĐỀ CÒN MỞ — PHẢI GIẢI QUYẾT TRƯỚC KHI THI CÔNG', [
    `LỚP BẢO VỆ: a_s = ${cover_mm} mm tới tim thép chủ nên lớp bê tông bảo vệ thực tới đai xoắn chỉ ${vn(cover_mm - 28 / 2 - SPIRAL.dia, 0)}–${vn(cover_mm - 25 / 2 - SPIRAL.dia, 0)} mm (cọc khoan nhồi thường ≥ 50 mm). Tăng lớp bảo vệ mà giữ D350 thì thép hiện có KHÔNG còn đủ: phải tăng D hoặc tính lại. CHỜ CHỦ ĐẦU TƯ QUYẾT ĐỊNH.`,
    'Cao độ mặt đất từ mô hình IFC, chưa phải đo đạc; đất bờ chưa khảo sát (độ nhạy: c_u 30 kPa làm một số cọc vượt khả năng).',
    'Chưa thiết kế: lực cắt thân cọc (đai xoắn là cấu tạo), trường hợp đứt một dây cho cọc đơn theo lực dây.'
  ]]
];
{
  sheet(5, 'TRÌNH TỰ THI CÔNG VÀ GHI CHÚ', 'KHÔNG TỶ LỆ (A1)');
  viewTitle(30, SHEET_H - 22, 'A. TRÌNH TỰ THI CÔNG CỌC KHOAN NHỒI VEN BỜ', 'SƠ ĐỒ NGUYÊN LÝ, KHÔNG THEO TỶ LỆ');
  const pw = 98, ph = 160, x0 = 30, y0 = SHEET_H - 40;
  STEPS.forEach(([name, txt], i) => {
    const col = i % 4, row = Math.floor(i / 4), bx = x0 + col * pw, by = y0 - row * ph;
    R(LY.table, bx, by - ph + 4, bx + pw - 4, by);
    T(LY.step, bx + 3, by - 8, name, 3.2);
    const cx = bx + 45, gy = by - 45, depth = 55, w = 6;
    const g = (x: number) => gy - 0.35 * (x - cx);
    L(LY.ground, bx + 4, g(bx + 4), cx - 12, g(cx - 12)); L(LY.ground, cx - 12, gy, cx + 12, gy); L(LY.ground, cx + 12, gy, bx + pw - 8, g(bx + pw - 8) + 4.2);
    L(LY.ground, cx - 12, g(cx - 12), cx - 12, gy);
    if (i >= 1) { L(LY.pile, cx - w / 2, gy, cx - w / 2, gy - depth); L(LY.pile, cx + w / 2, gy, cx + w / 2, gy - depth); L(LY.pile, cx - w / 2, gy - depth, cx + w / 2, gy - depth); }
    if (i === 0) { L(LY.step, cx, gy, cx, gy + 10); L(LY.step, cx - 3, gy + 10, cx + 3, gy + 10); T(LY.step, cx + 4, gy + 7, 'Cọc tim', 2.2); }
    if (i >= 1 && i <= 4) { R(LY.step, cx - w / 2 - 1, gy - 12, cx - w / 2, gy + 3); R(LY.step, cx + w / 2, gy - 12, cx + w / 2 + 1, gy + 3); }
    if (i === 1) { L(LY.step, cx, gy + 18, cx, gy - depth + 3); for (let y = gy - 4; y > gy - depth + 3; y -= 5) L(LY.step, cx - 2, y, cx + 2, y - 2); T(LY.step, cx + 4, gy + 14, 'Cần khoan xoắn', 2.2); }
    if (i === 2) { L(LY.dim, cx + 12, gy, cx + 12, gy - depth); T(LY.dim, cx + 14, gy - depth / 2, '≥ L_tk', 2.2); }
    if (i >= 3) { for (const s of [-1, 1]) L(LY.bar, cx + s * (w / 2 - 1), gy - 1, cx + s * (w / 2 - 1), gy - depth + 1.5); for (let y = gy - 3; y > gy - depth + 2; y -= 4) L(LY.bar, cx - w / 2 + 1, y, cx + w / 2 - 1, y - 2); }
    if (i === 4) { R(LY.step, cx - 0.7, gy - depth + 7, cx + 0.7, gy + 12); L(LY.step, cx - 4, gy + 16, cx - 0.7, gy + 12); L(LY.step, cx + 4, gy + 16, cx + 0.7, gy + 12); L(LY.step, cx - 4, gy + 16, cx + 4, gy + 16); T(LY.step, cx + 6, gy + 13, 'Phễu + ống đổ', 2.2); }
    if (i >= 4) { const fill = i === 4 ? gy - depth + 20 : gy; for (let y = gy - depth + 2; y < fill; y += 3) L(LY.pile, cx - w / 2 + 0.3, y, cx + w / 2 - 0.3, y); }
    if (i >= 6) { R(LY.pile, cx - 4, gy - 4.5, cx + 4, gy + 0.4); R(LY.steel, cx - 4, gy + 0.4, cx + 4, gy + 1); R(LY.steel, cx - 2, gy + 1, cx + 2, gy + 3.5); }
    if (i === 7) { L(LY.cable, cx + 1, gy + 2.2, bx + pw - 10, gy - 12); T(LY.cable, cx + 18, gy - 4, 'Cáp về bè', 2.2); }
    txt.forEach((s, j) => T(LY.text, bx + 3, by - ph + 26 - j * 5.5, s, 2.6));
  });
  let y = SHEET_H - 40;
  viewTitle(430, SHEET_H - 22, 'B. GHI CHÚ');
  for (const [h, items] of NOTES) { T(LY.text, 430, y, h, 3.2); y -= 6; y = para(433, y, 392, items.map((s) => `– ${s}`), 2.6, 1.55); y -= 3; }
}

// ------------------------------------------------------------------ write
let tables = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length + 1) + pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, 7) + pair(6, 'CONTINUOUS');
for (const l of LAYERS) tables += pair(0, 'LAYER') + pair(2, l.name) + pair(70, 0) + pair(62, l.color) + pair(6, 'CONTINUOUS');
tables += pair(0, 'ENDTAB');
tables += pair(0, 'TABLE') + pair(2, 'STYLE') + pair(70, 1) + pair(0, 'STYLE') + pair(2, VN_TEXT_STYLE) + pair(70, 0) + pair(40, 0) + pair(41, 1) + pair(50, 0) + pair(71, 0) + pair(42, 2.5) + pair(3, 'arial.ttf') + pair(4, '') + pair(0, 'ENDTAB');
const dxf = pair(0, 'SECTION') + pair(2, 'HEADER') + pair(9, '$ACADVER') + pair(1, 'AC1009') + pair(9, '$INSUNITS') + pair(70, 4) + pair(9, '$MEASUREMENT') + pair(70, 1) + pair(0, 'ENDSEC')
  + pair(0, 'SECTION') + pair(2, 'TABLES') + tables + pair(0, 'ENDSEC')
  + pair(0, 'SECTION') + pair(2, 'ENTITIES') + out + pair(0, 'ENDSEC') + pair(0, 'EOF');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'ban_ve_thi_cong_coc_khoan_nhoi.dxf'), dxf);
console.log(JSON.stringify({
  sheets: 5, piles: shore.reduce((s, r) => s + r.pileCount, 0), points: shore.length,
  types: types.map((t) => `${t.id} ${t.rows.length}x${t.perPoint} ${t.label} ${t.grade} ${t.rafts.join('/')}`),
  caps: capTypes.map((t) => `${t.id} ${t.cap.length_mm}x${t.cap.width_mm}x${t.cap.depth_mm} ${t.codes.join(',')}`),
  noGround: shore.filter((r) => groundOf.get(r.code) == null).map((r) => r.code),
  ascii: !/[^\x0A\x20-\x7E]/.test(dxf), bytes: dxf.length
}));
