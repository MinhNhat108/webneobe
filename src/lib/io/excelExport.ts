import * as XLSX from 'xlsx';
import { ProjectState, CalcResults } from '../calc/types';
import { RaftSummaryItem, MooringCoordinate } from '../../data/huoiVanhProject';
import huoiVanhCoordinatesData from '../../data/huoiVanhCoordinates.json';

export interface RaftBatchResultLike {
  raft: RaftSummaryItem;
  results: CalcResults;
}

/**
 * Exports the full Master Report as one workbook, 6 sheets:
 *  1. ThongTinDuAn        — project meta
 *  2. TongHopCumBe        — Master sheet: all rafts, one calculated row each
 *  3. ToaDoDiemNeo        — all 299 anchor-point coordinates
 *  4. DuLieuDauVao        — full input parameters of the CURRENTLY selected raft
 *  5. KetQuaKiemTraChiTiet— intermediate results + the full C1..C9/BP check
 *                           table for EVERY raft in batchResults (falls back
 *                           to just the current raft when batch data is absent)
 *  6. GhiChu              — disclaimer & export metadata
 */
export function exportProjectToExcel(
  state: ProjectState,
  results: CalcResults,
  raftsSummary?: RaftSummaryItem[],
  batchResults?: RaftBatchResultLike[]
) {
  const wb = XLSX.utils.book_new();
  const rafts = raftsSummary && raftsSummary.length > 0 ? raftsSummary : undefined;
  const batch = batchResults && batchResults.length > 0 ? batchResults : undefined;

  // 1. Sheet: ThongTinDuAn ---------------------------------------------------
  const metaRows: any[][] = [
    ['THÔNG TIN DỰ ÁN HỆ THỐNG NEO BÈ'],
    [''],
    ['Tên dự án', state.meta.name || state.name],
    ['Mã dự án', state.meta.code || state.code],
    ['Địa điểm', state.meta.location],
    ['Kỹ sư thiết kế', state.meta.designer],
    ['Ngày lập', state.meta.date],
    ['Ghi chú', state.meta.note],
    ['Hệ thống', 'Điện mặt trời nổi (Floating Solar FPV)'],
    ['Số cụm bè', rafts ? rafts.length : 1],
    ['Số điểm neo', (huoiVanhCoordinatesData as MooringCoordinate[]).length]
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'ThongTinDuAn');

  // 2. Sheet: TongHopCumBe (Master sheet, one calculated row per raft) ------
  const masterHeader = [
    'Bè', 'Diện tích (m²)', 'Chu vi (m)', 'Dài (m)', 'Rộng (m)', 'Số tấm pin',
    'Số dây (Bờ/Đáy)', 'Cáp chọn', 'MBL cáp (kN)', 'Độ sâu (m)',
    'F_env (kN)', 'T_max nguyên vẹn (kN)', 'T_max đứt 1 dây (kN)',
    'η cáp (MBL_req/MBL)', 'η cọc bờ ngang', 'η cọc bờ uốn',
    'η cọc đáy ngang', 'η cọc đáy nhổ', 'Hạng mục chi phối', 'Kết luận'
  ];
  const masterRows: any[][] = [
    [`BẢNG TỔNG HỢP ${rafts ? rafts.length : 1} CỤM BÈ PIN HỒ HUỔI VANH — MASTER SHEET`],
    [''],
    masterHeader
  ];

  if (batch) {
    for (const b of batch) {
      const r = b.raft;
      const c = b.results;
      masterRows.push([
        r.name, r.area_m2, r.perimeter_m, r.length_m, r.width_m,
        r.solarPanelCount || Math.round(r.area_m2 * 0.22),
        `${r.shoreAnchors}/${r.bedAnchors}`, r.selectedCable,
        c.mbl_required_kN, r.waterDepth_m,
        c.f_env_total_kN, c.t_max_intact_kN, c.t_max_damaged_kN,
        c.cableUtilization ?? '-',
        c.shorePile?.utilization_H ?? '-', c.shorePile?.utilization_M ?? '-',
        c.bedPile1?.utilization_H ?? '-', c.bedPile1?.utilization_Uplift ?? '-',
        c.governingCheck ? `${c.governingCheck.id} — ${c.governingCheck.label}` : '-',
        c.overallVerdict === 'PASS' ? 'ĐẠT' : c.overallVerdict === 'FAIL' ? 'KHÔNG ĐẠT' : 'KHÔNG TÍNH ĐƯỢC'
      ]);
    }
  } else if (rafts) {
    for (const r of rafts) {
      masterRows.push([
        r.name, r.area_m2, r.perimeter_m, r.length_m, r.width_m,
        r.solarPanelCount || Math.round(r.area_m2 * 0.22),
        `${r.shoreAnchors}/${r.bedAnchors}`, r.selectedCable,
        '-', r.waterDepth_m, '-', '-', '-', '-', '-', '-', '-', '-', '-', '(chưa tính hàng loạt)'
      ]);
    }
  }
  const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
  XLSX.utils.book_append_sheet(wb, wsMaster, 'TongHopCumBe');

  // 3. Sheet: ToaDoDiemNeo (all anchor-point coordinates) -------------------
  const coords = huoiVanhCoordinatesData as MooringCoordinate[];
  const coordRows: any[][] = [
    [`BẢNG TỌA ĐỘ ${coords.length} ĐIỂM NEO — HỆ TỌA ĐỘ THIẾT KẾ`],
    [''],
    ['Bè', 'Mã neo', 'Loại neo', 'X Bè (m)', 'Y Bè (m)', 'X Cọc (m)', 'Y Cọc (m)', 'Z Cọc (m)', 'Nhịp dây (m)', 'Phương vị (°)']
  ];
  for (const c of coords) {
    coordRows.push([
      c.raft, c.code, c.type === 'SHORE' ? 'NEO BỜ' : 'NEO ĐÁY',
      c.xRaft, c.yRaft, c.xAnchor, c.yAnchor, c.zAnchor, c.span, c.azimuth
    ]);
  }
  const wsCoords = XLSX.utils.aoa_to_sheet(coordRows);
  XLSX.utils.book_append_sheet(wb, wsCoords, 'ToaDoDiemNeo');

  // 4. Sheet: DuLieuDauVao (current raft's full input) ----------------------
  const inputRows: any[][] = [
    ['THÔNG SỐ ĐẦU VÀO', `(Bè đang chọn: ${state.meta.note?.match(/BÈ \d+/)?.[0] ?? state.activeRaftId ?? '-'})`],
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
    ['Chế độ tổ hợp tải (FPV)', state.env.loadCombinationMode ?? 'fpv_combined', '-', "'fpv_combined' = gộp hệ số 1.05, 'separate' = tính riêng gió/sóng/dòng chảy"],
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
    ['Loại đất BỜ', state.anchor.soilShore ?? 'clay', '-', ''],
    ['cu đất bờ (đất dính)', state.anchor.cuShore_kPa, 'kPa', ''],
    ['φ đất bờ (đất rời)', state.anchor.phiShore_deg ?? '-', 'độ', ''],
    ['Loại đất ĐÁY', state.anchor.soilBed ?? 'mud', '-', ''],
    ['cu bùn đáy hồ (đất dính)', state.anchor.cuBed_kPa, 'kPa', ''],
    ['φ đất đáy (đất rời)', state.anchor.phiBed_deg ?? '-', 'độ', ''],
    ['Hệ số an toàn cọc FS', state.anchor.sfPile, '-', ''],
    ['Dạng tiết diện cọc bờ', state.anchor.shorePileShape ?? 'square', '-', ''],
    ['Dạng tiết diện cọc đáy', state.anchor.bedPileShape ?? 'square', '-', '']
  ];
  const wsInput = XLSX.utils.aoa_to_sheet(inputRows);
  XLSX.utils.book_append_sheet(wb, wsInput, 'DuLieuDauVao');

  // 5. Sheet: KetQuaKiemTraChiTiet -------------------------------------------
  const detailRows: any[][] = [
    ['KẾT QUẢ TÍNH TOÁN TRUNG GIAN & BẢNG KIỂM TRA CHI TIẾT'],
    [''],
    ['-- KẾT QUẢ TRUNG GIAN (Bè đang chọn) --'],
    ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị', 'Công thức'],
    ['Áp lực gió động', 'q', results.q_wind_Pa, 'Pa', '0.5 * rho_air * V^2'],
    ['Diện tích cản gió', 'A_wind', results.a_wind_m2, 'm²', ''],
    ['Lực gió tác dụng', 'F_wind', results.f_wind_total_kN, 'kN', ''],
    ['Lực dòng chảy', 'F_current', results.f_current_kN, 'kN', ''],
    ['Lực sóng trôi dạt', 'F_wave', results.f_wave_kN, 'kN', ''],
    ['Tổng lực môi trường', 'F_env', results.f_env_total_kN, 'kN', ''],
    ['Lực căng dây lớn nhất (Intact)', 'T_max', results.t_max_intact_kN, 'kN', 'F_env * k_focus + T0'],
    ['Lực căng dây lớn nhất (Damaged)', 'T_max,dam', results.t_max_damaged_kN, 'kN', ''],
    ['Sức đứt MBL yêu cầu', 'MBL_req', results.mbl_required_kN, 'kN', `T_max * ${state.criteria.sfLineIntact}`],
    ['Hệ số sử dụng cáp', 'Eta_cable', results.cableUtilization, '-', 'MBL_req / MBL_actual'],
    ['Khoảng hở đáy bè – đáy hồ (C8)', 'Clearance', results.bedClearance_m, 'm', 'h_nước − mớn nước'],
    ['Khoảng cách dây neo TB (C9)', 'Spacing_avg', results.avgLineSpacing_m, 'm', 'P_bè / N_dây']
  ];

  if (results.shorePile) {
    detailRows.push(
      [''],
      ['CỌC NEO BỜ (BROMS — ' + (results.shorePile.soilModel === 'sand' ? 'đất rời' : 'đất dính') + ')', '', '', '', ''],
      ['Sức chịu ngang cực hạn', 'Hu', results.shorePile.Hu, 'kN', ''],
      ['Sức chịu ngang cho phép', 'H_all', results.shorePile.H_allow, 'kN', 'Hu / FS'],
      ['Mômen uốn lớn nhất', 'M_max', results.shorePile.Mmax, 'kNm', ''],
      ['Mômen kháng uốn tiết diện (bê tông)', 'Mrd_bt', results.shorePile.MrdConcrete_kNm ?? '-', 'kNm', '0.9 * Rb * W'],
      ['Mômen kháng uốn cốt thép', 'Mrd_thep', results.shorePile.MrdSteel_kNm ?? '-', 'kNm', 'As * fy * 0.85D'],
      ['Mômen kháng uốn tổng', 'Mrd', results.shorePile.Mrd, 'kNm', 'Mrd_bt + Mrd_thep'],
      ['Hệ số sử dụng chịu ngang', 'Eta_H', results.shorePile.utilization_H, '-', 'H_applied / H_all'],
      ['Hệ số sử dụng tiết diện', 'Eta_M', results.shorePile.utilization_M, '-', 'M_max / M_rd']
    );
  }

  if (results.bedPile1) {
    detailRows.push(
      [''],
      ['CỌC NEO LÒNG HỒ (BROMS — ' + (results.bedPile1.soilModel === 'sand' ? 'đất rời' : 'đất dính') + ')', '', '', '', ''],
      ['Góc nghiêng dây tại đỉnh cọc', 'Theta', results.bedCableAngle_deg || 0, 'độ', 'arctan(depth / dist)'],
      ['Lực kéo ngang', 'Th', results.bedCableTh_kN || 0, 'kN', 'T * cos(theta)'],
      ['Lực kéo nhổ', 'Tv', results.bedCableTv_kN || 0, 'kN', 'T * sin(theta)'],
      ['Sức chịu ngang cho phép', 'H_all', results.bedPile1.H_allow, 'kN', ''],
      ['Sức chịu nhổ cho phép', 'Tv_all', results.bedPile1.upliftCapacity_all || 0, 'kN', 'Ma sát thân cọc, FS=2'],
      ['Hệ số sử dụng chịu ngang', 'Eta_Th', results.bedPile1.utilization_H, '-', ''],
      ['Hệ số sử dụng chịu nhổ', 'Eta_Tv', results.bedPile1.utilization_Uplift || 0, '-', '']
    );
  }

  detailRows.push([''], ['-- BẢNG KIỂM TRA ĐẠT / KHÔNG ĐẠT CHI TIẾT --']);

  const checkHeader = ['Bè', 'Mã', 'Nội dung kiểm tra', 'Công thức', 'Giá trị tính', 'Đơn vị', 'Ngưỡng cho phép', 'Độ lệch an toàn (Margin)', 'Kết luận', 'Ghi chú'];
  detailRows.push(checkHeader);

  const pushChecksForRaft = (raftLabel: string, checks: CalcResults['checks']) => {
    for (const c of checks) {
      detailRows.push([
        raftLabel,
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
  };

  if (batch) {
    for (const b of batch) {
      pushChecksForRaft(b.raft.name, b.results.checks);
      detailRows.push([
        b.raft.name, '', 'KẾT LUẬN', '', '', '', '', '',
        b.results.overallVerdict === 'PASS' ? 'ĐẠT YÊU CẦU' : b.results.overallVerdict === 'FAIL' ? 'KHÔNG ĐẠT YÊU CẦU' : 'KHÔNG TÍNH ĐƯỢC',
        ''
      ]);
    }
  } else {
    pushChecksForRaft(`Bè ${state.activeRaftId ?? '-'}`, results.checks);
    detailRows.push([
      '', '', 'KẾT LUẬN CHUNG', '', '', '', '', '',
      results.overallVerdict === 'PASS' ? 'ĐẠT YÊU CẦU' : 'KHÔNG ĐẠT YÊU CẦU', ''
    ]);
  }

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'KetQuaKiemTraChiTiet');

  // 6. Sheet: GhiChu ----------------------------------------------------------
  const wsNote = XLSX.utils.aoa_to_sheet([
    ['GHI CHÚ & CAM KẾT KỸ THUẬT'],
    [''],
    ['Kết quả mang tính tham khảo kỹ thuật. Các thông số vật liệu (MBL, hệ số bám neo, sức chịu cọc Broms) phải được kiểm chứng theo catalogue nhà sản xuất và quy chuẩn áp dụng.'],
    ['Phần mềm: Web Tính Toán Hệ Neo Bè & Bè Pin Nổi'],
    ['Ngày xuất báo cáo:', new Date().toLocaleString('vi-VN')],
    ['Số cụm bè tính toán:', batch ? batch.length : (rafts ? rafts.length : 1)],
    ['Số điểm neo:', coords.length]
  ]);
  XLSX.utils.book_append_sheet(wb, wsNote, 'GhiChu');

  // Download
  const filename = `neo-be_${state.code || 'project'}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
