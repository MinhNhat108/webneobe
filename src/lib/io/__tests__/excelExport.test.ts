import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildPileScheduleWorkbook,
  pileScheduleExcelFileName
} from '../excelExport';
import { calculateProject } from '../../calc';
import { buildPileSchedule } from '../pileSchedule';
import { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT } from '../../../data/huoiVanhProject';
import coordinates from '../../../data/huoiVanhCoordinates.json';

const base = (): ProjectState =>
  JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;

describe('Standalone Pile Schedule Excel Export', () => {
  it('builds a valid workbook with BangThongKeCoc sheet', () => {
    const state = base();
    const results = calculateProject(state);
    const wb = buildPileScheduleWorkbook(state, results);

    expect(wb.SheetNames).toContain('BangThongKeCoc');
    const ws = wb.Sheets['BangThongKeCoc'];
    expect(ws).toBeDefined();

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    expect(data.length).toBeGreaterThan(299);

    // Row 1: Title
    expect(data[0][0]).toContain('BẢNG THỐNG KÊ CỌC NEO');
    // Row 2: Project name
    expect(data[1][0]).toContain('Dự án:');
    // Row 3: Description
    expect(data[2][0]).toContain('Tổng số cọc: 299');

    // Row 5: Column headers (14 columns matching the AutoCAD table, with both depths)
    const headers = data[4];
    expect(headers).toEqual([
      'MÃ CỌC',
      'KÝ HIỆU KS',
      'CỤM BÈ',
      'LOẠI',
      'X (m)',
      'Y (m)',
      'Z (m)',
      'D (m)',
      'L_opt (m)',
      'L_tk (m)',
      'T_max (kN)',
      'P_req (kN)',
      'P_max (kN)',
      'KL'
    ]);

    // Check first pile row
    const firstRow = data[5];
    expect(firstRow[0]).toBe('HV-P001');
    expect(firstRow[1]).toBe(coordinates[0].code);
    expect(firstRow[3]).toBe(coordinates[0].type === 'SHORE' ? 'BỜ' : 'ĐÁY HỒ');
    expect(typeof firstRow[4]).toBe('number'); // X
    expect(typeof firstRow[5]).toBe('number'); // Y
    expect(typeof firstRow[6]).toBe('number'); // Z
    expect(typeof firstRow[7]).toBe('number'); // D
    expect(typeof firstRow[8]).toBe('number'); // L_opt
    expect(typeof firstRow[9]).toBe('number'); // L_tk
    expect(typeof firstRow[10]).toBe('number'); // T_max
    expect(typeof firstRow[11]).toBe('number'); // P_req
    expect(typeof firstRow[12]).toBe('number'); // P_max
    expect(firstRow[13]).toBe('ĐẠT');
    // The pile is driven deeper than the Broms minimum, so it must read as
    // genuinely stronger than the demand — not the 94-99% the old column showed.
    expect(firstRow[9]).toBeGreaterThan(firstRow[8] as number);
    expect(firstRow[12]).toBeGreaterThan((firstRow[11] as number) * 1.3);

    // Check 299th pile row
    const lastPileRow = data[5 + 299 - 1];
    expect(lastPileRow[0]).toBe('HV-P299');
    expect(lastPileRow[1]).toBe(coordinates[298].code);

    // Summary section exists below pile rows
    const summaryHeader = data.find((r) => r[0] === 'TỔNG HỢP & THỐNG KÊ CỌC NEO TOÀN DỰ ÁN');
    expect(summaryHeader).toBeDefined();

    const totalRow = data.find((r) => r[0] === 'Tổng số điểm cọc neo');
    expect(totalRow?.[1]).toBe(299);

    const shoreRow = data.find((r) => r[0] === 'Số lượng cọc neo bờ (BỜ)');
    expect(shoreRow?.[1]).toBe(129);

    const bedRow = data.find((r) => r[0] === 'Số lượng cọc neo lòng hồ (ĐÁY HỒ)');
    expect(bedRow?.[1]).toBe(170);

    const passedRow = data.find((r) => r[0] === 'Số cọc ĐẠT sức chịu tải (P_req ≤ P_max)');
    expect(passedRow?.[1]).toBe(299);
  });

  it('generates proper filename pattern', () => {
    const state = base();
    state.meta.code = 'HV-FPV-2026';
    const date = new Date(2026, 8, 22);
    const fname = pileScheduleExcelFileName(state, date);
    expect(fname).toBe('bang-thong-ke-coc-neo_HV-FPV-2026_20260922.xlsx');
  });
});

/**
 * The P_max column must describe the pile that gets BUILT, not the Broms
 * minimum. Before this change it quoted the capacity at L_opt, so P_req/P_max
 * sat at 0.94–0.996 for all 299 piles and the KL column could only ever read
 * "ĐẠT" — a check that cannot fail tells an inspector nothing.
 */
describe('Pile schedule quotes the as-built capacity', () => {
  it('P_max is the capacity at the design depth, not at L_opt', () => {
    const state = base();
    const results = calculateProject(state);
    const rows = buildPileSchedule(state, results);

    const shore = rows.find((r) => r.type === 'SHORE')!;
    expect(shore.Linput_m).toBe(state.anchor.shoreL_m);       // driven depth
    expect(shore.Lopt_m!).toBeLessThan(shore.Linput_m);        // minimum depth
    expect(shore.Pmax_kN).toBe(results.shorePileCapacity!.Pmax_kN);
    // Deeper pile ⇒ materially stronger than the L_opt figure it used to show.
    expect(shore.Pmax_kN).toBeGreaterThan(shore.PmaxAtLopt_kN * 1.5);

    const bed = rows.find((r) => r.type === 'BED')!;
    expect(bed.Pmax_kN).toBe(results.bedPileCapacity!.Pmax_kN);
    expect(bed.Pmax_kN).toBeGreaterThan(bed.PmaxAtLopt_kN);
  });

  it('the utilisation is no longer pinned just under 1.0', () => {
    const state = base();
    const rows = buildPileSchedule(state, calculateProject(state));
    const ratios = rows.map((r) => r.Preq_kN / r.Pmax_kN);
    // Previously every ratio sat in 0.94–0.996 by construction.
    expect(Math.min(...ratios)).toBeLessThan(0.8);
  });

  it('the KL column can actually fail when the pile is too weak', () => {
    const state = base();
    state.anchor.pileRatedPmaxShore_kN = 1; // a 1 kN pile cannot hold the line
    const rows = buildPileSchedule(state, calculateProject(state));
    const shore = rows.filter((r) => r.type === 'SHORE');
    expect(shore.every((r) => !r.isPmaxOk)).toBe(true);
  });
});
