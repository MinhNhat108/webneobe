import { describe, it, expect } from 'vitest';
import DxfParser from 'dxf-parser';
import * as XLSX from 'xlsx';
import { buildPileCage, barUnitWeight_kg_m, rebarGradeOf } from '../../calc/pileCage';
import { buildPileSchedule, summarisePileMaterials } from '../pileSchedule';
import { buildPileScheduleWorkbook } from '../excelExport';
import { buildMooringPileDxf, DXF_LAYERS } from '../dxfExport';
import { cageBarPositions } from '../pileCageDetailDxf';
import { calculateProject } from '../../calc';
import { buildRaftProjectState } from '../../calc/raftState';
import type { ProjectState } from '../../calc/types';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from '../../../data/huoiVanhProject';

const dflt = () => JSON.parse(JSON.stringify(HUOI_VANH_DEFAULT_PROJECT)) as ProjectState;
const setup = () => {
  const state = buildRaftProjectState(dflt(), HUOI_VANH_RAFTS[0], dflt().anchor);
  const batch = HUOI_VANH_RAFTS.map((raft) => {
    const st = buildRaftProjectState(state, raft, dflt().anchor);
    return { raft, state: st, results: calculateProject(st) };
  });
  return { state, results: calculateProject(state), batch };
};
const cage = (faceCount: number, dia_mm: number, totalLength_m = 7) =>
  buildPileCage({ side_m: 0.35, faceCount, dia_mm, rs_MPa: 350, cover_mm: 50, totalLength_m });

describe('Cage built from the bars the bending check uses', () => {
  it('k bars on every face, corner bars shared: 2 -> 4, 3 -> 8, 4 -> 12 (never 8 for a face calculated with 4)', () => {
    expect(cage(2, 28).label).toBe('4Φ28');
    expect(cage(3, 25).label).toBe('8Φ25');
    expect(cage(4, 25).label).toBe('12Φ25');
    expect(cage(0, 0).totalBars).toBe(0);
    for (const k of [2, 3, 4, 5]) {
      const pts = cageBarPositions(0.35, k, 0.05);
      expect(pts).toHaveLength(4 * (k - 1));
      // every face really carries k bars
      expect(pts.filter((p) => Math.abs(p.y - 0.05) < 1e-9)).toHaveLength(k);
      expect(pts.filter((p) => Math.abs(p.x - 0.30) < 1e-9)).toHaveLength(k);
    }
  });

  it('quantities of one pile', () => {
    const c = cage(3, 25, 7);
    expect(c.concreteVol_m3).toBeCloseTo(0.35 * 0.35 * 7, 9);
    expect(barUnitWeight_kg_m(25)).toBeCloseTo(3.853, 3);
    expect(c.mainSteel_kg).toBeCloseTo(8 * 7 * barUnitWeight_kg_m(25), 9);
    expect(c.steel_kg).toBeCloseTo(c.mainSteel_kg + c.stirrupSteel_kg + c.hookSteel_kg, 9);
    expect(c.steelRatio).toBeCloseTo((8 * Math.PI * 625 / 4) / 122500, 9);
    expect(c.stirrupLabel).toBe('Φ8 a100/a200');
    // 1.5 m at 100 mm at each end (16 hoops each) + 4 m at 200 mm in between (19 more)
    expect(c.stirrupCount).toBe(2 * 16 + 19);
    expect(rebarGradeOf(350)).toBe('CB400-V');
    expect(rebarGradeOf(435)).toBe('CB500-V');
    expect(rebarGradeOf(260)).toBe('CB300-V');
  });

  it('casts a pile of up to 12 m in one piece and flags a longer one as an undesigned splice', () => {
    expect(cage(3, 25, 11.5).segments_m).toEqual([11.5]);
    expect(cage(3, 25, 11.5).segmentNote).toBe('1 đoạn (L = 11.5 m)');
    const long = cage(3, 25, 17);
    expect(long.segments_m).toEqual([8.5, 8.5]);
    expect(long.segmentNote).toContain('CHƯA thiết kế');
    // lifting at 0.207 L: M = 1.5 x 0.0214 x q x L^2, q = 0.35^2 x 25
    expect(cage(3, 25, 11.5).handlingMoment_kNm).toBeCloseTo(1.5 * 0.0214 * 3.0625 * 11.5 * 11.5, 6);
  });
});

