import { describe, it, expect } from 'vitest';
import { sizeDeadweightBlock, evaluateDeadweightBlock, deadweightOk, DEADWEIGHT_DEFAULTS, G_MS2 } from '../deadweight';
import { compareMooringOptions } from '../technicalComparison';
import { buildRaftProjectState } from '../raftState';
import { calculateProject } from '../index';
import { HUOI_VANH_RAFTS, HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import { buildPileModels, buildBlockAnchors, blockUtilisation, computeRaftMooringStates } from '../../../components/simulation/sceneModel';
import type { ProjectState } from '../types';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const start = () => buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const pa2 = (s: ProjectState = start()): ProjectState => ({ ...s, anchor: { ...s.anchor, bedAnchorOption: 'PA2_DEADWEIGHT' } });
const compare = (s: ProjectState = start()) => compareMooringOptions(s, 1, HUOI_VANH_RAFTS, dflt().anchor);

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

  it('never rounds down: the box as built is at least the design mass and meets all four criteria', () => {
    for (const [T, a] of [[60, 20], [83.49, 27.3], [216.74, 34], [138.33, 51.1], [150, 80]] as const) {
      const b = sizeDeadweightBlock({ tension_kN: T, cableAngle_deg: a });
      const p = b.params;
      expect(b.designMass_t).toBeGreaterThanOrEqual(Math.max(b.massUplift_t, b.massSlide_t));
      expect(b.mass_t).toBeGreaterThanOrEqual(b.designMass_t - 1e-9);
      expect(b.volume_m3).toBeCloseTo(b.L_m * b.W_m * b.H_m, 9);
      expect(b.baseArea_m2).toBeCloseTo(b.L_m * b.W_m, 9);
      expect(b.weightAir_kN).toBeCloseTo(b.mass_t * G_MS2, 9);
      expect(b.weightSub_kN).toBeCloseTo(b.mass_t * b.buoyancyFactor * G_MS2, 9);
      expect(b.sfSlide).toBeGreaterThanOrEqual(p.sfSlide);
      expect(b.sfUplift).toBeGreaterThanOrEqual(p.sfUplift);
      expect(b.sfOverturn).toBeGreaterThanOrEqual(p.sfOverturn);
      expect(b.qContact_kPa).toBeLessThanOrEqual(p.qAllow_kPa);
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

  it('mud pressure: hand check of the still-water and edge pressures', () => {
    // 4 × 4 × 2 m block, ρ_c 2.4: W_sub = 32·2.4·0.58333·9.81 = 439.49 kN.
    const blk = { weightSub_kN: 32 * 2.4 * (1 - 1 / 2.4) * G_MS2, L_m: 4, W_m: 4, H_m: 2 };
    const e = evaluateDeadweightBlock(blk, 100, 30);
    expect(e.qStatic_kPa).toBeCloseTo(439.49 / 16, 2);
    // N = 439.49 − 50 = 389.49; e = 86.603·2 / 389.49 = 0.4447 m ≤ L/6; q_edge = N/A · (1 + 6e/L)
    expect(e.qEdge_kPa).toBeCloseTo((389.49 / 16) * (1 + (6 * 0.4447) / 4), 1);
    expect(e.qContact_kPa).toBe(Math.max(e.qStatic_kPa, e.qEdge_kPa));
    expect(e.sfOverturn).toBeCloseTo((389.49 * 2) / (86.603 * 2), 2);
  });

  it('a softer bed gives a wider, flatter block of the same mass class; an impossible bed is reported, not hidden', () => {
    const firm = sizeDeadweightBlock({ tension_kN: 120, cableAngle_deg: 35, qAllow_kPa: 200 });
    const soft = sizeDeadweightBlock({ tension_kN: 120, cableAngle_deg: 35, qAllow_kPa: 30 });
    expect(firm.bearingGovernsShape).toBe(false);
    expect(soft.bearingGovernsShape).toBe(true);
    expect(soft.baseArea_m2).toBeGreaterThan(firm.baseArea_m2);
    expect(soft.H_m).toBeLessThan(firm.H_m);
    expect(soft.designMass_t).toBe(firm.designMass_t);
    expect(soft.ok).toBe(true);

    const mud = sizeDeadweightBlock({ tension_kN: 120, cableAngle_deg: 35, qAllow_kPa: 3 });
    expect(mud.ok).toBe(false);
    expect(mud.qContact_kPa).toBeGreaterThan(3);
  });

  it('a block lifted off the bed has no sliding or overturning resistance', () => {
    const b = sizeDeadweightBlock({ tension_kN: 100, cableAngle_deg: 30 });
    const e = evaluateDeadweightBlock(b, 5000, 60);
    expect(e.sfUplift).toBeLessThan(1);
    expect(e.sfSlide).toBe(0);
    expect(e.sfOverturn).toBe(0);
    expect(deadweightOk(e, DEADWEIGHT_DEFAULTS)).toBe(false);
  });
});

describe('PA2 in the calculation engine (checks DW-1..DW-4)', () => {
  it('PA1 (default) is untouched: no block, no DW rows, BP-3..BP-5 evaluated', () => {
    const r = calculateProject(start());
    expect(r.bedBlock).toBeUndefined();
    expect(r.checks.some((c) => c.id.startsWith('DW-'))).toBe(false);
    for (const id of ['BP-3', 'BP-4', 'BP-5']) expect(r.checks.find((c) => c.id === id)!.status, id).toBe('PASS');
    expect(calculateProject({ ...start(), anchor: { ...start().anchor, bedAnchorOption: 'PA1_PILE' } })).toEqual(r);
  });

  it('PA2 replaces the lake-bed pile checks with the four block checks and keeps the shore pile checks', () => {
    for (const item of HUOI_VANH_RAFTS) {
      const s = pa2(buildRaftProjectState(dflt(), item, dflt().anchor));
      const r = calculateProject(s);
      const pa1 = calculateProject({ ...s, anchor: { ...s.anchor, bedAnchorOption: 'PA1_PILE' } });
      const status = (id: string) => r.checks.find((c) => c.id === id)?.status;
      for (const id of ['BP-3', 'BP-4', 'BP-5', 'C11']) expect(status(id), `${item.name} ${id}`).toBe('SKIP');
      const verdict = 'PASS';
      for (const id of ['DW-1', 'DW-2', 'DW-3', 'DW-4']) expect(status(id), `${item.name} ${id}`).toBe('PASS');
      for (const id of ['BP-1', 'BP-2']) {
        expect(r.checks.find((c) => c.id === id), `${item.name} ${id}`).toEqual(pa1.checks.find((c) => c.id === id));
      }
      expect(r.t_max_intact_kN, item.name).toBe(pa1.t_max_intact_kN); // the loads do not depend on the anchor type
      expect(r.overallVerdict, item.name).toBe(verdict);
      const b = r.bedBlock!;
      expect(r.checks.find((c) => c.id === 'DW-1')!.utilization).toBeCloseTo(b.params.sfSlide / b.sfSlide, 9);
      expect(r.checks.find((c) => c.id === 'DW-4')!.utilization).toBeCloseTo(b.qContact_kPa / b.params.qAllow_kPa, 9);
    }
  });

  it('uses the project block parameters, and FAILS the raft when no block can satisfy them', () => {
    const base = pa2();
    const slick = calculateProject({ ...base, anchor: { ...base.anchor, deadweight: { mu: 0.2 } } });
    expect(slick.bedBlock!.mass_t).toBeGreaterThan(calculateProject(base).bedBlock!.mass_t);
    const noBearing = calculateProject({ ...base, anchor: { ...base.anchor, deadweight: { qAllow_kPa: 3 } } });
    expect(noBearing.checks.find((c) => c.id === 'DW-4')!.status).toBe('FAIL');
    expect(noBearing.overallVerdict).toBe('FAIL');
  });
});

describe('PA1 / PA2 technical comparison for Huổi Vanh', () => {
  it('uses the engine tension and bed cable angle of every raft, whichever option is selected', () => {
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
      expect(row.bedPileUtil, row.name).toBeLessThanOrEqual(1);
    }
    expect(compare(pa2())).toEqual(c);
  });

  it('PA1 concrete is the sum of a² × (L_tk + stick-up) over the catalogue', () => {
    const c = compare();
    const a = dflt().anchor;
    // piles per anchor point: 2 on BÈ 5 (twin piles), 1 elsewhere
    const bed = HUOI_VANH_RAFTS.reduce((s, r) => s + r.bedAnchors * (r.bedPilesPerPoint ?? 1) * r.bedPileD_m! ** 2 * (r.bedPileL_m! + (a.bed1Stickup_m ?? 0)), 0);
    const shore = HUOI_VANH_RAFTS.reduce((s, r) => s + r.shoreAnchors * (r.shorePilesPerPoint ?? 1) * r.shorePileD_m! ** 2 * (r.shorePileL_m! + (a.shoreArm_e_m ?? 0)), 0);
    expect(c.shorePileCount).toBe(141);
    expect(c.pa1BedPileCount).toBe(202);
    expect(c.pa1BedConcrete_m3).toBeCloseTo(bed, 6);
    expect(c.shoreConcrete_m3).toBeCloseTo(shore, 6);
  });

  it('pins the computed quantities at the 12° tilt: blocks 42–129 t against 350 mm piles of 2.6–3.4 t, ~5 380 m³ against ~259 m³', () => {
    const c = compare();
    expect(c.blockMass_t[0]).toBeGreaterThan(40);
    expect(c.blockMass_t[0]).toBeLessThan(45);
    expect(c.blockMass_t[1]).toBeGreaterThan(125);
    expect(c.blockMass_t[1]).toBeLessThan(135);
    expect(c.bedPileSide_m).toEqual([0.35, 0.35]);
    expect(c.bedPileMass_t[1]).toBeLessThan(3.5);
    expect(c.pa1BedConcrete_m3).toBeCloseTo(259.4, 0);
    expect(c.pa2BedConcrete_m3).toBeGreaterThan(5000);
    expect(c.pa2BedConcrete_m3).toBeLessThan(5800);
    expect(c.concreteRatio).toBeCloseTo(c.pa2BedConcrete_m3 / c.pa1BedConcrete_m3, 9);
    expect(c.pa2BedFootprint_m2).toBeGreaterThan(50 * c.pa1BedFootprint_m2);
    expect(c.allBlocksOk).toBe(true);
    expect(c.failingRafts).toEqual([]);
  });

  it('follows the block parameters of the project', () => {
    const s = start();
    const slick = compare({ ...s, anchor: { ...s.anchor, deadweight: { mu: 0.25 } } });
    expect(slick.params.mu).toBe(0.25);
    expect(slick.pa2BedConcrete_m3).toBeGreaterThan(compare().pa2BedConcrete_m3);
    expect(slick.pa1BedConcrete_m3).toBe(compare().pa1BedConcrete_m3);
  });
});

describe('PA2 in the 3D scene', () => {
  it('turns the 175 lake-bed anchors into blocks on the bed and leaves the 129 shore piles alone', () => {
    const blocks = buildBlockAnchors(pa2(), 1);
    const p1 = buildPileModels();
    const p2 = buildPileModels({}, undefined, blocks);
    expect(p2).toHaveLength(304);
    p2.forEach((p, i) => {
      expect([p.x, p.y, p.ground_m], p.code).toEqual([p1[i].x, p1[i].y, p1[i].ground_m]);
      if (p.type === 'SHORE') {
        expect(p.block, p.code).toBeUndefined();
        expect(p, p.code).toEqual(p1[i]);
      } else {
        const b = blocks.get(p.raft)!.block;
        expect(p.side_m, p.code).toBe(b.L_m);
        expect(p.toe_m, p.code).toBe(p.ground_m); // rests on the bed, not embedded
        expect(p.head_m - p.ground_m, p.code).toBeCloseTo(b.H_m, 9);
      }
    });
    expect(p2.filter((p) => p.block)).toHaveLength(175);
  });

  it('the 3D blocks are the blocks the engine checks', () => {
    const s = pa2();
    const blocks = buildBlockAnchors(s, 1);
    for (const item of HUOI_VANH_RAFTS) {
      const r = calculateProject(pa2(buildRaftProjectState(dflt(), item, dflt().anchor)));
      const b = blocks.get(item.name)!.block;
      expect([b.L_m, b.H_m], item.name).toEqual([r.bedBlock!.L_m, r.bedBlock!.H_m]);
      expect(b.mass_t, item.name).toBeCloseTo(r.bedBlock!.mass_t, 6);
    }
    const states = computeRaftMooringStates(s, s.env.windSpeed_ms, 1);
    for (const st of states.values()) expect(st.verdict, st.name).toBe('PASS');
  });

  it('block utilisation is ≤ 1 at the design tension and grows with the load', () => {
    const blocks = buildBlockAnchors(pa2(), 1);
    for (const row of compare().rows) {
      const b = blocks.get(row.name)!;
      expect(blockUtilisation(b, row.tension_kN), row.name).toBeLessThanOrEqual(1);
      expect(blockUtilisation(b, row.tension_kN * 1.3), row.name).toBeGreaterThan(1);
    }
  });
});
