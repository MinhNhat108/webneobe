import { CheckItem, CheckStatus, CalcResults, ProjectState, PileGoverningCriterion } from './types';

/** Vietnamese label of the criterion that limits a pile's P_max. */
const GOVERNING_LABEL: Record<PileGoverningCriterion, string> = {
  lateral: 'sức chịu tải ngang',
  uplift: 'sức chịu nhổ',
  moment: 'bền uốn tiết diện',
  none: 'không xác định'
};

type Intermediate = Omit<CalcResults, 'checks' | 'overallVerdict' | 'governingCheck'>;

/** Reserve implied by a utilization: +0.25 means 25 % spare capacity. */
function marginFromUtilization(u: number | null): number | null {
  if (u === null || !Number.isFinite(u)) return null;
  if (u <= 0) return null; // no demand at all — a margin is meaningless
  return 1 / u - 1;
}

interface CheckSpec {
  id: string;
  label: string;
  formula: string;
  unit: string;
  threshold: number | string;
  isMandatory: boolean;
}

/** A check that ran: `utilization` is demand/capacity, safe when <= 1. */
function evaluated(spec: CheckSpec, utilization: number, displayActual: string, actual: number | null, note?: string): CheckItem {
  const status: CheckStatus = utilization <= 1.0 ? 'PASS' : 'FAIL';
  return {
    ...spec,
    actual,
    displayActual,
    status,
    utilization,
    margin: marginFromUtilization(utilization),
    note
  };
}

/** The check APPLIES but could not be evaluated — poisons the overall verdict. */
function notEvaluable(spec: CheckSpec, note: string): CheckItem {
  return {
    ...spec,
    actual: null,
    displayActual: 'Không tính được',
    status: 'NA',
    utilization: null,
    margin: null,
    note
  };
}

/** The check does NOT apply to this configuration — visible but neutral. */
function skipped(spec: CheckSpec, note: string): CheckItem {
  return {
    ...spec,
    actual: null,
    displayActual: 'Không áp dụng',
    status: 'SKIP',
    utilization: null,
    margin: null,
    note
  };
}

