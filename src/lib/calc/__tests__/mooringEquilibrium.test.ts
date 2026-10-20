import { describe, it, expect } from 'vitest';
import { analyseMooring, type EqInput } from '../mooringEquilibrium';

// Four lines to the four points of the compass, 30 m in plan, pins 10 m below the cleat at every level
// when the lines are re-set at every level (continuous compensation).
const base = (over: Partial<EqInput> = {}): EqInput => ({
  lines: [0, 90, 180, 270].map((az, i) => ({ code: `L${i}`, type: 'BED' as const, azimuth_deg: az, span_m: 30, pin_m: 0 })),
  force_kN: 50, mnc_m: 9.65, mndb_m: 9.65, mnlkt_m: 9.65, floatLevel_m: 0, cleatHeight_m: 0.35,
  mbl_kN: 300, compensation: 'seasonal', adjustStep_m: 0, ...over
});

describe('mooring equilibrium', () => {
  it('a load along one line is carried by that line at its real slope: T = F / cos θ (hand check)', () => {
    // pins 10 m below the cleats, 30 m away: cos θ = 30 / √1000. Load pushing the raft south (180°): the north line holds.
    const r = analyseMooring(base({ directionStep_deg: 90 }));
    const cos = 30 / Math.sqrt(30 * 30 + 10 * 10);
    // the line stretches a little, so its slope flattens a little: within 1 %
    expect(r.governing.maxTension_kN).toBeGreaterThan(50 / cos * 0.99);
    expect(r.governing.maxTension_kN).toBeLessThan(50 / cos * 1.01);
    // drift = stretch / cos θ, stretch = T L / EA with EA = 15 MBL
    const L = Math.sqrt(1000), stretch = (50 / cos) * L / (15 * 300);
    expect(r.maxDrift_m).toBeCloseTo(stretch / cos, 1);
  });

  it('steeper lines need more tension for the same load, in the ratio of the cosines', () => {
    const shallow = analyseMooring(base()).governing.maxTension_kN;
    const steep = analyseMooring(base({ lines: base().lines.map((l) => ({ ...l, pin_m: -20 })) })).governing.maxTension_kN;
    // 30 m in plan: 10 m drop (cos 0.949) against 30 m drop (cos 0.707)
    expect(steep / shallow).toBeCloseTo((30 / Math.sqrt(1000)) / (30 / Math.sqrt(1800)), 1);
  });

  it('slack lines carry nothing: with fixed-cut cables over a large level range the raft drifts and fewer lines hold', () => {
    const range = { mnc_m: 0, mndb_m: 10, mnlkt_m: 20 };
    const fixed = analyseMooring(base({ ...range, compensation: 'fixed' }));
    const cont = analyseMooring(base({ ...range }));
    expect(fixed.maxDrift_m).toBeGreaterThan(cont.maxDrift_m * 5);
    // every level of the range is analysed
    expect(fixed.levels[0].level_m).toBe(0);
    expect(fixed.levels[fixed.levels.length - 1].level_m).toBe(20);
  });

  it('a raft held on one side only swings across its anchor before the line holds it', () => {
    const r = analyseMooring(base({ lines: base().lines.slice(0, 1) }));
    expect(r.maxDrift_m).toBeGreaterThan(2 * 30);
  });

  it('losing the most loaded line moves the load to the others', () => {
    const r = analyseMooring(base());
    expect(r.damaged.maxLine).not.toBe(r.governing.maxLine);
    expect(r.damaged.maxTension_kN).toBeGreaterThan(0);
  });
});
