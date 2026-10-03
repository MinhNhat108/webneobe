import { describe, it, expect } from 'vitest';
import DxfParser from 'dxf-parser';
import * as XLSX from 'xlsx';
import { buildMooringDeadweightDxf, dxfFileNamePA2, DXF_LAYERS_PA2 } from '../deadweightDxf';
import { buildDeadweightSchedule, findBlockClashes } from '../deadweightSchedule';
import { buildDeadweightScheduleWorkbook, deadweightScheduleExcelFileName } from '../deadweightExcel';
import { buildMooringPileDxf, DXF_LAYERS } from '../dxfExport';
import { buildPileSchedule } from '../pileSchedule';
import { calculateProject } from '../../calc';
import { buildRaftProjectState, resolveRaftState } from '../../calc/raftState';
import type { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../../data/huoiVanhLayout';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;

/** The project and the 12-raft batch exactly as the store builds them. */
const setup = (option: 'PA1_PILE' | 'PA2_DEADWEIGHT') => {
  const start = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const state: ProjectState = { ...start, anchor: { ...start.anchor, bedAnchorOption: option } };
  const batch = HUOI_VANH_RAFTS.map((raft) => {
    const r = resolveRaftState(state, 1, raft, dflt().anchor);
    return { raft, state: r.state, results: calculateProject(r.state) };
  });
  return { state, results: calculateProject(state), batch };
};
const built = () => {
  const s = setup('PA2_DEADWEIGHT');
  return { ...s, out: buildMooringDeadweightDxf(s.state, s.results, s.batch) };
};
const parse = (dxf: string) => new DxfParser().parseSync(dxf)!;

describe('Option 2 schedule (129 shore piles + 175 gravity blocks)', () => {
  it('has one row per anchor point, at the layout coordinates', () => {
    const { state, results, batch } = setup('PA2_DEADWEIGHT');
    const s = buildDeadweightSchedule(state, results, batch);
    expect(s.shorePiles).toHaveLength(129);
    expect(s.blocks).toHaveLength(175);
    expect(s.blocks[0].blockId).toBe('HV-DW001');
    expect(s.blocks[174].blockId).toBe('HV-DW175');
    for (const b of s.blocks) {
      const c = MOORING_LINES_V2.find((l) => l.code === b.code)!;
      expect([b.x, b.y, b.z], b.blockId).toEqual([c.xAnchor, c.yAnchor, c.zAnchor]);
      expect(c.type, b.blockId).toBe('BED');
    }
  });

  it('takes every block from the engine result of its raft (results.bedBlock)', () => {
    const { state, results, batch } = setup('PA2_DEADWEIGHT');
    const s = buildDeadweightSchedule(state, results, batch);
    for (const b of s.blocks) {
      const eng = batch.find((x) => x.raft.name === b.raft)!.results;
      const blk = eng.bedBlock!;
      expect([b.L_m, b.W_m, b.H_m], b.blockId).toEqual([blk.L_m, blk.W_m, blk.H_m]);
      expect(b.mass_t, b.blockId).toBe(blk.mass_t);
      expect([b.sfSlide, b.sfUplift, b.sfOverturn, b.qContact_kPa], b.blockId).toEqual([blk.sfSlide, blk.sfUplift, blk.sfOverturn, blk.qContact_kPa]);
      expect(b.Tmax_kN, b.blockId).toBe(eng.t_max_intact_kN);
      expect(b.L_m, b.blockId).toBeGreaterThan(3.0);
      expect(b.ok, b.blockId).toBe(true);
    }
  });

  it('gives the same blocks when handed option 1 results (it recalculates, never invents)', () => {
    const a = setup('PA2_DEADWEIGHT'), b = setup('PA1_PILE');
    const fromPa2 = buildDeadweightSchedule(a.state, a.results, a.batch).blocks;
    const fromPa1 = buildDeadweightSchedule(b.state, b.results, b.batch).blocks;
    expect(fromPa1).toEqual(fromPa2);
  });

  it('shore piles are the same rows, with the same ids, as in the option 1 schedule', () => {
    const { state, results, batch } = setup('PA2_DEADWEIGHT');
    const pa1 = setup('PA1_PILE');
    const s = buildDeadweightSchedule(state, results, batch);
    expect(s.shorePiles).toEqual(buildPileSchedule(pa1.state, pa1.results, pa1.batch).filter((r) => r.type === 'SHORE'));
  });
});

describe('Option 2 DXF drawing', () => {
  it('is a well-formed R12 ASCII document that dxf-parser reads', () => {
    const { out } = built();
    expect(out.dxf.startsWith('0\nSECTION\n')).toBe(true);
    expect(out.dxf.trimEnd().endsWith('EOF')).toBe(true);
    expect(out.dxf).toContain('AC1009');
    expect(/[^\x0A\x20-\x7E]/.test(out.dxf)).toBe(false); // pure ASCII, no diacritics
    const body = out.dxf.split('\n').slice(0, -1);
    expect(body.length % 2).toBe(0);
    const doc = parse(out.dxf);
    expect(Object.keys(doc.tables.layer.layers)).toEqual(expect.arrayContaining(Object.values(DXF_LAYERS_PA2).map((l) => l.name)));
    expect(out.shorePileCount).toBe(129);
    expect(out.blockCount).toBe(175);
    expect(out.raftCount).toBe(12);
  });

  it('draws the 175 blocks at their true plan size on their own layer, centred on the layout point', () => {
    const { out } = built();
    const doc = parse(out.dxf);
    const onLayer = (name: string) => doc.entities.filter((e: any) => e.layer === name);
    const blk = onLayer(DXF_LAYERS_PA2.block.name);
    const pts = blk.filter((e: any) => e.type === 'POINT');
    const lines = blk.filter((e: any) => e.type === 'LINE');
    expect(pts).toHaveLength(175);
    expect(lines).toHaveLength(175 * 6); // 4 edges + 2 diagonals each
    out.schedule.blocks.forEach((b, i) => {
      const own = lines.slice(i * 6, i * 6 + 4) as any[];
      const xs = own.flatMap((l) => l.vertices.map((v: any) => v.x));
      const ys = own.flatMap((l) => l.vertices.map((v: any) => v.y));
      expect(Math.max(...xs) - Math.min(...xs), b.blockId).toBeCloseTo(b.L_m, 2);
      expect(Math.max(...ys) - Math.min(...ys), b.blockId).toBeCloseTo(b.W_m, 2);
      expect((Math.max(...xs) + Math.min(...xs)) / 2, b.blockId).toBeCloseTo(b.x, 2);
      expect((Math.max(...ys) + Math.min(...ys)) / 2, b.blockId).toBeCloseTo(b.y, 2);
      expect(Math.max(...xs) - Math.min(...xs), b.blockId).toBeGreaterThan(3.0);
    });
    expect(onLayer(DXF_LAYERS_PA2.shorePile.name).filter((e: any) => e.type === 'POINT')).toHaveLength(129);
    expect(onLayer(DXF_LAYERS_PA2.shoreLine.name)).toHaveLength(129);
    expect(onLayer(DXF_LAYERS_PA2.bedLine.name)).toHaveLength(175);
    // no lake-bed PILE layer in the option 2 sheet
    expect(doc.entities.some((e: any) => e.layer === DXF_LAYERS.bedPile.name)).toBe(false);
  });

  it('carries both schedules and the block dimension sketch, and nothing that was not designed', () => {
    const { out } = built();
    const doc = parse(out.dxf);
    const texts = (layer: string) => doc.entities.filter((e: any) => e.layer === layer && e.type === 'TEXT').map((e: any) => e.text as string);
    const shore = texts(DXF_LAYERS_PA2.shoreTable.name), blocks = texts(DXF_LAYERS_PA2.blockTable.name), detail = texts(DXF_LAYERS_PA2.detail.name);
    expect(shore.some((t) => t.includes('BANG THONG KE COC NEO BO BTCT (129 COC)'))).toBe(true);
    expect(blocks.some((t) => t.includes('BANG THONG KE KHOI BE TONG NEO DAY HO (175 KHOI)'))).toBe(true);
    for (const col of ['MA KHOI', 'L (m)', 'W (m)', 'H (m)', 'V (m3)', 'W_kk (T)', 'T_max (kN)', 'SF_truot', 'SF_nho', 'SF_lat', 'q_day (kPa)', 'KET LUAN']) {
      expect(blocks, col).toContain(col);
    }
    expect(blocks).toContain('HV-DW001');
    expect(blocks).toContain('HV-DW175');
    expect(blocks.filter((t) => t === 'DAT')).toHaveLength(175);
    expect(shore.filter((t) => /^HV-P\d{3}$/.test(t))).toHaveLength(129);
    expect(detail.some((t) => t.includes('CHI TIET B'))).toBe(true);
    expect(detail.some((t) => t.includes('KHONG THEO TY LE'))).toBe(true);
    expect(detail.some((t) => t.includes('CHUA THIET KE'))).toBe(true);
    // Reinforcement, lifting lugs and shear keys were never calculated: they must not appear as if they were.
    expect(/a150|a100|CB400|D50|go chong truot/i.test(out.dxf)).toBe(false);
    // No money anywhere.
    expect(/VND|don gia|chi phi/i.test(out.dxf)).toBe(false);
  });

  it('labels each block with its id, survey code, size and mass', () => {
    const { out } = built();
    const b = out.schedule.blocks[0];
    expect(out.dxf).toContain(`${b.blockId} (${b.code}) [${b.L_m.toFixed(2)}x${b.W_m.toFixed(2)}x${b.H_m.toFixed(2)}m, ${b.mass_t.toFixed(0)}T]`);
  });

  it('leaves the option 1 drawing exactly as it is', () => {
    const pa1 = setup('PA1_PILE');
    const d = buildMooringPileDxf(pa1.state, pa1.results, pa1.batch);
    expect(d.pileCount).toBe(304);
    expect(d.dxf).not.toContain('KHOI');
    expect(d.dxf).toContain(DXF_LAYERS.bedPile.name);
  });

  it('names the file mat-bang-he-neo-PA2-khoi-be-tong_<code>_<date>.dxf', () => {
    const { state } = setup('PA2_DEADWEIGHT');
    expect(dxfFileNamePA2(state, new Date(2026, 9, 3))).toBe(`mat-bang-he-neo-PA2-khoi-be-tong_${state.meta.code}_20261003.dxf`);
  });
});

describe('Option 2 schedule workbook', () => {
  it('has the two sheets with the same rows as the drawing tables', () => {
    const { state, results, batch } = setup('PA2_DEADWEIGHT');
    const wb = buildDeadweightScheduleWorkbook(state, results, batch);
    expect(wb.SheetNames).toEqual(['ThongKeCocBo', 'ThongKeKhoiBeTong']);
    const shore = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ThongKeCocBo, { header: 1 });
    const blocks = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ThongKeKhoiBeTong, { header: 1 });
    expect(shore.filter((r) => /^HV-P\d{3}$/.test(String(r[0])))).toHaveLength(129);
    const rows = blocks.filter((r) => /^HV-DW\d{3}$/.test(String(r[0])));
    expect(rows).toHaveLength(175);
    const s = buildDeadweightSchedule(state, results, batch);
    expect(rows[0][6]).toBe(Number(s.blocks[0].L_m.toFixed(2)));
    expect(rows[0][10]).toBe(Number(s.blocks[0].mass_t.toFixed(1)));
    expect(rows.every((r) => r[18] === 'ĐẠT')).toBe(true);
    expect(deadweightScheduleExcelFileName(state, new Date(2026, 9, 3))).toBe(`bang-thong-ke-neo-PA2_${state.meta.code}_20261003.xlsx`);
  });
});

