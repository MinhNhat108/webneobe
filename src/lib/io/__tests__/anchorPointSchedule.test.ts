import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildAnchorPointSchedule } from '../anchorPointSchedule';
import { buildScrewBaseScheduleWorkbook } from '../screwBaseExcel';
import { calculateProject } from '../../calc';
import { buildRaftProjectState } from '../../calc/raftState';
import { designScrewBase, designScrewBaseForLines } from '../../calc/screwAnchorBed';
import type { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../../data/huoiVanhLayout';
import { groundAt, MNC_M, MNLKT_M } from '../../../components/simulation/sceneModel';

// These tests hold at any design wind: they pin the STRUCTURE of the anchor-by-anchor
// calculation (which geometry each point uses), not the sizes that follow from the wind.
const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const setup = () => {
  const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const batch = HUOI_VANH_RAFTS.map((raft) => {
    const st = buildRaftProjectState(state, raft, dflt().anchor);
    return { raft, state: st, results: calculateProject(st) };
  });
  return { state, results: calculateProject(state), batch };
};

describe('Anchor-by-anchor calculation', () => {
  const { state, results, batch } = setup();
  const s = buildAnchorPointSchedule(state, results, batch);

  it('has one row for each of the 263 anchor points: 231 shore piles and 32 lake-bed bases (all shared) holding the 295 lines', () => {
    expect([s.totals.points, s.shore.length, s.bed.length]).toEqual([263, 231, 32]);
    expect([s.totals.lines, s.totals.bedLines, s.totals.sharedBases, s.totals.convertedShorePoints]).toEqual([295, 64, 32, 102]);
    expect(new Set([...s.shore.map((p) => p.code), ...s.bed.flatMap((b) => b.base.lines.map((l) => l.code))]).size).toBe(295);
    expect(s.shore.filter((p) => p.converted).every((p) => p.note.includes('Chuyển từ neo đáy'))).toBe(true);
    expect(s.levels).toEqual({ mnc_m: 380, mndb_m: 384.5, mnlkt_m: 386 });
  });

  it('every lake-bed base is designed with the span of ITS line(s), standing on the DESIGN lake bed (always under water)', () => {
    for (const row of s.bed) {
      const b = row.base;
      expect(b.lines.length, b.baseId).toBe(b.shared ? 2 : 1);
      for (const l of b.lines) {
        const line = MOORING_LINES_V2.find((q) => q.code === l.code)!;
        // MNDB − design depth: the owner's basis, "neo đế vít xoắn luôn ở đáy hồ"
        expect([b.x, b.y, b.z], l.code).toEqual([line.xAnchor, line.yAnchor, line.zAnchor]);
        expect([l.span_m, l.azimuth_deg], l.code).toEqual([line.span, line.azimuth]);
        const raft = batch.find((x) => x.raft.name === l.raft)!;
        expect(l.tension_kN, l.code).toBe(raft.results.t_max_intact_kN); // the governing line tension of ITS raft
      }
      expect(b.z, b.baseId).toBeLessThan(MNC_M);
      expect(b.depthLow_m, b.baseId).toBeCloseTo(MNC_M - b.z, 9);
      expect(b.depthLow_m, b.baseId).toBeGreaterThanOrEqual(1.5); // under water even at the dead water level
      expect(b.depthHigh_m, b.baseId).toBeCloseTo(MNLKT_M - b.z, 9);
      expect(row.util, b.baseId).toBe(Math.max(b.upliftUtil, b.slideUtil, b.overturnUtil, b.screwUtil, b.bearingUtil, b.rebarUtil));
    }
  });

  it('a base under ONE line is exactly the base of the single-line design rule', () => {
    // every base of the layout is shared, so split the first two shared bases: their four lines get a base each
    expect(s.bed.filter((r) => !r.base.shared)).toHaveLength(0);
    const split = new Set(s.bed.slice(0, 2).flatMap((r) => r.base.lines.map((l) => l.code)));
    const lone = MOORING_LINES_V2.map((l) => (split.has(l.code) ? { ...l, anchorId: undefined, sharedWith: undefined } : l));
    const single = buildAnchorPointSchedule(state, results, batch, lone).bed.filter((r) => !r.base.shared);
    expect(single).toHaveLength(4);
    for (const row of single) {
      const b = row.base, l = b.lines[0];
      const raft = batch.find((x) => x.raft.name === l.raft)!;
      const again = designScrewBase({ tension_kN: l.tension_kN, span_m: l.span_m, depthLow_m: b.depthLow_m, depthHigh_m: b.depthHigh_m, cuSurface_kPa: raft.state.anchor.cuBed_kPa, cuAverage_kPa: raft.state.anchor.cuBed_kPa });
      expect([b.side_m, b.thickness_m, b.design.rebarDia_mm, b.design.rebarSpacing_m], b.baseId).toEqual([again.side_m, again.thickness_m, again.rebarDia_mm, again.rebarSpacing_m]);
      expect(b.upliftUtil, b.baseId).toBeCloseTo(again.upliftUtil, 9);
      expect(b.slideUtil, b.baseId).toBeCloseTo(again.slideUtil, 9);
      expect(b.overturnUtil, b.baseId).toBeCloseTo(again.overturnUtil, 9);
      expect(b.screwUtil, b.baseId).toBeCloseTo(again.screwUtil, 9);
      expect(b.combinations, b.baseId).toHaveLength(2); // the two water levels
    }
  });

  it('a SHARED base is checked for one line taut + the other at the pretension, and for both taut; uplifts add, horizontal pulls add as vectors', () => {
    const shared = s.bed.filter((r) => r.base.shared);
    expect(shared).toHaveLength(32);
    for (const row of shared) {
      const b = row.base, [l1, l2] = b.lines;
      expect(l1.raft, b.baseId).not.toBe(l2.raft);
      expect(b.combinations, b.baseId).toHaveLength(6); // 3 combinations x 2 water levels
      const both = b.combinations.find((c) => c.name.startsWith('cả hai dây căng') && c.level === 'high')!;
      const one = b.combinations.find((c) => c.name.startsWith(`${l1.code} căng`) && c.level === 'high')!;
      // hand calculation of the "both taut" combination at MNLKT
      const rise = b.depthHigh_m - b.thickness_m - b.design.params.padeyeHeight_m;
      const part = (l: typeof l1) => {
        const a = Math.atan(rise / l.span_m), az = (l.azimuth_deg * Math.PI) / 180;
        return { hx: -l.tension_kN * Math.cos(a) * Math.sin(az), hy: -l.tension_kN * Math.cos(a) * Math.cos(az), v: l.tension_kN * Math.sin(a) };
      };
      const p1 = part(l1), p2 = part(l2);
      expect(both.Tv_kN, b.baseId).toBeCloseTo(p1.v + p2.v, 9);
      expect(both.Th_kN, b.baseId).toBeCloseTo(Math.hypot(p1.hx + p2.hx, p1.hy + p2.hy), 9);
      // the two cables pull against each other: less horizontal force than the sum, more uplift than either alone
      expect(both.Th_kN, b.baseId).toBeLessThan(Math.hypot(p1.hx, p1.hy) + Math.hypot(p2.hx, p2.hy));
      expect(both.Tv_kN, b.baseId).toBeGreaterThan(one.Tv_kN);
      expect(b.combinations.map((c) => c.name), b.baseId).toContain(b.governing);
      // the reported utilisations are the worst over all six combinations
      expect(row.util, b.baseId).toBeGreaterThanOrEqual(Math.max(...b.combinations.map((c) => c.util)) - 1e-9);
      // never smaller than the base either line would need alone
      for (const l of b.lines) {
        const alone = designScrewBaseForLines({ lines: [{ label: l.code, tension_kN: l.tension_kN, span_m: l.span_m, azimuth_deg: l.azimuth_deg }], depthLow_m: b.depthLow_m, depthHigh_m: b.depthHigh_m, pretension_kN: 5, cuSurface_kPa: 20, cuAverage_kPa: 20 });
        expect(b.design.volume_m3, b.baseId).toBeGreaterThanOrEqual(alone.base.volume_m3 - 1e-9);
      }
    }
  });

  it('never reports a failing base as passing, and adds the bases up', () => {
    expect(s.totals.bedOk).toBe(s.bed.filter((b) => b.base.ok).length);
    for (const b of s.bed) expect(b.base.ok ? b.util <= 1 + 1e-9 : true, b.base.baseId).toBe(true);
    expect(s.totals.bedOk).toBe(32); // at the 20 m/s default every base passes
    expect(s.totals.basesBySide).toEqual({ '2.50': 11, '2.75': 19, '3.00': 1, '3.25': 1 });
    expect(Object.values(s.totals.basesBySide).reduce((a, n) => a + n, 0)).toBe(32);
    expect(s.totals.bedConcrete_m3).toBeCloseTo(s.bed.reduce((a, b) => a + b.base.concrete_m3, 0), 9);
  });

  it('a longer line at the same depth needs no bigger base (flatter cable, less uplift)', () => {
    const load = { tension_kN: 60, depthLow_m: 1.7, depthHigh_m: 7.7 };
    const short = designScrewBase({ ...load, span_m: 6 });
    const long = designScrewBase({ ...load, span_m: 20 });
    expect(long.volume_m3).toBeLessThanOrEqual(short.volume_m3);
  });

  it('reports, for information only, where the IFC terrain reads higher than the design lake bed', () => {
    for (const b of s.bed) {
      const terrain = groundAt(b.base.x, b.base.y);
      expect(b.terrain_m, b.base.baseId).toBe(terrain);
      if (terrain !== null) expect(b.terrainAboveBed_m!, b.base.baseId).toBeCloseTo(terrain - b.base.z, 9);
    }
    const higher = s.bed.filter((b) => (b.terrainAboveBed_m ?? 0) > 0.5);
    expect(s.totals.terrainHigherPoints).toBe(higher.length);
    expect(higher.length).toBeGreaterThan(0); // the terrain model does rise towards the banks
    for (const b of higher) expect(b.note).toContain('Địa hình IFC tại điểm này cao hơn đáy thiết kế');
    // and it never enters the calculation: the depths come from the design lake bed alone
    for (const b of higher) expect(b.base.depthLow_m, b.base.baseId).toBeCloseTo(MNC_M - b.base.z, 9);
  });

  it('every shore point repeats the pile checks of its raft and has its own cable slope', () => {
    for (const p of s.shore) {
      const raft = batch.find((x) => x.raft.name === p.raft)!;
      const check = (id: string) => raft.results.checks.find((c) => c.id === id)!.utilization;
      expect(p.bp1, p.code).toBe(check('BP-1'));
      expect(p.bp2, p.code).toBe(check('BP-2'));
      expect(p.pileTension_kN, p.code).toBeCloseTo(raft.results.shorePileTension_kN!, 1);
      const ground = groundAt(p.x, p.y)!;
      expect(p.ground_m, p.code).toBeCloseTo(ground, 9);
      // higher water lifts the raft: the cable points further up (or less far down) at MNLKT than at MNC
      expect(p.slopeHigh_deg!, p.code).toBeGreaterThan(p.slopeLow_deg!);
      expect(p.floodedAtHighWater, p.code).toBe(ground + 0.1 < MNLKT_M);
      expect(p.headUtil!, p.code).toBeGreaterThan(0);
    }
    expect(s.totals.floodedShoreHeads).toBe(s.shore.filter((p) => p.floodedAtHighWater).length);
  });

  it('the anchor workbook carries one row per point on the two per-point sheets', () => {
    const wb = buildScrewBaseScheduleWorkbook(state, results, batch);
    expect(wb.SheetNames).toEqual(['ThongKeCocBo', 'ThongKeDeNeoVit', 'DeTheoBe', 'TungDiemNeoDay', 'TungDiemNeoBo', 'ChieuDaiCatCap']);
    const bed = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.TungDiemNeoDay, { header: 1 });
    const shore = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.TungDiemNeoBo, { header: 1 });
    const bedRows = bed.filter((r) => /^HV-DV\d{3}$/.test(String(r[1])));
    expect(bedRows).toHaveLength(32);
    expect(bedRows.filter((r) => r[2] === 'DÙNG CHUNG')).toHaveLength(32);
    expect(bedRows.filter((r) => r[2] === 'DÙNG CHUNG').every((r) => /^B\w+-D\d+$/.test(String(r[7])))).toBe(true); // the second line is named
    const shoreRows = shore.filter((r) => /^HV-P\d{3}$/.test(String(r[1])));
    expect(shoreRows).toHaveLength(231);
    expect(shoreRows.filter((r) => r[4] === 'Chuyển từ neo đáy')).toHaveLength(102);
    const head = bed[5];
    for (const col of ['Tổ hợp chi phối', 'Lực nhổ (kN)', 'SV-1 nhổ', 'SV-2 trượt', 'SV-3 lật', 'SV-4 một vít', 'SV-5 nền', 'SV-6 thép bản', 'Cao độ đáy thiết kế (m)', 'Địa hình IFC (m)', 'Sâu nước MNC (m)', 'Sâu nước MNLKT (m)']) {
      expect(head, col).toContain(col);
    }
    expect(String(bed[1][0])).toContain(`V = ${state.env.windSpeed_ms} m/s`); // the wind the table was computed with is stated on it
  });
});
