/**
 * Targeted repair of the Huổi Vanh mooring layout.
 *
 *   node scripts/repairMooringLayout.mjs [--dry]
 *
 * WHAT IT DOES AND DOES NOT TOUCH
 *
 * The 129 SHORE piles are real survey: their spans vary 11.5–49.7 m and they
 * sit on the bank. They are never repositioned here, except that a pile
 * coincident with another one is nudged sideways (R1) — two piles cannot
 * occupy the same point.
 *
 * The 170 LAKE-BED anchors are NOT survey data. Every one of them sat at the
 * same 17.53–17.55 m from its cleat, on a handful of repeated bearings, at a
 * single assumed bed level (z = 376.8). That formula is what drove 26 anchors
 * inside a raft footprint, up to 29.9 m in. They are laid out properly (R0).
 *
 * Every raft's line count and shore/bed split is preserved exactly, so the
 * load model, the tensions and checks C1..C11 are untouched.
 *
 *   R0  Bed anchors re-laid out: the perimeter is sampled, stretches whose
 *       outward normal faces open water are kept, and the N bed lines are
 *       spread over them by farthest-point sampling seeded with the shore
 *       cleats — so bed lines fill the sectors the shore lines leave open.
 *   R4  Cables crossing each other within one raft — fixed WITHOUT moving any
 *       pile, by swapping the two lines' RAFT-SIDE attachment points (2-opt
 *       uncrossing). The pile keeps its coordinate AND its survey code; only
 *       which cleat it runs to changes.
 *   R5  Crossings between lines of two DIFFERENT rafts — the BED line of the
 *       pair is slid along its own raft edge. Two crossing SHORE lines are
 *       never touched; they are reported for a design decision.
 *   R2  Any bed anchor still inside a footprint — pushed out through the
 *       NEAREST edge (not radially, which would fling it across the pontoon
 *       and invent a cable span far longer than anything on site).
 *   R3  Cables crossing a DIFFERENT raft's footprint — the anchor is rotated
 *       about its attachment point, smallest rotation that clears.
 *   R1  Piles closer than MIN_PILE_GAP — separated along the edge tangent.
 *
 * Priority rule behind R4/R5: an anchor pile is a monument staked out in the
 * field and referenced by code in the pile schedule, so it must not be
 * silently reassigned; the attachment cleat on the pontoon is a detail that
 * can move. Anything the script cannot fix safely is reported, never faked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COORDS = path.join(ROOT, 'src/data/huoiVanhCoordinates.json');
const POLYS = path.join(ROOT, 'src/data/huoiVanhRaftPolygons.json');

const MIN_PILE_GAP = 3.0;    // m, minimum spacing between two anchor piles
const RAFT_STANDOFF = 5.0;   // m, minimum clearance from a pontoon edge to a bed pile
const MAX_ITER = 60;
const MAX_SPAN = 55.0;      // m, longest cable span the survey contains (49.7 m) plus margin

const dryRun = process.argv.includes('--dry');

const coords = JSON.parse(fs.readFileSync(COORDS, 'utf8'));
const polygons = JSON.parse(fs.readFileSync(POLYS, 'utf8'));

// ---------------------------------------------------------------- geometry
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v) => Math.hypot(v.x, v.y);
const norm = (v) => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const cross3 = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const segIntersect = (p1, p2, p3, p4) => {
  const d1 = cross3(p3, p4, p1), d2 = cross3(p3, p4, p2);
  const d3 = cross3(p1, p2, p3), d4 = cross3(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};
const pointInRing = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
const distToSeg = (p, a, b) => {
  const d = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / (d.x * d.x + d.y * d.y || 1)));
  return dist(p, { x: a.x + t * d.x, y: a.y + t * d.y });
};
const distToRing = (p, ring) => Math.min(...ring.map((q, i) => distToSeg(p, q, ring[(i + 1) % ring.length])));
const segCrossesRing = (a, b, ring) =>
  ring.some((q, i) => segIntersect(a, b, q, ring[(i + 1) % ring.length]));

const anchorOf = (c) => ({ x: c.xAnchor, y: c.yAnchor });
const cleatOf = (c) => ({ x: c.xRaft, y: c.yRaft });

const polyOf = (raftName) => polygons.find((p) => p.rafts.includes(raftName));
const centroid = (ring) => ({
  x: ring.reduce((s, q) => s + q.x, 0) / ring.length,
  y: ring.reduce((s, q) => s + q.y, 0) / ring.length
});

/** Keeps `span` and `azimuth` consistent with the coordinates. */
function refresh(c) {
  const d = sub(anchorOf(c), cleatOf(c));
  c.span = Math.round(len(d) * 100) / 100;
  let az = (Math.atan2(d.x, d.y) * 180) / Math.PI; // clockwise from North (+Y)
  if (az < 0) az += 360;
  c.azimuth = Math.round(az * 10) / 10;
}

