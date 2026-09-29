/**
 * Extracts the Huổi Vanh terrain height-field from the client's Revit IFC.
 *
 *   node scripts/extractTerrainFromIfc.mjs ["<file.ifc>"] [--res 128]
 *
 * Default input: `Tài liệu hồ Huổi Vanh/dia hinh ho.ifc`.
 * Output:        `src/data/huoiVanhTerrainMesh.json`.
 *
 * WHY THIS SCRIPT EXISTS. The height-field the 3D view used before was not a
 * faithful extraction: compared with the IFC it was off by 7.6 m on average,
 * it had been flattened to 396.0 m under the rafts, and it was stored
 * north-first while the renderer read it south-first, so the whole terrain
 * was mirrored north-south. It came in with no script, so nobody could tell.
 * This script makes the terrain reproducible and pins the row order.
 *
 * WHAT IT READS FROM THE IFC (units: millimetres, converted to metres)
 *  - The Revit Toposolid (`IFCBUILDINGELEMENTPROXY 'Toposolid:…'`), a closed
 *    faceted shell placed at Z = 0, so its vertex z are absolute elevations.
 *    Its TOP surface is rasterised: for each grid node, the highest face that
 *    covers the node wins (the shell also has side walls and a base).
 *  - The water-surface slab (`IFCSLAB 'Floor:mat nuoc'`): the top of this
 *    slab is the reservoir level AS MODELLED IN THE IFC. It is written out as
 *    `ifcWaterSurface_m` and is what ties the IFC's vertical datum to the
 *    project's hydrology (MNDB 384.5 m) — see `sceneModel.ts`.
 *
 * X/Y are the IFC's local site frame (metres from the survey point), which is
 * the SAME frame as the raft outlines and the mooring layout: all 12 raft
 * centroids land in the flooded valley, 6.0 m deep at the median.
 *
 * Grid nodes the Toposolid does not cover are written as `null`; the renderer
 * leaves those cells out instead of inventing ground there.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const resIdx = args.indexOf('--res');
const RES = resIdx >= 0 ? Number(args[resIdx + 1]) : 128;
const input = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--res')
  ?? path.join(ROOT, 'Tài liệu hồ Huổi Vanh', 'dia hinh ho.ifc');
const OUT = path.join(ROOT, 'src', 'data', 'huoiVanhTerrainMesh.json');

// ---------------------------------------------------------------- STEP parse
const text = fs.readFileSync(input, 'latin1');
const ent = new Map();
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^#(\d+)\s*=\s*([A-Z0-9]+)\((.*)\);\s*$/);
  if (m) ent.set(Number(m[1]), { type: m[2], args: m[3] });
}
const refs = (s) => (s.match(/#\d+/g) || []).map((r) => Number(r.slice(1)));
const point = (id) => ent.get(id).args.match(/\(([^)]*)\)/)[1].split(',').map(Number);
const MM = 1000;

/** World translation of an IFCLOCALPLACEMENT chain, metres (no rotations in this file). */
function placement(id) {
  let x = 0, y = 0, z = 0, cur = id;
  while (cur) {
    const e = ent.get(cur);
    if (!e || e.type !== 'IFCLOCALPLACEMENT') break;
    const a = e.args.split(',');
    const parent = a[0].trim() === '$' ? null : Number(a[0].trim().slice(1));
    const axisId = Number(a[1].trim().slice(1));
    const [loc] = refs(ent.get(axisId).args);
    const p = point(loc);
    x += p[0]; y += p[1]; z += p[2];
    cur = parent;
  }
  return { x: x / MM, y: y / MM, z: z / MM };
}

/** Triangles of a faceted shell, in local metres. */
function shellTriangles(shellId) {
  const tris = [];
  for (const face of refs(ent.get(shellId).args)) {
    for (const bound of refs(ent.get(face).args)) {
      for (const loopId of refs(ent.get(bound).args)) {
        const loop = ent.get(loopId);
        if (!loop || loop.type !== 'IFCPOLYLOOP') continue;
        const v = refs(loop.args).map(point).map((p) => [p[0] / MM, p[1] / MM, p[2] / MM]);
        for (let k = 1; k + 1 < v.length; k++) tris.push([v[0], v[k], v[k + 1]]);
      }
    }
  }
  return tris;
}

// Reverse index: who references entity #id. Built once; walking up from a
// geometry item to its owning product is then a few hash lookups instead of
// three scans of ~89k entities per item.
const referrers = new Map();
for (const [id, e] of ent) {
  for (const r of refs(e.args)) {
    if (!referrers.has(r)) referrers.set(r, []);
    referrers.get(r).push(id);
  }
}
const referrerOfType = (id, pred) => (referrers.get(id) || []).find((r) => pred(ent.get(r).type));

/** The product that owns a representation item, and its placement. */
function ownerOf(itemId) {
  const rep = referrerOfType(itemId, (t) => t === 'IFCSHAPEREPRESENTATION');
  const pds = rep && referrerOfType(rep, (t) => t === 'IFCPRODUCTDEFINITIONSHAPE');
  const owner = pds && referrerOfType(pds, (t) => t !== 'IFCPRODUCTDEFINITIONSHAPE');
  if (!owner) return { id: null, type: null, name: null, place: { x: 0, y: 0, z: 0 } };
  const e = ent.get(owner);
  const placeId = refs(e.args).find((r) => ent.get(r)?.type === 'IFCLOCALPLACEMENT');
  return { id: owner, type: e.type, name: e.args.split(',')[2], place: placement(placeId) };
}

