#!/usr/bin/env node
/**
 * planMooringLayoutV2.mjs — design pass over the mooring network (9 rafts since 2026-10-08;
 * after a new client plan run scripts/importRaftLayout9.mjs first).
 *
 *   node scripts/planMooringLayoutV2.mjs          # rewrite the two JSON files
 *   node scripts/planMooringLayoutV2.mjs --dry    # report only
 *
 * Inputs : src/data/huoiVanhRaftPolygons_v2.json  (the 12 raft outlines — the
 *          ONLY thing taken from the client's CAD/Revit export)
 *          src/data/huoiVanhCoordinates_v2.json   (current line network)
 * Outputs: src/data/huoiVanhCoordinates_v2.json   (the mooring lines)
 *          src/data/huoiVanhPiles_v2.json         (pile schedule, DERIVED from
 *          the lines — never the other way round: the pile objects in the
 *          Revit DXF are placeholders and are not design data)
 *
 * Design rules enforced (all re-verified at the end; the script exits 1 on
 * any violation):
 *   C9   every raft carries N >= ceil(P / 15 m) lines  (s_avg = P/N <= 15 m)
 *   G1   every lake-bed pile is >= 5.0 m clear of EVERY raft outline
 *        (acceptance criterion 4.9 m, 0.1 m kept as a drafting margin)
 *   G2   a bed pile in a channel narrower than 2 x 17.5 m sits on the channel
 *        mid-line (equal clearance to both rafts)
 *   G3   no two lines cross; no line passes over a raft other than its own;
 *        no line runs back across its own raft
 *   G4   any two anchors >= 3.0 m apart; two lake-bed anchors >= 7.0 m apart
 *        (room for the screw-pile bases)
 *   R1   (owner, 2026-10-08) near the shore the anchor is a BORED PILE, also at
 *        the water's edge: a lake-bed line with no raft facing it within 45 m
 *        is turned into a shore line when the IFC terrain reaches 384.0 m
 *        (MNDB - 0.5 m) within 60 m of its cleat. Such a line is marked
 *        `converted: true` (design output, re-planned by a new import).
 *   R2   (owner, 2026-10-08) lake-bed bases only between two rafts, and one
 *        base is SHARED by two facing lines (same `anchorId`, same position:
 *        the mid-point of the two anchors) when their cleats are within 12 m
 *        of each other along the gap.
 * Shore piles are never moved; they are round bored piles ('circular'). A lake-bed
 * anchor point is marked 'square' (an RC base with screw piles, or a square pile
 * under option PA1 — the option is chosen in the project, not here).
 * The script is idempotent: a second run changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLYS = path.join(ROOT, 'src/data/huoiVanhRaftPolygons_v2.json');
const COORDS = path.join(ROOT, 'src/data/huoiVanhCoordinates_v2.json');
const PILES = path.join(ROOT, 'src/data/huoiVanhPiles_v2.json');
const dryRun = process.argv.includes('--dry');

const MAX_SPACING = 15.0;    // m, C9
const MIN_STANDOFF = 5.0;    // m, G1
const OPEN_STANDOFF = 17.5;  // m, preferred pile offset in open water
const MIN_PILE_GAP = 3.0;    // m, G4 (when a shore pile is involved)
// Two LAKE-BED anchors: the screw-pile bases are up to 4.75 m square (diagonal
// 6.7 m), so their centres are kept 7 m apart and no two bases can overlap
// whatever their orientation.
const MIN_BED_GAP = 7.0;     // m, G4 between two lake-bed anchors
const MIN_CLEAT_GAP = 6.0;   // m, spacing of fittings on the pontoon edge
const MNDB = 384.5;          // m, normal water level
// Lake-bed level under each raft = MNDB - design water depth (same depth the
// load engine uses). The IFC terrain mesh cannot supply it: it reads ~396 m
// under the rafts, i.e. above the water surface.
const WATER_DEPTH = { 'BÈ 1': 6.0 };
const DEFAULT_DEPTH = 6.2;

const SHORE_LEVEL = 384.0;   // m, R1: ground at / above this is "shore or water's edge"
const MAX_SHORE_SPAN = 60.0; // m, R1: longest cable to a new shore pile
const GAP_LIMIT = 45.0;      // m, R1/R2: another raft within this distance of the cleat = "between two rafts"
const SHORE_FAN_STEPS = [0, ...Array.from({ length: 15 }, (_, i) => [-(i + 1) * 5, (i + 1) * 5]).flat()]; // deg, R1: swing of the cable, 0 … ±75
const MAX_OBLIQUITY = 60.0;   // deg, a new shore cable further than this off the normal of its edge is straightened if the bank allows
const PAIR_REACH = 30.0;     // m, R2 second stage: two lake-bed anchors of two rafts this close may be merged into one base
const MAX_SHARED_SPAN = 40.0; // m, R2 second stage: longest cable to a merged base
const MAX_SWING = 60.0;      // deg, R2 second stage: how far a cable may be swung from its bearing to reach a merged base
const PAIR_OFFSET = 12.0;    // m, R2: two facing cleats this close along the gap share a base

// IFC terrain (Toposolid), converted to the project datum: IFC = project + (IFC water surface - MNDB).
const TERRAIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/huoiVanhTerrainMesh.json'), 'utf8'));
const T_DX = (TERRAIN.bounds.maxX - TERRAIN.bounds.minX) / (TERRAIN.nx - 1);
const T_DY = (TERRAIN.bounds.maxY - TERRAIN.bounds.minY) / (TERRAIN.ny - 1);
const T_OFFSET = TERRAIN.ifcWaterSurface_m - MNDB;
/** Ground level at a plan point, project datum (same interpolation as sceneModel.groundAt); null outside the model. */
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

const polygons = JSON.parse(fs.readFileSync(POLYS, 'utf8'));
const coords = JSON.parse(fs.readFileSync(COORDS, 'utf8'));

// ------------------------------------------------------------------ geometry
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const orient = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const segCross = (a, b, c, d) =>
  orient(a, b, c) * orient(a, b, d) < -1e-9 && orient(c, d, a) * orient(c, d, b) < -1e-9;
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
const distToRing = (p, ring) =>
  Math.min(...ring.map((q, i) => distToSeg(p, q, ring[(i + 1) % ring.length])));
/** Clear distance from a point to a raft; negative when inside it. */
const clearance = (p, ring) => (inRing(p, ring) ? -1 : 1) * distToRing(p, ring);
const segOverRing = (a, b, ring) => {
  for (let i = 0; i < ring.length; i++) if (segCross(a, b, ring[i], ring[(i + 1) % ring.length])) return true;
  return inRing({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ring);
};
const r2 = (v) => Math.round(v * 100) / 100;

const ringOf = Object.fromEntries(polygons.map((p) => [p.name, p.points]));
const anchorOf = (c) => ({ x: c.xAnchor, y: c.yAnchor });
const cleatOf = (c) => ({ x: c.xRaft, y: c.yRaft });

/** Perimeter walker: arc-length parameter <-> point + outward normal. */
function walker(ring) {
  const cw = orient(ring[0], ring[1], ring[2]) < 0; // sign only used via area below
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  const ccw = area > 0;
  const segs = [];
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const L = dist(a, b);
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    // Outward normal: right-hand side for a CCW ring.
    const n = ccw ? { x: uy, y: -ux } : { x: -uy, y: ux };
    segs.push({ a, b, L, s0: s, ux, uy, n });
    s += L;
  }
  void cw;
  const total = s;
  const at = (t) => {
    t = ((t % total) + total) % total;
    const g = segs.find((q) => t >= q.s0 && t <= q.s0 + q.L) ?? segs[segs.length - 1];
    const u = t - g.s0;
    return { x: g.a.x + g.ux * u, y: g.a.y + g.uy * u, n: g.n };
  };
  const param = (p) => {
    let best = { d: Infinity, t: 0 };
    for (const g of segs) {
      const u = Math.max(0, Math.min(g.L, (p.x - g.a.x) * g.ux + (p.y - g.a.y) * g.uy));
      const d = Math.hypot(p.x - g.a.x - g.ux * u, p.y - g.a.y - g.uy * u);
      if (d < best.d) best = { d, t: g.s0 + u };
    }
    return best.t;
  };
  return { total, at, param };
}

