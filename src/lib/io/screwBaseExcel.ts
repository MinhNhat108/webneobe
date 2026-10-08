import * as XLSX from 'xlsx';
import type { CalcResults, ProjectState } from '../calc/types';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import type { PileScheduleBatchLike } from './pileSchedule';
import { buildScrewBaseSchedule } from './screwBaseSchedule';
import { pileSectionLabel } from './excelExport';
import { buildAnchorPointSchedule, appendAnchorPointSheets } from './anchorPointSchedule';

const num = (v: number, d: number): number | string => (Number.isFinite(v) ? Number(v.toFixed(d)) : '∞');

/**
 * Option 3 schedule workbook — the same rows as the tables of the option 3
 * CAD sheet: `ThongKeCocBo` (shore piles), `ThongKeDeNeoVit` (lake-bed bases)
 * `DeTheoBe` (the base designed for each raft), and the anchor-by-anchor
 * sheets `TungDiemNeoDay` / `TungDiemNeoBo`. Pure builder, no DOM.
 */
export function buildScrewBaseScheduleWorkbook(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): XLSX.WorkBook {
  const s = buildScrewBaseSchedule(state, results, batchResults, coordinates);
  const code = state.meta.code || state.code || 'HV-FPV-2026';
  const name = state.meta.name || state.name || '';
  const wb = XLSX.utils.book_new();
  const piles = s.shorePiles.reduce((a, r) => a + r.pileCount, 0);

  const shore: any[][] = [
    [`BẢNG THỐNG KÊ CỌC KHOAN NHỒI NEO BỜ (${s.shorePiles.length} ĐIỂM NEO, ${piles} CỌC) — ${code}`],
    [`Dự án: ${name}`],
    ['D: đường kính cọc | L_opt: chiều sâu ngàm tối thiểu theo Broms | L_tk: chiều sâu thiết kế | P_max: sức chịu tải cho phép của MỘT cọc tại L_tk.'],
    [''],
    ['MÃ CỌC', 'KÝ HIỆU', 'BÈ', 'X (m)', 'Y (m)', 'Z (m)', 'SỐ CỌC', 'D (m)', 'L_opt (m)', 'L_tk (m)', 'T dây (kN)', 'P_max (kN)', 'KẾT LUẬN', 'L_tổng (m)', 'THÉP CHỦ', 'MÁC THÉP', 'CỐT ĐAI', 'V BÊ TÔNG 1 CỌC (m³)', 'KL THÉP 1 CỌC (kg)', 'TIẾT DIỆN']
  ];
  for (const r of s.shorePiles) {
    shore.push([
      r.pileId, r.code, r.raft, num(r.x, 2), num(r.y, 2), num(r.z, 2), r.pileCount, num(r.D_m, 2),
      r.Lopt_m !== null ? num(r.Lopt_m, 2) : 'KHÔNG ĐẠT', num(r.Linput_m, 2), num(r.Tmax_kN, 1), num(r.Pmax_kN, 1),
      r.isPmaxOk ? 'ĐẠT' : 'KIỂM TRA', num(r.Ltotal_m, 2), r.cage.label, r.cage.totalBars > 0 ? r.cage.grade : '-', r.cage.stirrupLabel,
      num(r.cage.concreteVol_m3, 3), num(r.cage.steel_kg, 1), pileSectionLabel(r)
    ]);
  }
  const wsShore = XLSX.utils.aoa_to_sheet(shore);
  wsShore['!cols'] = [12, 12, 9, 12, 12, 10, 8, 8, 11, 10, 12, 12, 12, 11, 12, 11, 16, 20, 18, 20].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsShore, 'ThongKeCocBo');

  const prm = [...s.baseByRaft.values()][0]?.params;
  const bases: any[][] = [
    [`BẢNG THỐNG KÊ ĐẾ NEO ĐÁY HỒ: ĐẾ BTCT + VÍT XOẮN (${s.bases.length} ĐẾ, ${s.totals.sharedBases} ĐẾ DÙNG CHUNG, ${s.totals.lines} TUYẾN CÁP) — ${code}`],
    [`Dự án: ${name}`],
    [prm
      ? `Thông số: c_u bùn = ${prm.cuSurface_kPa} kPa; α đáy = ${prm.alphaBase}; α thân vít = ${prm.alphaShaft}; ${prm.screwCount} vít Ø${Math.round(prm.tubeDia_m * 1000)}×${Math.round(prm.tubeThk_m * 1000)} ren Ø${Math.round(prm.threadDia_m * 1000)}, L = ${prm.screwLength_m} m; FS trượt ${prm.sfSlide}, lật ${prm.sfOverturn}, nhổ vít ${prm.sfScrewUplift}. c_u và các hệ số bám dính là GIẢ ĐỊNH, chưa có khảo sát đáy hồ.`
      : ''],
    [''],
    ['MÃ ĐẾ', 'DÂY NEO', 'BÈ', 'LOẠI', 'X (m)', 'Y (m)', 'Z (m)', 'Tầm vươn ngắn nhất (m)', 'Phương vị cáp (°)', 'B (m)', 't (m)', 'Bê tông (m³)', 'Thép bản (kg)', 'KL cẩu (T)',
      'Số vít', 'Tổng dài vít (m)', 'T dây (kN)', 'HSSD nhổ', 'HSSD trượt', 'HSSD lật', 'HSSD 1 vít', 'HSSD nền', 'KẾT LUẬN', 'CHỒNG LẤN VỚI']
  ];
  for (const b of s.bases) {
    bases.push([
      b.baseId, b.code, b.raft, b.shared ? 'DÙNG CHUNG' : 'ĐƠN', num(b.x, 2), num(b.y, 2), num(b.z, 2), num(b.span_m, 2), num(b.azimuth_deg, 1), num(b.side_m, 2), num(b.thickness_m, 2),
      num(b.concrete_m3, 2), num(b.rebar_kg, 0), num(b.liftMass_t, 1), b.screwCount, num(b.screwLength_m, 1), num(b.Tmax_kN, 1),
      num(b.upliftUtil, 2), num(b.slideUtil, 2), num(b.overturnUtil, 2), num(b.screwUtil, 2), num(b.bearingUtil, 2),
      b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT', b.clashWith.length ? b.clashWith.join(', ') : '-'
    ]);
  }
  const T = s.totals;
  bases.push(['']);
  bases.push(['TỔNG HỢP']);
  bases.push(['Số đế neo đáy', T.bases, 'đế']);
  bases.push(['  trong đó đế dùng chung hai bè (hai tai neo)', T.sharedBases, 'đế']);
  bases.push(['Số tuyến cáp neo vào đế', T.lines, 'tuyến']);
  bases.push(['Tổng bê tông đế', num(T.concrete_m3, 1), 'm³']);
  bases.push(['Tổng thép bản đế (ước tính)', num(T.rebar_kg / 1000, 2), 'tấn']);
  bases.push(['Tổng số vít xoắn', T.screws, 'cây']);
  bases.push(['Tổng chiều dài vít', num(T.screwLength_m, 0), 'm']);
  bases.push(['Đế nặng nhất khi cẩu', num(T.maxLiftMass_t, 1), 'tấn']);
  bases.push(['Số đế ĐẠT mọi kiểm tra (SV-1…SV-6)', T.okBases, 'đế']);
  bases.push(['Số cặp đế CHỒNG LẤN nhau trên mặt bằng', s.clashes.length, 'cặp', s.clashes.length > 0 ? 'Phải dời điểm neo trước khi thi công.' : '']);
  const wsBases = XLSX.utils.aoa_to_sheet(bases);
  wsBases['!cols'] = [12, 20, 15, 12, 12, 12, 10, 12, 14, 8, 8, 12, 13, 10, 8, 14, 11, 10, 10, 10, 10, 10, 12, 24].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsBases, 'ThongKeDeNeoVit');

  const per: any[][] = [
    ['KIỂM TRA THEO BÈ: đế cho MỘT dây, với dây đáy ngắn nhất của bè (các dòng SV-1…SV-6 trên web). Cỡ đế của từng điểm, kể cả đế dùng chung: xem sheet ThongKeDeNeoVit và TungDiemNeoDay.'],
    [''],
    ['BÈ', 'B (m)', 't (m)', 'W\' (kN)', 'Lưới thép', 'Góc cáp MN thấp (°)', 'Góc cáp MN cao (°)', 'Th MN thấp (kN)', 'Tv MN cao (kN)',
      'HSSD nhổ', 'HSSD trượt', 'HSSD lật', 'HSSD 1 vít', 'HSSD nền', 'HSSD thép bản', 'Đã tăng so với đế mẫu', 'KẾT LUẬN']
  ];
  for (const [raft, b] of s.baseByRaft) {
    per.push([
      raft, num(b.side_m, 2), num(b.thickness_m, 2), num(b.weightSub_kN, 1), `Ø${b.rebarDia_mm} a${Math.round(b.rebarSpacing_m * 1000)}`,
      num(b.cases[0].angle_deg, 1), num(b.cases[1].angle_deg, 1), num(b.cases[0].Th_kN, 1), num(b.cases[1].Tv_kN, 1),
      num(b.upliftUtil, 2), num(b.slideUtil, 2), num(b.overturnUtil, 2), num(b.screwUtil, 2), num(b.bearingUtil, 2), num(b.rebarUtil, 2),
      b.enlarged ? 'Có' : 'Không', b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'
    ]);
  }
  const wsPer = XLSX.utils.aoa_to_sheet(per);
  wsPer['!cols'] = [9, 8, 8, 10, 12, 18, 18, 16, 16, 10, 10, 10, 10, 10, 13, 20, 12].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsPer, 'DeTheoBe');
  // Anchor-by-anchor calculation at the real position of every point (span, ground level, MNC / MNLKT).
  appendAnchorPointSheets(wb, buildAnchorPointSchedule(state, results, batchResults, coordinates), state);
  return wb;
}

/** `bang-thong-ke-neo-de-vit-xoan_<code>_<YYYYMMDD>.xlsx` */
export function screwBaseScheduleExcelFileName(state: ProjectState, now: Date = new Date()): string {
  const code = (state.meta.code || state.code || 'HV-FPV-2026').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'HV-FPV-2026';
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `bang-thong-ke-neo-de-vit-xoan_${code}_${stamp}.xlsx`;
}

export function exportScrewBaseScheduleToExcel(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): { filename: string } {
  const wb = buildScrewBaseScheduleWorkbook(state, results, batchResults, coordinates);
  const filename = screwBaseScheduleExcelFileName(state);
  XLSX.writeFile(wb, filename);
  return { filename };
}
