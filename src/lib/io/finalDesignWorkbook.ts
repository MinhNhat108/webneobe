import * as XLSX from 'xlsx';
import type { CalcResults, CheckItem, ProjectState } from '../calc/types';
import { designWindCaveat } from '../calc/designWind';
import { calculateCostEstimate, DEFAULT_COST_PARAMS, type CostEstimateSummary, type CostParams } from '../calc/costEstimate';
import type { PileScheduleBatchLike, PileScheduleRow } from './pileSchedule';
import { buildScrewBaseSchedule, type ScrewBaseRow, type ScrewBaseSchedule } from './screwBaseSchedule';
import { buildAnchorPointSchedule, type AnchorPointSchedule, type ShorePointRow } from './anchorPointSchedule';
import { buildCableCuttingSchedule, appendCableCuttingSheet } from './cableCuttingSchedule';
import { buildLiveCalcSheets, LIVE_SHEETS } from './liveCalcSheets';
import { STANDBY_SLACK_M, type EqResult } from '../calc/mooringEquilibrium';
import { lakeCaveats } from '../../data/lakeCaveats';
import { DEFAULT_REBAR_COVER_MM } from '../calc/broms';
import { ACTIVE_LAKE_ID } from '../../data/lakes';
import { obliqueShoreLines } from '../../data/huoiVanhLayout';
import { calculateProject } from '../calc';
import { lightShorePileState } from '../calc/raftState';

/**
 * The calculation workbook and the calculation note of the design the owner
 * settled on 2026-10-12: bored piles D350 on the shore + RC bases held by screw
 * piles on the lake bed.
 *
 * One builder (`buildFinalDesign`) feeds the Excel workbook, the note on the web
 * (report tab) and the quotation sheet, so the three can never disagree. Every
 * number comes from the engine and the schedules; nothing is typed in here.
 */

/** The lake-bed option the owner settled on, and the date of the decision. */
export const FINAL_MOORING_OPTION = 'PA3_SCREW_BASE' as const;
export const FINAL_OPTION_DATE = '12/10/2026';
export const FINAL_OPTION_TITLE = 'Cọc khoan nhồi D350 ven bờ + đế BTCT giữ bằng vít xoắn dưới đáy hồ';

/** One shore pile type of a raft: its own pile, or the lighter single pile of the points whose line pulls less. */
export interface PileTypeRow {
  /** The raft's lighter single pile (catalogue `shorePileLight`). */
  light: boolean;
  points: number;
  piles: number;
  perPoint: number;
  D_m: number;
  L_m: number;
  Ltotal_m: number;
  cage: string;
  grade: string;
  stirrup: string;
  /** Design line tension of the type, kN, and the load on one pile, kN. */
  tension_kN: number;
  pileLoad_kN: number;
  Hu_kN: number;
  Hallow_kN: number;
  bp1: number;
  Mmax_kNm: number;
  Mrd_kNm: number;
  bp2: number;
  Pmax_kN: number;
  concretePerPile_m3: number;
  steelPerPile_kg: number;
}

export interface FinalRaftRow {
  name: string;
  area_m2: number;
  perimeter_m: number;
  lines: number;
  shoreLines: number;
  bedLines: number;
  /** Bounding rectangle of the raft, m (the float windage uses their mean). */
  length_m: number;
  width_m: number;
  cdFloat: number;
  freeboard_m: number;
  panels: number;
  panelArea_m2: number;
  tilt_deg: number;
  cdPanel: number;
  shield: number;
  /** Projected panel area, m². */
  areaProjected_m2: number;
  q_Pa: number;
  fPanel_kN: number;
  fFloat_kN: number;
  fWind_kN: number;
  waveCurrentFactor: number;
  fEnv_kN: number;
  focusFactor: number;
  nEff: number;
  alpha_deg: number;
  pretension_kN: number;
  tFocus_kN: number;
  tGeometric_kN: number;
  method: 'focus' | 'geometric' | 'equilibrium';
  /** Hồ Bản Mòng: the equilibrium analysis of the raft on its real lines. */
  analysis?: EqResult;
  tMax_kN: number;
  tDamaged_kN: number;
  cable: string;
  mbl_kN: number;
  sfIntact: number;
  sfDamaged: number;
  // shore pile of the raft (the first pile type; `pileTypes` holds every type, `pileCount` / `pileLength_m` all piles)
  pileTypes: PileTypeRow[];
  pileLength_m: number;
  pileCount: number;
  pileD_m: number;
  pileL_m: number;
  pileLtotal_m: number;
  cage: string;
  grade: string;
  stirrup: string;
  /** Main bars of the round cage: count, diameter (mm) and design strength (MPa). */
  rebarCount: number;
  rebarDia_mm: number;
  rebarRs_MPa: number;
  Hu_kN: number;
  Hallow_kN: number;
  bp1: number;
  Mmax_kNm: number;
  loadFactor: number;
  Mrd_kNm: number;
  bp2: number;
  Pmax_kN: number;
  /** Bank soil strength, pin height above the ground, face-to-bar-centre cover and the load on ONE pile (twin points share T). */
  cuShore_kPa: number;
  arm_m: number;
  cover_mm: number;
  pileLoad_kN: number;
  /** C8 clearance under the raft and its limit; C9 mean line spacing and its limit, m. */
  bedClearance_m: number | null;
  minClearance_m: number;
  lineSpacing_m: number | null;
  maxSpacing_m: number;
  /** Rope stiffness EA of the equilibrium analysis, kN. */
  ea_kN: number;
  concretePerPile_m3: number;
  steelPerPile_kg: number;
  verdict: string;
  /** The check table of the raft (the "Hạng mục kiểm tra" of the web), explained in note section 9. */
  checks: CheckItem[];
}

export interface FinalDesign {
  code: string;
  name: string;
  wind_ms: number;
  windCaveat: string | null;
  rafts: FinalRaftRow[];
  /** Soil / pile / cable parameters shared by every raft (from the first raft's state). */
  state: ProjectState;
  schedule: ScrewBaseSchedule;
  points: AnchorPointSchedule;
  totals: {
    lines: number;
    shorePiles: number;
    shoreLength_m: number;
    shoreConcrete_m3: number;
    shoreSteel_kg: number;
    bases: number;
    baseConcrete_m3: number;
    baseRebar_kg: number;
    screws: number;
    screwLength_m: number;
    maxLift_t: number;
    upliftDemand_kN: number;
    upliftResistance_kN: number;
    worst: { uplift: number; slide: number; overturn: number; screw: number };
    allOk: boolean;
  };
  cost: CostEstimateSummary;
  costParams: CostParams;
}

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

export function buildFinalDesign(
  state: ProjectState,
  results: CalcResults,
  batch: PileScheduleBatchLike[],
  costParams?: CostParams
): FinalDesign {
  const schedule = buildScrewBaseSchedule(state, results, batch);
  const points = buildAnchorPointSchedule(state, results, batch);
  const shoreRows = schedule.shorePiles;
  const rafts: FinalRaftRow[] = batch.map((b) => {
    const st = b.state ?? state, r = b.results, R = st.raft, L = st.line, A = st.anchor;
    const own = shoreRows.filter((p) => p.raft === b.raft.name);
    const pileTypes = [false, true].flatMap((light): PileTypeRow[] => {
      const rows = own.filter((p) => p.light === light);
      if (!rows.length) return [];
      const q = rows[0], rr = light ? calculateProject(lightShorePileState(st, b.raft.shorePileLight!)) : r, s = rr.shorePile;
      const piles = sum(rows, (p) => p.pileCount);
      return [{
        light, points: rows.length, piles, perPoint: Math.round(piles / rows.length), D_m: q.D_m, L_m: q.Linput_m, Ltotal_m: q.Ltotal_m,
        cage: q.cage.label, grade: q.cage.grade, stirrup: q.cage.stirrupLabel, tension_kN: q.Tmax_kN, pileLoad_kN: rr.shorePileTension_kN ?? q.Tmax_kN,
        Hu_kN: s?.Hu ?? 0, Hallow_kN: s?.H_allow ?? 0, bp1: s?.utilization_H ?? 0, Mmax_kNm: s?.Mmax ?? 0, Mrd_kNm: s?.Mrd ?? 0, bp2: s?.utilization_M ?? 0,
        Pmax_kN: q.Pmax_kN, concretePerPile_m3: q.cage.concreteVol_m3, steelPerPile_kg: q.cage.steel_kg
      }];
    });
    const p0: PileScheduleRow | undefined = own.find((p) => !p.light) ?? own[0];
    // the raft's checks are those of the pile type of p0: when every line takes the single pile (BÈ 4 at 10°: the
    // raft's twin pile is sized for the floor F/(6 cos 30°), no line pulls that much) its BP-1 / BP-2 are the single pile's
    const gov = pileTypes.find((t) => !t.light) ?? pileTypes[0];
    const panels = R.solarPanelCount ?? 0, a1 = R.solarPanelArea_m2 ?? 2.701, tilt = R.solarTilt_deg ?? 12;
    const sp = r.shorePile;
    const bedLines = sum(schedule.bases, (x) => x.lines.filter((l) => l.raft === b.raft.name).length);
    return {
      name: b.raft.name, area_m2: b.raft.area_m2 ?? 0, perimeter_m: R.perimeter_m ?? 0,
      lines: L.count ?? 0, shoreLines: own.length, bedLines,
      length_m: R.length_m ?? 0, width_m: R.width_m ?? 0, cdFloat: R.cdFloat ?? 1.1, freeboard_m: R.freeboardHeight_m ?? 0.35,
      panels, panelArea_m2: a1, tilt_deg: tilt, cdPanel: R.cdPanel ?? st.env.windCd ?? 1.3, shield: R.solarShieldFactor ?? 0.55,
      areaProjected_m2: panels * a1 * Math.sin((tilt * Math.PI) / 180),
      q_Pa: r.q_wind_Pa, fPanel_kN: r.f_wind_panel_kN ?? 0, fFloat_kN: r.f_wind_float_kN ?? 0, fWind_kN: r.f_wind_total_kN,
      waveCurrentFactor: st.env.waveCurrentFactor ?? 1.05, fEnv_kN: r.f_env_total_kN,
      focusFactor: L.focusFactor ?? 0, nEff: L.effectiveCount ?? 1, alpha_deg: L.horizontalAngle_deg ?? 30, pretension_kN: L.pretension_kN ?? 0,
      tFocus_kN: r.t_focus_kN, tGeometric_kN: r.t_geometric_kN, method: r.tensionMethod, analysis: r.mooringAnalysis, tMax_kN: r.t_max_intact_kN, tDamaged_kN: r.t_max_damaged_kN,
      cable: L.cableCode ?? '', mbl_kN: L.mbl_kN, sfIntact: L.mbl_kN / r.t_max_intact_kN, sfDamaged: L.mbl_kN / r.t_max_damaged_kN,
      pileTypes, pileLength_m: sum(own, (p) => p.pileCount * p.Ltotal_m),
      pileCount: sum(own, (p) => p.pileCount), pileD_m: p0?.D_m ?? A.shoreD_m ?? 0.35, pileL_m: p0?.Linput_m ?? A.shoreL_m ?? 6.5, pileLtotal_m: p0?.Ltotal_m ?? 0,
      cage: p0?.cage.label ?? '-', grade: p0?.cage.grade ?? '-', stirrup: p0?.cage.stirrupLabel ?? '-',
      rebarCount: p0?.cage.totalBars ?? 0, rebarDia_mm: p0?.rebarDia_mm ?? 0, rebarRs_MPa: gov?.light ? b.raft.shorePileLight!.pileRebarRs_MPa : A.pileRebarRs_MPa ?? 350,
      Hu_kN: gov?.Hu_kN ?? sp?.Hu ?? 0, Hallow_kN: gov?.Hallow_kN ?? sp?.H_allow ?? 0, bp1: gov?.bp1 ?? sp?.utilization_H ?? 0,
      Mmax_kNm: gov?.Mmax_kNm ?? sp?.Mmax ?? 0, loadFactor: A.pileBendingLoadFactor ?? 1.2, Mrd_kNm: gov?.Mrd_kNm ?? sp?.Mrd ?? 0, bp2: gov?.bp2 ?? sp?.utilization_M ?? 0,
      Pmax_kN: p0?.Pmax_kN ?? 0,
      cuShore_kPa: A.cuShore_kPa ?? 40, arm_m: A.shoreArm_e_m ?? 0.1, cover_mm: A.pileRebarCover_mm ?? DEFAULT_REBAR_COVER_MM,
      pileLoad_kN: gov?.pileLoad_kN ?? r.shorePileTension_kN ?? r.t_max_intact_kN,
      bedClearance_m: r.bedClearance_m, minClearance_m: st.criteria.minBedClearance_m ?? st.env.minWaterDepthUnderRaft_m ?? 1.0,
      lineSpacing_m: r.avgLineSpacing_m, maxSpacing_m: st.criteria.maxLineSpacing_m ?? 15,
      ea_kN: (L.eaPerMbl ?? 15) * L.mbl_kN,
      concretePerPile_m3: p0?.cage.concreteVol_m3 ?? 0, steelPerPile_kg: p0?.cage.steel_kg ?? 0,
      verdict: r.overallVerdict,
      checks: r.checks
    };
  });

  const params = { ...DEFAULT_COST_PARAMS, ...(costParams ?? {}) };
  const cost = calculateCostEstimate(params, shoreRows, { rows: schedule.byRaft });
  const maxTv = (b: ScrewBaseRow) => Math.max(...b.combinations.map((c) => c.Tv_kN));
  const T = schedule.totals;
  return {
    code: state.meta.code || state.code || 'HV-FPV-2026', name: state.meta.name || state.name || '',
    wind_ms: state.env.windSpeed_ms, windCaveat: designWindCaveat(state.env.windSpeed_ms) || null,
    rafts, state: batch[0]?.state ?? state, schedule, points,
    totals: {
      lines: points.totals.lines,
      shorePiles: sum(shoreRows, (p) => p.pileCount), shoreLength_m: sum(shoreRows, (p) => p.pileCount * p.Ltotal_m),
      shoreConcrete_m3: sum(shoreRows, (p) => p.pileCount * p.cage.concreteVol_m3), shoreSteel_kg: sum(shoreRows, (p) => p.pileCount * p.cage.steel_kg),
      bases: T.bases, baseConcrete_m3: T.concrete_m3, baseRebar_kg: T.rebar_kg, screws: T.screws, screwLength_m: T.screwLength_m, maxLift_t: T.maxLiftMass_t,
      upliftDemand_kN: sum(schedule.bases, maxTv),
      upliftResistance_kN: sum(schedule.bases, (b) => b.design.cases[1].upliftResistance_kN),
      worst: {
        uplift: Math.max(...schedule.bases.map((b) => b.upliftUtil)), slide: Math.max(...schedule.bases.map((b) => b.slideUtil)),
        overturn: Math.max(...schedule.bases.map((b) => b.overturnUtil)), screw: Math.max(...schedule.bases.map((b) => b.screwUtil))
      },
      allOk: rafts.every((r) => r.verdict === 'PASS') && schedule.bases.every((b) => b.ok) && points.shore.every((p) => p.ok)
    },
    cost, costParams: params
  };
}

