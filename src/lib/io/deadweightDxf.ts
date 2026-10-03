import type { CalcResults, ProjectState } from '../calc/types';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import { buildRaftOutlines, PileScheduleBatchLike, PileScheduleRow } from './pileSchedule';
import { buildDeadweightSchedule, BlockScheduleRow, DeadweightSchedule } from './deadweightSchedule';
import {
  ACI, Pt, line, circle, point, text, square, closedPolyline, dxfDocument, dxfStampedName, downloadDxf
} from './dxfExport';

/**
 * Option 2 setting-out drawing: 129 square RC shore piles + 175 lake-bed
 * gravity blocks, ASCII DXF R12, same site-local metres as the option 1 sheet
 * (`dxfExport.ts`, which is untouched by this module).
 *
 * Every number on the sheet comes from the calculation: block sizes and
 * safety factors from `results.bedBlock`, pile values from the pile schedule.
 * The block detail is a DIMENSION sketch only — reinforcement, lifting points
 * and the cable padeye have not been designed and are not drawn.
 */
export const DXF_LAYERS_PA2 = {
  raft: { name: '01_BE_PIN', color: ACI.cyan },
  shoreLine: { name: '02_DAY_NEO_BO', color: ACI.green },
  bedLine: { name: '03_DAY_NEO_DAY', color: ACI.red },
  shorePile: { name: '04_COC_NEO_BO', color: ACI.yellow },
  block: { name: '05_KHOI_NEO_DAY_BE_TONG', color: ACI.magenta },
  text: { name: '06_TOA_DO_TEXT', color: ACI.white },
  shoreTable: { name: '07_BANG_THONG_KE_COC_BO', color: ACI.white },
  blockTable: { name: '08_BANG_THONG_KE_KHOI_NEO_DAY', color: ACI.white },
  detail: { name: '09_CHI_TIET_CAU_TAO', color: ACI.yellow }
} as const;

interface Column<T> { title: string; width: number; value: (r: T) => string }

const sf = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : 'VO CUNG');

const SHORE_COLUMNS: Column<PileScheduleRow>[] = [
  { title: 'MA COC', width: 14, value: (r) => r.pileId },
  { title: 'KY HIEU KS', width: 12, value: (r) => r.code },
  { title: 'CUM BE', width: 10, value: (r) => r.raft },
  { title: 'X (m)', width: 12, value: (r) => r.x.toFixed(2) },
  { title: 'Y (m)', width: 12, value: (r) => r.y.toFixed(2) },
  { title: 'Z (m)', width: 10, value: (r) => r.z.toFixed(2) },
  { title: 'CANH a (m)', width: 12, value: (r) => r.D_m.toFixed(2) },
  { title: 'L_opt (m)', width: 11, value: (r) => (r.Lopt_m === null ? 'KHONG DAT' : r.Lopt_m.toFixed(2)) },
  { title: 'L_tk (m)', width: 10, value: (r) => r.Linput_m.toFixed(2) },
  { title: 'T_max (kN)', width: 12, value: (r) => r.Tmax_kN.toFixed(1) },
  { title: 'P_max (kN)', width: 12, value: (r) => r.Pmax_kN.toFixed(1) },
  { title: 'KET LUAN', width: 11, value: (r) => (r.isPmaxOk ? 'DAT' : 'KIEM TRA') }
];