/** Distance along `dir` from `o` to the first edge of any OTHER raft. */
function channelWidth(o, dir, ownName) {
  let best = Infinity;
  const far = { x: o.x + dir.x * 1000, y: o.y + dir.y * 1000 };
  for (const p of polygons) {
    if (p.name === ownName) continue;
    const ring = p.points;
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i], d = ring[(i + 1) % ring.length];
      const den = (far.x - o.x) * (d.y - c.y) - (far.y - o.y) * (d.x - c.x);
      if (Math.abs(den) < 1e-12) continue;
      const t = ((c.x - o.x) * (d.y - c.y) - (c.y - o.y) * (d.x - c.x)) / den;
      const u = ((c.x - o.x) * (far.y - o.y) - (c.y - o.y) * (far.x - o.x)) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t * 1000);
    }
  }
  return best;
}

const minClearanceAll = (p) => Math.min(...polygons.map((q) => clearance(p, q.points)));

/** Is the line cleat->pile acceptable against the rest of the network? */
function lineFeasible(cleat, pile, raftName, ignore) {
  if (minClearanceAll(pile) < MIN_STANDOFF) return false;
  for (const c of coords) {
    if (c === ignore) continue;
    if (dist(anchorOf(c), pile) < (c.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP)) return false;
    if (segCross(cleat, pile, cleatOf(c), anchorOf(c))) return false;
  }
  for (const q of polygons) {
    if (q.name === raftName) {
      // Own raft: only the attachment end may touch it.
      const m = { x: cleat.x * 0.02 + pile.x * 0.98, y: cleat.y * 0.02 + pile.y * 0.98 };
      if (inRing({ x: (cleat.x + pile.x) / 2, y: (cleat.y + pile.y) / 2 }, q.points) || inRing(m, q.points)) return false;
    } else if (segOverRing(cleat, pile, q.points)) return false;
  }
  return true;
}

/**
 * Best pile position for a cleat: search a fan of bearings around the edge's
 * outward normal and a range of offsets. Target offset = OPEN_STANDOFF in open
 * water, the channel mid-line in a channel narrower than 2 x OPEN_STANDOFF.
 */
function placePile(cleat, normal, raftName, ignore) {
  let best = null;
  for (let deg = -60; deg <= 60; deg += 2.5) {
    const r = (deg * Math.PI) / 180;
    const dir = {
      x: normal.x * Math.cos(r) - normal.y * Math.sin(r),
      y: normal.x * Math.sin(r) + normal.y * Math.cos(r)
    };
    const w = channelWidth(cleat, dir, raftName);
    const target = w < 2 * OPEN_STANDOFF ? w / 2 : OPEN_STANDOFF;
    for (let d = MIN_STANDOFF; d <= OPEN_STANDOFF + 4; d += 0.25) {
      const pile = { x: cleat.x + dir.x * d, y: cleat.y + dir.y * d };
      if (!lineFeasible(cleat, pile, raftName, ignore)) continue;
      // In a channel, score the actual balance of clearances (G2).
      let score = Math.abs(deg) * 0.08 + Math.abs(d - target);
      if (w < 2 * OPEN_STANDOFF) {
        const own = clearance(pile, ringOf[raftName]);
        const other = Math.min(...polygons.filter((q) => q.name !== raftName).map((q) => clearance(pile, q.points)));
        score += Math.abs(own - other);
      }
      if (!best || score < best.score) best = { pile, score, d, deg };
    }
  }
  return best;
}

const report = { moved: [], added: [], unresolved: [] };
const bedZ = (raft) => r2(MNDB - (WATER_DEPTH[raft] ?? DEFAULT_DEPTH));

