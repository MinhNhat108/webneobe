import { describe, it, expect } from 'vitest';
import { sizeDeadweightBlock, evaluateDeadweightBlock, G_MS2 } from '../deadweight';
import { compareMooringOptions, DEFAULT_COST_INPUTS } from '../optionComparison';
import { buildRaftProjectState } from '../raftState';
import { calculateProject } from '../index';
import { HUOI_VANH_RAFTS, HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { buildPileModels, buildBlockAnchors, blockUtilisation } from '../../../components/simulation/sceneModel';
import type { ProjectState } from '../types';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const start = () => buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const compare = (costs = DEFAULT_COST_INPUTS) => compareMooringOptions(start(), 1, HUOI_VANH_RAFTS, dflt().anchor, costs);

describe('Gravity block (PA2) sizing', () => {
  it('reproduces the hand calculation: T = 100 kN at 30°, μ = 0.35, SF 1.5 / 1.5', () => {
    const b = sizeDeadweightBlock({ tension_kN: 100, cableAngle_deg: 30 });
    expect(b.H_kN).toBeCloseTo(86.603, 3);
    expect(b.V_kN).toBeCloseTo(50, 6);
    expect(b.buoyancyFactor).toBeCloseTo(1 - 1 / 2.4, 12);
    // uplift: 1.5·50 / (0.58333·9.81) = 13.106 t ; sliding: (1.5·86.603/0.35 + 50) / (0.58333·9.81) = 73.597 t
    expect(b.massUplift_t).toBeCloseTo(13.106, 2);
    expect(b.massSlide_t).toBeCloseTo(73.597, 2);
    expect(b.governing).toBe('sliding');
    expect(b.designMass_t).toBe(74); // rounded UP to 0.5 t
  });

  it('never rounds down: the box as built is at least the design mass and meets both safety factors', () => {
    for (const [T, a] of [[60, 20], [83.49, 27.3], [216.74, 34], [138.33, 51.1], [150, 80]] as const) {
      const b = sizeDeadweightBlock({ tension_kN: T, cableAngle_deg: a });
      expect(b.designMass_t).toBeGreaterThanOrEqual(Math.max(b.massUplift_t, b.massSlide_t));
      expect(b.mass_t).toBeGreaterThanOrEqual(b.designMass_t - 1e-9);
      expect(b.volume_m3).toBeCloseTo(b.L_m * b.W_m * b.H_m, 9);
      expect(b.weightSub_kN).toBeCloseTo(b.mass_t * b.buoyancyFactor * G_MS2, 9);
      expect(b.sfSlide).toBeGreaterThanOrEqual(1.5);
      expect(b.sfUplift).toBeGreaterThanOrEqual(1.5);
      expect(b.ok).toBe(true);
    }
  });

  it('is governed by uplift for a near-vertical cable and by sliding for a flat one', () => {
    expect(sizeDeadweightBlock({ tension_kN: 100, cableAngle_deg: 89 }).governing).toBe('uplift');
    expect(sizeDeadweightBlock({ tension_kN: 100, cableAngle_deg: 10 }).governing).toBe('sliding');
  });

  it('needs a heavier block on a slicker bed', () => {
    const m = (mu: number) => sizeDeadweightBlock({ tension_kN: 100, cableAngle_deg: 30, mu }).designMass_t;
    expect(m(0.25)).toBeGreaterThan(m(0.35));
    expect(m(0.35)).toBeGreaterThan(m(0.5));
  });

  it('a block lifted off the bed has no sliding resistance', () => {
    const b = sizeDeadweightBlock({ tension_kN: 100, cableAngle_deg: 30 });
    const e = evaluateDeadweightBlock(b, 5000, 60);
    expect(e.sfUplift).toBeLessThan(1);
    expect(e.sfSlide).toBe(0);
  });
});

describe('PA1 / PA2 comparison for Huổi Vanh', () => {
  it('uses the engine tension and bed cable angle of every raft', () => {
    const c = compare();
    expect(c.rows).toHaveLength(12);
    expect(c.shoreCount).toBe(129);
    expect(c.bedCount).toBe(175);
    for (const row of c.rows) {
      const item = HUOI_VANH_RAFTS.find((r) => r.name === row.name)!;
      const r = calculateProject(buildRaftProjectState(dflt(), item, dflt().anchor));
      expect(row.tension_kN, row.name).toBe(r.t_max_intact_kN);
      expect(row.bedCableAngle_deg, row.name).toBe(r.bedCableAngle_deg);
      expect(row.block.ok, row.name).toBe(true);
    }
  });

  it('PA1 concrete is the sum of a² × (L_tk + stick-up) over the catalogue', () => {
    const c = compare();
    const a = dflt().anchor;
    const bed = HUOI_VANH_RAFTS.reduce((s, r) => s + r.bedAnchors * r.bedPileD_m! ** 2 * (r.bedPileL_m! + (a.bed1Stickup_m ?? 0)), 0);
    const shore = HUOI_VANH_RAFTS.reduce((s, r) => s + r.shoreAnchors * r.shorePileD_m! ** 2 * (r.shorePileL_m! + (a.shoreArm_e_m ?? 0)), 0);
    expect(c.pa1Bed.concrete_m3).toBeCloseTo(bed, 6);
    expect(c.shorePiles.concrete_m3).toBeCloseTo(shore, 6);
  });

  it('pins the computed quantities, not the estimates of the brief: blocks 52–158 t, ~6 550 m³ against ~396 m³ of bed piles', () => {
    const c = compare();
    expect(c.blockMassMin_t).toBeGreaterThan(50);
    expect(c.blockMassMax_t).toBeGreaterThan(150);
    expect(c.blockMassMax_t).toBeLessThan(165);
    expect(c.pa1Bed.concrete_m3).toBeCloseTo(396.5, 0);
    expect(c.pa2Bed.concrete_m3).toBeGreaterThan(6000);
    expect(c.pa2Bed.concrete_m3).toBeLessThan(7000);
    expect(c.blocksOverCrane).toBe(175); // every block exceeds a 50 t crane
    expect(c.totalLifts).toBeGreaterThan(175);
  });

  it('adds up: total = shore piles + bed anchors, delta = PA2 − PA1, shore piles cancel out', () => {
    const c = compare();
    for (const b of [c.shorePiles, c.pa1Bed, c.pa2Bed]) expect(b.total_vnd).toBeCloseTo(b.material_vnd + b.installation_vnd, 3);
    expect(c.pa1Total_vnd).toBeCloseTo(c.shorePiles.total_vnd + c.pa1Bed.total_vnd, 3);
    expect(c.pa2Total_vnd).toBeCloseTo(c.shorePiles.total_vnd + c.pa2Bed.total_vnd, 3);
    expect(c.delta_vnd).toBeCloseTo(c.pa2Bed.total_vnd - c.pa1Bed.total_vnd, 3);
    expect(c.pa1Bed.installation_vnd).toBe(175 * DEFAULT_COST_INPUTS.pileDriving_vnd);
    expect(c.pa2Bed.installation_vnd).toBe(c.totalLifts * DEFAULT_COST_INPUTS.blockLift_vnd);
    expect(c.cheaper).toBe('PA1_PILE');
  });

  it('follows the price assumptions instead of a fixed verdict', () => {
    const base = compare();
    const dearPiles = compare({ ...DEFAULT_COST_INPUTS, pileDriving_vnd: 500_000_000 });
    expect(dearPiles.pa1Total_vnd).toBeGreaterThan(base.pa1Total_vnd);
    expect(dearPiles.cheaper).toBe('PA2_DEADWEIGHT');
    const bigCrane = compare({ ...DEFAULT_COST_INPUTS, craneCapacity_t: 200 });
    expect(bigCrane.blocksOverCrane).toBe(0);
    expect(bigCrane.totalLifts).toBe(175);
  });
});

describe('PA2 in the 3D scene', () => {
  it('turns the 175 lake-bed anchors into blocks on the bed and leaves the 129 shore piles alone', () => {
    const blocks = buildBlockAnchors(start(), 1, DEFAULT_COST_INPUTS);
    const pa1 = buildPileModels();
    const pa2 = buildPileModels({}, undefined, blocks);
    expect(pa2).toHaveLength(304);
    pa2.forEach((p, i) => {
      expect([p.x, p.y, p.ground_m], p.code).toEqual([pa1[i].x, pa1[i].y, pa1[i].ground_m]);
      if (p.type === 'SHORE') {
        expect(p.block, p.code).toBeUndefined();
        expect(p, p.code).toEqual(pa1[i]);
      } else {
        const b = blocks.get(p.raft)!.block;
        expect(p.side_m, p.code).toBe(b.L_m);
        expect(p.toe_m, p.code).toBe(p.ground_m); // rests on the bed, not embedded
        expect(p.head_m - p.ground_m, p.code).toBeCloseTo(b.H_m, 9);
      }
    });
    expect(pa2.filter((p) => p.block)).toHaveLength(175);
  });

  it('block utilisation is ≤ 1 at the design tension and grows with the load', () => {
    const blocks = buildBlockAnchors(start(), 1, DEFAULT_COST_INPUTS);
    const c = compare();
    for (const row of c.rows) {
      const b = blocks.get(row.name)!;
      const u = blockUtilisation(b, row.tension_kN, DEFAULT_COST_INPUTS);
      expect(u, row.name).toBeLessThanOrEqual(1);
      expect(blockUtilisation(b, row.tension_kN * 1.3, DEFAULT_COST_INPUTS), row.name).toBeGreaterThan(1);
    }
  });
});
