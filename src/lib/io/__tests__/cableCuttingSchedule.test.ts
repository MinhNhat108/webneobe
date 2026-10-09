import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildCableCuttingSchedule, SHORT_SHORE_SPAN_M } from '../cableCuttingSchedule';
import { buildScrewBaseScheduleWorkbook } from '../screwBaseExcel';
import { calculateProject } from '../../calc';
import { buildRaftProjectState } from '../../calc/raftState';
import type { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../../data/huoiVanhLayout';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);

describe('Cable cutting schedule', () => {
  const s = buildCableCuttingSchedule(state);

  it('has one row per mooring line, at the three reservoir levels', () => {
    expect(s.rows).toHaveLength(MOORING_LINES_V2.length);
    expect(s.rows.map((r) => r.code)).toEqual(MOORING_LINES_V2.map((l) => l.code));
    expect(s.levels).toEqual({ mnc_m: 380, mndb_m: 384.5, mnlkt_m: 386 });
    expect([s.totals.lines, s.totals.shoreLines, s.totals.bedLines]).toEqual([295, 231, 64]);
  });

  it('hand calculation of one lake-bed line and one shore line', () => {
    const bed = s.rows.find((r) => r.type === 'BED')!;
    const line = MOORING_LINES_V2.find((l) => l.code === bed.code)!;
    const pin = line.zAnchor + 0.4 + 0.15; // slab 0.4 m + padeye 0.15 m
    expect(bed.pinLevel_m).toBeCloseTo(pin, 9);
    expect(bed.chordHigh_m).toBeCloseTo(Math.hypot(line.span, 386 + 0.35 - pin), 9); // cleat 0.35 m above the water
    expect(bed.chordLow_m).toBeCloseTo(Math.hypot(line.span, 380 + 0.35 - pin), 9);
    expect(bed.cutLength_m).toBe(bed.chordHigh_m);
    expect(bed.slackLow_m).toBeCloseTo(bed.chordHigh_m - bed.chordLow_m, 9);
    // horizontal play: with the cable of that length, how far the cleat can go at low water
    expect(bed.playLow_m).toBeCloseTo(Math.sqrt(bed.cutLength_m ** 2 - (380 + 0.35 - pin) ** 2) - line.span, 9);
    const shore = s.rows.find((r) => r.type === 'SHORE')!;
    expect(shore.cutLength_m).toBe(Math.max(shore.chordLow_m, shore.chordNormal_m, shore.chordHigh_m));
  });

  it('every lake-bed cable is longest at MNLKT and every shore cable at MNC: the two families take over from one another', () => {
    for (const r of s.rows) expect(r.governing, r.code).toBe(r.type === 'BED' ? 'MNLKT' : 'MNC');
    expect(s.totals.governedBy).toEqual({ MNC: 231, MNDB: 0, MNLKT: 64 });
    for (const r of s.rows) {
      // never shorter than the distance it has to span, at any level
      for (const v of [r.slackLow_m, r.slackNormal_m, r.slackHigh_m]) expect(v, r.code).toBeGreaterThanOrEqual(-1e-9);
      // taut at its governing level
      expect(r.type === 'BED' ? r.slackHigh_m : r.slackLow_m, r.code).toBeCloseTo(0, 9);
    }
  });

  it('pins the slack the site has to live with: lake-bed cables 1.2–2.6 m slack at MNC, most shore cables a few decimetres at MNDB', () => {
    const bed = s.rows.filter((r) => r.type === 'BED'), shore = s.rows.filter((r) => r.type === 'SHORE');
    expect(Math.min(...bed.map((r) => r.slackLow_m))).toBeGreaterThan(1.1);
    expect(s.totals.maxBedSlackLow_m).toBeGreaterThan(2.4);
    expect(s.totals.maxBedSlackLow_m).toBeLessThan(2.8);
    const sorted = shore.map((r) => r.slackNormal_m).sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(0.5); // the median shore cable
    // the short shore lines are the exception, and they are flagged, not hidden
    expect(s.totals.shortShoreLines).toBe(13);
    expect(s.totals.maxShoreSlackNormal_m).toBeGreaterThan(2.5);
    for (const r of shore.filter((x) => x.span_m < SHORT_SHORE_SPAN_M)) expect(r.note, r.code).toContain('Dây bờ ngắn');
    for (const r of bed) expect(r.note, r.code).toContain('Đo cao độ đáy thực tế trước khi cắt');
  });

  it('a lower lake bed needs a longer cable, and an allowance is added as a constant', () => {
    const deeper = buildCableCuttingSchedule(state, MOORING_LINES_V2.map((l) => (l.type === 'BED' ? { ...l, zAnchor: l.zAnchor - 0.5 } : l)));
    const a = s.rows.find((r) => r.type === 'BED')!, b = deeper.rows.find((r) => r.code === a.code)!;
    expect(b.cutLength_m).toBeGreaterThan(a.cutLength_m + 0.1);
    const plus = buildCableCuttingSchedule(state, undefined, 1.5);
    expect(plus.rows[0].cutLength_m).toBeCloseTo(s.rows[0].cutLength_m + 1.5, 9);
    expect(plus.totals.shoreLength_m + plus.totals.bedLength_m).toBeCloseTo(s.totals.shoreLength_m + s.totals.bedLength_m + 1.5 * 295, 6);
  });

  it('is the sixth sheet of the anchor workbook, with the assumptions written on it', () => {
    const wb = buildScrewBaseScheduleWorkbook(state, calculateProject(state));
    expect(wb.SheetNames).toEqual(['ThongKeCocBo', 'ThongKeDeNeoVit', 'DeTheoBe', 'TungDiemNeoDay', 'TungDiemNeoBo', 'ChieuDaiCatCap']);
    const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ChieuDaiCatCap, { header: 1 });
    expect(data.filter((r) => /^B\w+-D\d+$/.test(String(r[1])))).toHaveLength(295);
    expect(String(data[1][0])).toContain('KHÔNG lắp cáp bằng cách kéo căng');
    expect(String(data[2][0])).toContain('CHƯA gồm đoạn bện đầu');
    expect(String(data[3][0])).toContain('phải đo cao độ đáy từng đế trước khi cắt');
    const first = data[6];
    expect(first[11]).toBe(Number(s.rows[0].cutLength_m.toFixed(2)));
    expect(data.find((r) => r[0] === 'Số dây do MNLKT chi phối')![1]).toBe(64);
  });
});