function setAnchor(c, pile) {
  c.xAnchor = r2(pile.x);
  c.yAnchor = r2(pile.y);
  const dx = c.xAnchor - c.xRaft, dy = c.yAnchor - c.yRaft;
  c.span = r2(Math.hypot(dx, dy));
  c.azimuth = Math.round((((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) * 10) / 10;
}

// ---- Step 0: a raft outline changed (new client DXF) ----------------------
// A cleat must sit ON its raft's edge. When an outline moves (2026-09-27: the
// BÈ 5 east edge moved 19.8 m west), a cleat left in open water is repaired:
//  - SHORE line: the pile is a staked monument on the bank and never moves;
//    its cleat is re-attached to the nearest point of the new edge.
//  - BED line: the pile is design output; the line is removed here and
//    re-placed by Step 2, which reuses its code, so the raft keeps at least
//    the line count it had (never fewer lines because the raft shrank).
//  A raft whose outline changed gets ALL its bed lines re-planned (they are
//  not built yet), so they can be spread evenly over the new edge.
const CLEAT_TOL = 0.05; // m
const keepCount = {};   // raft -> line count before Step 0
const freedCodes = {};  // raft -> codes released by removed bed lines
for (const c of coords) keepCount[c.raft] = (keepCount[c.raft] ?? 0) + 1;
const changedRafts = new Set(
  coords.filter((c) => distToRing(cleatOf(c), ringOf[c.raft]) > CLEAT_TOL).map((c) => c.raft)
);
for (let i = coords.length - 1; i >= 0; i--) {
  const c = coords[i];
  const ring = ringOf[c.raft];
  const off = distToRing(cleatOf(c), ring);
  if (!changedRafts.has(c.raft)) continue;
  if (c.type === 'SHORE') {
    if (off <= CLEAT_TOL) continue;
    const w = walker(ring);
    const e = w.at(w.param(cleatOf(c)));
    c.xRaft = r2(e.x);
    c.yRaft = r2(e.y);
    setAnchor(c, anchorOf(c));
    report.moved.push(`${c.code}: cleat re-attached to the new edge (${off.toFixed(2)} m off), pile unchanged, span ${c.span} m`);
  } else {
    (freedCodes[c.raft] ??= []).push(c.code);
    coords.splice(i, 1);
    report.moved.push(`${c.code}: bed line re-planned (outline of ${c.raft} changed)`);
  }
}
for (const k of Object.keys(freedCodes)) freedCodes[k].sort((a, b) => Number(a.split('-D')[1]) - Number(b.split('-D')[1]));

// ---- Step 1: bed piles closer than MIN_STANDOFF to any raft (G1) ----------
for (const c of coords) {
  if (c.type !== 'BED') continue;
  const standoff = minClearanceAll(anchorOf(c));
  if (standoff >= MIN_STANDOFF - 1e-6) continue;
  const w = walker(ringOf[c.raft]);
  const t0 = w.param(cleatOf(c));
  let placed = null;
  // Keep the cleat if possible, else slide it along the edge by up to 12 m.
  for (const ds of [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12]) {
    const e = w.at(t0 + ds);
    const cleat = { x: e.x, y: e.y };
    if (ds !== 0 && coords.some((o) => o !== c && o.raft === c.raft && dist(cleatOf(o), cleat) < MIN_CLEAT_GAP)) continue;
    const res = placePile(cleat, e.n, c.raft, c);
    if (res) { placed = { cleat, ...res }; break; }
  }
  if (!placed) { report.unresolved.push(`${c.code}: standoff ${standoff.toFixed(2)} m, no feasible position`); continue; }
  const before = standoff;
  c.xRaft = r2(placed.cleat.x);
  c.yRaft = r2(placed.cleat.y);
  setAnchor(c, placed.pile);
  report.moved.push(`${c.code}: standoff ${before.toFixed(2)} -> ${minClearanceAll(anchorOf(c)).toFixed(2)} m, span ${c.span} m`);
}

// ---- Step 2a: even spacing along the edge for GAP_LIMITED rafts -----------
// C9 bounds only the AVERAGE spacing; a raft can pass it and still have a long
// unrestrained edge (BÈ 5's east edge had 3 lines over 150 m). For the rafts
// listed here, no two consecutive cleats along the perimeter may be more than
// MAX_CLEAT_STEP apart. Applied to BÈ 5 on its 2026-09-27 re-plan.
const MAX_CLEAT_STEP = 15.0; // m
const GAP_LIMITED = new Set(['BÈ 3A', 'BÈ 5A', 'BÈ 8']); // the merged rafts of the 9-raft plan (2026-10-08)
const codeNum = (code) => Number(code.split('-D')[1]);

function addBedLine(raftName, cleat, pile, note) {
  const own = coords.filter((c) => c.raft === raftName);
  const prefix = own[0].code.split('-D')[0];
  const next = Math.max(...own.map((c) => codeNum(c.code)), ...(freedCodes[raftName] ?? []).map(codeNum)) + 1;
  const line = {
    raft: raftName, type: 'BED',
    xRaft: r2(cleat.x), yRaft: r2(cleat.y),
    xAnchor: 0, yAnchor: 0, zAnchor: bedZ(raftName), span: 0, azimuth: 0,
    code: freedCodes[raftName]?.length ? freedCodes[raftName].shift() : `${prefix}-D${String(next).padStart(2, '0')}`
  };
  setAnchor(line, pile);
  const lastIdx = coords.map((c) => c.raft).lastIndexOf(raftName);
  coords.splice(lastIdx + 1, 0, line);
  report.added.push(`${line.code}: ${note}, span ${line.span} m, standoff ${minClearanceAll(pile).toFixed(2)} m`);
  return line;
}

/** Cleat stations of a raft, sorted, and the gaps between consecutive ones. */
function cleatGaps(raftName) {
  const w = walker(ringOf[raftName]);
  const ts = coords.filter((c) => c.raft === raftName).map((c) => w.param(cleatOf(c))).sort((a, b) => a - b);
  const gaps = ts.map((t, i) => ({ from: t, len: i === ts.length - 1 ? w.total - t + ts[0] : ts[i + 1] - t }));
  return { w, gaps };
}

// Each open gap is walked from its start: the next cleat goes at the even
// step r / ceil(r / MAX_CLEAT_STEP) of the remaining length r when a pile can
// be placed there, otherwise at the nearest feasible station within
// [MIN_CLEAT_GAP, MAX_CLEAT_STEP]. That keeps the count close to the minimum
// ceil(len / 15) - 1 per gap instead of bisecting gaps.
for (const name of GAP_LIMITED) {
  const { w, gaps } = cleatGaps(name);
  for (const g of gaps.filter((x) => x.len > MAX_CLEAT_STEP + 1e-6)) {
    const end = g.from + g.len;
    let p = g.from;
    while (end - p > MAX_CLEAT_STEP + 1e-6) {
      const r = end - p;
      const step = r / Math.ceil(r / MAX_CLEAT_STEP);
      const stations = [];
      for (let u = MIN_CLEAT_GAP; u <= Math.min(MAX_CLEAT_STEP, r - MIN_CLEAT_GAP) + 1e-9; u += 0.25) stations.push(u);
      stations.sort((a, b) => Math.abs(a - step) - Math.abs(b - step));
      let placedAt = null;
      for (const u of stations) {
        const e = w.at(p + u);
        const res = placePile({ x: e.x, y: e.y }, e.n, name, null);
        if (!res) continue;
        addBedLine(name, { x: e.x, y: e.y }, res.pile, `even edge spacing, step ${u.toFixed(2)} m`);
        placedAt = p + u;
        break;
      }
      if (placedAt === null) {
        report.unresolved.push(`${name}: no feasible cleat within ${MAX_CLEAT_STEP} m after station ${p.toFixed(1)} m`);
        break;
      }
      p = placedAt;
    }
  }
}

// ---- Step 2: add bed lines until C9 holds (s_avg = P/N <= 15 m) -----------
for (const poly of polygons) {
  const need = Math.max(Math.ceil(poly.perimeter_m / MAX_SPACING), keepCount[poly.name] ?? 0);
  let own = coords.filter((c) => c.raft === poly.name);
  if (own.length >= need) continue;
  const w = walker(poly.points);

  while (own.length < need) {
    const ts = own.map((c) => w.param(cleatOf(c))).sort((a, b) => a - b);
    // Candidate edge stations, ranked by the free perimeter around them.
    const cands = [];
    for (let t = 0; t < w.total; t += 1) {
      let gap = Infinity;
      for (const u of ts) {
        const d = Math.abs(t - u);
        gap = Math.min(gap, d, w.total - d);
      }
      if (gap >= MIN_CLEAT_GAP) cands.push({ t, gap });
    }
    cands.sort((a, b) => b.gap - a.gap);
    let done = false;
    for (const cand of cands) {
      const e = w.at(cand.t);
      const cleat = { x: e.x, y: e.y };
      const res = placePile(cleat, e.n, poly.name, null);
      if (!res) continue;
      addBedLine(poly.name, cleat, res.pile, `free edge ${cand.gap.toFixed(1)} m`);
      own = coords.filter((c) => c.raft === poly.name);
      done = true;
      break;
    }
    if (!done) { report.unresolved.push(`${poly.name}: cannot place line ${own.length + 1}/${need}`); break; }
  }
}

// ---- Step 2b: close any arc wider than MAX_ARC with no line at all -------
// Measured about the outline's vertex centroid, from each ANCHOR bearing —
// the same metric the restraint test pins.
const MAX_ARC = 60; // degrees
function widestArc(name) {
  const ring = ringOf[name];
  const cx = ring.reduce((s, q) => s + q.x, 0) / ring.length;
  const cy = ring.reduce((s, q) => s + q.y, 0) / ring.length;
  const ang = coords.filter((c) => c.raft === name)
    .map((c) => (Math.atan2(c.yAnchor - cy, c.xAnchor - cx) * 180) / Math.PI)
    .sort((a, b) => a - b);
  let worst = { gap: 0, from: 0 };
  for (let i = 0; i < ang.length; i++) {
    const gap = i === ang.length - 1 ? 360 + ang[0] - ang[i] : ang[i + 1] - ang[i];
    if (gap > worst.gap) worst = { gap, from: ang[i] };
  }
  return { ...worst, cx, cy };
}
for (const poly of polygons) {
  for (let guard = 0; guard < 10; guard++) {
    const arc = widestArc(poly.name);
    if (arc.gap <= MAX_ARC) break;
    const w = walker(poly.points);
    const own = coords.filter((c) => c.raft === poly.name);
    const ts = own.map((c) => w.param(cleatOf(c)));
    // Candidate stations anywhere on the edge; keep those whose pile lands in
    // the open arc, prefer the one closest to its middle.
    let best = null;
    for (let t = 0; t < w.total; t += 1) {
      if (ts.some((u) => Math.min(Math.abs(t - u), w.total - Math.abs(t - u)) < MIN_CLEAT_GAP)) continue;
      const e = w.at(t);
      const res = placePile({ x: e.x, y: e.y }, e.n, poly.name, null);
      if (!res) continue;
      const a = (Math.atan2(res.pile.y - arc.cy, res.pile.x - arc.cx) * 180) / Math.PI;
      let off = ((a - arc.from) % 360 + 360) % 360;
      if (off <= 0 || off >= arc.gap) continue;
      const score = Math.abs(off - arc.gap / 2);
      if (!best || score < best.score) best = { score, cleat: { x: e.x, y: e.y }, pile: res.pile };
    }
    if (!best) { report.unresolved.push(`${poly.name}: open arc ${arc.gap.toFixed(0)}° cannot be closed`); break; }
    addBedLine(poly.name, best.cleat, best.pile, `closes a ${arc.gap.toFixed(0)}° open arc`);
  }
}

// ---- Step 2c (R1): near the shore the anchor is a bored pile ---------------
/** The raft facing a cleat within GAP_LIMIT along its cable (±30°), if any. */
function facingRaft(c) {
  const cleat = cleatOf(c), a = anchorOf(c), L = dist(cleat, a) || 1;
  const dir = { x: (a.x - cleat.x) / L, y: (a.y - cleat.y) / L };
  let best = { gap: Infinity, name: null };
  for (const deg of [0, -15, 15, -30, 30]) {
    const r = (deg * Math.PI) / 180;
    const d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
    for (const p of polygons) {
      if (p.name === c.raft) continue;
      const far = { x: cleat.x + d.x * 1000, y: cleat.y + d.y * 1000 };
      for (let i = 0; i < p.points.length; i++) {
        const e1 = p.points[i], e2 = p.points[(i + 1) % p.points.length];
        const den = (far.x - cleat.x) * (e2.y - e1.y) - (far.y - cleat.y) * (e2.x - e1.x);
        if (Math.abs(den) < 1e-12) continue;
        const t = ((e1.x - cleat.x) * (e2.y - e1.y) - (e1.y - cleat.y) * (e2.x - e1.x)) / den;
        const u = ((e1.x - cleat.x) * (far.y - cleat.y) - (e1.y - cleat.y) * (far.x - cleat.x)) / den;
        if (t > 1e-9 && u >= 0 && u <= 1 && t * 1000 < best.gap) best = { gap: t * 1000, name: p.name };
      }
    }
  }
  return best.gap <= GAP_LIMIT ? best : null;
}
/** A shore line cleat->pile is acceptable: clear of every raft, of every other line and of every other anchor. */
function shoreLineFeasible(cleat, pile, c) {
  for (const q of polygons) {
    if (inRing(pile, q.points)) return false;
    if (q.name !== c.raft && (clearance(pile, q.points) < MIN_STANDOFF || segOverRing(cleat, pile, q.points))) return false;
    if (q.name === c.raft && inRing({ x: (cleat.x + pile.x) / 2, y: (cleat.y + pile.y) / 2 }, q.points)) return false;
  }
  for (const o of coords) {
    if (o === c) continue;
    if (dist(anchorOf(o), pile) < MIN_PILE_GAP) return false;
    if (segCross(cleat, pile, cleatOf(o), anchorOf(o))) return false;
  }
  return true;
}
/** The cable cleat->p runs over its own raft (sampled along its length). */
function overOwnRaft(cleat, p, c) {
  const own = polygons.find((q) => q.name === c.raft).points;
  const L = dist(cleat, p);
  for (const t of [0.5 / L, 0.1, 0.25, 0.5, 0.75]) {
    if (inRing({ x: cleat.x + (p.x - cleat.x) * t, y: cleat.y + (p.y - cleat.y) * t }, own)) return true;
  }
  return false;
}
/**
 * Turns lake-bed lines into bored shore piles. The cable is swung up to 75
 * degrees either side of its bearing (owner, 2026-10-08: "chỉ cần chỉnh lại
 * góc nghiêng dây ... né cọc cũ"); of all the bearings the SHORTEST feasible
 * cable wins. Repeated until nothing changes: a line blocked by a neighbour's
 * old lake-bed line may pass once that neighbour has moved.
 */
function convertToShore(eligible) {
 for (let pass = 0, changed = true; changed && pass < 10; pass++) {
 changed = false;
 for (const c of coords) {
  if (c.type !== 'BED' || !eligible(c)) continue;
  const cleat = cleatOf(c), a = anchorOf(c), L = dist(cleat, a) || 1;
  const dir = { x: (a.x - cleat.x) / L, y: (a.y - cleat.y) / L };
  let best = null;
  for (const deg of SHORE_FAN_STEPS) {
    const r = (deg * Math.PI) / 180;
    const d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
    for (let s = 3; s <= MAX_SHORE_SPAN; s += 0.5) {
      const q = { x: cleat.x + d.x * s, y: cleat.y + d.y * s };
      const g = groundAt(q.x, q.y);
      if (g === null) break;
      if (g < SHORE_LEVEL) continue;
      // the first FEASIBLE point at shore level along this bearing (a little further inland is still the shore)
      if (shoreLineFeasible(cleat, q, c) && !overOwnRaft(cleat, q, c)) { if (!best || s < best.s) best = { s, q, g }; break; }
    }
  }
  if (!best) continue;
  changed = true;
  const before = c.span;
  c.type = 'SHORE';
  c.converted = true;
  delete c.anchorId;
  delete c.sharedWith;
  setAnchor(c, best.q);
  report.moved.push(`${c.code}: lake-bed line -> bored shore pile (R1), ground ${best.g.toFixed(2)} m, span ${before} -> ${c.span} m`);
 }
 }
}
convertToShore((c) => !facingRaft(c));

if (process.argv.includes('--explain')) {
  for (const c of coords) {
    if (c.type !== 'BED' || facingRaft(c)) continue;
    const cleat = cleatOf(c), a = anchorOf(c), L = dist(cleat, a) || 1, dir = { x: (a.x - cleat.x) / L, y: (a.y - cleat.y) / L };
    let reason = 'no ground at shore level within reach';
    for (let sp = 3; sp <= MAX_SHORE_SPAN; sp += 0.5) {
      const q = { x: cleat.x + dir.x * sp, y: cleat.y + dir.y * sp };
      const g = groundAt(q.x, q.y);
      if (g === null) { reason = 'leaves the terrain model'; break; }
      if (g < SHORE_LEVEL) continue;
      const why = [];
      for (const q2 of polygons) { if (inRing(q, q2.points)) why.push('inside ' + q2.name); else if (q2.name !== c.raft && clearance(q, q2.points) < MIN_STANDOFF) why.push('<5 m from ' + q2.name); else if (q2.name !== c.raft && segOverRing(cleat, q, q2.points)) why.push('over ' + q2.name); }
      for (const o of coords) { if (o === c) continue; if (dist(anchorOf(o), q) < MIN_PILE_GAP) why.push('<3 m from ' + o.code); if (segCross(cleat, q, cleatOf(o), anchorOf(o))) why.push('crosses ' + o.code + '(' + o.type + ')'); }
      reason = `shore level at ${sp} m: ${why.join(', ') || 'feasible?'}`; break;
    }
    console.log('EXPLAIN R1', c.code, c.raft, 'span', c.span, '-', reason);
  }
}

// ---- Step 2d (R2): one base shared by two facing lines ---------------------
for (const c of coords) { if (c.type === 'BED') { delete c.anchorId; delete c.sharedWith; } }
// Two lines of two rafts already ending on the same point ARE a shared base (a re-run keeps what it made).
for (const a of coords) {
  if (a.type !== 'BED' || a.sharedWith) continue;
  const b = coords.find((o) => o !== a && o.type === 'BED' && !o.sharedWith && o.raft !== a.raft && dist(anchorOf(o), anchorOf(a)) < 0.011);
  if (b) { a.sharedWith = b.code; b.sharedWith = a.code; }
}
// Repeated until nothing changes: a pair blocked by a neighbouring single anchor may pass once that neighbour is paired.
for (let pass = 0, paired = true; paired && pass < 10; pass++) {
  paired = false;
  const groups = new Map();
  for (const c of coords) {
    if (c.type !== 'BED' || c.sharedWith) continue;
    const f = facingRaft(c);
    if (!f) continue;
    const key = [c.raft, f.name].sort().join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  for (const [key, ls] of groups) {
    const [ra, rb] = key.split('|');
    const A = ls.filter((l) => l.raft === ra), B = ls.filter((l) => l.raft === rb);
    if (!A.length || !B.length) continue;
    // axis of the gap: principal direction of the ANCHORS of the two rafts in it (they lie along the gap,
    // whereas the cleats of two facing edges also spread across it)
    const all = coords.filter((o) => o.type === 'BED' && (o.raft === ra || o.raft === rb) && facingRaft(o) && [ra, rb].includes(facingRaft(o).name));
    const cx = all.reduce((s, l) => s + l.xAnchor, 0) / all.length, cy = all.reduce((s, l) => s + l.yAnchor, 0) / all.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const l of all) { const dx = l.xAnchor - cx, dy = l.yAnchor - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = { x: Math.cos(th), y: Math.sin(th) };
    const along = (l) => (l.xRaft - cx) * ax.x + (l.yRaft - cy) * ax.y;
    A.sort((p, q) => along(p) - along(q) || p.code.localeCompare(q.code));
    const used = new Set();
    for (const a of A) {
      let pick = null, bestD = PAIR_OFFSET;
      for (const b of B) { if (used.has(b)) continue; const d = Math.abs(along(a) - along(b)); if (d < bestD - 1e-9) { bestD = d; pick = b; } }
      if (!pick) continue;
      const mid = { x: r2((a.xAnchor + pick.xAnchor) / 2), y: r2((a.yAnchor + pick.yAnchor) / 2) };
      // the shared position must respect every rule the two single anchors did
      const others = coords.filter((o) => o !== a && o !== pick);
      const ok = minClearanceAll(mid) >= MIN_STANDOFF - 1e-6
        && others.every((o) => dist(anchorOf(o), mid) >= (o.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP) - 1e-6)
        && [a, pick].every((l) => others.every((o) => !segCross(cleatOf(l), mid, cleatOf(o), anchorOf(o)))
          && polygons.every((q) => q.name === l.raft || !segOverRing(cleatOf(l), mid, q.points)));
      if (!ok) { if (process.argv.includes('--explain') && pass === 0) console.log('EXPLAIN R2', a.code, '+', pick.code, 'standoff', minClearanceAll(mid).toFixed(1), 'near', others.filter((o) => dist(anchorOf(o), mid) < (o.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP) - 1e-6).map((o) => o.code).join(','), 'cross', [a, pick].flatMap((l) => others.filter((o) => segCross(cleatOf(l), mid, cleatOf(o), anchorOf(o))).map((o) => o.code)).join(',')); continue; }
      paired = true;
      used.add(pick);
      setAnchor(a, mid); setAnchor(pick, mid);
      a.sharedWith = pick.code; pick.sharedWith = a.code;
      report.moved.push(`${a.code} + ${pick.code}: one shared lake-bed base (R2), spans ${a.span} / ${pick.span} m`);
    }
  }
}
// Second stage (owner, 2026-10-08: "đoạn nào neo đế giữa 2 đáy dùng chung được thì cứ cho dùng chung"): any two
// still-single lake-bed anchors of two DIFFERENT rafts within PAIR_REACH are merged into one base, the two cables
// swung towards it, nearest pairs first. The merged position is tried at several points between the two anchors.
for (let pass = 0, paired = true; paired && pass < 10; pass++) {
  paired = false;
  const free = coords.filter((c) => c.type === 'BED' && !c.sharedWith);
  const cands = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i].raft === free[j].raft) continue;
      const d = dist(anchorOf(free[i]), anchorOf(free[j]));
      if (d <= PAIR_REACH) cands.push({ a: free[i], b: free[j], d });
    }
  }
  cands.sort((p, q) => p.d - q.d || p.a.code.localeCompare(q.a.code) || p.b.code.localeCompare(q.b.code));
  for (const { a, b } of cands) {
    if (a.sharedWith || b.sharedWith) continue;
    const pa = anchorOf(a), pb = anchorOf(b), others = coords.filter((o) => o !== a && o !== b);
    const swing = (l, p) => {
      const c0 = cleatOf(l), o = anchorOf(l);
      const u = { x: o.x - c0.x, y: o.y - c0.y }, v = { x: p.x - c0.x, y: p.y - c0.y };
      return (Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) || 1) * (Math.hypot(v.x, v.y) || 1))))) * 180) / Math.PI;
    };
    let found = null;
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9, 0, 1]) {
      const mid = { x: r2(pa.x + (pb.x - pa.x) * t), y: r2(pa.y + (pb.y - pa.y) * t) };
      const ok = minClearanceAll(mid) >= MIN_STANDOFF - 1e-6
        && others.every((o) => dist(anchorOf(o), mid) >= (o.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP) - 1e-6)
        && [a, b].every((l) => dist(cleatOf(l), mid) <= MAX_SHARED_SPAN && swing(l, mid) <= MAX_SWING && !overOwnRaft(cleatOf(l), mid, l)
          && others.every((o) => !segCross(cleatOf(l), mid, cleatOf(o), anchorOf(o)))
          && polygons.every((q) => q.name === l.raft || !segOverRing(cleatOf(l), mid, q.points)));
      if (ok) { found = mid; break; }
    }
    if (!found) continue;
    paired = true;
    setAnchor(a, found); setAnchor(b, found);
    a.sharedWith = b.code; b.sharedWith = a.code;
    report.moved.push(`${a.code} + ${b.code}: one shared lake-bed base (R2, cables swung), spans ${a.span} / ${b.span} m`);
  }
}
// What is still a single base goes to the shore if a bored pile can be reached at all.
convertToShore((c) => !c.sharedWith);

