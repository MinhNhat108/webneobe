import { describe, it, expect } from 'vitest';
import { HUOI_VANH_RAFTS, MooringCoordinate } from '../huoiVanhProject';
import { MOORING_LINES_V2, RAFT_POLYGONS_V2 } from '../huoiVanhLayout';
import piles from '../huoiVanhPiles_v2.json';

/**
 * The V2 raft catalogue lives in three places that must agree: the design
 * table (`HUOI_VANH_RAFTS`), the mooring network (`huoiVanhCoordinates_v2`)
 * and the raft outlines (`huoiVanhRaftPolygons_v2`). They have drifted apart
 * before — a raft renumbering touched one and not the others — so the
 * contract between them is pinned here rather than left to review.
 *
 * The plan of 2026-10-08 has exactly 9 clusters, 95.873 m² in total:
 * BÈ 1, 2, 3, 3A (old 4 + 5), 5A (old 6 + 7), 6, 7, 8 (old 10 + 11), 9.
 */
const EXPECTED = ['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 3A', 'BÈ 5A', 'BÈ 6', 'BÈ 7', 'BÈ 8', 'BÈ 9'];
const coords: MooringCoordinate[] = MOORING_LINES_V2;
const polygons = RAFT_POLYGONS_V2.map((p) => ({ ...p, rafts: [p.name] }));

