/**
 * STUDY (writes nothing into src/): the owner's new anchoring rule of 2026-10-08
 *   1. near the shore -> bored piles D350, also where the water is shallow;
 *   2. lake-bed bases (RC base + screw piles) ONLY between two rafts;
 *   3. can one base in a gap be SHARED by the two facing rafts?
 *
 *   npx vite-node scripts/studySharedBedAnchors.ts [-- --shore-level=384.0 --max-span=60 --gap=45]
 *
 * It classifies the 163 lake-bed anchors of the present layout, looks for a
 * shore position for those not between two rafts (IFC terrain, project datum),
 * pairs the lines of facing rafts onto shared bases and designs those bases
 * with the same checks as the engine (screwAnchorBed.ts), for the wind the
 * project is set to. Output: docs/neo-day-dung-chung/BAO_CAO.md + .json.
 *
 * Thresholds are assumptions to be confirmed by the owner — they are printed
 * in the report and can be changed on the command line.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateProject } from '../src/lib/calc';
import { buildRaftProjectState } from '../src/lib/calc/raftState';
import type { ProjectState } from '../src/lib/calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../src/data/huoiVanhProject';
import { MOORING_LINES_V2, RAFT_POLYGONS_V2 } from '../src/data/huoiVanhLayout';
import { evaluateScrewBase, designScrewBase, SCREW_BASE_DEFAULTS, SCREW_BASE_MAX_SIDE_M, type ScrewBaseResult } from '../src/lib/calc/screwAnchorBed';
import { groundAt, MNC_M, MNDB_M, MNLKT_M } from '../src/components/simulation/sceneModel';
import { designWindCaveat } from '../src/lib/calc/designWind';

const arg = (name: string, dflt: number) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? Number(a.split('=')[1]) : dflt; };
/** Ground at or above this level counts as "shore / water's edge" where a small drilling rig can work, m. */
const SHORE_LEVEL = arg('shore-level', 384.0);
/** Longest cable accepted from a raft to a new shore pile, m (the longest existing shore line is ~54 m). */
const MAX_SHORE_SPAN = arg('max-span', 60);
/** A lake-bed anchor is "between two rafts" when another raft lies within this distance of its cleat, along the cable, m. */
const GAP_LIMIT = arg('gap', 45);
const PRETENSION_KN = HUOI_VANH_DEFAULT_PROJECT.line.pretension_kN ?? 5;