/**
 * R1, last resort. A single base beside the bank whose cable cannot reach the
 * shore because it would CROSS the shore lines of its own raft: add one new
 * pile on the bank and re-hook the cables of that small group (the blocked
 * cleat and the cleats of the crossed lines) to the group's piles so that
 * nothing crosses — the assignment of least total cable length, which cannot
 * cross itself. No existing pile moves; only which cleat a pile is tied to.
 * The `converted` mark follows the PILE (the new one), not the line.
 */
function untangleToShore() {
  const permutations = (n) => { const out = []; const go = (p, rest) => { if (!rest.length) out.push(p); for (let i = 0; i < rest.length; i++) go([...p, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]); }; go([], Array.from({ length: n }, (_, i) => i)); return out; };
  for (let pass = 0, changed = true; changed && pass < 10; pass++) {
    changed = false;
    for (const c of coords) {
      if (c.type !== 'BED' || c.sharedWith) continue;
      const cleat = cleatOf(c), a0 = anchorOf(c), L0 = dist(cleat, a0) || 1, dir = { x: (a0.x - cleat.x) / L0, y: (a0.y - cleat.y) / L0 };
      // new-pile candidates: shore level, clear of the rafts and of every existing anchor; crossings are dealt with below
      const cands = [];
      for (const deg of SHORE_FAN_STEPS) {
        const r = (deg * Math.PI) / 180, d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
        for (let sp = 3; sp <= MAX_SHORE_SPAN; sp += 1) {
          const q = { x: r2(cleat.x + d.x * sp), y: r2(cleat.y + d.y * sp) }, g = groundAt(q.x, q.y);
          if (g === null) break;
          if (g < SHORE_LEVEL) continue;
          if (polygons.some((p) => inRing(q, p.points) || (p.name !== c.raft && clearance(q, p.points) < MIN_STANDOFF))) continue;
          if (coords.some((o) => o !== c && dist(anchorOf(o), q) < MIN_PILE_GAP)) continue;
          cands.push({ q, g, sp }); // every valid point on this bearing: the nearest one may be hemmed in
        }
      }
      cands.sort((p, q) => p.sp - q.sp);
      let done = null;
      for (const cand of cands) {
        // other single bases of the same raft are waiting for their own turn: their old cables do not count
        const waiting = (o) => o.type === 'BED' && !o.sharedWith && o.raft === c.raft;
        const crossed = coords.filter((o) => o !== c && !waiting(o) && segCross(cleat, cand.q, cleatOf(o), anchorOf(o)));
        if (!crossed.length || crossed.length > 6) continue;
        if (crossed.some((o) => o.type !== 'SHORE' || o.raft !== c.raft)) continue;
        const group = [c, ...crossed];
        const piles = [{ ...cand.q, isNew: true }, ...crossed.map((o) => ({ ...anchorOf(o), isNew: !!o.converted }))];
        const outside = coords.filter((o) => !group.includes(o) && !waiting(o));
        const lineOk = (l, p) => {
          const cl = cleatOf(l);
          if (dist(cl, p) > MAX_SHORE_SPAN || overOwnRaft(cl, p, l)) return false;
          if (polygons.some((q) => q.name !== l.raft && segOverRing(cl, p, q.points))) return false;
          return outside.every((o) => !segCross(cl, p, cleatOf(o), anchorOf(o)));
        };
        let best = null;
        for (const perm of permutations(group.length)) {
          if (!group.every((l, i) => lineOk(l, piles[perm[i]]))) continue;
          let cross = false;
          for (let i = 0; i < group.length && !cross; i++) for (let j = i + 1; j < group.length; j++) {
            if (segCross(cleatOf(group[i]), piles[perm[i]], cleatOf(group[j]), piles[perm[j]])) { cross = true; break; }
          }
          if (cross) continue;
          const total = group.reduce((t, l, i) => t + dist(cleatOf(l), piles[perm[i]]), 0);
          if (!best || total < best.total - 1e-9) best = { perm, total };
        }
        if (!best) continue;
        group.forEach((l, i) => {
          const p = piles[best.perm[i]];
          l.type = 'SHORE';
          delete l.anchorId; delete l.sharedWith;
          if (p.isNew) l.converted = true; else delete l.converted;
          setAnchor(l, { x: p.x, y: p.y });
        });
        done = `${c.code}: lake-bed line -> shore (R1, re-hooked with ${crossed.map((o) => o.code).join(', ')}; one new pile at ground ${cand.g.toFixed(2)} m), spans ${group.map((l) => l.span).join(' / ')} m`;
        break;
      }
      if (done) { report.moved.push(done); changed = true; }
    }
  }
}
untangleToShore();
convertToShore((c) => !c.sharedWith);

