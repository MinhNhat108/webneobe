import { CalcResults, ProjectState } from '../calc/types';
import { MooringCoordinate } from '../../data/huoiVanhProject';
import {
  buildPileSchedule,
  buildRaftOutlines,
  PileScheduleBatchLike,
  PileScheduleRow
} from './pileSchedule';

/**
 * DXF writer for the mooring-pile setting-out drawing.
 *
 * Format: ASCII DXF R12 (AC1009). R12 is deliberate — it is the most widely
 * readable interchange level (AutoCAD, BricsCAD, DWG TrueView, LibreCAD,
 * QCAD, ODA viewers all open it), and it needs no LWPOLYLINE/handles/object
 * sections, so the file is a few hundred kB of plain text instead of a
 * fragile modern DXF. Everything is drawn with LINE / CIRCLE / POINT / TEXT.
 *
 * Coordinates are written EXACTLY as they are in `huoiVanhCoordinates.json`
 * (site-local metres) — no transform, no rounding beyond 3 decimals — so a
 * point picked in AutoCAD reads back the same X/Y as the survey table.
 */

/** AutoCAD Color Index. */
const ACI = {
  red: 1,
  yellow: 2,
  green: 3,
  cyan: 4,
  magenta: 6,
  white: 7
} as const;

export const DXF_LAYERS = {
  raft: { name: '01_BE_PIN', color: ACI.cyan },
  shoreLine: { name: '02_DAY_NEO_BO', color: ACI.green },
  bedLine: { name: '03_DAY_NEO_DAY', color: ACI.red },
  shorePile: { name: '04_COC_NEO_BO', color: ACI.yellow },
  bedPile: { name: '05_COC_NEO_DAY', color: ACI.magenta },
  text: { name: '06_TOA_DO_TEXT', color: ACI.white },
  schedule: { name: '07_BANG_THONG_KE_COC', color: ACI.white }
} as const;

type Pt = { x: number; y: number };

/** A DXF group-code pair: the code on its own line, then the value. */
function pair(code: number | string, value: string | number): string {
  return `${code}\n${value}\n`;
}

const n = (v: number) => (Number.isFinite(v) ? (Math.round(v * 1000) / 1000).toString() : '0');

/**
 * DXF TEXT has no Unicode escape in R12 and Vietnamese diacritics render as
 * mojibake in many viewers, so every label is transliterated to ASCII. The
 * accented text lives in the Excel export and the on-screen tables, which
 * handle UTF-8 properly.
 */
export function toAsciiCad(input: string): string {
  const map: Record<string, string> = {
    à: 'a', á: 'a', ạ: 'a', ả: 'a', ã: 'a', â: 'a', ầ: 'a', ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a',
    ă: 'a', ằ: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a',
    è: 'e', é: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e', ê: 'e', ề: 'e', ế: 'e', ệ: 'e', ể: 'e', ễ: 'e',
    ì: 'i', í: 'i', ị: 'i', ỉ: 'i', ĩ: 'i',
    ò: 'o', ó: 'o', ọ: 'o', ỏ: 'o', õ: 'o', ô: 'o', ồ: 'o', ố: 'o', ộ: 'o', ổ: 'o', ỗ: 'o',
    ơ: 'o', ờ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o',
    ù: 'u', ú: 'u', ụ: 'u', ủ: 'u', ũ: 'u', ư: 'u', ừ: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u',
    ỳ: 'y', ý: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y',
    đ: 'd'
  };
  return input
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase();
      const rep = map[lower];
      if (!rep) return ch;
      return ch === lower ? rep : rep.toUpperCase();
    })
    .join('')
    // Anything still outside printable ASCII would break a strict R12 reader.
    .replace(/[^\x20-\x7E]/g, '?');
}

function line(layer: string, a: Pt, b: Pt): string {
  return (
    pair(0, 'LINE') +
    pair(8, layer) +
    pair(10, n(a.x)) + pair(20, n(a.y)) + pair(30, '0.0') +
    pair(11, n(b.x)) + pair(21, n(b.y)) + pair(31, '0.0')
  );
}

function circle(layer: string, c: Pt, r: number): string {
  return (
    pair(0, 'CIRCLE') +
    pair(8, layer) +
    pair(10, n(c.x)) + pair(20, n(c.y)) + pair(30, '0.0') +
    pair(40, n(r))
  );
}

function point(layer: string, p: Pt): string {
  return pair(0, 'POINT') + pair(8, layer) + pair(10, n(p.x)) + pair(20, n(p.y)) + pair(30, '0.0');
}

function text(layer: string, p: Pt, height: number, value: string): string {
  return (
    pair(0, 'TEXT') +
    pair(8, layer) +
    pair(10, n(p.x)) + pair(20, n(p.y)) + pair(30, '0.0') +
    pair(40, n(height)) +
    pair(1, toAsciiCad(value))
  );
}

