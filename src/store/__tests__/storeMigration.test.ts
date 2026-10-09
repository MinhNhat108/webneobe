import { describe, it, expect, vi } from 'vitest';
import { HUOI_VANH_RAFTS } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../data/huoiVanhLayout';
import { buildScrewBaseSchedule } from '../../lib/io/screwBaseSchedule';
import { buildPileSchedule } from '../../lib/io/pileSchedule';
import { buildMooringScrewBaseDxf } from '../../lib/io/screwBaseDxf';
import { mooringOptionOf } from '../../lib/io/mooringExports';

/**
 * A browser that used the app before 2026-10-08 holds the 12-raft project in
 * localStorage. Whatever it holds, the app must come up on the 9-raft design
 * and its export buttons must write 263 anchor points (231 shore piles + 32 lake-bed bases) for 295 lines.
 */
// zustand only attaches its persist API when a storage exists: give the node test run one.
// vi.hoisted runs before every import, including the modules that pull the store in.
vi.hoisted(() => {
  const memory = new Map<string, string>();
  // zustand reads `window.localStorage`
  (globalThis as any).window = (globalThis as any).window ?? globalThis;
  (globalThis as any).localStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => { memory.set(k, v); },
    removeItem: (k: string) => { memory.delete(k); }
  };
});
const { useProjectStore } = await import('../useProjectStore');

const NINE = ['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 3A', 'BÈ 5A', 'BÈ 6', 'BÈ 7', 'BÈ 8', 'BÈ 9'];
const opts = () => useProjectStore.persist.getOptions();
const migrate = (state: any, version: number) => opts().migrate!(JSON.parse(JSON.stringify(state)), version) as any;
/** What zustand does after reading storage: migrate if the version is old, then the rehydrate hook. */
const rehydrate = (state: any, version: number) => {
  const s = version < (opts().version ?? 0) ? migrate(state, version) : JSON.parse(JSON.stringify(state));
  (opts().onRehydrateStorage as any)?.(s)?.(s, undefined);
  return s;
};

/** The project as a browser of the 12-raft era stored it (version 15). */
const legacy12 = () => {
  const now = useProjectStore.getState();
  const rafts = Array.from({ length: 12 }, (_, i) => ({ ...HUOI_VANH_RAFTS[0], id: i + 1, name: `BÈ ${i + 1}`, area_m2: 7560, cableCount: 25 }));
  const project = JSON.parse(JSON.stringify(now.currentProject));
  delete project.anchor.bedAnchorOption;
  project.env.windSpeed_ms = 30;
  return { currentProject: project, projectList: now.projectList, activeRaftId: 10, raftsSummary: rafts, costParams: { ...now.costParams, shoreTurnkeyRate_VND_m: 555_000 } };
};