const BLOCK_COLUMNS: Column<BlockScheduleRow>[] = [
  { title: 'MA KHOI', width: 14, value: (r) => r.blockId },
  { title: 'KY HIEU KS', width: 12, value: (r) => r.code },
  { title: 'CUM BE', width: 10, value: (r) => r.raft },
  { title: 'X (m)', width: 12, value: (r) => r.x.toFixed(2) },
  { title: 'Y (m)', width: 12, value: (r) => r.y.toFixed(2) },
  { title: 'Z (m)', width: 10, value: (r) => r.z.toFixed(2) },
  { title: 'L (m)', width: 8, value: (r) => r.L_m.toFixed(2) },
  { title: 'W (m)', width: 8, value: (r) => r.W_m.toFixed(2) },
  { title: 'H (m)', width: 8, value: (r) => r.H_m.toFixed(2) },
  { title: 'V (m3)', width: 9, value: (r) => r.volume_m3.toFixed(1) },
  { title: 'W_kk (T)', width: 10, value: (r) => r.mass_t.toFixed(1) },
  { title: 'T_max (kN)', width: 12, value: (r) => r.Tmax_kN.toFixed(1) },
  { title: 'SF_truot', width: 10, value: (r) => sf(r.sfSlide) },
  { title: 'SF_nho', width: 9, value: (r) => sf(r.sfUplift) },
  { title: 'SF_lat', width: 9, value: (r) => sf(r.sfOverturn) },
  { title: 'q_day (kPa)', width: 12, value: (r) => (Number.isFinite(r.qContact_kPa) ? r.qContact_kPa.toFixed(1) : 'VO CUNG') },
  { title: 'KET LUAN', width: 11, value: (r) => (r.ok ? 'DAT' : 'KHONG DAT') },
  { title: 'CHONG LAN VOI', width: 22, value: (r) => (r.clashWith.length ? r.clashWith.join(', ') : '-') }
];

/** A grid table (LINEs + TEXT cells); returns the entities and the table's width. */
function table<T>(layer: string, titles: string[], columns: Column<T>[], rows: T[], origin: Pt, h: number): { dxf: string; width: number } {
  const rowH = h * 2.2;
  const pad = h * 0.4;
  const widths = columns.map((c) => c.width * h * 0.75);
  const totalW = widths.reduce((s, w) => s + w, 0);
  let out = '';
  let y = origin.y;
  for (const t of titles) {
    out += text(layer, { x: origin.x, y }, h * 1.3, t);
    y -= rowH;
  }
  y -= rowH * 0.3;
  const top = y;
  const drawRow = (cells: string[], rowTop: number) => {
    let x = origin.x, s = '';
    for (let i = 0; i < cells.length; i++) {
      s += text(layer, { x: x + pad, y: rowTop - rowH + pad * 1.6 }, h, cells[i]);
      x += widths[i];
    }
    return s;
  };
  out += drawRow(columns.map((c) => c.title), top);
  rows.forEach((r, i) => { out += drawRow(columns.map((c) => c.value(r)), top - (i + 1) * rowH); });
  const rowCount = rows.length + 1;
  for (let i = 0; i <= rowCount; i++) {
    const yy = top - i * rowH;
    out += line(layer, { x: origin.x, y: yy }, { x: origin.x + totalW, y: yy });
  }
  let x = origin.x;
  for (let i = 0; i <= widths.length; i++) {
    out += line(layer, { x, y: top }, { x, y: top - rowCount * rowH });
    if (i < widths.length) x += widths[i];
  }
  return { dxf: out, width: totalW };
}

/** Rectangle from its lower-left corner. */
const rect = (layer: string, p: Pt, w: number, hgt: number) =>
  closedPolyline(layer, [p, { x: p.x + w, y: p.y }, { x: p.x + w, y: p.y + hgt }, { x: p.x, y: p.y + hgt }]);

/**
 * Detail B — the gravity block as a dimension sketch (plan + elevation, not to
 * scale) with the size of every raft's block listed beside it.
 */
