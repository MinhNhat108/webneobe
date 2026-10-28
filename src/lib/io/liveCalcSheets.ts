import * as XLSX from 'xlsx';
import type { FinalDesign } from './finalDesignWorkbook';

/**
 * The LIVE part of the calculation workbook of the settled design: four sheets
 * whose result cells are Excel formulas, so changing an input cell recalculates
 * line tension, shore pile and screw-pile base in Excel itself.
 *
 *   CT_ThongSo      inputs shared by every raft + the screw pile and the Broms pile
 *   CT_LucDay       wind force and line tension of each raft
 *   CT_CocKhoanNhoi lateral (BP-1) and bending (BP-2) check of the bored pile of each raft
 *   CT_DeVitXoan    every base: the six load combinations and SV-1…SV-5
 *
 * The formulas repeat `loads.ts`, `broms.ts` and `screwAnchorBed.ts`. Every
 * formula cell also carries the engine's value, and `scripts/verifyLiveWorkbook`
 * recalculates the file in Excel and compares the two.
 *
 * Not live: the SIZE of a base. Excel cannot iterate the way `autoSize` does, so
 * the side B is an input (pre-filled with the engine's choice); the sheet tells
 * whether that B passes. The slab steel check (SV-6) is not repeated here.
 */

type Cell = string | number | { f: string; v: number | string };
export const LIVE_SHEETS = ['CT_ThongSo', 'CT_LucDay', 'CT_CocKhoanNhoi', 'CT_DeVitXoan'];
const [S_PAR, S_LOAD, S_PILE, S_BASE] = LIVE_SHEETS;
const col = (i: number) => XLSX.utils.encode_col(i);

export interface LiveSheets {
  sheets: Array<{ name: string; ws: XLSX.WorkSheet }>;
  /** Input cells (to be filled yellow), per sheet, as A1 addresses. */
  inputs: Record<string, string[]>;
}

function toSheet(rows: Cell[][], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => (typeof c === 'object' ? c.v : c))));
  rows.forEach((r, i) => r.forEach((c, j) => {
    if (typeof c === 'object') ws[XLSX.utils.encode_cell({ r: i, c: j })].f = c.f;
  }));
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