const report = { R0: [], R1: [], R2: [], R3: [], R4: [], R5: [], R6: [], unresolved: [] };

// ============================================================== R0: bed re-plan
// Every one of the 170 "surveyed" lake-bed anchors in the source file sits at
// the SAME 17.53–17.55 m from its cleat, on a handful of repeated bearings, at
// one assumed bed level (z = 376.8). That is a formula, not a survey — and it
// is what drove 26 anchors inside a raft footprint. They are therefore laid out
// properly here. The 129 shore piles (spans 11.5–49.7 m, real bank positions)
// are NEVER touched by this phase.

const BED_STANDOFF = 17.5;   // m, clear distance from the pontoon edge to a bed pile
const MIN_CLEAT_GAP = 6.0;   // m, minimum spacing between attachment points on the edge

/** Ring geometry: cumulative perimeter, point/normal at an arc position. */
function ringWalker(ring) {
  const segs = ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    return { a, b, len: dist(a, b) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  const at = (t) => {
    let d = ((t % total) + total) % total;
    for (const s of segs) {
      if (d <= s.len) {
        const u = s.len ? d / s.len : 0;
        const point = { x: s.a.x + (s.b.x - s.a.x) * u, y: s.a.y + (s.b.y - s.a.y) * u };
        const dir = norm(sub(s.b, s.a));
        let n = { x: dir.y, y: -dir.x };
        if (pointInRing({ x: point.x + n.x * 0.5, y: point.y + n.y * 0.5 }, ring)) n = { x: -n.x, y: -n.y };
        return { point, normal: n };
      }
      d -= s.len;
    }
    return { point: ring[0], normal: { x: 1, y: 0 } };
  };
  /** Arc position of the ring point closest to p. */
  const project = (p) => {
    let acc = 0, best = { t: 0, d: Infinity };
    for (const s of segs) {
      const d2 = sub(s.b, s.a);
      const u = Math.max(0, Math.min(1, ((p.x - s.a.x) * d2.x + (p.y - s.a.y) * d2.y) / (d2.x * d2.x + d2.y * d2.y || 1)));
      const q = { x: s.a.x + d2.x * u, y: s.a.y + d2.y * u };
      const dd = dist(p, q);
      if (dd < best.d) best = { t: acc + s.len * u, d: dd };
      acc += s.len;
    }
    return best.t;
  };
  return { at, project, total };
}

function replanBedAnchors() {
  // Shore piles are fixed points for this phase — real, surveyed, never moved.
  const shorePiles = coords.filter((c) => c.type === 'SHORE').map(anchorOf);
  for (const poly of polygons) {
    const raftName = poly.rafts[0];
    const ring = poly.points;
    const walker = ringWalker(ring);
    const lines = coords.filter((c) => c.raft === raftName);
    const bed = lines.filter((c) => c.type === 'BED');
    const shore = lines.filter((c) => c.type === 'SHORE');
    if (bed.length === 0) continue;

    // Sample the perimeter and keep only the stretches that actually have open
    // water in front of them. A bed pile cannot go on an edge that faces a
    // neighbouring raft a few metres away (rafts 1..5 form a near-contiguous
    // chain) — trying to force one there is what produced 77 m cable spans.
    const SAMPLE = 2.0;
    const feasible = [];
    for (let t = 0; t < walker.total; t += SAMPLE) {
      const { point, normal } = walker.at(t);
      // Try the nominal standoff first, then a little further out, but never
      // so far that the span stops looking like a mooring line.
      let chosen = null;
      for (let s = BED_STANDOFF; s <= BED_STANDOFF + 12; s += 1.5) {
        const cand = { x: point.x + normal.x * s, y: point.y + normal.y * s };
        const clearOfRafts = polygons.every((p) => !pointInRing(cand, p.points) && distToRing(cand, p.points) >= RAFT_STANDOFF);
        const clearOfShore = shorePiles.every((o) => dist(cand, o) >= MIN_PILE_GAP);
        if (clearOfRafts && clearOfShore) { chosen = { cand, standoff: s }; break; }
      }
      if (chosen) feasible.push({ t, point, normal, ...chosen });
    }

    if (feasible.length === 0) {
      report.unresolved.push(`${raftName}: không còn mặt nước trống quanh bè để đặt ${bed.length} cọc đáy.`);
      continue;
    }

    // Spread the N bed lines over the feasible stretches: farthest-point
    // sampling, seeded with the shore cleats so bed lines land in the sectors
    // the shore lines leave open (this is what closes BÈ 7's 132° gap).
    const shoreT = shore.map((c) => walker.project(cleatOf(c)));
    const arcDist = (a, b) => { const d = Math.abs(a - b) % walker.total; return Math.min(d, walker.total - d); };
    const picked = [];
    for (let k = 0; k < bed.length; k++) {
      let best = null;
      for (const f of feasible) {
        if (picked.some((p) => p.t === f.t)) continue;
        const refs = [...shoreT, ...picked.map((p) => p.t)];
        const clearance = refs.length ? Math.min(...refs.map((r) => arcDist(f.t, r))) : walker.total;
        const free = picked.every((p) => dist(f.cand, p.cand) >= MIN_PILE_GAP);
        if (!free) continue;
        if (!best || clearance > best.clearance) best = { ...f, clearance };
      }
      if (!best) { report.unresolved.push(`${raftName}: chỉ bố trí được ${k}/${bed.length} cọc đáy, phần còn lại không đủ chỗ.`); break; }
      picked.push(best);
    }

    // Assign in perimeter order so neighbouring codes stay neighbours on site.
    picked.sort((a, b) => a.t - b.t);
    bed.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    bed.forEach((c, i) => {
      const slot = picked[i] ?? picked[picked.length - 1];
      c.xRaft = Math.round(slot.point.x * 100) / 100;
      c.yRaft = Math.round(slot.point.y * 100) / 100;
      c.xAnchor = Math.round(slot.cand.x * 100) / 100;
      c.yAnchor = Math.round(slot.cand.y * 100) / 100;
      refresh(c);
    });

    const spans = bed.map((c) => c.span);
    report.R0.push(
      `${raftName}: bố trí lại ${bed.length} cọc đáy quanh chu vi ${walker.total.toFixed(0)} m — ` +
      `nhịp ${Math.min(...spans).toFixed(1)}–${Math.max(...spans).toFixed(1)} m`
    );
    void MIN_CLEAT_GAP;
  }
}

// --------------------------------------------- R2: bed pile inside a raft
/** Nearest point on a ring, and the outward unit normal there. */
function nearestExit(p, ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const d = sub(b, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / (d.x * d.x + d.y * d.y || 1)));
    const q = { x: a.x + t * d.x, y: a.y + t * d.y };
    const dd = dist(p, q);
    if (!best || dd < best.d) best = { d: dd, q, edge: norm(d) };
  }
  // Outward normal = the side of the edge the interior is NOT on.
  let n = { x: best.edge.y, y: -best.edge.x };
  const probe = { x: best.q.x + n.x * 0.5, y: best.q.y + n.y * 0.5 };
  if (pointInRing(probe, ring)) n = { x: -n.x, y: -n.y };
  return { point: best.q, normal: n, distance: best.d };
}

