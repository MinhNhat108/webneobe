import { describe, it, expect } from 'vitest';
import { HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { calculateProject } from '../index';
import { buildPileSchedule } from '../../io/pileSchedule';
import { buildPileScheduleWorkbook } from '../../io/excelExport';
import { buildMooringPileDxf } from '../../io/dxfExport';
import { buildScrewBaseSchedule } from '../../io/screwBaseSchedule';
import { MOORING_LINES_V2 as coordinates } from '../../../data/huoiVanhLayout';
import { buildRaftProjectState } from '../raftState';
import { designWindCaveat, isBelowCodeWind, windPressureRatio } from '../designWind';

const check = (r: ReturnType<typeof calculateProject>, id: string) => r.checks.find((c) => c.id === id);

describe('The design sized at the 20 m/s default against the code wind', () => {
  it('the default wind is 20 m/s, below the code wind, and the caveat says so', () => {
    const v = HUOI_VANH_DEFAULT_PROJECT.env.windSpeed_ms;
    expect(v).toBe(20);
    expect(isBelowCodeWind(v)).toBe(true);
    expect(windPressureRatio(v)).toBeCloseTo((20 / 29.7) ** 2, 12); // 45 % of the code pressure
    expect(designWindCaveat(v)).toContain('THẤP HƠN gió tiêu chuẩn TCVN 2737:2023');
    expect(designWindCaveat(v)).toContain('45%');
    expect(designWindCaveat(30)).toBeNull();
    expect(designWindCaveat(29.7)).toBeNull();
  });

  it('at the storm wind (30 m/s, entered in Tab 2) every raft of the default design FAILS — pinned so nobody reads the 20 m/s result as storm-safe', () => {
    for (const raft of HUOI_VANH_RAFTS) {
      const base = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
      const s = buildRaftProjectState(base, raft, base.anchor);
      const calm = calculateProject(s);
      const storm = calculateProject({ ...s, env: { ...s.env, windSpeed_ms: 30 } });
      expect(calm.overallVerdict, raft.name).toBe('PASS');
      expect(storm.overallVerdict, raft.name).toBe('FAIL');
      // the wind load goes with V²: 2.25 times at 30 m/s
      expect(storm.f_wind_total_kN / calm.f_wind_total_kN, raft.name).toBeCloseTo(2.25, 1);
      // the shore pile reinforcement chosen at 20 m/s is what gives way first
      expect(check(storm, 'BP-2')?.status, raft.name).toBe('FAIL');
      // the screw base is re-sized by the engine, so it still reports a passing (larger) base
      expect(storm.bedScrewBase!.side_m, raft.name).toBeGreaterThanOrEqual(calm.bedScrewBase!.side_m);
    }
  });
});

describe('Technical audit of the 9 Huoi Vanh rafts', () => {
  it('all 9 rafts pass every mandatory check with bored shore piles D350 and screw-pile bases on the lake bed (the design)', () => {
    const batchResults: any[] = [];
    for (const raft of HUOI_VANH_RAFTS) {
      const base = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
      const s = buildRaftProjectState(base, raft, base.anchor);
      expect(s.anchor.bedAnchorOption, raft.name).toBe('PA3_SCREW_BASE');
      const r = calculateProject(s);
      batchResults.push({ raft, state: s, results: r });

      expect(r.overallVerdict, raft.name).toBe('PASS');

      // Cable: intact SF >= 3.0, damaged SF >= 2.0
      expect(check(r, 'C2')?.status, raft.name).toBe('PASS');
      expect(check(r, 'C2')?.actual).toBeGreaterThanOrEqual(3.0);
      expect(check(r, 'C6')?.status, raft.name).toBe('PASS');
      expect(check(r, 'C6')?.actual).toBeGreaterThanOrEqual(2.0);

      // Shore pile: Broms lateral and TCVN 5574 bending
      for (const id of ['BP-1', 'BP-2']) {
        expect(check(r, id)?.status, `${raft.name} ${id}`).toBe('PASS');
        expect(check(r, id)?.utilization, `${raft.name} ${id}`).toBeLessThanOrEqual(0.95);
      }

      // Lake bed: the pile rows do not apply, the six base checks do
      for (const id of ['C11', 'BP-3', 'BP-4', 'BP-5']) expect(check(r, id)?.status, `${raft.name} ${id}`).toBe('SKIP');
      for (const id of ['SV-1', 'SV-2', 'SV-3', 'SV-4', 'SV-5', 'SV-6']) {
        expect(check(r, id)?.status, `${raft.name} ${id}`).toBe('PASS');
        expect(check(r, id)?.utilization, `${raft.name} ${id}`).toBeLessThanOrEqual(1.0);
      }

      // Water depth clearance and the mandatory spacing criterion on the MEASURED perimeter
      expect(check(r, 'C8')?.status).toBe('PASS');
      expect(check(r, 'C9')?.isMandatory).toBe(true);
      expect(check(r, 'C9')?.status).toBe('PASS');
      expect(raft.perimeter_m / raft.cableCount).toBeLessThanOrEqual(15.0);

      expect(s.anchor.shorePileShape).toBe('circular');
      expect(s.anchor.shoreD_m).toBe(0.35);
      expect(s.anchor.sfPile).toBeGreaterThanOrEqual(2.0);
    }

    // Shore piles: 231 points, 231 piles — at the 20 m/s default no raft needs twin piles.
    const baseState = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
    const baseResults = calculateProject(baseState);
    const schedule = buildScrewBaseSchedule(baseState, baseResults, batchResults, coordinates as any);
    expect(schedule.shorePiles).toHaveLength(231);
    expect(schedule.shorePiles.reduce((s, p) => s + p.pileCount, 0)).toBe(231);
    for (const p of schedule.shorePiles) {
      expect(p.pileCount, p.pileId).toBe(1);
      expect(p.Lopt_m, p.pileId).not.toBeNull();
      expect(p.Linput_m).toBeGreaterThanOrEqual(p.Lopt_m!);
      expect(p.isPmaxOk, p.pileId).toBe(true);
    }
    // Lake bed: 32 bases (all shared by two rafts), all passing, none overlapping a neighbour.
    expect(schedule.bases).toHaveLength(32);
    expect(schedule.totals.okBases).toBe(32);
    expect(schedule.clashes).toEqual([]);
    expect(schedule.totals.screws).toBe(32 * 4);
  });

  it('the alternative PA1 (driven 350 x 350 lake-bed piles) also passes on all 9 rafts', () => {
    const batchResults: any[] = [];
    for (const raft of HUOI_VANH_RAFTS) {
      const base = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
      const mapped = buildRaftProjectState(base, raft, base.anchor);
      const s = { ...mapped, anchor: { ...mapped.anchor, bedAnchorOption: 'PA1_PILE' as const } };
      const r = calculateProject(s);
      batchResults.push({ raft, state: s, results: r });
      expect(r.overallVerdict, raft.name).toBe('PASS');
      for (const id of ['BP-3', 'BP-4', 'BP-5']) {
        expect(check(r, id)?.status, `${raft.name} ${id}`).toBe('PASS');
        expect(check(r, id)?.utilization, `${raft.name} ${id}`).toBeLessThanOrEqual(0.95);
      }
      expect(s.anchor.bedPileShape).toBe('square');
      expect(s.anchor.bed1D_m).toBe(0.35);
    }

    const baseState = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
    const baseResults = calculateProject(baseState);
    const schedule = buildPileSchedule(baseState, baseResults, batchResults, coordinates as any);
    expect(schedule).toHaveLength(295);
    for (const p of schedule) {
      expect(p.Pmax_kN).toBeGreaterThan(0);
      expect(p.Lopt_m, p.pileId).not.toBeNull();
      expect(p.Linput_m).toBeGreaterThanOrEqual(p.Lopt_m!);
      expect(p.isPmaxOk, p.pileId).toBe(true);
    }
    const piles = (type: string) => schedule.filter((p) => p.type === type).reduce((s, p) => s + p.pileCount, 0);
    expect(piles('SHORE')).toBe(231);
    expect(piles('BED')).toBe(64); // one pile per point everywhere at the 20 m/s default

    const wb = buildPileScheduleWorkbook(baseState, baseResults, batchResults, coordinates as any);
    expect(wb.SheetNames).toContain('BangThongKeCoc');
    const dxfResult = buildMooringPileDxf(baseState, baseResults, batchResults, coordinates as any);
    expect(dxfResult.dxf).toContain('SECTION');
    expect(dxfResult.pileCount).toBe(295);
  });
});
