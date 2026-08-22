import { CheckItem, CheckStatus, CalcResults, ProjectState } from './types';

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
  const { criteria, line, anchor } = state;
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

  if (results.shorePile) {
    const sp = results.shorePile;
    pushPile('BP-1', 'Sức chịu ngang cọc neo BỜ (Broms)', 'H_applied / H_allow ≤ 1.0', sp.utilization_H,
      `H_kéo = ${results.t_max_intact_kN.toFixed(1)} kN, H_cho_phép = ${sp.H_allow.toFixed(1)} kN`);
    pushPile('BP-2', 'Ứng suất uốn tiết diện cọc BỜ', 'M_max / M_rd ≤ 1.0', sp.utilization_M,
      `M_max = ${sp.Mmax.toFixed(1)} kNm, M_rd = ${sp.Mrd.toFixed(1)} kNm`);
  }

  if (results.bedPile1) {
    const bp1 = results.bedPile1;
    pushPile('BP-3', 'Sức chịu ngang cọc LÒNG HỒ (Cách 1)', 'Th / H_allow ≤ 1.0', bp1.utilization_H,
      `Th = ${(results.bedCableTh_kN ?? 0).toFixed(1)} kN, H_all = ${bp1.H_allow.toFixed(1)} kN`);
    pushPile('BP-4', 'Sức chịu NHỔ cọc LÒNG HỒ (ma sát thân)', 'Tv / Q_uplift,all ≤ 1.0', bp1.utilization_Uplift,
      `Tv = ${(results.bedCableTv_kN ?? 0).toFixed(1)} kN, Q_nhổ = ${(bp1.upliftCapacity_all ?? 0).toFixed(1)} kN`);
    pushPile('BP-5', 'Ứng suất uốn tiết diện cọc LÒNG HỒ', 'M_max / M_rd ≤ 1.0', bp1.utilization_M,
      `M_max = ${bp1.Mmax.toFixed(1)} kNm, M_rd = ${bp1.Mrd.toFixed(1)} kNm`);
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