// ---------------------------------------------------------------------------
// Calculation note
// ---------------------------------------------------------------------------

export interface NoteSection { title: string; lines: string[] }

/** Vietnamese number: decimal comma, thousands dot. */
export const vn = (v: number, d = 1): string =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '∞';

/**
 * What every row of the check table means: the symbols of its formula, and why a row may not apply to the
 * settled design (piles and bases instead of drag anchors). Shown in note section 9 next to the raft's result.
 */
const CHECK_EXPLAIN: Record<string, string> = {
  'C1': 'R_total là tổng sức giữ của các neo, H_line là lực ngang trong dây; [SF] là hệ số an toàn yêu cầu. Dùng cho neo thả kéo lê trên đáy (neo cày, khối thả).',
  'C2': 'MBL là lực kéo đứt nhỏ nhất của cáp (nhà sản xuất công bố), T_max là lực lớn nhất một dây phải chịu (mô hình cân bằng, đã cộng lực căng trước); [SF] = 3 khi đủ dây.',
  'C3': 'L_ground là chiều dài xích / cáp nằm trên đáy trước neo, L_ground,min là chiều dài tối thiểu để neo kéo lê không bị nhấc lên. Dùng cho neo thả.',
  'C4': 'L_total là chiều dài dây, d là chiều sâu nước; tỷ lệ [scope] (thường ≥ 5) bảo đảm dây xích đủ thoải cho neo thả.',
  'C5': 'Như C1 nhưng với lực ngang H_line,dam khi đứt một dây.',
  'C6': 'Như C2 nhưng T_max,dam là lực lớn nhất trong các dây còn lại khi dây chịu lực lớn nhất bị đứt (tính lại ở mọi mực nước); [SF] = 2.',
  'C7': 'X_deficit là phần dây còn thiếu so với chiều dài cần của dây xích chùng (đường dây xích) ở độ trôi cho phép [maxOffset].',
  'C8': 'h_nước là chiều sâu nước dưới bè ở độ sâu thiết kế, mớn nước là phần bè chìm dưới nước; [min] là khoảng hở tối thiểu để đáy bè không chạm đáy hồ.',
  'C9': 'P_bè là chu vi đa giác bè đo trên mặt bằng, N_dây là số dây neo của bè; [maxSpacing] = 15 m là yêu cầu bắt buộc để lực phân bố đều quanh bè.',
  'C12': 'u_max là độ trôi ngang lớn nhất của bè trong mô hình cân bằng (mọi hướng, mọi mực nước); hai bè cạnh nhau có thể cùng trôi về phía nhau nên mỗi bè chỉ được trôi nửa khe hở.',
  'C10': 'P_max là sức chịu tải cho phép của cọc bờ theo catalogue hoặc thí nghiệm thử tải; chỉ kiểm khi có nhập P_max.',
  'C11': 'Như C10 cho cọc đóng dưới đáy hồ (phương án PA1).',
  'BP-1': 'H_applied là lực ngang vào một cọc (T, hoặc T / (2 × 0,9) ở điểm cọc đôi), H_allow = H_u / 2,5 với H_u là sức chịu ngang giới hạn theo Broms (mục 5).',
  'BP-2': 'M_max là mô-men lớn nhất trong thân cọc, γ = 1,2 là hệ số tải trọng, M_rd là khả năng chịu uốn của lồng thép theo TCVN 5574:2018 (mục 5).',
  'BP-3': 'Sức chịu ngang của cọc đóng dưới đáy hồ (phương án PA1): T_h lực ngang, H_allow sức chịu cho phép.',
  'BP-4': 'Sức chịu nhổ của cọc đóng dưới đáy hồ (PA1): T_v lực nhổ, Q_uplift,all sức chịu nhổ cho phép do ma sát thân cọc.',
  'BP-5': 'Uốn thân cọc đóng dưới đáy hồ (PA1).',
  'SV-1': "T_v là lực nhổ, W' là trọng lượng đế trong nước (đã trừ lực đẩy nổi, chỉ lấy 0,9), n vít × Q_a là sức chịu nhổ cho phép của các vít (mục 6).",
  'SV-2': 'T_h là lực ngang nhân hệ số 1,5; chống trượt gồm bám dính đáy α·c_u·B² (bằng 0 khi đế bị nhấc), gờ đế R_gờ và sức chịu ngang của n vít H_u (mục 6).',
  'SV-3': 'M_o là mô-men lật quanh mép đáy phía xa dây (nhân 1,5), M_r là mô-men giữ do trọng lượng đế và các vít (mục 6).',
  'SV-4': 'N_1 là lực nhổ lên vít chịu nặng nhất sau khi trừ phần trọng lượng đế gánh, Q_a là sức chịu nhổ cho phép của một vít (mục 6).',
  'SV-5': "W'/B² là áp lực đế lên nền bùn, 5,14·c_u là sức chịu tải giới hạn của nền sét mềm, chia hệ số an toàn (mục 6).",
  'SV-6': 'A_s yc là thép bản đế cần theo mô-men uốn, 0,1% là hàm lượng tối thiểu, A_s bố trí là lưới thép đặt trong bản (mục 6).',
  'DW-1': 'Khối bê tông trọng lực (phương án PA2) chống trượt: μ hệ số ma sát, W_sub trọng lượng trong nước, V lực nhổ, H lực ngang.',
  'DW-2': 'Khối bê tông trọng lực (PA2) chống nhấc: trọng lượng trong nước W_sub so với lực nhổ V.',
  'DW-3': 'Khối bê tông trọng lực (PA2) chống lật quanh mép khối.',
  'DW-4': 'Khối bê tông trọng lực (PA2): áp lực lên nền bùn so với sức chịu cho phép.'
};

/** Why a row does not apply to the settled design (the engine's own note is written for every option). */
const NOT_APPLICABLE: Record<string, string> = {
  'C1': 'hệ này không dùng neo thả: sức giữ là của cọc bờ (BP-1, BP-2) và đế vít xoắn (SV-1…SV-6).',
  'C5': 'hệ này không dùng neo thả: sức giữ là của cọc bờ (BP-1, BP-2) và đế vít xoắn (SV-1…SV-6).',
  'C3': 'cọc và đế chịu được lực nhổ (kiểm ở SV-1, SV-4), không cần đoạn dây nằm trên đáy.',
  'C4': 'dây căng thẳng tới cọc / đế, chiều dài dây do mặt bằng quyết định.',
  'C7': 'không có đoạn dây xích dự trữ; cáp cắt theo bảng chiều dài cắt cáp (mục 7).',
  'C10': 'chưa có catalogue hoặc thí nghiệm thử tải nên chưa có P_max; sức chịu cọc bờ đã kiểm bằng tính toán ở BP-1, BP-2.',
  'C11': 'neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.',
  'BP-3': 'neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.',
  'BP-4': 'neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.',
  'BP-5': 'neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.'
};

