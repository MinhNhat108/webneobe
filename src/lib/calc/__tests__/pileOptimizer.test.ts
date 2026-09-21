import { describe, it, expect } from 'vitest';
import {
  optimizePileEmbedment,
  pileAllowableTension,
  pileMomentLimitedH_kN,
  roundUpToStep
} from '../pileOptimizer';
import { calculateBromsPile } from '../broms';
import { calculateProject } from '../index';
import { ProjectState, PileSectionInput, CheckItem } from '../types';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';

const base = (): ProjectState =>
  JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;

const check = (checks: CheckItem[], id: string): CheckItem => {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} missing from the result table`);
  return c;
};

const clayPile = (overrides: Partial<Parameters<typeof optimizePileEmbedment>[0]> = {}) =>
  optimizePileEmbedment({
    soilType: 'clay',
    cu_kPa: 40,
    e: 0.5,
    D: 0.45,
    FS: 2.5,
    appliedH: 60,
    appliedTv: 0,
    ...overrides
  });

describe('roundUpToStep', () => {
  it('rounds up to the construction step', () => {
    expect(roundUpToStep(6.01, 0.25)).toBe(6.25);
    expect(roundUpToStep(6.3, 0.5)).toBe(6.5);
  });

  it('leaves a value already on a step untouched', () => {
    expect(roundUpToStep(6.5, 0.25)).toBe(6.5);
    expect(roundUpToStep(7.0, 0.5)).toBe(7.0);
  });
});

describe('optimizePileEmbedment — Broms inverse solve', () => {
  it('returns the shallowest depth that satisfies every criterion', () => {
    const r = clayPile();
    expect(r.converged).toBe(true);
    expect(r.L_opt_m).not.toBeNull();

    const L = r.L_opt_m as number;
    const at = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L, FS: 2.5, appliedH: 60, appliedTv: 0
    });
    expect(at.utilization_H).toBeLessThanOrEqual(1.0);
    expect(at.utilization_M).toBeLessThanOrEqual(1.0);

    // One step shallower must NOT pass — otherwise it was not the minimum.
    const below = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: L - r.step_m, FS: 2.5, appliedH: 60, appliedTv: 0
    });
    expect(below.utilization_H).toBeGreaterThan(1.0);
  });

  it('lands exactly on a multiple of the construction step', () => {
    for (const step of [0.25, 0.5]) {
      const r = clayPile({ step_m: step });
      const L = r.L_opt_m as number;
      expect(Math.abs(L / step - Math.round(L / step))).toBeLessThan(1e-6);
    }
  });

  it('needs a deeper pile when the load grows', () => {
    const light = clayPile({ appliedH: 40 }).L_opt_m as number;
    const heavy = clayPile({ appliedH: 120 }).L_opt_m as number;
    expect(heavy).toBeGreaterThan(light);
  });

  it('honours the uplift criterion — a vertical pull deepens the pile', () => {
    const noUplift = clayPile({ appliedH: 60, appliedTv: 0 }).L_opt_m as number;
    const withUplift = clayPile({ appliedH: 60, appliedTv: 300 });
    expect(withUplift.L_opt_m as number).toBeGreaterThan(noUplift);
    expect(withUplift.governing).toBe('uplift');
  });

  it('solves the sand branch too', () => {
    const r = optimizePileEmbedment({
      soilType: 'sand',
      phi_deg: 32,
      gammaSub_kNm3: 10,
      e: 0.5,
      D: 0.45,
      FS: 2.5,
      appliedH: 60
    });
    expect(r.converged).toBe(true);
    const at = calculateBromsPile('sand', {
      phi_deg: 32, gammaSub_kNm3: 10, e: 0.5, D: 0.45,
      L: r.L_opt_m as number, FS: 2.5, appliedH: 60
    });
    expect(at.utilization_H).toBeLessThanOrEqual(1.0);
  });

  it('stops early and blames the section when bending governs', () => {
    // A slender, plain-concrete pile under a heavy pull: M_max > M_rd at any depth.
    const r = clayPile({ D: 0.2, appliedH: 400, section: { shape: 'circular', D_m: 0.2 } });
    expect(r.converged).toBe(false);
    expect(r.governing).toBe('moment');
    expect(r.L_opt_m).toBeNull();
    expect(r.note).toMatch(/uốn/);
    // It must NOT have swept the whole 2–20 m range before giving up.
    expect(r.iterations).toBeLessThan(5);
  });

  it('reports non-convergence instead of silently returning maxL', () => {
    // Heavily reinforced (so bending is NOT the blocker) but the depth range
    // is capped below what the soil needs.
    const r = clayPile({
      appliedH: 200,
      maxL_m: 3,
      section: { shape: 'square', D_m: 0.45, rebarArea_mm2: 20000 }
    });
    expect(r.converged).toBe(false);
    expect(r.governing).toBe('lateral');
    expect(r.L_opt_m).toBeNull();
    expect(r.note).toMatch(/Không tìm được/);
  });

  it('runs the whole sweep in a bounded number of evaluations', () => {
    const r = clayPile({ minL_m: 2, maxL_m: 20, step_m: 0.25 });
    expect(r.iterations).toBeLessThanOrEqual(73);
  });
});

describe('P_max — maximum allowable pile holding capacity', () => {
  const section: PileSectionInput = { shape: 'square', D_m: 0.45 };

  it('is the minimum of the lateral, moment and uplift limits', () => {
    const broms = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: 8, FS: 2.5, appliedH: 60, appliedTv: 20
    });
    const cap = pileAllowableTension(broms, 0.5, section, 14.5, 25);
    expect(cap.Pmax_kN).toBe(
      Math.min(cap.Pmax_lateral_kN, cap.Pmax_moment_kN, cap.Pmax_uplift_kN)
    );
    expect(['lateral', 'moment', 'uplift']).toContain(cap.governing);
  });

  it('has no uplift limit for a horizontal cable', () => {
    const broms = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: 8, FS: 2.5, appliedH: 60
    });
    const cap = pileAllowableTension(broms, 0.5, section, 14.5, 0);
    expect(cap.Pmax_uplift_kN).toBe(Number.POSITIVE_INFINITY);
    expect(cap.Pmax_kN).toBe(Math.min(cap.Pmax_lateral_kN, cap.Pmax_moment_kN));
  });

  it('inverts the Broms moment expression consistently', () => {
    const broms = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: 8, FS: 2.5, appliedH: 60
    });
    const Hmrd = pileMomentLimitedH_kN(broms, 0.5, section, 14.5);
    // Re-running Broms with exactly that H must put M_max right at M_rd.
    const at = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: 8, FS: 2.5, appliedH: Hmrd
    });
    expect(at.Mmax).toBeCloseTo(at.Mrd, 1);
  });

  it('caps the computed capacity with the rated catalogue value', () => {
    const free = clayPile();
    const rated = clayPile({ ratedPmax_kN: 5 });
    expect(rated.effectivePmax_kN).toBe(5);
    expect(rated.effectivePmax_kN).toBeLessThan(free.effectivePmax_kN);
    expect(rated.isPmaxOk).toBe(false); // 60 kN pull against a 5 kN pile
  });

  it('applies the safety factor to P_req', () => {
    const r = clayPile({ cableTension_kN: 100, sfPileCapacity: 1.5 });
    expect(r.Preq_kN).toBe(150);
    expect(r.utilization_Pmax).toBeCloseTo(150 / r.effectivePmax_kN, 3);
  });
});

describe('calculateProject wiring', () => {
  it('exposes an optimisation result for both pile families', () => {
    const r = calculateProject(base());
    expect(r.shorePileOpt).toBeDefined();
    expect(r.bedPileOpt).toBeDefined();
    expect(r.shorePileOpt?.L_opt_m).not.toBeNull();
    // The bed pile's cable is inclined, so its P_max must carry that angle.
    expect(r.bedPileOpt?.capacity.cableAngle_deg).toBeCloseTo(r.bedCableAngle_deg ?? 0, 1);
  });

  it('leaves the user-specified embedment results untouched', () => {
    const s = base();
    const before = calculateProject(s);
    s.anchor.pileRatedPmaxShore_kN = 500;
    const after = calculateProject(s);
    // Adding a rated P_max must not move any Broms number or the verdict.
    expect(after.shorePile).toEqual(before.shorePile);
    expect(after.t_max_intact_kN).toBe(before.t_max_intact_kN);
  });

  it('skips C10/C11 until a rated P_max is entered', () => {
    const r = calculateProject(base());
    expect(check(r.checks, 'C10').status).toBe('SKIP');
    expect(check(r.checks, 'C11').status).toBe('SKIP');
    expect(r.overallVerdict).toBe('PASS');
  });

  it('evaluates C10 against the rated P_max once given', () => {
    const s = base();
    s.anchor.pileRatedPmaxShore_kN = 10_000; // absurdly strong pile
    expect(check(calculateProject(s).checks, 'C10').status).toBe('PASS');

    s.anchor.pileRatedPmaxShore_kN = 1; // absurdly weak pile
    const failed = calculateProject(s);
    expect(check(failed.checks, 'C10').status).toBe('FAIL');
    expect(failed.overallVerdict).toBe('FAIL');
  });
});
