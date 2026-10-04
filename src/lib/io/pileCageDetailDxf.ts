import type { PileScheduleRow } from './pileSchedule';
import { summarisePileMaterials } from './pileSchedule';
import { Pt, line, circle, text, closedPolyline } from './dxfExport';
import { LIFT_POINT_RATIO, STIRRUP_DIA_MM, STIRRUP_END_PITCH_M, STIRRUP_BODY_PITCH_M, STIRRUP_END_ZONE_M } from '../calc/pileCage';

/**
 * Pile reinforcement details for the setting-out sheet, drawn from the pile
 * schedule (so they can never disagree with the tables):
 *
 *  - one cross-section per cage type present (4, 8 or 12 bars), with the list
 *    of rafts / bar sizes that use it;
 *  - the twin-pile arrangement, when a raft has two piles per point;
 *  - the lifting diagram of the longest pile.
 *
 * Main bars come from the bending check. Stirrups and lifting hooks are
 * constructive (no shear design exists); the yoke of a twin point and any pile
 * splice are NOT designed and are only marked as such.
 */

const SECTION_SCALE = 40; // 350 mm drawn 14 m wide in a sheet whose text is ~1.2 m high
const STIRRUP_COVER_M = 0.035;

const rect = (layer: string, p: Pt, w: number, hgt: number) =>
  closedPolyline(layer, [p, { x: p.x + w, y: p.y }, { x: p.x + w, y: p.y + hgt }, { x: p.x, y: p.y + hgt }]);

/** Centres of the cage bars on a square of side `a` (k bars per face, corner bars shared), relative to its lower-left corner. */
export function cageBarPositions(a_m: number, barsPerFace: number, cover_m: number): Pt[] {
  const k = Math.max(2, barsPerFace);
  const lo = cover_m, hi = a_m - cover_m, step = (hi - lo) / (k - 1);
  const pts: Pt[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i === 0 || i === k - 1 || j === 0 || j === k - 1) pts.push({ x: lo + i * step, y: lo + j * step });
    }
  }
  return pts;
}

function sectionDetail(layer: string, title: string, rows: PileScheduleRow[], origin: Pt, h: number): { dxf: string; width: number } {
  const first = rows[0];
  const a = first.D_m, S = a * SECTION_SCALE;
  const k = first.rebarFaceCount;
  const cover = 0.05;
  const maxDia = Math.max(...rows.map((r) => r.rebarDia_mm));
  let out = '';
  out += text(layer, { x: origin.x, y: origin.y }, h * 1.4, title);
  const p0 = { x: origin.x, y: origin.y - 3 * h - S };
  out += rect(layer, p0, S, S);
  const c = STIRRUP_COVER_M * SECTION_SCALE;
  out += rect(layer, { x: p0.x + c, y: p0.y + c }, S - 2 * c, S - 2 * c);
  for (const b of cageBarPositions(a, k, cover)) {
    out += circle(layer, { x: p0.x + b.x * SECTION_SCALE, y: p0.y + b.y * SECTION_SCALE }, (maxDia / 2000) * SECTION_SCALE);
  }
  out += text(layer, { x: p0.x + S / 2 - 2 * h, y: p0.y - 2.2 * h }, h, `${Math.round(a * 1000)}`);
  out += text(layer, { x: p0.x - 4.5 * h, y: p0.y + S / 2 }, h, `${Math.round(a * 1000)}`);

  // Which piles use this cage, with their own bar size.
  const uses = new Map<string, string[]>();
  for (const r of rows) {
    const key = `${first.cage.totalBars}D${r.rebarDia_mm} ${r.cage.grade}`;
    const who = `${r.type === 'SHORE' ? 'bo' : 'day'} ${r.raft}`;
    if (!uses.has(key)) uses.set(key, []);
    if (!uses.get(key)!.includes(who)) uses.get(key)!.push(who);
  }
  let y = p0.y - 5 * h;
  const notes = [
    `Thep chu: ${first.cage.totalBars} thanh = ${k} thanh moi mat (thanh goc dung chung), a_s = ${Math.round(cover * 1000)} mm`,
    ...[...uses].map(([key, who]) => `  ${key}: coc ${who.join(', ')}`),
    `Dai D${STIRRUP_DIA_MM} a${STIRRUP_END_PITCH_M * 1000} (${STIRRUP_END_ZONE_M} m hai dau) / a${STIRRUP_BODY_PITCH_M * 1000}${first.cage.totalBars > 4 ? ' + dai phu giu thanh giua canh' : ''} - CAU TAO, chua tinh luc cat`,
    'Be tong B25. Ty le phong 40:1.'
  ];
  let width = S;
  for (const t of notes) {
    out += text(layer, { x: origin.x, y }, h, t);
    width = Math.max(width, t.length * h * 0.75);
    y -= 2.2 * h;
  }
  return { dxf: out, width };
}

