import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildFinalDesign, buildFinalDesignWorkbook, finalDesignNote, FINAL_DESIGN_SHEETS } from '../finalDesignWorkbook';
import { calculateProject } from '../../calc';
import { buildRaftProjectState } from '../../calc/raftState';
import type { ProjectState } from '../../calc/types';
import { DEFAULT_COST_PARAMS } from '../../calc/costEstimate';
import { ringLeverFactor } from '../../calc/broms';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
const batch = HUOI_VANH_RAFTS.map((raft) => {
  const st = buildRaftProjectState(state, raft, dflt().anchor);
  return { raft, state: st, results: calculateProject(st) };
});
const d = buildFinalDesign(state, calculateProject(state), batch);

describe('Calculation workbook of the settled design (bored shore piles + screw-pile bases)', () => {
  it('every raft row is a hand calculation of the engine formulas', () => {
    expect(d.rafts).toHaveLength(9);
    // the engine rounds its results to 0.01 for display, hence the 0.05 tolerance
    for (const r of d.rafts) {
      const fPanel = (r.q_Pa * r.cdPanel * r.areaProjected_m2 * r.shield) / 1000;
      expect(fPanel, r.name).toBeCloseTo(r.fPanel_kN, 1);
      expect((fPanel + r.fFloat_kN) * r.waveCurrentFactor, r.name).toBeCloseTo(r.fEnv_kN, 1);
      const tGeo = r.fEnv_kN / (r.nEff * Math.cos((r.alpha_deg * Math.PI) / 180)) + r.pretension_kN;
      expect(Math.max(tGeo, r.fEnv_kN * r.focusFactor + r.pretension_kN), r.name).toBeCloseTo(r.tMax_kN, 1);
      expect(r.sfIntact, r.name).toBeGreaterThanOrEqual(3);
      expect(r.tMax_kN / r.Hallow_kN, r.name).toBeCloseTo(r.bp1, 2);
      expect((r.loadFactor * r.Mmax_kNm) / r.Mrd_kNm, r.name).toBeCloseTo(r.bp2, 2);
      expect(r.shoreLines + r.bedLines, r.name).toBe(r.lines);
    }
  });

  it('totals: 231 bored piles and 32 bases that all pass, uplift resistance above the demand', () => {
    const T = d.totals;
    expect([T.lines, T.shorePiles, T.bases, T.screws]).toEqual([295, 231, 32, 128]);
    expect(T.allOk).toBe(true);
    expect(T.shoreLength_m).toBeCloseTo(1524.6, 1);
    expect(T.baseConcrete_m3).toBeCloseTo(92.8, 1);
    expect(T.upliftResistance_kN).toBeGreaterThan(T.upliftDemand_kN);
    for (const k of ['uplift', 'slide', 'overturn', 'screw'] as const) expect(T.worst[k], k).toBeLessThanOrEqual(1);
    // one base: uplift resistance = 0.9 W' + 4 Q_a
    const b = d.schedule.bases[0].design;
    expect(b.cases[1].upliftResistance_kN).toBeCloseTo(0.9 * b.weightSub_kN + 4 * b.screwQa_kN, 9);
  });

  it('the quotation prices the bored piles and never invents a price for the bases and screws', () => {
    expect(d.cost.bedAnchorKind).toBe('screwBase');
    expect(d.cost.unpriced).toHaveLength(4);
    expect(d.cost.shoreTotal_VND).toBeCloseTo(d.totals.shoreLength_m * DEFAULT_COST_PARAMS.shoreTurnkeyRate_VND_m, 3);
    const priced = buildFinalDesign(state, calculateProject(state), batch, { ...DEFAULT_COST_PARAMS, baseConcreteRate_VND_m3: 3e6, baseRebarRate_VND_kg: 2e4, screwRate_VND_m: 5e5, baseInstallRate_VND_each: 5e6 });
    expect(priced.cost.unpriced).toHaveLength(0);
    expect(priced.cost.grandTotal_VND).toBeGreaterThan(d.cost.grandTotal_VND);
  });

  it('workbook: nine sheets, one row per pile and per base, the wind caveat and the assumptions written on it', () => {
    const wb = buildFinalDesignWorkbook(d);
    expect(wb.SheetNames).toEqual(FINAL_DESIGN_SHEETS);
    const rows = (name: string) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1 });
    expect(rows('CocKhoanNhoi_TungCoc').filter((r) => /^HV-P\d+$/.test(String(r[1])))).toHaveLength(231);
    expect(rows('DeNeoDay_TungDe').filter((r) => /^HV-DV\d+$/.test(String(r[1])))).toHaveLength(32);
    expect(rows('VitXoan').filter((r) => /^HV-DV\d+$/.test(String(r[0])))).toHaveLength(32);
    expect(rows('LucDay').filter((r) => /^BÈ /.test(String(r[0])))).toHaveLength(9);
    expect(rows('CocKhoanNhoi_TheoBe').filter((r) => /^BÈ /.test(String(r[0])))).toHaveLength(9);
    expect(String(rows('LucDay')[1][0])).toContain('THẤP HƠN gió tiêu chuẩn');
    const price = rows('KhoiLuong_BaoGia');
    expect(price.filter((r) => String(r[6] ?? '').startsWith('CHƯA CÓ ĐƠN GIÁ'))).toHaveLength(4);
    expect(price.some((r) => String(r[1] ?? '').includes('chưa gồm hạng mục chưa có đơn giá'))).toBe(true);
    const first = rows('DeNeoDay_TungDe').find((r) => r[1] === 'HV-DV001')!;
    expect(first[18]).toBe(d.schedule.bases[0].side_m);
  });

  it('the note states the decision, the worked example and the open issues', () => {
    const note = finalDesignNote(d);
    expect(note.map((s) => s.title.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.']);
    const text = note.flatMap((s) => s.lines).join('\n');
    expect(text).toContain('Chủ đầu tư chốt ngày 12/10/2026');
    expect(text).toContain('9/9 bè đạt; 231/231 cọc bờ đạt; 32/32 đế đạt');
    expect(text).toContain('GIẢ ĐỊNH');
    expect(text).toContain('đã trừ lực đẩy nổi');
    expect(text).toContain('B7-D01, B7-D09, B8-D13');
  });
});

