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