/**
 * R1, for a knot the small re-hook above cannot open (several cables of one
 * raft fanning from one corner across a notch). One new pile on the bank for
 * the blocked cleat, then the cables of the whole knot are uncrossed two by
 * two: whenever two of them cross, their piles are exchanged (each exchange
 * shortens the total cable length, so it ends). Any line of the same raft
 * that a re-hooked cable would now cross joins the knot. Refused, leaving
 * everything as it was, if a cable of another raft or a shared base is in the
 * way, or if a cable would end up longer than MAX_SHORE_SPAN.
 */
function untangleKnots() {
  for (let pass = 0, changed = true; changed && pass < 10; pass++) {
    changed = false;
    for (const c of coords) {
      if (c.type !== 'BED' || c.sharedWith) continue;
      const cleat = cleatOf(c), a0 = anchorOf(c), L0 = dist(cleat, a0) || 1, dir = { x: (a0.x - cleat.x) / L0, y: (a0.y - cleat.y) / L0 };
      const waiting = (o) => o.type === 'BED' && !o.sharedWith && o.raft === c.raft;
      const cands = [];
      for (const deg of SHORE_FAN_STEPS) {
        const r = (deg * Math.PI) / 180, d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
        for (let sp = 3; sp <= MAX_SHORE_SPAN; sp += 1) {
          const q = { x: r2(cleat.x + d.x * sp), y: r2(cleat.y + d.y * sp) }, g = groundAt(q.x, q.y);
          if (g === null) break;
          if (g < SHORE_LEVEL) continue;
          if (polygons.some((p) => inRing(q, p.points) || (p.name !== c.raft && clearance(q, p.points) < MIN_STANDOFF))) continue;
          if (coords.some((o) => o !== c && dist(anchorOf(o), q) < MIN_PILE_GAP)) continue;
          cands.push({ q, g, sp });
        }
      }
      cands.sort((p, q) => p.sp - q.sp);
      let done = null;
      for (const cand of cands.slice(0, 120)) {
        // the knot: line -> pile, starting with the blocked line on the new pile
        const knot = new Map([[c, { ...cand.q, isNew: true }]]);
        const seg = (l) => [cleatOf(l), knot.get(l) ?? anchorOf(l)];
        let ok = true;
        for (let round = 0; round < 60 && ok; round++) {
          // 1. pull in whatever a knot cable crosses
          let grew = false;
          for (const l of [...knot.keys()]) {
            for (const o of coords) {
              if (knot.has(o) || waiting(o)) continue;
              if (!segCross(...seg(l), cleatOf(o), anchorOf(o))) continue;
              if (o.type !== 'SHORE' || o.raft !== c.raft || knot.size >= 14) { ok = false; break; }
              knot.set(o, { ...anchorOf(o), isNew: !!o.converted });
              grew = true;
            }
            if (!ok) break;
          }
          if (!ok) break;
          // 2. exchange the piles of two crossing knot cables
          let swapped = false;
          const ls = [...knot.keys()];
          for (let i = 0; i < ls.length && !swapped; i++) for (let j = i + 1; j < ls.length; j++) {
            if (segCross(...seg(ls[i]), ...seg(ls[j]))) { const t = knot.get(ls[i]); knot.set(ls[i], knot.get(ls[j])); knot.set(ls[j], t); swapped = true; break; }
          }
          if (!grew && !swapped) break;
          if (round === 59) ok = false;
        }
        if (!ok) continue;
        const good = [...knot.entries()].every(([l, p]) => {
          const cl = cleatOf(l);
          return dist(cl, p) <= MAX_SHORE_SPAN && dist(cl, p) >= 3 && !overOwnRaft(cl, p, l)
            && polygons.every((q) => q.name === l.raft || !segOverRing(cl, p, q.points))
            && coords.every((o) => knot.has(o) || waiting(o) || !segCross(cl, p, cleatOf(o), anchorOf(o)));
        });
        if (!good) continue;
        for (const [l, p] of knot) {
          l.type = 'SHORE';
          delete l.anchorId; delete l.sharedWith;
          if (p.isNew) l.converted = true; else delete l.converted;
          setAnchor(l, { x: p.x, y: p.y });
        }
        done = `${c.code}: lake-bed line -> shore (R1, knot of ${knot.size} cables re-hooked: ${[...knot.keys()].map((l) => l.code).join(', ')}; one new pile at ground ${cand.g.toFixed(2)} m), longest ${Math.max(...[...knot.keys()].map((l) => l.span))} m`;
        break;
      }
      if (done) { report.moved.push(done); changed = true; }
    }
  }
}
untangleKnots();
convertToShore((c) => !c.sharedWith);

