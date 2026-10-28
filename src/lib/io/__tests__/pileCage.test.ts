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
      if (r.type === 'SHORE') {
        // round bored pile D350, cast in place: n bars on a circle, a spiral, no lifting hooks
        expect(r.cage.shape, r.pileId).toBe('circular');
        expect(r.cage.totalBars, r.pileId).toBe(a.shoreRebarCount);
        expect([4, 6, 8], r.pileId).toContain(r.cage.totalBars);
        expect(r.cage.concreteVol_m3, r.pileId).toBeCloseTo((Math.PI * 0.35 * 0.35 / 4) * r.Ltotal_m, 9);
        expect(r.cage.stirrupLabel, r.pileId).toBe('Đai xoắn Φ8 a150');
        expect(r.cage.hookSteel_kg, r.pileId).toBe(0);
        expect(r.cage.handlingMoment_kNm, r.pileId).toBe(0);
        expect(r.cage.segmentNote, r.pileId).toContain('Đổ tại chỗ');
      } else {
        // square precast pile 350 x 350: the owner's 4 corner bars, nothing more
        expect(r.cage.shape, r.pileId).toBe('square');
        expect(r.rebarFaceCount, r.pileId).toBe(2);
        expect(r.cage.totalBars, r.pileId).toBe(4);
        expect(r.cage.concreteVol_m3, r.pileId).toBeCloseTo(0.35 * 0.35 * r.Ltotal_m, 9);
        expect(r.cage.steelRatio, r.pileId).toBeLessThan(0.03);
      }
      // shore cable shackled 0.1 m above the ground; lake-bed pile 1.0 m above the bed
      expect(r.Ltotal_m, r.pileId).toBeCloseTo(r.Linput_m + (r.type === 'SHORE' ? 0.1 : 1.0), 9);
      expect(r.cage.segments_m, r.pileId).toEqual([r.Ltotal_m]);
      // at the 20 m/s default (tilt 10°, 18.914 panels) the piles of BÈ 2 and the shore piles of BÈ 4 use CB500-V:
      // 6Φ28 is the largest cage within 4 % of D350; BÈ 1 (single 6Φ28, twin 6Φ25), BÈ 3 (6Φ25) and the lake-bed piles
      // of BÈ 4 stay CB400-V
      expect(r.cage.grade, r.pileId).toBe(r.raft === 'BÈ 2' || (r.raft === 'BÈ 4' && r.type === 'SHORE') ? 'CB500-V' : 'CB400-V');
    }
    expect(rows.find((r) => r.raft === 'BÈ 3' && r.type === 'BED')!.cage.label).toBe('4Φ22');
    expect(rows.find((r) => r.raft === 'BÈ 3' && r.type === 'SHORE')!.cage.label).toBe('6Φ25');
    expect(rows.find((r) => r.raft === 'BÈ 3' && r.type === 'SHORE')!.pileCount).toBe(1);
    expect(rows.find((r) => r.raft === 'BÈ 4' && r.type === 'SHORE')!.cage.label).toBe('6Φ28');
    expect(rows.find((r) => r.raft === 'BÈ 1' && r.type === 'SHORE')!.cage.label).toBe('6Φ28');
    expect(rows.find((r) => r.raft === 'BÈ 1' && r.type === 'SHORE')!.pileCount).toBe(1);
    // twin piles only where the line's own tension needs them: B1-D15, B1-D16 (6Φ25) and B2-D29 (6Φ28), within 4 % of
    // D350; every other shore point of BÈ 1, 2 and 4 takes the lighter single pile 6Φ28 (catalogue shorePileLight)
    const twin = rows.filter((r) => r.type === 'SHORE' && r.pileCount > 1);
    expect(twin.map((r) => [r.code, r.cage.label, r.light])).toEqual([['B1-D15', '6Φ25', false], ['B1-D16', '6Φ25', false], ['B2-D29', '6Φ28', false]]);
    expect(rows.filter((r) => r.light).every((r) => r.pileCount === 1 && r.cage.label === '6Φ28')).toBe(true);
    expect(rows.filter((r) => r.light)).toHaveLength(44 + 46 + 55);
  });

  it('bill of materials at the 20 m/s default (shore piles + PA1 lake-bed piles): 256 piles (178 bored + 78 driven) at 222 points, 1 933.8 m, 206 m3, about 52 t of steel, and the steel adds up', () => {
    const { state, results, batch } = setup();
    const rows = buildPileSchedule(state, results, batch);
    const m = summarisePileMaterials(rows);
    expect([m.anchorPoints, m.piles, m.shorePiles, m.bedPiles]).toEqual([222, 256, 178, 78]);
    expect(m.totalLength_m).toBeCloseTo(1933.8, 6);
    expect(m.concrete_m3).toBeCloseTo(206.01, 1);
    const main = Object.values(m.mainSteelByDia_kg).reduce((s, v) => s + v, 0);
    expect(m.steel_kg).toBeCloseTo(main + m.stirrupSteel_kg + m.hookSteel_kg, 6);
    expect(m.steel_kg).toBeCloseTo(rows.reduce((s, r) => s + r.pileCount * r.cage.steel_kg, 0), 6);
    expect(Object.keys(m.mainSteelByDia_kg).map(Number).sort((a, b) => a - b)).toEqual([22, 25, 28, 32]);
    expect(m.steel_kg / 1000).toBeGreaterThan(51.3);
    expect(m.steel_kg / 1000).toBeLessThan(52.0);
    // lifting hooks only on the 78 precast lake-bed piles
    expect(m.hookSteel_kg).toBeCloseTo(78 * 3.8, 6);
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
    expect(String(first[col('THÉP CHỦ')])).toMatch(/^[468]Φ\d+$/);
    expect(first[col('TIẾT DIỆN')]).toBe(rows[0].type === 'SHORE' ? 'Tròn D350 — khoan nhồi tại chỗ' : 'Vuông 350×350 — đúc sẵn');
    expect(data.some((r) => r[col('TIẾT DIỆN')] === 'Tròn D350 — khoan nhồi tại chỗ')).toBe(true);
    expect(data.some((r) => r[col('TIẾT DIỆN')] === 'Vuông 350×350 — đúc sẵn')).toBe(true);
    expect(first[col('CỐT ĐAI')]).toBe(rows[0].cage.stirrupLabel);
    expect(first[col('L_tổng (m)')]).toBe(rows[0].Ltotal_m);
    expect(first[col('PHÂN ĐOẠN CỌC')]).toBe(rows[0].cage.segmentNote);
    expect(first[col('KL THÉP 1 CỌC (kg)')]).toBe(Number(rows[0].cage.steel_kg.toFixed(1)));
    const find = (label: string) => data.find((r) => r[0] === label);
    expect(find('BẢNG TỔNG HỢP VẬT TƯ CỌC TOÀN HỒ')).toBeDefined();
    expect(find('Tổng số cọc')![1]).toBe(256);
    expect(find('Tổng chiều dài cọc (L_tk + đoạn nhô)')![1]).toBe(1933.8);
    expect(find('Tổng bê tông B25')![1]).toBe(206);
    for (const d of [22, 25, 28]) expect(find(`Thép chủ Φ${d}`)![1]).toBeGreaterThan(0);
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
    expect(table).toContain('4D22 CB400-V'); // a square lake-bed pile (BÈ 3)
    expect(table).toContain('6D28 CB500-V'); // BÈ 2 round shore pile
    expect(table).toContain('D350 KHOAN NHOI');
    expect(table).toContain('350x350 DUC SAN');
    expect(table.filter((x) => x === '1 DOAN')).toHaveLength(47);
    expect(table.filter((x) => x === 'DO TAI CHO')).toHaveLength(175);
    const detail = texts(DXF_LAYERS.detail.name);
    expect(detail.filter((x) => x.includes('COC KHOAN NHOI TRON D350'))).toHaveLength(1); // every shore pile has 6 bars
    expect(detail.filter((x) => x.includes('COC VUONG 350x350 - 4 THANH'))).toHaveLength(1);
    expect(detail.some((x) => x.includes('BAT LOI NHAT'))).toBe(true);
    expect(detail.some((x) => x.includes('CUM 2 COC'))).toBe(true); // B1-D15, B1-D16, B2-D29 have twin piles at the 20 m/s default
    expect(detail.some((x) => x.includes('NGUYEN MOT DOAN'))).toBe(true);
    // the condition the 4-bar design depends on is written on the sheet
    expect(detail.some((x) => x.includes('YEU CAU THI CONG: cap coc bo moc sat co coc, cach mat dat <= 0.1 m'))).toBe(true);
    expect(detail.some((x) => x.includes('256 coc tai 222 diem neo'))).toBe(true);
    // round sections: concrete + spiral circles and 4 + 6 bars; the square section: 4 bars
    const circles = doc.entities.filter((e: any) => e.layer === DXF_LAYERS.detail.name && e.type === 'CIRCLE');
    // + the shore pile head detail: pin hole, shackle, pile outline on plan, 4 anchor bars
    // + the twin-pile cluster: 2 pile circles
    expect(circles).toHaveLength(2 * 1 + 6 + 4 + 7 + 2); // one round section (every shore pile has 6 bars)
    // without the option the details are left out
    const plain = buildMooringPileDxf(state, results, batch, { includeDetails: false });
    expect(plain.dxf).not.toContain('CHI TIET CAU TAO COC');
  });
});
