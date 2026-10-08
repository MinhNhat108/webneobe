import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { calculateCostEstimate, DEFAULT_COST_PARAMS, BORED_PILE_PRICE_LIST, BED_MATERIAL_PRESETS } from '../costEstimate';
import { buildCostWorkbook, costExcelFileName } from '../../io/costExcelExport';
import { buildPileSchedule } from '../../io/pileSchedule';
import { calculateProject } from '../index';
import { buildRaftProjectState } from '../raftState';
import type { ProjectState } from '../types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { summariseScrewBases } from '../screwBaseSummary';

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
  it('takes the quantities from the pile schedule at the 20 m/s default: 214 bored piles, 1 412.4 m; 78 driven piles (PA1), 727.5 m', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect([c.totalShorePiles, c.totalBedPiles, c.totalPiles]).toEqual([214, 78, 292]);
    expect(c.bedAnchorKind).toBe('pile');
    expect(c.unpriced).toEqual([]);
    expect(c.totalShoreMeters).toBeCloseTo(1412.4, 6);
    expect(c.totalBedMeters).toBeCloseTo(727.5, 6);
    expect(c.totalMeters).toBeCloseTo(rows.reduce((s, r) => s + r.pileCount * r.Ltotal_m, 0), 6);
  });

  it('hand check of every line and of the total', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect(c.shoreTotal_VND).toBeCloseTo(1412.4 * 480_000, 3); // 677 952 000
    expect(c.bedMaterialTotal_VND).toBeCloseTo(727.5 * 380_000, 3); // 276 450 000
    expect(c.bedDrivingTotal_VND).toBeCloseTo(727.5 * 170_000, 3); // 123 675 000
    expect(c.bedLogisticsTotal_VND).toBeCloseTo(0.07 * 727.5 * 380_000, 3); // 19 351 500
    expect(c.bedBargeSetup_VND).toBe(50_000_000);
    expect(c.bedTotal_VND).toBeCloseTo(276_450_000 + 123_675_000 + 19_351_500 + 50_000_000, 3);
    expect(c.directTotal_VND).toBeCloseTo(677_952_000 + 469_476_500, 3); // 1 147 428 500
    expect(c.contingency_VND).toBeCloseTo(0.05 * 1_147_428_500, 3);
    expect(c.beforeVat_VND).toBeCloseTo(1.05 * 1_147_428_500, 3);
    expect(c.vat_VND).toBeCloseTo(0.08 * 1.05 * 1_147_428_500, 3);
    expect(c.grandTotal_VND).toBeCloseTo(1.08 * 1.05 * 1_147_428_500, 2); // 1 301 183 919
    expect(c.lines.map((l) => l.no)).toEqual(['A', 'B.1', 'B.2', 'B.3', 'B.4']);
    expect(c.lines.reduce((s, l) => s + l.amount_VND, 0)).toBeCloseTo(c.directTotal_VND, 3);
  });

  it('the 9 rafts add up exactly to the project total', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect(c.raftBreakdowns).toHaveLength(9);
    const sum = (f: (b: (typeof c.raftBreakdowns)[number]) => number) => c.raftBreakdowns.reduce((s, b) => s + f(b), 0);
    expect(sum((b) => b.totalCost_VND)).toBeCloseTo(c.directTotal_VND, 3);
    expect(sum((b) => b.shoreCost_VND)).toBeCloseTo(c.shoreTotal_VND, 3);
    expect(sum((b) => b.bedCost_VND)).toBeCloseTo(c.bedTotal_VND, 3); // includes the shared barge set-up
    expect(sum((b) => b.shorePiles)).toBe(214);
    expect(sum((b) => b.bedPiles)).toBe(78);
    const be5a = c.raftBreakdowns.find((b) => b.raftName === 'BÈ 5A')!;
    expect([be5a.shorePiles, be5a.bedPiles]).toEqual([32, 17]); // one pile per point at the 20 m/s default
  });

  it('states how much heavier the designed reinforcement is than a reference pile', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    expect(c.shoreMainSteel_kg_m).toBeGreaterThan(18);
    expect(c.bedMainSteel_kg_m).toBeGreaterThan(12);
  });
});

