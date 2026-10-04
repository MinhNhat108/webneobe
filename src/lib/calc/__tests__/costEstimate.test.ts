import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { calculateCostEstimate, DEFAULT_COST_PARAMS, BORED_PILE_PRICE_LIST, BED_MATERIAL_PRESETS } from '../costEstimate';
import { buildCostWorkbook, costExcelFileName } from '../../io/costExcelExport';
import { buildPileSchedule } from '../../io/pileSchedule';
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
  return { state, rows: buildPileSchedule(state, calculateProject(state), batch) };
};

describe('Default unit prices come from the reference price lists', () => {
  it('are the mid-points of the D350 bored-pile range and of the 350 x 350 precast ranges', () => {
    const p = DEFAULT_COST_PARAMS;
    expect(p.shoreTurnkeyRate_VND_m).toBe(480_000); // 460 000 – 500 000
    expect(p.shoreLaborRate_VND_m).toBe(270_000); // 260 000 – 280 000
    expect(p.shoreMaterialRate_VND_m).toBe(210_000);
    expect(p.bedMaterialRate_VND_m).toBe(380_000); // commercial standard, 320 000 – 450 000
    expect(p.bedDrivingRate_VND_m).toBe(170_000); // 120 000 – 220 000
    expect(p.bedBargeSetup_VND).toBe(50_000_000); // 30 – 70 million
    expect(p.bedLogisticsPercent).toBe(7);
    expect([p.contingencyPercent, p.vatPercent, p.includeVat]).toEqual([5, 8, true]);
    expect([p.shoreRebarSurcharge_VND_m, p.bedRebarSurcharge_VND_m]).toEqual([0, 0]);
    expect(BORED_PILE_PRICE_LIST.map((x) => x.dia_mm)).toEqual([300, 350, 400, 500, 600]);
    expect(BED_MATERIAL_PRESETS.mass.rate).toBe(270_000);
    expect(BED_MATERIAL_PRESETS.prestressed.range).toEqual([650_000, 1_027_000]);
  });
});

describe('Quotation for Huổi Vanh at the default prices', () => {
  it('takes the quantities from the pile schedule: 141 bored piles, 939.6 m; 202 driven piles, 2 117.5 m', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect([c.totalShorePiles, c.totalBedPiles, c.totalPiles]).toEqual([141, 202, 343]);
    expect(c.totalShoreMeters).toBeCloseTo(939.6, 6);
    expect(c.totalBedMeters).toBeCloseTo(2117.5, 6);
    expect(c.totalMeters).toBeCloseTo(rows.reduce((s, r) => s + r.pileCount * r.Ltotal_m, 0), 6);
  });

  it('hand check of every line and of the total', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect(c.shoreTotal_VND).toBeCloseTo(939.6 * 480_000, 3); // 451 008 000
    expect(c.bedMaterialTotal_VND).toBeCloseTo(2117.5 * 380_000, 3); // 804 650 000
    expect(c.bedDrivingTotal_VND).toBeCloseTo(2117.5 * 170_000, 3); // 359 975 000
    expect(c.bedLogisticsTotal_VND).toBeCloseTo(0.07 * 2117.5 * 380_000, 3); // 56 325 500
    expect(c.bedBargeSetup_VND).toBe(50_000_000);
    expect(c.bedTotal_VND).toBeCloseTo(804_650_000 + 359_975_000 + 56_325_500 + 50_000_000, 3);
    expect(c.directTotal_VND).toBeCloseTo(451_008_000 + 1_270_950_500, 3); // 1 721 958 500
    expect(c.contingency_VND).toBeCloseTo(0.05 * 1_721_958_500, 3);
    expect(c.beforeVat_VND).toBeCloseTo(1.05 * 1_721_958_500, 3);
    expect(c.vat_VND).toBeCloseTo(0.08 * 1.05 * 1_721_958_500, 3);
    expect(c.grandTotal_VND).toBeCloseTo(1.08 * 1.05 * 1_721_958_500, 2); // 1 952 700 939
    expect(c.lines.map((l) => l.no)).toEqual(['A', 'B.1', 'B.2', 'B.3', 'B.4']);
    expect(c.lines.reduce((s, l) => s + l.amount_VND, 0)).toBeCloseTo(c.directTotal_VND, 3);
  });

  it('the 12 rafts add up exactly to the project total', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect(c.raftBreakdowns).toHaveLength(12);
    const sum = (f: (b: (typeof c.raftBreakdowns)[number]) => number) => c.raftBreakdowns.reduce((s, b) => s + f(b), 0);
    expect(sum((b) => b.totalCost_VND)).toBeCloseTo(c.directTotal_VND, 3);
    expect(sum((b) => b.shoreCost_VND)).toBeCloseTo(c.shoreTotal_VND, 3);
    expect(sum((b) => b.bedCost_VND)).toBeCloseTo(c.bedTotal_VND, 3); // includes the shared barge set-up
    expect(sum((b) => b.shorePiles)).toBe(141);
    expect(sum((b) => b.bedPiles)).toBe(202);
    const be5 = c.raftBreakdowns.find((b) => b.raftName === 'BÈ 5')!;
    expect([be5.shorePiles, be5.bedPiles]).toEqual([24, 54]); // twin piles
  });

  it('states how much heavier the designed reinforcement is than a reference pile', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect(c.shoreMainSteel_kg_m).toBeGreaterThan(25);
    expect(c.bedMainSteel_kg_m).toBeGreaterThan(15);
  });
});

