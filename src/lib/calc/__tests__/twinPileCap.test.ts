import { describe, it, expect } from 'vitest';
import { designTwinPileCap } from '../twinPileCap';
import { designShorePileHead } from '../shorePileHead';

describe('Twin shore pile cap and lake-bed padeye (Hồ Bản Mòng)', () => {
  const cap = designTwinPileCap({ tension_kN: 107, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1, cableMbl_kN: 385, pileBarDia_mm: 25 });

  it('hand check of the cap beam', () => {
    expect(cap.designPull_kN).toBeCloseTo(128.4, 6);
    // piles 3D = 1050 mm apart, beam 1050 + 350 + 300 long, 350 + 300 wide, deep enough for 20d hooks of Φ25
    expect([cap.spacing_mm, cap.length_mm, cap.width_mm, cap.depth_mm]).toEqual([1050, 1700, 650, 700]);
    const by = (id: string) => cap.checks.find((c) => c.id === id)!;
    // TC-1: M = 128.4 × 1.05 / 4 = 33.7 kNm; As = 33.7e6 / (0.9 × 590 × 350) = 181.4 mm² <= 3Φ16 = 603 mm²
    expect(by('TC-1').demand).toBeCloseTo(33.705e6 / (0.9 * 590 * 350), 1);
    expect(by('TC-1').capacity).toBeCloseTo(3 * Math.PI * 64, 1);
    // TC-2: V = 64.2 kN <= 0.5 × 1.05 × 700 × 590 = 216.8 kN
    expect(by('TC-2').demand).toBeCloseTo(64.2, 6);
    expect(by('TC-2').capacity).toBeCloseTo(216.83, 1);
    // TC-3: z = 100 + 350 mm, T = 128.4 × 0.45 / 2 = 28.9 kNm per half
    expect(by('TC-3').demand).toBeCloseTo(28.89, 2);
    // TC-4: hooked lead 20 × 25 = 500 mm in 700 - 100 - 50 - 20 = 530 mm
    expect([by('TC-4').demand, by('TC-4').capacity]).toEqual([500, 530]);
    expect(cap.ok).toBe(true);
    expect(cap.concrete_m3).toBeCloseTo(0.7735, 4);
  });

  it('a steep cable on a base pulls the padeye plate off: uplift goes into the anchor bars', () => {
    const flat = designShorePileHead({ tension_kN: 82.6, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.15, cableMbl_kN: 385, anchorLengthLimit_mm: 350 });
    const steep = designShorePileHead({ tension_kN: 82.6, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.15, cableMbl_kN: 385, inclination_deg: 45, anchorLengthLimit_mm: 350 });
    const bars = (h: typeof flat) => h.checks.find((c) => c.id === 'H-6')!.demand;
    expect(steep.anchorBarLength_mm).toBe(350);
    // at 45° the couple shrinks by cos 45° but every bar also carries Pv / 4
    const P = 82.6 * 1.2, arm = steep.holeAbovePlate_mm + steep.plateThk_mm;
    const t45 = (P * Math.SQRT1_2 * arm) / 180 / 2 + (P * Math.SQRT1_2) / 4;
    const area = Math.PI * 22 * 22 / 4;
    expect(bars(steep)).toBeCloseTo((t45 / (area * 0.35)) ** 2 + ((P * Math.SQRT1_2) / 4 / (area * 0.28)) ** 2, 4);
    expect(steep.ok && flat.ok).toBe(true);
    // without the new inputs the pile head is unchanged
    const a = designShorePileHead({ tension_kN: 113.1, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1, cableMbl_kN: 688 });
    const b = designShorePileHead({ tension_kN: 113.1, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1, cableMbl_kN: 688, inclination_deg: 0 });
    expect(b).toEqual(a);
  });
});