function blockDetail(schedule: DeadweightSchedule, origin: Pt, h: number): string {
  const layer = DXF_LAYERS_PA2.detail.name;
  const S = 40 * h; // sketch side
  const rafts = [...schedule.blockByRaft.entries()];
  const ratio = rafts.length ? rafts.reduce((s, [, b]) => s + b.H_m / b.L_m, 0) / rafts.length : 0.5;
  const E = S * ratio; // sketch height, at the average H / L of the blocks
  const p0 = rafts[0]?.[1].params;
  let out = '';
  let y = origin.y;
  out += text(layer, { x: origin.x, y }, h * 1.6, 'CHI TIET B - KHOI BE TONG TRONG LUC NEO DAY HO (PHUONG AN 2)');
  y -= h * 3;
  out += text(layer, { x: origin.x, y }, h, 'SO DO KICH THUOC - KHONG THEO TY LE. Kich thuoc L, W, H cua tung cum be: xem bang ben canh.');
  y -= h * 4;

  // Plan
  const plan = { x: origin.x, y: y - S };
  out += text(layer, { x: plan.x, y: y + h * 0.6 }, h * 1.2, 'MAT BANG KHOI');
  out += rect(layer, plan, S, S);
  out += line(layer, plan, { x: plan.x + S, y: plan.y + S });
  out += line(layer, { x: plan.x, y: plan.y + S }, { x: plan.x + S, y: plan.y });
  out += point(layer, { x: plan.x + S / 2, y: plan.y + S / 2 });
  out += circle(layer, { x: plan.x + S / 2, y: plan.y + S / 2 }, h * 0.8);
  out += text(layer, { x: plan.x + S / 2 + h * 1.5, y: plan.y + S / 2 + h * 0.5 }, h, 'Diem buoc cap: tam mat tren');
  out += text(layer, { x: plan.x + S / 2 - h, y: plan.y - h * 2.2 }, h * 1.2, 'L');
  out += text(layer, { x: plan.x - h * 2.5, y: plan.y + S / 2 }, h * 1.2, 'W');

  // Elevation
  const elev = { x: origin.x + S + 14 * h, y: y - E };
  out += text(layer, { x: elev.x, y: y + h * 0.6 }, h * 1.2, 'MAT DUNG KHOI');
  out += rect(layer, elev, S, E);
  out += line(layer, { x: elev.x - 6 * h, y: elev.y }, { x: elev.x + S + 6 * h, y: elev.y }); // lake bed
  out += text(layer, { x: elev.x + S + 1.5 * h, y: elev.y - h * 1.8 }, h, 'Mat bun day ho');
  out += point(layer, { x: elev.x + S / 2, y: elev.y + E });
  out += line(layer, { x: elev.x + S / 2, y: elev.y + E }, { x: elev.x + S / 2 - 12 * h, y: elev.y + E + 9 * h }); // cable
  out += text(layer, { x: elev.x + S / 2 - 12 * h, y: elev.y + E + 10 * h }, h, 'Cap neo T_max, goc alpha so voi phuong ngang');
  out += text(layer, { x: elev.x + S / 2 - h, y: elev.y - h * 2.2 }, h * 1.2, 'L');
  out += text(layer, { x: elev.x + S + h * 1.5, y: elev.y + E / 2 }, h * 1.2, 'H');

  // Per-raft dimensions
  const tbl = table<[string, typeof rafts[number][1]]>(
    layer,
    ['KICH THUOC KHOI THEO CUM BE'],
    [
      { title: 'CUM BE', width: 10, value: ([name]) => name },
      { title: 'L (m)', width: 8, value: ([, b]) => b.L_m.toFixed(2) },
      { title: 'W (m)', width: 8, value: ([, b]) => b.W_m.toFixed(2) },
      { title: 'H (m)', width: 8, value: ([, b]) => b.H_m.toFixed(2) },
      { title: 'V (m3)', width: 9, value: ([, b]) => b.volume_m3.toFixed(1) },
      { title: 'W_kk (T)', width: 10, value: ([, b]) => b.mass_t.toFixed(1) },
      { title: 'W_nuoc (kN)', width: 13, value: ([, b]) => b.weightSub_kN.toFixed(0) }
    ],
    rafts,
    { x: elev.x + S + 22 * h, y: origin.y - h * 7 },
    h
  );
  out += tbl.dxf;

  // Notes
  let ny = Math.min(plan.y, elev.y) - h * 6;
  const notes = [
    'GHI CHU:',
    p0
      ? `1. Thong so tinh toan: he so ma sat khoi - bun = ${p0.mu}; SF truot >= ${p0.sfSlide}; SF nhac bong >= ${p0.sfUplift}; SF lat >= ${p0.sfOverturn}; q cho phep = ${p0.qAllow_kPa} kPa; khoi luong rieng be tong = ${p0.rhoConcrete_tm3} T/m3.`
      : '1. Thong so tinh toan: xem thuyet minh.',
    '2. He so ma sat va q cho phep la GIA THIET, chua co khao sat dia chat day ho. Chua tinh lun cua khoi trong bun.',
    '3. Khoi dat truc tiep tren mat bun day ho, khong ngam. Kiem tra lat tinh voi cap buoc tai tam mat tren khoi.',
    '4. CHUA THIET KE: cot thep, tai cau, chi tiet moc cap. Cac hang muc nay khong the hien tren ban ve.',
    '5. Huong dat khoi tren mat bang ve song song truc toa do; huong thuc te do don vi thiet ke quyet dinh.',
    schedule.clashes.length > 0
      ? `6. CANH BAO: ${schedule.clashes.length} cap khoi chong lan nhau tai cac diem neo hien tai (bo tri cho coc). Phai bo tri lai diem neo day truoc khi dung Phuong an 2.`
      : '6. Khong co khoi nao chong lan nhau tai cac diem neo hien tai.'
  ];
  for (const t of notes) {
    out += text(layer, { x: origin.x, y: ny }, h, t);
    ny -= h * 2.2;
  }
  return out;
}