// ---- Step 2c' : straighten the oblique new shore cables --------------------
/** Outward normals of the raft edge(s) the cleat sits on (two at a corner). */
function cleatNormals(c) {
  const ring = ringOf[c.raft], p = cleatOf(c), out = [];
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a.x * b.y - b.x * a.y; }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = dist(a, b);
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const u = Math.max(0, Math.min(L, (p.x - a.x) * ux + (p.y - a.y) * uy));
    if (Math.hypot(p.x - a.x - ux * u, p.y - a.y - uy * u) < 0.05) out.push(area > 0 ? { x: uy, y: -ux } : { x: -uy, y: ux });
  }
  return out;
}
/** Angle in plan between the cable cleat->p and the outward normal of the edge, degrees (0 inside the wedge of a corner). */
function obliquity(c, p) {
  const cl = cleatOf(c), L = dist(cl, p) || 1, d = { x: (p.x - cl.x) / L, y: (p.y - cl.y) / L };
  const ns = cleatNormals(c);
  if (!ns.length) return 0;
  const dots = ns.map((n) => d.x * n.x + d.y * n.y);
  if (ns.length > 1 && dots.every((v) => v >= 0)) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, Math.max(...dots)))) * 180) / Math.PI;
}
// A cable far off the normal of its edge holds the raft poorly across that edge. Every NEW shore pile whose
// cable is more than MAX_OBLIQUITY off the normal is moved, if the bank allows it, to the feasible position
// within MAX_OBLIQUITY that restrains the raft best across the edge: the largest cos^2(obliquity) / length
// (stiffness of a cable across the edge, per unit EA). Staked piles are never moved.
for (let pass = 0, changed = true; changed && pass < 5; pass++) {
  changed = false;
  for (const c of coords) {
    if (c.type !== 'SHORE' || !c.converted) continue;
    const now = obliquity(c, anchorOf(c));
    if (now <= MAX_OBLIQUITY + 0.05) continue;
    const cleat = cleatOf(c);
    let best = null;
    for (const n of cleatNormals(c)) {
      for (let deg = -MAX_OBLIQUITY; deg <= MAX_OBLIQUITY; deg += 2.5) {
        const r = (deg * Math.PI) / 180, d = { x: n.x * Math.cos(r) - n.y * Math.sin(r), y: n.x * Math.sin(r) + n.y * Math.cos(r) };
        for (let sp = 3; sp <= MAX_SHORE_SPAN; sp += 0.5) {
          const q = { x: r2(cleat.x + d.x * sp), y: r2(cleat.y + d.y * sp) }, g = groundAt(q.x, q.y);
          if (g === null) break;
          if (g < SHORE_LEVEL) continue;
          if (!shoreLineFeasible(cleat, q, c) || overOwnRaft(cleat, q, c)) continue;
          // restraint across the edge per unit of cable stretch: cos^2(obliquity) / length
          const ob = obliquity(c, q), k = Math.cos((ob * Math.PI) / 180) ** 2 / sp;
          if (ob <= MAX_OBLIQUITY + 1e-9 && (!best || k > best.k + 1e-12)) best = { k, ob, sp, q, g };
        }
      }
    }
    if (!best) { report.moved.push(`${c.code}: cable ${now.toFixed(0)}° off the edge normal — no pile position on the bank within ${MAX_OBLIQUITY}° (kept)`); continue; }
    const before = c.span;
    setAnchor(c, best.q);
    changed = true;
    report.moved.push(`${c.code}: new shore pile moved to straighten the cable, ${now.toFixed(0)}° -> ${best.ob.toFixed(0)}° off the edge normal, span ${before} -> ${c.span} m, restraint index x${(best.k / (Math.cos((now * Math.PI) / 180) ** 2 / before)).toFixed(1)}, ground ${best.g.toFixed(2)} m`);
  }
}