describe('Huổi Vanh raft catalogue — 9 clusters', () => {
  it('the design table is exactly the 9 rafts of the plan, ids 1..9', () => {
    expect(HUOI_VANH_RAFTS).toHaveLength(9);
    expect(HUOI_VANH_RAFTS.map((r) => r.id)).toEqual(Array.from({ length: 9 }, (_, i) => i + 1));
    expect(HUOI_VANH_RAFTS.map((r) => r.name)).toEqual(EXPECTED);
  });

  it('the 292 mooring lines (231 shore, of which 102 converted from the lake bed; 61 bed) cover the same 9 rafts', () => {
    expect(coords).toHaveLength(292);
    expect(coords.filter((c) => c.type === 'SHORE')).toHaveLength(231);
    expect(coords.filter((c) => c.type === 'SHORE' && (c as any).converted)).toHaveLength(102);
    expect(coords.filter((c) => c.type === 'BED')).toHaveLength(61);
    expect(new Set(coords.map((c) => c.code)).size).toBe(292);
    const names = [...new Set(coords.map((c) => c.raft))];
    expect(names.sort()).toEqual([...EXPECTED].sort());
  });

  it('every outline belongs to exactly one raft, and every raft has one', () => {
    expect(polygons).toHaveLength(9);
    expect(polygons.map((p) => p.name).sort()).toEqual([...EXPECTED].sort());
    expect(polygons.reduce((s, p) => s + p.area_m2, 0)).toBe(95873);
  });

  it('each raft area and perimeter match its V2 outline', () => {
    for (const poly of polygons) {
      const raft = HUOI_VANH_RAFTS.find((r) => r.name === poly.name)!;
      expect(raft, `no raft for outline of ${poly.name}`).toBeDefined();
      expect(raft.area_m2).toBe(poly.area_m2);
      expect(raft.perimeter_m).toBe(poly.perimeter_m);
    }
  });

  it('the design table quotes exactly the line counts of the layout', () => {
    for (const raft of HUOI_VANH_RAFTS) {
      const pts = coords.filter((c) => c.raft === raft.name);
      expect(raft.cableCount, raft.name).toBe(pts.length);
      expect(raft.shoreAnchors, raft.name).toBe(pts.filter((c) => c.type === 'SHORE').length);
      expect(raft.bedAnchors, raft.name).toBe(pts.filter((c) => c.type === 'BED').length);
    }
  });

  it('C9 holds on all 9 rafts: s_avg = P / N <= 15 m', () => {
    const over = HUOI_VANH_RAFTS
      .map((r) => ({ n: r.name, s: r.perimeter_m / r.cableCount }))
      .filter((x) => x.s > 15.0);
    expect(over.map((x) => `${x.n}: ${x.s.toFixed(2)} m`)).toEqual([]);
  });

  it('the bed cable span fed to the engine is the shortest bed line of the raft', () => {
    for (const raft of HUOI_VANH_RAFTS) {
      const shortest = Math.min(...coords.filter((c) => c.raft === raft.name && c.type === 'BED').map((c) => c.span));
      expect(raft.bedAnchorDist_m, raft.name).toBeLessThanOrEqual(shortest);
      expect(shortest - raft.bedAnchorDist_m, raft.name).toBeLessThan(0.1);
    }
  });

  it('the anchor file is derived from the lines: one row per anchor POINT (231 shore piles + 32 lake-bed bases, 29 of them shared by two lines)', () => {
    const list = piles as Array<{ code: string; line: string; lines: string[]; rafts: string[]; type: string; shape: string; x: number; y: number }>;
    expect(list).toHaveLength(263);
    expect(new Set(list.map((p) => p.code)).size).toBe(263);
    expect([list.filter((p) => p.type === 'SHORE').length, list.filter((p) => p.type === 'BED').length]).toEqual([231, 32]);
    expect(list.filter((p) => p.lines.length === 2)).toHaveLength(29);
    // every line is tied to exactly one anchor
    expect(list.flatMap((p) => p.lines).sort()).toEqual(coords.map((c) => c.code).sort());
    for (const p of list) {
      expect(p.shape, p.code).toBe(p.type === 'SHORE' ? 'circular' : 'square');
      expect(p.line, p.code).toBe(p.lines[0]);
      expect(p.lines.length, p.code).toBeLessThanOrEqual(p.type === 'SHORE' ? 1 : 2);
      for (const code of p.lines) {
        const line = coords.find((c) => c.code === code)!;
        expect(line, p.code).toBeDefined();
        expect(p.type).toBe(line.type);
        expect(p.x).toBe(line.xAnchor);
        expect(p.y).toBe(line.yAnchor);
      }
      // a shared base holds one line of each of two DIFFERENT rafts
      if (p.lines.length === 2) expect(new Set(p.rafts).size, p.code).toBe(2);
    }
  });

  it('owner rule of 2026-10-08: a shared base ties two FACING lines, each naming the other; a converted shore pile stands on ground at or above 384.0 m within 60 m', () => {
    const shared = coords.filter((c) => (c as any).sharedWith) as any[];
    expect(shared).toHaveLength(58);
    for (const c of shared) {
      const o = coords.find((q) => q.code === c.sharedWith) as any;
      expect(o, c.code).toBeDefined();
      expect(o.sharedWith, c.code).toBe(c.code);
      expect(o.raft, c.code).not.toBe(c.raft);
      expect([o.anchorId, o.xAnchor, o.yAnchor, o.zAnchor], c.code).toEqual([c.anchorId, c.xAnchor, c.yAnchor, c.zAnchor]);
      // the two cables leave the base in roughly opposite directions
      const turn = Math.abs(((c.azimuth - o.azimuth + 540) % 360) - 180);
      expect(turn, c.code).toBeGreaterThan(90);
    }
    for (const c of coords.filter((q) => (q as any).converted)) {
      expect(c.type, c.code).toBe('SHORE');
      expect(c.zAnchor, c.code).toBeGreaterThanOrEqual(384.0);
      expect(c.span, c.code).toBeLessThanOrEqual(60);
    }
    // every lake-bed line carries the id of its base
    expect(coords.filter((c) => c.type === 'BED').every((c) => /^DV-\d{3}$/.test((c as any).anchorId))).toBe(true);
  });

  it('the panels of the plan (18.354) are shared between the rafts by area', () => {
    expect(HUOI_VANH_RAFTS.reduce((s, r) => s + (r.solarPanelCount ?? 0), 0)).toBe(18354);
    for (const r of HUOI_VANH_RAFTS) {
      expect(Math.abs((r.solarPanelCount ?? 0) - (18354 * r.area_m2) / 95873), r.name).toBeLessThan(1);
    }
  });

  it('every raft of the design table has its piles sized per raft', () => {
    for (const raft of HUOI_VANH_RAFTS) {
      expect(raft.shorePileD_m, raft.name).toBeGreaterThan(0);
      expect(raft.bedPileD_m, raft.name).toBeGreaterThan(0);
      expect(raft.shorePileL_m, raft.name).toBeGreaterThan(0);
      expect(raft.bedPileL_m, raft.name).toBeGreaterThan(0);
    }
  });
});

/**
 * Layout quality of the mooring plan. These are the defects the 2026-09-22
 * re-layout removed (26 bed piles sitting inside a raft footprint, 3 pairs of
 * exactly coincident piles, cables running through neighbouring rafts); the
 * invariants are pinned here so a future data edit cannot quietly bring them
 * back. Regenerate the data with `node scripts/planMooringLayoutV2.mjs`.
 */
