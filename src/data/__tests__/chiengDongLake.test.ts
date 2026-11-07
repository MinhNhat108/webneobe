/**
 * Hồ Chiềng Dong, end to end: the browser has the Chiềng Dong tab selected
 * (`mooring_active_lake` = 'chieng-dong' in localStorage) BEFORE any module is
 * loaded, so every data module of this file is the Chiềng Dong one.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const store = new Map<string, string>([['mooring_active_lake', 'chieng-dong']]);
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as Storage;
});

import { ACTIVE_LAKE_ID, LAKES } from '../lakes';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, CHIENG_DONG_PROJECT } from '../huoiVanhProject';
import { MOORING_LINES_V2, RAFT_POLYGONS_V2, LAYOUT_COUNTS, bedAnchorsOf, RAFT_TIES } from '../huoiVanhLayout';
import { lakeCaveats } from '../lakeCaveats';
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

describe('Hồ Chiềng Dong tab', () => {
  it('loads the Chiềng Dong project, levels and datum', () => {
    expect(ACTIVE_LAKE_ID).toBe('chieng-dong');
    expect(HUOI_VANH_DEFAULT_PROJECT).toBe(CHIENG_DONG_PROJECT);
    expect(HUOI_VANH_DEFAULT_PROJECT.id).toBe('chieng-dong-fpv');
    // Pre-FS: MNC +740,5; MNDBT +760,0; MNKT (P = 0,2 %) +761,12
    expect([MNC_M, MNDB_M, MNLKT_M]).toEqual([740.5, 760.0, 761.12]);
    // "IFC dia hinh.ifc" is in absolute elevations (VN-2000), with no water slab
    expect(IFC_DATUM_OFFSET_M).toBe(0);
    expect(HUOI_VANH_DEFAULT_PROJECT.raft.solarTilt_deg).toBe(10);
    for (const d of HUOI_VANH_DEFAULT_PROJECT.attachments ?? []) {
      expect(d.remoteUrl, d.name).toMatch(/^docs_chieng_dong\/HOCHIENGDONG_/);
    }
    for (const id of Object.keys(LAKES) as Array<keyof typeof LAKES>) {
      expect(SCRIPT_LAKES[id].mndb, id).toBe(LAKES[id].levels.mndb_m);
    }
  });

  it('one raft of the frame KC-BE01 (owner 2026-11-07: the raft of 8 484 panels), 44 298 m²', () => {
    expect(RAFT_POLYGONS_V2.map((p) => p.name)).toEqual(['BÈ 1']);
    expect(HUOI_VANH_RAFTS.map((r) => r.area_m2)).toEqual([44298]);
    expect(HUOI_VANH_RAFTS.map((r) => r.solarPanelCount)).toEqual([8484]);
    // the bed under the raft (IFC, VN-2000): ~6 m of water at MNC, ~26 m at MNDBT
    expect(RAFT_POLYGONS_V2[0].designBed_m).toBeCloseTo(734.45, 1);
    expect(RAFT_TIES).toEqual([]);
  });

  it('mooring layout: C9, shore piles on the bank within 100 m (owner 07/11: optimised), bases on the IFC ground under water', () => {
    expect(LAYOUT_COUNTS.lines).toBe(MOORING_LINES_V2.length);
    const r = HUOI_VANH_RAFTS[0];
    expect(MOORING_LINES_V2.length).toBe(r.cableCount);
    expect(r.perimeter_m / r.cableCount).toBeLessThanOrEqual(15);
    for (const l of MOORING_LINES_V2.filter((q) => q.type === 'SHORE')) {
      expect(groundAt(l.xAnchor, l.yAnchor)!, l.code).toBeGreaterThanOrEqual(MNDB_M - 0.5 - 0.02);
      expect(l.span, l.code).toBeLessThanOrEqual(100);
    }
    // shore piles at least 8 m apart (lakeConfig minPileGap, owner 07/11: no pile clusters on the spits)
    const sh = MOORING_LINES_V2.filter((q) => q.type === 'SHORE');
    for (const p of sh) for (const q of sh) if (p !== q) expect(Math.hypot(p.xAnchor - q.xAnchor, p.yAnchor - q.yAnchor), `${p.code}/${q.code}`).toBeGreaterThanOrEqual(8 - 0.02);
    for (const b of bedAnchorsOf()) {
      expect(b.z, b.id).toBeCloseTo(groundAt(b.x, b.y)!, 1);
      expect(b.z, b.id).toBeLessThanOrEqual(MNDB_M - 0.5);
    }
  });

  it('the raft passes at the 20 m/s default, on the equilibrium of its real lines, compensated', () => {
    const { batch } = setup();
    expect(HUOI_VANH_DEFAULT_PROJECT.env.windSpeed_ms).toBe(20);
    const line = dflt().line;
    expect([line.levelCompensation, line.adjustStep_m]).toEqual(['seasonal', 0]);
    for (const b of batch) {
      expect(b.results.overallVerdict, b.raft.name).toBe('PASS');
      const a = b.results.mooringAnalysis!;
      expect(a.unconverged).toBe(0);
      expect(a.levels.map((l) => l.level_m)).toEqual(expect.arrayContaining([MNDB_M, MNLKT_M]));
      expect(b.results.t_max_intact_kN).toBeGreaterThanOrEqual(a.governing.maxTension_kN);
      // one raft in the lake: no gap to another raft, C12 does not apply
      expect(b.results.checks.find((c) => c.id === 'C12')?.status).toBe('SKIP');
    }
  });

  it('the anchor schedule, the cable cutting list, the workbook and the drawing build on the Chiềng Dong layout', () => {
    const { state, results, batch } = setup();
    const s = buildAnchorPointSchedule(state, results, batch);
    expect([s.totals.points, s.totals.lines]).toEqual([LAYOUT_COUNTS.anchorPoints, LAYOUT_COUNTS.lines]);
    expect(s.levels).toEqual({ mnc_m: 740.5, mndb_m: 760.0, mnlkt_m: 761.12 });
    expect(s.bed.every((r) => r.base.design.ok)).toBe(true);
    expect(findBaseClashes(s.bed.map((r) => r.base))).toEqual([]);
    expect(buildCableCuttingSchedule(state).rows).toHaveLength(LAYOUT_COUNTS.lines);
    expect(buildFinalDesign(state, results, batch).rafts).toHaveLength(1);
    const dxf = buildMooringScrewBaseDxf(state, results, batch);
    expect([dxf.baseCount, dxf.raftCount]).toEqual([LAYOUT_COUNTS.bedBases, 1]);
    expect(dxf.schedule.bases[0].baseId).toBe('CD-DV001');
  });

  it('the 3D scene places every anchor on the IFC terrain; the open issues are stated', () => {
    expect(RAFT_MODELS).toHaveLength(1);
    const piles = buildPileModels();
    expect(piles).toHaveLength(LAYOUT_COUNTS.anchorPoints);
    expect(buildCableModels(piles)).toHaveLength(LAYOUT_COUNTS.lines);
    const c = lakeCaveats();
    expect(c[0]).toContain('20,62 m');
    expect(c.some((t) => t.includes('Sơn La'))).toBe(true);
  });
});
