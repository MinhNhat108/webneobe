import { describe, it, expect } from 'vitest';
import { HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { calculateProject } from '../index';
import { buildPileSchedule } from '../../io/pileSchedule';
import { buildPileScheduleWorkbook } from '../../io/excelExport';
import { buildMooringPileDxf } from '../../io/dxfExport';
import { MOORING_LINES_V2 as coordinates } from '../../../data/huoiVanhLayout';
import { buildRaftProjectState } from '../raftState';

describe('PM Technical Audit of 12 Huoi Vanh Rafts', () => {
  it('11 rafts pass all mandatory checks C1-C11 and BP-1-BP-5 with 350 mm piles; BÈ 5 fails BP-2 only', () => {
    const summary: any[] = [];
    const batchResults: any[] = [];

    for (const raft of HUOI_VANH_RAFTS) {
      const base = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
      const s = buildRaftProjectState(base, raft, base.anchor);

      const r = calculateProject(s);
      batchResults.push({ raft, state: s, results: r });

      // Check overall verdict. With the owner's 350 x 350 mm piles BÈ 5 cannot
      // pass: its shore pile fails in bending (BP-2) even with the heaviest
      // single layer of CB500-V that fits. Every other raft passes.
      if (raft.name === 'BÈ 5') {
        expect(r.overallVerdict).toBe('FAIL');
        expect(r.checks.filter((c) => c.status === 'FAIL').map((c) => c.id)).toEqual(['BP-2']);
      } else {
        expect(r.overallVerdict, raft.name).toBe('PASS');
      }

      // Check cable safety factor (intact >= 3.0)
      const c2 = r.checks.find((c) => c.id === 'C2');
      expect(c2?.status).toBe('PASS');
      expect(c2?.actual).toBeGreaterThanOrEqual(3.0);

      // Check damaged cable safety factor (damaged >= 2.0)
      const c6 = r.checks.find((c) => c.id === 'C6');
      expect(c6?.status).toBe('PASS');
      expect(c6?.actual).toBeGreaterThanOrEqual(2.0);

      // Check Broms shore pile lateral
      const bp1 = r.checks.find((c) => c.id === 'BP-1');
      expect(bp1?.status).toBe('PASS');
      expect(bp1?.utilization).toBeLessThanOrEqual(1.0);

      // Check Broms shore pile moment
      const bp2 = r.checks.find((c) => c.id === 'BP-2');
      if (raft.name === 'BÈ 5') {
        expect(bp2?.status).toBe('FAIL'); // see above
        expect(bp2?.utilization).toBeGreaterThan(1.0);
      } else {
        expect(bp2?.status, raft.name).toBe('PASS');
        expect(bp2?.utilization).toBeLessThanOrEqual(1.0);
      }

      // Check Broms bed pile lateral
      const bp3 = r.checks.find((c) => c.id === 'BP-3');
      expect(bp3?.status).toBe('PASS');
      expect(bp3?.utilization).toBeLessThanOrEqual(1.0);

      // Check Broms bed pile uplift
      const bp4 = r.checks.find((c) => c.id === 'BP-4');
      expect(bp4?.status).toBe('PASS');
      expect(bp4?.utilization).toBeLessThanOrEqual(1.0);

      // Check Broms bed pile moment
      const bp5 = r.checks.find((c) => c.id === 'BP-5');
      expect(bp5?.status).toBe('PASS');
      expect(bp5?.utilization).toBeLessThanOrEqual(1.0);

      // Check water depth clearance C8
      const c8 = r.checks.find((c) => c.id === 'C8');
      expect(c8?.status).toBe('PASS');
      expect(c8?.actual).toBeGreaterThanOrEqual(1.0);

      // C9 (mandatory): s_avg = P_bè / N_dây <= 15 m on the MEASURED perimeter
      const c9 = r.checks.find((c) => c.id === 'C9');
      expect(c9?.isMandatory).toBe(true);
      expect(c9?.status).toBe('PASS');
      expect(raft.perimeter_m / raft.cableCount).toBeLessThanOrEqual(15.0);

      // Every pile is a square RC pile, checked with the Broms FS >= 2.0
      expect(s.anchor.shorePileShape).toBe('square');
      expect(s.anchor.bedPileShape).toBe('square');
      expect(s.anchor.sfPile).toBeGreaterThanOrEqual(2.0);

      summary.push({
        raft: raft.name,
        area: raft.area_m2,
        F_env: r.f_env_total_kN.toFixed(1),
        T_max: r.t_max_intact_kN.toFixed(1),
        SF_cable: c2?.displayActual,
        util_H_shore: bp1?.utilization?.toFixed(2),
        util_M_shore: bp2?.utilization?.toFixed(2),
        util_H_bed: bp3?.utilization?.toFixed(2),
        util_Uplift_bed: bp4?.utilization?.toFixed(2),
        L_opt_shore: r.shorePileOpt?.L_opt_m,
        L_tk_shore: s.anchor.shoreL_m,
        L_opt_bed: r.bedPileOpt?.L_opt_m,
        L_tk_bed: s.anchor.bed1L_m,
        Pmax_shore: r.shorePileCapacity?.Pmax_kN,
        Pmax_bed: r.bedPileCapacity?.Pmax_kN
      });
    }

    // Now verify pile schedule with batchResults across all 304 piles
    const baseState = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
    const baseResults = calculateProject(baseState);
    const schedule = buildPileSchedule(baseState, baseResults, batchResults, coordinates as any);

    expect(schedule).toHaveLength(304);
    for (const p of schedule) {
      expect(p.Pmax_kN).toBeGreaterThan(0);
      expect(p.Preq_kN).toBeGreaterThan(0);
      if (p.raft === 'BÈ 5' && p.type === 'SHORE') {
        // The section fails in bending at every depth: no L_opt, and the schedule says so.
        expect(p.Lopt_m, p.pileId).toBeNull();
        expect(p.isPmaxOk, p.pileId).toBe(false);
        continue;
      }
      expect(p.Lopt_m, p.pileId).not.toBeNull();
      expect(p.Linput_m).toBeGreaterThanOrEqual(p.Lopt_m!);
      expect(p.isPmaxOk, p.pileId).toBe(true);
    }
    expect(schedule.filter((p) => !p.isPmaxOk)).toHaveLength(12); // the 12 shore piles of BÈ 5

    // Verify Excel Workbook creation
    const wb = buildPileScheduleWorkbook(baseState, baseResults, batchResults, coordinates as any);
    expect(wb.SheetNames).toContain('BangThongKeCoc');

    // Verify CAD DXF creation
    const dxfResult = buildMooringPileDxf(baseState, baseResults, batchResults, coordinates as any);
    expect(dxfResult.dxf).toContain('SECTION');
    expect(dxfResult.pileCount).toBe(304);
  });
});