/** Note section 9: every row of the check table of the example raft, formula, symbols and result. */
function checksSection(d: FinalDesign): NoteSection {
  const r = d.rafts.reduce((a, b) => (b.tMax_kN > a.tMax_kN ? b : a), d.rafts[0]);
  const status = (c: CheckItem) => c.status === 'PASS' ? 'ĐẠT' : c.status === 'FAIL' ? 'KHÔNG ĐẠT' : c.status === 'SKIP' ? 'KHÔNG ÁP DỤNG' : 'KHÔNG TÍNH ĐƯỢC';
  // the engine writes decimal points; the note is Vietnamese
  const dec = (v: unknown) => String(v).replace(/(\d)\.(\d)/g, '$1,$2');
  return {
    title: `9. Giải thích bảng hạng mục kiểm tra (ví dụ ${r.name})`,
    lines: [
      'Mỗi dòng của bảng kiểm tra trên web: công thức, ý nghĩa các ký hiệu và kết quả của bè ví dụ. Mức sử dụng = tải trọng phải chịu / khả năng chịu (đã chia hệ số an toàn): ≤ 1,00 là đạt. Dòng "KHÔNG ÁP DỤNG" là phép kiểm của loại neo khác, không dùng cho phương án cọc khoan nhồi + đế vít xoắn.',
      ...r.checks.map((c) => {
        const why = c.status === 'SKIP' ? NOT_APPLICABLE[c.id] ?? c.note : c.note;
        const result = c.status === 'SKIP' || c.status === 'NA'
          ? `${status(c)}${why ? ` — ${dec(why)}` : ''}`
          : `${status(c)}: giá trị ${dec(c.displayActual)}${c.threshold !== '' ? `, yêu cầu ${dec(c.threshold)}` : ''}${c.utilization !== null && Number.isFinite(c.utilization) ? `, mức sử dụng ${vn(c.utilization, 2)}` : ''}.` +
            (c.id === 'C8' ? ' Khoảng hở khi hồ xuống MNC: xem mục 4.' : '');
        return `${c.id} — ${c.label}: ${dec(c.formula)}. ${CHECK_EXPLAIN[c.id] ?? ''} Kết quả ${r.name}: ${result}`;
      })
    ]
  };
}

/** The calculation note: sections 1–8 (the method step by step) and 9 (the check table explained). */
export function finalDesignNote(d: FinalDesign): NoteSection[] {
  return [...noteSections(d), checksSection(d)];
}