describe('Mooring layout is buildable', () => {
  const ring = (name: string) =>
    (polygons as Array<{ rafts: string[]; points: Array<{ x: number; y: number }> }>)
      .find((p) => p.rafts.includes(name))!.points;
  const inside = (p: { x: number; y: number }, r: Array<{ x: number; y: number }>) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], b = r[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const cross3 = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const segInt = (p1: any, p2: any, p3: any, p4: any) => {
    const d1 = cross3(p3, p4, p1), d2 = cross3(p3, p4, p2);
    const d3 = cross3(p1, p2, p3), d4 = cross3(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const cleat = (c: MooringCoordinate) => ({ x: c.xRaft, y: c.yRaft });
  const anchor = (c: MooringCoordinate) => ({ x: c.xAnchor, y: c.yAnchor });

  it('no anchor pile sits inside a raft footprint', () => {
    const offenders = coords.filter((c) =>
      (polygons as Array<{ points: any[] }>).some((p) => inside(anchor(c), p.points)));
    expect(offenders.map((c) => c.code)).toEqual([]);
  });

  it('two different lake-bed bases are at least 7 m apart, so two screw-pile bases never overlap', () => {
    // one point per base: the two lines of a shared base end on the same point
    const bed = coords.filter((c) => c.type === 'BED').filter((c, i, a) => a.findIndex((q) => (q as any).anchorId === (c as any).anchorId) === i);
    expect(bed).toHaveLength(32);
    let worst = { d: Infinity, pair: '' };
    for (let i = 0; i < bed.length; i++)
      for (let j = i + 1; j < bed.length; j++) {
        const d = Math.hypot(bed[i].xAnchor - bed[j].xAnchor, bed[i].yAnchor - bed[j].yAnchor);
        if (d < worst.d) worst = { d, pair: `${bed[i].code}~${bed[j].code}` };
      }
    expect(worst.d, `cặp gần nhất: ${worst.pair}`).toBeGreaterThanOrEqual(6.99);
  });

  it('no two anchor points are closer than 3 m (the two lines of a shared base are one point)', () => {
    let worst = { d: Infinity, pair: '' };
    for (let i = 0; i < coords.length; i++)
      for (let j = i + 1; j < coords.length; j++) {
        if ((coords[i] as any).anchorId && (coords[i] as any).anchorId === (coords[j] as any).anchorId) continue;
        const d = Math.hypot(coords[i].xAnchor - coords[j].xAnchor, coords[i].yAnchor - coords[j].yAnchor);
        if (d < worst.d) worst = { d, pair: `${coords[i].code}~${coords[j].code}` };
      }
    expect(worst.d, `cặp gần nhất: ${worst.pair}`).toBeGreaterThanOrEqual(2.99);
  });

  it('no mooring line passes through another raft', () => {
    const offenders = coords.filter((c) =>
      (polygons as Array<{ rafts: string[]; points: any[] }>)
        .filter((p) => !p.rafts.includes(c.raft))
        .some((p) => p.points.some((q: any, i: number) => segInt(cleat(c), anchor(c), q, p.points[(i + 1) % p.points.length]))));
    expect(offenders.map((c) => c.code)).toEqual([]);
  });

  it('no two mooring lines cross each other', () => {
    const crossing: string[] = [];
    for (let i = 0; i < coords.length; i++)
      for (let j = i + 1; j < coords.length; j++)
        if (segInt(cleat(coords[i]), anchor(coords[i]), cleat(coords[j]), anchor(coords[j])))
          crossing.push(`${coords[i].code}×${coords[j].code}`);
    expect(crossing).toEqual([]);
  });

  it('bed anchors stand off the pontoon instead of hugging a fixed radius', () => {
    const bed = coords.filter((c) => c.type === 'BED');
    const spans = bed.map((c) => c.span);
    // A formula-generated layout collapses to one span; a planned one varies.
    expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThan(5);
    for (const c of bed) {
      const d = Math.min(...ring(c.raft).map((q, i) => {
        const b = ring(c.raft)[(i + 1) % ring(c.raft).length];
        const dx = b.x - q.x, dy = b.y - q.y;
        const t = Math.max(0, Math.min(1, ((c.xAnchor - q.x) * dx + (c.yAnchor - q.y) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(c.xAnchor - (q.x + t * dx), c.yAnchor - (q.y + t * dy));
      }));
      expect(d, `${c.code} quá sát mép bè`).toBeGreaterThanOrEqual(4.9);
    }
  });

  it('every record keeps span and azimuth consistent with its coordinates', () => {
    for (const c of coords) {
      const d = Math.hypot(c.xAnchor - c.xRaft, c.yAnchor - c.yRaft);
      expect(Math.abs(d - c.span), `${c.code} span`).toBeLessThan(0.05);
      let az = (Math.atan2(c.xAnchor - c.xRaft, c.yAnchor - c.yRaft) * 180) / Math.PI;
      if (az < 0) az += 360;
      let e = Math.abs(az - c.azimuth);
      if (e > 180) e = 360 - e;
      expect(e, `${c.code} azimuth`).toBeLessThan(0.3);
    }
  });
});

/**
 * Restraint balance. The first re-layout used a fixed 17.5 m standoff and
 * demanded 5 m clearance to every raft, which silently rejected every channel
 * narrower than 22.5 m — and 8 raft pairs here are closer than that. Their
 * facing sides lost all their bed piles, so the anchors bunched on the outer
 * sides and left arcs of up to 128° unrestrained. Bed piles now stand on the
 * channel mid-line, and these tests keep them there.
 */
describe('Rafts are restrained on every side', () => {
  const ringOf = (name: string) =>
    (polygons as Array<{ rafts: string[]; points: Array<{ x: number; y: number }> }>)
      .find((p) => p.rafts.includes(name))!.points;
  const distSeg = (p: any, a: any, b: any) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  const toRing = (p: any, r: any[]) => Math.min(...r.map((q, i) => distSeg(p, q, r[(i + 1) % r.length])));
  const names = (polygons as Array<{ rafts: string[] }>).map((p) => p.rafts[0]);

  /** Widest arc around a raft with no mooring line at all, degrees. */
  const widestUnanchoredArc = (name: string) => {
    const ring = ringOf(name);
    const cx = ring.reduce((s, q) => s + q.x, 0) / ring.length;
    const cy = ring.reduce((s, q) => s + q.y, 0) / ring.length;
    const ang = coords.filter((c) => c.raft === name)
      .map((c) => (Math.atan2(c.yAnchor - cy, c.xAnchor - cx) * 180) / Math.PI)
      .sort((a, b) => a - b);
    let worst = 0;
    for (let i = 0; i < ang.length; i++) {
      const gap = i === ang.length - 1 ? 360 + ang[0] - ang[i] : ang[i + 1] - ang[i];
      worst = Math.max(worst, gap);
    }
    return worst;
  };

  it('no raft has a mooring gap wider than 60°', () => {
    const bad = names
      .map((n) => ({ n, gap: widestUnanchoredArc(n) }))
      .filter((x) => x.gap > 60);
    expect(bad.map((x) => `${x.n}:${x.gap.toFixed(0)}°`)).toEqual([]);
  });

  it('every narrow channel between two rafts carries bed piles', () => {
    const pairs: Array<[string, string, number]> = [];
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const ra = ringOf(names[i]), rb = ringOf(names[j]);
        const d = Math.min(
          ...ra.map((p) => toRing(p, rb)),
          ...rb.map((p) => toRing(p, ra))
        );
        if (d < 22.5) pairs.push([names[i], names[j], d]);
      }
    // The 9-raft outlines leave 5 channels narrower than 22.5 m: 1–2, 2–3, 3–3A, 7–8? (22.6, not counted) and 8–9.
    expect(pairs.length).toBeGreaterThanOrEqual(4);

    const starved = pairs.filter(([a, b]) => {
      const ra = ringOf(a), rb = ringOf(b);
      const inChannel = coords.filter((c) =>
        (c.raft === a || c.raft === b) && c.type === 'BED' &&
        toRing({ x: c.xAnchor, y: c.yAnchor }, ra) < 25 &&
        toRing({ x: c.xAnchor, y: c.yAnchor }, rb) < 25);
      return inChannel.length === 0;
    });
    expect(starved.map(([a, b, d]) => `${a}↔${b} (${d.toFixed(1)}m)`)).toEqual([]);
  });

  it.each(['BÈ 3A', 'BÈ 5A', 'BÈ 8'])('%s (a merged raft) has no stretch of edge longer than 15 m without a cleat', (raftName) => {
    // C9 only bounds the AVERAGE spacing. Before the 2026-09-27 re-plan the
    // 150 m east edge of the old BÈ 5 carried 3 lines and a 75 m open stretch.
    const ring = ringOf(raftName);
    const station = (p: { x: number; y: number }) => {
      let s = 0;
      let best = { d: Infinity, t: 0 };
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        const u = Math.max(0, Math.min(L, (p.x - a.x) * ux + (p.y - a.y) * uy));
        const d = Math.hypot(p.x - a.x - ux * u, p.y - a.y - uy * u);
        if (d < best.d) best = { d, t: s + u };
        s += L;
      }
      return { ...best, total: s };
    };
    const pts = coords.filter((c) => c.raft === raftName).map((c) => station({ x: c.xRaft, y: c.yRaft }));
    for (const p of pts) expect(p.d).toBeLessThan(0.05); // every cleat on the edge
    const ts = pts.map((p) => p.t).sort((a, b) => a - b);
    const total = pts[0].total;
    const gaps = ts.map((t, i) => (i === ts.length - 1 ? total - t + ts[0] : ts[i + 1] - t));
    expect(Math.max(...gaps)).toBeLessThanOrEqual(15.0 + 1e-6);
  });

  it('a mid-channel pile still keeps its clearance from both rafts', () => {
    for (const c of coords.filter((x) => x.type === 'BED')) {
      const clearances = (polygons as Array<{ points: any[] }>)
        .map((p) => toRing({ x: c.xAnchor, y: c.yAnchor }, p.points));
      expect(Math.min(...clearances), `${c.code} quá sát một bè`).toBeGreaterThanOrEqual(4.9);
    }
  });
});