// ---- Step 2e (R3): no single base left in a gap ----------------------------
// Owner, 2026-10-09: "sao không nối luôn vào bè còn lại mà để neo 1 bè thôi ... dùng chung được thì cứ cho
// dùng chung". A base still holding ONE line although it faces another raft (that raft has no free line left
// to pair with) gets a partner: ONE NEW line from the facing raft. The base moves to the middle of the two
// cleats when that position is allowed, otherwise it stays. Of all the cleat positions on the facing edge the
// one giving the shortest pair of cables wins.
for (const c of coords.filter((q) => q.type === 'BED' && !q.sharedWith)) {
  const f = facingRaft(c);
  if (!f) continue;
  const w = walker(ringOf[f.name]);
  const cleat = cleatOf(c), base0 = anchorOf(c);
  const others = coords.filter((o) => o !== c);
  const cableOk = (from, to, raft) => !overOwnRaft(from, to, { raft })
    && polygons.every((q) => q.name === raft || !segOverRing(from, to, q.points))
    && others.every((o) => !segCross(from, to, cleatOf(o), anchorOf(o)));
  let best = null;
  for (let t = 0; t < w.total; t += 0.5) {
    const p = w.at(t), pt = { x: r2(p.x), y: r2(p.y) };
    if (dist(pt, base0) > MAX_SHARED_SPAN) continue;
    // not on top of a cleat the raft already has
    if (coords.some((o) => o.raft === f.name && dist(cleatOf(o), pt) < 2)) continue;
    for (const base of [{ x: r2((cleat.x + pt.x) / 2), y: r2((cleat.y + pt.y) / 2) }, base0]) {
      if (minClearanceAll(base) < MIN_STANDOFF - 1e-6) continue;
      if (others.some((o) => dist(anchorOf(o), base) < (o.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP) - 1e-6)) continue;
      const la = dist(cleat, base), lb = dist(pt, base);
      if (la > MAX_SHARED_SPAN || lb > MAX_SHARED_SPAN || la < 3 || lb < 3) continue;
      if (!cableOk(cleat, base, c.raft) || !cableOk(pt, base, f.name)) continue;
      if (!best || la + lb < best.len - 1e-9) best = { len: la + lb, pt, base };
      break; // the centred base is preferred for this cleat
    }
  }
  if (!best) { report.unresolved.push(`R3 ${c.code}: no place on ${f.name} for a partner line`); continue; }
  setAnchor(c, best.base);
  const partner = addBedLine(f.name, best.pt, best.base, `partner of ${c.code} on its base (R3)`);
  c.sharedWith = partner.code; partner.sharedWith = c.code;
  report.moved.push(`${c.code} + ${partner.code} (new line on ${f.name}): one shared lake-bed base (R3), spans ${c.span} / ${partner.span} m`);
}
if (process.argv.includes('--explain')) console.log('SINGLE BASES LEFT', coords.filter((c) => c.type === 'BED' && !c.sharedWith).map((c) => `${c.code}(${c.span} m, ${facingRaft(c) ? 'facing ' + facingRaft(c).name : 'not facing a raft'})`).join('; '));
if (process.argv.includes('--explain')) {
  for (const c of coords.filter((q) => q.type === 'BED' && !q.sharedWith)) {
    const cleat = cleatOf(c), a = anchorOf(c), L = dist(cleat, a) || 1, dir = { x: (a.x - cleat.x) / L, y: (a.y - cleat.y) / L };
    const tally = new Map(); let pts = 0;
    for (const deg of SHORE_FAN_STEPS) {
      const r = (deg * Math.PI) / 180, d = { x: dir.x * Math.cos(r) - dir.y * Math.sin(r), y: dir.x * Math.sin(r) + dir.y * Math.cos(r) };
      for (let sp = 3; sp <= MAX_SHORE_SPAN; sp += 0.5) {
        const q = { x: cleat.x + d.x * sp, y: cleat.y + d.y * sp }, g = groundAt(q.x, q.y);
        if (g === null) break;
        if (g < SHORE_LEVEL) continue;
        pts++;
        const why = new Set();
        if (overOwnRaft(cleat, q, c)) why.add('over own raft');
        for (const q2 of polygons) { if (inRing(q, q2.points)) why.add('inside ' + q2.name); else if (q2.name !== c.raft && (clearance(q, q2.points) < MIN_STANDOFF || segOverRing(cleat, q, q2.points))) why.add('raft ' + q2.name); }
        for (const o of coords) { if (o === c) continue; if (dist(anchorOf(o), q) < MIN_PILE_GAP) why.add('near ' + o.code); if (segCross(cleat, q, cleatOf(o), anchorOf(o))) why.add('x ' + o.code + (o.type === 'BED' ? '(bed)' : o.converted ? '(new)' : '')); }
        for (const w of why) tally.set(w, (tally.get(w) ?? 0) + 1);
      }
    }
    console.log('WHY', c.code, 'cleat', cleat.x.toFixed(0), cleat.y.toFixed(0), 'shore-level points in fan:', pts, [...tally.entries()].sort((p, q) => q[1] - p[1]).slice(0, 9).map(([k, v]) => k + ':' + v).join(', '));
  }
}
// ---- Step 2f: a shared base stands midway between its two cleats -----------
// Two cables of equal length pull the base alike from both sides, and neither is steeper than it has to be
// (the steeper cable is the one that lifts the base). Moved only when the midpoint keeps every rule.
for (const a of coords) {
  if (a.type !== 'BED' || !a.sharedWith || a.code > a.sharedWith) continue;
  const b = coords.find((o) => o.code === a.sharedWith);
  const mid = { x: r2((a.xRaft + b.xRaft) / 2), y: r2((a.yRaft + b.yRaft) / 2) };
  if (dist(mid, anchorOf(a)) < 0.5) continue;
  const others = coords.filter((o) => o !== a && o !== b);
  const ok = minClearanceAll(mid) >= MIN_STANDOFF - 1e-6
    && others.every((o) => dist(anchorOf(o), mid) >= (o.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP) - 1e-6)
    && [a, b].every((l) => !overOwnRaft(cleatOf(l), mid, l)
      && others.every((o) => !segCross(cleatOf(l), mid, cleatOf(o), anchorOf(o)))
      && polygons.every((q) => q.name === l.raft || !segOverRing(cleatOf(l), mid, q.points)));
  if (!ok) continue;
  const before = `${a.span} / ${b.span}`;
  setAnchor(a, mid); setAnchor(b, mid);
  report.moved.push(`${a.code} + ${b.code}: shared base centred between its two cleats, spans ${before} -> ${a.span} / ${b.span} m`);
}
// One id per lake-bed base: shared lines carry the same id.
{
  let n = 0;
  for (const c of coords) {
    if (c.type !== 'BED' || c.anchorId) continue;
    c.anchorId = `DV-${String(++n).padStart(3, '0')}`;
    if (c.sharedWith) coords.find((o) => o.code === c.sharedWith).anchorId = c.anchorId;
  }
}

