import * as XLSX from 'xlsx';
import type { CalcResults, ProjectState } from '../calc/types';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import type { PileScheduleBatchLike } from './pileSchedule';
import { buildDeadweightSchedule } from './deadweightSchedule';
import { pileSectionLabel } from './excelExport';

const num = (v: number, d: number): number | string => (Number.isFinite(v) ? Number(v.toFixed(d)) : '∞');

/**
 * Option 2 schedule workbook — the same rows as the two tables of the option 2
 * CAD sheet: `ThongKeCocBo` (129 shore piles) and `ThongKeKhoiBeTong`
 * (175 lake-bed gravity blocks). Pure builder, no DOM.
 */
export function buildDeadweightScheduleWorkbook(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): XLSX.WorkBook {
  const s = buildDeadweightSchedule(state, results, batchResults, coordinates);
  const code = state.meta.code || state.code || 'HV-FPV-2026';
  const name = state.meta.name || state.name || '';
  const wb = XLSX.utils.book_new();

  const shore: any[][] = [
    [`BẢNG THỐNG KÊ CỌC NEO BỜ BTCT (${s.shorePiles.length} CỌC) — PHƯƠNG ÁN 2 — ${code}`],
    [`Dự án: ${name}`],
    ['Cọc vuông BTCT, a = cạnh tiết diện | L_opt: chiều sâu ngàm tối thiểu theo Broms | L_tk: chiều sâu đóng cọc thiết kế | P_max: sức chịu tải cho phép tại L_tk. Mã cọc giữ nguyên theo bảng Phương án 1.'],
    [''],
    ['MÃ CỌC', 'KÝ HIỆU KS', 'CỤM BÈ', 'X (m)', 'Y (m)', 'Z (m)', 'SỐ CỌC', 'D / a (m)', 'L_opt (m)', 'L_tk (m)', 'T_max (kN)', 'P_max (kN)', 'KẾT LUẬN', 'L_tổng (m)', 'PHÂN ĐOẠN CỌC', 'THÉP CHỦ', 'MÁC THÉP', 'CỐT ĐAI', 'V BÊ TÔNG 1 CỌC (m³)', 'KL THÉP 1 CỌC (kg)', 'TIẾT DIỆN']
  ];
  for (const r of s.shorePiles) {
    shore.push([
      r.pileId, r.code, r.raft, num(r.x, 2), num(r.y, 2), num(r.z, 2), r.pileCount, num(r.D_m, 2),
      r.Lopt_m !== null ? num(r.Lopt_m, 2) : 'KHÔNG ĐẠT', num(r.Linput_m, 2), num(r.Tmax_kN, 1), num(r.Pmax_kN, 1),
      r.isPmaxOk ? 'ĐẠT' : 'KIỂM TRA',
      num(r.Ltotal_m, 2), r.cage.segmentNote, r.cage.label, r.cage.totalBars > 0 ? r.cage.grade : '-', r.cage.stirrupLabel,
      num(r.cage.concreteVol_m3, 3), num(r.cage.steel_kg, 1), pileSectionLabel(r)
    ]);
  }
  const wsShore = XLSX.utils.aoa_to_sheet(shore);
  wsShore['!cols'] = [12, 14, 10, 12, 12, 10, 8, 12, 11, 10, 12, 12, 12, 11, 22, 12, 11, 14, 20, 18].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsShore, 'ThongKeCocBo');

  const p = s.blocks[0];
  const prm = [...s.blockByRaft.values()][0]?.params;
  const blocks: any[][] = [
    [`BẢNG THỐNG KÊ KHỐI BÊ TÔNG NEO ĐÁY HỒ (${s.blocks.length} KHỐI) — PHƯƠNG ÁN 2 — ${code}`],
    [`Dự án: ${name}`],
    [
      prm
        ? `Thông số tính toán: μ = ${prm.mu}; SF trượt ≥ ${prm.sfSlide}; SF nhấc bổng ≥ ${prm.sfUplift}; SF lật ≥ ${prm.sfOverturn}; q_allow = ${prm.qAllow_kPa} kPa; ρ_c = ${prm.rhoConcrete_tm3} t/m³. ` +
          'μ và q_allow là giả định, chưa có khảo sát địa chất đáy hồ; chưa tính lún.'
        : ''
    ],
    [''],
    ['MÃ KHỐI', 'KÝ HIỆU KS', 'CỤM BÈ', 'X (m)', 'Y (m)', 'Z (m)', 'L (m)', 'W (m)', 'H (m)', 'V (m³)', 'W_kk (T)', 'W_nước (kN)',
      'T_max (kN)', 'Góc cáp (°)', 'SF trượt', 'SF nhấc', 'SF lật', 'q_đáy (kPa)', 'KẾT LUẬN', 'CHỒNG LẤN VỚI']
  ];
  for (const b of s.blocks) {
    blocks.push([
      b.blockId, b.code, b.raft, num(b.x, 2), num(b.y, 2), num(b.z, 2), num(b.L_m, 2), num(b.W_m, 2), num(b.H_m, 2),
      num(b.volume_m3, 1), num(b.mass_t, 1), num(b.weightSub_kN, 0), num(b.Tmax_kN, 1), num(b.cableAngle_deg, 1),
      num(b.sfSlide, 2), num(b.sfUplift, 2), num(b.sfOverturn, 2), num(b.qContact_kPa, 1), b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT',
      b.clashWith.length ? b.clashWith.join(', ') : '-'
    ]);
  }
  blocks.push(['']);
  blocks.push(['TỔNG HỢP']);
  blocks.push(['Số khối bê tông neo đáy', s.blocks.length, 'khối']);
  blocks.push(['Tổng thể tích bê tông', num(s.blocks.reduce((a, b) => a + b.volume_m3, 0), 1), 'm³']);
  blocks.push(['Tổng trọng lượng (trong không khí)', num(s.blocks.reduce((a, b) => a + b.mass_t, 0), 1), 'tấn']);
  blocks.push(['Số khối ĐẠT cả 4 điều kiện (DW-1…DW-4)', s.blocks.filter((b) => b.ok).length, 'khối']);
  if (p) blocks.push(['Áp lực nền cho phép', p.qAllow_kPa, 'kPa (giả định)']);
  blocks.push([
    'Số cặp khối CHỒNG LẤN nhau trên mặt bằng', s.clashes.length, 'cặp',
    s.clashes.length > 0
      ? 'Khoảng cách tâm nhỏ hơn tổng nửa cạnh hai khối. Điểm neo hiện tại được bố trí cho cọc; phải bố trí lại điểm neo đáy trước khi dùng Phương án 2.'
      : ''
  ]);
  const wsBlocks = XLSX.utils.aoa_to_sheet(blocks);
  wsBlocks['!cols'] = [12, 14, 10, 12, 12, 10, 8, 8, 8, 9, 10, 12, 12, 11, 10, 10, 10, 12, 12, 26].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsBlocks, 'ThongKeKhoiBeTong');

  return wb;
}

/** `bang-thong-ke-neo-PA2_<code>_<YYYYMMDD>.xlsx` */
export function deadweightScheduleExcelFileName(state: ProjectState, now: Date = new Date()): string {
  const code = (state.meta.code || state.code || 'HV-FPV-2026')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'HV-FPV-2026';
  const stamp =
    `${now.getFullYear()}` + `${String(now.getMonth() + 1).padStart(2, '0')}` + `${String(now.getDate()).padStart(2, '0')}`;
  return `bang-thong-ke-neo-PA2_${code}_${stamp}.xlsx`;
}

export function exportDeadweightScheduleToExcel(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): { filename: string } {
  const wb = buildDeadweightScheduleWorkbook(state, results, batchResults, coordinates);
  const filename = deadweightScheduleExcelFileName(state);
  XLSX.writeFile(wb, filename);
  return { filename };
}
