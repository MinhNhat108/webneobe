import fs from 'node:fs';

const dxfPath = 'E:/Out Job/Chu Giap/Web tính neo bè/Tài liệu hồ Huổi Vanh/HỒ HUỔI VANH.dxf';
const layerName = 'A-DETL-THIN';

function readEntities(file) {
  const L = fs.readFileSync(file, 'latin1').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < L.length - 1; i += 2) {
    if (L[i].trim() === '2' && L[i + 1] === 'ENTITIES') { start = i + 2; break; }
  }
  if (start < 0) throw new Error('No ENTITIES section found');

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

const ents = readEntities(dxfPath);
console.log(`Total entities: ${ents.length}`);

const lines = ents.filter((e) => e.type === 'LINE' && get(e, '8') === layerName);
console.log(`Found ${lines.length} lines on ${layerName}`);

// Segments in meters
const segs = lines.map((e) => ({
  a: { x: mm2m(get(e, '10')), y: mm2m(get(e, '20')) },
  b: { x: mm2m(get(e, '11')), y: mm2m(get(e, '21')) }
}));

// Build adjacency
const adj = new Map();
for (const s of segs) {
  const ka = key(s.a), kb = key(s.b);
  if (!adj.has(ka)) adj.set(ka, []);
  if (!adj.has(kb)) adj.set(kb, []);
  adj.get(ka).push({ pt: s.b, k: kb });
  adj.get(kb).push({ pt: s.a, k: ka });
}

// Chain loops
const loops = [];
const used = new Set();
for (let i = 0; i < segs.length; i++) {
  if (used.has(i)) continue;
  const chain = [segs[i].a, segs[i].b];
  used.add(i);

  while (true) {
    const tail = key(chain[chain.length - 1]);
    const start = key(chain[0]);
    if (tail === start && chain.length > 2) break; // closed!

    const nextSegIdx = segs.findIndex((s, idx) => {
      if (used.has(idx)) return false;
      return key(s.a) === tail || key(s.b) === tail;
    });

    if (nextSegIdx < 0) break;
    used.add(nextSegIdx);
    const n = segs[nextSegIdx];
    chain.push(key(n.a) === tail ? n.b : n.a);
  }

  if (key(chain[0]) === key(chain[chain.length - 1]) && chain.length > 3) {
    chain.pop(); // remove duplicate closing point
    loops.push(chain);
  }
}

console.log(`Extracted ${loops.length} closed loops!`);

// Calculate area & perimeter of each loop
function loopMetrics(pts) {
  let a = 0, p = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    a += (p1.x * p2.y - p2.x * p1.y);
    p += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return {
    area: Math.abs(a) / 2,
    perimeter: p,
    center: {
      x: pts.reduce((s, pt) => s + pt.x, 0) / pts.length,
      y: pts.reduce((s, pt) => s + pt.y, 0) / pts.length
    }
  };
}

loops.forEach((lp, idx) => {
  const m = loopMetrics(lp);
  console.log(`Loop ${idx + 1}: ${lp.length} vertices, Area = ${m.area.toFixed(1)} m2 (${(m.area/10000).toFixed(2)} ha), P = ${m.perimeter.toFixed(1)} m, Center = (${m.center.x.toFixed(1)}, ${m.center.y.toFixed(1)})`);
});

// Also find TEXT / MTEXT on A-ANNO-NOTE to associate loop with raft name
const tags = ents.filter(e => (e.type === 'MTEXT' || e.type === 'TEXT') && get(e, '8') === 'A-ANNO-NOTE')
  .map(e => ({
    text: get(e, '1'),
    pos: { x: mm2m(get(e, '10')), y: mm2m(get(e, '20')) }
  }));

console.log('\nTags on A-ANNO-NOTE:', tags);
