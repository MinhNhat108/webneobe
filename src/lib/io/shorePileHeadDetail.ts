import type { ProjectState } from '../calc/types';
import type { PileScheduleBatchLike, PileScheduleRow } from './pileSchedule';
import { designShorePileHead, ShorePileHead } from '../calc/shorePileHead';
import { Pt, line, circle, text, closedPolyline } from './dxfExport';

/**
 * The head detail of the bored shore piles for this project: one detail for
 * the whole lake, sized for the most heavily loaded shore pile and the
 * heaviest mooring cable. Returns undefined when the shore piles are not
 * round bored piles (the detail does not apply to a precast pile).
 */
export function buildShorePileHead(
  state: ProjectState,
  schedule: PileScheduleRow[],
  batchResults?: PileScheduleBatchLike[]
): ShorePileHead | undefined {
  const shore = schedule.filter((r) => r.type === 'SHORE' && r.cage.shape === 'circular');
  if (shore.length === 0) return undefined;
  const sf = state.anchor.sfPileCapacity ?? 1.0;
  // P_req of a row is the tension ONE pile carries (twin piles share the line) times sfPileCapacity.
  const tension_kN = Math.max(...shore.map((r) => r.Preq_kN / (sf > 0 ? sf : 1)));
  const mbl = Math.max(state.line.mbl_kN ?? 0, ...(batchResults ?? []).map((b) => b.state?.line.mbl_kN ?? 0));
  return designShorePileHead({
    tension_kN,
    loadFactor: state.anchor.pileBendingLoadFactor ?? 1.2,
    pileDia_m: Math.max(...shore.map((r) => r.D_m)),
    attachHeight_m: state.anchor.shoreArm_e_m ?? 0.1,
    cableMbl_kN: mbl
  });
}

const SCALE = 20; // 1 mm of steel drawn 0.02 m: the 400 mm cap plate is 8 m wide beside 1.2 m text
const rect = (layer: string, x0: number, y0: number, x1: number, y1: number, o: Pt, k: number) =>
  closedPolyline(layer, [
    { x: o.x + x0 * k, y: o.y + y0 * k }, { x: o.x + x1 * k, y: o.y + y0 * k },
    { x: o.x + x1 * k, y: o.y + y1 * k }, { x: o.x + x0 * k, y: o.y + y1 * k }
  ]);