export function buildLiveCalcSheets(d: FinalDesign): LiveSheets {
  const st = d.state, A = st.anchor, E = st.env;
  const g0 = d.schedule.bases[0].design, P = g0.params;
  const R0 = d.rafts[0];
  const inputs: Record<string, string[]> = { [S_PAR]: [], [S_LOAD]: [], [S_PILE]: [], [S_BASE]: [] };

  // ---- parameters ---------------------------------------------------------
  const par: Cell[][] = [
    [`BẢNG TÍNH CÓ CÔNG THỨC — THÔNG SỐ ĐẦU VÀO — ${d.code}`],
    ['Ô có chữ "NHẬP" ở cột E (tô vàng trong file đính kèm) là ô nhập. Đổi ô nhập thì ba sheet CT_LucDay, CT_CocKhoanNhoi, CT_DeVitXoan tự tính lại. Thông số đất là GIẢ ĐỊNH, chưa có khảo sát.'],
    [d.windCaveat ? `CHÚ Ý: ${d.windCaveat}` : ''],
    ['NHÓM', 'THÔNG SỐ', 'GIÁ TRỊ', 'ĐƠN VỊ', 'LOẠI Ô', 'GHI CHÚ / CÔNG THỨC']
  ];
  const ref: Record<string, string> = {};
  const add = (key: string, group: string, label: string, value: Cell, unit: string, note = '') => {
    const row = par.length + 1;
    ref[key] = `${S_PAR}!$C$${row}`;
    const isInput = typeof value !== 'object';
    if (isInput) inputs[S_PAR].push(`C${row}`);
    par.push([group, label, value, unit, isInput ? 'NHẬP' : 'công thức', note]);
  };
  const r = (k: string) => ref[k];
  const pileStick = R0.pileLtotal_m - R0.pileL_m;

  add('V', 'Gió', 'Vận tốc gió tính toán V', d.wind_ms, 'm/s');
  add('rho', 'Gió', 'Khối lượng riêng không khí ρ', E.airDensity ?? 1.25, 'kg/m³');
  add('q', 'Gió', 'Áp lực gió q', { f: `0.5*${r('rho')}*${r('V')}^2`, v: R0.q_Pa }, 'N/m²', 'q = 0,5 ρ V²');
  add('A1', 'Gió', 'Diện tích một tấm pin', R0.panelArea_m2, 'm²');
  add('tilt', 'Gió', 'Góc nghiêng tấm pin', R0.tilt_deg, '°');
  add('cdP', 'Gió', 'Hệ số cản tấm pin', R0.cdPanel, '');
  add('shield', 'Gió', 'Hệ số che chắn giữa các hàng', R0.shield, '', 'GIẢ ĐỊNH');
  add('cdF', 'Gió', 'Hệ số cản phao', R0.cdFloat, '');
  add('fb', 'Gió', 'Mạn khô của phao (cũng là chiều cao bích bè trên mặt nước)', R0.freeboard_m, 'm');
  add('wcf', 'Gió', 'Hệ số gộp sóng + dòng chảy', R0.waveCurrentFactor, '');
  add('n', 'Dây neo', 'Số dây làm việc n', R0.nEff, 'dây', 'GIẢ ĐỊNH');
  add('alpha', 'Dây neo', 'Góc dây so với phương ngang α', R0.alpha_deg, '°', 'GIẢ ĐỊNH');
  add('T0', 'Dây neo', 'Lực căng trước T_0', R0.pretension_kN, 'kN');
  add('sfC', 'Dây neo', 'Hệ số an toàn cáp yêu cầu', st.criteria.sfLineIntact ?? 3, '');
  add('mnc', 'Mực nước', 'MNC', d.points.levels.mnc_m, 'm');
  add('mnlkt', 'Mực nước', 'MNLKT', d.points.levels.mnlkt_m, 'm');

  add('pD', 'Cọc bờ', 'Đường kính cọc khoan nhồi D', R0.pileD_m, 'm');
  add('pL', 'Cọc bờ', 'Chiều sâu ngàm L_tk', R0.pileL_m, 'm');
  add('pStick', 'Cọc bờ', 'Đoạn nhô trên mặt đất', Number(pileStick.toFixed(3)), 'm');
  add('pE', 'Cọc bờ', 'Điểm móc cáp cách mặt đất e', A.shoreArm_e_m ?? 0.1, 'm');
  add('pCu', 'Cọc bờ', 'c_u đất bờ', A.cuShore_kPa ?? 40, 'kPa', 'GIẢ ĐỊNH');
  add('pFS', 'Cọc bờ', 'Hệ số an toàn chịu ngang', A.sfPile ?? 2.5, '');
  add('pGm', 'Cọc bờ', 'Hệ số tải trọng khi kiểm tra uốn γ', R0.loadFactor, '');
  add('pCover', 'Cọc bờ', 'Khoảng cách từ mặt cọc tới tim thép chủ', (A.pileRebarCover_mm ?? 50) / 1000, 'm');
  add('pP', 'Cọc bờ', 'Phản lực đất cực hạn p', { f: `9*${r('pCu')}*${r('pD')}`, v: 9 * (A.cuShore_kPa ?? 40) * R0.pileD_m }, 'kN/m', 'p = 9 c_u D');
  add('pG', 'Cọc bờ', 'Chiều sâu làm việc g', { f: `MAX(0.1,${r('pL')}-1.5*${r('pD')})`, v: R0.pileL_m - 1.5 * R0.pileD_m }, 'm', 'g = L − 1,5 D');
  add('pHu', 'Cọc bờ', 'Sức chịu ngang cực hạn H_u (Broms)', {
    f: `(-(${r('pE')}+1.5*${r('pD')}+${r('pG')})+SQRT((${r('pE')}+1.5*${r('pD')}+${r('pG')})^2+${r('pG')}^2))*${r('pP')}`, v: R0.Hu_kN
  }, 'kN', 'Nghiệm của 0,5/p·H² + (e + 1,5D + g)·H − 0,5·p·g² = 0');
  add('pHa', 'Cọc bờ', 'Sức chịu ngang cho phép', { f: `${r('pHu')}/${r('pFS')}`, v: R0.Hallow_kN }, 'kN', 'H_u / hệ số an toàn');

  add('bPad', 'Đế BTCT', 'Chiều cao tai neo trên mặt đế', P.padeyeHeight_m, 'm');
  add('gc', 'Đế BTCT', 'Trọng lượng riêng bê tông', P.gammaConcrete_kNm3, 'kN/m³');
  add('gw', 'Đế BTCT', 'Trọng lượng riêng nước', P.gammaWater_kNm3, 'kN/m³', 'Trọng lượng đế trong nước đã trừ đẩy nổi');
  add('kW', 'Đế BTCT', 'Hệ số trọng lượng đế khi chống nhổ', P.weightFactor, '', 'GIẢ ĐỊNH');
  add('bCu', 'Đế BTCT', 'c_u bùn đáy hồ', P.cuSurface_kPa, 'kPa', 'GIẢ ĐỊNH; dùng cho cả đáy đế và thân vít');
  add('gm', 'Đế BTCT', "γ' bùn", P.gammaSubMud_kNm3, 'kN/m³', 'GIẢ ĐỊNH');
  add('aB', 'Đế BTCT', 'Hệ số bám dính đáy đế', P.alphaBase, '', 'GIẢ ĐỊNH');
  add('skirt', 'Đế BTCT', 'Chiều sâu gờ chống trượt', P.skirtDepth_m, 'm');
  add('hEdge', 'Đế BTCT', 'Tim lỗ vít cách mép đế', P.holeEdge_m, 'm');
  add('sfS', 'Đế BTCT', 'Hệ số an toàn trượt', P.sfSlide, '');
  add('sfO', 'Đế BTCT', 'Hệ số an toàn lật', P.sfOverturn, '');
  add('sfB', 'Đế BTCT', 'Hệ số an toàn nền', P.sfBearing, '');

  add('sN', 'Vít xoắn', 'Số vít mỗi đế', P.screwCount, 'cây');
  add('sD', 'Vít xoắn', 'Đường kính ống', P.tubeDia_m, 'm');
  add('sT', 'Vít xoắn', 'Chiều dày ống', P.tubeThk_m, 'm');
  add('sDr', 'Vít xoắn', 'Đường kính ren', P.threadDia_m, 'm');
  add('sL', 'Vít xoắn', 'Chiều dài ngàm trong bùn', P.screwLength_m, 'm');
  add('aS', 'Vít xoắn', 'Hệ số bám dính thân vít', P.alphaShaft, '', 'GIẢ ĐỊNH');
  add('fy', 'Vít xoắn', 'Giới hạn chảy thép ống', P.fy_kPa, 'kPa');
  add('sfU', 'Vít xoắn', 'Hệ số an toàn nhổ vít', P.sfScrewUplift, '');
  add('sShaft', 'Vít xoắn', 'Ma sát thân vít', { f: `${r('aS')}*${r('bCu')}*PI()*${r('sDr')}*${r('sL')}`, v: g0.screwShaftFriction_kN }, 'kN', 'α c_u π D_ren L');
  add('sSteel', 'Vít xoắn', 'Sức chịu kéo của ống thép', { f: `PI()/4*(${r('sD')}^2-(${r('sD')}-2*${r('sT')})^2)*${r('fy')}`, v: g0.screwSteelTension_kN }, 'kN');
  add('Qu', 'Vít xoắn', 'Sức chịu nhổ cực hạn Q_u', { f: `MIN(${r('sShaft')},${r('sSteel')})`, v: g0.screwQu_kN }, 'kN', 'Không tính cánh xoắn');
  add('Qa', 'Vít xoắn', 'Sức chịu nhổ cho phép Q_a', { f: `${r('Qu')}/${r('sfU')}`, v: g0.screwQa_kN }, 'kN');
  add('sG', 'Vít xoắn', 'Chiều sâu làm việc khi chịu ngang', { f: `${r('sL')}-1.5*${r('sDr')}`, v: P.screwLength_m - 1.5 * P.threadDia_m }, 'm');
  const qa = `(0.02778/(${r('bCu')}*${r('sDr')}))`, qb = `(1.5*${r('sDr')}+0.5*${r('sG')})`, qc = `(-2.25*${r('sDr')}*${r('bCu')}*${r('sG')}^2)`;
  add('HuSoil', 'Vít xoắn', 'Sức chịu ngang theo đất (Broms)', { f: `(-${qb}+SQRT(${qb}^2-4*${qa}*${qc}))/(2*${qa})`, v: g0.screwHuSoil_kN }, 'kN');
  add('Mp', 'Vít xoắn', 'Mô men dẻo của ống thép', { f: `(${r('sD')}^3-(${r('sD')}-2*${r('sT')})^3)/6*${r('fy')}`, v: ((P.tubeDia_m ** 3 - (P.tubeDia_m - 2 * P.tubeThk_m) ** 3) / 6) * P.fy_kPa }, 'kNm');
  const k18 = `(18*${r('bCu')}*${r('sDr')})`;
  add('HuSteel', 'Vít xoắn', 'Sức chịu ngang theo thép ống', { f: `(-1.5*${r('sDr')}+SQRT((1.5*${r('sDr')})^2+4*${r('Mp')}/${k18}))/(2/${k18})`, v: g0.screwHuSteel_kN }, 'kN');
  add('Hu', 'Vít xoắn', 'Sức chịu ngang cực hạn H_u', { f: `MIN(${r('HuSoil')},${r('HuSteel')})`, v: g0.screwHu_kN }, 'kN');

  // ---- line tension -------------------------------------------------------
  const HEAD = 5; // 1-based header row of the three table sheets
  const load: Cell[][] = [
    [`BẢNG TÍNH CÓ CÔNG THỨC — LỰC GIÓ VÀ LỰC CĂNG DÂY — ${d.code}`],
    ['Các cột có chữ (NHẬP) là ô nhập. F pin = q × C_d × A × che chắn; F = (F pin + F phao) × hệ số sóng, dòng chảy; T = max(F × k + T_0 ; F / (n × cos α) + T_0).'],
    [d.windCaveat ? `CHÚ Ý: ${d.windCaveat}` : ''], [''],
    ['BÈ', 'Số tấm pin (NHẬP)', 'Dài bè (m) (NHẬP)', 'Rộng bè (m) (NHẬP)', 'Hệ số tập trung k (NHẬP)', 'Lực đứt cáp (kN) (NHẬP)', 'A đón gió (m²)', 'F pin (kN)', 'F phao (kN)', 'F tổng (kN)',
      'T cách k (kN)', 'T cách n dây (kN)', 'T dây (kN)', 'HSAT cáp', 'KẾT LUẬN', 'Cáp']
  ];
  d.rafts.forEach((x, i) => {
    const n = HEAD + 1 + i;
    for (const c of ['B', 'C', 'D', 'E', 'F']) inputs[S_LOAD].push(`${c}${n}`);
    load.push([
      x.name, x.panels, x.length_m, x.width_m, x.focusFactor, x.mbl_kN,
      { f: `B${n}*${r('A1')}*SIN(RADIANS(${r('tilt')}))`, v: x.areaProjected_m2 },
      { f: `${r('q')}*${r('cdP')}*G${n}*${r('shield')}/1000`, v: x.fPanel_kN },
      { f: `${r('q')}*${r('cdF')}*(C${n}+D${n})/2*MAX(0.05,${r('fb')})/1000`, v: x.fFloat_kN },
      { f: `(H${n}+I${n})*${r('wcf')}`, v: x.fEnv_kN },
      { f: `IF(E${n}>0,J${n}*E${n}+${r('T0')},0)`, v: x.tFocus_kN },
      { f: `J${n}/(${r('n')}*COS(RADIANS(${r('alpha')})))+${r('T0')}`, v: x.tGeometric_kN },
      { f: `MAX(K${n},L${n})`, v: x.tMax_kN },
      { f: `F${n}/M${n}`, v: x.sfIntact },
      { f: `IF(N${n}>=${r('sfC')},"ĐẠT","KHÔNG ĐẠT")`, v: x.sfIntact >= (st.criteria.sfLineIntact ?? 3) ? 'ĐẠT' : 'KHÔNG ĐẠT' },
      x.cable
    ]);
  });
  const loadFirst = HEAD + 1, loadLast = HEAD + d.rafts.length;
  const tOf = (raftCell: string) => `VLOOKUP(${raftCell},${S_LOAD}!$A$${loadFirst}:$M$${loadLast},13,FALSE)`;

  // ---- bored shore pile ---------------------------------------------------
  const pile: Cell[][] = [
    [`BẢNG TÍNH CÓ CÔNG THỨC — CỌC KHOAN NHỒI VEN BỜ — ${d.code}`],
    ['D, L, e, c_u và các hệ số: sheet CT_ThongSo. BP-1: T ≤ H_u / hệ số an toàn. BP-2: γ × M_max ≤ M_rd, với M_max = T × (e + 1,5D + 0,5T/p) và M_rd = A_thanh × R_s × (D/2 − a) × k.'],
    ['k = 2 / tan(π / n) là hệ số tay đòn của n thanh xếp tròn ở hướng bất lợi nhất (lồng thép không định hướng khi thả vào lỗ khoan); công thức đúng cho n chẵn.'], [''],
    ['BÈ', 'Số cọc (NHẬP)', 'Số thanh thép chủ n (NHẬP)', 'Đường kính thanh (mm) (NHẬP)', 'R_s thép (MPa) (NHẬP)', 'T dây (kN)', 'H cho phép (kN)', 'BP-1 ngang', 'M_max (kNm)', 'γ × M_max (kNm)',
      'Hệ số tay đòn k', 'M_rd (kNm)', 'BP-2 uốn', 'KẾT LUẬN', 'Tổng dài cọc (m)', 'Bê tông (m³)']
  ];
  d.rafts.forEach((x, i) => {
    const n = HEAD + 1 + i;
    for (const c of ['B', 'C', 'D', 'E']) inputs[S_PILE].push(`${c}${n}`);
    pile.push([
      x.name, x.pileCount, x.rebarCount, x.rebarDia_mm, x.rebarRs_MPa,
      { f: tOf(`A${n}`), v: x.tMax_kN },
      { f: r('pHa'), v: x.Hallow_kN },
      { f: `F${n}/G${n}`, v: x.bp1 },
      { f: `F${n}*(${r('pE')}+1.5*${r('pD')}+0.5*F${n}/${r('pP')})`, v: x.Mmax_kNm },
      { f: `${r('pGm')}*I${n}`, v: x.loadFactor * x.Mmax_kNm },
      { f: `2/TAN(PI()/C${n})`, v: 2 / Math.tan(Math.PI / x.rebarCount) },
      { f: `PI()*D${n}^2/4/1000000*E${n}*1000*(${r('pD')}/2-${r('pCover')})*K${n}`, v: x.Mrd_kNm },
      { f: `J${n}/L${n}`, v: x.bp2 },
      { f: `IF(AND(H${n}<=1,M${n}<=1),"ĐẠT","KHÔNG ĐẠT")`, v: x.bp1 <= 1 && x.bp2 <= 1 ? 'ĐẠT' : 'KHÔNG ĐẠT' },
      { f: `B${n}*(${r('pL')}+${r('pStick')})`, v: x.pileCount * x.pileLtotal_m },
      { f: `O${n}*PI()*${r('pD')}^2/4`, v: x.pileCount * x.pileLtotal_m * Math.PI * x.pileD_m ** 2 / 4 }
    ]);
  });
  const pEnd = HEAD + d.rafts.length;
  pile.push(['TỔNG', { f: `SUM(B${HEAD + 1}:B${pEnd})`, v: d.totals.shorePiles }, '', '', '', '', '', '', '', '', '', '', '', '',
    { f: `SUM(O${HEAD + 1}:O${pEnd})`, v: d.totals.shoreLength_m }, { f: `SUM(P${HEAD + 1}:P${pEnd})`, v: d.totals.shoreConcrete_m3 }]);

  // ---- screw-pile bases ---------------------------------------------------
  const head: string[] = ['MÃ ĐẾ', 'DÂY 1', 'BÈ 1', 'T 1 (kN)', 'Dài 1 (m) (NHẬP)', 'Phương vị 1 (°) (NHẬP)', 'DÂY 2', 'BÈ 2', 'T 2 (kN)', 'Dài 2 (m) (NHẬP)', 'Phương vị 2 (°) (NHẬP)',
    'Cao độ đáy (m) (NHẬP)', 'B (m) (NHẬP)', 't (m) (NHẬP)', "W' trong nước (kN)", 'Sức chống nhổ (kN)', 'Sức kháng gờ (kN)', 'M giữ (kNm)',
    'MNC: chênh cao tai neo – bích (m)', 'MNC: góc dây 1 (rad)', 'MNC: góc dây 2 (rad)', 'MNLKT: chênh cao tai neo – bích (m)', 'MNLKT: góc dây 1 (rad)', 'MNLKT: góc dây 2 (rad)'];
  const FIX = head.length; // 24 columns before the combinations
  const combos: Array<{ label: string; level: 0 | 1; taut: [boolean, boolean] }> = [];
  for (const level of [0, 1] as const) {
    const lv = level === 0 ? 'MNC' : 'MNLKT';
    combos.push({ label: `${lv}, dây 1 căng`, level, taut: [true, false] });
    combos.push({ label: `${lv}, dây 2 căng`, level, taut: [false, true] });
    combos.push({ label: `${lv}, cả hai căng`, level, taut: [true, true] });
  }
  for (const c of combos) head.push(`${c.label}: T_h (kN)`, `${c.label}: T_v (kN)`, `${c.label}: nhổ`, `${c.label}: trượt`, `${c.label}: lật`, `${c.label}: 1 vít`);
  const SUMC = FIX + combos.length * 6;
  head.push('SV-1 nhổ (lớn nhất)', 'SV-2 trượt (lớn nhất)', 'SV-3 lật (lớn nhất)', 'SV-4 một vít (lớn nhất)', 'SV-5 nền', 'KẾT LUẬN', 'Bê tông (m³)', 'B do web chọn (m)');
  const base: Cell[][] = [
    [`BẢNG TÍNH CÓ CÔNG THỨC — ĐẾ BTCT + VÍT XOẮN TỪNG ĐẾ — ${d.code}`],
    ['Sáu tổ hợp: ở MNC và MNLKT, dây 1 căng + dây 2 ở lực căng trước; ngược lại; cả hai cùng căng. Lực ngang cộng véc-tơ theo phương vị, lực nhổ cộng lại. T 1, T 2 lấy từ CT_LucDay theo tên bè.'],
    ['Cạnh B là ô NHẬP (đã điền cỡ web chọn): Excel không tự tăng B. Nếu đổi thông số mà cột KẾT LUẬN báo KHÔNG ĐẠT thì tăng B từng 0,25 m cho tới khi đạt. Chưa gồm kiểm tra thép bản (SV-6).'], [''],
    head
  ];
  d.schedule.bases.forEach((b, i) => {
    const n = HEAD + 1 + i, [l1, l2] = b.lines, g = b.design;
    const C = (j: number) => `${col(j)}${n}`;
    const row: Cell[] = [];
    const W = `${C(12)}^2*${C(13)}*(${r('gc')}-${r('gw')})`;
    row.push(b.baseId, l1.code, l1.raft, { f: tOf(C(2)), v: l1.tension_kN }, l1.span_m, l1.azimuth_deg,
      l2?.code ?? '-', l2?.raft ?? '-', l2 ? { f: tOf(C(7)), v: l2.tension_kN } : 0, l2?.span_m ?? 1, l2?.azimuth_deg ?? 0,
      b.z, b.side_m, b.thickness_m,
      { f: W, v: g.weightSub_kN },
      { f: `${r('kW')}*${C(14)}+${r('sN')}*${r('Qa')}`, v: g.params.weightFactor * g.weightSub_kN + g.params.screwCount * g.screwQa_kN },
      { f: `${C(12)}*(0.5*${r('gm')}*${r('skirt')}^2+2*${r('bCu')}*${r('skirt')})`, v: g.skirtResistance_kN },
      { f: `${C(14)}*${C(12)}/2+${r('sN')}/2*${r('Qu')}*${C(12)}`, v: g.cases[1].resistingMoment_kNm });
    for (const c of ['E', 'F', 'J', 'K', 'L', 'M', 'N']) inputs[S_BASE].push(`${c}${n}`);
    const rise = [0, 1].map((lv) => Math.max(0, (lv === 0 ? b.depthLow_m : b.depthHigh_m) + g.params.cleatHeight_m - b.thickness_m - g.params.padeyeHeight_m));
    [0, 1].forEach((lv) => {
      const o = 18 + lv * 3;
      row.push({ f: `MAX(0,${lv === 0 ? r('mnc') : r('mnlkt')}-${C(11)}+${r('fb')}-${C(13)}-${r('bPad')})`, v: rise[lv] },
        { f: `ATAN(${C(o)}/MAX(0.1,${C(4)}))`, v: Math.atan(rise[lv] / Math.max(0.1, l1.span_m)) },
        { f: `ATAN(${C(o)}/MAX(0.1,${C(9)}))`, v: Math.atan(rise[lv] / Math.max(0.1, l2?.span_m ?? 1)) });
    });
    combos.forEach((c, k) => {
      const o = FIX + k * 6, a1 = C(19 + c.level * 3), a2 = C(20 + c.level * 3);
      const T1 = c.taut[0] ? C(3) : `MIN(${r('T0')},${C(3)})`, T2 = c.taut[1] ? C(8) : `MIN(${r('T0')},${C(8)})`;
      const h1 = `${T1}*COS(${a1})`, h2 = `${T2}*COS(${a2})`;
      const az1 = `RADIANS(${C(5)})`, az2 = `RADIANS(${C(10)})`;
      // a base under ONE line (4-raft plan, 2026-10-27): the engine checks one combination per level; the sheet keeps
      // its six columns, line 2 pulling nothing, so the values follow the sheet's own reading of each column
      const one = (lv: 0 | 1) => {
        const t = c.taut[0] ? l1.tension_kN : Math.min(R0.pretension_kN ?? 0, l1.tension_kN), a = Math.atan(rise[lv] / Math.max(0.1, l1.span_m));
        return { Th_kN: t * Math.cos(a), Tv_kN: t * Math.sin(a) };
      };
      const eng = l2 ? b.combinations[k] : one(c.level);
      const Th = C(o), Tv = C(o + 1), Wc = C(14), B = C(12);
      const Mo = `(${Th}*(${C(13)}+${r('bPad')})+${Tv}*${B}/2)`;
      // values of this combination, from the engine formulas
      const kWW = g.params.weightFactor * g.weightSub_kN, n4 = g.params.screwCount;
      const adh = g.weightSub_kN > eng.Tv_kN ? g.params.alphaBase * g.params.cuSurface_kPa * b.side_m ** 2 : 0;
      const mo = eng.Th_kN * (b.thickness_m + g.params.padeyeHeight_m) + (eng.Tv_kN * b.side_m) / 2;
      const n1 = Math.max(Math.max(0, eng.Tv_kN - kWW) / n4, Math.max(0, mo - (kWW * b.side_m) / 2) / (b.side_m - g.params.holeEdge_m) / (n4 / 2));
      row.push(
        { f: `SQRT((${h1}*SIN(${az1})+${h2}*SIN(${az2}))^2+(${h1}*COS(${az1})+${h2}*COS(${az2}))^2)`, v: eng.Th_kN },
        { f: `${T1}*SIN(${a1})+${T2}*SIN(${a2})`, v: eng.Tv_kN },
        { f: `${Tv}/${C(15)}`, v: eng.Tv_kN / (kWW + n4 * g.screwQa_kN) },
        { f: `${r('sfS')}*${Th}/(IF(${Wc}>${Tv},${r('aB')}*${r('bCu')}*${B}^2,0)+${C(16)}+${r('sN')}*${r('Hu')})`, v: (g.params.sfSlide * eng.Th_kN) / (adh + g.skirtResistance_kN + n4 * g.screwHu_kN) },
        { f: `${r('sfO')}*${Mo}/${C(17)}`, v: (g.params.sfOverturn * mo) / g.cases[1].resistingMoment_kNm },
        { f: `MAX(MAX(0,${Tv}-${r('kW')}*${Wc})/${r('sN')},MAX(0,${Mo}-${r('kW')}*${Wc}*${B}/2)/(${B}-${r('hEdge')})/(${r('sN')}/2))/${r('Qa')}`, v: n1 / g.screwQa_kN }
      );
    });
    const pick = (off: number) => combos.map((_, k) => C(FIX + k * 6 + off)).join(',');
    row.push(
      { f: `MAX(${pick(2)})`, v: b.upliftUtil }, { f: `MAX(${pick(3)})`, v: b.slideUtil }, { f: `MAX(${pick(4)})`, v: b.overturnUtil }, { f: `MAX(${pick(5)})`, v: b.screwUtil },
      { f: `(${C(14)}/${C(12)}^2)/(5.14*${r('bCu')}/${r('sfB')})`, v: b.bearingUtil },
      { f: `IF(MAX(${C(SUMC)}:${C(SUMC + 4)})<=1,"ĐẠT","KHÔNG ĐẠT")`, v: Math.max(b.upliftUtil, b.slideUtil, b.overturnUtil, b.screwUtil, b.bearingUtil) <= 1 ? 'ĐẠT' : 'KHÔNG ĐẠT' },
      { f: `${C(12)}^2*${C(13)}`, v: g.volume_m3 }, b.side_m
    );
    base.push(row);
  });
  const bEnd = HEAD + d.schedule.bases.length;
  const totalRow: Cell[] = Array(SUMC + 8).fill('');
  totalRow[0] = 'TỔNG';
  totalRow[SUMC + 5] = { f: `COUNTIF(${col(SUMC + 5)}${HEAD + 1}:${col(SUMC + 5)}${bEnd},"ĐẠT")&" / ${d.schedule.bases.length} đế đạt"`, v: `${d.schedule.bases.filter((b) => b.ok).length} / ${d.schedule.bases.length} đế đạt` };
  totalRow[SUMC + 6] = { f: `SUM(${col(SUMC + 6)}${HEAD + 1}:${col(SUMC + 6)}${bEnd})`, v: d.schedule.bases.reduce((s, b) => s + b.design.volume_m3, 0) };
  base.push(totalRow);

  return {
    sheets: [
      { name: S_PAR, ws: toSheet(par, [12, 52, 14, 10, 11, 70]) },
      { name: S_LOAD, ws: toSheet(load, [8, 16, 16, 17, 22, 22, 14, 11, 11, 11, 13, 15, 11, 10, 12, 10]) },
      { name: S_PILE, ws: toSheet(pile, [8, 14, 24, 26, 20, 11, 15, 11, 12, 15, 15, 11, 10, 12, 16, 12]) },
      { name: S_BASE, ws: toSheet(base, [11, 10, 8, 10, 15, 20, 10, 8, 10, 15, 20, 19, 12, 12, ...Array(SUMC + 8 - 14).fill(16)]) }
    ],
    inputs
  };
}
