import { describe, it, expect } from 'vitest';
import { HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { calculateProject } from '../index';
import { buildPileSchedule } from '../../io/pileSchedule';
import { buildPileScheduleWorkbook } from '../../io/excelExport';
import { buildMooringPileDxf } from '../../io/dxfExport';
import coordinates from '../../../data/huoiVanhCoordinates.json';

describe('PM Technical Audit of 12 Huoi Vanh Rafts', () => {
  it('all 12 rafts pass all mandatory checks C1-C11 and BP-1-BP-5', () => {
    const summary: any[] = [];
    const batchResults: any[] = [];

    for (const raft of HUOI_VANH_RAFTS) {
      const s = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
      s.activeRaftId = raft.id;
      s.raft.length_m = raft.length_m;
      s.raft.width_m = raft.width_m;
      s.raft.solarPanelCount = raft.solarPanelCount || Math.round(raft.area_m2 * 0.22);
      s.line.count = raft.cableCount;
      s.line.cableCode = raft.selectedCable;
      s.line.focusFactor = raft.focusFactor;
      s.line.shoreLineCount = raft.shoreAnchors;
      s.line.bedLineCount = raft.bedAnchors;
      s.line.mbl_kN =
        raft.selectedCable === 'PES-48' ? 688
        : raft.selectedCable === 'PES-36' ? 385
        : raft.selectedCable === 'PES-32' ? 305
        : raft.selectedCable === 'PES-28' ? 235
        : 172;
      s.env.waterDepth_m = raft.waterDepth_m || 6.0;
      if (raft.shorePileD_m) s.anchor.shoreD_m = raft.shorePileD_m;
      if (raft.shorePileL_m) s.anchor.shoreL_m = raft.shorePileL_m;
      if (raft.bedPileD_m) s.anchor.bed1D_m = raft.bedPileD_m;
      if (raft.bedPileL_m) s.anchor.bed1L_m = raft.bedPileL_m;

      const r = calculateProject(s);
      batchResults.push({ raft, state: s, results: r });

      // Check overall verdict
      expect(r.overallVerdict).toBe('PASS');

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
      expect(bp2?.status).toBe('PASS');
      expect(bp2?.utilization).toBeLessThanOrEqual(1.0);

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

    // Now verify pile schedule with batchResults across all 299 piles
    const baseState = JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT));
    const baseResults = calculateProject(baseState);
    const schedule = buildPileSchedule(baseState, baseResults, batchResults, coordinates as any);

    expect(schedule).toHaveLength(299);
    for (const p of schedule) {
      expect(p.Lopt_m).not.toBeNull();
      expect(p.Linput_m).toBeGreaterThanOrEqual(p.Lopt_m!);
      expect(p.Pmax_kN).toBeGreaterThan(0);
      expect(p.Preq_kN).toBeGreaterThan(0);
      expect(p.isPmaxOk).toBe(true);
    }

    // Verify Excel Workbook creation
    const wb = buildPileScheduleWorkbook(baseState, baseResults, batchResults, coordinates as any);
    expect(wb.SheetNames).toContain('BangThongKeCoc');

    // Verify CAD DXF creation
    const dxfResult = buildMooringPileDxf(baseState, baseResults, batchResults, coordinates as any);
    expect(dxfResult.dxf).toContain('SECTION');
    expect(dxfResult.pileCount).toBe(299);
  });
});
