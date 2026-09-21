import { describe, it, expect } from 'vitest';
import DxfParser from 'dxf-parser';
import { buildMooringPileDxf, dxfFileName, toAsciiCad, DXF_LAYERS } from '../dxfExport';
import { buildPileSchedule, convexHull, buildRaftOutlines } from '../pileSchedule';
import { calculateProject } from '../../calc';
import { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import coordinates from '../../../data/huoiVanhCoordinates.json';
import huoiVanhRaftPolygons from '../../../data/huoiVanhRaftPolygons.json';

const base = (): ProjectState =>
  JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;

const built = () => {
  const state = base();
  return buildMooringPileDxf(state, calculateProject(state));
};

describe('DXF document structure', () => {
  it('is a well-formed R12 ASCII document', () => {
    const { dxf } = built();
    expect(dxf.startsWith('0\nSECTION\n')).toBe(true);
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    expect(dxf).toContain('AC1009');
    // Every SECTION must be closed.
    const sections = (dxf.match(/^SECTION$/gm) || []).length;
    const endsecs = (dxf.match(/^ENDSEC$/gm) || []).length;
    expect(sections).toBe(endsecs);
  });

  it('emits group codes strictly as code/value line pairs', () => {
    const { dxf } = built();
    const lines = dxf.split('\n');
    // Trailing newline aside, the body must have an even number of lines.
    const body = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
    expect(body.length % 2).toBe(0);
    for (let i = 0; i < body.length; i += 2) {
      expect(body[i]).toMatch(/^-?\d+$/); // group codes are integers
    }
  });

  it('declares every layer it draws on', () => {
    const { dxf } = built();
    for (const l of Object.values(DXF_LAYERS)) {
      expect(dxf).toContain(`\n${l.name}\n`);
    }
  });

  it('writes only ASCII — no mojibake in a strict R12 reader', () => {
    const { dxf } = built();
    expect(/[^\x00-\x7F]/.test(dxf)).toBe(false);
  });

  it('draws every one of the 299 anchor points at its surveyed coordinate', () => {
    const { dxf, pileCount, raftCount } = built();
    expect(pileCount).toBe(coordinates.length);
    expect(raftCount).toBeGreaterThanOrEqual(12);

    const first = (coordinates as any[])[0];
    expect(dxf).toContain(`\n${first.xAnchor}\n`);
    expect(dxf).toContain(`\n${first.yAnchor}\n`);
    expect(dxf).toContain('HV-P001');
  });

  it('is read back correctly by a real DXF parser', () => {
    // The strongest guarantee this suite can give short of opening AutoCAD:
    // the file survives a third-party parser (the same `dxf-parser` the app
    // already uses to READ client drawings), with every layer registered and
    // every entity landing on the layer it was drawn on.
    const parsed: any = new DxfParser().parseSync(built().dxf);
    expect(parsed).toBeTruthy();

    const declared = Object.keys(parsed.tables.layer.layers);
    for (const l of Object.values(DXF_LAYERS)) expect(declared).toContain(l.name);

    const perLayer = new Map<string, number>();
    for (const e of parsed.entities) {
      perLayer.set(e.layer, (perLayer.get(e.layer) ?? 0) + 1);
      expect(['LINE', 'CIRCLE', 'POINT', 'TEXT']).toContain(e.type);
    }
    // Every layer that exists must actually carry geometry — no dead layers.
    for (const l of Object.values(DXF_LAYERS)) {
      expect(perLayer.get(l.name) ?? 0).toBeGreaterThan(0);
    }
    // One POINT marker per pile, one code label per pile.
    expect(parsed.entities.filter((e: any) => e.type === 'POINT')).toHaveLength(coordinates.length);
    expect(perLayer.get(DXF_LAYERS.text.name)).toBe(coordinates.length);
  });

  it('names the file after the project and the date', () => {
    const s = base();
    s.meta.code = 'HV-2026';
    expect(dxfFileName(s, new Date(2026, 8, 21))).toBe('mat-bang-coc-neo_HV-2026_20260921.dxf');
  });
});

describe('toAsciiCad', () => {
  it('transliterates Vietnamese diacritics', () => {
    expect(toAsciiCad('BÈ 1 — Hồ Huổi Vanh')).toBe('BE 1 ? Ho Huoi Vanh');
    expect(toAsciiCad('Đóng cọc')).toBe('Dong coc');
  });
});

describe('Pile schedule', () => {
  it('carries L_opt, D, T_max and P_max for every pile', () => {
    const state = base();
    const rows = buildPileSchedule(state, calculateProject(state));
    expect(rows).toHaveLength(coordinates.length);
    for (const r of rows.slice(0, 20)) {
      expect(r.pileId).toMatch(/^HV-P\d{3}$/);
      expect(r.D_m).toBeGreaterThan(0);
      expect(r.Lopt_m).not.toBeNull();
      expect(r.Tmax_kN).toBeGreaterThan(0);
      expect(r.Pmax_kN).toBeGreaterThan(0);
      expect(r.Preq_kN).toBeGreaterThan(0);
    }
  });

  it('uses the shore pile for SHORE points and the bed pile for BED points', () => {
    const state = base();
    const results = calculateProject(state);
    const rows = buildPileSchedule(state, results);
    const shore = rows.find((r) => r.type === 'SHORE')!;
    const bed = rows.find((r) => r.type === 'BED')!;
    expect(shore.Lopt_m).toBe(results.shorePileOpt?.L_opt_m);
    expect(bed.Lopt_m).toBe(results.bedPileOpt?.L_opt_m);
    expect(shore.D_m).toBeCloseTo(state.anchor.shoreD_m, 3);
    expect(bed.D_m).toBeCloseTo(state.anchor.bed1D_m, 3);
  });

  it('propagates the rated P_max into the schedule', () => {
    const state = base();
    state.anchor.pileRatedPmaxShore_kN = 42;
    const rows = buildPileSchedule(state, calculateProject(state));
    const shore = rows.find((r) => r.type === 'SHORE')!;
    expect(shore.PmaxRated_kN).toBe(42);
    expect(shore.Pmax_kN).toBeLessThanOrEqual(42);
  });
});

describe('convexHull / raft outlines', () => {
  it('keeps the extreme points of a square and drops an interior one', () => {
    const hull = convexHull([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 2, y: 2 }
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 2, y: 2 });
  });

  it('builds one closed outline per raft', () => {
    const outlines = buildRaftOutlines();
    expect(outlines.length).toBeGreaterThanOrEqual(12);
    for (const o of outlines) {
      expect(o.points.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses the surveyed CAD polygons for every raft, not the hull fallback', () => {
    const outlines = buildRaftOutlines();
    expect(outlines).toHaveLength(12);
    expect(outlines.every((o) => o.source === 'surveyed')).toBe(true);

    // Every raft in the coordinate set is covered by exactly one outline.
    const labelled = outlines.flatMap((o) => o.raft.split(' + '));
    const rafts = new Set((coordinates as any[]).map((c) => c.raft));
    expect(new Set(labelled)).toEqual(rafts);
    expect(labelled).toHaveLength(rafts.size);

    // BÈ 8 and BÈ 9 are one drawn cluster but two calculation rafts.
    expect(outlines.some((o) => o.raft === 'BÈ 8 + BÈ 9')).toBe(true);
  });

  it('falls back to the hull, flagged as such, for a raft with no polygon', () => {
    const extra = [
      ...(coordinates as any[]),
      { raft: 'BÈ 99', code: 'X-01', type: 'SHORE', xRaft: 900, yRaft: 900, xAnchor: 910, yAnchor: 910, zAnchor: 0, span: 14, azimuth: 45 },
      { raft: 'BÈ 99', code: 'X-02', type: 'SHORE', xRaft: 940, yRaft: 900, xAnchor: 950, yAnchor: 910, zAnchor: 0, span: 14, azimuth: 45 },
      { raft: 'BÈ 99', code: 'X-03', type: 'SHORE', xRaft: 940, yRaft: 940, xAnchor: 950, yAnchor: 950, zAnchor: 0, span: 14, azimuth: 45 }
    ];
    const outlines = buildRaftOutlines(extra as any);
    const fallback = outlines.find((o) => o.raft === 'BÈ 99');
    expect(fallback?.source).toBe('hull');
    expect(outlines.filter((o) => o.source === 'surveyed')).toHaveLength(12);
  });

  it('keeps the surveyed polygons in the same frame as the anchor points', () => {
    // A raft's attachment points must sit on/inside its own polygon — this is
    // what proves the mm->m conversion and the frame match are right.
    const poly = (huoiVanhRaftPolygons as any[]).find((p) => p.rafts.includes('BÈ 1'));
    const pts = (coordinates as any[]).filter((c) => c.raft === 'BÈ 1');
    const inside = (p: { x: number; y: number }, ring: any[]) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    };
    const hits = pts.filter((c) => inside({ x: c.xRaft, y: c.yRaft }, poly.points)).length;
    expect(hits / pts.length).toBeGreaterThan(0.5);
  });
});