/** Sections 1–8: the method step by step, with the worst raft and the worst base worked out. */
function noteSections(d: FinalDesign): NoteSection[] {
  const st = d.state, A = st.anchor, E = st.env;
  const r = d.rafts.reduce((a, b) => (b.tMax_kN > a.tMax_kN ? b : a), d.rafts[0]);
  const base = d.schedule.bases.reduce((a, b) => (Math.max(b.overturnUtil, b.upliftUtil) > Math.max(a.overturnUtil, a.upliftUtil) ? b : a), d.schedule.bases[0]);
  const g = base.design, c = g.cases[1], p = g.params;
  const T = d.totals, P = d.points.totals;
  const sides = Object.entries(P.basesBySide).map(([s, n]) => `${n} đế ${s.replace('.', ',')} m`).join(', ');
  const lv = d.points.levels;
  const cut = buildCableCuttingSchedule(st);
  const perPoint = r.pileTypes.find((t) => !t.light)?.perPoint ?? 1;
  const lightTypes = d.rafts.flatMap((x) => x.pileTypes.filter((t) => t.light).map((t) => ({ raft: x, t })));
  const pileLoad = perPoint > 1 ? r.tMax_kN / (perPoint * (A.pileGroupEfficiency ?? 0.9)) : r.tMax_kN;
  // Broms (short pile in clay) and the bar-ring bending resistance, written out with the raft's numbers
  const pP = 9 * r.cuShore_kPa * r.pileD_m, gP = Math.max(0.1, r.pileL_m - 1.5 * r.pileD_m);
  const aBar = (Math.PI * r.rebarDia_mm ** 2) / 4, rRing = r.pileD_m / 2 - r.cover_mm / 1000, kRing = 2 / Math.tan(Math.PI / Math.max(2, r.rebarCount));
  if (r.analysis) return lakeAnalysisNote(d, r, cut);
  return [
    {
      title: '1. Phương án chốt',
      lines: [
        `Chủ đầu tư chốt ngày ${FINAL_OPTION_DATE}: ${FINAL_OPTION_TITLE}.`,
        `Hệ neo: ${T.lines} tuyến cáp tại ${P.points} điểm neo = ${P.shorePoints} cọc khoan nhồi ven bờ + ${P.bedBases} đế đáy hồ (cả ${P.sharedBases} đế dùng chung cho hai dây của hai bè đối diện).`,
        d.windCaveat ?? `Gió tính toán V = ${vn(d.wind_ms, 0)} m/s.`,
        `Kết quả: ${d.rafts.filter((x) => x.verdict === 'PASS').length}/${d.rafts.length} bè đạt; ${P.shoreOk}/${P.shorePoints} cọc bờ đạt; ${P.bedOk}/${P.bedBases} đế đạt.`
      ]
    },
    {
      title: '2. Số liệu đầu vào và giả định',
      lines: [
        `Mực nước hồ: MNC ${vn(lv.mnc_m)} m; MNDB ${vn(lv.mndb_m)} m; MNLKT ${vn(lv.mnlkt_m)} m.`,
        `Tấm pin: ${vn(r.panelArea_m2, 3)} m²/tấm, nghiêng ${vn(r.tilt_deg, 0)}°, hệ số cản ${vn(r.cdPanel, 2)}, hệ số che chắn giữa các hàng ${vn(r.shield, 2)}; sóng và dòng chảy gộp bằng hệ số ${vn(r.waveCurrentFactor, 2)}.`,
        `Đất bờ (GIẢ ĐỊNH, chưa khảo sát): sét, c_u = ${vn(A.cuShore_kPa ?? 40, 0)} kPa. Bùn đáy hồ (GIẢ ĐỊNH): c_u = ${vn(p.cuAverage_kPa, 0)} kPa, γ' = ${vn(p.gammaSubMud_kNm3, 0)} kN/m³.`,
        `Hệ số an toàn: cáp ≥ ${vn(st.criteria.sfLineIntact ?? 3, 1)}; cọc bờ chịu ngang ${vn(A.sfPile ?? 2.5, 1)}; hệ số tải uốn cọc ${vn(r.loadFactor, 1)}; đế: trượt ${vn(p.sfSlide, 1)}, lật ${vn(p.sfOverturn, 1)}, nhổ vít ${vn(p.sfScrewUplift, 1)}, nền ${vn(p.sfBearing, 1)}; trọng lượng đế nhân ${vn(p.weightFactor, 1)} khi chống nhổ.`
      ]
    },
    {
      title: `3. Lực gió lên bè (ví dụ ${r.name}, bè có lực dây lớn nhất)`,
      lines: [
        `Áp lực gió: q = 0,5 × ρ × V² = 0,5 × ${vn(E.airDensity ?? 1.25, 2)} × ${vn(d.wind_ms, 0)}² = ${vn(r.q_Pa, 0)} N/m².`,
        `Diện tích đón gió của pin: A = số tấm × diện tích tấm × sin(nghiêng) = ${vn(r.panels, 0)} × ${vn(r.panelArea_m2, 3)} × sin ${vn(r.tilt_deg, 0)}° = ${vn(r.areaProjected_m2, 0)} m².`,
        `Lực gió lên pin: F_pin = q × C_d × A × hệ số che chắn = ${vn(r.q_Pa, 0)} × ${vn(r.cdPanel, 2)} × ${vn(r.areaProjected_m2, 0)} × ${vn(r.shield, 2)} = ${vn(r.fPanel_kN)} kN.`,
        `Lực gió lên phao (mạn khô ${vn(st.raft.freeboardHeight_m ?? 0.35, 2)} m): F_phao = ${vn(r.fFloat_kN)} kN. Tổng gió: ${vn(r.fWind_kN)} kN.`,
        `Tổng lực môi trường: F = ${vn(r.fWind_kN)} × ${vn(r.waveCurrentFactor, 2)} = ${vn(r.fEnv_kN)} kN.`
      ]
    },
    {
      title: '4. Lực căng một dây',
      lines: [
        'Tính hai cách, lấy giá trị lớn hơn; mọi dây của bè đều kiểm tra với lực này.',
        `Cách hệ số tập trung: T = F × k + T_0 = ${vn(r.fEnv_kN)} × ${vn(r.focusFactor, 3)} + ${vn(r.pretension_kN, 0)} = ${vn(r.tFocus_kN)} kN.`,
        `Cách chia cho số dây làm việc: T = F / (n × cos α) + T_0 = ${vn(r.fEnv_kN)} / (${vn(r.nEff, 0)} × cos ${vn(r.alpha_deg, 0)}°) + ${vn(r.pretension_kN, 0)} = ${vn(r.tGeometric_kN)} kN.`,
        `Lực dây thiết kế của ${r.name}: T = ${vn(r.tMax_kN)} kN; khi đứt một dây: ${vn(r.tDamaged_kN)} kN.`,
        `Cáp ${r.cable}, lực đứt ${vn(r.mbl_kN, 0)} kN: hệ số an toàn ${vn(r.sfIntact, 2)} (yêu cầu ≥ ${vn(st.criteria.sfLineIntact ?? 3, 1)}); khi đứt một dây ${vn(r.sfDamaged, 2)} (yêu cầu ≥ ${vn(st.criteria.sfLineDamaged ?? 2, 1)}).`
      ]
    },
    {
      title: `5. Cọc khoan nhồi ven bờ (ví dụ ${r.name})`,
      lines: [
        `Cọc tròn D${Math.round(r.pileD_m * 1000)} đổ tại chỗ, ngàm L_tk = ${vn(r.pileL_m)} m, dài cả cọc ${vn(r.pileLtotal_m)} m; thép chủ ${r.cage} ${r.grade}, ${r.stirrup}. Cáp móc cách mặt đất ${vn(A.shoreArm_e_m ?? 0.1, 1)} m.`,
        ...(perPoint > 1 ? [`Điểm neo CỌC ĐÔI: ${perPoint} cọc cạnh nhau, vuông góc phương cáp, cách nhau ≥ 3D; mỗi cọc chịu P = T / (${perPoint} × ${vn(A.pileGroupEfficiency ?? 0.9, 1)}) = ${vn(pileLoad)} kN (hệ số nhóm là GIẢ ĐỊNH); đài BTCT nối hai đầu cọc: thiết kế sơ bộ ở bảng thống kê vật tư neo (twinPileCap.ts).`] : []),
        `BP-1, sức chịu ngang theo Broms (cọc ngắn trong đất sét). Sức kháng của đất trên 1 m cọc: p = 9 × c_u × D = 9 × ${vn(r.cuShore_kPa, 0)} × ${vn(r.pileD_m, 2)} = ${vn(pP)} kN/m; đoạn 1,5D = ${vn(1.5 * r.pileD_m, 3)} m dưới mặt đất không tính, phần ngàm làm việc g = L_tk − 1,5D = ${vn(r.pileL_m)} − ${vn(1.5 * r.pileD_m, 3)} = ${vn(gP, 3)} m; tim chốt cáp cao e = ${vn(r.arm_m, 2)} m trên mặt đất.`,
        `H_u là nghiệm dương của (0,5 / p) × H_u² + (e + 1,5D + g) × H_u − 0,5 × p × g² = 0, tức (0,5 / ${vn(pP)}) × H_u² + ${vn(r.arm_m + 1.5 * r.pileD_m + gP, 3)} × H_u − ${vn(0.5 * pP * gP * gP, 1)} = 0 → H_u = ${vn(r.Hu_kN)} kN. Cho phép H_u / ${vn(A.sfPile ?? 2.5, 1)} = ${vn(r.Hallow_kN)} kN ≥ ${perPoint > 1 ? 'P' : 'T'} = ${vn(pileLoad)} kN; mức sử dụng = ${vn(pileLoad)} / ${vn(r.Hallow_kN)} = ${vn(r.bp1, 2)}.`,
        `BP-2, uốn thân cọc (TCVN 5574:2018). Mô-men lớn nhất trong cọc: M_max = P × (e + 1,5D + 0,5 × P / p) = ${vn(pileLoad)} × (${vn(r.arm_m, 2)} + ${vn(1.5 * r.pileD_m, 3)} + 0,5 × ${vn(pileLoad)} / ${vn(pP)}) = ${vn(r.Mmax_kNm)} kNm.`,
        `Khả năng chịu uốn của lồng ${r.rebarCount} thanh Φ${r.rebarDia_mm} đặt trên vòng tròn: M_rd = A_1 thanh × R_s × r × k(n) = ${vn(aBar, 1)} mm² × ${vn(r.rebarRs_MPa, 0)} MPa × ${vn(rRing, 3)} m × ${vn(kRing, 2)} = ${vn(r.Mrd_kNm)} kNm (r = D/2 − ${vn(r.cover_mm, 0)} mm tới tim thép; k(n) = 2 / tan(π/n) là cánh tay đòn của n thanh ở hướng BẤT LỢI nhất, vì lồng thả vào lỗ khoan không định hướng được; bỏ qua bê tông chịu kéo).`,
        `Kiểm tra: ${vn(r.loadFactor, 1)} × M_max = ${vn(r.loadFactor, 1)} × ${vn(r.Mmax_kNm)} = ${vn(r.loadFactor * r.Mmax_kNm)} kNm ≤ M_rd = ${vn(r.Mrd_kNm)} kNm; mức sử dụng ${vn(r.bp2, 2)} (${vn(r.loadFactor, 1)} là hệ số tải trọng khi kiểm tra uốn).`,
        ...(lightTypes.length ? [`Cọc ĐƠN theo lực của chính dây (như đế neo đáy): ở ${lightTypes.map(({ raft, t }) => `${raft.name} ${t.points}/${raft.shoreLines} điểm`).join(', ')}, lực lớn nhất của CHÍNH dây (mọi mực nước, mọi hướng gió, cộng lực căng trước) không quá ${lightTypes.map(({ raft, t }) => `${vn(t.tension_kN)} kN (${raft.name})`).join(', ')} nên dùng một cọc ${lightTypes.map(({ t }) => `${t.cage} ${t.grade}, L_tk ${vn(t.L_m)} m`).filter((x, i, a) => a.indexOf(x) === i).join('; ')} (BP-1 ${lightTypes.map(({ t }) => vn(t.bp1, 2)).join(' / ')}, BP-2 ${lightTypes.map(({ t }) => vn(t.bp2, 2)).join(' / ')}); chỉ các dây lực lớn hơn mới dùng cọc của bè. Lực bè T ở trên là lực bất lợi nhất của bè, có sàn F/(6 cos 30°).`] : []),
        `Cả hệ: ${T.shorePiles} cọc, tổng dài ${vn(T.shoreLength_m)} m, ${vn(T.shoreConcrete_m3)} m³ bê tông, ${vn(T.shoreSteel_kg / 1000)} tấn thép. Lực kiểm tra cọc là toàn bộ lực dây (không giảm theo góc xiên), thiên về an toàn.`
      ]
    },
    {
      title: `6. Đế BTCT + vít xoắn (ví dụ ${base.baseId}, đế làm việc nặng nhất)`,
      lines: [
        `Một vít: ống Ø${Math.round(p.tubeDia_m * 1000)}×${Math.round(p.tubeThk_m * 1000)}, ren Ø${Math.round(p.threadDia_m * 1000)}, ngàm ${vn(p.screwLength_m)} m. Sức chịu nhổ cực hạn Q_u = α × c_u × π × D_ren × L = ${vn(p.alphaShaft, 1)} × ${vn(p.cuAverage_kPa, 0)} × π × ${vn(p.threadDia_m, 3)} × ${vn(p.screwLength_m)} = ${vn(g.screwQu_kN)} kN; cho phép Q_a = Q_u / ${vn(p.sfScrewUplift, 0)} = ${vn(g.screwQa_kN)} kN. Sức chịu ngang cực hạn H_u = ${vn(g.screwHu_kN)} kN.`,
        `Đế ${base.baseId} giữ hai dây ${base.lines.map((l) => `${l.code} (${l.raft}, T = ${vn(l.tension_kN)} kN, dài ${vn(l.span_m, 2)} m)`).join(' và ')}. Bích bè cao hơn mặt nước ${vn(p.cleatHeight_m, 2)} m.`,
        `Mỗi dây tách thành lực ngang T_h = T × cos θ và lực nhổ T_v = T × sin θ, θ là góc dốc của dây (tan θ = chênh cao bích bè – chốt đế / khoảng cách ngang): dây thoải khi nước thấp (trượt chi phối), dốc khi nước cao (nhổ, lật chi phối).`,
        `Tổ hợp chi phối: ${base.governing}. Lực nhổ T_v = ${vn(c.Tv_kN)} kN (hai dây cộng lại), lực ngang T_h = ${vn(c.Th_kN)} kN (cộng véc-tơ).`,
        `Đế ${vn(g.side_m, 2)} × ${vn(g.side_m, 2)} × ${vn(g.thickness_m, 1)} m: thể tích ${vn(g.volume_m3, 2)} m³, nặng ${vn(g.weightAir_kN)} kN trên cạn, W' = ${vn(g.volume_m3, 2)} × (${vn(p.gammaConcrete_kNm3, 0)} − ${vn(p.gammaWater_kNm3, 0)}) = ${vn(g.weightSub_kN)} kN trong nước (đã trừ lực đẩy nổi).`,
        `SV-1 nhổ: T_v ≤ ${vn(p.weightFactor, 1)} × W' + ${p.screwCount} × Q_a = ${vn(c.upliftResistance_kN)} kN; mức sử dụng ${vn(base.upliftUtil, 2)}.`,
        `SV-2 trượt: ${vn(p.sfSlide, 1)} × T_h ≤ bám dính đáy + gờ + ${p.screwCount} × H_u. Bám dính đáy = ${vn(p.alphaBase, 1)} × c_u × B² = ${vn(c.adhesion_kN)} kN (lấy bằng 0 khi T_v > W': đế bị nhấc khỏi bùn); gờ sâu z = ${vn(p.skirtDepth_m, 2)} m: B × (0,5 × γ' × z² + 2 × c_u × z) = ${vn(g.skirtResistance_kN)} kN; H_u một vít = ${vn(g.screwHu_kN)} kN (Broms, đầu tự do ở mặt bùn). ${vn(p.sfSlide, 1)} × ${vn(c.Th_kN)} = ${vn(p.sfSlide * c.Th_kN)} ≤ ${vn(c.slideResistance_kN)} kN; mức sử dụng ${vn(base.slideUtil, 2)}.`,
        `SV-3 lật quanh mép đáy phía xa dây: M_lật = T_h × (t + h_tai) + T_v × B / 2 = ${vn(c.Th_kN)} × (${vn(g.thickness_m, 1)} + ${vn(p.padeyeHeight_m, 2)}) + ${vn(c.Tv_kN)} × ${vn(g.side_m, 2)} / 2 = ${vn(c.overturningMoment_kNm)} kNm; M_giữ = W' × B / 2 + (n/2) × Q_u × (B − c) + (n/2) × Q_u × c = ${vn(c.resistingMoment_kNm)} kNm (c = ${vn(p.holeEdge_m, 2)} m từ mép đế tới tim lỗ vít). ${vn(p.sfOverturn, 1)} × ${vn(c.overturningMoment_kNm)} = ${vn(p.sfOverturn * c.overturningMoment_kNm)} ≤ ${vn(c.resistingMoment_kNm)} kNm; mức sử dụng ${vn(base.overturnUtil, 2)}.`,
        `SV-4 một vít: lực nhổ lên vít chịu nặng nhất N_1 = max[(T_v − ${vn(p.weightFactor, 1)} × W') / n ; (M_lật − ${vn(p.weightFactor, 1)} × W' × B / 2) / (B − c) / (n/2)] = ${vn(c.screwPull_kN)} kN ≤ Q_a = ${vn(g.screwQa_kN)} kN; mức sử dụng ${vn(base.screwUtil, 2)}.`,
        `SV-5 áp lực lên nền bùn: W' / B² = ${vn(g.bearingPressure_kPa)} kPa ≤ 5,14 × c_u / ${vn(p.sfBearing, 1)} = ${vn(g.bearingAllow_kPa)} kPa (sức chịu tải giới hạn của nền sét mềm); mức sử dụng ${vn(base.bearingUtil, 2)}.`,
        `SV-6 thép bản đế: tai neo kéo lên ở giữa, ${p.screwCount} vít giữ ở các góc; mô-men trên 1 m bản M = (n/2) × Q_u × (s/2) / B = ${vn(g.slabMoment_kNm_m, 2)} kNm/m (s = B − 2c); thép cần A_s = M / (0,9 × h_0 × R_s) = ${vn(g.rebarRequired_mm2, 0)} mm²/m, tối thiểu 0,1% = ${vn(g.rebarMin_mm2, 0)} mm²/m; bố trí lưới Ø${g.rebarDia_mm} a${Math.round(g.rebarSpacing_m * 1000)} hai lớp = ${vn(g.rebarProvided_mm2, 0)} mm²/m; mức sử dụng ${vn(base.rebarUtil, 2)}.`,
        `Cả hệ: ${T.bases} đế (${sides}), ${vn(T.baseConcrete_m3)} m³ bê tông, ${vn(T.baseRebar_kg / 1000)} tấn thép bản, ${T.screws} vít (${vn(T.screwLength_m, 0)} m), đế nặng nhất khi cẩu ${vn(T.maxLift_t)} tấn.`,
        `Tổng lực nhổ lên ${T.bases} đế ${vn(T.upliftDemand_kN, 0)} kN, tổng sức chống nhổ ${vn(T.upliftResistance_kN, 0)} kN. Mức sử dụng lớn nhất: nhổ ${vn(T.worst.uplift, 2)}, trượt ${vn(T.worst.slide, 2)}, lật ${vn(T.worst.overturn, 2)}, một vít ${vn(T.worst.screw, 2)}.`
      ]
    },
    {
      title: '7. Chiều dài cắt cáp',
      lines: [
        `Cáp không lắp bằng cách kéo căng: mỗi dây cắt theo khoảng cách thẳng từ bích bè tới chốt neo ở mực nước mà khoảng cách đó dài nhất (${cut.totals.governedBy.MNLKT} dây đáy ở MNLKT, ${cut.totals.governedBy.MNC} dây bờ ở MNC).`,
        `Tổng chiều dài cắt: dây bờ ${vn(cut.totals.shoreLength_m, 0)} m, dây đáy ${vn(cut.totals.bedLength_m, 0)} m, chưa gồm đoạn bện đầu và phụ kiện. Phải đo cao độ đáy từng đế trước khi cắt dây đáy.`
      ]
    },
    {
      title: '8. Giả định và vấn đề còn mở',
      lines: [
        'Chưa có khảo sát địa chất: c_u đất bờ và bùn đáy là giả định. Sức chịu của vít tỷ lệ thuận với c_u; cọc bờ không đạt ở một số bè nếu c_u đất bờ chỉ 20 kPa.',
        'Số dây làm việc lấy bằng 6 và góc dây 30° cho mọi bè là giả định; số dây thực sự căng theo từng hướng gió ở MNC và MNLKT chưa kiểm tra.',
        'Hệ số che chắn 0,55 và diện tích chiếu của tấm nghiêng quyết định lực gió; lực gió trên một m² bè ở đây thấp hơn một số hồ sơ tham khảo.',
        'Sức chịu nhổ và sức chịu ngang của vít tính độc lập, chưa xét tương tác. Đầu cọc, đài cọc đôi, tai neo mặt đế mới có thiết kế sơ bộ (bảng thống kê vật tư neo, sheet KiemTra_DauCoc_De); chưa thiết kế: khóa đầu vít, móc cẩu, chống ăn mòn.',
        `Cao độ đáy đặt đế là đáy thiết kế, chưa phải khảo sát; tại ${P.terrainHigherPoints} đế địa hình IFC cao hơn đáy thiết kế trên 0,5 m. ${P.shoreBelowNormalWater}/${P.shorePoints} cọc bờ đứng ở chỗ mặt đất thấp hơn MNDB (thi công mùa nước thấp, có ống vách).`,
        ...(() => {
          const ob = obliqueShoreLines();
          if (!ob.length) return [];
          const list = (xs: typeof ob) => xs.map((x) => `${x.code} (${vn(x.deg, 0)}°)`).join(', ');
          const staked = ob.filter((x) => x.staked), fresh = ob.filter((x) => !x.staked);
          return [`${ob.length} dây bờ lệch quá 60° so với pháp tuyến mép bè (giữ bè theo phương vuông góc mép kém; lực dây đã tính theo đúng phương vị): ` +
            [staked.length ? `cọc đã định vị (không dời) ${list(staked)}` : '', fresh.length ? `cọc mới — trong tầm 60 m không có bờ theo phương vuông góc mép — ${list(fresh)}` : ''].filter(Boolean).join('; ') + '.'];
        })(),
        'Lớp bê tông bảo vệ cọc bờ tới đai chỉ 26–30 mm (tính với 50 mm tới tim thép chủ).'
      ]
    }
  ];
}

