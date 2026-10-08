import { describe, it, expect } from 'vitest';
import DxfParser from 'dxf-parser';
import * as XLSX from 'xlsx';
import { buildMooringScrewBaseDxf, dxfFileNamePA3, DXF_LAYERS_PA3 } from '../screwBaseDxf';
import { buildScrewBaseSchedule, findBaseClashes, baseCorners } from '../screwBaseSchedule';
import { buildScrewBaseScheduleWorkbook, screwBaseScheduleExcelFileName } from '../screwBaseExcel';
import { escapeDxfUnicode } from '../dxfVn';
import { buildPileSchedule } from '../pileSchedule';
import { calculateProject } from '../../calc';
import { buildRaftProjectState, resolveRaftState } from '../../calc/raftState';
import { summariseScrewBases } from '../../calc/screwBaseSummary';
import type { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../../data/huoiVanhLayout';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;

/** The project and the 9-raft batch exactly as the store builds them. */
const setup = (option: 'PA1_PILE' | 'PA3_SCREW_BASE' = 'PA3_SCREW_BASE') => {
  const start = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const state: ProjectState = { ...start, anchor: { ...start.anchor, bedAnchorOption: option } };
  const batch = HUOI_VANH_RAFTS.map((raft) => {
    const r = resolveRaftState(state, 1, raft, dflt().anchor);
    return { raft, state: r.state, results: calculateProject(r.state) };
  });
  return { state, results: calculateProject(state), batch };
};
const parse = (dxf: string) => new DxfParser().parseSync(dxf)!;
const decode = (t: string) => t.replace(/\\U\+([0-9A-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

describe('Option 3 schedule (231 shore points + 32 screw-pile bases, 29 of them shared by two rafts)', () => {
  it('has one row per anchor POINT, at the layout coordinates; a shared base lists its two lines', () => {
    const { state, results, batch } = setup();
    const s = buildScrewBaseSchedule(state, results, batch);
    expect(s.shorePiles).toHaveLength(231);
    expect(s.bases).toHaveLength(32);
    expect(s.bases.filter((b) => b.shared)).toHaveLength(29);
    expect(s.bases[0].baseId).toBe('HV-DV001');
    expect(s.bases[31].baseId).toBe('HV-DV032');
    expect(s.bases.flatMap((b) => b.lines.map((l) => l.code)).sort()).toEqual(MOORING_LINES_V2.filter((l) => l.type === 'BED').map((l) => l.code).sort());
    for (const b of s.bases) {
      expect(b.code, b.baseId).toBe(b.lines.map((l) => l.code).join(' + '));
      for (const l of b.lines) {
        const c = MOORING_LINES_V2.find((q) => q.code === l.code)!;
        expect([b.x, b.y, b.z, l.span_m, l.azimuth_deg, l.xRaft, l.yRaft], l.code).toEqual([c.xAnchor, c.yAnchor, c.zAnchor, c.span, c.azimuth, c.xRaft, c.yRaft]);
        expect(c.type, l.code).toBe('BED');
      }
      expect(b.span_m, b.baseId).toBe(Math.min(...b.lines.map((l) => l.span_m)));
    }
  });

  it('every line carries the governing tension of ITS raft; the raft-level engine base is kept beside the per-point bases', () => {
    const { state, results, batch } = setup();
    const s = buildScrewBaseSchedule(state, results, batch);
    for (const b of s.bases) {
      for (const l of b.lines) expect(l.tension_kN, l.code).toBe(batch.find((x) => x.raft.name === l.raft)!.results.t_max_intact_kN);
      expect(b.Tmax_kN, b.baseId).toBe(Math.max(...b.lines.map((l) => l.tension_kN)));
      expect(b.ok, b.baseId).toBe(true);
    }
    for (const x of batch) expect(s.baseByRaft.get(x.raft.name), x.raft.name).toEqual(x.results.bedScrewBase);
  });

  it('shares the quantities of a shared base half and half between its two rafts', () => {
    const { state, results, batch } = setup();
    const s = buildScrewBaseSchedule(state, results, batch);
    expect(s.byRaft.reduce((a, r) => a + r.bases, 0)).toBeCloseTo(32, 9);
    expect(s.byRaft.reduce((a, r) => a + r.concrete_m3, 0)).toBeCloseTo(s.totals.concrete_m3, 9);
    expect(s.byRaft.find((r) => r.name === 'BÈ 9')!.bases).toBe(0.5); // one line, on a base shared with BÈ 8
  });

  it('gives the same bases when handed option 1 results (it recalculates, never invents)', () => {
    const a = setup('PA3_SCREW_BASE'), b = setup('PA1_PILE');
    expect(buildScrewBaseSchedule(b.state, b.results, b.batch).bases).toEqual(buildScrewBaseSchedule(a.state, a.results, a.batch).bases);
  });

  it('shore piles are the rows of the pile schedule, with the same ids', () => {
    const { state, results, batch } = setup();
    expect(buildScrewBaseSchedule(state, results, batch).shorePiles)
      .toEqual(buildPileSchedule(state, results, batch).filter((r) => r.type === 'SHORE'));
  });

  it('totals: 32 bases for 61 lines, 128 screws, and the same quantities as the Tab 9 summary', () => {
    const { state, results, batch } = setup();
    const T = buildScrewBaseSchedule(state, results, batch).totals;
    const sum = summariseScrewBases(state, 1, HUOI_VANH_RAFTS, dflt().anchor);
    expect([T.bases, T.sharedBases, T.lines, T.screws, T.okBases]).toEqual([32, 29, 61, 128, 32]);
    expect([sum.bases, sum.sharedBases, sum.lines]).toEqual([32, 29, 61]);
    expect(T.concrete_m3).toBeCloseTo(sum.concrete_m3, 6);
    expect(T.rebar_kg).toBeCloseTo(sum.rebar_kg, 6);
    expect(T.screwLength_m).toBeCloseTo(sum.screwLength_m, 6);
    expect(T.maxLiftMass_t).toBeCloseTo(sum.maxLiftMass_t, 9);
    // At the 20 m/s default 11 bases are the workbook base 2.5 m; the others need 2.75–3.25 m, up to 10.8 t to lift.
    // The largest ones are the shared bases of the narrow gap BÈ 3 – BÈ 3A, governed by BOTH lines taut.
    expect(sum.basesBySide).toEqual({ '2.50': 11, '2.75': 17, '3.00': 2, '3.25': 2 });
    expect(sum.enlargedRafts).toEqual(['BÈ 3', 'BÈ 3A', 'BÈ 5A', 'BÈ 6', 'BÈ 7']);
    expect(sum.side_m).toEqual([2.5, 3.25]);
    expect(sum.maxLiftMass_t).toBeGreaterThan(10.5);
    expect(sum.maxLiftMass_t).toBeLessThan(11);
    expect(sum.concrete_m3).toBeGreaterThan(90);
    expect(sum.concrete_m3).toBeLessThan(98);
    expect(sum.allOk).toBe(true);
  });
});

describe('Bases that would overlap', () => {
  it('a base is laid with one side along its cable', () => {
    const c = baseCorners({ x: 10, y: 20 }, 2, 0); // cable due north
    expect(c.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([[9, 19], [9, 21], [11, 21], [11, 19]]);
    const d = baseCorners({ x: 0, y: 0 }, 2, 45);
    expect(Math.max(...d.map((p) => p.x))).toBeCloseTo(Math.SQRT2, 9); // turned 45°: the diagonal lies on the axis
  });

  it('detects a real overlap and ignores two bases that only look close', () => {
    const at = (id: string, x: number, y: number, az = 0) => ({ baseId: id, x, y, side_m: 4, azimuth_deg: az });
    expect(findBaseClashes([at('a', 0, 0), at('b', 4.01, 0)])).toEqual([]);
    expect(findBaseClashes([at('a', 0, 0), at('b', 3.9, 0)])).toHaveLength(1);
    // 4.5 m apart: clear when both are square to the line joining them, overlapping when one is turned 45°
    expect(findBaseClashes([at('a', 0, 0), at('b', 4.5, 0)])).toEqual([]);
    expect(findBaseClashes([at('a', 0, 0), at('b', 4.5, 0, 45)])).toHaveLength(1);
  });

  it('none of the 32 bases overlaps a neighbour in the 9-raft layout', () => {
    const { state, results, batch } = setup();
    expect(buildScrewBaseSchedule(state, results, batch).clashes).toEqual([]);
  });

  it('an overlap is reported on the drawing and in the workbook, never hidden', () => {
    const { state, results, batch } = setup();
    const bed = MOORING_LINES_V2.filter((l) => l.type === 'BED');
    // one lake-bed line taken off its base and given a base of its own 1 m beside another base
    const moved = bed.find((l) => l.anchorId !== bed[0].anchorId)!;
    const crowded = MOORING_LINES_V2.map((l) => (l.code === moved.code ? { ...l, anchorId: undefined, sharedWith: undefined, xAnchor: bed[0].xAnchor + 1, yAnchor: bed[0].yAnchor } : l));
    const s = buildScrewBaseSchedule(state, results, batch, crowded);
    expect(s.clashes.length).toBeGreaterThanOrEqual(1);
    const out = buildMooringScrewBaseDxf(state, results, batch, { coordinates: crowded });
    expect(decode(out.dxf)).toContain(`CẢNH BÁO: ${s.clashes.length} cặp đế CHỒNG LẤN nhau trên mặt bằng`);
    const wb = buildScrewBaseScheduleWorkbook(state, results, batch, crowded);
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ThongKeDeNeoVit, { header: 1 });
    expect(rows.find((r) => String(r[0]).startsWith('Số cặp đế CHỒNG LẤN'))![1]).toBe(s.clashes.length);
  });
});

describe('Option 3 DXF drawing', () => {
  const built = () => { const s = setup(); return { ...s, out: buildMooringScrewBaseDxf(s.state, s.results, s.batch) }; };

  it('is a well-formed R12 document, pure ASCII on disk, that dxf-parser reads', () => {
    const { out } = built();
    expect(out.dxf.startsWith('0\nSECTION\n')).toBe(true);
    expect(out.dxf.trimEnd().endsWith('EOF')).toBe(true);
    expect(out.dxf).toContain('AC1009');
    expect(/[^\x0A\x20-\x7E]/.test(out.dxf)).toBe(false);
    expect(out.dxf.split('\n').slice(0, -1).length % 2).toBe(0);
    const doc = parse(out.dxf);
    expect(Object.keys(doc.tables.layer.layers)).toEqual(expect.arrayContaining(Object.values(DXF_LAYERS_PA3).map((l) => l.name)));
    expect([out.shorePileCount, out.baseCount, out.raftCount]).toEqual([231, 32, 9]);
  });

  it('writes Vietnamese WITH diacritics: Unicode escapes and a TrueType text style', () => {
    const { out } = built();
    expect(escapeDxfUnicode('ĐẾ NEO')).toBe('\\U+0110\\U+1EBE NEO');
    expect(out.dxf).toContain('\nSTYLE\n2\nVN\n');
    expect(out.dxf).toContain('arial.ttf');
    const texts = parse(out.dxf).entities.filter((e: any) => e.type === 'TEXT').map((e: any) => decode(e.text as string));
    expect(texts.some((t) => t.includes('BẢNG THỐNG KÊ CỌC KHOAN NHỒI NEO BỜ (231 ĐIỂM NEO, 231 CỌC)'))).toBe(true);
    expect(texts.some((t) => t.includes('BẢNG THỐNG KÊ ĐẾ NEO ĐÁY HỒ: ĐẾ BTCT + VÍT XOẮN (32 ĐẾ, 29 ĐẾ DÙNG CHUNG, 61 TUYẾN CÁP)'))).toBe(true);
    expect(texts.some((t) => t.includes('CHI TIẾT ĐẾ NEO ĐÁY HỒ'))).toBe(true);
    // every TEXT entity uses the Vietnamese style
    expect((out.dxf.match(/\n7\nVN\n/g) || []).length).toBe(texts.length);
  });

  it('draws the 32 bases at their true size, turned to their cable, with four screw holes each; a shared base has two padeyes and two cables', () => {
    const { out } = built();
    const doc = parse(out.dxf);
    const onLayer = (name: string) => doc.entities.filter((e: any) => e.layer === name);
    const base = onLayer(DXF_LAYERS_PA3.base.name);
    expect(base.filter((e: any) => e.type === 'POINT')).toHaveLength(32);
    expect(base.filter((e: any) => e.type === 'CIRCLE')).toHaveLength(32 * 4);
    const lines = base.filter((e: any) => e.type === 'LINE') as any[];
    // 4 edges per base, plus two 0.3 m padeye squares (4 edges each) on each of the 29 shared bases
    expect(lines).toHaveLength(32 * 4 + 29 * 2 * 4);
    let k = 0;
    for (const b of out.schedule.bases) {
      const own = lines.slice(k, k + 4);
      for (const l of own) expect(Math.hypot(l.vertices[1].x - l.vertices[0].x, l.vertices[1].y - l.vertices[0].y), b.baseId).toBeCloseTo(b.side_m, 2);
      expect(own.reduce((s, l) => s + l.vertices[0].x, 0) / 4, b.baseId).toBeCloseTo(b.x, 2);
      k += 4;
      if (b.shared) {
        for (const l of lines.slice(k, k + 8)) expect(Math.hypot(l.vertices[1].x - l.vertices[0].x, l.vertices[1].y - l.vertices[0].y), b.baseId).toBeCloseTo(0.3, 2);
        k += 8;
      }
    }
    expect(onLayer(DXF_LAYERS_PA3.shoreLine.name)).toHaveLength(231);
    // one cable per lake-bed LINE: two of them end on each shared base
    const bedLines = onLayer(DXF_LAYERS_PA3.bedLine.name) as any[];
    expect(bedLines).toHaveLength(61);
    const sharedBase = out.schedule.bases.find((b) => b.shared)!;
    expect(bedLines.filter((l) => Math.hypot(l.vertices[1].x - sharedBase.x, l.vertices[1].y - sharedBase.y) < 0.01)).toHaveLength(2);
    expect(onLayer(DXF_LAYERS_PA3.shorePile.name).filter((e: any) => e.type === 'POINT')).toHaveLength(231);
    // 231 locating circles + 231 piles (a twin-pile point would add a circle)
    expect(onLayer(DXF_LAYERS_PA3.shorePile.name).filter((e: any) => e.type === 'CIRCLE')).toHaveLength(231 + 231);
  });

  it('states the assumptions and what is not designed, and carries no money', () => {
    const { out } = built();
    const text = decode(out.dxf);
    expect(text).toContain('GIẢ ĐỊNH, chưa có khảo sát đáy hồ');
    expect(text).toContain('CHƯA THIẾT KẾ: tai neo cáp');
    // the shared bases, how they are checked, and what is not designed for them
    expect(text).toContain('0. ĐẾ DÙNG CHUNG (29 / 32 đế)');
    expect(text).toContain('cả hai dây cùng căng');
    expect(text).toContain('Tai neo đôi CHƯA thiết kế');
    expect(text).toContain('Quy tắc của Chủ đầu tư (08/10/2026)');
    expect(text).toContain('Đế mẫu 2,5 × 2,5 × 0,4 m chỉ đạt với lực dây khoảng 70 kN');
    expect(text).toContain('Không có đế nào chồng lấn nhau trên mặt bằng');
    // the drawing says which wind it was calculated with, and that it is below the code wind
    expect(text).toContain('9. Gió tính toán: V = 20,0 m/s');
    expect(text).toContain('THẤP HƠN gió tiêu chuẩn TCVN 2737:2023');
    expect(/VND|đơn giá|chi phí/i.test(text)).toBe(false);
  });

  it('names the file mat-bang-he-neo-de-vit-xoan_<code>_<date>.dxf', () => {
    const { state } = setup();
    expect(dxfFileNamePA3(state, new Date(2026, 9, 8))).toBe(`mat-bang-he-neo-de-vit-xoan_${state.meta.code}_20261008.dxf`);
  });
});

describe('Option 3 schedule workbook', () => {
  it('has the three schedule sheets with the same rows as the drawing tables, then the two per-point sheets', () => {
    const { state, results, batch } = setup();
    const wb = buildScrewBaseScheduleWorkbook(state, results, batch);
    expect(wb.SheetNames).toEqual(['ThongKeCocBo', 'ThongKeDeNeoVit', 'DeTheoBe', 'TungDiemNeoDay', 'TungDiemNeoBo']);
    const shore = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ThongKeCocBo, { header: 1 });
    const bases = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ThongKeDeNeoVit, { header: 1 });
    const per = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.DeTheoBe, { header: 1 });
    expect(shore.filter((r) => /^HV-P\d{3}$/.test(String(r[0])))).toHaveLength(231);
    const rows = bases.filter((r) => /^HV-DV\d{3}$/.test(String(r[0])));
    expect(rows).toHaveLength(32);
    expect(rows.filter((r) => r[3] === 'DÙNG CHUNG')).toHaveLength(29);
    const s = buildScrewBaseSchedule(state, results, batch);
    expect(rows[0][1]).toBe(s.bases[0].code);
    expect(rows[0][9]).toBe(Number(s.bases[0].side_m.toFixed(2)));
    expect(rows.every((r) => r[22] === 'ĐẠT' && r[23] === '-')).toBe(true);
    expect(bases.find((r) => r[0] === 'Tổng số vít xoắn')![1]).toBe(128);
    expect(bases.find((r) => r[0] === 'Số tuyến cáp neo vào đế')![1]).toBe(61);
    expect(per.filter((r) => /^BÈ /.test(String(r[0])))).toHaveLength(9);
    expect(screwBaseScheduleExcelFileName(state, new Date(2026, 9, 8))).toBe(`bang-thong-ke-neo-de-vit-xoan_${state.meta.code}_20261008.xlsx`);
  });
});
