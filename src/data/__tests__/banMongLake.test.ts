/**
 * Hồ Bản Mòng, end to end: the browser has the Bản Mòng tab selected
 * (`mooring_active_lake` = 'ban-mong' in localStorage) BEFORE any module is
 * loaded, so every data module of this file is the Bản Mòng one. The other
 * test files run with no storage, i.e. Huổi Vanh.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const store = new Map<string, string>([['mooring_active_lake', 'ban-mong']]);
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as Storage;
});

import { ACTIVE_LAKE_ID, ACTIVE_LAKE, LAKES } from '../lakes';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, BAN_MONG_PROJECT } from '../huoiVanhProject';
import { MOORING_LINES_V2, RAFT_POLYGONS_V2, LAYOUT_COUNTS, bedAnchorsOf } from '../huoiVanhLayout';
import { lakeCaveats, raftsAgroundAtMnc, linesOnSlope } from '../lakeCaveats';
import { LAKES as SCRIPT_LAKES } from '../../../scripts/lakeConfig.mjs';
import { calculateProject } from '../../lib/calc';
import { buildRaftProjectState } from '../../lib/calc/raftState';
import type { ProjectState } from '../../lib/calc/types';
import { buildAnchorPointSchedule } from '../../lib/io/anchorPointSchedule';
import { buildCableCuttingSchedule } from '../../lib/io/cableCuttingSchedule';
import { findBaseClashes } from '../../lib/io/screwBaseSchedule';
import { buildFinalDesign } from '../../lib/io/finalDesignWorkbook';
import { buildMooringScrewBaseDxf } from '../../lib/io/screwBaseDxf';
import {
  MNC_M, MNDB_M, MNLKT_M, IFC_DATUM_OFFSET_M, groundAt, RAFT_MODELS, buildPileModels, buildCableModels
} from '../../components/simulation/sceneModel';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const setup = () => {
  const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const batch = HUOI_VANH_RAFTS.map((raft) => {
    const st = buildRaftProjectState(state, raft, dflt().anchor);
    return { raft, state: st, results: calculateProject(st) };
  });
  return { state, results: calculateProject(state), batch };
};

describe('Hồ Bản Mòng tab', () => {
  it('loads the Bản Mòng project, levels and datum', () => {
    expect(ACTIVE_LAKE_ID).toBe('ban-mong');
    expect(HUOI_VANH_DEFAULT_PROJECT).toBe(BAN_MONG_PROJECT);
    expect(HUOI_VANH_DEFAULT_PROJECT.id).toBe('ban-mong-fpv');
    expect([MNC_M, MNDB_M, MNLKT_M]).toEqual([649.5, 662.76, 669.05]);
    // CHUGIAP.ifc is in absolute elevations: its water slab (666.65 m) is not a reservoir level
    expect(IFC_DATUM_OFFSET_M).toBe(0);
    // documents: only Bản Mòng files, never a Huổi Vanh one
    const docs = HUOI_VANH_DEFAULT_PROJECT.attachments ?? [];
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      expect(d.remoteUrl, d.name).toMatch(/^docs_ban_mong\/HOBANMONG_/);
      expect(d.name, d.name).not.toMatch(/HUOI ?VANH|HUỔI VANH/i);
    }
    expect([HUOI_VANH_DEFAULT_PROJECT.env.mndbt_m, HUOI_VANH_DEFAULT_PROJECT.env.mncn_m]).toEqual([MNDB_M, MNLKT_M]);
  });

  it('the app and the data scripts use the same levels for both lakes', () => {
    for (const id of Object.keys(LAKES) as Array<keyof typeof LAKES>) {
      expect(SCRIPT_LAKES[id].mndb, id).toBe(LAKES[id].levels.mndb_m);
    }
  });

  it('8 rafts of the plan 22/10/2026, 93 178 m², the panels of each raft from the drawing (18 240)', () => {
    expect(HUOI_VANH_RAFTS.map((r) => r.name)).toEqual(['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 4', 'BÈ 5', 'BÈ 6', 'BÈ 7', 'BÈ 8']);
    expect(RAFT_POLYGONS_V2.reduce((s, p) => s + p.area_m2, 0)).toBe(93178);
    // tables "THỐNG KÊ TẤM PIN MẶT TRỜI" of CT-BP-01…08
    expect(HUOI_VANH_RAFTS.map((r) => r.solarPanelCount)).toEqual([2352, 2380, 3136, 2252, 784, 1568, 2884, 2884]);
    // vs the PA2 plan of 19/10 only BÈ 4 (notch filled in) and BÈ 6 (shortened) changed
    expect(RAFT_POLYGONS_V2.map((p) => p.area_m2)).toEqual([12085, 12028, 16289, 11697, 4146, 8103, 14962, 13868]);
    // design depth = MNDB - median IFC ground under the raft
    for (const r of HUOI_VANH_RAFTS) {
      const p = RAFT_POLYGONS_V2.find((q) => q.name === r.name)!;
      expect(r.waterDepth_m, r.name).toBeCloseTo(MNDB_M - p.designBed_m!, 1);
    }
  });

  it('mooring layout: C9 on every raft, every line on its raft edge, shore piles on the bank, bases in the water', () => {
    expect(LAYOUT_COUNTS.lines).toBe(MOORING_LINES_V2.length);
    for (const r of HUOI_VANH_RAFTS) {
      const own = MOORING_LINES_V2.filter((l) => l.raft === r.name);
      expect(own.length, r.name).toBe(r.cableCount);
      expect(r.perimeter_m / own.length, r.name).toBeLessThanOrEqual(15);
    }
    for (const l of MOORING_LINES_V2.filter((q) => q.type === 'SHORE')) {
      expect(groundAt(l.xAnchor, l.yAnchor)!, l.code).toBeGreaterThanOrEqual(MNDB_M - 0.5 - 1e-6);
      expect(l.span, l.code).toBeLessThanOrEqual(60);
    }
    // a base stands on the IFC ground at its own point, under water at MNDB (scripts/lakeConfig.mjs, bedOnTerrain)
    for (const b of bedAnchorsOf()) {
      expect(b.z, b.id).toBeCloseTo(groundAt(b.x, b.y)!, 1);
      expect(b.z, b.id).toBeLessThanOrEqual(MNDB_M - 0.5);
      expect(b.lines.length, b.id).toBe(b.shared ? 2 : 1);
    }
  });

  it('every raft passes at the 20 m/s default (screw-base option)', () => {
    const { batch } = setup();
    expect(HUOI_VANH_DEFAULT_PROJECT.env.windSpeed_ms).toBe(20);
    for (const b of batch) expect(b.results.overallVerdict, b.raft.name).toBe('PASS');
  });

  it('deep water: the line tension comes from the equilibrium of each raft on its real lines, with the lines compensated', () => {
    const { batch } = setup();
    const line = dflt().line;
    expect([line.levelCompensation, line.adjustStep_m]).toEqual(['seasonal', 0]);
    for (const b of batch) {
      const a = b.results.mooringAnalysis!;
      expect(a, b.raft.name).toBeDefined();
      expect(b.results.t_max_intact_kN, b.raft.name).toBeGreaterThanOrEqual(a.governing.maxTension_kN);
      // every level from the floating level to MNLKT, MNDB and MNLKT included
      const lv = a.levels.map((l) => l.level_m);
      expect(lv, b.raft.name).toEqual(expect.arrayContaining([MNDB_M, MNLKT_M]));
      expect(b.results.checks.find((c) => c.id === 'C12')?.status, b.raft.name).toBe('PASS');
      // every case reached equilibrium; the damaged system (any level's most loaded line lost) is in the cable check
      expect(a.unconverged, b.raft.name).toBe(0);
      expect(b.results.t_max_damaged_kN, b.raft.name).toBeGreaterThanOrEqual(a.damaged.maxTension_kN);
      // the single-angle tension of Huổi Vanh would be unsafe here
      expect(b.results.t_max_intact_kN, b.raft.name).toBeGreaterThan(b.results.t_geometric_kN);
    }
  });

  it('fixed-cut cables do not work in this lake: some raft fails', () => {
    const { batch } = setup();
    const fails = batch.filter((b) => calculateProject({ ...b.state, line: { ...b.state.line, levelCompensation: 'fixed' } }).overallVerdict !== 'PASS');
    expect(fails.length).toBeGreaterThan(0);
  });

  it('every lake-bed base is designed for the largest tension of ITS line(s), never more than the raft tension', () => {
    const { state, results, batch } = setup();
    const s = buildAnchorPointSchedule(state, results, batch);
    for (const row of s.bed) for (const l of row.base.lines) {
      const raft = batch.find((x) => x.raft.name === l.raft)!;
      const own = raft.results.mooringAnalysis!.lineMax_kN[l.code];
      expect(l.tension_kN, l.code).toBeCloseTo(Math.min(raft.results.t_max_intact_kN, own + (raft.state.line.pretension_kN ?? 0)), 6);
    }
  });

  it('the anchor schedule, the cable cutting list, the workbook and the drawing build on the Bản Mòng layout', () => {
    const { state, results, batch } = setup();
    const s = buildAnchorPointSchedule(state, results, batch);
    expect([s.totals.points, s.totals.lines]).toEqual([LAYOUT_COUNTS.anchorPoints, LAYOUT_COUNTS.lines]);
    expect(s.levels).toEqual({ mnc_m: 649.5, mndb_m: 662.76, mnlkt_m: 669.05 });
    expect(s.bed.every((r) => r.base.design.ok)).toBe(true);
    expect(findBaseClashes(s.bed.map((r) => r.base))).toEqual([]);
    const cut = buildCableCuttingSchedule(state);
    expect(cut.rows).toHaveLength(LAYOUT_COUNTS.lines);
    const d = buildFinalDesign(state, results, batch);
    expect(d.rafts).toHaveLength(8);
    const dxf = buildMooringScrewBaseDxf(state, results, batch);
    expect([dxf.baseCount, dxf.raftCount]).toEqual([LAYOUT_COUNTS.bedBases, 8]);
    expect(dxf.schedule.bases[0].baseId).toBe('BM-DV001');
  });

  it('the 3D scene places every anchor on the IFC terrain', () => {
    expect(RAFT_MODELS).toHaveLength(8);
    const piles = buildPileModels();
    expect(piles).toHaveLength(LAYOUT_COUNTS.anchorPoints);
    expect(buildCableModels(piles)).toHaveLength(LAYOUT_COUNTS.lines);
  });

  it('the open issues of the lake are stated: level range, rafts aground at MNC, single bases, unconfirmed wind zone', () => {
    const c = lakeCaveats();
    expect(c[0]).toContain('19,55 m');
    expect(c.some((t) => t.includes('lộ khô'))).toBe(bedAnchorsOf().some((b) => b.z > MNC_M));
    // BÈ 5, 7 and 8 sit on ground at or above MNC (median 649,0–649,2 m)
    expect(raftsAgroundAtMnc().map((r) => r.name)).toEqual(expect.arrayContaining(['BÈ 5', 'BÈ 7', 'BÈ 8']));
    expect(c.some((t) => t.includes('đế ĐƠN'))).toBe(LAYOUT_COUNTS.bedBases > LAYOUT_COUNTS.sharedBases);
    expect(ACTIVE_LAKE.codeWind.confirmed).toBe(false);
    expect(c.some((t) => t.includes('Sơn La'))).toBe(true);
    // a failed storm lock is quantified from the catalogue: drift within the stroke margin, tension well above the locked value
    for (const r of HUOI_VANH_RAFTS) {
      expect(r.lockFailure, r.name).toBeDefined();
      expect(r.lockFailure!.drift_m, r.name).toBeGreaterThan(3);
      expect(r.lockFailure!.maxTension_kN, r.name).toBeGreaterThan(r.lockFailure!.setTension_kN * 10);
    }
    expect(c.some((t) => t.includes('KHÔNG khóa kịp') && t.includes('KHÔNG đủ giữ bè'))).toBe(true);
    // shore lines lying on the slope near low water are named (IFC grid)
    const slope = linesOnSlope();
    expect(slope.length).toBeGreaterThan(0);
    expect(c.some((t) => t.includes('tì lên sườn dốc') && t.includes(slope[0].code))).toBe(true);
  });
});