export function runChecks(
  state: ProjectState,
  results: Intermediate
): { checks: CheckItem[]; overallVerdict: CheckStatus; governingCheck: CheckItem | null } {
  const { criteria, line, anchor, env } = state;
  const checks: CheckItem[] = [];

  const isPileAnchor = anchor.mode === 'pile';
  const catenaryApplies = results.catenaryApplies === true;
  const catenaryNote = results.catenaryNote ?? 'Không áp dụng mô hình catenary cho cấu hình này.';

  // ---- C1 — anchor holding, intact ---------------------------------------
  const c1: CheckSpec = {
    id: 'C1',
    label: 'Sức giữ neo (nguyên vẹn)',
    formula: 'SF = R_total / H_line ≥ [SF]',
    unit: '-',
    threshold: criteria.sfAnchorIntact,
    isMandatory: true
  };
  if (isPileAnchor) {
    checks.push(skipped(c1, 'Neo dạng cọc — sức chịu kiểm tra tại BP-1…BP-5.'));
  } else if (results.totalResistance_kN === null || !(results.h_line_intact_kN > 0)) {
    checks.push(notEvaluable(c1, results.anchorNote ?? 'Thiếu sức giữ neo hoặc lực căng ngang.'));
  } else {
    const sf = results.totalResistance_kN / results.h_line_intact_kN;
    checks.push(evaluated(
      c1,
      criteria.sfAnchorIntact / sf,
      sf.toFixed(2),
      sf,
      `R_total = ${results.totalResistance_kN.toFixed(1)} kN, H_line = ${results.h_line_intact_kN.toFixed(1)} kN`
    ));
  }

  // ---- C2 — line strength, intact ----------------------------------------
  const c2: CheckSpec = {
    id: 'C2',
    label: 'Bền dây/xích neo (nguyên vẹn)',
    formula: 'SF = MBL / T_max ≥ [SF]',
    unit: '-',
    threshold: criteria.sfLineIntact,
    isMandatory: true
  };
  // The line is checked against the SAME tension that loads the anchor.
  const t_max = results.t_max_intact_kN;
  if (!(line.mbl_kN > 0)) {
    checks.push(notEvaluable(c2, 'Chưa nhập MBL của dây/cáp neo.'));
  } else if (!(t_max > 0)) {
    checks.push(notEvaluable(c2, 'Lực căng dây bằng 0 — kiểm tra tải trọng môi trường.'));
  } else {
    const sf = line.mbl_kN / t_max;
    checks.push(evaluated(
      c2,
      criteria.sfLineIntact / sf,
      sf.toFixed(2),
      sf,
      `MBL = ${line.mbl_kN} kN, T_max = ${t_max.toFixed(1)} kN (phương pháp ${results.tensionMethod === 'focus' ? 'hệ số tập trung tải' : 'phân bố hình học'})`
    ));
  }

  // ---- C3 — no uplift at the anchor --------------------------------------
  const minGrounded = line.groundedLengthMin_m ?? 0;
  const c3: CheckSpec = {
    id: 'C3',
    label: 'Không nhổ neo (chiều dài dây nằm đáy)',
    formula: 'L_ground ≥ L_ground,min',
    unit: 'm',
    threshold: `${minGrounded} m`,
    isMandatory: true
  };
  if (isPileAnchor) {
    checks.push(skipped(c3, 'Neo dạng cọc — lực nhổ kiểm tra tại BP-4 (ma sát thân cọc).'));
  } else if (!catenaryApplies) {
    checks.push(skipped(c3, catenaryNote));
  } else if (results.groundedLength_m === null) {
    checks.push(notEvaluable(c3, 'Không tính được chiều dài dây nằm đáy.'));
  } else {
    const lg = results.groundedLength_m;
    // Demand/capacity: how much of the required grounded length is missing.
    const utilization = minGrounded > 0
      ? (lg > 0 ? minGrounded / lg : Number.POSITIVE_INFINITY)
      : (lg >= 0 ? 0 : Number.POSITIVE_INFINITY);
    checks.push(evaluated(
      c3,
      utilization,
      `${lg.toFixed(1)} m`,
      lg,
      lg < 0
        ? `Dây bị kéo căng thẳng: thiếu ${Math.abs(lg).toFixed(1)} m so với đoạn võng cần thiết — neo chịu lực nhổ đứng (uplift).`
        : undefined
    ));
  }

  // ---- C4 — scope ratio ---------------------------------------------------
  const c4: CheckSpec = {
    id: 'C4',
    label: 'Tỷ lệ chiều dài dây / chiều sâu nước (Scope ratio)',
    formula: 'L_total / d ≥ [scope]',
    unit: '-',
    threshold: criteria.minScopeRatio,
    isMandatory: true
  };
  if (isPileAnchor || !catenaryApplies) {
    checks.push(skipped(c4, isPileAnchor
      ? 'Neo dạng cọc — chiều dài dây do hình học mặt bằng quyết định, không theo scope ratio.'
      : catenaryNote));
  } else if (results.scopeRatio === null) {
    checks.push(notEvaluable(c4, 'Thiếu chiều dài dây hoặc chiều sâu nước.'));
  } else {
    const scope = results.scopeRatio;
    const utilization = scope > 0 ? criteria.minScopeRatio / scope : Number.POSITIVE_INFINITY;
    checks.push(evaluated(c4, utilization, scope.toFixed(1), scope,
      `L_total = ${(line.totalLength_m ?? 0).toFixed(1)} m, d = ${(results.verticalDrop_d_m ?? 0).toFixed(1)} m`));
  }

  // ---- C5 — anchor holding, one line lost --------------------------------
  const c5: CheckSpec = {
    id: 'C5',
    label: 'Sức giữ neo (khi đứt 1 dây)',
    formula: 'SF = R_total / H_line,dam ≥ [SF]',
    unit: '-',
    threshold: criteria.sfAnchorDamaged,
    isMandatory: true
  };
  if (isPileAnchor) {
    checks.push(skipped(c5, 'Neo dạng cọc — xem BP-1…BP-5.'));
  } else if (results.totalResistance_kN === null || !(results.h_line_damaged_kN > 0)) {
    checks.push(notEvaluable(c5, results.anchorNote ?? 'Thiếu sức giữ neo hoặc lực căng ngang sự cố.'));
  } else {
    const sf = results.totalResistance_kN / results.h_line_damaged_kN;
    checks.push(evaluated(c5, criteria.sfAnchorDamaged / sf, sf.toFixed(2), sf,
      `H_line,dam = ${results.h_line_damaged_kN.toFixed(1)} kN`));
  }

  // ---- C6 — line strength, one line lost ---------------------------------
  const c6: CheckSpec = {
    id: 'C6',
    label: 'Bền dây/xích neo (khi đứt 1 dây)',
    formula: 'SF = MBL / T_max,dam ≥ [SF]',
    unit: '-',
    threshold: criteria.sfLineDamaged,
    isMandatory: true
  };
  const t_dam = results.t_max_damaged_kN;
  if (!(line.mbl_kN > 0)) {
    checks.push(notEvaluable(c6, 'Chưa nhập MBL của dây/cáp neo.'));
  } else if (!(t_dam > 0)) {
    checks.push(notEvaluable(c6, 'Lực căng dây sự cố bằng 0.'));
  } else {
    const sf = line.mbl_kN / t_dam;
    checks.push(evaluated(c6, criteria.sfLineDamaged / sf, sf.toFixed(2), sf,
      `MBL = ${line.mbl_kN} kN, T_max,dam = ${t_dam.toFixed(1)} kN`));
  }

  // ---- C7 — line length deficit (warning only) ---------------------------
  const maxOffset = criteria.maxOffset_m ?? 0;
  const c7: CheckSpec = {
    id: 'C7',
    label: 'Độ thiếu chiều dài dây neo',
    formula: 'X_deficit ≤ [maxOffset]',
    unit: 'm',
    threshold: `≤ ${maxOffset} m`,
    isMandatory: false
  };
  if (isPileAnchor || !catenaryApplies) {
    checks.push(skipped(c7, isPileAnchor ? 'Neo dạng cọc — không có đoạn dây dự trữ nằm đáy.' : catenaryNote));
  } else if (results.lengthDeficit_m === null) {
    checks.push(notEvaluable(c7, 'Không tính được độ thiếu chiều dài dây.'));
  } else {
    const deficit = results.lengthDeficit_m;
    const utilization = maxOffset > 0
      ? deficit / maxOffset
      : (deficit > 0 ? Number.POSITIVE_INFINITY : 0);
    checks.push(evaluated(c7, utilization, `${deficit.toFixed(2)} m`, deficit,
      deficit > 0
        ? `Cần bổ sung tối thiểu ${deficit.toFixed(2)} m chiều dài dây.`
        : 'Đủ chiều dài dây dự trữ nằm đáy.'));
  }

  // ---- C8 — safe clearance between raft draft and the lake bed ----------
  // Threshold priority: an explicit criteria override, else the design
  // requirement entered on the Environment form ("Độ sâu tối thiểu cần dưới
  // đáy bè"), else the 1.0 m default from the spec.
  const minClearance = criteria.minBedClearance_m ?? env.minWaterDepthUnderRaft_m ?? 1.0;
  const c8: CheckSpec = {
    id: 'C8',
    label: 'Khoảng hở an toàn đáy bè – đáy hồ',
    formula: 'Clearance = h_nước − mớn nước bè ≥ [min]',
    unit: 'm',
    threshold: `≥ ${minClearance} m`,
    isMandatory: true
  };
  if (results.bedClearance_m === null) {
    checks.push(notEvaluable(c8, 'Thiếu độ sâu nước hoặc mớn nước bè.'));
  } else {
    const clearance = results.bedClearance_m;
    const utilization = clearance > 0
      ? minClearance / clearance
      : Number.POSITIVE_INFINITY;
    checks.push(evaluated(c8, utilization, `${clearance.toFixed(2)} m`, clearance,
      clearance < minClearance
        ? `Đáy bè chỉ còn cách đáy hồ ${clearance.toFixed(2)} m — nguy cơ chạm đáy khi mực nước xuống thấp.`
        : undefined));
  }

  // ---- C9 — average mooring-line spacing around the raft perimeter ----------
  // Mandatory since the V2 layout: every raft carries N >= ceil(P / 15) lines
  // (304 in total), so a C9 failure is a real design defect, not a warning.
  const maxSpacing = criteria.maxLineSpacing_m ?? 15.0;
  const c9: CheckSpec = {
    id: 'C9',
    label: 'Khoảng cách trung bình giữa các dây neo',
    formula: 'P_bè / N_dây ≤ [maxSpacing]',
    unit: 'm',
    threshold: `≤ ${maxSpacing} m`,
    isMandatory: true
  };
  if (results.avgLineSpacing_m === null) {
    checks.push(notEvaluable(c9, 'Thiếu chu vi bè hoặc số lượng dây neo.'));
  } else {
    const spacing = results.avgLineSpacing_m;
    const utilization = maxSpacing > 0 ? spacing / maxSpacing : Number.POSITIVE_INFINITY;
    checks.push(evaluated(c9, utilization, `${spacing.toFixed(1)} m`, spacing,
      spacing > maxSpacing
        ? `Khoảng cách dây neo trung bình ${spacing.toFixed(1)} m vượt khuyến nghị — cân nhắc bổ sung dây neo.`
        : undefined));
  }

  // ---- C10 — T_dây <= P_max (rated allowable pile holding capacity) -------
  // Only EVALUATED when the user supplied a rated P_max for that pile
  // (catalogue value or pull-out test). Without one there is no independent
  // capacity to check against — the computed Broms capacity is already
  // covered by BP-1..BP-5 — so the row is SKIPped rather than duplicating
  // those checks under a new id.
  const pushPmax = (
    id: string,
    label: string,
    opt: typeof results.shorePileOpt
  ) => {
    const spec: CheckSpec = {
      id,
      label,
      formula: 'P_req = T_dây × SF ≤ P_max',
      unit: 'kN',
      threshold: opt?.ratedPmax_kN !== undefined ? `≤ ${opt.ratedPmax_kN} kN` : '≤ P_max',
      isMandatory: true
    };
    if (!opt) {
      checks.push(skipped(spec, 'Không dùng cọc neo cho cấu hình này.'));
      return;
    }
    if (opt.ratedPmax_kN === undefined) {
      checks.push(
        skipped(
          spec,
          `Chưa nhập P_max định mức của cọc. Sức chịu tải tính toán theo Broms tại L_opt = ` +
            `${opt.L_opt_m ?? '—'} m là ${opt.capacity.Pmax_kN} kN ` +
            `(chi phối: ${GOVERNING_LABEL[opt.capacity.governing]}).`
        )
      );
      return;
    }
    if (!Number.isFinite(opt.utilization_Pmax)) {
      checks.push(notEvaluable(spec, 'P_max không hợp lệ (≤ 0).'));
      return;
    }
    checks.push(
      evaluated(
        spec,
        opt.utilization_Pmax,
        `${opt.Preq_kN} / ${opt.effectivePmax_kN}`,
        opt.Preq_kN,
        `T_dây = ${opt.cableTension_kN} kN, SF = ${opt.sfPileCapacity}, ` +
          `P_max dùng để kiểm tra = ${opt.effectivePmax_kN} kN ` +
          `(định mức ${opt.ratedPmax_kN} kN, tính toán Broms ${opt.capacity.Pmax_kN} kN).`
      )
    );
  };

  // PA2: the lake-bed anchors are gravity blocks, so the lake-bed PILE rows
  // (C11, BP-3..BP-5) do not apply and DW-1..DW-4 take their place.
  const block = results.bedBlock;
  const base = results.bedScrewBase;
  const NOT_PILE = base
    ? 'Không áp dụng (neo đáy hồ bằng đế BTCT + vít xoắn, xem SV-1…SV-6).'
    : 'Không áp dụng (PA2: neo đáy hồ bằng khối bê tông trọng lực, xem DW-1…DW-4).';

  if (results.shorePileOpt || results.bedPileOpt) {
    pushPmax('C10', 'Sức chịu tải cho phép của cọc BỜ (P_max)', results.shorePileOpt);
    if (block || base) {
      checks.push(skipped({
        id: 'C11', label: 'Sức chịu tải cho phép của cọc LÒNG HỒ (P_max)', formula: 'P_req = T_dây × SF ≤ P_max',
        unit: 'kN', threshold: '≤ P_max', isMandatory: true
      }, NOT_PILE));
    } else {
      pushPmax('C11', 'Sức chịu tải cho phép của cọc LÒNG HỒ (P_max)', results.bedPileOpt);
    }
  }

  // ---- Broms pile checks --------------------------------------------------
  const pushPile = (
    id: string,
    label: string,
    formula: string,
    utilization: number | undefined,
    note: string
  ) => {
    const spec: CheckSpec = { id, label, formula, unit: '-', threshold: '≤ 1.0', isMandatory: true };
    if (utilization === undefined || !Number.isFinite(utilization)) {
      checks.push(notEvaluable(spec, note));
      return;
    }
    checks.push(evaluated(spec, utilization, utilization.toFixed(3), utilization, note));
  };

  // Several piles under one anchor point: each row above is for ONE pile.
  const group = (n?: number) =>
    (n ?? 1) > 1
      ? ` (cụm ${n} cọc đặt cạnh nhau, mỗi cọc chịu T / (${n} × ${anchor.pileGroupEfficiency ?? 0.9}))`
      : '';
  const bedShare = results.t_max_intact_kN > 0 && results.bedPileTension_kN !== undefined
    ? results.bedPileTension_kN / results.t_max_intact_kN
    : 1;
  const bars = (n?: number, dia?: number) =>
    (n ?? 0) > 0 && (dia ?? 0) > 0
      ? `${n}Φ${dia} mặt chịu kéo, Rs = ${anchor.pileRebarRs_MPa ?? 350} MPa`
      : 'KHÔNG cốt thép: M_rd = Rbt·W';

  if (results.shorePile) {
    const sp = results.shorePile;
    pushPile('BP-1', 'Sức chịu ngang cọc neo BỜ (Broms)', 'H_applied / H_allow ≤ 1.0', sp.utilization_H,
      `H_kéo = ${(results.shorePileTension_kN ?? results.t_max_intact_kN).toFixed(1)} kN / cọc${group(anchor.shorePilesPerPoint)}, H_cho_phép = ${sp.H_allow.toFixed(1)} kN`);
    pushPile('BP-2', 'Uốn tiết diện cọc BỜ (TCVN 5574:2018)', 'γ·M_max / M_rd ≤ 1.0', sp.utilization_M,
      `M_max = ${sp.Mmax.toFixed(1)} kNm, γ = ${anchor.pileBendingLoadFactor ?? 1.2}, M_rd = ${sp.Mrd.toFixed(1)} kNm ` +
        `(${bars(anchor.shoreRebarFaceCount, anchor.shoreRebarDia_mm)})`);
  }

  if (block || base) {
    for (const [id, label, formula] of [
      ['BP-3', 'Sức chịu ngang cọc LÒNG HỒ (Cách 1)', 'Th / H_allow ≤ 1.0'],
      ['BP-4', 'Sức chịu NHỔ cọc LÒNG HỒ (ma sát thân)', 'Tv / Q_uplift,all ≤ 1.0'],
      ['BP-5', 'Ứng suất uốn tiết diện cọc LÒNG HỒ', 'M_max / M_rd ≤ 1.0']
    ] as const) {
      checks.push(skipped({ id, label, formula, unit: '-', threshold: '≤ 1.0', isMandatory: true }, NOT_PILE));
    }

  }
  if (base) {
    const p = base.params;
    const [low, high] = base.cases;
    const dims = `Đế ${base.side_m.toFixed(2)} × ${base.side_m.toFixed(2)} × ${base.thickness_m.toFixed(2)} m, W' = ${base.weightSub_kN.toFixed(1)} kN, ` +
      `${p.screwCount} vít Ø${Math.round(p.tubeDia_m * 1000)}×${Math.round(p.tubeThk_m * 1000)} dài ${p.screwLength_m} m` +
      (base.enlarged ? ' (đế đã được TĂNG kích thước so với đế mẫu 2,5 × 2,5 × 0,4 m để đạt)' : '');
    const both = (f: (c: typeof low) => string) => `MN thấp: ${f(low)}; MN cao: ${f(high)}`;
    const pushU = (id: string, label: string, formula: string, util: number, note: string) => {
      const spec: CheckSpec = { id, label, formula, unit: '-', threshold: '≤ 1.0', isMandatory: true };
      if (!Number.isFinite(util)) { checks.push(evaluated(spec, Infinity, '∞', null, note)); return; }
      checks.push(evaluated(spec, util, util.toFixed(3), util, note));
    };
    pushU('SV-1', 'Đế vít xoắn — chống NHỔ', "Tv / (0,9·W' + n·Q_a) ≤ 1.0", base.upliftUtil,
      `${both((c) => `Tv = ${c.Tv_kN.toFixed(1)} kN (góc cáp ${c.angle_deg.toFixed(1)}°)`)}. Sức chống nhổ ${low.upliftResistance_kN.toFixed(1)} kN, ` +
        `Q_a một vít = ${base.screwQa_kN.toFixed(1)} kN (FS = ${p.sfScrewUplift}). ${dims}`);
    pushU('SV-2', 'Đế vít xoắn — chống TRƯỢT', `${p.sfSlide}·Th / (α·c_u·B² + R_gờ + n·H_u) ≤ 1.0`, base.slideUtil,
      `${both((c) => `Th = ${c.Th_kN.toFixed(1)} kN, sức chống ${c.slideResistance_kN.toFixed(1)} kN${c.adhesion_kN === 0 ? ' (đế bị nhấc, MẤT bám dính đáy)' : ''}`)}. ` +
        `c_u = ${p.cuSurface_kPa} kPa (GIẢ ĐỊNH), α = ${p.alphaBase}, gờ sâu ${p.skirtDepth_m} m, H_u một vít = ${base.screwHu_kN.toFixed(1)} kN.`);
    pushU('SV-3', 'Đế vít xoắn — chống LẬT', `${p.sfOverturn}·M_o / M_r ≤ 1.0`, base.overturnUtil,
      `${both((c) => `M_o = ${c.overturningMoment_kNm.toFixed(1)} kNm`)}; M_r = ${low.resistingMoment_kNm.toFixed(1)} kNm (quay quanh mép đáy phía xa dây).`);
    pushU('SV-4', 'Đế vít xoắn — lực nhổ một vít', 'N_1 / Q_a ≤ 1.0', base.screwUtil,
      `${both((c) => `N_1 = ${c.screwPull_kN.toFixed(1)} kN`)}; Q_a = ${base.screwQa_kN.toFixed(1)} kN (ma sát thân ${base.screwShaftFriction_kN.toFixed(1)} kN / FS ${p.sfScrewUplift}).`);
    const qSpec: CheckSpec = {
      id: 'SV-5', label: 'Đế vít xoắn — áp lực lên nền bùn', formula: `W'/B² ≤ 5,14·c_u / ${p.sfBearing}`, unit: 'kPa',
      threshold: `≤ ${base.bearingAllow_kPa.toFixed(1)} kPa`, isMandatory: true
    };
    checks.push(evaluated(qSpec, base.bearingUtil, base.bearingPressure_kPa.toFixed(1), base.bearingPressure_kPa,
      'c_u bùn là giá trị giả định, chưa có khảo sát đáy hồ; chưa tính lún.'));
    pushU('SV-6', 'Đế vít xoắn — cốt thép bản đế', 'max(A_s yc ; 0,1%) / A_s bố trí ≤ 1.0', base.rebarUtil,
      `Lưới 2 lớp Ø${base.rebarDia_mm} a${Math.round(base.rebarSpacing_m * 1000)} hai phương: ${base.rebarProvided_mm2.toFixed(0)} mm²/m; yêu cầu ${Math.max(base.rebarRequired_mm2, base.rebarMin_mm2).toFixed(0)} mm²/m.` +
        (base.holeFits ? '' : ' CẢNH BÁO: vít KHÔNG lọt lỗ chờ.'));
  }
  if (block) {
    // A safety factor check: utilisation = required / achieved.
    const p = block.params;
    const dims = `Khối ${block.L_m.toFixed(2)} × ${block.W_m.toFixed(2)} × ${block.H_m.toFixed(2)} m, W = ${block.mass_t.toFixed(1)} T, W_sub = ${block.weightSub_kN.toFixed(1)} kN`;
    const pushSf = (id: string, label: string, formula: string, sf: number, req: number, note: string) => {
      const spec: CheckSpec = { id, label, formula, unit: '-', threshold: `≥ ${req}`, isMandatory: true };
      if (!(sf > 0)) {
        checks.push(evaluated(spec, Infinity, '0', 0, note));
        return;
      }
      checks.push(evaluated(spec, req / sf, Number.isFinite(sf) ? sf.toFixed(2) : '∞', Number.isFinite(sf) ? sf : null, note));
    };
    if (p.slidingModel === 'shear_key') {
      pushSf('DW-1', 'Khối bê tông neo đáy — ổn định chống TRƯỢT (gờ chống trượt)', 'SF = (c_u·A + 2·c_u·z_s·B) / H', block.sfSlide, p.sfSlide,
        `c_u bùn mặt = ${p.cuSurface_kPa} kPa (GIẢ ĐỊNH), gờ sâu z_s = ${p.keyDepth_m} m, sức kháng = ${block.slideResistance_kN.toFixed(1)} kN, ` +
          `H = ${block.H_kN.toFixed(1)} kN, V = ${block.V_kN.toFixed(1)} kN. ${dims}`);
    } else {
      pushSf('DW-1', 'Khối bê tông neo đáy — ổn định chống TRƯỢT', 'SF = μ·(W_sub − V) / H', block.sfSlide, p.sfSlide,
        `μ = ${p.mu}, H = ${block.H_kN.toFixed(1)} kN, V = ${block.V_kN.toFixed(1)} kN. ${dims}`);
    }
    pushSf('DW-2', 'Khối bê tông neo đáy — ổn định chống NHẤC BỔNG', 'SF = W_sub / V', block.sfUplift, p.sfUplift,
      `V = ${block.V_kN.toFixed(1)} kN, W_sub = ${block.weightSub_kN.toFixed(1)} kN`);
    pushSf('DW-3', 'Khối bê tông neo đáy — ổn định chống LẬT', 'SF = (W_sub − V)·(L/2) / (H·h_tie)', block.sfOverturn, p.sfOverturn,
      `Tai neo cáp đặt cao h_tie = ${Math.min(p.tieHeight_m, block.H_m).toFixed(2)} m trên đáy khối (yêu cầu cấu tạo).`);
    const qSpec: CheckSpec = {
      id: 'DW-4', label: 'Khối bê tông neo đáy — áp lực lên nền bùn đáy hồ',
      formula: 'q = max(W_sub/A ; áp lực mép khi chịu tải) ≤ q_allow', unit: 'kPa', threshold: `≤ ${p.qAllow_kPa} kPa`, isMandatory: true
    };
    checks.push(evaluated(
      qSpec,
      block.qContact_kPa / p.qAllow_kPa,
      Number.isFinite(block.qContact_kPa) ? block.qContact_kPa.toFixed(1) : '∞',
      Number.isFinite(block.qContact_kPa) ? block.qContact_kPa : null,
      `Nước lặng: ${block.qStatic_kPa.toFixed(1)} kPa; mép khối khi chịu tải: ${Number.isFinite(block.qEdge_kPa) ? block.qEdge_kPa.toFixed(1) : '∞'} kPa. ` +
        'q_allow là giá trị giả định, chưa có khảo sát địa chất đáy hồ; chưa tính lún.' +
        (block.bearingGovernsShape ? ' Khối đã được mở rộng đáy để giảm áp lực nền.' : '')
    ));
  } else if (!base && results.bedPile1) {
    const bp1 = results.bedPile1;
    pushPile('BP-3', 'Sức chịu ngang cọc LÒNG HỒ (Cách 1)', 'Th / H_allow ≤ 1.0', bp1.utilization_H,
      `Th = ${((results.bedCableTh_kN ?? 0) * bedShare).toFixed(1)} kN / cọc${group(anchor.bedPilesPerPoint)}, H_all = ${bp1.H_allow.toFixed(1)} kN`);
    pushPile('BP-4', 'Sức chịu NHỔ cọc LÒNG HỒ (ma sát thân)', 'Tv / Q_uplift,all ≤ 1.0', bp1.utilization_Uplift,
      `Tv = ${((results.bedCableTv_kN ?? 0) * bedShare).toFixed(1)} kN / cọc, Q_nhổ = ${(bp1.upliftCapacity_all ?? 0).toFixed(1)} kN`);
    pushPile('BP-5', 'Uốn tiết diện cọc LÒNG HỒ (TCVN 5574:2018)', 'γ·M_max / M_rd ≤ 1.0', bp1.utilization_M,
      `M_max = ${bp1.Mmax.toFixed(1)} kNm, γ = ${anchor.pileBendingLoadFactor ?? 1.2}, M_rd = ${bp1.Mrd.toFixed(1)} kNm ` +
        `(${bars(anchor.bedRebarFaceCount, anchor.bedRebarDia_mm)})`);
  }

  // ---- Overall verdict ----------------------------------------------------
  // FAIL beats NA beats PASS. SKIP is neutral, but if EVERY mandatory check is
  // skipped then nothing was actually verified and the verdict is NA, never PASS.
  const mandatory = checks.filter((c) => c.isMandatory);
  const hasFail = mandatory.some((c) => c.status === 'FAIL');
  const hasNA = mandatory.some((c) => c.status === 'NA');
  const anyEvaluated = mandatory.some((c) => c.status === 'PASS' || c.status === 'FAIL');

  let overallVerdict: CheckStatus;
  if (hasFail) overallVerdict = 'FAIL';
  else if (hasNA || !anyEvaluated) overallVerdict = 'NA';
  else overallVerdict = 'PASS';

  // Governing check = the worst utilization. Failures first, then the tightest
  // mandatory check; a non-mandatory row can only govern if nothing else ran.
  const byWorst = (pool: CheckItem[]): CheckItem | null =>
    pool
      .filter((c) => c.utilization !== null && Number.isFinite(c.utilization))
      .sort((a, b) => (b.utilization as number) - (a.utilization as number))[0] ?? null;

  const governingCheck =
    byWorst(mandatory.filter((c) => c.status === 'FAIL')) ??
    byWorst(mandatory) ??
    byWorst(checks);

  return { checks, overallVerdict, governingCheck };
}
