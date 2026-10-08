#!/usr/bin/env node
/**
 * importRaftLayout9.mjs — switch the project to the 9-raft plan of 2026-10-08.
 *
 *   node scripts/importRaftLayout9.mjs "Tài liệu hồ Huổi Vanh/HỒ HUỔI VANH.dxf" [--dry]
 *
 * 1. Reads the nine raft outlines from the client's floor plan (layer
 *    A-DETL-THIN, LINE segments chained into closed loops, mm -> m) and names
 *    each one after the label drawn inside it (layer A-ANNO-NOTE):
 *    1, 2, 3, 3A (old 4+5), 5A (old 6+7), 6 (old 8), 7 (old 9), 8 (old 10+11),
 *    9 (old 12). Writes src/data/huoiVanhRaftPolygons_v2.json.
 * 2. Carries the SHORE lines over: a shore pile is a staked point on the bank
 *    and does not move; each line is handed to the raft whose new outline is
 *    nearest to its old cleat and is re-coded B<raft>-Dnn. Every LAKE-BED line
 *    is dropped: the bed anchors are design output and are laid out again by
 *    scripts/planMooringLayoutV2.mjs, which must be run next.
 *
 * The file names keep their "_v2" suffix (they are imported all over the app);
 * the content is the 9-raft layout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLYS = path.join(ROOT, 'src/data/huoiVanhRaftPolygons_v2.json');
const COORDS = path.join(ROOT, 'src/data/huoiVanhCoordinates_v2.json');
const dxfPath = process.argv[2];
const dry = process.argv.includes('--dry');
if (!dxfPath) { console.error('usage: node scripts/importRaftLayout9.mjs "<plan.dxf>" [--dry]'); process.exit(1); }
const ORDER = ['1', '2', '3', '3A', '5A', '6', '7', '8', '9'];

// ------------------------------------------------------------------ DXF
const L = fs.readFileSync(dxfPath, 'utf8').split(/\r?\n/);
let start = -1;
for (let i = 0; i < L.length - 1; i += 2) if (L[i].trim() === '2' && L[i + 1].trim() === 'ENTITIES') { start = i + 2; break; }
if (start < 0) throw new Error('no ENTITIES section: is this an ASCII DXF?');
const ents = [];
let cur = null;
for (let i = start; i < L.length - 1; i += 2) {
  const c = L[i].trim(), v = L[i + 1].trim();
  if (c === '0') { if (v === 'ENDSEC') break; if (cur) ents.push(cur); cur = { type: v, g: [] }; } else if (cur) cur.g.push([c, v]);
}
if (cur) ents.push(cur);
const get = (e, c) => { const p = e.g.find((x) => x[0] === c); return p ? p[1] : null; };
const segs = ents.filter((e) => e.type === 'LINE' && get(e, '8') === 'A-DETL-THIN')
  .map((e) => [{ x: +get(e, '10') / 1000, y: +get(e, '20') / 1000 }, { x: +get(e, '11') / 1000, y: +get(e, '21') / 1000 }]);
const labels = ents.filter((e) => e.type === 'MTEXT' && get(e, '8') === 'A-ANNO-NOTE')
  .map((e) => ({ text: get(e, '1'), x: +get(e, '10') / 1000, y: +get(e, '20') / 1000 }));

const key = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
const adj = new Map();
segs.forEach((s, i) => { for (const p of s) { const k = key(p); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
const used = new Set(), loops = [];
for (let i = 0; i < segs.length; i++) {
  if (used.has(i)) continue;
  const pts = [segs[i][0]];
  let p = segs[i][1], closed = false;
  used.add(i);
  for (let guard = 0; guard < 5000; guard++) {
    if (key(p) === key(pts[0])) { closed = true; break; }
    pts.push(p);
    const nxt = (adj.get(key(p)) || []).find((j) => !used.has(j));
    if (nxt === undefined) break;
    used.add(nxt);
    p = key(segs[nxt][0]) === key(p) ? segs[nxt][1] : segs[nxt][0];
  }
  if (closed && pts.length >= 4) loops.push(pts);
}
const signedArea = (r) => r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a.x * b.y - b.x * a.y; }, 0) / 2;
const perimeter = (r) => r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + Math.hypot(b.x - a.x, b.y - a.y); }, 0);
const centroid = (r) => {
  const A = signedArea(r);
  let cx = 0, cy = 0;
  r.forEach((a, i) => { const b = r[(i + 1) % r.length]; const f = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f; });
  return { x: cx / (6 * A), y: cy / (6 * A) };
};
const inRing = (p, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const distToRing = (p, ring) => Math.min(...ring.map((q, i) => distToSeg(p, q, ring[(i + 1) % ring.length])));
const r3 = (v) => Math.round(v * 1000) / 1000;

const rafts = loops.filter((r) => Math.abs(signedArea(r)) > 500).map((ring) => {
  const label = labels.find((l) => inRing(l, ring));
  if (!label) throw new Error('a raft outline has no label inside it');
  // counter-clockwise, like the previous file
  const pts = signedArea(ring) > 0 ? ring : [...ring].reverse();
  return { label: label.text, ring: pts };
});
if (rafts.length !== ORDER.length || ORDER.some((n) => !rafts.find((r) => r.label === n))) {
  throw new Error(`expected rafts ${ORDER.join(', ')}; found ${rafts.map((r) => r.label).sort().join(', ')}`);
}
const polygons = ORDER.map((label, i) => {
  const r = rafts.find((q) => q.label === label).ring;
  const c = centroid(r);
  return {
    id: i + 1,
    name: `BÈ ${label}`,
    area_m2: Math.round(Math.abs(signedArea(r))),
    perimeter_m: Math.round(perimeter(r) * 10) / 10,
    centroid: { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 },
    points: r.map((p) => ({ x: r3(p.x), y: r3(p.y) }))
  };
});

// ------------------------------------------------------------------ shore lines
const old = JSON.parse(fs.readFileSync(COORDS, 'utf8'));
const already = old.every((c) => polygons.some((p) => p.name === c.raft));
const counters = {};
// A shore line marked `converted` was a lake-bed line turned into a bored pile by the layout
// script: design output, dropped here and re-planned like the lake-bed lines.
const lines = old.filter((c) => c.type === 'SHORE' && !c.converted).map((c) => {
  const cleat = { x: c.xRaft, y: c.yRaft };
  const owner = polygons.reduce((best, p) => (distToRing(cleat, p.points) < distToRing(cleat, best.points) ? p : best), polygons[0]);
  return { ...c, raft: owner.name, _old: c.code };
});
// keep the rafts in catalogue order and re-code
const out = [];
for (const p of polygons) {
  const prefix = `B${p.name.replace('BÈ ', '')}`;
  for (const c of lines.filter((q) => q.raft === p.name)) {
    counters[p.name] = (counters[p.name] ?? 0) + 1;
    const { _old, ...rest } = c;
    out.push({ ...rest, code: `${prefix}-D${String(counters[p.name]).padStart(2, '0')}` });
  }
}

console.log(polygons.map((p) => `${p.name}: ${p.area_m2} m2, P ${p.perimeter_m} m, ${p.points.length} pts, ${counters[p.name] ?? 0} shore lines`).join('\n'));
console.log(`total area ${polygons.reduce((s, p) => s + p.area_m2, 0)} m2; shore lines ${out.length}; bed lines dropped ${old.length - out.length}`);
if (already) console.log('note: the line file already used the 9-raft names (re-import)');
if (!dry) {
  fs.writeFileSync(POLYS, JSON.stringify(polygons, null, 2) + '\n');
  fs.writeFileSync(COORDS, JSON.stringify(out, null, 2) + '\n');
  console.log('written', path.relative(ROOT, POLYS), path.relative(ROOT, COORDS), '— now run scripts/planMooringLayoutV2.mjs');
}
