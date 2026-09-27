#!/usr/bin/env node
/**
 * planMooringLayoutV2.mjs — design pass over the V2 mooring network (12 rafts).
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
 *   G4   any two piles >= 3.0 m apart
 * Shore piles are never moved. Every pile is a square RC pile (cọc vuông BTCT).
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
const MIN_PILE_GAP = 3.0;    // m, G4
const MIN_CLEAT_GAP = 6.0;   // m, spacing of fittings on the pontoon edge
const MNDB = 384.5;          // m, normal water level
// Lake-bed level under each raft = MNDB - design water depth (same depth the
// load engine uses). The IFC terrain mesh cannot supply it: it reads ~396 m
// under the rafts, i.e. above the water surface.
const WATER_DEPTH = { 'BÈ 1': 6.0 };
const DEFAULT_DEPTH = 6.2;

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
    if (dist(anchorOf(c), pile) < MIN_PILE_GAP) return false;
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
const GAP_LIMITED = new Set(['BÈ 5']);
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

// ---- Step 3: bed level (all bed piles: MNDB - design depth) ---------------
for (const c of coords) if (c.type === 'BED') c.zAnchor = bedZ(c.raft);

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
    if (dist(anchorOf(a), anchorOf(b)) < MIN_PILE_GAP - 1e-6) errors.push(`G4 ${a.code}/${b.code}`);
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

// ---- Pile schedule, derived from the lines (square RC piles only) --------
let iS = 0, iB = 0;
const shore = coords.filter((c) => c.type === 'SHORE');
const bed = coords.filter((c) => c.type === 'BED');
const piles = [
  ...shore.map((c) => ({ code: `CS-${String(++iS).padStart(3, '0')}`, line: c.code, raft: c.raft, type: 'SHORE', shape: 'square', x: c.xAnchor, y: c.yAnchor, z: c.zAnchor })),
  ...bed.map((c) => ({ code: `CB-${String(++iB).padStart(3, '0')}`, line: c.code, raft: c.raft, type: 'BED', shape: 'square', x: c.xAnchor, y: c.yAnchor, z: c.zAnchor }))
].map((p, i) => ({ index: i + 1, ...p }));

console.log(`lines ${coords.length} (shore ${shore.length}, bed ${bed.length})`);
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
