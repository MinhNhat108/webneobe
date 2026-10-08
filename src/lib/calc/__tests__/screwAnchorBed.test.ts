import { describe, it, expect } from 'vitest';
import { designScrewBase, evaluateScrewBase, SCREW_BASE_DEFAULTS, SCREW_BASE_MAX_SIDE_M } from '../screwAnchorBed';

// The reference case of sheet 6.DE_NEO_VIT: bed 377.0, low water 378.5, high water 384.0, span 13.5 m, T = 70 kN.
const SHEET = { tension_kN: 70, span_m: 13.5, depthLow_m: 1.5, depthHigh_m: 7.0 };

describe('screw-pile base — owner workbook, sheet 6.DE_NEO_VIT', () => {
  const r = evaluateScrewBase(SHEET, 2.5, 0.4);
  const [low, high] = r.cases;

  it('reproduces the cable components of both load cases', () => {
    expect(low.angle_deg).toBeCloseTo(4.0253, 3);
    expect(high.angle_deg).toBeCloseTo(25.5374, 3);
    expect(low.Th_kN).toBeCloseTo(69.8273, 3);
    expect(high.Th_kN).toBeCloseTo(63.1613, 3);
    expect(low.Tv_kN).toBeCloseTo(4.9138, 3);
    expect(high.Tv_kN).toBeCloseTo(30.177, 3);
  });

  it('reproduces the base weight and the screw capacities', () => {
    expect(r.weightAir_kN).toBeCloseTo(62.5, 6);
    expect(r.weightSub_kN).toBeCloseTo(37.5, 6);
    expect(r.holeSpacing_m).toBeCloseTo(2.2, 9);
    expect(r.screwShaftFriction_kN).toBeCloseTo(15.8336, 3);
    expect(r.screwSteelTension_kN).toBeCloseTo(310.0752, 3);
    expect(r.screwQa_kN).toBeCloseTo(7.9168, 3);
    expect(r.screwHuSoil_kN).toBeCloseTo(20.6194, 3);
    expect(r.screwHuSteel_kN).toBeCloseTo(14.985, 3);
    expect(r.screwHu_kN).toBeCloseTo(14.985, 3);
    expect(r.holeFits).toBe(true);
  });

  it('reproduces checks E1–E5 and F', () => {
    expect(low.upliftResistance_kN).toBeCloseTo(65.4173, 3);
    expect(low.upliftUtil).toBeCloseTo(0.0751, 3);
    expect(high.upliftUtil).toBeCloseTo(0.4613, 3);
    expect(low.slideResistance_kN).toBeCloseTo(137.6086, 3);
    expect(low.slideUtil).toBeCloseTo(0.7612, 3);
    expect(high.slideUtil).toBeCloseTo(0.6885, 3);
    expect(low.overturningMoment_kNm).toBeCloseTo(44.5472, 3);
    expect(high.overturningMoment_kNm).toBeCloseTo(72.46, 2);
    expect(low.resistingMoment_kNm).toBeCloseTo(126.0431, 3);
    expect(high.overturnUtil).toBeCloseTo(0.8623, 3);
    expect(low.screwPull_kN).toBeCloseTo(0.5021, 3);
    expect(high.screwPull_kN).toBeCloseTo(6.441, 3);
    expect(high.screwUtil).toBeCloseTo(0.8136, 3);
    expect(r.bearingPressure_kPa).toBeCloseTo(6, 6);
    expect(r.bearingAllow_kPa).toBeCloseTo(41.12, 6);
    expect(r.slabMoment_kNm_m).toBeCloseTo(13.9336, 3);
    expect(r.rebarRequired_mm2).toBeCloseTo(170.1293, 2);
    expect(r.rebarMin_mm2).toBeCloseTo(350, 6);
    expect(r.rebarProvided_mm2).toBeCloseTo(565.4867, 3);
    expect(r.ok).toBe(true);
  });

  it('reproduces the quantities of one base', () => {
    expect(r.concrete_m3).toBeCloseTo(2.4819, 3);
    expect(r.rebar_kg).toBeCloseTo(119.4117, 2);
    expect(r.liftMass_t).toBeCloseTo(6.371, 3);
    expect(r.screwTotalLength_m).toBeCloseTo(14.8, 6);
  });
});

describe('screw-pile base — sizing', () => {
  it('keeps the workbook base when it passes', () => {
    const r = designScrewBase(SHEET);
    expect([r.side_m, r.thickness_m, r.enlarged, r.ok]).toEqual([2.5, 0.4, false, true]);
  });

  it('the 2.5 × 0.4 m base does NOT hold a 120 kN line; the sizing enlarges it until it does', () => {
    const load = { ...SHEET, tension_kN: 120 };
    expect(evaluateScrewBase(load, 2.5, 0.4).ok).toBe(false);
    const r = designScrewBase(load);
    expect(r.ok).toBe(true);
    expect(r.enlarged).toBe(true);
    expect(r.side_m).toBeGreaterThan(2.5);
    expect(Math.max(r.upliftUtil, r.slideUtil, r.overturnUtil, r.screwUtil, r.bearingUtil, r.rebarUtil)).toBeLessThanOrEqual(1);
  });

  it('a wider base needs more slab steel than the minimum mesh once it is thick', () => {
    const r = designScrewBase({ ...SHEET, tension_kN: 220 });
    expect(r.ok).toBe(true);
    expect(r.rebarProvided_mm2).toBeGreaterThanOrEqual(Math.max(r.rebarRequired_mm2, r.rebarMin_mm2));
  });

  it('a short, steep cable is worse for the base than a long one', () => {
    const steep = designScrewBase({ ...SHEET, tension_kN: 100, span_m: 6 });
    const flat = designScrewBase({ ...SHEET, tension_kN: 100, span_m: 17.5 });
    expect(steep.cases[1].Tv_kN).toBeGreaterThan(flat.cases[1].Tv_kN);
    expect(steep.volume_m3).toBeGreaterThanOrEqual(flat.volume_m3);
  });

  it('without auto-sizing it reports the failure instead of changing the base', () => {
    const r = designScrewBase({ ...SHEET, tension_kN: 150, autoSize: false });
    expect([r.side_m, r.thickness_m]).toEqual([2.5, 0.4]);
    expect(r.ok).toBe(false);
  });

  it('never returns a passing verdict for a load no base up to the limit can hold', () => {
    const r = designScrewBase({ ...SHEET, tension_kN: 5000 });
    expect(r.ok).toBe(false);
    expect(r.side_m).toBeLessThanOrEqual(SCREW_BASE_MAX_SIDE_M);
  });

  it('soft surface mud removes most of the sliding resistance', () => {
    const firm = evaluateScrewBase(SHEET, 2.5, 0.4);
    const soft = evaluateScrewBase({ ...SHEET, cuSurface_kPa: 5, cuAverage_kPa: 5 }, 2.5, 0.4);
    expect(soft.slideUtil).toBeGreaterThan(firm.slideUtil * 2);
    expect(soft.ok).toBe(false);
    expect(SCREW_BASE_DEFAULTS.cuSurface_kPa).toBe(20);
  });
});
