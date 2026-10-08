import * as XLSX from 'xlsx';
import { calculateProject } from '../calc';
import type { CalcResults, ProjectState } from '../calc/types';
import { designShorePileHead } from '../calc/shorePileHead';
import { designWindCaveat } from '../calc/designWind';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../data/huoiVanhLayout';
import { buildPileSchedule, PileScheduleBatchLike } from './pileSchedule';
import { buildScrewBaseSchedule, ScrewBaseRow, BASE_LOW_WATER_M, BASE_HIGH_WATER_M } from './screwBaseSchedule';
import { groundAt, MNDB_M, CLEAT_ABOVE_WATERLINE_M } from '../../components/simulation/sceneModel';

/**
 * Anchor-by-anchor calculation: every shore pile and every lake-bed base with
 * ITS OWN geometry — plan span of its cable(s), the level it stands on and the
 * reservoir levels MNC and MNLKT.
 *
 * Levels. A lake-bed base stands on the DESIGN lake-bed level of the layout
 * (`zAnchor` = MNDB − the raft's design water depth, 378.3–378.5 m): the owner's
 * instruction of 2026-10-08 — "neo đế vít xoắn luôn ở đáy hồ". That level is a
 * design assumption, not a survey. The IFC terrain model reads higher at some
 * points; the difference is reported beside each base as information, it does
 * not enter the calculation. Shore piles use the IFC terrain (project datum).
 *
 * What is per point and what is not:
 *  - geometry (span, level, water depth, cable angle) is per point;
 *  - the line tension is the governing tension of the line's RAFT. The engine
 *    has no force-distribution model per line, so every line of a raft is
 *    checked for the raft's worst-line tension — conservative for most lines.
 *
 * Lake-bed bases come from `buildScrewBaseSchedule` (one row per base, a base
 * shared by two rafts appears once). Shore points: the Broms and bending
 * checks do not depend on the position (same soil assumption everywhere), so
 * they repeat the raft's values; what is per point is the cable slope at the
 * two levels and whether the pile head is under water at MNLKT.
 */
export interface BedPointRow {
  no: number;
  /** The base, as in the anchor schedule. */
  base: ScrewBaseRow;
  /** IFC terrain level at the base, m (project datum); null outside the terrain model. For information only. */
  terrain_m: number | null;
  /** terrain_m − design lake bed, m (null when unknown). */
  terrainAboveBed_m: number | null;
  /** Worst of the six checks over every load combination. */
  util: number;
  note: string;
}

export interface ShorePointRow {
  no: number;
  pileId: string;
  code: string;
  raft: string;
  x: number;
  y: number;
  /** Ground level at the pile, m (project datum); null outside the terrain model. */
  ground_m: number | null;
  span_m: number;
  azimuth_deg: number;
  /** A lake-bed line turned into a bored pile by the owner's rule (near the shore -> bored pile). */
  converted: boolean;
  pileCount: number;
  D_m: number;
  L_m: number;
  cage: string;
  grade: string;
  /** Line tension and tension per pile, kN. */
  tension_kN: number;
  pileTension_kN: number;
  /** Broms lateral and bending utilisation of the raft's shore pile. */
  bp1: number | null;
  bp2: number | null;
  /** Worst utilisation of the pile-head detail (H-1..H-8) for this raft's pile tension. */
  headUtil: number | null;
  headGoverning: string;
  /** Cable angle at the pile head, degrees above (+) or below (−) the horizontal, at MNC and at MNLKT. */
  slopeLow_deg: number | null;
  slopeHigh_deg: number | null;
  /** The ground at the pile is under the normal water level (MNDB): the pile is built in the dry season / with a casing. */
  belowNormalWater: boolean;
  /** The pile head is under water at MNLKT. */
  floodedAtHighWater: boolean;
  ok: boolean;
  note: string;
}

export interface AnchorPointSchedule {
  levels: { mnc_m: number; mndb_m: number; mnlkt_m: number };
  shore: ShorePointRow[];
  bed: BedPointRow[];
  totals: {
    /** Shore piles + lake-bed bases. */
    points: number;
    lines: number;
    shorePoints: number;
    convertedShorePoints: number;
    bedBases: number;
    sharedBases: number;
    bedLines: number;
    shoreOk: number;
    bedOk: number;
    bedConcrete_m3: number;
    /** Bases per side length, e.g. { '2.50': 40, '2.75': 11 }. */
    basesBySide: Record<string, number>;
    maxLiftMass_t: number;
    /** Lake-bed bases where the IFC terrain is more than 0.5 m above the design lake bed (to be checked on site). */
    terrainHigherPoints: number;
    shoreBelowNormalWater: number;
    floodedShoreHeads: number;
    longestShoreSpan_m: number;
  };
}