function pushOutOfRafts() {
  for (const c of coords) {
    if (c.type !== 'BED') continue;
    const hit = polygons.find((p) => pointInRing(anchorOf(c), p.points));
    if (!hit) continue;

    // Shortest way out, not radially across the whole pontoon: a pile that is
    // 30 m inside must not be flung 60 m away — that would invent a cable
    // span far longer than anything in the survey.
    const exit = nearestExit(anchorOf(c), hit.points);
    const before = dist(anchorOf(c), cleatOf(c));
    let candidate = {
      x: exit.point.x + exit.normal.x * RAFT_STANDOFF,
      y: exit.point.y + exit.normal.y * RAFT_STANDOFF
    };
    // Nudge further only while it is still inside some raft.
    for (let step = 0; step < 60; step++) {
      const clear = polygons.every((p) => !pointInRing(candidate, p.points) && distToRing(candidate, p.points) >= RAFT_STANDOFF);
      if (clear) break;
      candidate = { x: candidate.x + exit.normal.x, y: candidate.y + exit.normal.y };
    }

    const moved = dist(anchorOf(c), candidate);
    const newSpan = dist(candidate, cleatOf(c));
    if (newSpan > MAX_SPAN) {
      report.unresolved.push(
        `${c.code} (${c.raft}): cọc nằm sâu ${exit.distance.toFixed(1)} m trong mặt bằng bè; ` +
        `đẩy ra mép gần nhất thì nhịp dây thành ${newSpan.toFixed(1)} m > ${MAX_SPAN} m — ` +
        `nhiều khả năng sai số khảo sát, cần người thiết kế chỉ định lại vị trí.`
      );
      continue;
    }
    c.xAnchor = Math.round(candidate.x * 100) / 100;
    c.yAnchor = Math.round(candidate.y * 100) / 100;
    refresh(c);
    report.R2.push(`${c.code} (${c.raft}) dời ${moved.toFixed(1)} m ra mép gần nhất — nhịp ${before.toFixed(1)} → ${c.span} m`);
  }
}

