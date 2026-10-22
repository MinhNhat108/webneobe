import { describe, it, expect } from 'vitest';
import { analyseMooring, type EqInput } from '../mooringEquilibrium';

// Two opposite lines along the load (north / south), L = 20 m, pin at the cleat level, EA = 15 × 300 kN.
const base = (W: number, S: number): EqInput => ({
  lines: [
    { code: 'N', type: 'SHORE', azimuth_deg: 0, span_m: 20, pin_m: 650.35 },
    { code: 'S', type: 'SHORE', azimuth_deg: 180, span_m: 20, pin_m: 650.35 }
  ],
  force_kN: 100, mnc_m: 650, mndb_m: 650, mnlkt_m: 650, floatLevel_m: 650, cleatHeight_m: 0.35, mbl_kN: 300,
  compensation: 'device', deviceTension_kN: W, deviceStroke_m: S, directionStep_deg: 360
});

describe('constant-tension device (lock-failure check of Hồ Bản Mòng)', () => {
  it('collinear constant-tension lines have no stiffness: the raft runs to the end of the stroke', () => {
    const r = analyseMooring(base(10, 3));
    const k = (15 * 300) / 20; // 225 kN/m
    // The south line is reeled in past its stroke (slack); the north line is paid out past S: T = W + k·(u − S) = F
    const u = 3 + (100 - 10) / k;
    expect(r.maxDrift_m).toBeCloseTo(u, 2);
    expect(r.governing.maxTension_kN).toBeCloseTo(100, 1);
    expect(r.deviceTravel!.payOut_m).toBeCloseTo(u, 2);
    expect(r.deviceTravel!.reelIn_m).toBeCloseTo(u, 2);
    expect(r.unconverged).toBe(0);
  });

  it('a load below the set tension stays within the stroke and every line holds exactly W', () => {
    // perpendicular load: the geometric stiffness 2·W·u/d balances F = 15 kN at a small offset
    const r = analyseMooring({ ...base(100, 8), force_kN: 15, lines: [
      { code: 'E', type: 'SHORE', azimuth_deg: 90, span_m: 20, pin_m: 650.35 },
      { code: 'W', type: 'SHORE', azimuth_deg: 270, span_m: 20, pin_m: 650.35 }
    ] });
    // 2 W u / sqrt(L² + u²) = 15  ->  u = 1.5 m (u/d = 0.075 -> u = 1.4983 m)
    const ratio = 15 / (2 * 100);
    const u = (20 * ratio) / Math.sqrt(1 - ratio * ratio);
    expect(r.maxDrift_m).toBeCloseTo(u, 2);
    expect(r.governing.maxTension_kN).toBeCloseTo(100, 3);
  });
});