describe('Live formula sheets of the calculation workbook', () => {
  const wb = buildFinalDesignWorkbook(d);
  const cell = (sheet: string, addr: string) => wb.Sheets[sheet][addr];

  it('the four CT_ sheets carry Excel formulas together with the engine values', () => {
    for (const name of ['CT_ThongSo', 'CT_LucDay', 'CT_CocKhoanNhoi', 'CT_DeVitXoan']) {
      const formulas = Object.keys(wb.Sheets[name]).filter((a) => a[0] !== '!' && wb.Sheets[name][a].f);
      expect(formulas.length, name).toBeGreaterThan(10);
    }
    // line tension of the first raft: MAX of the two methods, value of the engine
    expect(cell('CT_LucDay', 'M6').f).toBe('MAX(K6,L6)');
    expect(cell('CT_LucDay', 'M6').v).toBeCloseTo(d.rafts[0].tMax_kN, 6);
    // the pile takes its tension from the load sheet, the base from the load sheet by raft name
    expect(cell('CT_CocKhoanNhoi', 'F6').f).toContain('VLOOKUP(A6,CT_LucDay!');
    expect(cell('CT_DeVitXoan', 'D6').f).toContain('VLOOKUP(C6,CT_LucDay!');
    // inputs are plain values, never formulas
    expect(cell('CT_LucDay', 'B6').f).toBeUndefined();
    expect(cell('CT_DeVitXoan', 'M6').f).toBeUndefined();
    expect(cell('CT_DeVitXoan', 'M6').v).toBe(d.schedule.bases[0].side_m);
  });

  it('the bar-ring lever factor written as a formula equals the engine factor for 4, 6 and 8 bars', () => {
    for (const n of [4, 6, 8]) expect(2 / Math.tan(Math.PI / n)).toBeCloseTo(ringLeverFactor(n), 3);
    for (const r of d.rafts) {
      const mrd = ((Math.PI * r.rebarDia_mm ** 2) / 4 / 1e6) * r.rebarRs_MPa * 1000 * (r.pileD_m / 2 - 0.05) * (2 / Math.tan(Math.PI / r.rebarCount));
      expect(mrd, r.name).toBeCloseTo(r.Mrd_kNm, 1);
      expect(r.rebarCount % 2, r.name).toBe(0); // the closed form holds for an even number of bars
    }
  });
});