/** All pile details, left to right from `origin` (its top-left corner). */
export function pileCageDetails(layer: string, schedule: PileScheduleRow[], origin: Pt, h: number): string {
  let out = '';
  let x = origin.x;
  const m = summarisePileMaterials(schedule);
  out += text(layer, { x, y: origin.y + 4 * h }, h * 1.6, 'CHI TIET CAU TAO COC VUONG BTCT');
  out += text(
    layer,
    { x, y: origin.y + 1.5 * h },
    h,
    `Tong: ${m.piles} coc tai ${m.anchorPoints} diem neo | ${m.totalLength_m.toFixed(1)} m coc | be tong ${m.concrete_m3.toFixed(1)} m3 | thep ${(m.steel_kg / 1000).toFixed(1)} tan`
  );

  // Cross-sections, one per cage type.
  const byBars = new Map<number, PileScheduleRow[]>();
  for (const r of schedule) {
    if (r.cage.totalBars <= 0) continue;
    if (!byBars.has(r.cage.totalBars)) byBars.set(r.cage.totalBars, []);
    byBars.get(r.cage.totalBars)!.push(r);
  }
  [...byBars.entries()].sort((p, q) => p[0] - q[0]).forEach(([bars, rows], i) => {
    const d = sectionDetail(layer, `MAT CAT ${i + 1}-${i + 1}: COC ${bars} THANH`, rows, { x, y: origin.y - 2 * h }, h);
    out += d.dxf;
    x += d.width + 12 * h;
  });

  // Twin-pile arrangement.
  const twin = schedule.find((r) => r.pileCount > 1);
  if (twin) {
    const sc = 20, a = twin.D_m * sc, gap = 3 * twin.D_m * sc;
    const top = origin.y - 2 * h;
    out += text(layer, { x, y: top }, h * 1.4, `CUM ${twin.pileCount} COC TAI MOT DIEM NEO (${twin.raft})`);
    const cy = top - 6 * h - a / 2;
    for (let i = 0; i < twin.pileCount; i++) out += rect(layer, { x: x + i * gap, y: cy - a / 2 }, a, a);
    const xr = x + (twin.pileCount - 1) * gap + a;
    out += line(layer, { x: x + a / 2, y: cy }, { x: xr - a / 2, y: cy }); // common yoke (schematic)
    out += line(layer, { x: (x + xr) / 2, y: cy }, { x: (x + xr) / 2, y: cy + 5 * h }); // cable, square to the pile row
    out += text(layer, { x: (x + xr) / 2 + h, y: cy + 4 * h }, h, 'Cap neo (vuong goc hang coc)');
    let y = cy - a / 2 - 2.5 * h;
    for (const t of [
      `Khoang cach tim coc: ${(3 * twin.D_m).toFixed(2)} m (>= 3a). Ty le phong 20:1.`,
      'Moi coc kiem tra voi T / (so coc x he so nhom).',
      'Dai / bich neo chung: CHUA THIET KE.'
    ]) {
      out += text(layer, { x, y }, h, t);
      y -= 2.2 * h;
    }
    x += Math.max(xr - x, 45 * h) + 12 * h;
  }

  // Lifting diagram of the longest pile.
  const longest = schedule.reduce((p, q) => (q.Ltotal_m > p.Ltotal_m ? q : p), schedule[0]);
  if (longest) {
    const sc = 4, len = longest.Ltotal_m * sc, t = Math.max(longest.D_m * sc, h);
    const top = origin.y - 2 * h;
    out += text(layer, { x, y: top }, h * 1.4, 'SO DO CAU COC (2 MOC CAU)');
    const py = top - 8 * h;
    out += rect(layer, { x, y: py }, len, t);
    for (const f of [LIFT_POINT_RATIO, 1 - LIFT_POINT_RATIO]) {
      out += line(layer, { x: x + f * len, y: py + t }, { x: x + f * len, y: py + t + 4 * h });
      out += text(layer, { x: x + f * len - 3 * h, y: py + t + 4.5 * h }, h, `${LIFT_POINT_RATIO} L`);
    }
    let y = py - 2.5 * h;
    const allSingle = schedule.every((r) => r.cage.segments_m.length === 1);
    for (const tx of [
      `Coc dai nhat: L = ${longest.Ltotal_m.toFixed(1)} m (${longest.raft}). Mo men khi cau (he so dong 1.5): ${longest.cage.handlingMoment_kNm.toFixed(1)} kNm.`,
      allSingle
        ? 'Tat ca coc duc va ha NGUYEN MOT DOAN (L <= 12 m), khong co moi noi.'
        : 'Co coc dai hon 12 m phai chia doan: moi noi CHUA THIET KE.',
      'Neu buoc phai chia doan do thiet bi: moi noi chiu keo / uon phai duoc thiet ke rieng, dat sau hon vung mo men lon nhat.',
      '2 moc cau D16 moi coc (cau tao). Ty le phong 4:1 theo chieu dai.'
    ]) {
      out += text(layer, { x, y }, h, tx);
      y -= 2.2 * h;
    }
  }
  return out;
}