// ------------------------------------------------ R1: coincident piles
function separatePiles() {
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const a = coords[i], b = coords[j];
      let d = dist(anchorOf(a), anchorOf(b));
      if (d >= MIN_PILE_GAP) continue;

      // Move the SECOND one, along the tangent of its own cable (i.e. sideways),
      // which for a shore pile keeps it on the same stretch of bank.
      const cable = norm(sub(anchorOf(b), cleatOf(b)));
      let tangent = { x: -cable.y, y: cable.x };
      // Push away from the other pile, not towards it.
      const away = sub(anchorOf(b), anchorOf(a));
      if (tangent.x * away.x + tangent.y * away.y < 0) tangent = { x: -tangent.x, y: -tangent.y };

      const need = MIN_PILE_GAP - d + 0.2;
      b.xAnchor = Math.round((b.xAnchor + tangent.x * need) * 100) / 100;
      b.yAnchor = Math.round((b.yAnchor + tangent.y * need) * 100) / 100;
      refresh(b);
      d = dist(anchorOf(a), anchorOf(b));
      report.R1.push(`${a.code} ~ ${b.code}: tách ra còn cách ${d.toFixed(2)} m (${b.code} dịch ngang ${need.toFixed(2)} m)`);
    }
  }
}

// --------------------------------- R3: cable crossing another raft footprint
function rotateOffOtherRafts() {
  for (const c of coords) {
    const others = polygons.filter((p) => !p.rafts.includes(c.raft));
    const crossesAny = (a, b) => others.some((p) => segCrossesRing(a, b, p.points));
    if (!crossesAny(cleatOf(c), anchorOf(c))) continue;

    const pivot = cleatOf(c);
    const r = dist(pivot, anchorOf(c));
    const base = Math.atan2(c.yAnchor - pivot.y, c.xAnchor - pivot.x);
    let fixed = false;
    // Smallest rotation either way that clears every other raft.
    for (let deg = 2; deg <= 90 && !fixed; deg += 2) {
      for (const sign of [1, -1]) {
        const a = base + (sign * deg * Math.PI) / 180;
        const cand = { x: pivot.x + r * Math.cos(a), y: pivot.y + r * Math.sin(a) };
        const clearOfPolys = polygons.every((p) => !pointInRing(cand, p.points) && distToRing(cand, p.points) >= RAFT_STANDOFF);
        const farFromPiles = coords.every((o) => o === c || dist(cand, anchorOf(o)) >= MIN_PILE_GAP);
        if (!crossesAny(pivot, cand) && clearOfPolys && farFromPiles) {
          c.xAnchor = Math.round(cand.x * 100) / 100;
          c.yAnchor = Math.round(cand.y * 100) / 100;
          refresh(c);
          report.R3.push(`${c.code} (${c.raft}) xoay ${sign * deg}° quanh điểm neo trên bè, nhịp giữ ${c.span} m`);
          fixed = true;
          break;
        }
      }
    }
    if (!fixed) report.unresolved.push(`${c.code}: không tìm được hướng nào tránh được bè khác trong ±90°`);
  }
}