/** A terrain reading this far above the design lake bed is worth a note, m. */
const TERRAIN_NOTE_M = 0.5;

export function buildAnchorPointSchedule(
  state: ProjectState,
  results: CalcResults,
  batchResults?: PileScheduleBatchLike[],
  coordinates?: MooringCoordinate[]
): AnchorPointSchedule {
  const coords = coordinates ?? MOORING_LINES_V2;
  const piles = buildPileSchedule(state, results, batchResults, coords);
  const bases = buildScrewBaseSchedule(state, results, batchResults, coords);
  const byRaft = new Map<string, PileScheduleBatchLike>();
  for (const b of batchResults ?? []) byRaft.set(b.raft.name, b);
  const cache = new Map<string, { st: ProjectState; res: CalcResults }>();
  const raftOf = (raft: string) => {
    const hit = cache.get(raft);
    if (hit) return hit;
    const batch = byRaft.get(raft);
    const st = batch?.state ?? state;
    const res = batch?.results ?? (batch?.state ? calculateProject(st) : results);
    const out = { st, res };
    cache.set(raft, out);
    return out;
  };
  const util = (res: CalcResults, id: string) => res.checks.find((c) => c.id === id)?.utilization ?? null;

  const bed: BedPointRow[] = bases.bases.map((b, i) => {
    const terrain = groundAt(b.x, b.y);
    const above = terrain === null ? null : terrain - b.z;
    return {
      no: i + 1, base: b, terrain_m: terrain, terrainAboveBed_m: above,
      util: Math.max(b.upliftUtil, b.slideUtil, b.overturnUtil, b.screwUtil, b.bearingUtil, b.rebarUtil),
      note: [
        b.shared ? 'Đế dùng chung hai bè: hai tai neo' : '',
        above !== null && above > TERRAIN_NOTE_M ? `Địa hình IFC tại điểm này cao hơn đáy thiết kế ${above.toFixed(1).replace('.', ',')} m: kiểm tra khảo sát / nạo vét trước khi đặt đế` : '',
        b.design.enlarged ? 'Đế lớn hơn đế mẫu' : '',
        b.ok ? '' : 'KHÔNG có đế nào (đến 8 m) đạt',
        b.clashWith.length ? `Chồng lấn với ${b.clashWith.join(', ')}` : ''
      ].filter(Boolean).join('; ')
    };
  });

  const converted = new Set(coords.filter((c) => c.converted).map((c) => c.code));
  const shore: ShorePointRow[] = [];
  for (const p of piles) {
    if (p.type !== 'SHORE') continue;
    const { st, res } = raftOf(p.raft);
    const ground = groundAt(p.x, p.y);
    const sf = st.anchor.sfPileCapacity ?? 1.0;
    const pileT = p.Preq_kN / (sf > 0 ? sf : 1);
    const head = p.cage.shape === 'circular'
      ? designShorePileHead({
        tension_kN: pileT, loadFactor: st.anchor.pileBendingLoadFactor ?? 1.2, pileDia_m: p.D_m,
        attachHeight_m: st.anchor.shoreArm_e_m ?? 0.1, cableMbl_kN: st.line.mbl_kN
      })
      : undefined;
    const worst = head?.checks.reduce((a, b) => (b.utilization > a.utilization ? b : a), head.checks[0]);
    const pin = ground === null ? null : ground + (st.anchor.shoreArm_e_m ?? 0.1);
    const slope = (level: number) => (pin === null ? null : (Math.atan2(level + CLEAT_ABOVE_WATERLINE_M - pin, Math.max(0.1, p.span_m)) * 180) / Math.PI);
    const bp1 = util(res, 'BP-1'), bp2 = util(res, 'BP-2');
    const flooded = pin !== null && pin < BASE_HIGH_WATER_M;
    const wet = ground !== null && ground < MNDB_M;
    const ok = p.isPmaxOk && (bp1 ?? 0) <= 1 && (bp2 ?? 0) <= 1 && (head?.ok ?? true);
    shore.push({
      no: shore.length + 1, pileId: p.pileId, code: p.code, raft: p.raft, x: p.x, y: p.y, ground_m: ground,
      span_m: p.span_m, azimuth_deg: p.azimuth_deg, converted: converted.has(p.code), pileCount: p.pileCount, D_m: p.D_m, L_m: p.Linput_m,
      cage: p.cage.label, grade: p.cage.grade, tension_kN: p.Tmax_kN, pileTension_kN: pileT,
      bp1, bp2, headUtil: worst?.utilization ?? null, headGoverning: worst ? `${worst.id} ${worst.label}` : '-',
      slopeLow_deg: slope(BASE_LOW_WATER_M), slopeHigh_deg: slope(BASE_HIGH_WATER_M),
      belowNormalWater: wet, floodedAtHighWater: flooded, ok,
      note: [
        converted.has(p.code) ? 'Chuyển từ neo đáy sang cọc khoan nhồi (vị trí ven bờ)' : '',
        ground === null ? 'Ngoài mô hình địa hình' : '',
        wet ? 'Mặt đất tại cọc thấp hơn MNDB: thi công mùa nước thấp, có ống vách' : '',
        flooded ? 'Đầu cọc ngập khi hồ ở MNLKT: bản mã, tai neo cần chống gỉ' : '',
        (slope(BASE_LOW_WATER_M) ?? 0) < -25 ? 'Cáp chúc xuống dốc khi nước thấp: kiểm tra cáp không tì vào mặt đất / mũ cọc' : ''
      ].filter(Boolean).join('; ')
    });
  }

  const bySide: Record<string, number> = {};
  for (const b of bed) bySide[b.base.side_m.toFixed(2)] = (bySide[b.base.side_m.toFixed(2)] ?? 0) + 1;
  return {
    levels: { mnc_m: BASE_LOW_WATER_M, mndb_m: MNDB_M, mnlkt_m: BASE_HIGH_WATER_M },
    shore, bed,
    totals: {
      points: shore.length + bed.length, lines: coords.length,
      shorePoints: shore.length, convertedShorePoints: shore.filter((s) => s.converted).length,
      bedBases: bed.length, sharedBases: bed.filter((b) => b.base.shared).length, bedLines: bases.totals.lines,
      shoreOk: shore.filter((s) => s.ok).length, bedOk: bed.filter((b) => b.base.ok).length,
      bedConcrete_m3: bases.totals.concrete_m3,
      basesBySide: Object.fromEntries(Object.entries(bySide).sort((a, b) => Number(a[0]) - Number(b[0]))),
      maxLiftMass_t: bases.totals.maxLiftMass_t,
      terrainHigherPoints: bed.filter((b) => (b.terrainAboveBed_m ?? 0) > TERRAIN_NOTE_M).length,
      shoreBelowNormalWater: shore.filter((s) => s.belowNormalWater).length,
      floodedShoreHeads: shore.filter((s) => s.floodedAtHighWater).length,
      longestShoreSpan_m: shore.reduce((m, s) => Math.max(m, s.span_m), 0)
    }
  };
}

