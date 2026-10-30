#!/usr/bin/env node
/**
 * importRaftLayoutBanMong.mjs — the raft plan of Hồ Bản Mòng.
 *
 *   node scripts/importRaftLayoutBanMong.mjs "Tài liệu hồ Bản Mòng/HOBANMONG_BO_TRI_BE_PIN_PA2.dxf" [--dry]
 *
 * Source: "191026-HOBANMONG - Floor Plan - BỐ TRÍ BÈ PIN PA2.dwg" (client,
 * 2026-10-19), saved as DXF 2018 by AutoCAD. Same drawing conventions as the
 * Huổi Vanh plan: raft outlines are LINE segments on layer A-DETL-THIN (mm),
 * the raft number is an MTEXT on A-ANNO-NOTE inside each outline. 8 rafts,
 * BÈ 1 … BÈ 8.
 *
 * 1. Writes src/data/banMong/raftPolygons.json (counter-clockwise rings, m),
 *    with `designBed_m`: the MEDIAN ground level of the IFC Toposolid under
 *    the outline (src/data/banMong/terrainMesh.json, run
 *    extractTerrainFromIfc.mjs --lake=ban-mong first). That is the design lake
 *    bed of the raft (lake-bed bases sit at it; design depth = MNDB - it).
 *    It is the IFC model, not a bathymetric survey.
 * 2. Writes an EMPTY line file: the plan carries no mooring at all, every line
 *    is design output of `node scripts/planMooringLayoutV2.mjs --lake=ban-mong`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LAKES, ROOT } from './lakeConfig.mjs';

const LAKE = LAKES['ban-mong'];
const POLYS = path.join(ROOT, LAKE.files.polygons);
const COORDS = path.join(ROOT, LAKE.files.coords);
const TERRAIN = JSON.parse(fs.readFileSync(path.join(ROOT, LAKE.files.terrain), 'utf8'));
const dxfPath = process.argv[2];
const dry = process.argv.includes('--dry');
if (!dxfPath) { console.error('usage: node scripts/importRaftLayoutBanMong.mjs "<plan.dxf>" [--dry]'); process.exit(1); }
// the raft numbers of the current plan: the keys of panelsByRaft in lakeConfig (6 rafts since 2026-10-30)
const ORDER = Object.keys(LAKE.panelsByRaft).map((n) => n.replace(/^BÈ /, ''));

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
  .map((e) => ({ text: get(e, '1').replace(/^.*;/, '').trim(), x: +get(e, '10') / 1000, y: +get(e, '20') / 1000 }));

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
  if (closed && pts.length >= 3) loops.push(pts);
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
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------ IFC ground
const T_DX = (TERRAIN.bounds.maxX - TERRAIN.bounds.minX) / (TERRAIN.nx - 1);
const T_DY = (TERRAIN.bounds.maxY - TERRAIN.bounds.minY) / (TERRAIN.ny - 1);
const T_OFFSET = TERRAIN.projectDatumOffset_m ?? 0;
/** Ground level, project datum; same interpolation as sceneModel.groundAt. */
function groundAt(x, y) {
  const fx = (x - TERRAIN.bounds.minX) / T_DX, fy = (y - TERRAIN.bounds.minY) / T_DY;
  if (fx < 0 || fy < 0 || fx > TERRAIN.nx - 1 || fy > TERRAIN.ny - 1) return null;
  const col = Math.min(TERRAIN.nx - 2, Math.floor(fx)), row = Math.min(TERRAIN.ny - 2, Math.floor(fy));
  const tx = fx - col, ty = fy - row;
  const z = (r, c) => { const v = TERRAIN.elevations[r]?.[c]; return v === null || v === undefined ? null : v - T_OFFSET; };
  const p00 = z(row, col), p01 = z(row, col + 1), p10 = z(row + 1, col), p11 = z(row + 1, col + 1);
  if (p00 === null || p01 === null || p10 === null || p11 === null) return null;
  return tx >= ty ? p00 + tx * (p01 - p00) + ty * (p11 - p01) : p00 + ty * (p10 - p00) + tx * (p11 - p10);
}
/** Ground levels under an outline, sampled on a 2 m grid. */
function groundUnder(ring) {
  const xs = ring.map((p) => p.x), ys = ring.map((p) => p.y), out = [];
  for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 2) {
    for (let y = Math.min(...ys) + 1; y < Math.max(...ys); y += 2) {
      if (!inRing({ x, y }, ring)) continue;
      const g = groundAt(x, y);
      if (g !== null) out.push(g);
    }
  }
  return out.sort((a, b) => a - b);
}

const rafts = loops.filter((r) => Math.abs(signedArea(r)) > 500).map((ring) => {
  const label = labels.find((l) => inRing(l, ring));
  if (!label) throw new Error('a raft outline has no label inside it');
  const pts = signedArea(ring) > 0 ? ring : [...ring].reverse();
  return { label: label.text, ring: pts };
});
if (rafts.length !== ORDER.length || ORDER.some((n) => !rafts.find((r) => r.label === n))) {
  throw new Error(`expected rafts ${ORDER.join(', ')}; found ${rafts.map((r) => r.label).sort().join(', ')}`);
}
const polygons = ORDER.map((label, i) => {
  const r = rafts.find((q) => q.label === label).ring;
  const c = centroid(r);
  const g = groundUnder(r);
  if (!g.length) throw new Error(`BÈ ${label}: no IFC ground under the outline`);
  const q = (f) => Math.round(g[Math.min(g.length - 1, Math.floor(f * g.length))] * 100) / 100;
  return {
    id: i + 1,
    name: `BÈ ${label}`,
    area_m2: Math.round(Math.abs(signedArea(r))),
    perimeter_m: Math.round(perimeter(r) * 10) / 10,
    centroid: { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 },
    designBed_m: q(0.5),
    bedRange_m: { p10: q(0.1), p90: q(0.9), max: q(1) },
    points: r.map((p) => ({ x: r3(p.x), y: r3(p.y) }))
  };
});

console.log(polygons.map((p) => `${p.name}: ${p.area_m2} m2, P ${p.perimeter_m} m, ${p.points.length} pts, bed (IFC) p50 ${p.designBed_m} / p90 ${p.bedRange_m.p90} / max ${p.bedRange_m.max} m`).join('\n'));
console.log(`total area ${polygons.reduce((s, p) => s + p.area_m2, 0)} m2`);
if (!dry) {
  fs.mkdirSync(path.dirname(POLYS), { recursive: true });
  fs.writeFileSync(POLYS, JSON.stringify(polygons, null, 2) + '\n');
  fs.writeFileSync(COORDS, '[]\n');
  console.log('written', path.relative(ROOT, POLYS), path.relative(ROOT, COORDS), '— now run scripts/planMooringLayoutV2.mjs --lake=ban-mong');
}