/** Axis-aligned square marker centred on `c`, drawn as 4 LINEs. */
function square(layer: string, c: Pt, size: number): string {
  const h = size / 2;
  const p1 = { x: c.x - h, y: c.y - h };
  const p2 = { x: c.x + h, y: c.y - h };
  const p3 = { x: c.x + h, y: c.y + h };
  const p4 = { x: c.x - h, y: c.y + h };
  return line(layer, p1, p2) + line(layer, p2, p3) + line(layer, p3, p4) + line(layer, p4, p1);
}

function closedPolyline(layer: string, pts: Pt[]): string {
  if (pts.length < 2) return '';
  let out = '';
  for (let i = 0; i < pts.length; i++) {
    out += line(layer, pts[i], pts[(i + 1) % pts.length]);
  }
  return out;
}

function layerTable(): string {
  const layers = Object.values(DXF_LAYERS);
  let out = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, layers.length + 1);
  out += pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, ACI.white) + pair(6, 'CONTINUOUS');
  for (const l of layers) {
    out += pair(0, 'LAYER') + pair(2, l.name) + pair(70, 0) + pair(62, l.color) + pair(6, 'CONTINUOUS');
  }
  out += pair(0, 'ENDTAB');
  return out;
}

export interface DxfExportOptions {
  /** Marker radius for a shore pile, m. */
  shorePileRadius_m?: number;
  /** Marker size for a lake-bed pile, m. */
  bedPileSize_m?: number;
  /** Height of the pile-code labels, m. */
  labelHeight_m?: number;
  /** Include the Pile Schedule table block beside the plan. */
  includeSchedule?: boolean;
  coordinates?: MooringCoordinate[];
}

export interface DxfBuildResult {
  dxf: string;
  schedule: PileScheduleRow[];
  pileCount: number;
  raftCount: number;
}

/**
 * Builds the whole `.dxf` document as a string — pure, no DOM, so it is unit
 * testable and reusable from a worker or a server later.
 */
export function buildMooringPileDxf(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  options: DxfExportOptions = {}
): DxfBuildResult {
  const shoreR = options.shorePileRadius_m ?? 0.5;
  const bedSize = options.bedPileSize_m ?? 1.0;
  const labelH = options.labelHeight_m ?? 1.2;

  const schedule = buildPileSchedule(state, results, batchResults, options.coordinates);
  const outlines = buildRaftOutlines(options.coordinates);

  let entities = '';

  // ---- Layer 01 — raft outlines + raft name -------------------------------
  for (const o of outlines) {
    entities += closedPolyline(DXF_LAYERS.raft.name, o.points);
    if (o.points.length > 0) {
      const cx = o.points.reduce((s, p) => s + p.x, 0) / o.points.length;
      const cy = o.points.reduce((s, p) => s + p.y, 0) / o.points.length;
      entities += text(DXF_LAYERS.raft.name, { x: cx, y: cy }, labelH * 2.5, o.raft);
      // An approximated boundary must never look surveyed on a setting-out sheet.
      if (o.source === 'hull') {
        entities += text(
          DXF_LAYERS.raft.name,
          { x: cx, y: cy - labelH * 3 },
          labelH,
          '(duong bao gan dung theo diem neo)'
        );
      }
    }
  }

  // ---- Layers 02/03 — mooring lines, 04/05 — piles, 06 — labels ----------
  for (const row of schedule) {
    const isShore = row.type === 'SHORE';
    const raftPt = { x: row.xRaft, y: row.yRaft };
    const anchorPt = { x: row.x, y: row.y };

    entities += line(isShore ? DXF_LAYERS.shoreLine.name : DXF_LAYERS.bedLine.name, raftPt, anchorPt);

    if (isShore) {
      entities += circle(DXF_LAYERS.shorePile.name, anchorPt, shoreR);
      entities += point(DXF_LAYERS.shorePile.name, anchorPt);
    } else {
      entities += square(DXF_LAYERS.bedPile.name, anchorPt, bedSize);
      entities += point(DXF_LAYERS.bedPile.name, anchorPt);
    }

    const labelPt = { x: anchorPt.x + shoreR + 0.4, y: anchorPt.y + shoreR + 0.4 };
    entities += text(DXF_LAYERS.text.name, labelPt, labelH, `${row.pileId} (${row.code})`);
  }

  // ---- Layer 07 — Pile Schedule table ------------------------------------
  if (options.includeSchedule !== false && schedule.length > 0) {
    const xs = schedule.flatMap((r) => [r.x, r.xRaft]);
    const ys = schedule.flatMap((r) => [r.y, r.yRaft]);
    const tableX = Math.max(...xs) + 30;
    const tableTop = Math.max(...ys);
    entities += scheduleTable(schedule, state, { x: tableX, y: tableTop }, labelH);
  }

  const dxf =
    pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$ACADVER') + pair(1, 'AC1009') +
    pair(9, '$INSUNITS') + pair(70, 6) + // 6 = metres
    pair(9, '$MEASUREMENT') + pair(70, 1) + // metric
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'TABLES') +
    layerTable() +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'ENTITIES') +
    entities +
    pair(0, 'ENDSEC') +
    pair(0, 'EOF');

  return {
    dxf,
    schedule,
    pileCount: schedule.length,
    raftCount: outlines.length
  };
}