export interface DeadweightDxfOptions {
  labelHeight_m?: number;
  shorePileRadius_m?: number;
  includeTables?: boolean;
  includeDetail?: boolean;
  coordinates?: MooringCoordinate[];
}

export interface DeadweightDxfResult {
  dxf: string;
  schedule: DeadweightSchedule;
  shorePileCount: number;
  blockCount: number;
  raftCount: number;
}

export function buildMooringDeadweightDxf(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  options: DeadweightDxfOptions = {}
): DeadweightDxfResult {
  const h = options.labelHeight_m ?? 1.2;
  const shoreR = options.shorePileRadius_m ?? 0.5;
  const L = DXF_LAYERS_PA2;
  const schedule = buildDeadweightSchedule(state, results, batchResults, options.coordinates);
  const outlines = buildRaftOutlines(options.coordinates);
  let e = '';

  for (const o of outlines) {
    e += closedPolyline(L.raft.name, o.points);
    if (o.points.length > 0) {
      const cx = o.points.reduce((s, p) => s + p.x, 0) / o.points.length;
      const cy = o.points.reduce((s, p) => s + p.y, 0) / o.points.length;
      e += text(L.raft.name, { x: cx, y: cy }, h * 2.5, o.raft);
      if (o.source === 'hull') e += text(L.raft.name, { x: cx, y: cy - h * 3 }, h, '(duong bao gan dung theo diem neo)');
    }
  }

  // Shore piles: the real a × a section, plus a locating circle so it stays visible when zoomed out.
  for (const r of schedule.shorePiles) {
    const p = { x: r.x, y: r.y };
    e += line(L.shoreLine.name, { x: r.xRaft, y: r.yRaft }, p);
    e += square(L.shorePile.name, p, r.D_m);
    e += circle(L.shorePile.name, p, shoreR);
    e += point(L.shorePile.name, p);
    e += text(L.text.name, { x: p.x + shoreR + 0.4, y: p.y + shoreR + 0.4 }, h, `${r.pileId} (${r.code})`);
  }

  // Lake-bed blocks at true plan size L × W, with an X to tell them from piles.
  for (const b of schedule.blocks) {
    const p = { x: b.x, y: b.y };
    const hx = b.L_m / 2, hy = b.W_m / 2;
    const c1 = { x: p.x - hx, y: p.y - hy }, c2 = { x: p.x + hx, y: p.y - hy };
    const c3 = { x: p.x + hx, y: p.y + hy }, c4 = { x: p.x - hx, y: p.y + hy };
    e += line(L.bedLine.name, { x: b.xRaft, y: b.yRaft }, p);
    e += closedPolyline(L.block.name, [c1, c2, c3, c4]);
    e += line(L.block.name, c1, c3) + line(L.block.name, c2, c4);
    e += point(L.block.name, p);
    e += text(
      L.text.name,
      { x: p.x + hx + 0.4, y: p.y + hy + 0.4 },
      h,
      `${b.blockId} (${b.code}) [${b.L_m.toFixed(2)}x${b.W_m.toFixed(2)}x${b.H_m.toFixed(2)}m, ${b.mass_t.toFixed(0)}T]`
    );
  }

  const xs = [...schedule.shorePiles, ...schedule.blocks].flatMap((r) => [r.x, r.xRaft]);
  const ys = [...schedule.shorePiles, ...schedule.blocks].flatMap((r) => [r.y, r.yRaft]);
  let cursorX = (xs.length ? Math.max(...xs) : 0) + 30;
  const top = ys.length ? Math.max(...ys) : 0;
  const code = state.meta.code || state.code || 'DA';

  if (options.includeTables !== false) {
    const t1 = table(
      L.shoreTable.name,
      [
        `BANG THONG KE COC NEO BO BTCT (${schedule.shorePiles.length} COC) - PHUONG AN 2 - ${code}`,
        'Coc vuong BTCT, a = canh tiet dien | L_opt: chieu sau ngam toi thieu (Broms) | L_tk: chieu sau dong coc thiet ke | P_max: suc chiu tai cho phep tai L_tk',
        'Ma coc giu nguyen theo bang thong ke Phuong an 1 (danh so tren ca 304 diem neo).'
      ],
      SHORE_COLUMNS, schedule.shorePiles, { x: cursorX, y: top }, h
    );
    e += t1.dxf;
    cursorX += t1.width + 30;
    const p0 = schedule.blocks[0];
    const t2 = table(
      L.blockTable.name,
      [
        `BANG THONG KE KHOI BE TONG NEO DAY HO (${schedule.blocks.length} KHOI) - PHUONG AN 2 - ${code}`,
        'W_kk: trong luong trong khong khi | SF_truot, SF_nho, SF_lat: he so an toan chong truot, nhac bong, lat',
        `q_day: ap luc lon nhat len nen bun (nuoc lang hoac mep khoi khi chiu tai)${p0 ? `, cho phep <= ${p0.qAllow_kPa} kPa (gia thiet)` : ''}`,
        schedule.clashes.length > 0
          ? `CANH BAO: ${schedule.clashes.length} cap khoi CHONG LAN nhau tren mat bang (khoang cach tam nho hon tong nua canh) - xem cot CHONG LAN VOI. Vi tri diem neo duoc bo tri cho coc, can bo tri lai cho khoi.`
          : 'Khong co khoi nao chong lan nhau tren mat bang.'
      ],
      BLOCK_COLUMNS, schedule.blocks, { x: cursorX, y: top }, h
    );
    e += t2.dxf;
    cursorX += t2.width + 30;
  }

  if (options.includeDetail !== false && schedule.blocks.length > 0) {
    e += blockDetail(schedule, { x: cursorX, y: top }, h);
  }

  return {
    dxf: dxfDocument(Object.values(L), e),
    schedule,
    shorePileCount: schedule.shorePiles.length,
    blockCount: schedule.blocks.length,
    raftCount: outlines.length
  };
}

/** `mat-bang-he-neo-PA2-khoi-be-tong_<code>_<YYYYMMDD>.dxf` */
export function dxfFileNamePA2(state: ProjectState, now: Date = new Date()): string {
  return dxfStampedName('mat-bang-he-neo-PA2-khoi-be-tong', state, now);
}

/** Builds the option 2 drawing and triggers the browser download. */
export function exportMooringDeadweightDxf(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  options: DeadweightDxfOptions = {}
): DeadweightDxfResult {
  const built = buildMooringDeadweightDxf(state, results, batchResults, options);
  downloadDxf(built.dxf, dxfFileNamePA2(state));
  return built;
}
