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
import { MOORING_LINES_V2, RAFT_POLYGONS_V2, LAYOUT_COUNTS, bedAnchorsOf, RAFT_TIES } from '../huoiVanhLayout';
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
    // panel tilt 10° like Huổi Vanh (owner 2026-10-29)
    expect(HUOI_VANH_DEFAULT_PROJECT.raft.solarTilt_deg).toBe(10);
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

  it('6 rafts of the plan settled 30/10/2026, 88 043 m², 16 912 panels of the sheets CT-BP', () => {
    expect(HUOI_VANH_RAFTS.map((r) => r.name)).toEqual(['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 4', 'BÈ 5', 'BÈ 6']);
    expect(RAFT_POLYGONS_V2.reduce((s, p) => s + p.area_m2, 0)).toBe(88043);
    // table "THỐNG KÊ TẤM PIN MẶT TRỜI" of the sheets CT-BP-01…06 (BO TRI BE PIN HO BAN MONG.pdf, 30/10/2026)
    expect(HUOI_VANH_RAFTS.map((r) => r.solarPanelCount)).toEqual([2912, 4200, 700, 2100, 2800, 4200]);
    expect(HUOI_VANH_RAFTS.reduce((s, r) => s + (r.solarPanelCount ?? 0), 0)).toBe(16912);
    expect(RAFT_POLYGONS_V2.map((p) => p.area_m2)).toEqual([15185, 21836, 3714, 10912, 14633, 21763]);
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
      // a tie restrains the edge of both rafts it joins (C9 counts it for both)
      const ties = RAFT_TIES.filter((t) => t.rafts.includes(r.name)).length;
      expect(own.length + ties, r.name).toBe(r.cableCount);
      expect(ties, r.name).toBe(r.ties ?? 0);
      expect(r.perimeter_m / (own.length + ties), r.name).toBeLessThanOrEqual(15);
    }
    for (const l of MOORING_LINES_V2.filter((q) => q.type === 'SHORE')) {
      // 2 cm: the pile is rounded to 0.01 m on a steep slope of the 5 m survey grid
      expect(groundAt(l.xAnchor, l.yAnchor)!, l.code).toBeGreaterThanOrEqual(MNDB_M - 0.5 - 0.02);
      // Bản Mòng reach (lakeConfig maxShoreSpan, 2026-10-24; Huổi Vanh 60); B5-D09, B6-D44 to 90 m (shoreSpanFor, 30/10)
      expect(l.span, l.code).toBeLessThanOrEqual(['B5-D09', 'B6-D44'].includes(l.code) ? 90 : 80);
    }
    // a base stands on the IFC ground at its own point, under water at MNDB (scripts/lakeConfig.mjs, bedOnTerrain)
    for (const b of bedAnchorsOf()) {
      expect(b.z, b.id).toBeCloseTo(groundAt(b.x, b.y)!, 1);
      expect(b.z, b.id).toBeLessThanOrEqual(MNDB_M - 0.5);
      expect(b.lines.length, b.id).toBe(b.shared ? 2 : 1);
    }
  });

  it('BÈ 2, 3, 4, 5 tied across their gaps (owner 30/10: crowded bed lines); no short single base left to take the raft load', () => {
    // the shared bases of the BÈ 2 – BÈ 4 gap (6, lines crossing each other), of the BÈ 4 – BÈ 5 gap (8) and of the
    // BÈ 2 – BÈ 3 gap (2, plus 2 ropes placed by hand) became ropes cleat to cleat; the four rafts are ONE group
    expect(RAFT_TIES.length).toBe(18);
    expect(LAYOUT_COUNTS.ties).toBe(18);
    expect(RAFT_TIES.filter((t) => [...t.rafts].sort().join() === 'BÈ 2,BÈ 3').length).toBe(4);
    expect(RAFT_TIES.filter((t) => [...t.rafts].sort().join() === 'BÈ 2,BÈ 4').length).toBe(6);
    expect(RAFT_TIES.filter((t) => [...t.rafts].sort().join() === 'BÈ 4,BÈ 5').length).toBe(8);
    for (const r of HUOI_VANH_RAFTS) {
      if (['BÈ 2', 'BÈ 3', 'BÈ 4', 'BÈ 5'].includes(r.name)) expect(r.mooringLayout!.group!.rafts.length, r.name).toBe(4);
      else expect(r.mooringLayout!.group, r.name).toBeUndefined();
    }
    // planner step 2g: B2-D50 (single base, 7 m cable in the BÈ 1 – BÈ 2 corner) took 199 kN of BÈ 2 and was dropped
    for (const l of MOORING_LINES_V2.filter((q) => q.type === 'BED' && !q.sharedWith)) expect(l.span, l.code).toBeGreaterThanOrEqual(10);
    const T = (name: string) => {
      const r = HUOI_VANH_RAFTS.find((q) => q.name === name)!;
      const st = buildRaftProjectState(JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)), r, HUOI_VANH_DEFAULT_PROJECT.anchor);
      return calculateProject(st).t_max_intact_kN;
    };
    expect(T('BÈ 2')).toBeLessThan(100); // the group BÈ 2 + 3 + 4 + 5: 95,2 kN; 204 kN (PES-48) with B2-D50
    // tie check: largest gap force of the group equilibrium over half the ropes of that gap (BÈ 2 – BÈ 4: 154,8 kN)
    const g = HUOI_VANH_RAFTS.find((r) => r.name === 'BÈ 3')!.mooringLayout!.group!;
    expect(g.tieDesign_kN).toBeGreaterThan(150);
    expect(g.tieDesign_kN).toBeLessThan(475 / 3);
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
      // never below the single-angle tension (it governs BÈ 2 of the shore-first 6-raft plan, 81,1 kN)
      expect(b.results.t_max_intact_kN, b.raft.name).toBeGreaterThanOrEqual(b.results.t_geometric_kN);
    }
    // the single-angle tension of Huổi Vanh would be unsafe here: the equilibrium is higher for most rafts
    expect(batch.filter((b) => b.results.t_max_intact_kN > b.results.t_geometric_kN + 0.05).length).toBeGreaterThanOrEqual(batch.length - 1);
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
    expect(d.rafts).toHaveLength(6);
    const dxf = buildMooringScrewBaseDxf(state, results, batch);
    expect([dxf.baseCount, dxf.raftCount]).toEqual([LAYOUT_COUNTS.bedBases, 6]);
    expect(dxf.schedule.bases[0].baseId).toBe('BM-DV001');
  });

  it('the 3D scene places every anchor on the IFC terrain', () => {
    expect(RAFT_MODELS).toHaveLength(6);
    const piles = buildPileModels();
    expect(piles).toHaveLength(LAYOUT_COUNTS.anchorPoints);
    expect(buildCableModels(piles)).toHaveLength(LAYOUT_COUNTS.lines);
  });

  it('the open issues of the lake are stated: level range, rafts aground at MNC, single bases, unconfirmed wind zone', () => {
    const c = lakeCaveats();
    expect(c[0]).toContain('19,55 m');
    expect(c.some((t) => t.includes('lộ khô'))).toBe(bedAnchorsOf().some((b) => b.z > MNC_M));
    // every raft of the 6-raft plan has ground above MNC somewhere under it (highest 653,1–657,2 m; BÈ 5 the most)
    expect(raftsAgroundAtMnc().map((r) => r.name)).toEqual(['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 4', 'BÈ 5', 'BÈ 6']);
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