const SCHEDULE_COLUMNS: Array<{ title: string; width: number; value: (r: PileScheduleRow) => string }> = [
  { title: 'MA COC', width: 14, value: (r) => r.pileId },
  { title: 'KY HIEU KS', width: 12, value: (r) => r.code },
  { title: 'CUM BE', width: 10, value: (r) => r.raft },
  { title: 'LOAI', width: 8, value: (r) => (r.type === 'SHORE' ? 'BO' : 'DAY HO') },
  { title: 'X (m)', width: 12, value: (r) => r.x.toFixed(2) },
  { title: 'Y (m)', width: 12, value: (r) => r.y.toFixed(2) },
  { title: 'Z (m)', width: 10, value: (r) => r.z.toFixed(2) },
  { title: 'D (m)', width: 8, value: (r) => r.D_m.toFixed(2) },
  { title: 'L_opt (m)', width: 11, value: (r) => (r.Lopt_m === null ? 'KHONG DAT' : r.Lopt_m.toFixed(2)) },
  { title: 'T_max (kN)', width: 12, value: (r) => r.Tmax_kN.toFixed(1) },
  { title: 'P_req (kN)', width: 12, value: (r) => r.Preq_kN.toFixed(1) },
  { title: 'P_max (kN)', width: 12, value: (r) => r.Pmax_kN.toFixed(1) },
  { title: 'KL', width: 8, value: (r) => (r.isPmaxOk ? 'DAT' : 'KIEM TRA') }
];

/**
 * Draws the Pile Schedule as a real table (grid LINEs + TEXT cells) beside
 * the plan, so the contractor can plot the sheet and read the setting-out
 * values without opening the Excel file.
 */
function scheduleTable(
  rows: PileScheduleRow[],
  state: ProjectState,
  origin: Pt,
  labelH: number
): string {
  const h = labelH;
  const rowH = h * 2.2;
  const pad = h * 0.4;
  const widths = SCHEDULE_COLUMNS.map((c) => c.width * h * 0.75);
  const totalW = widths.reduce((s, w) => s + w, 0);

  const titleLines = [
    `BANG THONG KE COC NEO - ${state.meta.code || state.code || 'DA'}`,
    `${state.meta.name || state.name || ''}`,
    `Tong so coc: ${rows.length}  |  L_opt: chieu sau dong coc toi uu (Broms)  |  P_max: suc chiu tai cho phep lon nhat cua coc`
  ];

  let out = '';
  let y = origin.y;

  for (const t of titleLines) {
    out += text(DXF_LAYERS.schedule.name, { x: origin.x, y }, h * 1.3, t);
    y -= rowH;
  }
  y -= rowH * 0.3;

  const headerTop = y;
  const drawRow = (cells: string[], top: number) => {
    let x = origin.x;
    let s = '';
    for (let i = 0; i < cells.length; i++) {
      s += text(DXF_LAYERS.schedule.name, { x: x + pad, y: top - rowH + pad * 1.6 }, h, cells[i]);
      x += widths[i];
    }
    return s;
  };

  out += drawRow(SCHEDULE_COLUMNS.map((c) => c.title), headerTop);
  let bottom = headerTop - rowH;
  for (const r of rows) {
    out += drawRow(SCHEDULE_COLUMNS.map((c) => c.value(r)), bottom);
    bottom -= rowH;
  }

  // Grid: horizontal rules (header + every row) and vertical column rules.
  const rowCount = rows.length + 1;
  for (let i = 0; i <= rowCount; i++) {
    const yy = headerTop - i * rowH;
    out += line(DXF_LAYERS.schedule.name, { x: origin.x, y: yy }, { x: origin.x + totalW, y: yy });
  }
  let x = origin.x;
  for (let i = 0; i <= widths.length; i++) {
    out += line(DXF_LAYERS.schedule.name, { x, y: headerTop }, { x, y: headerTop - rowCount * rowH });
    if (i < widths.length) x += widths[i];
  }

  return out;
}

/** `mat-bang-coc-neo_<code>_<YYYYMMDD>.dxf` */
export function dxfFileName(state: ProjectState, now: Date = new Date()): string {
  const code = toAsciiCad(state.meta.code || state.code || 'du-an')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'du-an';
  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}`;
  return `mat-bang-coc-neo_${code}_${stamp}.dxf`;
}

/**
 * Builds the drawing and triggers the browser download. Browser-only — the
 * pure builder above is what tests and any future server-side export use.
 */
export function exportMooringPileDxf(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  options: DxfExportOptions = {}
): DxfBuildResult {
  const built = buildMooringPileDxf(state, results, batchResults, options);

  // BOM-free ASCII; DXF readers are strict about stray bytes at the head.
  const blob = new Blob([built.dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dxfFileName(state);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return built;
}