describe('Pile schedule with reinforcement — Huổi Vanh', () => {
  it('every pile carries the cage of its raft, and no pile is spliced', () => {
    const { state, results, batch } = setup();
    const rows = buildPileSchedule(state, results, batch);
    for (const r of rows) {
      const a = batch.find((b) => b.raft.name === r.raft)!.state.anchor;
      const k = r.type === 'SHORE' ? a.shoreRebarFaceCount! : a.bedRebarFaceCount!;
      expect(r.rebarFaceCount, r.pileId).toBe(k);
      expect(r.cage.totalBars, r.pileId).toBe(4 * (k - 1));
      // Owner's instruction: 4 corner bars in every pile, nothing more.
      expect(r.cage.totalBars, r.pileId).toBe(4);
      expect(r.rebarFaceCount, r.pileId).toBe(2);
      // shore cable shackled 0.1 m above the ground; lake-bed pile 1.0 m above the bed
      expect(r.Ltotal_m, r.pileId).toBeCloseTo(r.Linput_m + (r.type === 'SHORE' ? 0.1 : 1.0), 9);
      expect(r.cage.segments_m, r.pileId).toEqual([r.Ltotal_m]);
      expect(r.cage.grade, r.pileId).toBe(r.raft === 'BÈ 9' ? 'CB500-V' : 'CB400-V');
      expect(r.cage.steelRatio, r.pileId).toBeLessThan(0.03);
    }
    expect(rows.find((r) => r.raft === 'BÈ 2' && r.type === 'BED')!.cage.label).toBe('4Φ20');
    expect(rows.find((r) => r.raft === 'BÈ 1' && r.type === 'SHORE')!.cage.label).toBe('4Φ25');
    expect(rows.find((r) => r.raft === 'BÈ 9' && r.type === 'SHORE')!.cage.label).toBe('4Φ32');
  });

  it('bill of materials: 343 piles, 3 057.1 m, 374.5 m3, about 77 t of steel, and the steel adds up', () => {
    const { state, results, batch } = setup();
    const rows = buildPileSchedule(state, results, batch);
    const m = summarisePileMaterials(rows);
    expect([m.anchorPoints, m.piles, m.shorePiles, m.bedPiles]).toEqual([304, 343, 141, 202]);
    expect(m.totalLength_m).toBeCloseTo(3057.1, 6);
    expect(m.concrete_m3).toBeCloseTo(374.5, 1);
    const main = Object.values(m.mainSteelByDia_kg).reduce((s, v) => s + v, 0);
    expect(m.steel_kg).toBeCloseTo(main + m.stirrupSteel_kg + m.hookSteel_kg, 6);
    expect(m.steel_kg).toBeCloseTo(rows.reduce((s, r) => s + r.pileCount * r.cage.steel_kg, 0), 6);
    expect(Object.keys(m.mainSteelByDia_kg).map(Number).sort((a, b) => a - b)).toEqual([20, 22, 25, 28, 32]);
    expect(m.steel_kg / 1000).toBeGreaterThan(74);
    expect(m.steel_kg / 1000).toBeLessThan(80);
  });

  it('the workbook lists the cage of every pile and the materials table', () => {
    const { state, results, batch } = setup();
    const wb = buildPileScheduleWorkbook(state, results, batch);
    const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets.BangThongKeCoc, { header: 1 });
    const head = data[4];
    const col = (name: string) => head.indexOf(name);
    const rows = buildPileSchedule(state, results, batch);
    const first = data[5];
    expect(first[col('THÉP CHỦ')]).toBe(rows[0].cage.label);
    expect(first[col('MÁC THÉP')]).toBe(rows[0].cage.grade);
    expect(String(first[col('THÉP CHỦ')])).toMatch(/^4Φ\d+$/);
    expect(first[col('CỐT ĐAI')]).toBe('Φ8 a100/a200');
    expect(first[col('L_tổng (m)')]).toBe(rows[0].Ltotal_m);
    expect(first[col('PHÂN ĐOẠN CỌC')]).toBe(rows[0].cage.segmentNote);
    expect(first[col('KL THÉP 1 CỌC (kg)')]).toBe(Number(rows[0].cage.steel_kg.toFixed(1)));
    const find = (label: string) => data.find((r) => r[0] === label);
    expect(find('BẢNG TỔNG HỢP VẬT TƯ CỌC TOÀN HỒ')).toBeDefined();
    expect(find('Tổng số cọc')![1]).toBe(343);
    expect(find('Tổng chiều dài cọc (L_tk + đoạn nhô)')![1]).toBe(3057.1);
    expect(find('Tổng bê tông B25')![1]).toBe(374.5);
    for (const d of [20, 22, 25, 28, 32]) expect(find(`Thép chủ Φ${d}`)![1]).toBeGreaterThan(0);
    expect(find('TỔNG THÉP')![1]).toBe(Number((summarisePileMaterials(rows).steel_kg / 1000).toFixed(2)));
  });

  it('the drawing carries the cage columns and the pile details on their own layer', () => {
    const { state, results, batch } = setup();
    const out = buildMooringPileDxf(state, results, batch);
    expect(/[^\x0A\x20-\x7E]/.test(out.dxf)).toBe(false);
    const doc = new DxfParser().parseSync(out.dxf)!;
    const texts = (layer: string) => doc.entities.filter((e: any) => e.layer === layer && e.type === 'TEXT').map((e: any) => e.text as string);
    const table = texts(DXF_LAYERS.schedule.name);
    for (const c of ['THEP CHU', 'THEP DAI', 'DOAN COC', 'L_tong (m)']) expect(table, c).toContain(c);
    expect(table).toContain('4D25 CB400-V');
    expect(table).toContain('4D32 CB500-V'); // BÈ 9
    expect(table.some((x) => /^(8|12)D\d+/.test(x))).toBe(false);
    expect(table.filter((x) => x === '1 DOAN')).toHaveLength(304);
    const detail = texts(DXF_LAYERS.detail.name);
    expect(detail.some((x) => x.includes('COC 4 THANH'))).toBe(true);
    expect(detail.some((x) => x.includes('COC 8 THANH') || x.includes('COC 12 THANH'))).toBe(false);
    expect(detail.some((x) => x.includes('CUM 2 COC'))).toBe(true);
    expect(detail.some((x) => x.includes('CHUA THIET KE'))).toBe(true); // the twin-pile yoke
    expect(detail.some((x) => x.includes('NGUYEN MOT DOAN'))).toBe(true);
    // the condition the 4-bar design depends on is written on the sheet
    expect(detail.some((x) => x.includes('YEU CAU THI CONG: cap coc bo moc sat co coc, cach mat dat <= 0.1 m'))).toBe(true);
    expect(detail.some((x) => x.includes('343 coc tai 304 diem neo'))).toBe(true);
    // one cross-section, four corner bars
    const circles = doc.entities.filter((e: any) => e.layer === DXF_LAYERS.detail.name && e.type === 'CIRCLE');
    expect(circles).toHaveLength(4);
    // without the option the details are left out
    const plain = buildMooringPileDxf(state, results, batch, { includeDetails: false });
    expect(plain.dxf).not.toContain('CHI TIET CAU TAO COC');
  });
});
