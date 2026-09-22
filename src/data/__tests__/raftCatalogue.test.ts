import { describe, it, expect } from 'vitest';
import { HUOI_VANH_RAFTS, MooringCoordinate } from '../huoiVanhProject';
import coordinates from '../huoiVanhCoordinates.json';
import polygons from '../huoiVanhRaftPolygons.json';

/**
 * The raft catalogue lives in three files that must agree: the design table
 * (`HUOI_VANH_RAFTS`), the surveyed anchor points (`huoiVanhCoordinates`) and
 * the CAD boundary polygons (`huoiVanhRaftPolygons`). They have drifted apart
 * before — a raft renumbering touched one and not the others — so the
 * contract between them is pinned here rather than left to review.
 *
 * The client's plan has exactly 12 clusters, BÈ 1 .. BÈ 12. There is no
 * "BÈ 13": drawing cluster 8 merges the two old survey groups 8 and 9.
 */
const EXPECTED = Array.from({ length: 12 }, (_, i) => `BÈ ${i + 1}`);
const coords = coordinates as MooringCoordinate[];

describe('Huổi Vanh raft catalogue — 12 clusters, BÈ 1..12', () => {
  it('the design table is exactly BÈ 1..BÈ 12', () => {
    expect(HUOI_VANH_RAFTS).toHaveLength(12);
    expect(HUOI_VANH_RAFTS.map((r) => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(HUOI_VANH_RAFTS.map((r) => r.name)).toEqual(EXPECTED);
  });

  it('the 299 surveyed anchor points cover the same 12 rafts', () => {
    expect(coords).toHaveLength(299);
    const names = [...new Set(coords.map((c) => c.raft))];
    expect(names.sort()).toEqual([...EXPECTED].sort());
  });

  it('every CAD polygon belongs to exactly one raft, and every raft has one', () => {
    expect(polygons).toHaveLength(12);
    const owned = (polygons as Array<{ rafts: string[] }>).flatMap((p) => p.rafts);
    expect(owned).toHaveLength(12);
    expect([...owned].sort()).toEqual([...EXPECTED].sort());
  });

  it('BÈ 8 carries both old survey groups: 28 lines = 16 shore + 12 bed', () => {
    const raft8 = HUOI_VANH_RAFTS.find((r) => r.id === 8)!;
    const pts = coords.filter((c) => c.raft === 'BÈ 8');
    expect(pts).toHaveLength(28);
    expect(pts.filter((c) => c.type === 'SHORE')).toHaveLength(16);
    expect(pts.filter((c) => c.type === 'BED')).toHaveLength(12);
    // The design table must quote the same counts as the survey for this raft.
    expect(raft8.cableCount).toBe(28);
    expect(raft8.shoreAnchors).toBe(16);
    expect(raft8.bedAnchors).toBe(12);
  });

  it('no data source mentions a BÈ 13 any more', () => {
    expect(HUOI_VANH_RAFTS.some((r) => r.name === 'BÈ 13')).toBe(false);
    expect(coords.some((c) => c.raft === 'BÈ 13')).toBe(false);
    expect((polygons as Array<{ rafts: string[] }>).some((p) => p.rafts.includes('BÈ 13'))).toBe(false);
  });

  it('each raft area matches its CAD polygon', () => {
    for (const poly of polygons as Array<{ rafts: string[]; area_m2: number }>) {
      const raft = HUOI_VANH_RAFTS.find((r) => r.name === poly.rafts[0])!;
      expect(raft, `no raft for polygon of ${poly.rafts[0]}`).toBeDefined();
      expect(raft.area_m2).toBe(poly.area_m2);
    }
  });
});

/**
 * Layout quality of the mooring plan. These are the defects the 2026-09-22
 * re-layout removed (26 bed piles sitting inside a raft footprint, 3 pairs of
 * exactly coincident piles, cables running through neighbouring rafts); the
 * invariants are pinned here so a future data edit cannot quietly bring them
 * back. Regenerate the data with `node scripts/repairMooringLayout.mjs`.
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

  it('no two piles are closer than 3 m (3 pairs used to be coincident)', () => {
    let worst = { d: Infinity, pair: '' };
    for (let i = 0; i < coords.length; i++)
      for (let j = i + 1; j < coords.length; j++) {
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
    // The old data had every bed anchor at 17.53–17.55 m from its cleat.
    expect(Math.max(...spans)).toBeGreaterThan(18);
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
