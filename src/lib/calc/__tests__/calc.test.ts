import { describe, it, expect } from 'vitest';
import { calculateProject } from '../index';
import {
  estimateChainMBL_kN,
  estimateChainWeightAir_kgpm,
  submergedUnitWeight_N_per_m,
  defaultLineMaterialDensity,
  LINE_MATERIAL_DENSITY
} from '../constants';
import { calculateLoads } from '../loads';
import { calculateCatenary } from '../catenary';
import { calculateAnchor } from '../anchor';
import {
  calculateBromsCohesivePile,
  calculateBromsSandPile,
  calculateBromsPile,
  pileEffectiveWidth_m,
  pilePerimeter_m,
  pileSectionModulus_m3,
  pileMrd_kNm,
  maxBarsPerFace,
  maxBarsOnRing,
  ringLeverFactor
} from '../broms';
import { ProjectState, CheckItem, PileSectionInput } from '../types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { buildRaftProjectState } from '../raftState';

/** Deep clone so no test can leak state into another. */
const base = (): ProjectState =>
  JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;

const check = (checks: CheckItem[], id: string): CheckItem => {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} missing from the result table`);
  return c;
};

/** A drag-anchor catenary mooring, so the catenary branch is actually exercised. */
function catenaryProject(): ProjectState {
  const s = base();
  s.systemType = 'general_catenary';
  s.raft = {
    ...s.raft,
    length_m: 20,
    width_m: 10,
    draft_m: 1.2,
    freeboardHeight_m: 0.8,
    displacement_t: 40,
    solarPanelCount: 0
  };
  s.env = {
    ...s.env,
    waterDepth_m: 12,
    tideRange_m: 0,
    windSpeed_ms: 25,
    windCd: 1.2,
    currentSpeed_ms: 1.0,
    currentCd: 1.2,
    waveHs_m: 1.5,
    waveCd: 1.0,
    combinationFactor: 1.0,
    airDensity: 1.225,
    waterDensity: 1025,
    gravity: 9.81
  };
  s.line = {
    ...s.line,
    type: 'chain',
    materialDensity_kgpm3: LINE_MATERIAL_DENSITY.steel,
    mooringModel: 'catenary',
    effectiveCount: 4,
    horizontalAngle_deg: 30,
    focusFactor: 0,
    pretension_kN: 0,
    chainDiameter_mm: 32,
    chainGrade: 'U2',
    mbl_kN: estimateChainMBL_kN(32, 'U2'),
    unitWeightAir_kgpm: estimateChainWeightAir_kgpm(32),
    totalLength_m: 120,
    groundedLengthMin_m: 5,
    seabedFrictionCoef: 1.0
  };
  s.anchor = {
    ...s.anchor,
    mode: 'drag',
    anchorType: 'Danforth',
    soil: 'sand',
    weight_t: 3,
    holdingCoef: 12
  };
  return s;
}

describe('Reference tables and estimators', () => {
  it('estimates chain MBL within 2% of the IACS catalogue anchors (AC 15)', () => {
    expect(estimateChainMBL_kN(32, 'U1')).toBeCloseTo(641, -1);
    expect(estimateChainMBL_kN(32, 'U2')).toBeCloseTo(916, -1);
    expect(estimateChainMBL_kN(32, 'U3')).toBeCloseTo(1320, -1);
    // Higher grade => higher MBL, monotonically (AC 19)
    expect(estimateChainMBL_kN(32, 'U3')).toBeGreaterThan(estimateChainMBL_kN(32, 'U2'));
    expect(estimateChainMBL_kN(32, 'U2')).toBeGreaterThan(estimateChainMBL_kN(32, 'U1'));
  });

  it('estimates chain dry unit weight', () => {
    expect(estimateChainWeightAir_kgpm(32)).toBeCloseTo(22.4, 0);
  });

  it('derives the submerged unit weight from the REAL line material', () => {
    // Steel chain: ~87% of dry weight in fresh water
    const steel = submergedUnitWeight_N_per_m(22.4, LINE_MATERIAL_DENSITY.steel, 1000, 9.81);
    expect(steel / (22.4 * 9.81)).toBeCloseTo(0.873, 3);

    // Polyester rope: only ~27% — using the steel factor overstates it ~3.2x
    const pes = submergedUnitWeight_N_per_m(0.54, LINE_MATERIAL_DENSITY.polyester, 1000, 9.81);
    expect(pes / (0.54 * 9.81)).toBeCloseTo(0.275, 3);
    const wrong = submergedUnitWeight_N_per_m(0.54, LINE_MATERIAL_DENSITY.steel, 1000, 9.81);
    expect(wrong / pes).toBeGreaterThan(3);

    // Polypropylene floats: negative submerged weight, never clamped to 0
    expect(submergedUnitWeight_N_per_m(0.5, LINE_MATERIAL_DENSITY.polypropylene, 1000, 9.81))
      .toBeLessThan(0);

    expect(defaultLineMaterialDensity('chain')).toBe(LINE_MATERIAL_DENSITY.steel);
    expect(defaultLineMaterialDensity('cable')).toBe(LINE_MATERIAL_DENSITY.polyester);
  });
});

describe('Environmental loads', () => {
  const s = catenaryProject();

  it('applies the textbook drag formulas (AC 14)', () => {
    const r = calculateLoads(s.raft, s.env, s.line, false, 3.0);
    const a_wind = s.raft.width_m * s.raft.freeboardHeight_m;
    const a_cur = s.raft.width_m * s.raft.draft_m;

    expect(r.a_wind_m2).toBeCloseTo(a_wind, 6);
    expect(r.f_wind_total_kN * 1000).toBeCloseTo(
      0.5 * 1.225 * 1.2 * a_wind * 25 * 25, 6
    );
    expect(r.f_current_kN * 1000).toBeCloseTo(
      0.5 * 1025 * 1.2 * a_cur * 1.0 * 1.0, 6
    );
    expect(r.f_wave_kN * 1000).toBeCloseTo(
      0.5 * 1025 * 9.81 * Math.pow(1.5 / 2, 2) * s.raft.width_m * 1.0, 6
    );
    expect(r.f_env_total_kN).toBeCloseTo(
      r.f_wind_total_kN + r.f_current_kN + r.f_wave_kN, 6
    );
  });

  it('honours a deliberate zero instead of substituting a default', () => {
    const zeroed = { ...s.env, combinationFactor: 0 };
    expect(calculateLoads(s.raft, zeroed, s.line, false, 3.0).f_env_total_kN).toBe(0);

    const noWind = { ...s.env, windCd: 0 };
    expect(calculateLoads(s.raft, noWind, s.line, false, 3.0).f_wind_total_kN).toBe(0);
  });

  it('keeps H, V and T components of ONE consistent tension', () => {
    const r = calculateLoads(s.raft, s.env, s.line, false, 3.0);
    const a = (s.line.horizontalAngle_deg * Math.PI) / 180;
    expect(r.h_line_intact_kN).toBeCloseTo(r.t_max_intact_kN * Math.cos(a), 9);
    expect(r.v_line_intact_kN).toBeCloseTo(r.t_max_intact_kN * Math.sin(a), 9);
    expect(
      Math.hypot(r.h_line_intact_kN, r.v_line_intact_kN)
    ).toBeCloseTo(r.t_max_intact_kN, 9);
  });

  it('makes the damaged case more onerous than the intact one', () => {
    const r = calculateLoads(s.raft, s.env, s.line, false, 3.0);
    expect(r.t_max_damaged_kN).toBeGreaterThan(r.t_max_intact_kN);
  });

  it('derives the required MBL from the user criterion, not a hardcoded 3.0', () => {
    const r3 = calculateLoads(s.raft, s.env, s.line, false, 3.0);
    const r5 = calculateLoads(s.raft, s.env, s.line, false, 5.0);
    expect(r5.mbl_required_kN / r3.mbl_required_kN).toBeCloseTo(5 / 3, 6);
  });
});

describe('Catenary', () => {
  const s = catenaryProject();

  it('satisfies the catenary identities (AC 14)', () => {
    const c = calculateCatenary(s.line, s.env, 50, 60, 'catenary');
    expect(c.catenaryApplies).toBe(true);

    const w = c.submergedWeight_N_per_m!;
    const d = c.verticalDrop_d_m!;
    const H = 50 * 1000;

    expect(c.suspendedLength_s_m).toBeCloseTo(Math.sqrt(d * (d + (2 * H) / w)), 6);
    expect(c.topTension_kN).toBeCloseTo((H + w * d) / 1000, 6);
    expect(c.suspendedProjection_m).toBeCloseTo(
      (H / w) * Math.asinh((w * c.suspendedLength_s_m!) / H), 6
    );
    // Top tension always exceeds the horizontal component
    expect(c.topTension_kN!).toBeGreaterThan(50);
  });

  it('refuses to model a taut pile mooring as a catenary (AC 18)', () => {
    const c = calculateCatenary(s.line, s.env, 50, 60, 'taut_pile');
    expect(c.catenaryApplies).toBe(false);
    expect(c.suspendedLength_s_m).toBeNull();
    expect(c.groundedLength_m).toBeNull();
    expect(c.frictionResistance_kN).toBeNull();
    expect(c.catenaryNote).toBeTruthy();
  });

  it('refuses to model a positively buoyant rope', () => {
    const floating = { ...s.line, materialDensity_kgpm3: LINE_MATERIAL_DENSITY.polypropylene };
    const c = calculateCatenary(floating, s.env, 50, 60, 'catenary');
    expect(c.catenaryApplies).toBe(false);
    expect(c.catenaryNote).toMatch(/nổi|nhẹ hơn nước/i);
  });

  it('returns not-applicable rather than NaN on degenerate geometry (AC 20)', () => {
    for (const [line, env] of [
      [s.line, { ...s.env, waterDepth_m: 0, tideRange_m: 0 }],
      [{ ...s.line, unitWeightAir_kgpm: 0 }, s.env]
    ] as const) {
      const c = calculateCatenary(line, env, 50, 60, 'catenary');
      expect(c.catenaryApplies).toBe(false);
      for (const v of Object.values(c)) {
        expect(typeof v === 'number' ? Number.isFinite(v) : true).toBe(true);
      }
    }
    // H = 0 (no environmental load at all)
    expect(calculateCatenary(s.line, s.env, 0, 0, 'catenary').catenaryApplies).toBe(false);
  });
});

describe('Anchor resistance', () => {
  const s = catenaryProject();

  it('computes drag anchor holding as HC * W * g', () => {
    const r = calculateAnchor({ ...s.anchor, mode: 'drag', weight_t: 3, holdingCoef: 12 }, s.env, 0);
    expect(r.anchorResistance_kN).toBeCloseTo((12 * 3000 * 9.81) / 1000, 6);
  });

  it('computes deadweight holding on the SUBMERGED weight', () => {
    const r = calculateAnchor(
      { ...s.anchor, mode: 'deadweight', weight_t: 10, frictionCoef: 0.5, concreteDensity: 2400 },
      { ...s.env, waterDensity: 1025 },
      0
    );
    const wsub = 10000 * (1 - 1025 / 2400);
    expect(r.anchorResistance_kN).toBeCloseTo((0.5 * wsub * 9.81) / 1000, 6);
    expect(r.anchorResistance_kN!).toBeLessThan((0.5 * 10000 * 9.81) / 1000);
  });

  it('adds seabed friction to the anchor resistance', () => {
    const withF = calculateAnchor({ ...s.anchor, mode: 'drag', weight_t: 3, holdingCoef: 12 }, s.env, 20);
    expect(withF.totalResistance_kN! - withF.anchorResistance_kN!).toBeCloseTo(20, 6);
  });

  it('reports a pile anchor as handled elsewhere, not as zero resistance', () => {
    const r = calculateAnchor({ ...s.anchor, mode: 'pile' }, s.env, 0);
    expect(r.anchorApplies).toBe(false);
    expect(r.totalResistance_kN).toBeNull();
    expect(r.anchorNote).toMatch(/Broms/);
  });
});

describe('Check table and verdict', () => {
  it('always emits C1..C7, never silently drops a mandatory check', () => {
    for (const s of [catenaryProject(), base()]) {
      const ids = calculateProject(s).checks.map((c) => c.id);
      for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']) {
        expect(ids).toContain(id);
      }
    }
  });

  it('flips C1 to KHÔNG ĐẠT when the anchor is too light, and names it governing (AC 17)', () => {
    const heavy = catenaryProject();
    heavy.anchor.weight_t = 20;
    const rHeavy = calculateProject(heavy);
    expect(check(rHeavy.checks, 'C1').status).toBe('PASS');

    const light = catenaryProject();
    light.anchor.weight_t = 0.05;
    light.line.seabedFrictionCoef = 0; // isolate the anchor from chain friction
    const rLight = calculateProject(light);
    const c1 = check(rLight.checks, 'C1');
    expect(c1.status).toBe('FAIL');
    expect(rLight.overallVerdict).toBe('FAIL');
    expect(rLight.governingCheck?.id).toBe('C1');
    expect(c1.utilization).toBeGreaterThan(1);
  });

  it('flips C3 to uplift FAIL when the line is too short (AC 18)', () => {
    const s = catenaryProject();
    s.line.totalLength_m = 20; // shorter than the suspended length
    const r = calculateProject(s);
    const c3 = check(r.checks, 'C3');
    expect(r.groundedLength_m).toBeLessThan(0);
    expect(c3.status).toBe('FAIL');
    expect(c3.note).toMatch(/uplift/i);
    expect(r.overallVerdict).toBe('FAIL');
  });

  it('flips C2 from KHÔNG ĐẠT to ĐẠT when the chain grade is raised (AC 19)', () => {
    // A 6 mm chain: grade U1 is under the SF 3.0 criterion, U3 clears it.
    const weak = catenaryProject();
    weak.line.chainDiameter_mm = 6;
    weak.line.chainGrade = 'U1';
    weak.line.mbl_kN = estimateChainMBL_kN(6, 'U1');
    weak.line.unitWeightAir_kgpm = estimateChainWeightAir_kgpm(6);
    const rWeak = calculateProject(weak);
    expect(check(rWeak.checks, 'C2').status).toBe('FAIL');

    const strong = JSON.parse(JSON.stringify(weak)) as ProjectState;
    strong.line.chainGrade = 'U3';
    strong.line.mbl_kN = estimateChainMBL_kN(6, 'U3');
    const rStrong = calculateProject(strong);
    expect(rStrong.mbl_required_kN).toBeCloseTo(rWeak.mbl_required_kN, 6); // demand unchanged
    expect(check(rStrong.checks, 'C2').status).toBe('PASS');
  });

  it('marks catenary checks SKIP — not PASS — on a taut pile mooring (AC 16)', () => {
    const s = base(); // Huổi Vanh: FPV on piles
    const r = calculateProject(s);
    for (const id of ['C1', 'C3', 'C4', 'C5', 'C7']) {
      expect(check(r.checks, id).status).toBe('SKIP');
      expect(check(r.checks, id).note).toBeTruthy();
    }
    // and the pile checks are the ones that actually carry the verdict
    expect(r.checks.some((c) => c.id.startsWith('BP-'))).toBe(true);
  });

  it('never returns PASS when nothing mandatory was actually evaluated', () => {
    const s = catenaryProject();
    s.anchor.mode = 'pile';
    s.line.mbl_kN = 0;      // C2 / C6 -> NA
    s.raft.solarPanelCount = 0;
    const r = calculateProject(s);
    expect(['NA', 'FAIL']).toContain(r.overallVerdict);
    expect(r.overallVerdict).not.toBe('PASS');
  });

  it('selects the governing check by utilization, not by an incomparable margin', () => {
    const s = catenaryProject();
    const r = calculateProject(s);
    const ranked = r.checks
      .filter((c) => c.isMandatory && c.utilization !== null && Number.isFinite(c.utilization))
      .sort((a, b) => (b.utilization as number) - (a.utilization as number));
    expect(r.governingCheck?.id).toBe(ranked[0].id);
    // a non-mandatory warning can never hijack the governing slot
    expect(r.governingCheck?.isMandatory).toBe(true);
  });

  it('keeps every check margin consistent with its utilization', () => {
    const r = calculateProject(catenaryProject());
    for (const c of r.checks) {
      if (c.utilization !== null && c.utilization > 0 && Number.isFinite(c.utilization)) {
        expect(c.margin).toBeCloseTo(1 / c.utilization - 1, 9);
        expect(c.status).toBe(c.utilization <= 1 ? 'PASS' : 'FAIL');
      }
    }
  });
});

describe('Robustness (AC 20)', () => {
  it('produces no NaN or Infinity anywhere, whatever the user zeroes out', () => {
    const variants: Array<(s: ProjectState) => void> = [
      (s) => { s.env.waterDepth_m = 0; s.env.tideRange_m = 0; },
      (s) => { s.line.unitWeightAir_kgpm = 0; },
      (s) => { s.line.effectiveCount = 0; },
      (s) => { s.line.horizontalAngle_deg = 90; },
      (s) => { s.line.mbl_kN = 0; },
      (s) => { s.line.totalLength_m = 0; },
      (s) => { s.anchor.weight_t = 0; },
      (s) => { s.anchor.holdingCoef = 0; },
      (s) => { s.env.windSpeed_ms = 0; s.env.currentSpeed_ms = 0; s.env.waveHs_m = 0; },
      (s) => { s.criteria.minScopeRatio = 0; s.criteria.maxOffset_m = 0; }
    ];

    for (const mutate of variants) {
      const s = catenaryProject();
      mutate(s);
      const r = calculateProject(s);

      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'number') {
          expect(Number.isFinite(v), `${k} is not finite`).toBe(true);
        }
      }
      for (const c of r.checks) {
        expect(c.displayActual).not.toMatch(/NaN|Infinity/);
        if (c.actual !== null) expect(Number.isFinite(c.actual)).toBe(true);
        if (c.margin !== null) expect(Number.isFinite(c.margin)).toBe(true);
      }
      expect(['PASS', 'FAIL', 'NA', 'SKIP']).toContain(r.overallVerdict);
    }
  });

  it('never rounds mid-chain: the checks see full precision', () => {
    const s = catenaryProject();
    const r = calculateProject(s);
    const c2 = check(r.checks, 'C2');
    const fromDisplay = s.line.mbl_kN / r.t_max_intact_kN; // t_max is rounded for display

    // The check ran on FULL precision, so it does not exactly equal the value a
    // reader would recompute from the rounded display...
    expect(c2.actual).not.toBe(fromDisplay);
    // ...but it agrees with it to well within 0.1 %, i.e. the rounding is a
    // display artefact and no longer propagates into the verdict.
    expect(Math.abs(c2.actual! - fromDisplay) / fromDisplay).toBeLessThan(1e-3);
    expect(r.governingCheck?.utilization).toBeGreaterThan(0);
  });
});

describe('Broms pile', () => {
  it('computes a lateral capacity bounded by the available soil resistance', () => {
    const sp = calculateBromsCohesivePile(40, 0.5, 0.45, 6.5, 2.5, 59.3);
    expect(sp.Hu).toBeGreaterThan(0);
    // Hu can never exceed p * g, the total soil resistance over the effective embedment
    expect(sp.Hu).toBeLessThan(sp.p * sp.g);
    expect(sp.H_allow).toBeCloseTo(sp.Hu / 2.5, 1);
    expect(sp.utilization_H).toBeCloseTo(59.3 / sp.H_allow, 2);
  });

  it('scales uplift capacity with the shaft area', () => {
    const a = calculateBromsCohesivePile(20, 0, 0.35, 8, 2.5, 30, 10);
    const b = calculateBromsCohesivePile(20, 0, 0.35, 16, 2.5, 30, 10);
    expect(b.upliftCapacity_all!).toBeCloseTo(2 * a.upliftCapacity_all!, 5);
  });
});

describe('Full project', () => {
  it('runs the Hồ Huổi Vanh default state end to end', () => {
    const r = calculateProject(base());
    expect(r.f_env_total_kN).toBeGreaterThan(60); // default wind 20 m/s
    expect(r.t_max_intact_kN).toBeGreaterThan(20);
    expect(r.checks.length).toBeGreaterThanOrEqual(7);
    expect(['PASS', 'FAIL', 'NA']).toContain(r.overallVerdict);
  });

  it.each(['PA3_SCREW_BASE', 'PA1_PILE'] as const)('verifies all 9 Huoi Vanh rafts calculate and pass (lake-bed anchors: %s)', (option) => {
    expect(HUOI_VANH_RAFTS).toHaveLength(9);
    expect(HUOI_VANH_RAFTS.map((r) => r.name)).toEqual(['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 3A', 'BÈ 5A', 'BÈ 6', 'BÈ 7', 'BÈ 8', 'BÈ 9']);
    expect(base().anchor.bedAnchorOption).toBe('PA3_SCREW_BASE'); // the design since 2026-10-08

    for (const raft of HUOI_VANH_RAFTS) {
      const mapped = buildRaftProjectState(base(), raft, base().anchor);
      const s = { ...mapped, anchor: { ...mapped.anchor, bedAnchorOption: option } };

      const r = calculateProject(s);
      const failed = r.checks.filter((c: any) => c.status === 'FAIL');
      if (failed.length > 0) {
        console.log(`Raft ${raft.id} (${raft.name}) FAILED:`, failed.map((c: any) => `${c.id} (${c.label}) actual: ${c.displayActual}, thresh: ${c.threshold}`));
      }
      // D350 bored shore piles; lake-bed anchors on screw-pile bases (or 350 x 350 piles under PA1).
      expect(r.overallVerdict, `Raft ${raft.name} should pass`).toBe('PASS');
      expect(!!r.bedScrewBase, raft.name).toBe(option === 'PA3_SCREW_BASE');
      if (r.bedScrewBase) expect(r.bedScrewBase.ok, raft.name).toBe(true);
      expect(s.anchor.shoreD_m, raft.name).toBe(0.35);
      expect(s.anchor.bed1D_m, raft.name).toBe(0.35);
    }
  });

  it('twin piles: each pile of a 2-pile point is checked for T / (2 x 0.9); one pile takes the whole tension', () => {
    // At the 20 m/s default no raft needs twin piles. BÈ 3A at the STORM wind (30 m/s) does:
    // two piles 6Φ32 per point, as the catalogue sized at 30 m/s had it.
    const be3a = HUOI_VANH_RAFTS.find((r) => r.name === 'BÈ 3A')!;
    const mapped = buildRaftProjectState(base(), be3a, base().anchor);
    expect(mapped.anchor.shorePilesPerPoint).toBe(1);
    const s = {
      ...mapped,
      env: { ...mapped.env, windSpeed_ms: 30 },
      anchor: { ...mapped.anchor, bedAnchorOption: 'PA1_PILE' as const, shorePilesPerPoint: 2, bedPilesPerPoint: 2, shoreRebarCount: 6, shoreRebarDia_mm: 32 }
    };
    const twin = calculateProject(s);
    expect(twin.shorePileTension_kN).toBeCloseTo(twin.t_max_intact_kN / 1.8, 1);
    expect(twin.bedPileTension_kN).toBeCloseTo(twin.t_max_intact_kN / 1.8, 1);
    expect(twin.checks.find((c) => c.id === 'BP-2')!.status).toBe('PASS');

    // The same piles, one per point: the shore pile is over in bending — the reason for the twin piles.
    const single = calculateProject({ ...s, anchor: { ...s.anchor, shorePilesPerPoint: 1, bedPilesPerPoint: 1 } });
    expect(single.shorePileTension_kN).toBe(single.t_max_intact_kN);
    expect(single.t_max_intact_kN).toBe(twin.t_max_intact_kN); // the line tension does not depend on the anchor
    expect(single.shorePile!.Mmax).toBeGreaterThan(twin.shorePile!.Mmax);
    expect(single.checks.find((c) => c.id === 'BP-2')!.status).toBe('FAIL');

    // A less efficient group loads each pile more.
    const weak = calculateProject({ ...s, anchor: { ...s.anchor, pileGroupEfficiency: 0.7 } });
    expect(weak.shorePileTension_kN!).toBeGreaterThan(twin.shorePileTension_kN!);

    // At the 20 m/s default every raft has one shore pile per point.
    expect(HUOI_VANH_RAFTS.filter((r) => (r.shorePilesPerPoint ?? 1) > 1).map((r) => r.name)).toEqual([]);
    for (const raft of HUOI_VANH_RAFTS.filter((r) => (r.shorePilesPerPoint ?? 1) === 1)) {
      const r = calculateProject(buildRaftProjectState(base(), raft, base().anchor));
      expect(r.shorePileTension_kN, raft.name).toBe(r.t_max_intact_kN);
    }
  });
});

describe('Broms — pile shape / section helpers', () => {
  it('gives the square section the same D^3/6 modulus as the original formula', () => {
    const sq: PileSectionInput = { shape: 'square', D_m: 0.45 };
    expect(pileSectionModulus_m3(sq)).toBeCloseTo(Math.pow(0.45, 3) / 6, 9);
    expect(pilePerimeter_m(sq)).toBeCloseTo(4 * 0.45, 9);
    expect(pileEffectiveWidth_m(sq)).toBeCloseTo(0.45, 9);
  });

  it('gives a circular section pi*D^3/32 and a pi*D perimeter', () => {
    const circ: PileSectionInput = { shape: 'circular', D_m: 0.5 };
    expect(pileSectionModulus_m3(circ)).toBeCloseTo((Math.PI * Math.pow(0.5, 3)) / 32, 9);
    expect(pilePerimeter_m(circ)).toBeCloseTo(Math.PI * 0.5, 9);
  });

  it('gives a pipe section less modulus and less area than an equivalent solid circle', () => {
    const solid: PileSectionInput = { shape: 'circular', D_m: 0.5 };
    const pipe: PileSectionInput = { shape: 'pipe', D_m: 0.5, tWall_m: 0.05 };
    expect(pileSectionModulus_m3(pipe)).toBeLessThan(pileSectionModulus_m3(solid));
    // The outer perimeter (used for skin friction) is identical to the solid circle.
    expect(pilePerimeter_m(pipe)).toBeCloseTo(pilePerimeter_m(solid), 9);
  });

  it('bending capacity follows TCVN 5574:2018, not the compressive strength of the concrete', () => {
    // Unreinforced: the section fails when it cracks, M = Rbt x W (B25: Rbt = 1.05 MPa).
    const plain: PileSectionInput = { shape: 'square', D_m: 0.45 };
    const mPlain = pileMrd_kNm(plain, 14.5);
    expect(mPlain.MrdSteel_kNm).toBe(0);
    expect(mPlain.Mrd_kNm).toBeCloseTo(1.05 * 1000 * (0.45 ** 3 / 6), 6); // 15.95 kNm — the old formula gave 198
    expect(mPlain.Mrd_kNm).toBeLessThan(20);

    // Reinforced: M = Rs x As(tension face) x (D - 2 a_s); the cracked concrete adds nothing.
    const rc: PileSectionInput = { shape: 'square', D_m: 0.35, rebarFaceCount: 3, rebarDia_mm: 25, rebarRs_MPa: 350, rebarCover_mm: 50 };
    const m = pileMrd_kNm(rc, 14.5);
    const As = 3 * Math.PI * 25 * 25 / 4; // 1472.6 mm2
    expect(m.AsTension_mm2).toBeCloseTo(As, 6);
    expect(m.MrdConcrete_kNm).toBe(0);
    expect(m.Mrd_kNm).toBeCloseTo((As / 1e6) * 350e3 * 0.25, 6); // 128.9 kNm
    // Linear in the bar count, in Rs and in the lever arm.
    expect(pileMrd_kNm({ ...rc, rebarFaceCount: 6 }, 14.5).Mrd_kNm).toBeCloseTo(2 * m.Mrd_kNm, 6);
    expect(pileMrd_kNm({ ...rc, rebarRs_MPa: 435 }, 14.5).Mrd_kNm).toBeCloseTo((435 / 350) * m.Mrd_kNm, 6);
    expect(pileMrd_kNm({ ...rc, rebarCover_mm: 75 }, 14.5).Mrd_kNm).toBeCloseTo((0.2 / 0.25) * m.Mrd_kNm, 6);

    // Legacy total-area input: only 3/8 of it is on the tension face, at fy / 1.15.
    const legacy = pileMrd_kNm({ shape: 'square', D_m: 0.45, rebarArea_mm2: 2000, rebarFy_MPa: 300 }, 14.5);
    expect(legacy.AsTension_mm2).toBeCloseTo(750, 6);
    expect(legacy.Mrd_kNm).toBeCloseTo((750 / 1e6) * (300 / 1.15) * 1000 * 0.35, 6);
  });

  it('the bending check compares the FACTORED moment with M_rd and leaves M_max unfactored', () => {
    const sec: PileSectionInput = { shape: 'square', D_m: 0.35, rebarFaceCount: 3, rebarDia_mm: 25 };
    const p = { cu_kPa: 40, e: 0.5, D: 0.35, L: 6.5, FS: 2.5, appliedH: 70, appliedTv: 0 };
    const a = calculateBromsPile('clay', { ...p, section: sec });
    const b = calculateBromsPile('clay', { ...p, section: { ...sec, bendingLoadFactor: 1.2 } });
    expect(b.Mmax).toBe(a.Mmax);
    expect(b.Mrd).toBe(a.Mrd);
    expect(b.utilization_M).toBeCloseTo(1.2 * a.utilization_M, 2);
    expect(a.utilization_M).toBeCloseTo(a.Mmax / a.Mrd, 2);
  });

  it('a round pile with 4 bars has half the bending capacity of a square pile with the same 4 bars', () => {
    // worst orientation of the cage: sum |y_i| / r
    expect(ringLeverFactor(4)).toBeCloseTo(2, 6); // a bar on the bending axis; 2.83 at 45 degrees
    expect(ringLeverFactor(6)).toBeCloseTo(2 * Math.sqrt(3), 3);
    expect(ringLeverFactor(8)).toBeCloseTo(2 + 2 * Math.SQRT2, 3);
    const A32 = Math.PI * 32 * 32 / 4;
    const round = pileMrd_kNm({ shape: 'circular', D_m: 0.35, rebarTotalCount: 4, rebarDia_mm: 32, rebarRs_MPa: 350 }, 14.5);
    const square = pileMrd_kNm({ shape: 'square', D_m: 0.35, rebarFaceCount: 2, rebarDia_mm: 32, rebarRs_MPa: 350 }, 14.5);
    expect(round.Mrd_kNm).toBeCloseTo((A32 / 1e6) * 350e3 * 0.125 * 2, 6); // 70.4 kNm, r_s = 0.175 - 0.05
    expect(square.Mrd_kNm).toBeCloseTo((2 * A32 / 1e6) * 350e3 * 0.25, 6); // 140.7 kNm
    expect(round.Mrd_kNm).toBeCloseTo(square.Mrd_kNm / 2, 6);
    // more bars on the circle recover it
    const six = pileMrd_kNm({ shape: 'circular', D_m: 0.35, rebarTotalCount: 6, rebarDia_mm: 32, rebarRs_MPa: 350 }, 14.5);
    const eight = pileMrd_kNm({ shape: 'circular', D_m: 0.35, rebarTotalCount: 8, rebarDia_mm: 32, rebarRs_MPa: 350 }, 14.5);
    expect(six.Mrd_kNm / round.Mrd_kNm).toBeCloseTo(Math.sqrt(3), 3);
    expect(eight.Mrd_kNm).toBeGreaterThan(square.Mrd_kNm);
    // a round pile never falls back on the square formula when only "bars per face" is given
    const legacy = pileMrd_kNm({ shape: 'circular', D_m: 0.35, rebarFaceCount: 2, rebarDia_mm: 32, rebarRs_MPa: 350 }, 14.5);
    expect(legacy.Mrd_kNm).toBeCloseTo(round.Mrd_kNm, 6);
    // unreinforced round section: Rbt x W of the circle
    expect(pileMrd_kNm({ shape: 'circular', D_m: 0.35 }, 14.5).Mrd_kNm).toBeCloseTo(1.05 * 1000 * Math.PI * 0.35 ** 3 / 32, 6);
    expect(maxBarsOnRing(0.35, 32)).toBe(12);
  });

  it('Huổi Vanh shore piles are round bored D350 piles and pass with 4 to 6 bars at 20 m/s; four bars are not enough at the storm wind', () => {
    for (const raft of HUOI_VANH_RAFTS) {
      const s = buildRaftProjectState(base(), raft, base().anchor);
      expect(s.anchor.shorePileShape, raft.name).toBe('circular');
      expect([4, 6, 8], raft.name).toContain(s.anchor.shoreRebarCount);
      const r = calculateProject(s);
      expect(r.checks.find((c) => c.id === 'BP-2')!.status, raft.name).toBe('PASS');
      expect(r.shorePile!.utilization_M, raft.name).toBeLessThanOrEqual(0.95);
    }
    const be6 = HUOI_VANH_RAFTS.find((r) => r.name === 'BÈ 6')!;
    const s6 = buildRaftProjectState(base(), be6, base().anchor);
    const four = calculateProject({ ...s6, env: { ...s6.env, windSpeed_ms: 30 }, anchor: { ...s6.anchor, shoreRebarCount: 4, shoreRebarDia_mm: 32 } });
    expect(four.checks.find((c) => c.id === 'BP-2')!.status).toBe('FAIL');
  });

  it('fits bars in one layer at a spacing of max(2d, d + 30 mm)', () => {
    expect(maxBarsPerFace(0.35, 25)).toBe(5);
    expect(maxBarsPerFace(0.35, 32)).toBe(4);
    expect(maxBarsPerFace(0.3, 32)).toBe(4);
    expect(maxBarsPerFace(0.3, 20)).toBe(5);
  });

  it('calculateBromsCohesivePile with no section arg matches the original plain-square behaviour', () => {
    const withoutSection = calculateBromsCohesivePile(40, 0.5, 0.45, 6.5, 2.5, 59.3);
    const withSquareSection = calculateBromsCohesivePile(
      40, 0.5, 0.45, 6.5, 2.5, 59.3, 0, 14.5, 0.7, { shape: 'square', D_m: 0.45 }
    );
    expect(withSquareSection.Hu).toBeCloseTo(withoutSection.Hu, 6);
    expect(withSquareSection.Mrd).toBeCloseTo(withoutSection.Mrd, 6);
    expect(withSquareSection.upliftCapacity_all).toBeCloseTo(withoutSection.upliftCapacity_all!, 6);
  });
});

describe('Broms — cohesionless (sand) pile', () => {
  it('computes a positive ultimate lateral capacity that grows with embedment length', () => {
    const shallow = calculateBromsSandPile(30, 10, 0.5, 0.45, 5, 2.5, 40);
    const deep = calculateBromsSandPile(30, 10, 0.5, 0.45, 10, 2.5, 40);
    expect(shallow.Hu).toBeGreaterThan(0);
    expect(deep.Hu).toBeGreaterThan(shallow.Hu);
    expect(shallow.soilModel).toBe('sand');
    expect(shallow.Kp).toBeCloseTo(Math.pow(Math.tan(Math.PI / 4 + (30 * Math.PI) / 180 / 2), 2), 3);
  });

  it('matches the closed-form Hu = 0.5*Kp*gamma_sub*D*L^3/(e+L)', () => {
    const phi = 32, gamma = 9.5, e = 0.4, D = 0.5, L = 8;
    const r = calculateBromsSandPile(phi, gamma, e, D, L, 2.5, 50);
    const Kp = Math.pow(Math.tan(Math.PI / 4 + (phi * Math.PI) / 180 / 2), 2);
    const expectedHu = (0.5 * Kp * gamma * D * Math.pow(L, 3)) / (e + L);
    expect(r.Hu).toBeCloseTo(expectedHu, 1);
    expect(r.H_allow).toBeCloseTo(r.Hu / 2.5, 1);
  });

  it('scales uplift shaft-friction capacity with L^2 (linear in the triangular pressure integral)', () => {
    const a = calculateBromsSandPile(30, 10, 0, 0.4, 6, 2.5, 30, 10);
    const b = calculateBromsSandPile(30, 10, 0, 0.4, 12, 2.5, 30, 10);
    // (2L)^2 = 4x — compared with a loose tolerance since both sides are
    // independently rounded to 2 decimals inside calculateBromsSandPile.
    expect(b.upliftCapacity_all! / a.upliftCapacity_all!).toBeCloseTo(4, 2);
  });

  it('dispatches sand vs clay correctly via calculateBromsPile', () => {
    const sand = calculateBromsPile('sand', {
      phi_deg: 30, gammaSub_kNm3: 10, e: 0.5, D: 0.45, L: 6.5, FS: 2.5, appliedH: 40
    });
    const clay = calculateBromsPile('clay', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: 6.5, FS: 2.5, appliedH: 40
    });
    const mud = calculateBromsPile('mud', {
      cu_kPa: 40, e: 0.5, D: 0.45, L: 6.5, FS: 2.5, appliedH: 40
    });
    expect(sand.soilModel).toBe('sand');
    expect(clay.soilModel).toBe('clay');
    expect(mud.soilModel).toBe('clay'); // mud/rock fall back to the cohesive branch
    expect(clay.Hu).toBeCloseTo(mud.Hu, 6);
  });

  it('supports pile shape + reinforcement in the sand model too', () => {
    const withRebar = calculateBromsSandPile(
      30, 10, 0.5, 0.45, 8, 2.5, 40, 0, 14.5,
      { shape: 'circular', D_m: 0.45, rebarArea_mm2: 1500, rebarFy_MPa: 300 }
    );
    const withoutRebar = calculateBromsSandPile(
      30, 10, 0.5, 0.45, 8, 2.5, 40, 0, 14.5,
      { shape: 'circular', D_m: 0.45 }
    );
    expect(withRebar.Mrd).toBeGreaterThan(withoutRebar.Mrd);
    expect(withRebar.shape).toBe('circular');
  });
});

describe('Wind/wave/current combination mode (FPV factor vs separate terms)', () => {
  it('the separate mode adds an independently-computed current + wave term the combined mode folds away', () => {
    const s = base();
    s.raft.solarPanelCount = 800;
    s.env.currentSpeed_ms = 1.2;
    s.env.waveHs_m = 0.6;

    const combined = calculateLoads(s.raft, { ...s.env, loadCombinationMode: 'fpv_combined' }, s.line, true, 3.0);
    const separate = calculateLoads(s.raft, { ...s.env, loadCombinationMode: 'separate' }, s.line, true, 3.0);

    // Combined mode never models current/wave as their own terms.
    expect(combined.f_current_kN).toBe(0);
    expect(combined.f_wave_kN).toBe(0);
    // Separate mode does, and they are strictly positive given real current/wave input.
    expect(separate.f_current_kN).toBeGreaterThan(0);
    expect(separate.f_wave_kN).toBeGreaterThan(0);
    // Wind itself is identical between the two modes — only the combination differs.
    expect(separate.f_wind_total_kN).toBeCloseTo(combined.f_wind_total_kN, 6);
  });

  it('omitting loadCombinationMode defaults to the historical fpv_combined behaviour', () => {
    const s = base();
    s.raft.solarPanelCount = 800;
    const withDefault = calculateLoads(s.raft, s.env, s.line, true, 3.0);
    const explicit = calculateLoads(s.raft, { ...s.env, loadCombinationMode: 'fpv_combined' }, s.line, true, 3.0);
    expect(withDefault.f_env_total_kN).toBeCloseTo(explicit.f_env_total_kN, 9);
  });
});

describe('C8 — bed clearance and C9 — average line spacing', () => {
  it('C8 fails when the raft draft leaves less than the minimum bed clearance', () => {
    const s = catenaryProject();
    s.env.waterDepth_m = 2.0;
    s.env.tideRange_m = 0;
    s.raft.draft_m = 1.5; // clearance = 0.5 m < default 1.0 m minimum
    const r = calculateProject(s);
    const c8 = check(r.checks, 'C8');
    expect(c8.status).toBe('FAIL');
    expect(r.bedClearance_m).toBeCloseTo(0.5, 6);
  });

  it('C8 passes with ample clearance and honours an explicit criteria override', () => {
    const s = catenaryProject();
    s.env.waterDepth_m = 10;
    s.env.tideRange_m = 0;
    s.raft.draft_m = 1.2;
    const r = calculateProject(s);
    expect(check(r.checks, 'C8').status).toBe('PASS');

    const strict = catenaryProject();
    strict.env.waterDepth_m = 10;
    strict.env.tideRange_m = 0;
    strict.raft.draft_m = 1.2;
    strict.criteria.minBedClearance_m = 20; // an absurdly strict override must still be honoured
    const rStrict = calculateProject(strict);
    expect(check(rStrict.checks, 'C8').status).toBe('FAIL');
  });

  it('C9 is mandatory: exceeding max spacing fails the overall verdict', () => {
    const s = catenaryProject();
    s.raft.length_m = 100;
    s.raft.width_m = 80;
    s.line.count = 5; // perimeter 360 m / 5 lines = 72 m spacing, way over 15 m
    const r = calculateProject(s);
    const c9 = check(r.checks, 'C9');
    expect(c9.status).toBe('FAIL');
    expect(c9.isMandatory).toBe(true);
    expect(r.avgLineSpacing_m).toBeCloseTo(72, 6);
    expect(r.overallVerdict).toBe('FAIL');
  });

  it('C9 uses the measured outline perimeter P_bè when the raft supplies it', () => {
    const s = catenaryProject();
    s.raft.length_m = 100;
    s.raft.width_m = 80; // bounding rectangle: 360 m
    s.raft.perimeter_m = 300; // measured outline
    s.line.count = 20;
    const r = calculateProject(s);
    expect(r.avgLineSpacing_m).toBeCloseTo(15, 6); // 300 / 20, not 360 / 20
    expect(check(r.checks, 'C9').status).toBe('PASS');
  });

  it('C9 passes when lines are spaced within the default 15 m limit', () => {
    const s = catenaryProject();
    s.raft.length_m = 20;
    s.raft.width_m = 10;
    s.line.count = 6; // perimeter 60 m / 6 = 10 m spacing
    const r = calculateProject(s);
    expect(check(r.checks, 'C9').status).toBe('PASS');
  });

  it('both checks stay finite and never NA on a fully-populated project', () => {
    const r = calculateProject(base());
    expect(r.bedClearance_m).not.toBeNull();
    expect(r.avgLineSpacing_m).not.toBeNull();
    expect(check(r.checks, 'C8').status).not.toBe('NA');
    expect(check(r.checks, 'C9').status).not.toBe('NA');
  });
});