/** How the lines follow the water level, in words (Hồ Bản Mòng). */
export function compensationText(mode: 'fixed' | 'seasonal' | undefined, step_m: number | undefined): string {
  if (mode !== 'seasonal') return 'cáp cắt một lần theo khoảng cách bích – chốt dài nhất giữa MNC và MNLKT, không điều chỉnh';
  if (!step_m || step_m <= 0) return 'BÙ LIÊN TỤC — mỗi dây luôn vừa căng ở mọi mực nước nhờ thiết bị tự căng (đối trọng / tời), có bộ KHÓA chống bão bắt buộc; thiết bị CHƯA chọn loại';
  return `căng chỉnh lại dây mỗi khi mực nước thay đổi ${vn(step_m, 1)} m (trong mỗi khoảng, dây đặt bằng khoảng cách bích – chốt dài nhất của khoảng)`;
}

/**
 * The note of a lake whose line tension comes from the equilibrium analysis
 * (Hồ Bản Mòng). Sections 3, 5 and 6 are those of the Huổi Vanh note; 1, 4,
 * 7 and 8 say what is different. Every figure from the engine.
 */
function lakeAnalysisNote(d: FinalDesign, r: FinalRaftRow, cut: ReturnType<typeof buildCableCuttingSchedule>): NoteSection[] {
  const st = d.state, L = st.line, P = d.points.totals, lv = d.points.levels;
  const hv = noteSections({ ...d, rafts: d.rafts.map((x) => ({ ...x, analysis: undefined })) });
  const a = r.analysis!, g = a.governing;
  const comp = compensationText(L.levelCompensation, L.adjustStep_m);
  const drifts = d.rafts.map((x) => x.analysis!.maxDrift_m);
  const HV = ACTIVE_LAKE_ID === 'huoi-vanh';
  const bedSpans = cut.rows.filter((x) => x.type === 'BED').map((x) => x.span_m);
  const standby = cut.rows.filter((x) => x.note.includes('DÂY DỰ PHÒNG')).map((x) => x.code);
  return [
    {
      title: HV ? '1. Phương án chốt' : '1. Phương án neo',
      lines: [
        HV
          ? `Chủ đầu tư chốt ngày ${FINAL_OPTION_DATE}: ${FINAL_OPTION_TITLE}. Lực dây tính lại ngày 23/10/2026 bằng cân bằng tĩnh của bè trên từng dây theo mực nước (thay cách góc dây 30° + hệ số tập trung); cáp, cọc, đế định cỡ lại theo lực này.`
          : `Áp dụng phương án Chủ đầu tư đã chốt cho Huổi Vanh ngày ${FINAL_OPTION_DATE} (${FINAL_OPTION_TITLE}); CHƯA chốt riêng cho hồ này.`,
        `Hệ neo: ${d.totals.lines} tuyến cáp tại ${P.points} điểm neo = ${P.shorePoints} cọc khoan nhồi ven bờ + ${P.bedBases} đế đáy hồ (${P.sharedBases} đế dùng chung hai bè).`,
        ...(HV
          ? [`Mặt bằng bè: bản vẽ CAD 27/10/2026, ${d.rafts.length} bè, ${vn(sum(d.rafts, (x) => x.area_m2), 0)} m²; số tấm pin theo bản vẽ bố trí bè pin 28/10/2026: ${d.rafts.map((x) => `${x.name} ${vn(x.panels, 0)}`).join(', ')}, tổng ${vn(sum(d.rafts, (x) => x.panels), 0)} tấm.`]
          : []),
        d.windCaveat ?? `Gió tính toán V = ${vn(d.wind_ms, 0)} m/s.`,
        `Vận hành dây: ${comp}.`,
        `Kết quả: ${d.rafts.filter((x) => x.verdict === 'PASS').length}/${d.rafts.length} bè đạt; ${P.shoreOk}/${P.shorePoints} cọc bờ đạt; ${P.bedOk}/${P.bedBases} đế đạt.`
      ]
    },
    { ...hv[1], lines: [`Mực nước hồ: MNC ${vn(lv.mnc_m, 2)} m; MNDB ${vn(lv.mndb_m, 2)} m; MNLKT ${vn(lv.mnlkt_m, 2)} m.`, ...hv[1].lines.slice(1)] }, hv[2],
    {
      title: '4. Lực căng dây — phân tích cân bằng tĩnh theo mực nước',
      lines: [
        HV
          ? `Mực nước dao động ${vn(lv.mnlkt_m - lv.mnc_m, 2)} m trong khi dây đáy chỉ dài ${vn(Math.min(...bedSpans), 1)}–${vn(Math.max(...bedSpans), 1)} m: chiều dài cần của dây đổi theo mực nước, dây chùng – căng khác nhau, nên số dây thật sự chịu lực thay đổi theo hướng tải và mực nước. Cách góc dây 30° + hệ số tập trung (coi mọi dây cùng làm việc) cho lực dây thấp hơn thực tế nên không dùng nữa.`
          : `Hồ sâu, mực nước dao động ${vn(lv.mnlkt_m - lv.mnc_m, 2)} m: góc dốc thật của dây thay đổi theo mực nước (dây đáy dốc tới 70°), nên KHÔNG dùng góc dây cố định 30° và hệ số tập trung.`,
        `Mỗi bè: tải môi trường F đặt lần lượt theo 24 hướng (15°/hướng), ở mọi mực nước từ mức bè còn nổi tới MNLKT (bước 1 m, thêm MNDB và MNLKT). Bè tịnh tiến tới khi tổng lực các dây đang căng cân bằng F. Dây thẳng, đàn hồi EA = ${vn(L.eaPerMbl ?? 15, 0)} × lực đứt (GIẢ ĐỊNH cho polyester), dây chùng không chịu lực; không xét xoay bè và tải động.`,
        `Lực một dây: T = (EA / L_0) × (d − L_0) khi d > L_0, T = 0 khi d ≤ L_0 (dây chùng). d là khoảng cách thẳng bích bè – chốt neo khi bè đã dịch đi, L_0 là chiều dài dây lúc vừa căng. Cáp ${r.cable}: EA = ${vn(r.ea_kN / r.mbl_kN, 0)} × ${vn(r.mbl_kN, 0)} = ${vn(r.ea_kN, 0)} kN. Dây càng ngắn (L_0 nhỏ) càng cứng nên nhận càng nhiều lực.`,
        `Vị trí cân bằng: độ dịch u của bè sao cho tổng thành phần ngang của lực các dây đang căng bằng F theo hướng tải; T thiết kế = T lớn nhất trên mọi hướng, mọi mực nước + lực căng trước T_0 = ${vn(r.pretension_kN, 0)} kN.`,
        `${r.name} (bè có lực dây lớn nhất): F = ${vn(r.fEnv_kN)} kN; chi phối ở mực nước ${vn(g.level_m, 2)} m, tải đẩy về hướng ${g.direction_deg}°, dây ${g.maxLine} chịu ${vn(g.maxTension_kN)} kN, ${g.taut} dây cùng căng; bè trôi ${vn(g.drift_m, 2)} m. Mất dây ${g.maxLine}: dây lớn nhất còn lại ${vn(a.damaged.maxTension_kN)} kN.`,
        `Lực dây thiết kế của ${r.name}: T = ${vn(r.tMax_kN)} kN (đã cộng lực căng trước ${vn(r.pretension_kN, 0)} kN; không nhỏ hơn F / (n × cos α) = ${vn(r.tGeometric_kN)} kN); khi đứt một dây: ${vn(r.tDamaged_kN)} kN. Cáp và cọc bờ của bè kiểm tra với lực này; mỗi đế vít xoắn kiểm tra với lực lớn nhất của chính (các) dây nối vào nó (bao mọi hướng, mọi mực nước).`,
        `Cáp ${r.cable}, lực đứt ${vn(r.mbl_kN, 0)} kN: hệ số an toàn MBL / T = ${vn(r.mbl_kN, 0)} / ${vn(r.tMax_kN)} = ${vn(r.sfIntact, 2)} (yêu cầu ≥ ${vn(st.criteria.sfLineIntact ?? 3, 1)}); khi đứt một dây ${vn(r.mbl_kN, 0)} / ${vn(r.tDamaged_kN)} = ${vn(r.sfDamaged, 2)} (yêu cầu ≥ ${vn(st.criteria.sfLineDamaged ?? 2, 1)}).`,
        ...(r.lineSpacing_m !== null ? [`C9, khoảng cách trung bình giữa các dây: chu vi / số dây = ${vn(r.perimeter_m)} / ${r.lines} = ${vn(r.lineSpacing_m)} m ≤ ${vn(r.maxSpacing_m, 0)} m (bắt buộc; các bè: ${vn(Math.min(...d.rafts.map((x) => x.lineSpacing_m ?? 0)))}–${vn(Math.max(...d.rafts.map((x) => x.lineSpacing_m ?? 0)))} m).`] : []),
        ...(r.bedClearance_m !== null ? [(() => {
          // the engine checks the design depth (MNDB); at MNC the lake is (MNDB − MNC) shallower
          const atMnc = r.bedClearance_m! - (lv.mndb_m - lv.mnc_m);
          return `C8, khoảng hở đáy bè – đáy hồ = chiều sâu nước − mớn nước bè = ${vn(r.bedClearance_m!, 2)} m ở MNDB ≥ ${vn(r.minClearance_m, 1)} m; ở MNC còn ${vn(r.bedClearance_m!, 2)} − (${vn(lv.mndb_m, 2)} − ${vn(lv.mnc_m, 2)}) = ${vn(atMnc, 2)} m` +
            (atMnc >= r.minClearance_m + 0.005 ? ' (đạt).' : atMnc >= r.minClearance_m - 0.005 ? ' (vừa đúng giới hạn).' : atMnc > 0 ? ` — DƯỚI mức ${vn(r.minClearance_m, 1)} m.` : ' — bè CHẠM ĐÁY khi hồ xuống thấp (xem mục 8).');
        })()] : []),
        `Độ trôi bè lớn nhất (mọi hướng, mọi mực nước): ${vn(Math.min(...drifts), 1)} – ${vn(Math.max(...drifts), 1)} m tùy bè (kiểm tra C12: ≤ nửa khoảng hở nhỏ nhất tới bè bên cạnh).`,
        ...(standby.length ? [`Dây ngắn hơn 4 m (${standby.join(', ')}) không tính vào cân bằng: lắp làm dây dự phòng, cắt dài thêm ${vn(STANDBY_SLACK_M, 1)} m — bè trôi chưa tới ${vn(STANDBY_SLACK_M, 1)} m nên chúng không chịu lực.`] : [])
      ]
    },
    hv[4], hv[5],
    {
      title: '7. Chiều dài cắt cáp và điều chỉnh dây',
      lines: [
        `Mỗi dây cắt đủ dài cho mực nước làm khoảng cách bích – chốt dài nhất (${cut.totals.governedBy.MNLKT} dây đáy ở MNLKT, ${cut.totals.governedBy.MNC} dây bờ ở MNC). Tổng chiều dài cắt: dây bờ ${vn(cut.totals.shoreLength_m, 0)} m, dây đáy ${vn(cut.totals.bedLength_m, 0)} m, chưa gồm đoạn bện đầu và phụ kiện.`,
        HV && L.levelCompensation === 'seasonal' && (L.adjustStep_m ?? 0) > 0
          ? `QUY TRÌNH VẬN HÀNH BẮT BUỘC: chỉnh lại mọi dây cho vừa căng mỗi khi mực nước thay đổi ${vn(L.adjustStep_m!, 1)} m (đo từ MNC). Đầu dây phải chỉnh được: dây đáy tới ${vn(cut.totals.maxBedSlackLow_m, 1)} m cả mùa (đoạn xích chỉnh), dây bờ tới ${vn(cut.totals.maxShoreSlackNormal_m, 1)} m (tăng đơ, thêm đoạn xích ở dây ngắn).`
          : L.levelCompensation === 'seasonal'
          ? `Thiết bị bù / điều chỉnh ở đầu bè phải thu – xả được: dây đáy tới ${vn(cut.totals.maxBedSlackLow_m, 1)} m, dây bờ tới ${vn(cut.totals.maxShoreSlackNormal_m, 1)} m (độ chùng lớn nhất của dây cắt cố định), và giữ được lực dây thiết kế. Thiết bị này CHƯA thiết kế.`
          : `Không điều chỉnh: dây đáy chùng tới ${vn(cut.totals.maxBedSlackLow_m, 1)} m ở MNC, dây bờ chùng tới ${vn(cut.totals.maxShoreSlackNormal_m, 1)} m ở MNDB.`
      ]
    },
    {
      title: '8. Giả định và vấn đề còn mở',
      lines: [
        ...lakeCaveats(),
        HV
          ? 'Mô hình cân bằng không xét phân bố tải không đều trên bè lớn và tải động khi dây đang chùng bị giật căng. Độ cứng dây EA = 15 × lực đứt là giả định.'
          : 'Mô hình cân bằng không xét phân bố tải không đều trên bè lớn và tải động khi dây đang chùng bị giật căng.',
        ...(HV
          ? hv[7].lines.filter((x) => !x.startsWith('Số dây làm việc'))
          : [
              'Chưa có khảo sát địa chất: c_u đất bờ và bùn đáy là giả định (lấy như Huổi Vanh).',
              `Đế đặt trên địa hình IFC tại chỗ, chưa phải khảo sát. ${P.shoreBelowNormalWater}/${P.shorePoints} cọc bờ đứng ở chỗ mặt đất thấp hơn MNDB.`
            ])
      ]
    }
  ];
}