describe('Blocks that do not fit at the pile layout points', () => {
  it('flags two bases whose centres are closer than the sum of their half-sides, whatever their orientation', () => {
    const fit = findBlockClashes([{ id: 'a', x: 0, y: 0, L_m: 4 }, { id: 'b', x: 4.01, y: 0, L_m: 4 }]);
    expect(fit).toEqual([]);
    const hit = findBlockClashes([{ id: 'a', x: 0, y: 0, L_m: 4 }, { id: 'b', x: 2, y: 2, L_m: 3 }]);
    expect(hit).toHaveLength(1);
    expect(hit[0].distance_m).toBeCloseTo(Math.SQRT2 * 2, 9);
    expect(hit[0].required_m).toBe(3.5);
  });

  it('reports the overlaps of the Huổi Vanh layout instead of hiding them: 34 pairs, 63 blocks', () => {
    const { state, results, batch } = setup('PA2_DEADWEIGHT');
    const s = buildDeadweightSchedule(state, results, batch);
    expect(s.clashes).toHaveLength(34);
    expect(s.blocks.filter((b) => b.clashWith.length > 0)).toHaveLength(63);
    for (const c of s.clashes) {
      const a = s.blocks.find((b) => b.blockId === c.a)!, b = s.blocks.find((x) => x.blockId === c.b)!;
      expect(c.distance_m).toBeCloseTo(Math.hypot(a.x - b.x, a.y - b.y), 9);
      expect(c.distance_m).toBeLessThan((a.L_m + b.L_m) / 2);
      expect(a.clashWith).toContain(c.b);
      expect(b.clashWith).toContain(c.a);
    }
  });

  it('says so on the drawing and in the workbook', () => {
    const { out, state, results, batch } = built();
    expect(out.dxf).toContain('CANH BAO: 34 cap khoi CHONG LAN nhau tren mat bang');
    expect(out.dxf).toContain('CHONG LAN VOI');
    const wb = buildDeadweightScheduleWorkbook(state, results, batch);
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.ThongKeKhoiBeTong, { header: 1 });
    expect(rows.filter((r) => /^HV-DW\d{3}$/.test(String(r[0])) && r[19] !== '-')).toHaveLength(63);
    expect(rows.find((r) => String(r[0]).startsWith('Số cặp khối CHỒNG LẤN'))![1]).toBe(34);
  });
});