/** Elevation + plan of the pile head with its checks. `origin` is the top-left corner; returns the entities. */
export function shorePileHeadDxf(layer: string, hd: ShorePileHead, origin: Pt, h: number): string {
  const k = SCALE / 1000; // metres of drawing per mm of steel
  let out = '';
  out += text(layer, origin, h * 1.4, `CHI TIET DAU COC KHOAN NHOI BO D${hd.pileDia_mm} VA TAI NEO CAP (TY LE PHONG ${SCALE}:1)`);
  out += text(layer, { x: origin.x, y: origin.y - 2.4 * h }, h, 'CHI TIET DE XUAT, da kiem tra so bo theo luc keo thiet ke - ban ve gia cong phai do ky su ket cau phat hanh.');

  // ---- elevation: x along the cable (lake to the right), y vertical, ground at y = 0 ----
  const e = { x: origin.x + 600 * k, y: origin.y - 8 * h - 400 * k };
  const L = (x0: number, y0: number, x1: number, y1: number) => line(layer, { x: e.x + x0 * k, y: e.y + y0 * k }, { x: e.x + x1 * k, y: e.y + y1 * k });
  const T = (x: number, y: number, s: string, size = h) => text(layer, { x: e.x + x * k, y: e.y + y * k }, size, s);
  const top = hd.pileTopAboveGround_mm, half = hd.collarSide_mm / 2, r = hd.pileDia_mm / 2;
  const plateTop = top + hd.plateThk_mm, pin = plateTop + hd.holeAbovePlate_mm;
  out += T(-half, pin + 420, 'MAT DUNG (cat doc tim coc, theo phuong cap)', h * 1.2);
  out += L(-650, 0, -half, 0) + L(half, 0, 900, 0); // ground
  out += T(half + 40, -70, 'Mat dat tu nhien');
  out += rect(layer, -half, top - hd.collarDepth_mm, half, top, e, k); // cast collar
  out += L(-r, top - hd.collarDepth_mm, -r, -900) + L(r, top - hd.collarDepth_mm, r, -900); // shaft (broken below)
  out += L(-r - 40, -900, r + 40, -900);
  out += rect(layer, -half, top, half, plateTop, e, k); // cap plate
  out += rect(layer, -hd.padeyeWidth_mm / 2, plateTop, hd.padeyeWidth_mm / 2, plateTop + hd.padeyeHeight_mm, e, k); // padeye
  out += circle(layer, { x: e.x, y: e.y + pin * k }, (hd.holeDia_mm / 2) * k);
  for (const x of [-hd.anchorBarSpacing_mm / 2, hd.anchorBarSpacing_mm / 2]) out += L(x, top, x, top - hd.anchorBarLength_mm); // anchor bars
  // shackle (bow) and cable towards the lake
  out += circle(layer, { x: e.x + 70 * k, y: e.y + pin * k }, 55 * k);
  out += L(125, pin, 900, pin - 120);
  out += T(480, pin - 20, 'Cap neo ve phia be');
  out += T(half + 40, pin + 120, `Ma-ni mong ngua WLL ${hd.shackleWll_t} T, chot D${hd.shacklePin_mm}`);
  out += T(half + 40, plateTop + 10, `Tai neo t=${hd.padeyeThk_mm}, ${hd.padeyeWidth_mm}x${hd.padeyeHeight_mm}, lo D${hd.holeDia_mm}; han goc hf=${hd.weldLeg_mm} hai mat`);
  out += T(half + 40, top - 60, `Ban ma ${hd.plateSide_mm}x${hd.plateSide_mm}x${hd.plateThk_mm} (SS400)`);
  out += T(half + 40, top - 200, `Mu coc do tai cho ${hd.collarSide_mm}x${hd.collarSide_mm}, sau ${hd.collarDepth_mm}`);
  out += T(half + 40, top - 460, `${hd.anchorBarCount}D${hd.anchorBarDia_mm} CB400-V han vao ban ma, neo ${hd.anchorBarLength_mm} vao be tong`);
  out += T(-r - 40, -1000, `Coc khoan nhoi D${hd.pileDia_mm}, be tong B25`);
  // the dimension the pile design depends on
  out += L(-half - 120, 0, -half - 120, pin) + L(-half - 160, pin, -half - 80, pin) + L(-half - 160, 0, -half - 80, 0);
  out += T(-half - 560, pin / 2 - 20, `e = ${hd.pinAboveGround_mm} mm`);
  out += T(-half - 560, pin / 2 - 100, '(tim chot - mat dat)');

  // ---- plan ----
  const p = { x: e.x + 2300 * k, y: e.y + (pin - 150) * k };
  out += text(layer, { x: p.x - half * k, y: p.y + (half + 120) * k }, h * 1.2, 'MAT BANG DINH COC');
  out += rect(layer, -half, -half, half, half, p, k);
  out += circle(layer, p, r * k);
  out += rect(layer, -hd.padeyeWidth_mm / 2, -hd.padeyeThk_mm / 2, hd.padeyeWidth_mm / 2, hd.padeyeThk_mm / 2, p, k);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    out += circle(layer, { x: p.x + (sx * hd.anchorBarSpacing_mm / 2) * k, y: p.y + (sy * hd.anchorBarSpacing_mm / 2) * k }, (hd.anchorBarDia_mm / 2) * k);
  }
  out += line(layer, { x: p.x + (hd.padeyeWidth_mm / 2) * k, y: p.y }, { x: p.x + (half + 300) * k, y: p.y });
  out += text(layer, { x: p.x + (half + 60) * k, y: p.y + 40 * k }, h, 'Phuong cap');
  out += text(layer, { x: p.x - half * k, y: p.y - (half + 110) * k }, h, `Tai neo dat theo phuong cap; thep neo tren o vuong ${hd.anchorBarSpacing_mm}x${hd.anchorBarSpacing_mm}`);

  // ---- checks ----
  let y = e.y - 1150 * k;
  out += text(layer, { x: origin.x, y }, h * 1.2, `KIEM TRA SO BO - luc keo thiet ke ${hd.designPull_kN.toFixed(1)} kN (coc bo chiu luc lon nhat x he so tai trong)`);
  y -= 2.4 * h;
  for (const c of hd.checks) {
    out += text(layer, { x: origin.x, y }, h, `${c.id}  ${c.label}: ${c.demand.toFixed(c.unit === '-' ? 2 : 1)} / ${c.capacity.toFixed(c.unit === '-' ? 2 : 1)} ${c.unit === '-' ? '' : c.unit} -> ${c.utilization.toFixed(2)} ${c.ok ? 'DAT' : 'KHONG DAT'}`);
    y -= 2.2 * h;
  }
  for (const t of [
    `YEU CAU: tim chot cap cach mat dat <= ${hd.pinAboveGround_mm} mm (dieu kien cua thiet ke cot thep coc). Khong nang cao tai neo.`,
    'Chua thiet ke: son / ma kem chong gi, khuyen lot cap (thimble) va dau cap, be tong mu coc cuc bo.'
  ]) {
    out += text(layer, { x: origin.x, y }, h, t);
    y -= 2.2 * h;
  }
  return out;
}