// ---------------------------------------------------------------- toposolid
const topoProxy = [...ent].find(([, e]) => e.type === 'IFCBUILDINGELEMENTPROXY' && /Toposolid/i.test(e.args));
if (!topoProxy) throw new Error('No Toposolid found in the IFC');
// Find the brep whose owner is the Toposolid proxy.
let topoShell = null, topoPlace = null;
for (const [id, e] of ent) {
  if (e.type !== 'IFCFACETEDBREP') continue;
  const own = ownerOf(id);
  if (own.id === topoProxy[0]) { topoShell = refs(e.args)[0]; topoPlace = own.place; break; }
}
if (!topoShell) throw new Error('Toposolid has no faceted BREP');
const terrainTris = shellTriangles(topoShell).map((t) => t.map(([x, y, z]) => [x, y, z + topoPlace.z]));

// ---------------------------------------------------------------- water slab
const waterSlab = [...ent].find(([, e]) => e.type === 'IFCSLAB' && /mat nuoc/i.test(e.args));
if (!waterSlab) throw new Error('No water-surface slab ("mat nuoc") found in the IFC');
let waterTop = -Infinity;
let waterPlace = null;
for (const [id, e] of ent) {
  if (e.type !== 'IFCFACETEDBREP') continue;
  const own = ownerOf(id);
  if (own.id !== waterSlab[0]) continue;
  waterPlace = own.place;
  for (const [a, b, c] of shellTriangles(refs(e.args)[0])) {
    waterTop = Math.max(waterTop, a[2] + own.place.z, b[2] + own.place.z, c[2] + own.place.z);
  }
}
if (!Number.isFinite(waterTop)) throw new Error('Water slab has no geometry');
// Both objects must share the site origin in plan, otherwise X/Y would not
// line up with each other (nor with the raft outlines).
if (Math.abs(waterPlace.x - topoPlace.x) > 0.01 || Math.abs(waterPlace.y - topoPlace.y) > 0.01) {
  throw new Error('Toposolid and water slab are not in the same site frame');
}

// ---------------------------------------------------------------- rasterise
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const t of terrainTris) for (const [x, y] of t) {
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
// Round the bounds outward to whole metres so the grid is easy to reason about.
minX = Math.floor(minX); maxX = Math.ceil(maxX); minY = Math.floor(minY); maxY = Math.ceil(maxY);
const nx = RES, ny = Math.max(2, Math.round(RES * (maxY - minY) / (maxX - minX)));
const dx = (maxX - minX) / (nx - 1), dy = (maxY - minY) / (ny - 1);

const H = Array.from({ length: ny }, () => new Array(nx).fill(-Infinity)); // H[row][col], row 0 = SOUTH
for (const [a, b, c] of terrainTris) {
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-12) continue; // vertical wall, not part of the top surface
  const c0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - minX) / dx));
  const c1 = Math.min(nx - 1, Math.floor((Math.max(a[0], b[0], c[0]) - minX) / dx));
  const r0 = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) - minY) / dy));
  const r1 = Math.min(ny - 1, Math.floor((Math.max(a[1], b[1], c[1]) - minY) / dy));
  for (let r = r0; r <= r1; r++) {
    const Y = minY + r * dy;
    for (let col = c0; col <= c1; col++) {
      const X = minX + col * dx;
      const w1 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / den;
      const w2 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / den;
      const w3 = 1 - w1 - w2;
      if (w1 < -1e-9 || w2 < -1e-9 || w3 < -1e-9) continue;
      const z = w1 * a[2] + w2 * b[2] + w3 * c[2];
      if (z > H[r][col]) H[r][col] = z; // top surface wins over the base and the walls
    }
  }
}

const elevations = H.map((row) => row.map((z) => (Number.isFinite(z) ? Math.round(z * 100) / 100 : null)));
const covered = elevations.flat().filter((z) => z !== null);

const out = {
  source: path.basename(input),
  generatedBy: 'scripts/extractTerrainFromIfc.mjs',
  units: 'm',
  frame: 'IFC local site frame (same X/Y as the raft outlines and mooring layout)',
  rowOrder: 'south-to-north',
  ifcWaterSurface_m: Math.round(waterTop * 1000) / 1000,
  bounds: { minX, maxX, minY, maxY },
  nx,
  ny,
  elevations
};
fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`, 'utf8');

const sorted = [...covered].sort((p, q) => p - q);
console.log(`Toposolid: ${terrainTris.length} triangles | water slab top (IFC): ${out.ifcWaterSurface_m} m`);
console.log(`Grid ${nx} x ${ny} (cell ${dx.toFixed(2)} x ${dy.toFixed(2)} m) over X ${minX}..${maxX}, Y ${minY}..${maxY}`);
console.log(`Covered nodes ${covered.length}/${nx * ny} | elevation min ${sorted[0]} p50 ${sorted[Math.floor(sorted.length / 2)]} max ${sorted[sorted.length - 1]} m`);
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