describe('A browser holding the old 12-raft project', () => {
  it('the store ships the 9-raft design, lake-bed anchors on screw-pile bases', () => {
    const s = useProjectStore.getState();
    expect(s.raftsSummary.map((r) => r.name)).toEqual(NINE);
    expect(mooringOptionOf(s.currentProject)).toBe('PA3_SCREW_BASE');
    expect(opts().version).toBeGreaterThanOrEqual(18);
  });

  it('is migrated to the 9 rafts, and keeps the quotation prices the user typed', () => {
    const s = rehydrate(legacy12(), 15);
    expect(s.raftsSummary.map((r: any) => r.name)).toEqual(NINE);
    expect(s.activeRaftId).toBe(1);
    expect(s.currentProject.anchor.bedAnchorOption).toBe('PA3_SCREW_BASE');
    expect(s.currentProject.env.windSpeed_ms).toBe(20);
    expect(s.costParams.shoreTurnkeyRate_VND_m).toBe(555_000);
  });

  it('is repaired on load even when its stored version number is already current', () => {
    // e.g. a cache written by an intermediate build: the version check alone would let it through
    const s = rehydrate(legacy12(), opts().version ?? 18);
    expect(s.raftsSummary.map((r: any) => r.name)).toEqual(NINE);
    expect(s.currentProject.anchor.bedAnchorOption).toBe('PA3_SCREW_BASE');
    expect(HUOI_VANH_RAFTS.some((r) => r.id === s.activeRaftId)).toBe(true);
  });

  it('a 9-raft cache with OLD catalogue values takes the shipped catalogue but keeps the Tab 2 inputs', () => {
    const now = useProjectStore.getState();
    const stale = {
      currentProject: { ...JSON.parse(JSON.stringify(now.currentProject)), env: { ...now.currentProject.env, windSpeed_ms: 27 } },
      projectList: now.projectList, activeRaftId: 1,
      raftsSummary: HUOI_VANH_RAFTS.map((r) => ({ ...r, selectedCable: 'PES-48', shorePilesPerPoint: 2 })),
      costParams: now.costParams
    };
    const s = rehydrate(stale, opts().version ?? 18);
    expect(s.raftsSummary).toEqual(HUOI_VANH_RAFTS);
    expect(s.currentProject.env.windSpeed_ms).toBe(27); // the user's own input survives
  });

  it('does not write into the shared design constants while migrating', () => {
    const before = JSON.stringify(HUOI_VANH_RAFTS);
    const a = rehydrate(legacy12(), 15);
    const b = rehydrate(legacy12(), 15);
    expect(JSON.stringify(HUOI_VANH_RAFTS)).toBe(before);
    expect(JSON.stringify(b.currentProject)).toBe(JSON.stringify(a.currentProject));
    expect(b.currentProject.env.windSpeed_ms).toBe(20);
  });
});

describe('What the export buttons write after that migration', () => {
  const s = rehydrate(legacy12(), 15);
  // the header / Tab 3 buttons: batch of every raft in raftsSummary, then the export of the selected option
  useProjectStore.setState({ currentProject: s.currentProject, raftsSummary: s.raftsSummary, activeRaftId: s.activeRaftId, batchResults: [] });
  const batch = useProjectStore.getState().calculateAllRafts();
  const { currentProject, results } = useProjectStore.getState();

  it('the batch covers exactly the 9 rafts of the layout file', () => {
    expect(batch.map((b) => b.raft.name)).toEqual(NINE);
    expect([...new Set(MOORING_LINES_V2.map((l) => l.raft))].sort()).toEqual([...NINE].sort());
  });

  it('"Bảng Neo" and "Xuất CAD": 231 shore piles + 32 lake-bed bases for 295 lines, every anchor on one of the 9 rafts', () => {
    const schedule = buildScrewBaseSchedule(currentProject, results, batch);
    expect([schedule.shorePiles.length, schedule.bases.length]).toEqual([231, 32]);
    const piles = buildPileSchedule(currentProject, results, batch);
    expect(piles).toHaveLength(295);
    for (const p of piles) expect(NINE, p.pileId).toContain(p.raft);
    const dxf = buildMooringScrewBaseDxf(currentProject, results, batch);
    expect([dxf.raftCount, dxf.shorePileCount, dxf.baseCount]).toEqual([9, 231, 32]);
    for (const gone of ['B\\U+00C8 10', 'B\\U+00C8 11', 'B\\U+00C8 12']) expect(dxf.dxf).not.toContain(gone); // "BÈ 10" … as escaped in the file
    expect(dxf.dxf).toContain('B\\U+00C8 3A');
  });

  it('every anchor takes its values from its OWN raft, not from the active raft as a fallback', () => {
    const piles = buildPileSchedule(currentProject, results, batch);
    for (const b of batch) {
      const rows = piles.filter((p) => p.raft === b.raft.name);
      expect(rows.length, b.raft.name).toBe(b.raft.cableCount);
      for (const p of rows) expect(p.Tmax_kN, p.pileId).toBeCloseTo(b.results.t_max_intact_kN, 2);
    }
  });
});
