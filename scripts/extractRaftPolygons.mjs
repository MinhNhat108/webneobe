/**
 * Regenerates `src/data/huoiVanhRaftPolygons.json` from a client floor-plan DXF.
 *
 *   node scripts/extractRaftPolygons.mjs "<path to the .dxf>" [layer]
 *
 * Default layer: A-DETL-THIN — where the raft-cluster boundaries live in
 * "CHUGIAP-HOHUOIVANH - Floor Plan - BỐ TRÍ PHAO BÈ". The boundaries are drawn
 * as plain LINE segments (no LWPOLYLINE), so the script chains them into closed
 * loops, converts mm to m (the file is $INSUNITS=4) and assigns each loop to the
 * raft(s) whose mooring attachment points fall inside it — one drawn cluster can
 * hold two calculation rafts (BÈ 8 + BÈ 9).
 *
 * Run it whenever the client sends an updated plan; never hand-edit the JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/data/huoiVanhRaftPolygons.json');
const COORDS = path.join(ROOT, 'src/data/huoiVanhCoordinates.json');

const dxfPath = process.argv[2];
const layerName = process.argv[3] ?? 'A-DETL-THIN';
if (!dxfPath) {
  console.error('Usage: node scripts/extractRaftPolygons.mjs "<file.dxf>" [layer]');
  process.exit(1);
}

/** Reads a DXF as alternating group-code / value lines — no library needed. */
function readEntities(file) {
  const L = fs.readFileSync(file, 'latin1').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < L.length - 1; i += 2) {
    if (L[i].trim() === '2' && L[i + 1] === 'ENTITIES') { start = i + 2; break; }
  }
  if (start < 0) throw new Error('No ENTITIES section found — is this an ASCII DXF?');

  const ents = [];
  let cur = null;
  for (let i = start; i < L.length - 1; i += 2) {
    const code = L[i].trim();
    const value = L[i + 1];
    if (code === '0') {
      if (value === 'ENDSEC') break;
      if (cur) ents.push(cur);
      cur = { type: value, g: [] };
    } else if (cur) {
      cur.g.push([code, value]);
    }
  }
  if (cur) ents.push(cur);
  return ents;
}

const get = (e, code) => { const p = e.g.find((x) => x[0] === code); return p ? p[1] : null; };
const mm2m = (v) => Math.round((Number(v) / 1000) * 1000) / 1000;
const key = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

const segments = readEntities(dxfPath)
  .filter((e) => e.type === 'LINE' && get(e, '8') === layerName)
  .map((e) => [
    { x: mm2m(get(e, '10')), y: mm2m(get(e, '20')) },
    { x: mm2m(get(e, '11')), y: mm2m(get(e, '21')) }
  ]);

if (segments.length === 0) throw new Error(`No LINE entities on layer ${layerName}`);

// Chain segments head-to-tail into closed loops.
const used = new Array(segments.length).fill(false);
const loops = [];
for (let i = 0; i < segments.length; i++) {
  if (used[i]) continue;
  used[i] = true;
  const loop = [segments[i][0], segments[i][1]];
  let grew = true;
  while (grew) {
    grew = false;
    for (let j = 0; j < segments.length; j++) {
      if (used[j]) continue;
      const last = loop[loop.length - 1];
      if (key(segments[j][0]) === key(last)) { loop.push(segments[j][1]); used[j] = true; grew = true; }
      else if (key(segments[j][1]) === key(last)) { loop.push(segments[j][0]); used[j] = true; grew = true; }
    }
  }
  const closed = key(loop[0]) === key(loop[loop.length - 1]);
  if (!closed) console.warn(`! loop ${loops.length + 1} is not closed (${loop.length} vertices)`);
  loops.push(closed ? loop.slice(0, -1) : loop);
}

const pointInRing = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const q = ring[(i + 1) % ring.length];
    a += ring[i].x * q.y - q.x * ring[i].y;
  }
  return Math.abs(a / 2);
};

const coords = JSON.parse(fs.readFileSync(COORDS, 'utf8'));
const raftNames = [...new Set(coords.map((c) => c.raft))];
const owners = loops.map(() => []);
for (const name of raftNames) {
  const pts = coords.filter((c) => c.raft === name).map((c) => ({ x: c.xRaft, y: c.yRaft }));
  let best = -1, bestHits = 0;
  loops.forEach((ring, i) => {
    const hits = pts.filter((p) => pointInRing(p, ring)).length;
    if (hits > bestHits) { bestHits = hits; best = i; }
  });
  if (best >= 0) owners[best].push(name);
  else console.warn(`! ${name}: no polygon contains its attachment points — it will fall back to the convex hull`);
}

const out = loops.map((points, i) => ({
  id: i + 1,
  rafts: owners[i],
  area_m2: Math.round(ringArea(points)),
  points
}));

fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`Wrote ${out.length} polygons to ${path.relative(ROOT, OUT)}`);
for (const o of out) console.log(`  #${o.id} ${o.rafts.join(' + ') || '(unassigned)'} — ${o.points.length} vertices, ${o.area_m2} m²`);
