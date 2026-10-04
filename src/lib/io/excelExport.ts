import * as XLSX from 'xlsx';
import { ProjectState, CalcResults } from '../calc/types';
import { RaftSummaryItem, MooringCoordinate } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../data/huoiVanhLayout';
import { buildPileSchedule, summarisePileMaterials, PileScheduleRow } from './pileSchedule';
import { STIRRUP_DIA_MM } from '../calc/pileCage';

/** The reinforcement / casting columns shared by both pile tables. */
const pileCageCells = (r: PileScheduleRow): Array<string | number> => [
  Number(r.Ltotal_m.toFixed(2)),
  r.cage.segmentNote,
  r.cage.label,
  r.cage.totalBars > 0 ? r.cage.grade : '-',
  r.cage.stirrupLabel,
  Number(r.cage.concreteVol_m3.toFixed(3)),
  Number(r.cage.steel_kg.toFixed(1))
];
const PILE_CAGE_COLS = [{ wch: 11 }, { wch: 22 }, { wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];

export interface RaftBatchResultLike {
  raft: RaftSummaryItem;
  results: CalcResults;
  /** The inputs the raft was calculated with (the active raft carries its Tab 2 values). */
  state?: ProjectState;
  deviations?: Array<{ label: string }>;
}

/**
 * Exports the full Master Report as one workbook, 7 sheets:
 *  1. ThongTinDuAn        — project meta
 *  2. TongHopCumBe        — Master sheet: all rafts, one calculated row each
 *  3. ToaDoDiemNeo        — all anchor-point coordinates (V2 layout)
 *  4. DuLieuDauVao        — full input parameters of the CURRENTLY selected raft
 *  5. KetQuaKiemTraChiTiet— intermediate results + the full C1..C9/BP check
 *                           table for EVERY raft in batchResults (falls back
 *                           to just the current raft when batch data is absent)
 *  6. ThongKeCoc          — Pile Schedule: one row per pile with L_opt, D,
 *                           T_max, P_req and P_max (same data as the DXF table)
 *  7. GhiChu              — disclaimer & export metadata
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
    ['Số điểm neo', MOORING_LINES_V2.length]
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
      // Values the raft was actually calculated with: for the raft being
      // edited in Tab 2 these may differ from the design catalogue.
      const st = b.state;
      const trial = (b.deviations?.length ?? 0) > 0;
      masterRows.push([
        trial ? `${r.name} (thử nghiệm – khác thiết kế chốt)` : r.name,
        r.area_m2, st?.raft.perimeter_m ?? r.perimeter_m, st?.raft.length_m ?? r.length_m, st?.raft.width_m ?? r.width_m,
        st?.raft.solarPanelCount ?? (r.solarPanelCount || Math.round(r.area_m2 * 0.22)),
        `${st?.line.shoreLineCount ?? r.shoreAnchors}/${st?.line.bedLineCount ?? r.bedAnchors}`, st?.line.cableCode ?? r.selectedCable,
        c.mbl_required_kN, st?.env.waterDepth_m ?? r.waterDepth_m,
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
  const coords = MOORING_LINES_V2;
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
      ['Cốt thép mặt chịu kéo', 'As', `${state.anchor.shoreRebarFaceCount ?? 0}Φ${state.anchor.shoreRebarDia_mm ?? 0}`, '', `Rs = ${state.anchor.pileRebarRs_MPa ?? 350} MPa, a_s = ${state.anchor.pileRebarCover_mm ?? 50} mm`],
      ['Mômen kháng uốn tiết diện', 'Mrd', results.shorePile.Mrd, 'kNm', 'TCVN 5574:2018: Rs * As * (a - 2*a_s); không thép: Rbt * W'],
      ['Hệ số tải trọng cho mômen uốn', 'gamma', state.anchor.pileBendingLoadFactor ?? 1.2, '-', ''],
      ['Hệ số sử dụng chịu ngang', 'Eta_H', results.shorePile.utilization_H, '-', 'H_applied / H_all'],
      ['Hệ số sử dụng tiết diện', 'Eta_M', results.shorePile.utilization_M, '-', 'gamma * M_max / M_rd']
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

  // 6. Sheet: ThongKeCoc (Pile Schedule — the CAD table, spreadsheet form) ---
  // Same builder as the DXF export, so the drawing and the workbook can never
  // disagree on L_opt / P_max for a given pile.
  const schedule = buildPileSchedule(state, results, batch);
  const scheduleRows: any[][] = [
    [`BẢNG THỐNG KÊ CỌC NEO — ${state.meta.code || state.code || 'HV-FPV-2026'}`],
    [`Dự án: ${state.meta.name || state.name || 'Điện Mặt Trời Nổi Hồ Huổi Vanh'}`],
    [
      `Tổng số cọc: ${schedule.length} (cọc VUÔNG BTCT, a = cạnh tiết diện) | L_opt: chiều sâu ngàm TỐI THIỂU theo Broms | L_tk: chiều sâu ĐÓNG CỌC THEO THIẾT KẾ | P_max: sức chịu tải cho phép của cọc TẠI L_tk (kN) | P_req = T_max × SF`
    ],
    [''],
    [
      'MÃ CỌC',
      'KÝ HIỆU KS',
      'CỤM BÈ',
      'LOẠI',
      'X (m)',
      'Y (m)',
      'Z (m)',
      'SỐ CỌC',
      'a (m)',
      'L_opt (m)',
      'L_tk (m)',
      'T_max (kN)',
      'P_req (kN)',
      'P_max (kN)',
      'KL',
      'Ghi chú',
      'L_tổng (m)',
      'PHÂN ĐOẠN CỌC',
      'THÉP CHỦ',
      'MÁC THÉP',
      'CỐT ĐAI',
      'V BÊ TÔNG 1 CỌC (m³)',
      'KL THÉP 1 CỌC (kg)'
    ]
  ];
  for (const r of schedule) {
    scheduleRows.push([
      r.pileId,
      r.code,
      r.raft,
      r.type === 'SHORE' ? 'BỜ' : 'ĐÁY HỒ',
      Number(r.x.toFixed(2)),
      Number(r.y.toFixed(2)),
      Number(r.z.toFixed(2)),
      r.pileCount,
      Number(r.D_m.toFixed(2)),
      r.Lopt_m !== null ? Number(r.Lopt_m.toFixed(2)) : 'KHÔNG ĐẠT',
      Number(r.Linput_m.toFixed(2)),
      Number(r.Tmax_kN.toFixed(1)),
      Number(r.Preq_kN.toFixed(1)),
      Number(r.Pmax_kN.toFixed(1)),
      r.isPmaxOk ? 'ĐẠT' : 'KIỂM TRA',
      r.note ?? '',
      ...pileCageCells(r)
    ]);
  }
  const wsSchedule = XLSX.utils.aoa_to_sheet(scheduleRows);
  wsSchedule['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 24 },
    ...PILE_CAGE_COLS
  ];
  XLSX.utils.book_append_sheet(wb, wsSchedule, 'ThongKeCoc');

  // 7. Sheet: GhiChu ----------------------------------------------------------
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

/** Filename generator for the standalone pile schedule workbook. */
export function pileScheduleExcelFileName(state: ProjectState, now: Date = new Date()): string {
  const code = (state.meta.code || state.code || 'HV-FPV-2026')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'HV-FPV-2026';
  const stamp =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}`;
  return `bang-thong-ke-coc-neo_${code}_${stamp}.xlsx`;
}

/**
 * Builds the standalone Pile Schedule workbook matching the AutoCAD drawing table
 * (BANG THONG KE COC NEO - 13 columns: MA COC, KY HIEU KS, CUM BE, LOAI, X, Y, Z, D, L_opt, T_max, P_req, P_max, KL).
 * Pure builder without browser DOM or file side-effects, ideal for unit testing.
 */
export function buildPileScheduleWorkbook(
  state: ProjectState,
  results: CalcResults,
  batchResults?: RaftBatchResultLike[],
  coordinates?: MooringCoordinate[]
): XLSX.WorkBook {
  const schedule = buildPileSchedule(state, results, batchResults, coordinates);
  const wb = XLSX.utils.book_new();

  const code = state.meta.code || state.code || 'HV-FPV-2026';
  const name = state.meta.name || state.name || 'Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh';

  const rows: any[][] = [
    [`BẢNG THỐNG KÊ CỌC NEO - ${code}`],
    [`Dự án: ${name}`],
    [
      `Tổng số điểm neo: ${schedule.length}, tổng số cọc: ${schedule.reduce((s, r) => s + r.pileCount, 0)} (cọc VUÔNG BTCT, a = cạnh tiết diện; SỐ CỌC = số cọc tại điểm neo, các cột lực tính cho MỘT cọc)  |  L_opt: chiều sâu ngàm TỐI THIỂU theo Broms (tham khảo)  |  ` +
        `L_tk: chiều sâu ĐÓNG CỌC theo thiết kế  |  P_max: sức chịu tải cho phép của cọc TẠI L_tk  |  P_req = T_max × SF`
    ],
    [''],
    [
      'MÃ CỌC',
      'KÝ HIỆU KS',
      'CỤM BÈ',
      'LOẠI',
      'X (m)',
      'Y (m)',
      'Z (m)',
      'SỐ CỌC',
      'a (m)',
      'L_opt (m)',
      'L_tk (m)',
      'T_max (kN)',
      'P_req (kN)',
      'P_max (kN)',
      'KL',
      'L_tổng (m)',
      'PHÂN ĐOẠN CỌC',
      'THÉP CHỦ',
      'MÁC THÉP',
      'CỐT ĐAI',
      'V BÊ TÔNG 1 CỌC (m³)',
      'KL THÉP 1 CỌC (kg)'
    ]
  ];

  for (const r of schedule) {
    rows.push([
      r.pileId,
      r.code,
      r.raft,
      r.type === 'SHORE' ? 'BỜ' : 'ĐÁY HỒ',
      Number(r.x.toFixed(2)),
      Number(r.y.toFixed(2)),
      Number(r.z.toFixed(2)),
      r.pileCount,
      Number(r.D_m.toFixed(2)),
      r.Lopt_m !== null ? Number(r.Lopt_m.toFixed(2)) : 'KHÔNG ĐẠT',
      Number(r.Linput_m.toFixed(2)),
      Number(r.Tmax_kN.toFixed(1)),
      Number(r.Preq_kN.toFixed(1)),
      Number(r.Pmax_kN.toFixed(1)),
      r.isPmaxOk ? 'ĐẠT' : 'KIỂM TRA',
      ...pileCageCells(r)
    ]);
  }

  // Summary statistics section at the bottom
  const shorePiles = schedule.filter((r) => r.type === 'SHORE');
  const bedPiles = schedule.filter((r) => r.type === 'BED');
  const passedPiles = schedule.filter((r) => r.isPmaxOk);

  const shoreLopts = shorePiles.filter((r) => r.Lopt_m !== null).map((r) => r.Lopt_m!);
  const bedLopts = bedPiles.filter((r) => r.Lopt_m !== null).map((r) => r.Lopt_m!);
  const avgShoreLopt =
    shoreLopts.length > 0 ? Number((shoreLopts.reduce((a, b) => a + b, 0) / shoreLopts.length).toFixed(2)) : 0;
  const avgBedLopt =
    bedLopts.length > 0 ? Number((bedLopts.reduce((a, b) => a + b, 0) / bedLopts.length).toFixed(2)) : 0;

  rows.push(['']);
  // The design depth varies per raft (BÈ 5 drives deeper piles), so quote the
  // real range taken from the schedule rather than the active raft's value.
  const depthLabel = (subset: typeof schedule) => {
    const values = [...new Set(subset.map((r) => r.Linput_m))].sort((a, b) => a - b);
    if (values.length === 0) return '-';
    return values.length === 1
      ? `${values[0]} m`
      : `${values[0]}–${values[values.length - 1]} m (tùy cụm bè)`;
  };
  const shoreLtkLabel = depthLabel(shorePiles);
  const bedLtkLabel = depthLabel(bedPiles);

  rows.push(['TỔNG HỢP & THỐNG KÊ CỌC NEO TOÀN DỰ ÁN']);
  rows.push(['Tổng số điểm neo', schedule.length, 'điểm', '100%']);
  rows.push([
    'Tổng số CỌC (điểm neo cọc đôi tính 2 cọc)',
    schedule.reduce((s, r) => s + r.pileCount, 0),
    'cọc',
    'SỐ CỌC > 1: cụm cọc đặt cạnh nhau vuông góc phương cáp, cách nhau ≥ 3a, chung đài / bích neo; P_req và P_max tính cho MỘT cọc.'
  ]);
  rows.push([
    'Số điểm neo bờ (BỜ)',
    shorePiles.length,
    'điểm',
    `${((shorePiles.length / schedule.length) * 100).toFixed(1)}%`
  ]);
  rows.push([
    'Số điểm neo lòng hồ (ĐÁY HỒ)',
    bedPiles.length,
    'điểm',
    `${((bedPiles.length / schedule.length) * 100).toFixed(1)}%`
  ]);
  rows.push([
    'Số điểm neo ĐẠT sức chịu tải (P_req ≤ P_max, tính cho một cọc)',
    passedPiles.length,
    'cọc',
    `${((passedPiles.length / schedule.length) * 100).toFixed(1)}%`
  ]);
  rows.push([
    'Chiều sâu ngàm TỐI THIỂU trung bình — cọc bờ (L_opt, Broms)',
    avgShoreLopt,
    'm',
    `Chiều sâu ĐÓNG CỌC theo thiết kế (L_tk): ${shoreLtkLabel}`
  ]);
  rows.push([
    'Chiều sâu ngàm TỐI THIỂU trung bình — cọc đáy (L_opt, Broms)',
    avgBedLopt,
    'm',
    `Chiều sâu ĐÓNG CỌC theo thiết kế (L_tk): ${bedLtkLabel}`
  ]);
  rows.push([
    'Ghi chú cột P_max',
    '',
    '',
    'P_max tính theo chiều sâu ĐÓNG CỌC THỰC TẾ (L_tk), không phải theo L_opt. L_opt chỉ là chiều sâu tối thiểu vừa đủ chịu tải.'
  ]);

  // Bill of materials for the whole lake: every pile of every anchor point.
  const mat = summarisePileMaterials(schedule);
  rows.push(['']);
  rows.push(['BẢNG TỔNG HỢP VẬT TƯ CỌC TOÀN HỒ']);
  rows.push(['Tổng số cọc', mat.piles, 'cọc', `${mat.shorePiles} cọc bờ + ${mat.bedPiles} cọc đáy, tại ${mat.anchorPoints} điểm neo`]);
  rows.push(['Tổng chiều dài cọc (L_tk + đoạn nhô)', Number(mat.totalLength_m.toFixed(1)), 'm', '']);
  rows.push(['Tổng bê tông B25', Number(mat.concrete_m3.toFixed(1)), 'm³', '']);
  for (const dia of Object.keys(mat.mainSteelByDia_kg).map(Number).sort((p, q) => p - q)) {
    rows.push([`Thép chủ Φ${dia}`, Number(mat.mainSteelByDia_kg[dia].toFixed(0)), 'kg', 'Theo kiểm tra uốn TCVN 5574:2018; lồng thép = 4 × (số thanh mỗi mặt − 1)']);
  }
  rows.push([`Cốt đai Φ${STIRRUP_DIA_MM}`, Number(mat.stirrupSteel_kg.toFixed(0)), 'kg', 'CẤU TẠO (a100 trong 1,5 m hai đầu, a200 thân cọc; thêm đai phụ khi lồng 8–12 thanh). Chưa tính lực cắt.']);
  rows.push(['Móc cẩu Φ16', Number(mat.hookSteel_kg.toFixed(0)), 'kg', 'CẤU TẠO: 2 móc mỗi cọc, đặt tại 0,207 L']);
  rows.push(['TỔNG THÉP', Number((mat.steel_kg / 1000).toFixed(2)), 'tấn', `≈ ${(mat.steel_kg / mat.concrete_m3).toFixed(0)} kg thép / m³ bê tông. Chưa gồm hộp thép đầu cọc và đài / bích neo.`]);
  rows.push(['Phân đoạn', '', '', 'Tất cả cọc ≤ 12 m: đúc và hạ NGUYÊN MỘT ĐOẠN, không có mối nối. Nếu thiết bị buộc phải chia đoạn thì mối nối chịu kéo / uốn phải được thiết kế riêng.']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths matching table layout
  ws['!cols'] = [
    { wch: 12 }, // MÃ CỌC
    { wch: 14 }, // KÝ HIỆU KS
    { wch: 10 }, // CỤM BÈ
    { wch: 12 }, // LOẠI
    { wch: 12 }, // X (m)
    { wch: 12 }, // Y (m)
    { wch: 12 }, // Z (m)
    { wch: 8 }, // SỐ CỌC — piles at the anchor point
    { wch: 10 }, // a (m) — side of the square pile
    { wch: 12 }, // L_opt (m)
    { wch: 11 }, // L_tk (m)
    { wch: 14 }, // T_max (kN)
    { wch: 14 }, // P_req (kN)
    { wch: 14 }, // P_max (kN)
    { wch: 12 }, // KL
    ...PILE_CAGE_COLS
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'BangThongKeCoc');
  return wb;
}

/**
 * Triggers the browser download of the standalone Pile Schedule Excel workbook.
 */
export function exportPileScheduleToExcel(
  state: ProjectState,
  results: CalcResults,
  batchResults?: RaftBatchResultLike[],
  coordinates?: MooringCoordinate[]
): { filename: string; rowCount: number } {
  const wb = buildPileScheduleWorkbook(state, results, batchResults, coordinates);
  const filename = pileScheduleExcelFileName(state);
  XLSX.writeFile(wb, filename);
  const rowCount = (coordinates ?? MOORING_LINES_V2).length;
  return { filename, rowCount };
}