// ---------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------

const num = (v: number | null | undefined, d: number): number | string => (v === null || v === undefined || !Number.isFinite(v) ? '-' : Number(v.toFixed(d)));
const sheet = (wb: XLSX.WorkBook, name: string, rows: any[][], cols: number[]) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, name);
};

export const FINAL_DESIGN_SHEETS = ['ThuyetMinh', 'ThongSo', 'LucDay', 'CocKhoanNhoi_TheoBe', 'CocKhoanNhoi_TungCoc', 'DeNeoDay_TungDe', 'VitXoan', 'KhoiLuong_BaoGia', 'ChieuDaiCatCap', ...LIVE_SHEETS];

/**
 * The calculation workbook of the settled design: nine sheets of results (values from the engine) and the
 * four `CT_` sheets with live Excel formulas. Pure builder, no DOM.
 */
export function buildFinalDesignWorkbook(d: FinalDesign): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const st = d.state, A = st.anchor, E = st.env;
  const prm = d.schedule.bases[0].design.params, g0 = d.schedule.bases[0].design;
  const title = (t: string) => [`${t} — ${d.code}`];
  const caveat = d.windCaveat ? [`CHÚ Ý: ${d.windCaveat}`] : [''];

  // 1. note
  const note: any[][] = [title('THUYẾT MINH TÍNH TOÁN HỆ NEO: CỌC KHOAN NHỒI VEN BỜ + ĐẾ BTCT VÍT XOẮN'), [`Dự án: ${d.name}`], ['']];
  note.push([d.rafts.some((r) => r.analysis)
    ? 'File này gồm 9 sheet KẾT QUẢ do web tính (dạng số) và sheet CanBangNeo_MucNuoc (cân bằng của bè theo từng mực nước). Lực dây là kết quả lặp của mô hình cân bằng nên không có sheet công thức CT_.'
    : 'File này có hai phần: 9 sheet đầu là KẾT QUẢ do web tính (dạng số); 4 sheet CT_… ở cuối là cùng phép tính đó dưới dạng CÔNG THỨC Excel — đổi ô nhập (tô vàng / ghi chữ NHẬP) là tự tính lại.'], ['']);
  for (const s of finalDesignNote(d)) { note.push([s.title]); for (const l of s.lines) note.push([`  ${l}`]); note.push(['']); }
  sheet(wb, FINAL_DESIGN_SHEETS[0], note, [180]);

  // 2. parameters
  const R0 = d.rafts[0];
  const par: any[][] = [title('THÔNG SỐ ĐẦU VÀO VÀ GIẢ ĐỊNH'), caveat, [''], ['NHÓM', 'THÔNG SỐ', 'GIÁ TRỊ', 'ĐƠN VỊ', 'NGUỒN / GHI CHÚ'],
    ['Gió', 'Vận tốc gió tính toán V', d.wind_ms, 'm/s', 'Chủ đầu tư chốt 08/10/2026'],
    ['Gió', 'Khối lượng riêng không khí ρ', E.airDensity ?? 1.25, 'kg/m³', ''],
    ['Gió', 'Áp lực gió q = 0,5ρV²', num(R0.q_Pa, 1), 'N/m²', ''],
    ['Gió', 'Diện tích một tấm pin', R0.panelArea_m2, 'm²', ''],
    ['Gió', 'Góc nghiêng tấm pin', R0.tilt_deg, '°', ''],
    ['Gió', 'Hệ số cản tấm pin C_d', R0.cdPanel, '', ''],
    ['Gió', 'Hệ số che chắn giữa các hàng', R0.shield, '', 'GIẢ ĐỊNH'],
    ['Gió', 'Hệ số gộp sóng + dòng chảy', R0.waveCurrentFactor, '', 'DNV-ST-0119, TCVN 6170-3'],
    ['Mực nước', 'MNC', d.points.levels.mnc_m, 'm', ''],
    ['Mực nước', 'MNDB', d.points.levels.mndb_m, 'm', ''],
    ['Mực nước', 'MNLKT', d.points.levels.mnlkt_m, 'm', ''],
    ['Dây neo', 'Số dây làm việc n', R0.nEff, 'dây', 'GIẢ ĐỊNH, như nhau cho mọi bè'],
    ['Dây neo', 'Góc dây so với phương ngang α', R0.alpha_deg, '°', 'GIẢ ĐỊNH'],
    ['Dây neo', 'Lực căng trước T_0', R0.pretension_kN, 'kN', ''],
    ['Dây neo', 'Hệ số an toàn cáp (nguyên vẹn / đứt một dây)', `${st.criteria.sfLineIntact ?? 3} / ${st.criteria.sfLineDamaged ?? 2}`, '', ''],
    ['Cọc bờ', 'Loại cọc', 'Cọc khoan nhồi tròn, đổ tại chỗ', '', ''],
    ['Cọc bờ', 'Đường kính D', A.shoreD_m ?? 0.35, 'm', ''],
    ['Cọc bờ', 'Chiều sâu ngàm thiết kế L_tk', A.shoreL_m ?? 6.5, 'm', ''],
    ['Cọc bờ', 'Điểm móc cáp cách mặt đất e', A.shoreArm_e_m ?? 0.1, 'm', 'Yêu cầu thi công'],
    ['Cọc bờ', 'c_u đất bờ', A.cuShore_kPa ?? 40, 'kPa', 'GIẢ ĐỊNH, chưa khảo sát'],
    ['Cọc bờ', 'Hệ số an toàn chịu ngang (Broms)', A.sfPile ?? 2.5, '', ''],
    ['Cọc bờ', 'Hệ số tải trọng khi kiểm tra uốn', A.pileBendingLoadFactor ?? 1.2, '', 'TCVN 2737'],
    ['Cọc bờ', 'Cường độ bê tông R_b', A.concreteRb_MPa ?? 14.5, 'MPa', ''],
    ['Đế BTCT', 'Chiều dày đế t (nhỏ nhất)', prm.thickness_m, 'm', 'Cạnh B tự tăng 0,25 m cho tới khi đạt'],
    ['Đế BTCT', 'Trọng lượng riêng bê tông / nước', `${prm.gammaConcrete_kNm3} / ${prm.gammaWater_kNm3}`, 'kN/m³', "W' = V × (γ_bt − γ_n): đã trừ đẩy nổi"],
    ['Đế BTCT', 'Hệ số trọng lượng khi chống nhổ', prm.weightFactor, '', 'GIẢ ĐỊNH'],
    ['Đế BTCT', 'Chiều cao tai neo trên mặt đế', prm.padeyeHeight_m, 'm', ''],
    ['Đế BTCT', 'Chiều cao bích bè trên mặt nước', prm.cleatHeight_m, 'm', 'Mạn khô của phao'],
    ['Đế BTCT', 'Gờ chống trượt dưới đế', prm.skirtDepth_m, 'm', ''],
    ['Đế BTCT', 'c_u bùn đáy hồ', prm.cuSurface_kPa, 'kPa', 'GIẢ ĐỊNH, chưa khảo sát'],
    ['Đế BTCT', "γ' bùn", prm.gammaSubMud_kNm3, 'kN/m³', 'GIẢ ĐỊNH'],
    ['Đế BTCT', 'Hệ số bám dính đáy đế α', prm.alphaBase, '', 'GIẢ ĐỊNH'],
    ['Đế BTCT', 'Hệ số an toàn trượt / lật / nền', `${prm.sfSlide} / ${prm.sfOverturn} / ${prm.sfBearing}`, '', ''],
    ['Vít xoắn', 'Số vít mỗi đế', prm.screwCount, 'cây', ''],
    ['Vít xoắn', 'Ống thép Ø × dày', `Ø${Math.round(prm.tubeDia_m * 1000)} × ${Math.round(prm.tubeThk_m * 1000)}`, 'mm', ''],
    ['Vít xoắn', 'Đường kính ren', Math.round(prm.threadDia_m * 1000), 'mm', ''],
    ['Vít xoắn', 'Chiều dài ngàm trong bùn', prm.screwLength_m, 'm', ''],
    ['Vít xoắn', 'Hệ số bám dính thân vít α', prm.alphaShaft, '', 'GIẢ ĐỊNH'],
    ['Vít xoắn', 'Giới hạn chảy thép ống', prm.fy_kPa / 1000, 'MPa', ''],
    ['Vít xoắn', 'Hệ số an toàn nhổ vít', prm.sfScrewUplift, '', '']
  ];
  sheet(wb, FINAL_DESIGN_SHEETS[1], par, [12, 46, 30, 10, 46]);

  // 3. loads and line tension
  const ld: any[][] = [title('LỰC GIÓ VÀ LỰC CĂNG DÂY TỪNG BÈ'), caveat,
    ['F_pin = q × C_d × (số tấm × A_tấm × sin nghiêng) × che chắn | F = (F_pin + F_phao) × hệ số sóng, dòng chảy | T = max(F × k + T_0 ; F / (n × cos α) + T_0)'], [''],
    ['BÈ', 'Diện tích (m²)', 'Chu vi (m)', 'Số dây', 'Dây bờ', 'Dây đáy', 'Số tấm pin', 'A đón gió (m²)', 'q (N/m²)', 'F pin (kN)', 'F phao (kN)', 'F gió (kN)', 'F tổng (kN)',
      'Hệ số tập trung k', 'T cách k (kN)', 'T cách n dây (kN)', 'Cách chi phối', 'T dây (kN)', 'T khi đứt 1 dây (kN)', 'Cáp', 'Lực đứt (kN)', 'HSAT cáp', 'HSAT khi đứt 1 dây', 'KẾT LUẬN BÈ']];
  for (const r of d.rafts) {
    ld.push([r.name, num(r.area_m2, 0), num(r.perimeter_m, 1), r.lines, r.shoreLines, r.bedLines, r.panels, num(r.areaProjected_m2, 1), num(r.q_Pa, 1), num(r.fPanel_kN, 1), num(r.fFloat_kN, 1), num(r.fWind_kN, 1), num(r.fEnv_kN, 1),
      num(r.focusFactor, 3), num(r.tFocus_kN, 1), num(r.tGeometric_kN, 1), r.method === 'focus' ? 'Hệ số tập trung' : r.method === 'equilibrium' ? 'Cân bằng tĩnh theo mực nước' : 'Chia n dây', num(r.tMax_kN, 1), num(r.tDamaged_kN, 1), r.cable, num(r.mbl_kN, 0), num(r.sfIntact, 2), num(r.sfDamaged, 2), r.verdict === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT']);
  }
  sheet(wb, FINAL_DESIGN_SHEETS[2], ld, [8, 12, 10, 8, 8, 8, 10, 13, 9, 10, 10, 10, 11, 14, 12, 14, 16, 10, 16, 12, 11, 9, 15, 13]);

  // 4. shore pile per raft
  const pr: any[][] = [title('TÍNH TOÁN CỌC KHOAN NHỒI VEN BỜ THEO BÈ'), caveat,
    [`BP-1 (Broms, đất sét c_u = ${A.cuShore_kPa ?? 40} kPa): H_cho phép = H_u / ${A.sfPile ?? 2.5} ≥ T | BP-2 (TCVN 5574:2018): γ × M_max ≤ M_rd | P_max: lực dây lớn nhất cọc chịu được ở L_tk. Thông số đất là GIẢ ĐỊNH.`], [''],
    ['BÈ', 'Số cọc', 'D (m)', 'L_tk (m)', 'L cả cọc (m)', 'Thép chủ', 'Mác thép', 'Cốt đai', 'T dây (kN)', 'H_u (kN)', 'H cho phép (kN)', 'BP-1 ngang', 'M_max (kNm)', 'γ × M_max (kNm)', 'M_rd (kNm)', 'BP-2 uốn', 'P_max (kN)',
      'Bê tông 1 cọc (m³)', 'Thép 1 cọc (kg)', 'Tổng dài (m)', 'Tổng bê tông (m³)', 'Tổng thép (kg)', 'KẾT LUẬN']];
  for (const r of d.rafts) {
    for (const t of r.pileTypes) {
      const label = r.pileTypes.length > 1 ? `${r.name} (${t.light ? `cọc đơn, dây ≤ ${vn(t.tension_kN, 1)} kN` : t.perPoint > 1 ? 'cọc đôi' : 'cọc của bè'}, ${t.points} điểm)` : r.name;
      pr.push([label, t.piles, num(t.D_m, 2), num(t.L_m, 1), num(t.Ltotal_m, 2), t.cage, t.grade, t.stirrup, num(t.tension_kN, 1), num(t.Hu_kN, 1), num(t.Hallow_kN, 1), num(t.bp1, 2),
        num(t.Mmax_kNm, 1), num(r.loadFactor * t.Mmax_kNm, 1), num(t.Mrd_kNm, 1), num(t.bp2, 2), num(t.Pmax_kN, 1), num(t.concretePerPile_m3, 3), num(t.steelPerPile_kg, 1),
        num(t.piles * t.Ltotal_m, 1), num(t.piles * t.concretePerPile_m3, 1), num(t.piles * t.steelPerPile_kg, 0), t.bp1 <= 1 && t.bp2 <= 1 ? 'ĐẠT' : 'KHÔNG ĐẠT']);
    }
  }
  const T = d.totals;
  pr.push(['TỔNG', T.shorePiles, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', num(T.shoreLength_m, 1), num(T.shoreConcrete_m3, 1), num(T.shoreSteel_kg, 0), '']);
  sheet(wb, FINAL_DESIGN_SHEETS[3], pr, [8, 8, 7, 9, 12, 10, 10, 16, 10, 10, 14, 11, 12, 15, 11, 10, 11, 17, 14, 12, 16, 14, 12]);

  // 5. every shore pile
  const pileById = new Map(d.schedule.shorePiles.map((p) => [p.pileId, p]));
  const sp: any[][] = [title(`THỐNG KÊ VÀ TÍNH TOÁN TỪNG CỌC KHOAN NHỒI VEN BỜ (${T.shorePiles} CỌC)`), caveat,
    ['Sức chịu của cọc không phụ thuộc vị trí (cùng giả định đất) nên BP-1, BP-2 lặp lại theo loại cọc của bè (cọc của bè, hoặc cọc đơn ở điểm mà lực của chính dây nhỏ); riêng từng cọc là tọa độ, cao độ mặt đất (địa hình IFC), chiều dài dây và góc cáp ở hai mực nước.'], [''],
    ['STT', 'MÃ CỌC', 'DÂY NEO', 'BÈ', 'NGUỒN GỐC', 'X (m)', 'Y (m)', 'Cao độ mặt đất (m)', 'D (m)', 'L_tk (m)', 'L cả cọc (m)', 'Thép chủ', 'Mác thép', 'Cốt đai', 'Bê tông (m³)', 'Thép (kg)',
      'Dây dài (m)', 'Phương vị (°)', 'T dây (kN)', 'P_max (kN)', 'BP-1 ngang', 'BP-2 uốn', 'Đầu cọc', 'Góc cáp MNC (°)', 'Góc cáp MNLKT (°)', 'Mặt đất thấp hơn MNDB', 'KẾT LUẬN', 'GHI CHÚ']];
  d.points.shore.forEach((p: ShorePointRow) => {
    const q = pileById.get(p.pileId);
    sp.push([p.no, p.pileId, p.code, p.raft, p.converted ? 'Cọc mới (ven bờ)' : 'Cọc đã định vị', num(p.x, 2), num(p.y, 2), num(p.ground_m, 2), num(p.D_m, 2), num(p.L_m, 1), num(q?.Ltotal_m, 2), p.cage, p.grade, q?.cage.stirrupLabel ?? '-',
      num(q?.cage.concreteVol_m3, 3), num(q?.cage.steel_kg, 1), num(p.span_m, 2), num(p.azimuth_deg, 1), num(p.tension_kN, 1), num(q?.Pmax_kN, 1), num(p.bp1, 2), num(p.bp2, 2), num(p.headUtil, 2),
      num(p.slopeLow_deg, 1), num(p.slopeHigh_deg, 1), p.belowNormalWater ? 'CÓ' : 'không', p.ok ? 'ĐẠT' : 'KHÔNG ĐẠT', p.note]);
  });
  sheet(wb, FINAL_DESIGN_SHEETS[4], sp, [5, 11, 10, 8, 16, 10, 10, 12, 7, 8, 11, 10, 10, 16, 11, 10, 10, 11, 10, 10, 10, 9, 9, 12, 13, 13, 11, 70]);

  // 6. every base
  const bs: any[][] = [title(`THỐNG KÊ VÀ TÍNH TOÁN TỪNG ĐẾ NEO ĐÁY: ĐẾ BTCT + ${prm.screwCount} VÍT XOẮN (${T.bases} ĐẾ)`), caveat,
    [`Đế dùng chung hai dây: kiểm tra dây 1 căng + dây 2 ở lực căng trước, ngược lại, và cả hai cùng căng, ở MNC và MNLKT. SV-1: T_v ≤ ${prm.weightFactor}W' + nQ_a | SV-2: ${prm.sfSlide}T_h ≤ bám dính + gờ + nH_u | SV-3: ${prm.sfOverturn}M_lật ≤ M_giữ | SV-4: N_1 ≤ Q_a | SV-5: W'/B² ≤ 5,14c_u/${prm.sfBearing}.`], [''],
    ['STT', 'MÃ ĐẾ', 'DÂY 1', 'BÈ 1', 'T 1 (kN)', 'Dài 1 (m)', 'DÂY 2', 'BÈ 2', 'T 2 (kN)', 'Dài 2 (m)', 'X (m)', 'Y (m)', 'Cao độ đáy (m)', 'Sâu nước MNC (m)', 'Sâu nước MNLKT (m)',
      'Tổ hợp chi phối', 'T_h (kN)', 'T_v (kN)', 'B (m)', 't (m)', 'V bê tông (m³)', 'Nặng trên cạn (kN)', "W' trong nước (kN)", 'Cẩu (tấn)', 'Lưới thép 2 lớp', 'Thép bản (kg)',
      'Số vít', 'Vít Ø × dày', 'Dài 1 vít (m)', 'Sức chống nhổ (kN)', 'M_lật (kNm)', 'M_giữ (kNm)', 'N 1 vít (kN)',
      'SV-1 nhổ', 'SV-2 trượt', 'SV-3 lật', 'SV-4 một vít', 'SV-5 nền', 'SV-6 thép', 'KẾT LUẬN', 'GHI CHÚ']];
  for (const r of d.points.bed) {
    const b = r.base, [l1, l2] = b.lines, g = b.design, c = g.cases[1];
    const gov = b.combinations.find((x) => x.name === b.governing) ?? b.combinations[0];
    bs.push([r.no, b.baseId, l1.code, l1.raft, num(l1.tension_kN, 1), num(l1.span_m, 2), l2?.code ?? '-', l2?.raft ?? '-', num(l2?.tension_kN, 1), num(l2?.span_m, 2),
      num(b.x, 2), num(b.y, 2), num(b.z, 2), num(b.depthLow_m, 2), num(b.depthHigh_m, 2), b.governing, num(gov.Th_kN, 1), num(gov.Tv_kN, 1),
      num(b.side_m, 2), num(b.thickness_m, 2), num(b.concrete_m3, 2), num(g.weightAir_kN, 1), num(g.weightSub_kN, 1), num(b.liftMass_t, 1), `Ø${g.rebarDia_mm} a${Math.round(g.rebarSpacing_m * 1000)}`, num(b.rebar_kg, 0),
      b.screwCount, `Ø${Math.round(g.params.tubeDia_m * 1000)}×${Math.round(g.params.tubeThk_m * 1000)}`, num(b.screwLength_m / b.screwCount, 2), num(c.upliftResistance_kN, 1), num(c.overturningMoment_kNm, 1), num(c.resistingMoment_kNm, 1), num(c.screwPull_kN, 2),
      num(b.upliftUtil, 2), num(b.slideUtil, 2), num(b.overturnUtil, 2), num(b.screwUtil, 2), num(b.bearingUtil, 2), num(b.rebarUtil, 2), b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT', r.note]);
  }
  bs.push(['']);
  bs.push(['TỔNG', `${T.bases} đế`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', num(T.upliftDemand_kN, 0), '', '', num(T.baseConcrete_m3, 1), '', '', '', '', num(T.baseRebar_kg, 0), T.screws, '', '', num(T.upliftResistance_kN, 0)]);
  bs.push(['Ghi chú: cột M_lật, M_giữ, N 1 vít, sức chống nhổ là của tổ hợp chi phối; các cột SV là giá trị lớn nhất trên mọi tổ hợp.']);
  sheet(wb, FINAL_DESIGN_SHEETS[5], bs, [5, 11, 10, 8, 9, 9, 10, 8, 9, 9, 10, 10, 12, 13, 14, 36, 9, 9, 7, 7, 12, 14, 14, 9, 13, 11, 7, 10, 11, 14, 11, 11, 11, 9, 9, 9, 10, 9, 9, 11, 60]);

  // 7. the screw pile
  const scrLen = prm.screwLength_m + prm.thickness_m + 0.3;
  const vx: any[][] = [title('TÍNH TOÁN VÍT XOẮN'), [''],
    ['BƯỚC', 'ĐẠI LƯỢNG', 'CÔNG THỨC', 'GIÁ TRỊ', 'ĐƠN VỊ'],
    [1, 'Ma sát thân vít', `α × c_u × π × D_ren × L = ${prm.alphaShaft} × ${prm.cuAverage_kPa} × π × ${prm.threadDia_m} × ${prm.screwLength_m}`, num(g0.screwShaftFriction_kN, 2), 'kN'],
    [2, 'Sức chịu của cánh xoắn', prm.helixCount > 0 ? `${prm.helixCount} cánh Ø${Math.round(prm.helixDia_m * 1000)}` : 'Không tính (vít chỉ có ren, không có cánh lớn)', num(g0.screwHelix_kN, 2), 'kN'],
    [3, 'Sức chịu kéo của ống thép', 'A_thép × f_y', num(g0.screwSteelTension_kN, 1), 'kN'],
    [4, 'Sức chịu nhổ cực hạn Q_u', 'min(bước 1 + bước 2 ; bước 3)', num(g0.screwQu_kN, 2), 'kN'],
    [5, 'Sức chịu nhổ cho phép Q_a', `Q_u / ${prm.sfScrewUplift}`, num(g0.screwQa_kN, 2), 'kN'],
    [6, 'Sức chịu ngang theo đất (Broms)', 'Cọc ngắn đầu tự do, đất dính', num(g0.screwHuSoil_kN, 2), 'kN'],
    [7, 'Sức chịu ngang theo thép ống', 'Khớp dẻo trong thân vít', num(g0.screwHuSteel_kN, 2), 'kN'],
    [8, 'Sức chịu ngang cực hạn H_u', 'min(bước 6 ; bước 7)', num(g0.screwHu_kN, 2), 'kN'],
    [9, `${prm.screwCount} vít của một đế: chống nhổ`, `${prm.screwCount} × Q_a`, num(prm.screwCount * g0.screwQa_kN, 1), 'kN'],
    [10, 'Chiều dài chế tạo một vít', `ngàm ${prm.screwLength_m} + dày đế ${prm.thickness_m} + đầu khóa 0,3`, num(scrLen, 2), 'm'],
    [11, 'Tổng số vít / tổng chiều dài', `${T.bases} đế × ${prm.screwCount} vít`, `${T.screws} cây / ${num(T.screwLength_m, 1)} m`, ''],
    [''],
    ['Vít chỉ là phần phụ: phần lớn lực nhổ do trọng lượng đế gánh. Sức chịu của vít tỷ lệ thuận với c_u bùn (GIẢ ĐỊNH). Sức chịu nhổ và sức chịu ngang tính độc lập, chưa xét tương tác. Chưa thiết kế khóa đầu vít và chống ăn mòn.'],
    [''],
    ['MÃ ĐẾ', 'B (m)', 'Lực nhổ T_v (kN)', "0,9 W' (kN)", 'Phần vít phải gánh (kN)', 'N lớn nhất 1 vít (kN)', 'Q_a (kN)', 'Mức sử dụng 1 vít', 'KẾT LUẬN']];
  for (const b of d.schedule.bases) {
    const tv = Math.max(...b.combinations.map((c) => c.Tv_kN)), w = b.design.params.weightFactor * b.design.weightSub_kN;
    vx.push([b.baseId, num(b.side_m, 2), num(tv, 1), num(w, 1), num(Math.max(0, tv - w), 1), num(b.screwUtil * b.design.screwQa_kN, 2), num(b.design.screwQa_kN, 2), num(b.screwUtil, 2), b.screwUtil <= 1 ? 'ĐẠT' : 'KHÔNG ĐẠT']);
  }
  sheet(wb, FINAL_DESIGN_SHEETS[6], vx, [11, 34, 62, 22, 22, 20, 10, 18, 12]);

  // 8. quantities and quotation
  const c = d.cost, cp = d.costParams;
  const kl: any[][] = [title('KHỐI LƯỢNG VÀ BÁO GIÁ THI CÔNG'), [`Phương án chốt: ${FINAL_OPTION_TITLE}`],
    ['Đơn giá cọc khoan nhồi là giá THAM KHẢO thị trường do Chủ đầu tư cung cấp, không phải báo giá nhà thầu. Hạng mục ghi "CHƯA CÓ ĐƠN GIÁ" chưa nằm trong tổng.'], [''],
    ['STT', 'HẠNG MỤC', 'ĐƠN VỊ', 'KHỐI LƯỢNG', 'ĐƠN GIÁ (VNĐ)', 'THÀNH TIỀN (VNĐ)', 'GHI CHÚ']];
  for (const l of c.lines) kl.push([l.no, l.item, l.unit, num(l.quantity, 1), Math.round(l.rate), Math.round(l.amount_VND), l.note]);
  if (c.unpriced.length > 0) kl.push(['', `CHÚ Ý: ${c.unpriced.length} hạng mục CHƯA CÓ ĐƠN GIÁ, tổng bên dưới CHƯA gồm các hạng mục này.`]);
  kl.push(['', 'CỘNG CHI PHÍ TRỰC TIẾP', '', '', '', Math.round(c.directTotal_VND)]);
  kl.push(['', `Dự phòng phí ${cp.contingencyPercent}%`, '', '', '', Math.round(c.contingency_VND)]);
  kl.push(['', cp.includeVat ? `Thuế VAT ${cp.vatPercent}%` : 'Thuế VAT (không tính)', '', '', '', Math.round(c.vat_VND)]);
  kl.push(['', c.unpriced.length > 0 ? 'TỔNG CỘNG (chưa gồm hạng mục chưa có đơn giá)' : 'TỔNG CỘNG', '', '', '', Math.round(c.grandTotal_VND)]);
  kl.push(['']);
  kl.push(['KHỐI LƯỢNG KHÁC (không có trong báo giá)']);
  kl.push(['', 'Bê tông cọc khoan nhồi', 'm³', num(T.shoreConcrete_m3, 1)]);
  kl.push(['', 'Cốt thép cọc khoan nhồi', 'tấn', num(T.shoreSteel_kg / 1000, 1)]);
  kl.push(['', 'Đế nặng nhất khi cẩu', 'tấn', num(T.maxLift_t, 1)]);
  kl.push(['', 'Chưa gồm: cáp neo và phụ kiện, tai neo và khóa đầu vít của đế, bích neo đầu cọc, khảo sát, thử tải.']);
  kl.push(['']);
  kl.push(['KHỐI LƯỢNG THEO BÈ (đế dùng chung tính mỗi bè một nửa)']);
  kl.push(['BÈ', 'Số cọc bờ', 'Cọc bờ (md)', 'Số đế', 'Bê tông đế (m³)', 'Thép bản (kg)', 'Vít (md)']);
  for (const r of d.rafts) {
    const q = d.schedule.byRaft.find((x) => x.name === r.name);
    kl.push([r.name, r.pileCount, num(r.pileLength_m, 1), num(q?.bases ?? 0, 1), num(q?.concrete_m3 ?? 0, 1), num(q?.rebar_kg ?? 0, 0), num(q?.screwLength_m ?? 0, 1)]);
  }
  const wsK = XLSX.utils.aoa_to_sheet(kl);
  wsK['!cols'] = [8, 70, 12, 16, 16, 18, 36].map((wch) => ({ wch }));
  for (const addr of Object.keys(wsK)) { if (addr[0] !== '!' && wsK[addr].t === 'n') wsK[addr].z = Number.isInteger(wsK[addr].v) ? '#,##0' : '#,##0.0'; }
  XLSX.utils.book_append_sheet(wb, wsK, FINAL_DESIGN_SHEETS[7]);

  // 9. cutting lengths
  appendCableCuttingSheet(wb, buildCableCuttingSchedule(st), st);

  // Equilibrium analysis (both lakes since 2026-10-23): it replaces the single-angle tension, which the live CT_ sheets implement — so they are left out
  if (d.rafts.some((r) => r.analysis)) {
    const eq: any[][] = [title('CÂN BẰNG TĨNH CỦA BÈ TRÊN CÁC DÂY THẬT, THEO MỰC NƯỚC'), caveat,
      ['Mỗi mực nước: lực dây lớn nhất và độ trôi lớn nhất của bè trong 24 hướng tải. Dây chùng không chịu lực. Bốn sheet CT_ (công thức một góc dây 30°) không áp dụng khi lực dây tính bằng cân bằng nên không xuất.'], [''],
      ['BÈ', 'Mực nước (m)', 'T lớn nhất (kN)', 'Dây chịu lớn nhất', 'Hướng tải (°)', 'Độ trôi lớn nhất (m)', 'Số dây căng ít nhất']];
    for (const r of d.rafts) for (const l of r.analysis?.levels ?? []) {
      eq.push([r.name, num(l.level_m, 2), num(l.maxTension_kN, 1), l.maxLine, l.direction_deg, Number.isFinite(l.maxDrift_m) ? num(l.maxDrift_m, 2) : 'KHÔNG GIỮ ĐƯỢC', l.minTaut]);
    }
    sheet(wb, 'CanBangNeo_MucNuoc', eq, [8, 14, 15, 18, 14, 20, 18]);
    return wb;
  }

  // 10–13. the same calculation as live Excel formulas
  for (const s of buildLiveCalcSheets(d).sheets) XLSX.utils.book_append_sheet(wb, s.ws, s.name);
  return wb;
}

/** `bang-tinh-phuong-an-chot_<code>_<YYYYMMDD>.xlsx` */
export function finalDesignFileName(d: FinalDesign, now: Date = new Date()): string {
  const code = d.code.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'HV-FPV-2026';
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `bang-tinh-phuong-an-chot_${code}_${stamp}.xlsx`;
}

export function exportFinalDesignToExcel(state: ProjectState, results: CalcResults, batch: PileScheduleBatchLike[], costParams?: CostParams): string {
  const d = buildFinalDesign(state, results, batch, costParams);
  const filename = finalDesignFileName(d);
  XLSX.writeFile(buildFinalDesignWorkbook(d), filename);
  return filename;
}