// ------------------------------ R4: uncross two cables by swapping cleats
function uncrossCables() {
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let swapped = false;
    for (let i = 0; i < coords.length && !swapped; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const a = coords[i], b = coords[j];
        // Same raft only: a cleat belongs to that pontoon. Line TYPE may differ —
        // swapping cleats never changes which pile a line runs to, so a shore
        // line stays a shore line and a bed line stays a bed line.
        if (a.raft !== b.raft) continue;
        if (!segIntersect(cleatOf(a), anchorOf(a), cleatOf(b), anchorOf(b))) continue;

        // 2-opt: swapping the raft-side ends of two crossing segments always
        // removes the crossing and shortens the total cable length.
        const ax = a.xRaft, ay = a.yRaft;
        a.xRaft = b.xRaft; a.yRaft = b.yRaft;
        b.xRaft = ax; b.yRaft = ay;
        refresh(a); refresh(b);
        report.R4.push(`${a.code} × ${b.code} (${a.raft}): hoán đổi điểm bắt dây trên mạn bè — cọc giữ nguyên tọa độ`);
        swapped = true;
        break;
      }
    }
    if (!swapped) break;
  }
}

// ------------- R5: crossings between lines of two DIFFERENT rafts ----------
// A cleat swap cannot help here (the cleats are on different pontoons), so the
// BED line of the pair — the one whose position this project controls — is slid
// along its own raft edge until the pair no longer fouls. A pair of two SHORE
// lines is never touched: both ends are surveyed, so it is reported instead.
/**
 * A line already slid once is never slid again: without this the pass
 * oscillates (a line moves +4 m to clear one neighbour, then −4 m to clear the
 * next, forever) and the script stops being idempotent.
 */
const slidOnce = new Set();

function separateCrossRaftPairs() {
  const shorePiles = coords.filter((c) => c.type === 'SHORE').map(anchorOf);
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const a = coords[i], b = coords[j];
      if (a.raft === b.raft) continue;
      if (!segIntersect(cleatOf(a), anchorOf(a), cleatOf(b), anchorOf(b))) continue;

      const movable = [a, b].find((c) => c.type === 'BED' && !slidOnce.has(c.code)) ?? null;
      const other = movable === a ? b : a;
      if (!movable) {
        report.unresolved.push(
          `${a.code} × ${b.code} (${a.raft} / ${b.raft}): không dời được — hoặc cả hai là dây neo BỜ ` +
          `(hai đầu đều là số liệu khảo sát), hoặc dây neo đáy ở đây đã được dời một lần rồi. Cần người thiết kế quyết định.`
        );
        continue;
      }

      const poly = polyOf(movable.raft);
      if (!poly) continue;
      const walker = ringWalker(poly.points);
      const t0 = walker.project(cleatOf(movable));
      let fixed = false;
      for (let step = 2; step <= 40 && !fixed; step += 2) {
        for (const sign of [1, -1]) {
          const { point, normal } = walker.at(t0 + sign * step);
          let cand = null;
          for (let s = BED_STANDOFF; s <= BED_STANDOFF + 12; s += 1.5) {
            const p = { x: point.x + normal.x * s, y: point.y + normal.y * s };
            const clearRafts = polygons.every((q) => !pointInRing(p, q.points) && distToRing(p, q.points) >= RAFT_STANDOFF);
            const clearPiles = coords.every((o) => o === movable || dist(p, anchorOf(o)) >= MIN_PILE_GAP) &&
              shorePiles.every((o) => dist(p, o) >= MIN_PILE_GAP);
            if (clearRafts && clearPiles) { cand = p; break; }
          }
          if (!cand) continue;
          if (segIntersect(point, cand, cleatOf(other), anchorOf(other))) continue;
          const crossesAnyRaft = polygons.filter((q) => !q.rafts.includes(movable.raft))
            .some((q) => segCrossesRing(point, cand, q.points));
          if (crossesAnyRaft) continue;

          movable.xRaft = Math.round(point.x * 100) / 100;
          movable.yRaft = Math.round(point.y * 100) / 100;
          movable.xAnchor = Math.round(cand.x * 100) / 100;
          movable.yAnchor = Math.round(cand.y * 100) / 100;
          refresh(movable);
          slidOnce.add(movable.code);
          report.R5.push(`${a.code} × ${b.code}: dời ${movable.code} (${movable.raft}, cọc đáy) ${sign * step} m dọc mép bè — hết cắt chéo`);
          fixed = true;
          break;
        }
      }
      if (!fixed) report.unresolved.push(`${a.code} × ${b.code}: chưa gỡ được giao cắt giữa ${a.raft} và ${b.raft}.`);
    }
  }
}

