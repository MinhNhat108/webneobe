import * as XLSX from 'xlsx';
import { ProjectState, CalcResults } from '../calc/types';
import { RaftSummaryItem } from '../../data/huoiVanhProject';

export function exportProjectToExcel(
  state: ProjectState,
  results: CalcResults,
  raftsSummary?: RaftSummaryItem[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: ThongTinDuAn
  const metaRows: any[][] = [
    ['THÔNG TIN DỰ ÁN HỆ THỐNG NEO BÈ'],
    [''],
    ['Tên dự án', state.meta.name || state.name],
    ['Mã dự án', state.meta.code || state.code],
    ['Địa điểm', state.meta.location],
    ['Kỹ sư thiết kế', state.meta.designer],
    ['Ngày lập', state.meta.date],
    ['Ghi chú', state.meta.note],
    ['Hệ thống', 'Điện mặt trời nổi (Floating Solar FPV)']
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'ThongTinDuAn');

  // 2. Sheet: DuLieuDauVao
  const inputRows: any[][] = [
    ['THÔNG SỐ ĐẦU VÀO'],
    [''],
    ['1. THÔNG SỐ BÈ & HỆ PIN NỔI', 'Giá trị', 'Đơn vị', 'Ghi chú'],
    ['Chiều dài bè L', state.raft.length_m, 'm', ''],
    ['Chiều rộng bè W', state.raft.width_m, 'm', ''],
    ['Diện tích bè', state.raft.length_m * state.raft.width_m, 'm²', ''],
    ['Mớn nước d', state.raft.draft_m, 'm', ''],
    ['Chiều cao nổi', state.raft.freeboardHeight_m, 'm', ''],
    ['Khối lượng bè', state.raft.displacement_t, 'tấn', ''],
    ['Số tấm pin', state.raft.solarPanelCount || 0, 'tấm', ''],
    ['Góc nghiêng pin', state.raft.solarTilt_deg || 12, 'độ', ''],
    ['Hệ số che chắn', state.raft.solarShieldFactor || 0.55, '-', ''],
    [''],
    ['2. MÔI TRƯỜNG & HỒ CHỨA', 'Giá trị', 'Đơn vị', 'Ghi chú'],
    ['Độ sâu nước', state.env.waterDepth_m, 'm', ''],
    ['Biên độ mực nước', state.env.tideRange_m, 'm', ''],
    ['Vận tốc gió thiết kế V', state.env.windSpeed_ms, 'm/s', ''],
    ['Hệ số cản gió Cd', state.env.windCd, '-', ''],
    ['Vận tốc dòng chảy', state.env.currentSpeed_ms, 'm/s', ''],
    ['Chiều cao sóng Hs', state.env.waveHs_m, 'm', ''],
    [''],
    ['3. DÂY CÁP / XÍCH NEO', 'Giá trị', 'Đơn vị', 'Ghi chú'],
    ['Tổng số dây neo', state.line.count, 'dây', ''],
    ['Số dây chịu tải chính', state.line.effectiveCount, 'dây', ''],
    ['Mã cáp / Quy cách', state.line.cableCode || (state.line.type === 'chain' ? `Xích d=${state.line.chainDiameter_mm}mm` : 'Cáp Polyester'), '-', ''],
    ['Sức đứt MBL', state.line.mbl_kN, 'kN', ''],
    ['Lực căng trước T0', state.line.pretension_kN, 'kN', ''],
    ['Hệ số tập trung lực', state.line.focusFactor, '-', ''],
    ['Chiều dài 1 dây', state.line.totalLength_m, 'm', ''],
    [''],
    ['4. HỆ MỎ NEO / CỌC NEO', 'Giá trị', 'Đơn vị', 'Ghi chú'],
    ['Chế độ neo', state.anchor.mode, '-', ''],
    ['cu đất bờ', state.anchor.cuShore_kPa, 'kPa', ''],
    ['cu bùn đáy hồ', state.anchor.cuBed_kPa, 'kPa', ''],
    ['Hệ số an toàn cọc FS', state.anchor.sfPile, '-', '']
  ];
  const wsInput = XLSX.utils.aoa_to_sheet(inputRows);
  XLSX.utils.book_append_sheet(wb, wsInput, 'DuLieuDauVao');

  // 3. Sheet: KetQuaTrungGian
  const interRows: any[][] = [
    ['KẾT QUẢ TÍNH TOÁN TRUNG GIAN'],
    [''],
    ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị', 'Công thức'],
    ['Áp lực gió động', 'q', results.q_wind_Pa, 'Pa', '0.5 * rho_air * V^2'],
    ['Diện tích cản gió', 'A_wind', results.a_wind_m2, 'm²', ''],
    ['Lực gió tác dụng', 'F_wind', results.f_wind_total_kN, 'kN', ''],
    ['Lực dòng chảy', 'F_current', results.f_current_kN, 'kN', ''],
    ['Lực sóng trôi dạt', 'F_wave', results.f_wave_kN, 'kN', ''],
    ['Tổng lực môi trường', 'F_env', results.f_env_total_kN, 'kN', ''],
    ['Lực căng dây lớn nhất (Intact)', 'T_max', results.t_max_intact_kN, 'kN', 'F_env * k_focus + T0'],
    ['Lực căng dây lớn nhất (Damaged)', 'T_max,dam', results.t_max_damaged_kN, 'kN', ''],
    ['Sức đứt MBL yêu cầu (FS=3.0)', 'MBL_req', results.mbl_required_kN, 'kN', 'T_max * 3.0'],
    ['Hệ số sử dụng cáp', 'Eta_cable', results.cableUtilization, '-', 'MBL_req / MBL_actual']
  ];

  if (results.shorePile) {
    interRows.push(
      [''],
      ['CỌC NEO BỜ (BROMS)', '', '', '', ''],
      ['Sức chịu ngang cực hạn', 'Hu', results.shorePile.Hu, 'kN', 'Broms quadratic'],
      ['Sức chịu ngang cho phép', 'H_all', results.shorePile.H_allow, 'kN', 'Hu / FS'],
      ['Mômen uốn lớn nhất', 'M_max', results.shorePile.Mmax, 'kNm', ''],
      ['Mômen kháng uốn tiết diện', 'M_rd', results.shorePile.Mrd, 'kNm', '0.9 * Rb * D^3 / 6'],
      ['Hệ số sử dụng chịu ngang', 'Eta_H', results.shorePile.utilization_H, '-', 'H_applied / H_all'],
      ['Hệ số sử dụng tiết diện', 'Eta_M', results.shorePile.utilization_M, '-', 'M_max / M_rd']
    );
  }

  if (results.bedPile1) {
    interRows.push(
      [''],
      ['CỌC NEO LÒNG HỒ CÁCH 1 (BROMS)', '', '', '', ''],
      ['Góc nghiêng dây tại đỉnh cọc', 'Theta', results.bedCableAngle_deg || 0, 'độ', 'arctan(depth / dist)'],
      ['Lực kéo ngang', 'Th', results.bedCableTh_kN || 0, 'kN', 'T * cos(theta)'],
      ['Lực kéo nhổ', 'Tv', results.bedCableTv_kN || 0, 'kN', 'T * sin(theta)'],
      ['Sức chịu ngang cho phép', 'H_all', results.bedPile1.H_allow, 'kN', ''],
      ['Sức chịu nhổ cho phép', 'Tv_all', results.bedPile1.upliftCapacity_all || 0, 'kN', 'Shaft friction FS=2'],
      ['Hệ số sử dụng chịu ngang', 'Eta_Th', results.bedPile1.utilization_H, '-', ''],
      ['Hệ số sử dụng chịu nhổ', 'Eta_Tv', results.bedPile1.utilization_Uplift || 0, '-', '']
    );
  }

  const wsInter = XLSX.utils.aoa_to_sheet(interRows);
  XLSX.utils.book_append_sheet(wb, wsInter, 'KetQuaTrungGian');

  // 4. Sheet: BangKiemTra
  const checkRows: any[][] = [
    ['BẢNG TỔNG HỢP KIỂM TRA ĐẠT / KHÔNG ĐẠT'],
    [''],
    ['Mã', 'Nội dung kiểm tra', 'Công thức', 'Giá trị tính', 'Đơn vị', 'Ngưỡng cho phép', 'Độ lệch an toàn (Margin)', 'Kết luận', 'Ghi chú']
  ];

  for (const c of results.checks) {
    checkRows.push([
      c.id,
      c.label,
      c.formula,
      c.actual !== null ? c.actual : 'N/A',
      c.unit,
      String(c.threshold),
      c.margin !== null ? `${(c.margin * 100).toFixed(1)}%` : '-',
      c.status === 'PASS' ? 'ĐẠT' : c.status === 'FAIL' ? 'KHÔNG ĐẠT' : c.status === 'SKIP' ? 'KHÔNG ÁP DỤNG' : 'KHÔNG TÍNH ĐƯỢC',
      c.note || ''
    ]);
  }

  checkRows.push(
    [''],
    ['KẾT LUẬN CHUNG TOÀN HỆ THỐNG:', results.overallVerdict === 'PASS' ? 'ĐẠT YÊU CẦU' : 'KHÔNG ĐẠT YÊU CẦU', '', '', '', '', '', '', '']
  );

  const wsChecks = XLSX.utils.aoa_to_sheet(checkRows);
  XLSX.utils.book_append_sheet(wb, wsChecks, 'BangKiemTra');

  // 5. Sheet: DanhSach13Be (if summary available)
  if (raftsSummary && raftsSummary.length > 0) {
    const summaryRows: any[][] = [
      ['BẢNG TỔNG HỢP 12 BÈ PIN HỒ HUỔI VANH'],
      [''],
      ['Bè', 'Diện tích (m²)', 'Chu vi (m)', 'Dài (m)', 'Rộng (m)', 'Góc xoay (°)', 'Số tấm pin', 'Hệ số tập trung', 'Tổng số dây', 'Dây neo bờ', 'Dây neo đáy', 'Cáp chọn', 'Độ sâu (m)', 'Khoảng cách cọc đáy (m)']
    ];
    for (const r of raftsSummary) {
      summaryRows.push([
        r.name,
        r.area_m2,
        r.perimeter_m,
        r.length_m,
        r.width_m,
        r.angle_deg,
        r.solarPanelCount || Math.round(r.area_m2 * 0.22),
        r.focusFactor,
        r.cableCount,
        r.shoreAnchors,
        r.bedAnchors,
        r.selectedCable,
        r.waterDepth_m,
        r.bedAnchorDist_m
      ]);
    }
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TongHop13Be');
  }

  // 6. Sheet: GhiChu
  const wsNote = XLSX.utils.aoa_to_sheet([
    ['GHI CHÚ & CAM KẾT KỸ THUẬT'],
    [''],
    ['Kết quả mang tính tham khảo kỹ thuật. Các thông số vật liệu (MBL, hệ số bám neo, sức chịu cọc Broms) phải được kiểm chứng theo catalogue nhà sản xuất và quy chuẩn áp dụng.'],
    ['Phần mềm: Web Tính Toán Hệ Neo Bè & Bè Pin Nổi'],
    ['Ngày xuất báo cáo:', new Date().toLocaleString('vi-VN')]
  ]);
  XLSX.utils.book_append_sheet(wb, wsNote, 'GhiChu');

  // Download
  const filename = `neo-be_${state.code || 'project'}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