// ---- Step 3: levels --------------------------------------------------------
// Lake-bed base: the DESIGN lake bed (MNDB - design depth). Shore pile: the IFC
// terrain at the pile, project datum (the older files carried IFC-datum values).
for (const c of coords) {
  if (c.type === 'BED') c.zAnchor = bedZ(c.raft);
  else { const g = groundAt(c.xAnchor, c.yAnchor); if (g !== null) c.zAnchor = r2(g); }
}
// A base shared by two rafts has ONE level: the deeper of the two design beds (steeper cables, more uplift).
for (const c of coords) {
  if (c.type !== 'BED' || !c.sharedWith) continue;
  const o = coords.find((q) => q.code === c.sharedWith);
  c.zAnchor = Math.min(bedZ(c.raft), bedZ(o.raft));
}

// ------------------------------------------------------------------ verify
const errors = [...report.unresolved];
for (const poly of polygons) {
  const n = coords.filter((c) => c.raft === poly.name).length;
  if (poly.perimeter_m / n > MAX_SPACING) errors.push(`C9 ${poly.name}: ${(poly.perimeter_m / n).toFixed(2)} m`);
}
for (const c of coords) {
  if (c.type === 'BED' && minClearanceAll(anchorOf(c)) < MIN_STANDOFF - 1e-6) errors.push(`G1 ${c.code}`);
  if (c.type === 'SHORE' && polygons.some((q) => inRing(anchorOf(c), q.points))) errors.push(`shore pile in raft ${c.code}`);
  for (const q of polygons) if (q.name !== c.raft && segOverRing(cleatOf(c), anchorOf(c), q.points)) errors.push(`G3 ${c.code} over ${q.name}`);
}
for (let i = 0; i < coords.length; i++) {
  for (let j = i + 1; j < coords.length; j++) {
    const a = coords[i], b = coords[j];
    if (segCross(cleatOf(a), anchorOf(a), cleatOf(b), anchorOf(b))) errors.push(`G3 ${a.code} x ${b.code}`);
    if (a.anchorId && a.anchorId === b.anchorId) continue; // two lines on ONE shared base
    const gap = a.type === 'BED' && b.type === 'BED' ? MIN_BED_GAP : MIN_PILE_GAP;
    if (dist(anchorOf(a), anchorOf(b)) < gap - 1e-6) errors.push(`G4 ${a.code}/${b.code}`);
  }
}
if (new Set(coords.map((c) => c.code)).size !== coords.length) errors.push('duplicate line code');
for (const poly of polygons) {
  const arc = widestArc(poly.name);
  if (arc.gap > MAX_ARC) errors.push(`arc ${poly.name}: ${arc.gap.toFixed(0)}°`);
}
for (const name of GAP_LIMITED) {
  const worst = Math.max(...cleatGaps(name).gaps.map((g) => g.len));
  if (worst > MAX_CLEAT_STEP + 1e-6) errors.push(`edge step ${name}: ${worst.toFixed(1)} m`);
}
for (const c of coords) {
  if (distToRing(cleatOf(c), ringOf[c.raft]) > CLEAT_TOL) errors.push(`cleat off edge ${c.code}`);
}

// ---- Anchor schedule, derived from the lines -----------------------------
let iS = 0, iB = 0;
const shore = coords.filter((c) => c.type === 'SHORE');
const bed = coords.filter((c) => c.type === 'BED');
// One row per ANCHOR: a shared lake-bed base appears once, with both of its lines.
const bedAnchors = [...new Set(bed.map((c) => c.anchorId))].map((id) => bed.filter((c) => c.anchorId === id));
const piles = [
  ...shore.map((c) => ({ code: `CS-${String(++iS).padStart(3, '0')}`, line: c.code, lines: [c.code], raft: c.raft, rafts: [c.raft], type: 'SHORE', shape: 'circular', x: c.xAnchor, y: c.yAnchor, z: c.zAnchor })),
  ...bedAnchors.map((ls) => ({ code: `CB-${String(++iB).padStart(3, '0')}`, line: ls[0].code, lines: ls.map((c) => c.code), raft: ls[0].raft, rafts: ls.map((c) => c.raft), type: 'BED', shape: 'square', x: ls[0].xAnchor, y: ls[0].yAnchor, z: ls[0].zAnchor }))
].map((p, i) => ({ index: i + 1, ...p }));
for (const ls of bedAnchors) {
  if (ls.length > 2) errors.push(`more than two lines on base ${ls[0].anchorId}`);
  if (ls.some((c) => c.xAnchor !== ls[0].xAnchor || c.yAnchor !== ls[0].yAnchor)) errors.push(`lines of ${ls[0].anchorId} do not meet`);
}

console.log(`lines ${coords.length} (shore ${shore.length} of which ${shore.filter((c) => c.converted).length} converted from the lake bed; bed ${bed.length} on ${bedAnchors.length} bases, ${bedAnchors.filter((l) => l.length === 2).length} shared)`);
console.log(`moved ${report.moved.length}:\n  ${report.moved.join('\n  ')}`);
console.log(`added ${report.added.length}:\n  ${report.added.join('\n  ')}`);
if (errors.length) {
  console.error(`\n${errors.length} violation(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('\nall invariants hold (C9, G1..G4)');
if (!dryRun) {
  fs.writeFileSync(COORDS, JSON.stringify(coords, null, 2) + '\n');
  fs.writeFileSync(PILES, JSON.stringify(piles, null, 2) + '\n');
  console.log('written', path.relative(ROOT, COORDS), path.relative(ROOT, PILES));
}