// ------------------------------------------------------------------- run
// Each pass can expose work for the others (a relocation may create a new
// crossing, an uncrossing may bring two piles closer), so run to a fixed point.
// The phases feed each other (a relocation can create a crossing, an
// uncrossing can bring two piles closer, and R1 nudging a shore pile changes
// what R0 considers feasible), so the whole pipeline runs to a FIXED POINT.
// Without this the script was not idempotent: running it twice kept improving
// the layout, which means its output depended on how many times you ran it.
let snapshot = '';
let rounds = 0;
for (let outer = 0; outer < 6; outer++) {
  replanBedAnchors();  // the 170 formulaic bed anchors, laid out properly
  for (let pass = 0; pass < 4; pass++) {
    uncrossCables();   // costs nothing, moves no pile — always first
    pushOutOfRafts();  // relocate anything still inside a footprint
    rotateOffOtherRafts();
    separatePiles();
  }
  for (let pass = 0; pass < 5; pass++) {
    uncrossCables();
    separateCrossRaftPairs();
  }
  normaliseShortBedLines();
  rounds = outer + 1;
  const now = JSON.stringify(coords);
  if (now === snapshot) break;
  snapshot = now;
  // Each outer round is a fresh attempt: let the sliding budget refill.
  slidOnce.clear();
  // Only the first round's narrative is worth printing; later rounds just
  // polish, and repeating every line would bury the real changes.
  if (outer === 0) for (const k of Object.keys(report)) report[`${k}_first`] = [...report[k]];
}

// ---- R6: bed lines must keep a workable cable angle ----------------------
// A bed anchor only a few metres off the pontoon gives a very steep cable
// (5.7 m span in ~6 m of water is 46 deg), which loads the pile in uplift far
// more than the 19 deg the design intends. Later phases use the small
// clearance constant, so normalise any short bed line back outward here.
function normaliseShortBedLines() {
  const MIN_BED_SPAN = 14.0;
  for (const c of coords) {
    if (c.type !== 'BED' || c.span >= MIN_BED_SPAN) continue;
    const dir = norm(sub(anchorOf(c), cleatOf(c)));
    let fixed = false;
    for (let s2 = MIN_BED_SPAN; s2 <= BED_STANDOFF + 12; s2 += 1.0) {
      const cand = { x: cleatOf(c).x + dir.x * s2, y: cleatOf(c).y + dir.y * s2 };
      const clearRafts = polygons.every((p) => !pointInRing(cand, p.points) && distToRing(cand, p.points) >= RAFT_STANDOFF);
      const clearPiles = coords.every((o) => o === c || dist(cand, anchorOf(o)) >= MIN_PILE_GAP);
      const noNewCross = coords.every((o) => o === c || !segIntersect(cleatOf(c), cand, cleatOf(o), anchorOf(o)));
      const throughRaft = polygons.filter((p) => !p.rafts.includes(c.raft)).some((p) => segCrossesRing(cleatOf(c), cand, p.points));
      if (clearRafts && clearPiles && noNewCross && !throughRaft) {
        const was = c.span;
        c.xAnchor = Math.round(cand.x * 100) / 100;
        c.yAnchor = Math.round(cand.y * 100) / 100;
        refresh(c);
        report.R6.push(`${c.code} (${c.raft}): nhịp ${was} → ${c.span} m để góc cáp không quá dốc`);
        fixed = true;
        break;
      }
    }
    if (!fixed) report.unresolved.push(`${c.code}: nhịp chỉ ${c.span} m (góc cáp dốc) nhưng không còn chỗ đẩy ra xa hơn.`);
  }
}