type Pt = { x: number; y: number };
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '../docs/neo-day-dung-chung');
const ringOf = new Map(RAFT_POLYGONS_V2.map((p) => [p.name, p.points]));
const inRing = (p: Pt, ring: Pt[]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const distSeg = (p: Pt, a: Pt, b: Pt) => { const dx = b.x - a.x, dy = b.y - a.y; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const distRing = (p: Pt, ring: Pt[]) => Math.min(...ring.map((q, i) => distSeg(p, q, ring[(i + 1) % ring.length])));
/** Distance along `dir` from `o` to the first edge of the ring (Infinity when the ray misses it). */
function rayToRing(o: Pt, dir: Pt, ring: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i], d = ring[(i + 1) % ring.length];
    const den = dir.x * (d.y - c.y) - dir.y * (d.x - c.x);
    if (Math.abs(den) < 1e-12) continue;
    const t = ((c.x - o.x) * (d.y - c.y) - (c.y - o.y) * (d.x - c.x)) / den;
    const u = ((c.x - o.x) * dir.y - (c.y - o.y) * dir.x) / den;
    if (t > 1e-6 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

// ------------------------------------------------------------------ engine: tension of every raft
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const raft = new Map(HUOI_VANH_RAFTS.map((item) => {
  const st = buildRaftProjectState(state, item, dflt().anchor);
  return [item.name, { item, st, res: calculateProject(st) }];
}));
const wind = state.env.windSpeed_ms;
const cu = state.anchor.cuBed_kPa;

// ------------------------------------------------------------------ 1. classify the lake-bed lines
interface BedLine { code: string; raft: string; cleat: Pt; anchor: Pt; span: number; dir: Pt; bedLevel: number; other?: string; gap?: number; shore?: { x: number; y: number; span: number; ground: number; turn: number }; kind: 'between' | 'to-shore' | 'open-water' }
const bedLines: BedLine[] = MOORING_LINES_V2.filter((l) => l.type === 'BED').map((l) => {
  const cleat = { x: l.xRaft, y: l.yRaft }, anchor = { x: l.xAnchor, y: l.yAnchor };
  const dir = { x: (anchor.x - cleat.x) / l.span, y: (anchor.y - cleat.y) / l.span };
  // another raft facing this cleat within GAP_LIMIT (along the cable, or within ±30°)
  let other: string | undefined, gap = Infinity;
  for (const deg of [0, -15, 15, -30, 30]) {
    const r = (deg * Math.PI) / 180, d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
    for (const p of RAFT_POLYGONS_V2) {
      if (p.name === l.raft) continue;
      const t = rayToRing(cleat, d, p.points);
      if (t < gap) { gap = t; other = p.name; }
    }
  }
  const between = gap <= GAP_LIMIT;
  // a shore position: march outwards (fan ±45°) until the terrain reaches the shore level
  let shore: BedLine['shore'];
  if (!between) {
    for (const deg of [0, -10, 10, -20, 20, -30, 30, -45, 45]) {
      const r = (deg * Math.PI) / 180, d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
      for (let s = 3; s <= MAX_SHORE_SPAN; s += 0.5) {
        const q = { x: cleat.x + d.x * s, y: cleat.y + d.y * s };
        if (RAFT_POLYGONS_V2.some((p) => inRing(q, p.points) || (p.name !== l.raft && distRing(q, p.points) < 5))) break; // never across or beside another raft
        const g = groundAt(q.x, q.y);
        if (g === null) break;
        if (g >= SHORE_LEVEL) {
          if (!shore || s < shore.span) shore = { x: q.x, y: q.y, span: s, ground: g, turn: deg };
          break;
        }
      }
    }
  }
  return { code: l.code, raft: l.raft, cleat, anchor, span: l.span, dir, bedLevel: l.zAnchor, other: between ? other : undefined, gap: between ? gap : undefined, shore, kind: between ? 'between' : shore ? 'to-shore' : 'open-water' };
});

// ------------------------------------------------------------------ 2. shared bases in the gaps
/** The base under any pair (net horizontal pull, total uplift): one equivalent cable with the same two components. */
function checkBase(Th: number, Tv: number, B: number, t: number): ScrewBaseResult {
  const h = Math.max(Th, 1e-6), T = Math.hypot(h, Tv), span = 10, depth = t + SCREW_BASE_DEFAULTS.padeyeHeight_m + (span * Tv) / h;
  return evaluateScrewBase({ tension_kN: T, span_m: span, depthLow_m: depth, depthHigh_m: depth, cuSurface_kPa: cu, cuAverage_kPa: cu }, B, t);
}
const MESH_OK = (r: ScrewBaseResult) => r.holeFits && Math.max(r.upliftUtil, r.slideUtil, r.overturnUtil, r.screwUtil, r.bearingUtil) <= 1 + 1e-9; // slab steel is chosen after
interface Combo { name: string; Th: number; Tv: number }
function sizeBase(combos: Combo[]): { B: number; t: number; ok: boolean; worst: string; util: number } {
  let best: { B: number; t: number; vol: number; worst: string; util: number } | undefined;
  for (const t of [0.4, 0.5, 0.6, 0.8]) {
    for (let B = 2.5; B <= SCREW_BASE_MAX_SIDE_M + 1e-9; B += 0.25) {
      let worst = '', util = 0, ok = true;
      for (const c of combos) {
        const r = checkBase(c.Th, c.Tv, B, t);
        const u = Math.max(r.upliftUtil, r.slideUtil, r.overturnUtil, r.screwUtil, r.bearingUtil);
        if (u > util) { util = u; worst = c.name; }
        if (!MESH_OK(r)) ok = false;
      }
      if (ok) { if (!best || B * B * t < best.vol - 1e-9) best = { B, t, vol: B * B * t, worst, util }; break; }
    }
  }
  return best ? { B: best.B, t: best.t, ok: true, worst: best.worst, util: best.util } : { B: SCREW_BASE_MAX_SIDE_M, t: 0.8, ok: false, worst: '-', util: Infinity };
}
/** Horizontal and vertical components of a line of tension T from a base at `bedLevel` to a cleat `span` away, at a water level. */
const comp = (T: number, span: number, bedLevel: number, level: number, t: number) => {
  const rise = Math.max(0, level - bedLevel - t - SCREW_BASE_DEFAULTS.padeyeHeight_m);
  const a = Math.atan(rise / Math.max(0.1, span));
  return { Th: T * Math.cos(a), Tv: T * Math.sin(a) };
};

// pair the lines of facing rafts: for each raft pair, sort both sets along the gap and pair them in order
const pairKey = (a: string, b: string) => [a, b].sort().join(' ↔ ');
const groups = new Map<string, BedLine[]>();
for (const l of bedLines.filter((x) => x.kind === 'between')) { const k = pairKey(l.raft, l.other!); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(l); }
interface Shared { pair: string; a?: BedLine; b?: BedLine; x: number; y: number; spanA: number; spanB: number; B: number; t: number; ok: boolean; worst: string; util: number; Benvelope: number; tEnvelope: number; okEnvelope: boolean; soloB: number }
const shared: Shared[] = [];
for (const [k, ls] of groups) {
  const [ra, rb] = k.split(' ↔ ');
  const A = ls.filter((l) => l.raft === ra), Bs = ls.filter((l) => l.raft === rb);
  // axis of the gap = principal direction of the anchors of this group
  const cx = ls.reduce((s, l) => s + l.anchor.x, 0) / ls.length, cy = ls.reduce((s, l) => s + l.anchor.y, 0) / ls.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const l of ls) { const dx = l.anchor.x - cx, dy = l.anchor.y - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = { x: Math.cos(th), y: Math.sin(th) };
  const along = (l: BedLine) => (l.cleat.x - cx) * ax.x + (l.cleat.y - cy) * ax.y;
  A.sort((p, q) => along(p) - along(q)); Bs.sort((p, q) => along(p) - along(q));
  // pair in order; a line with no partner within 12 m along the gap keeps a base of its own
  const usedB = new Set<number>();
  const TA = raft.get(ra)!.res.t_max_intact_kN, TB = raft.get(rb)!.res.t_max_intact_kN;
  const build = (a?: BedLine, b?: BedLine) => {
    const pos = a && b ? { x: (a.anchor.x + b.anchor.x) / 2, y: (a.anchor.y + b.anchor.y) / 2 } : (a ?? b)!.anchor;
    const spanA = a ? Math.hypot(pos.x - a.cleat.x, pos.y - a.cleat.y) : 0, spanB = b ? Math.hypot(pos.x - b.cleat.x, pos.y - b.cleat.y) : 0;
    const bed = (a ?? b)!.bedLevel;
    const combos: Combo[] = [], envelope: Combo[] = [];
    for (const [lvName, lv] of [['MNC', MNC_M], ['MNLKT', MNLKT_M]] as Array<[string, number]>) {
      // iterate t inside sizeBase via closure is not possible -> use t = 0.4 for the components (thicker bases lower the rise slightly: conservative)
      const cA = (T: number) => (a ? comp(T, spanA, bed, lv, 0.4) : { Th: 0, Tv: 0 });
      const cB = (T: number) => (b ? comp(T, spanB, bed, lv, 0.4) : { Th: 0, Tv: 0 });
      const a1 = cA(TA), b0 = cB(b ? PRETENSION_KN : 0), a0 = cA(a ? PRETENSION_KN : 0), b1 = cB(TB);
      if (a) combos.push({ name: `${ra} căng, ${b ? rb + ' chùng' : 'một dây'} (${lvName})`, Th: Math.abs(a1.Th - b0.Th), Tv: a1.Tv + b0.Tv });
      if (b) combos.push({ name: `${rb} căng, ${a ? ra + ' chùng' : 'một dây'} (${lvName})`, Th: Math.abs(b1.Th - a0.Th), Tv: b1.Tv + a0.Tv });
      if (a && b) envelope.push({ name: `cả hai dây căng (${lvName})`, Th: Math.abs(a1.Th - b1.Th), Tv: a1.Tv + b1.Tv });
    }
    const s = sizeBase(combos), e = sizeBase([...combos, ...envelope]);
    // what the two lines need today, each on its own base at its own anchor
    const solo = Math.max(...[a, b].filter(Boolean).map((l) => designScrewBase({ tension_kN: l!.raft === ra ? TA : TB, span_m: l!.span, depthLow_m: MNC_M - l!.bedLevel, depthHigh_m: MNLKT_M - l!.bedLevel, cuSurface_kPa: cu, cuAverage_kPa: cu }).side_m));
    shared.push({ pair: k, a, b, x: pos.x, y: pos.y, spanA, spanB, B: s.B, t: s.t, ok: s.ok, worst: s.worst, util: s.util, Benvelope: e.B, tEnvelope: e.t, okEnvelope: e.ok, soloB: solo });
  };
  for (const a of A) {
    let pick = -1, best = 12;
    Bs.forEach((b, i) => { if (usedB.has(i)) return; const d = Math.abs(along(a) - along(b)); if (d < best) { best = d; pick = i; } });
    if (pick >= 0) { usedB.add(pick); build(a, Bs[pick]); } else build(a, undefined);
  }
  Bs.forEach((b, i) => { if (!usedB.has(i)) build(undefined, b); });
}

// ------------------------------------------------------------------ report
const vn = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '∞');
const byKind = (k: BedLine['kind']) => bedLines.filter((l) => l.kind === k);
const toShore = byKind('to-shore'), open = byKind('open-water'), between = byKind('between');
const pairs = shared.filter((s) => s.a && s.b), singles = shared.filter((s) => !(s.a && s.b));
const perRaft = HUOI_VANH_RAFTS.map((r) => {
  const own = bedLines.filter((l) => l.raft === r.name);
  return { name: r.name, shoreNow: r.shoreAnchors, bedNow: r.bedAnchors, toShore: own.filter((l) => l.kind === 'to-shore').length, between: own.filter((l) => l.kind === 'between').length, open: own.filter((l) => l.kind === 'open-water').length, T: raft.get(r.name)!.res.t_max_intact_kN };
});
const groupRows = [...groups.keys()].map((k) => {
  const ss = shared.filter((s) => s.pair === k);
  const [ra, rb] = k.split(' ↔ ');
  const gapW = Math.min(...groups.get(k)!.map((l) => l.gap!));
  return { pair: k, linesA: ss.filter((s) => s.a).length, linesB: ss.filter((s) => s.b).length, ra, rb, gap: gapW, shared: ss.filter((s) => s.a && s.b).length, single: ss.filter((s) => !(s.a && s.b)).length,
    B: [Math.min(...ss.map((s) => s.B)), Math.max(...ss.map((s) => s.B))], Be: [Math.min(...ss.map((s) => s.Benvelope)), Math.max(...ss.map((s) => s.Benvelope))], solo: [Math.min(...ss.map((s) => s.soloB)), Math.max(...ss.map((s) => s.soloB))], ok: ss.every((s) => s.ok), okE: ss.every((s) => s.okEnvelope), worst: ss.reduce((w, s) => (s.util > w.util ? s : w), ss[0]).worst };
});
const conc = (list: Array<{ B: number; t: number }>) => list.reduce((s, x) => s + x.B * x.B * x.t, 0);
const totals = {
  bedNow: bedLines.length, shoreNow: MOORING_LINES_V2.length - bedLines.length,
  toShore: toShore.length, between: between.length, open: open.length,
  sharedBases: pairs.length, singleBasesInGaps: singles.length,
  basesNew: pairs.length + singles.length + open.length, shoreNew: MOORING_LINES_V2.length - bedLines.length + toShore.length,
  concreteShared_m3: conc(shared.map((s) => ({ B: s.B, t: s.t }))), concreteSharedEnvelope_m3: conc(shared.map((s) => ({ B: s.Benvelope, t: s.tEnvelope }))),
  shoreSpan: toShore.length ? [Math.min(...toShore.map((l) => l.shore!.span)), Math.max(...toShore.map((l) => l.shore!.span))] : [0, 0]
};
const caveat = designWindCaveat(wind);
const md = `# Nghiên cứu: ưu tiên cọc khoan nhồi ven bờ và đế neo đáy dùng chung giữa hai bè

Sinh bởi \`scripts/studySharedBedAnchors.ts\`. **Đây là nghiên cứu: chưa thay đổi mặt bằng neo, web hay bản vẽ.**
Gió tính toán V = ${wind} m/s.${caveat ? ` ${caveat}` : ''}

## 1. Quy tắc và ngưỡng đã dùng (cần Chủ đầu tư xác nhận)
- Điểm neo đáy **nằm giữa hai bè**: có bè khác trong vòng **${GAP_LIMIT} m** tính từ điểm móc cáp theo phương dây (±30°).
- Điểm còn lại: tìm vị trí cọc khoan nhồi trên bờ / mép nước theo phương dây (quét ±45°), tại chỗ địa hình IFC đạt cao độ **≥ ${vn(SHORE_LEVEL)} m** (MNDB ${MNDB_M} m − ${vn(MNDB_M - SHORE_LEVEL)} m, "mấp mé nước"), dây dài không quá **${MAX_SHORE_SPAN} m**, không đi qua hay sát bè khác.
- Lực dây: lực bất lợi nhất của bè (chưa có mô hình chia lực từng dây). Dây chùng lấy lực căng trước ${PRETENSION_KN} kN. c_u bùn = ${cu} kPa (giả định).
- Đế đặt ở cao độ đáy thiết kế (${vn(Math.min(...bedLines.map((l) => l.bedLevel)))}–${vn(Math.max(...bedLines.map((l) => l.bedLevel)))} m); hai mực nước MNC ${MNC_M} và MNLKT ${MNLKT_M} m.

## 2. Phân loại ${totals.bedNow} điểm neo đáy hiện tại
| Loại | Số điểm | Xử lý theo chỉ đạo mới |
|---|---|---|
| Giữa hai bè | ${totals.between} | giữ neo đáy, ghép thành đế dùng chung |
| Ven bờ, có vị trí đặt cọc trong ${MAX_SHORE_SPAN} m | ${totals.toShore} | chuyển sang cọc khoan nhồi D350 (dây dài ${vn(totals.shoreSpan[0])}–${vn(totals.shoreSpan[1])} m) |
| Mặt nước trống, không có bờ trong ${MAX_SHORE_SPAN} m và không có bè đối diện | ${totals.open} | **chưa có lời giải theo chỉ đạo mới** — giữ đế đơn, hoặc kéo dây dài hơn tới bờ |

| Bè | T dây (kN) | Bờ hiện tại | Đáy hiện tại | → chuyển lên bờ | → giữa hai bè | → mặt nước trống |
|---|---|---|---|---|---|---|
${perRaft.map((r) => `| ${r.name} | ${vn(r.T)} | ${r.shoreNow} | ${r.bedNow} | ${r.toShore} | ${r.between} | ${r.open} |`).join('\n')}

## 3. Đế dùng chung trong từng khe
Mỗi đế dùng chung đặt ở trung điểm hai điểm neo hiện tại của hai dây đối diện (hai dây lệch nhau không quá 12 m dọc khe). Dây không có dây đối diện vẫn dùng đế riêng.

| Khe | Bề rộng khe nhỏ nhất (m) | Dây của hai bè | Đế dùng chung | Đế riêng còn lại | Cạnh đế dùng chung (m) | Nếu cả hai dây cùng căng (m) | Đế riêng hiện nay (m) | Tổ hợp chi phối |
|---|---|---|---|---|---|---|---|---|
${groupRows.map((g) => `| ${g.pair} | ${vn(g.gap)} | ${g.linesA} + ${g.linesB} | ${g.shared} | ${g.single} | ${vn(g.B[0], 2)}–${vn(g.B[1], 2)}${g.ok ? '' : ' KHÔNG ĐẠT'} | ${vn(g.Be[0], 2)}–${vn(g.Be[1], 2)}${g.okE ? '' : ' KHÔNG ĐẠT'} | ${vn(g.solo[0], 2)}–${vn(g.solo[1], 2)} | ${g.worst} |`).join('\n')}

## 4. Tổng hợp
| | Hiện tại | Theo chỉ đạo mới |
|---|---|---|
| Điểm neo bờ (cọc khoan nhồi) | ${totals.shoreNow} | **${totals.shoreNew}** (+${totals.toShore}) |
| Đế neo đáy | ${totals.bedNow} | **${totals.basesNew}** = ${totals.sharedBases} đế dùng chung + ${totals.singleBasesInGaps} đế riêng trong khe + ${totals.open} đế ở mặt nước trống |
| Tuyến cáp | ${MOORING_LINES_V2.length} | ${MOORING_LINES_V2.length} (không đổi) |

Bê tông các đế trong khe: ${vn(totals.concreteShared_m3)} m³ (${vn(totals.concreteSharedEnvelope_m3)} m³ nếu thiết kế cho trường hợp cả hai dây cùng căng).

## 5. Dùng chung được không — cơ học
- **Được**, với điều kiện đế có hai tai neo (hoặc tai neo đôi) và được kiểm tra theo các tổ hợp dưới đây.
- Khi gió thổi ngang khe, bè phía đầu gió trôi về phía khe nên dây của nó chùng; bè phía cuối gió trôi ra xa nên dây của nó căng. Hai dây **không căng cực đại cùng lúc**. Tổ hợp thiết kế: một dây ở lực cực đại, dây kia ở lực căng trước ${PRETENSION_KN} kN, ở cả hai mực nước.
- Dây chùng kéo ngược lại nên lực trượt giảm một ít; nhưng lực nhổ **cộng thêm** phần đứng của dây chùng. Vì vậy đế dùng chung không nhỏ hơn đế riêng — lợi ích là **số lượng đế**, không phải kích thước.
- Cột "nếu cả hai dây cùng căng" là bao an toàn (ví dụ gió xiên, hoặc dây chùng bị căng do bè lệch): lực ngang triệt tiêu, lực nhổ gấp đôi. Nên dùng cột này nếu chưa có mô hình phân bố lực.
- Khe càng hẹp thì dây càng dốc khi nước cao, lực nhổ càng lớn: các khe hẹp nhất cho đế lớn nhất.

## 6. Giới hạn — phải đọc
- Vị trí cọc bờ mới lấy theo địa hình IFC; chưa kiểm tra đường tiếp cận của máy khoan, chưa kiểm tra dây mới có cắt dây khác không. Phải chạy lại \`planMooringLayoutV2.mjs\` (sau khi sửa quy tắc) mới có mặt bằng thật.
- Dây ra bờ dài hơn dây đáy cũ: độ chùng / độ trôi bè khi mực nước đổi 6 m chưa kiểm tra.
- Tai neo đôi, chọc thủng bản đế tại tai neo và xoắn đế khi hai dây lệch nhau **chưa thiết kế**.
- Đế dùng chung nối cơ học hai bè: sự cố ở một bè (đứt dây, trôi) truyền sang đế của bè kia.
- Các ngưỡng ở mục 1 là giả định của người lập; đổi ngưỡng thì số lượng đổi theo.
`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'BAO_CAO.md'), md);
fs.writeFileSync(path.join(outDir, 'neo_day_dung_chung.json'), JSON.stringify({ thresholds: { SHORE_LEVEL, MAX_SHORE_SPAN, GAP_LIMIT, wind }, totals, perRaft, groupRows, toShore: toShore.map((l) => ({ code: l.code, raft: l.raft, ...l.shore })), open: open.map((l) => ({ code: l.code, raft: l.raft, x: l.anchor.x, y: l.anchor.y })), shared: shared.map((s) => ({ pair: s.pair, a: s.a?.code, b: s.b?.code, x: +s.x.toFixed(2), y: +s.y.toFixed(2), B: s.B, t: s.t, Benvelope: s.Benvelope, tEnvelope: s.tEnvelope, worst: s.worst })) }, null, 1));
console.log(JSON.stringify({ totals, perRaft, groupRows: groupRows.map((g) => ({ ...g, B: g.B.join('-'), Be: g.Be.join('-'), solo: g.solo.join('-') })) }, null, 1));
