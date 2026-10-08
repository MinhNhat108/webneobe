import * as XLSX from 'xlsx';
import type { ProjectState } from '../calc/types';
import type { CostEstimateSummary, CostParams } from '../calc/costEstimate';

const vnd = (v: number) => Math.round(v);

/** The quotation as one sheet, `BaoGia_ThiCong`. Pure builder, no DOM. */
export function buildCostWorkbook(state: ProjectState, params: CostParams, c: CostEstimateSummary): XLSX.WorkBook {
  const code = state.meta.code || state.code || 'HV-FPV-2026';
  const name = state.meta.name || state.name || '';
  const rows: any[][] = [
    [`BÁO GIÁ THI CÔNG CỌC NEO — ${code}`],
    [`Công trình: ${name}`],
    [c.bedAnchorKind === 'screwBase' ? 'Phương án: cọc khoan nhồi trên bờ + đế BTCT giữ bằng vít xoắn dưới lòng hồ' : 'Phương án: cọc khoan nhồi trên bờ + cọc vuông đúc sẵn đóng dưới lòng hồ'],
    ['Đơn giá là GIÁ THAM KHẢO thị trường do Chủ đầu tư cung cấp (có thể điều chỉnh), không phải báo giá của nhà thầu.'],
    [''],
    ['STT', 'Hạng mục công việc', 'Đơn vị', 'Khối lượng', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)', 'Căn cứ & ghi chú']
  ];
  for (const l of c.lines) {
    rows.push([l.no, l.item, l.unit, Number(l.quantity.toFixed(1)), vnd(l.rate), vnd(l.amount_VND), l.note]);
  }
  rows.push(['', c.bedAnchorKind === 'screwBase' ? 'Cộng neo đáy hồ (B.1 → B.5)' : 'Cộng cọc lòng hồ (B.1 → B.4)', '', '', '', vnd(c.bedTotal_VND), '']);
  if (c.unpriced.length > 0) {
    rows.push(['', `CHÚ Ý: ${c.unpriced.length} hạng mục CHƯA CÓ ĐƠN GIÁ, tổng bên dưới CHƯA gồm: ${c.unpriced.join('; ')}`, '', '', '', '', '']);
  }
  rows.push(['', 'CỘNG CHI PHÍ TRỰC TIẾP (A + B)', '', '', '', vnd(c.directTotal_VND), '']);
  rows.push(['', `Dự phòng phí ${params.contingencyPercent}%`, '', '', '', vnd(c.contingency_VND), '']);
  rows.push(['', 'CỘNG TRƯỚC THUẾ', '', '', '', vnd(c.beforeVat_VND), '']);
  rows.push(['', params.includeVat ? `Thuế VAT ${params.vatPercent}%` : 'Thuế VAT (không tính)', '', '', '', vnd(c.vat_VND), '']);
  rows.push(['', 'TỔNG CỘNG', '', '', '', vnd(c.grandTotal_VND), '']);

  rows.push(['']);
  rows.push(['PHÂN BỔ CHI PHÍ TRỰC TIẾP THEO CỤM BÈ']);
  rows.push(['Cụm bè', 'Số cọc bờ', 'Cọc bờ (md)', 'Tiền cọc bờ (VNĐ)', c.bedAnchorKind === 'screwBase' ? 'Số đế neo đáy' : 'Số cọc đáy', 'Cọc đáy (md)', 'Tiền neo đáy (VNĐ)', 'Cộng (VNĐ)']);
  for (const b of c.raftBreakdowns) {
    rows.push([
      b.raftName, b.shorePiles, Number(b.shoreMeters.toFixed(1)), vnd(b.shoreCost_VND),
      b.bedPiles, Number(b.bedMeters.toFixed(1)), vnd(b.bedCost_VND), vnd(b.totalCost_VND)
    ]);
  }
  rows.push([
    'TỔNG', c.totalShorePiles, Number(c.totalShoreMeters.toFixed(1)), vnd(c.shoreTotal_VND),
    c.bedAnchorKind === 'screwBase' ? c.totalBases : c.totalBedPiles, Number(c.totalBedMeters.toFixed(1)), vnd(c.bedTotal_VND), vnd(c.directTotal_VND)
  ]);

  rows.push(['']);
  rows.push(['GHI CHÚ']);
  rows.push(['1. Khối lượng lấy từ bảng thống kê cọc: chiều dài mỗi cọc = L_tk + đoạn nhô; điểm neo cọc đôi tính 2 cọc.']);
  rows.push(['2. Tiền sàn đạo nổi / sà lan phân bổ cho các bè theo số mét cọc lòng hồ.']);
  rows.push([
    `3. Đơn giá tham khảo áp dụng cho cọc thương mại thông thường. Cọc của thiết kế này có cốt thép chủ nặng hơn ` +
      `(cọc bờ ≈ ${c.shoreMainSteel_kg_m.toFixed(1)} kg/md, cọc đáy ≈ ${c.bedMainSteel_kg_m.toFixed(1)} kg/md thép chủ), ` +
      'nên giá thực tế của nhà thầu có thể cao hơn; dùng ô "phụ phí cốt thép" để điều chỉnh.'
  ]);
  rows.push(['4. Chưa gồm: đài / bích neo đầu cọc, đài chung của cọc đôi, cáp neo và phụ kiện, khảo sát, thí nghiệm thử tải cọc.']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 52 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 20 }];
  // thousands separators on every numeric cell
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue;
    const cell = ws[addr];
    if (cell.t === 'n') cell.z = Number.isInteger(cell.v) ? '#,##0' : '#,##0.0';
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BaoGia_ThiCong');
  return wb;
}

/** `bao-gia-thi-cong-coc_<code>_<YYYYMMDD>.xlsx` */
export function costExcelFileName(state: ProjectState, now: Date = new Date()): string {
  const code = (state.meta.code || state.code || 'HV-FPV-2026').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'HV-FPV-2026';
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `bao-gia-thi-cong-coc_${code}_${stamp}.xlsx`;
}

export function exportCostToExcel(state: ProjectState, params: CostParams, c: CostEstimateSummary): string {
  const filename = costExcelFileName(state);
  XLSX.writeFile(buildCostWorkbook(state, params, c), filename);
  return filename;
}
