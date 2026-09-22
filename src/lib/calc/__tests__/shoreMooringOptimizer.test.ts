import { describe, it, expect } from 'vitest';
import { optimizeMooringLayoutToShore } from '../shoreMooringOptimizer';
import huoiVanhCoordinatesData from '../../../data/huoiVanhCoordinates.json';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, MooringCoordinate } from '../../../data/huoiVanhProject';
import { ProjectState } from '../types';

describe('Shore-First Mooring Layout Optimizer', () => {
  it('significantly increases shore anchor ratio while ensuring pile safety', () => {
    const coords = huoiVanhCoordinatesData as MooringCoordinate[];
    const result = optimizeMooringLayoutToShore(
      coords,
      HUOI_VANH_RAFTS,
      HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState,
      65.0
    );

    console.log('SHORE OPTIMIZATION SUMMARY:', result.summary);

    expect(result.summary.optimizedShoreCount).toBeGreaterThan(result.summary.originalShoreCount);
    expect(result.summary.convertedCount).toBeGreaterThan(30);
    expect(result.summary.shorePercentageAfter).toBeGreaterThan(60);
    expect(result.summary.estimatedCostSavingPercent).toBeGreaterThan(15);

    // Verify all 12 rafts have pile optimizations computed
    for (const raft of HUOI_VANH_RAFTS) {
      const opt = result.pileOptimizations[raft.name];
      expect(opt).toBeDefined();
      expect(opt.shore.converged).toBe(true);
      expect(opt.shore.L_opt_m).toBeGreaterThan(0);
      expect(opt.shore.capacity.Pmax_kN).toBeGreaterThan(0);
    }
  });
});