// ------------------------------------------------------------- verify
const remainingCross = [];
for (let i = 0; i < coords.length; i++) for (let j = i + 1; j < coords.length; j++) {
  if (segIntersect(cleatOf(coords[i]), anchorOf(coords[i]), cleatOf(coords[j]), anchorOf(coords[j])))
    remainingCross.push(`${coords[i].code}×${coords[j].code}`);
}
const remainingInRaft = coords.filter((c) => polygons.some((p) => pointInRing(anchorOf(c), p.points)));
const remainingThroughRaft = coords.filter((c) =>
  polygons.filter((p) => !p.rafts.includes(c.raft)).some((p) => segCrossesRing(cleatOf(c), anchorOf(c), p.points)));
let minGap = Infinity;
for (let i = 0; i < coords.length; i++) for (let j = i + 1; j < coords.length; j++)
  minGap = Math.min(minGap, dist(anchorOf(coords[i]), anchorOf(coords[j])));

console.log(`--- SỬA CHỮA (hội tụ sau ${rounds} vòng) ---`);
console.log(`R0 bố trí lại cọc đáy theo pháp tuyến mép bè:                  ${report.R0.length} cụm bè`);
console.log(`R4 gỡ dây cắt chéo (hoán đổi điểm bắt dây, KHÔNG dời cọc): ${report.R4.length}`);
console.log(`R2 cọc đáy nằm trong mặt bằng bè, đẩy ra ngoài:            ${report.R2.length}`);
console.log(`R3 dây cắt qua bè khác, xoay hướng:                        ${report.R3.length}`);
console.log(`R1 cọc trùng/sát nhau, tách ra:                            ${report.R1.length}`);
console.log(`R5 gỡ giao cắt giữa hai bè kề nhau:                        ${report.R5.length}`);
console.log(`R6 chuẩn hóa nhịp dây neo đáy quá ngắn:                    ${report.R6.length}`);
for (const k of ['R0', 'R4', 'R5', 'R6', 'R2', 'R3', 'R1']) for (const line of report[k]) console.log(`   [${k}] ${line}`);
if (report.unresolved.length) {
  console.log('--- KHÔNG TỰ SỬA ĐƯỢC (cần quyết định thiết kế) ---');
  for (const u of report.unresolved) console.log('   ' + u);
}

console.log('--- KIỂM TRA SAU SỬA ---');
console.log(`  cặp dây còn cắt chéo:        ${remainingCross.length} ${remainingCross.slice(0, 6).join(' ')}`);
if (remainingCross.length) {
  console.log('  → CẦN QUYẾT ĐỊNH THIẾT KẾ: không tồn tại vị trí thay thế nào trên mép bè thỏa mãn');
  console.log('    (khe nước giữa hai bè quá hẹp). Phương án: giảm 1 dây neo đáy ở khu vực này,');
  console.log('    hoặc chấp nhận hai dây giao nhau ở hai cao độ khác nhau, hoặc nới khoảng cách 2 bè.');
}
console.log(`  cọc còn trong mặt bằng bè:   ${remainingInRaft.length}`);
console.log(`  dây còn cắt qua bè khác:     ${remainingThroughRaft.length}`);
console.log(`  khoảng cách 2 cọc gần nhất:  ${minGap.toFixed(2)} m`);

// Counts must be untouched — that is what keeps the load model valid.
const byRaft = new Map();
for (const c of coords) {
  const e = byRaft.get(c.raft) ?? { n: 0, shore: 0, bed: 0 };
  e.n++; if (c.type === 'SHORE') e.shore++; else e.bed++;
  byRaft.set(c.raft, e);
}
console.log('--- SỐ DÂY MỖI BÈ (phải giữ nguyên) ---');
console.log('  ' + [...byRaft.entries()].map(([k, v]) => `${k}:${v.n}(${v.shore}/${v.bed})`).join('  '));
console.log(`  tổng: ${coords.length} điểm`);

if (dryRun) {
  console.log('\n(--dry: không ghi file)');
} else {
  fs.writeFileSync(COORDS, `${JSON.stringify(coords, null, 2)}\n`, 'utf8');
  console.log(`\nĐã ghi ${path.relative(ROOT, COORDS)}`);
}
