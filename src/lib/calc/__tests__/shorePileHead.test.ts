import { describe, it, expect } from 'vitest';
import DxfParser from 'dxf-parser';
import { designShorePileHead } from '../shorePileHead';
import { buildShorePileHead } from '../../io/shorePileHeadDetail';
import { buildPileSchedule } from '../../io/pileSchedule';
import { buildMooringPileDxf, DXF_LAYERS } from '../../io/dxfExport';
import { calculateProject } from '../index';
import { buildRaftProjectState } from '../raftState';
import type { ProjectState } from '../types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const setup = () => {
  const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const batch = HUOI_VANH_RAFTS.map((raft) => {
    const st = buildRaftProjectState(state, raft, dflt().anchor);
    return { raft, state: st, results: calculateProject(st) };
  });
  const results = calculateProject(state);
  return { state, results, batch, rows: buildPileSchedule(state, results, batch) };
};

describe('Shore pile head and cable connection', () => {
  it('puts the cable pin exactly at the height the pile design requires', () => {
    const h = designShorePileHead({ tension_kN: 113.1, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1, cableMbl_kN: 688 });
    expect(h.pinAboveGround_mm).toBe(100);
    expect(h.pileTopAboveGround_mm + h.plateThk_mm + h.holeAbovePlate_mm).toBe(100);
    expect(h.checks.find((c) => c.id === 'H-8')!.ok).toBe(true);
    // a design that needs a lower pin than the hardware allows is reported, not hidden
    const low = designShorePileHead({ tension_kN: 113.1, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.05 });
    expect(low.pinAboveGround_mm).toBeGreaterThan(50);
    expect(low.checks.find((c) => c.id === 'H-8')!.ok).toBe(false);
    expect(low.ok).toBe(false);
  });

  it('hand check of the padeye, the weld and the anchor bars', () => {
    const h = designShorePileHead({ tension_kN: 113.1, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1, cableMbl_kN: 688 });
    expect(h.designPull_kN).toBeCloseTo(135.72, 2);
    const by = (id: string) => h.checks.find((c) => c.id === id)!;
    // shackle: 113.1 kN = 11.53 t -> WLL 12 t (pin 35), breaking 72 t >= cable 688 kN = 70.1 t
    expect([h.shackleWll_t, h.shacklePin_mm, h.holeDia_mm]).toEqual([12, 35, 39]);
    expect(by('H-2').capacity).toBe(72);
    // bearing: 35 x 25 x 210 MPa = 183.75 kN
    expect(by('H-3').capacity).toBeCloseTo(183.75, 2);
    // tear-out: 2 x (100 - 19.5) x 25 x 0.58 x 210 = 490.2 kN
    expect(by('H-4').capacity).toBeCloseTo(490.2, 1);
    // weld: throat 7 mm, two lines of 200 mm; shear 135.72e3 / 2800 = 48.5 MPa, bending 135.72e3 x 60 / 93 333 = 87.2 MPa
    expect(by('H-5').demand).toBeCloseTo(Math.hypot(48.47, 87.25), 1);
    // anchor bars: couple 135.72 x 80 mm on 180 mm -> 30.2 kN per bar; shear 33.9 kN per bar
    const A = Math.PI * 22 * 22 / 4;
    expect(by('H-6').demand).toBeCloseTo((30.16 / (A * 350 / 1000)) ** 2 + (33.93 / (A * 280 / 1000)) ** 2, 3);
    expect(by('H-7').demand).toBe(330); // 15 d governs
    expect(h.ok).toBe(true);
  });

  it('a heavier pull needs a bigger shackle and uses more of every component', () => {
    const a = designShorePileHead({ tension_kN: 80, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1 });
    const b = designShorePileHead({ tension_kN: 160, loadFactor: 1.2, pileDia_m: 0.35, attachHeight_m: 0.1 });
    expect(b.shackleWll_t).toBeGreaterThan(a.shackleWll_t);
    expect(b.checks.find((c) => c.id === 'H-5')!.utilization).toBeGreaterThan(a.checks.find((c) => c.id === 'H-5')!.utilization);
  });

  it('for Huổi Vanh it is sized for the most loaded shore pile and the heaviest cable, and every check passes', () => {
    const { state, rows, batch } = setup();
    const h = buildShorePileHead(state, rows, batch)!;
    const maxPerPile = Math.max(...batch.map((b) => b.results.shorePileTension_kN!));
    expect(h.designPull_kN).toBeCloseTo(1.2 * maxPerPile, 1);
    expect(h.pileDia_mm).toBe(350);
    expect(h.pinAboveGround_mm).toBe(100);
    expect(h.checks.every((c) => c.ok)).toBe(true);
    // one pile per point at the 20 m/s default: the most loaded pile carries the largest line tension
    expect(maxPerPile).toBeLessThanOrEqual(Math.max(...batch.map((b) => b.results.t_max_intact_kN)));
    // not applicable to a square precast shore pile
    const sq: ProjectState = { ...state, anchor: { ...state.anchor, shorePileShape: 'square' } };
    expect(buildShorePileHead(sq, buildPileSchedule(sq, calculateProject(sq)), undefined)).toBeUndefined();
  });

  it('is drawn on the detail layer of the CAD sheet with its checks and the height requirement', () => {
    const { state, results, batch } = setup();
    const out = buildMooringPileDxf(state, results, batch);
    expect(/[^\x0A\x20-\x7E]/.test(out.dxf)).toBe(false);
    const doc = new DxfParser().parseSync(out.dxf)!;
    const detail = doc.entities.filter((e: any) => e.layer === DXF_LAYERS.detail.name && e.type === 'TEXT').map((e: any) => e.text as string);
    expect(detail.some((t) => t.includes('CHI TIET DAU COC KHOAN NHOI BO D350 VA TAI NEO CAP'))).toBe(true);
    expect(detail.some((t) => t.includes('e = 100 mm'))).toBe(true);
    expect(detail.some((t) => t.includes('Ban ma 400x400x20'))).toBe(true);
    expect(detail.some((t) => t.includes('4D22 CB400-V'))).toBe(true);
    expect(detail.filter((t) => /^H-\d  /.test(t))).toHaveLength(8);
    expect(detail.filter((t) => /^H-\d  /.test(t)).every((t) => t.endsWith('DAT') && !t.endsWith('KHONG DAT'))).toBe(true);
    expect(detail.some((t) => t.includes('YEU CAU: tim chot cap cach mat dat <= 100 mm'))).toBe(true);
    expect(detail.some((t) => t.includes('CHI TIET DE XUAT'))).toBe(true);
  });
});