describe('Editable prices', () => {
  it('detailed mode = labour + material; a surcharge adds per metre; VAT can be switched off', () => {
    const { rows } = setup();
    const base = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    const detailed = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, shoreBoredCostMode: 'detailed' }, rows);
    expect(detailed.shoreTotal_VND).toBeCloseTo(base.shoreTotal_VND, 3); // 270 000 + 210 000 = 480 000
    const dear = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, shoreBoredCostMode: 'detailed', shoreLaborRate_VND_m: 300_000 }, rows);
    expect(dear.shoreTotal_VND - base.shoreTotal_VND).toBeCloseTo(939.6 * 30_000, 3);
    const sur = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, shoreRebarSurcharge_VND_m: 100_000, bedRebarSurcharge_VND_m: 50_000 }, rows);
    expect(sur.shoreTotal_VND - base.shoreTotal_VND).toBeCloseTo(939.6 * 100_000, 3);
    expect(sur.bedMaterialTotal_VND - base.bedMaterialTotal_VND).toBeCloseTo(2117.5 * 50_000, 3);
    expect(sur.bedLogisticsTotal_VND).toBeGreaterThan(base.bedLogisticsTotal_VND); // logistics follows the purchase price
    const noVat = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, includeVat: false }, rows);
    expect(noVat.vat_VND).toBe(0);
    expect(noVat.grandTotal_VND).toBeCloseTo(base.beforeVat_VND, 3);
    const prestressed = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, bedMaterialPreset: 'prestressed', bedMaterialRate_VND_m: 840_000 }, rows);
    expect(prestressed.bedMaterialTotal_VND).toBeCloseTo(2117.5 * 840_000, 3);
  });

  it('no lake-bed piles, no barge', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows.filter((r) => r.type === 'SHORE'));
    expect(c.bedTotal_VND).toBe(0);
    expect(c.directTotal_VND).toBeCloseTo(c.shoreTotal_VND, 3);
  });
});

describe('Quotation workbook', () => {
  it('has the BaoGia_ThiCong sheet with the lines, the totals and the 12 rafts', () => {
    const { state, rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    const wb = buildCostWorkbook(state, DEFAULT_COST_PARAMS, c);
    expect(wb.SheetNames).toEqual(['BaoGia_ThiCong']);
    const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.BaoGia_ThiCong, { header: 1 });
    const row = (label: string) => data.find((r) => r[1] === label || r[0] === label)!;
    expect(row('TỔNG CỘNG')[5]).toBe(Math.round(c.grandTotal_VND));
    expect(row('CỘNG CHI PHÍ TRỰC TIẾP (A + B)')[5]).toBe(1_721_958_500);
    expect(data.find((r) => r[0] === 'A')![5]).toBe(451_008_000);
    expect(data.filter((r) => /^BÈ \d+$/.test(String(r[0])))).toHaveLength(12);
    expect(data.find((r) => r[0] === 'TỔNG')![7]).toBe(1_721_958_500);
    expect(data.some((r) => String(r[0]).includes('GIÁ THAM KHẢO'))).toBe(true);
    expect(costExcelFileName(state, new Date(2026, 9, 4))).toBe(`bao-gia-thi-cong-coc_${state.meta.code}_20261004.xlsx`);
  });
});