const num = (v: number | null, d: number): number | string => (v === null || !Number.isFinite(v) ? '-' : Number(v.toFixed(d)));

/** The two per-point sheets (`TungDiemNeoDay`, `TungDiemNeoBo`), appended to a workbook. */
export function appendAnchorPointSheets(wb: XLSX.WorkBook, s: AnchorPointSchedule, state: ProjectState): void {
  const code = state.meta.code || state.code || 'HV-FPV-2026';
  const wind = state.env.windSpeed_ms;
  const lv = s.levels;
  const caveat = designWindCaveat(wind);
  const head = [
    `Gió tính toán V = ${wind} m/s. Mực nước: MNC ${lv.mnc_m} m (dây thoải nhất), MNLKT ${lv.mnlkt_m} m (dây dốc nhất). Đế neo đáy đặt ở cao độ ĐÁY HỒ THIẾT KẾ (MNDB − độ sâu thiết kế của bè); mặt đất tại cọc bờ lấy từ địa hình IFC quy về cao độ dự án.` + (caveat ? ` CHÚ Ý: ${caveat}` : ''),
    'Lực dây = lực dây bất lợi nhất của BÈ chứa dây đó (chưa có mô hình phân bố lực theo từng dây). Hình học (tầm vươn, cao độ, góc cáp) là của riêng từng điểm.'
  ];
  const T = s.totals;

  const bed: any[][] = [
    [`TÍNH TOÁN TỪNG ĐẾ NEO ĐÁY HỒ: ĐẾ BTCT + VÍT XOẮN (${T.bedBases} ĐẾ, ${T.sharedBases} ĐẾ DÙNG CHUNG, ${T.bedLines} TUYẾN CÁP) — ${code}`],
    [head[0]], [head[1]],
    ['Đế DÙNG CHUNG (hai dây của hai bè đối diện): kiểm tra một dây căng cực đại + dây kia ở lực căng trước, và cả hai dây cùng căng (lực ngang cộng véc-tơ, lực nhổ cộng lại) — cột "Tổ hợp chi phối". c_u bùn và các hệ số bám dính là GIẢ ĐỊNH. Cao độ đáy thiết kế chưa phải số liệu khảo sát; cột "Địa hình IFC" chỉ để đối chiếu.'],
    [''],
    ['STT', 'MÃ ĐẾ', 'LOẠI', 'DÂY 1', 'BÈ 1', 'T 1 (kN)', 'Tầm vươn 1 (m)', 'DÂY 2', 'BÈ 2', 'T 2 (kN)', 'Tầm vươn 2 (m)',
      'X (m)', 'Y (m)', 'Cao độ đáy thiết kế (m)', 'Địa hình IFC (m)', 'Sâu nước MNC (m)', 'Sâu nước MNLKT (m)',
      'Tổ hợp chi phối', 'Lực ngang (kN)', 'Lực nhổ (kN)',
      'B (m)', 't (m)', "W' (kN)", 'Bê tông (m³)', 'Cẩu (T)', 'Lưới thép',
      'SV-1 nhổ', 'SV-2 trượt', 'SV-3 lật', 'SV-4 một vít', 'SV-5 nền', 'SV-6 thép bản', 'HSSD lớn nhất', 'KẾT LUẬN', 'GHI CHÚ']
  ];
  for (const r of s.bed) {
    const b = r.base, [l1, l2] = b.lines;
    const gov = b.combinations.find((c) => c.name === b.governing) ?? b.combinations[0];
    bed.push([
      r.no, b.baseId, b.shared ? 'DÙNG CHUNG' : 'ĐƠN',
      l1.code, l1.raft, num(l1.tension_kN, 1), num(l1.span_m, 2),
      l2 ? l2.code : '-', l2 ? l2.raft : '-', l2 ? num(l2.tension_kN, 1) : '-', l2 ? num(l2.span_m, 2) : '-',
      num(b.x, 2), num(b.y, 2), num(b.z, 2), num(r.terrain_m, 2), num(b.depthLow_m, 2), num(b.depthHigh_m, 2),
      b.governing, num(gov.Th_kN, 1), num(gov.Tv_kN, 1),
      num(b.side_m, 2), num(b.thickness_m, 2), num(b.design.weightSub_kN, 1), num(b.concrete_m3, 2), num(b.liftMass_t, 1),
      `Ø${b.design.rebarDia_mm} a${Math.round(b.design.rebarSpacing_m * 1000)}`,
      num(b.upliftUtil, 2), num(b.slideUtil, 2), num(b.overturnUtil, 2), num(b.screwUtil, 2), num(b.bearingUtil, 2), num(b.rebarUtil, 2),
      num(r.util, 2), b.ok ? 'ĐẠT' : 'KHÔNG ĐẠT', r.note
    ]);
  }
  bed.push(['']);
  bed.push(['TỔNG HỢP']);
  bed.push(['Số đế neo đáy', T.bedBases, 'đế']);
  bed.push(['  trong đó đế dùng chung hai bè', T.sharedBases, 'đế']);
  bed.push(['Số tuyến cáp neo vào đế', T.bedLines, 'tuyến']);
  bed.push(['Số đế ĐẠT mọi kiểm tra', T.bedOk, 'đế']);
  bed.push(['Bê tông đế', num(T.bedConcrete_m3, 1), 'm³']);
  bed.push(['Đế nặng nhất khi cẩu', num(T.maxLiftMass_t, 1), 'tấn']);
  for (const [side, n] of Object.entries(T.basesBySide)) bed.push([`Số đế cạnh B = ${side.replace('.', ',')} m`, n, 'đế']);
  bed.push([`Số đế mà địa hình IFC cao hơn đáy thiết kế trên ${String(TERRAIN_NOTE_M).replace('.', ',')} m (cần kiểm tra khảo sát / nạo vét)`, T.terrainHigherPoints, 'đế']);
  const wsBed = XLSX.utils.aoa_to_sheet(bed);
  wsBed['!cols'] = [5, 11, 12, 10, 8, 9, 11, 10, 8, 9, 11, 10, 10, 13, 12, 11, 12, 34, 11, 10, 7, 7, 9, 10, 8, 11, 9, 9, 9, 10, 9, 11, 11, 12, 60].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsBed, 'TungDiemNeoDay');

  const shore: any[][] = [
    [`TÍNH TOÁN TỪNG ĐIỂM NEO BỜ: CỌC KHOAN NHỒI (${T.shorePoints} ĐIỂM, trong đó ${T.convertedShorePoints} điểm chuyển từ neo đáy) — ${code}`],
    [head[0]], [head[1]],
    ['BP-1 (Broms ngang), BP-2 (uốn, TCVN 5574:2018) và đầu cọc (H-1…H-8) không phụ thuộc vị trí nên lặp lại theo bè; riêng từng điểm là góc cáp tại đầu cọc, mặt đất tại cọc so với MNDB và việc đầu cọc có ngập ở MNLKT hay không. Thông số đất là GIẢ ĐỊNH; vị trí cọc mới lấy theo địa hình IFC, chưa phải khảo sát.'],
    [''],
    ['STT', 'MÃ CỌC', 'KÝ HIỆU', 'BÈ', 'NGUỒN GỐC', 'X (m)', 'Y (m)', 'Cao độ mặt đất (m)', 'Tầm vươn (m)', 'Phương vị (°)', 'Số cọc', 'D (m)', 'L_tk (m)', 'Thép chủ', 'Mác thép',
      'T dây (kN)', 'T một cọc (kN)', 'BP-1 ngang', 'BP-2 uốn', 'Đầu cọc (HSSD lớn nhất)', 'Kiểm tra đầu cọc chi phối',
      'Góc cáp MNC (°)', 'Góc cáp MNLKT (°)', 'Mặt đất thấp hơn MNDB', 'Đầu cọc ngập ở MNLKT', 'KẾT LUẬN', 'GHI CHÚ']
  ];
  for (const p of s.shore) {
    shore.push([
      p.no, p.pileId, p.code, p.raft, p.converted ? 'Chuyển từ neo đáy' : 'Cọc bờ có sẵn', num(p.x, 2), num(p.y, 2), num(p.ground_m, 2), num(p.span_m, 2), num(p.azimuth_deg, 1), p.pileCount, num(p.D_m, 2), num(p.L_m, 1),
      p.cage, p.grade, num(p.tension_kN, 1), num(p.pileTension_kN, 1), num(p.bp1, 2), num(p.bp2, 2), num(p.headUtil, 2), p.headGoverning,
      num(p.slopeLow_deg, 1), num(p.slopeHigh_deg, 1), p.belowNormalWater ? 'CÓ' : 'không', p.floodedAtHighWater ? 'CÓ' : 'không', p.ok ? 'ĐẠT' : 'KHÔNG ĐẠT', p.note
    ]);
  }
  shore.push(['']);
  shore.push(['TỔNG HỢP']);
  shore.push(['Số điểm neo bờ', T.shorePoints, 'điểm']);
  shore.push(['  trong đó chuyển từ neo đáy theo quy tắc ven bờ', T.convertedShorePoints, 'điểm']);
  shore.push(['Số cọc', s.shore.reduce((a, p) => a + p.pileCount, 0), 'cọc']);
  shore.push(['Số điểm ĐẠT', T.shoreOk, 'điểm']);
  shore.push(['Dây neo bờ dài nhất', num(T.longestShoreSpan_m, 1), 'm']);
  shore.push(['Số điểm có mặt đất tại cọc thấp hơn MNDB', T.shoreBelowNormalWater, 'điểm']);
  shore.push(['Số điểm có đầu cọc ngập khi hồ ở MNLKT', T.floodedShoreHeads, 'điểm']);
  const wsShore = XLSX.utils.aoa_to_sheet(shore);
  wsShore['!cols'] = [5, 11, 11, 8, 18, 10, 10, 12, 10, 10, 7, 7, 8, 10, 10, 10, 11, 10, 9, 13, 44, 11, 12, 12, 12, 12, 70].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsShore, 'TungDiemNeoBo');
}