describe('Quotation with the lake-bed anchors on screw-pile bases (the design)', () => {
  const qty = () => {
    const { state } = setup();
    const s = summariseScrewBases(state, 1, HUOI_VANH_RAFTS, dflt().anchor);
    return {
      summary: s,
      screw: { rows: s.rows.map((r) => ({ name: r.name, bases: r.bases, concrete_m3: r.concrete_m3, rebar_kg: r.rebar_kg, screwLength_m: r.screwLength_m })) }
    };
  };

  it('no reference price exists for the bases: they are listed with their quantities as unpriced, never silently as zero cost', () => {
    const { rows } = setup();
    const { screw, summary } = qty();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows, screw);
    expect(c.bedAnchorKind).toBe('screwBase');
    expect([c.totalBases, c.totalBedPiles, c.totalShorePiles]).toEqual([51, 0, 214]);
    expect(c.baseConcrete_m3).toBeCloseTo(summary.concrete_m3, 6);
    expect(c.screwLength_m).toBeCloseTo(summary.screwLength_m, 6);
    expect(c.lines.map((l) => l.no)).toEqual(['A', 'B.1', 'B.2', 'B.3', 'B.4', 'B.5']);
    expect(c.unpriced).toHaveLength(4);
    expect(c.lines.filter((l) => l.note.startsWith('CHƯA CÓ ĐƠN GIÁ'))).toHaveLength(4);
    expect(c.bedTotal_VND).toBe(50_000_000); // only the barge set-up has a price
    expect(c.shoreTotal_VND).toBeCloseTo(1412.4 * 480_000, 3); // the shore piles are the same in both options
  });

  it('once prices are entered every line is quantity x rate and the rafts add up', () => {
    const { rows } = setup();
    const { screw } = qty();
    const p = { ...DEFAULT_COST_PARAMS, baseConcreteRate_VND_m3: 3_000_000, baseRebarRate_VND_kg: 20_000, screwRate_VND_m: 400_000, baseInstallRate_VND_each: 5_000_000 };
    const c = calculateCostEstimate(p, rows, screw);
    expect(c.unpriced).toEqual([]);
    expect(c.bedTotal_VND).toBeCloseTo(c.baseConcrete_m3 * 3_000_000 + c.baseRebar_kg * 20_000 + c.screwLength_m * 400_000 + 51 * 5_000_000 + 50_000_000, 2);
    expect(c.lines.reduce((s, l) => s + l.amount_VND, 0)).toBeCloseTo(c.directTotal_VND, 2);
    expect(c.raftBreakdowns).toHaveLength(9);
    expect(c.raftBreakdowns.reduce((s, b) => s + b.totalCost_VND, 0)).toBeCloseTo(c.directTotal_VND, 2);
    expect(c.raftBreakdowns.reduce((s, b) => s + b.bedPiles, 0)).toBeCloseTo(51, 9); // a shared base counts half for each of its two rafts;
  });

  it('a quotation saved before these prices existed still computes', () => {
    const { rows } = setup();
    const { screw } = qty();
    const { baseConcreteRate_VND_m3, baseRebarRate_VND_kg, screwRate_VND_m, baseInstallRate_VND_each, ...old } = DEFAULT_COST_PARAMS;
    void baseConcreteRate_VND_m3; void baseRebarRate_VND_kg; void screwRate_VND_m; void baseInstallRate_VND_each;
    const c = calculateCostEstimate(old as typeof DEFAULT_COST_PARAMS, rows, screw);
    expect(Number.isFinite(c.grandTotal_VND)).toBe(true);
    expect(c.unpriced).toHaveLength(4);
  });
});

describe('Editable prices', () => {
  it('detailed mode = labour + material; a surcharge adds per metre; VAT can be switched off', () => {
    const { rows } = setup();
    const base = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    const detailed = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, shoreBoredCostMode: 'detailed' }, rows);
    expect(detailed.shoreTotal_VND).toBeCloseTo(base.shoreTotal_VND, 3); // 270 000 + 210 000 = 480 000
    const dear = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, shoreBoredCostMode: 'detailed', shoreLaborRate_VND_m: 300_000 }, rows);
    expect(dear.shoreTotal_VND - base.shoreTotal_VND).toBeCloseTo(1412.4 * 30_000, 3);
    const sur = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, shoreRebarSurcharge_VND_m: 100_000, bedRebarSurcharge_VND_m: 50_000 }, rows);
    expect(sur.shoreTotal_VND - base.shoreTotal_VND).toBeCloseTo(1412.4 * 100_000, 3);
    expect(sur.bedMaterialTotal_VND - base.bedMaterialTotal_VND).toBeCloseTo(727.5 * 50_000, 3);
    expect(sur.bedLogisticsTotal_VND).toBeGreaterThan(base.bedLogisticsTotal_VND); // logistics follows the purchase price
    const noVat = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, includeVat: false }, rows);
    expect(noVat.vat_VND).toBe(0);
    expect(noVat.grandTotal_VND).toBeCloseTo(base.beforeVat_VND, 3);
    const prestressed = calculateCostEstimate({ ...DEFAULT_COST_PARAMS, bedMaterialPreset: 'prestressed', bedMaterialRate_VND_m: 840_000 }, rows);
    expect(prestressed.bedMaterialTotal_VND).toBeCloseTo(727.5 * 840_000, 3);
  });

  it('no lake-bed piles, no barge', () => {
    const { rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows.filter((r) => r.type === 'SHORE'));
    expect(c.bedTotal_VND).toBe(0);
    expect(c.directTotal_VND).toBeCloseTo(c.shoreTotal_VND, 3);
  });
});

describe('Quotation workbook', () => {
  it('has the BaoGia_ThiCong sheet with the lines, the totals and the 9 rafts', () => {
    const { state, rows } = setup();
    const c = calculateCostEstimate(DEFAULT_COST_PARAMS, rows);
    const wb = buildCostWorkbook(state, DEFAULT_COST_PARAMS, c);
    expect(wb.SheetNames).toEqual(['BaoGia_ThiCong']);
    const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.BaoGia_ThiCong, { header: 1 });
    const row = (label: string) => data.find((r) => r[1] === label || r[0] === label)!;
    expect(row('TỔNG CỘNG')[5]).toBe(Math.round(c.grandTotal_VND));
    expect(row('CỘNG CHI PHÍ TRỰC TIẾP (A + B)')[5]).toBe(1_147_428_500);
    expect(data.find((r) => r[0] === 'A')![5]).toBe(677_952_000);
    expect(data.filter((r) => /^BÈ \d+A?$/.test(String(r[0])))).toHaveLength(9);
    expect(data.find((r) => r[0] === 'TỔNG')![7]).toBe(1_147_428_500);
    expect(data.some((r) => String(r[0]).includes('GIÁ THAM KHẢO'))).toBe(true);
    expect(costExcelFileName(state, new Date(2026, 9, 4))).toBe(`bao-gia-thi-cong-coc_${state.meta.code}_20261004.xlsx`);
  });
});
