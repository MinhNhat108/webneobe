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
  pileMrd_kNm
} from '../broms';
import { ProjectState, CheckItem, PileSectionInput } from '../types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';

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
    expect(r.f_env_total_kN).toBeGreaterThan(150);
    expect(r.t_max_intact_kN).toBeGreaterThan(50);
    expect(r.checks.length).toBeGreaterThanOrEqual(7);
    expect(['PASS', 'FAIL', 'NA']).toContain(r.overallVerdict);
  });

  it('verifies all 13 Huoi Vanh rafts calculate and pass', () => {
    for (const raft of HUOI_VANH_RAFTS) {
      const s = base();
      s.activeRaftId = raft.id;
      s.raft.length_m = raft.length_m;
      s.raft.width_m = raft.width_m;
      s.raft.solarPanelCount = raft.solarPanelCount || Math.round(raft.area_m2 * 0.22);
      s.line.count = raft.cableCount;
      s.line.cableCode = raft.selectedCable;
      s.line.focusFactor = raft.focusFactor;
      s.line.shoreLineCount = raft.shoreAnchors;
      s.line.bedLineCount = raft.bedAnchors;
      s.line.mbl_kN = raft.selectedCable === 'PES-48' ? 688
        : raft.selectedCable === 'PES-36' ? 385
        : raft.selectedCable === 'PES-32' ? 305
        : raft.selectedCable === 'PES-28' ? 235
        : 172;
      s.env.waterDepth_m = raft.waterDepth_m || 6.0;
      if (raft.shorePileD_m) s.anchor.shoreD_m = raft.shorePileD_m;
      if (raft.shorePileL_m) s.anchor.shoreL_m = raft.shorePileL_m;
      if (raft.bedPileD_m) s.anchor.bed1D_m = raft.bedPileD_m;
      if (raft.bedPileL_m) s.anchor.bed1L_m = raft.bedPileL_m;

      const r = calculateProject(s);
      const failed = r.checks.filter((c: any) => c.status === 'FAIL');
      if (failed.length > 0) {
        console.log(`Raft ${raft.id} (${raft.name}) FAILED:`, failed.map((c: any) => `${c.id} (${c.label}) actual: ${c.displayActual}, thresh: ${c.threshold}`));
      }
      expect(r.overallVerdict, `Raft ${raft.name} should pass`).toBe('PASS');
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

  it('adds a positive steel moment contribution only when rebar area is given', () => {
    const plain: PileSectionInput = { shape: 'square', D_m: 0.45 };
    const reinforced: PileSectionInput = { shape: 'square', D_m: 0.45, rebarArea_mm2: 2000, rebarFy_MPa: 300 };
    const mPlain = pileMrd_kNm(plain, 14.5);
    const mReinforced = pileMrd_kNm(reinforced, 14.5);
    expect(mPlain.MrdSteel_kNm).toBe(0);
    expect(mReinforced.MrdSteel_kNm).toBeGreaterThan(0);
    expect(mReinforced.Mrd_kNm).toBeGreaterThan(mPlain.Mrd_kNm);
    expect(mReinforced.MrdConcrete_kNm).toBeCloseTo(mPlain.MrdConcrete_kNm, 6); // concrete term unaffected
    // Doubling the steel area doubles its moment contribution (linear in As).
    const doubleSteel: PileSectionInput = { ...reinforced, rebarArea_mm2: 4000 };
    expect(pileMrd_kNm(doubleSteel, 14.5).MrdSteel_kNm).toBeCloseTo(2 * mReinforced.MrdSteel_kNm, 6);
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

  it('C9 is a non-mandatory warning: exceeding max spacing never flips the overall verdict', () => {
    const s = catenaryProject();
    s.raft.length_m = 100;
    s.raft.width_m = 80;
    s.line.count = 5; // perimeter 360 m / 5 lines = 72 m spacing, way over 15 m
    const r = calculateProject(s);
    const c9 = check(r.checks, 'C9');
    expect(c9.status).toBe('FAIL');
    expect(c9.isMandatory).toBe(false);
    expect(r.avgLineSpacing_m).toBeCloseTo(72, 6);
    // A lone non-mandatory failure must not be able to fail the whole project
    // when every mandatory check passed.
    const mandatoryFailed = r.checks.some((c) => c.isMandatory && c.status === 'FAIL');
    if (!mandatoryFailed) expect(r.overallVerdict).not.toBe('FAIL');
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
