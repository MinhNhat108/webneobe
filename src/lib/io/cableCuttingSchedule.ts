import * as XLSX from 'xlsx';
import type { ProjectState } from '../calc/types';
import { SCREW_BASE_DEFAULTS } from '../calc/screwAnchorBed';
import type { MooringCoordinate } from '../../data/huoiVanhProject';
import { MOORING_LINES_V2 } from '../../data/huoiVanhLayout';
import { groundAt, MNDB_M, CLEAT_ABOVE_WATERLINE_M } from '../../components/simulation/sceneModel';
import { BASE_LOW_WATER_M, BASE_HIGH_WATER_M } from './screwBaseSchedule';

/**
 * Cutting length of every mooring cable, and how slack it is at the three
 * reservoir levels.
 *
 * The reservoir moves 6 m between MNC and MNLKT, so a cable cannot be set by
 * pulling it tight on the day it is installed. It is CUT TO A LENGTH: the
 * straight distance from the cleat on the raft to the pin on the anchor at
 * the level where that distance is longest.
 *   - a lake-bed cable is longest at the HIGHEST water (the raft is far above
 *     the base);
 *   - a shore cable is longest at the LOWEST water (the pile head stands near
 *     the normal level, the raft drops below it).
 * At every other level the cable is slack by `L − chord`; the two families
 * take over from one another as the water moves.
 *
 * What this is and is not:
 *  - pure geometry: the cable is a straight, inextensible line; its sag and
 *    its stretch under load are not included;
 *  - the length is pin to pin: terminations (thimbles, splices, shackles,
 *    turnbuckles) are NOT included — `allowance_m` adds a constant if wanted;
 *  - the levels of the anchors are the layout's: the DESIGN lake bed for the
 *    bases (an assumption, to be sounded before cutting) and the IFC terrain
 *    for the shore piles (not a survey).
 */
export interface CableCutRow {
  no: number;
  code: string;
  raft: string;
  type: 'SHORE' | 'BED';
  /** Base id of a lake-bed line (shared bases carry two lines). */
  anchorId: string;
  /** Plan distance cleat – anchor, m. */
  span_m: number;
  /** Level of the cable pin on the anchor, m (project datum). */
  pinLevel_m: number;
  /** Straight cleat-to-pin distance at MNC, MNDB and MNLKT, m. */
  chordLow_m: number;
  chordNormal_m: number;
  chordHigh_m: number;
  /** The level at which the cable is longest: it sets the cutting length. */
  governing: 'MNC' | 'MNDB' | 'MNLKT';
  /** Pin-to-pin cutting length = the longest chord + allowance, m. */
  cutLength_m: number;
  /** Slack (cutting length − chord) at the three levels, m. */
  slackLow_m: number;
  slackNormal_m: number;
  slackHigh_m: number;
  /** How far the cleat can move away from the anchor before the cable is taut, at the three levels, m. */
  playLow_m: number;
  playNormal_m: number;
  playHigh_m: number;
  /** Cable angle at the cleat when taut, degrees from the horizontal (+ = the anchor is BELOW the cleat), at the three levels. */
  slopeLow_deg: number;
  slopeNormal_deg: number;
  slopeHigh_deg: number;
  note: string;
}

export interface CableCuttingSchedule {
  levels: { mnc_m: number; mndb_m: number; mnlkt_m: number };
  cleatAboveWater_m: number;
  allowance_m: number;
  rows: CableCutRow[];
  totals: {
    lines: number;
    shoreLines: number;
    bedLines: number;
    /** Sum of the cutting lengths, m. */
    shoreLength_m: number;
    bedLength_m: number;
    /** Lines governed by each level. */
    governedBy: Record<'MNC' | 'MNDB' | 'MNLKT', number>;
    /** Largest slack of a lake-bed line at MNC and of a shore line at MNDB, m. */
    maxBedSlackLow_m: number;
    maxShoreSlackNormal_m: number;
    /** Shore lines shorter than SHORT_SHORE_SPAN_M in plan: they swing through a large angle as the water moves. */
    shortShoreLines: number;
  };
}

/** A shore line shorter than this in plan is flagged, m. */
export const SHORT_SHORE_SPAN_M = 10;
/** A cable steeper than this at the cleat is flagged, degrees. */
const STEEP_DEG = 35;

export function buildCableCuttingSchedule(
  state: ProjectState,
  coordinates?: MooringCoordinate[],
  allowance_m = 0
): CableCuttingSchedule {
  const coords = coordinates ?? MOORING_LINES_V2;
  const low = BASE_LOW_WATER_M, normal = MNDB_M, high = BASE_HIGH_WATER_M;
  const cleat = CLEAT_ABOVE_WATERLINE_M;
  const base = { ...SCREW_BASE_DEFAULTS, ...(state.anchor.screwBase ?? {}) };
  const rows: CableCutRow[] = coords.map((l, i) => {
    // pin of a shore pile: the attachment height above the ground; of a base: the padeye on top of the slab
    const pin = l.type === 'SHORE'
      ? (groundAt(l.xAnchor, l.yAnchor) ?? l.zAnchor) + (state.anchor.shoreArm_e_m ?? 0.1)
      : l.zAnchor + base.thickness_m + base.padeyeHeight_m;
    const drop = (w: number) => w + cleat - pin; // > 0: the anchor is below the cleat
    const chord = (w: number) => Math.hypot(l.span, drop(w));
    const c = { MNC: chord(low), MNDB: chord(normal), MNLKT: chord(high) };
    const governing = (Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]) as CableCutRow['governing'];
    const L = c[governing] + allowance_m;
    const play = (w: number) => Math.sqrt(Math.max(0, L * L - drop(w) ** 2)) - l.span;
    const slope = (w: number) => (Math.atan2(drop(w), l.span) * 180) / Math.PI;
    const steepest = Math.max(Math.abs(slope(low)), Math.abs(slope(normal)), Math.abs(slope(high)));
    return {
      no: i + 1, code: l.code, raft: l.raft, type: l.type, anchorId: l.anchorId ?? '-', span_m: l.span, pinLevel_m: pin,
      chordLow_m: c.MNC, chordNormal_m: c.MNDB, chordHigh_m: c.MNLKT, governing, cutLength_m: L,
      slackLow_m: L - c.MNC, slackNormal_m: L - c.MNDB, slackHigh_m: L - c.MNLKT,
      playLow_m: play(low), playNormal_m: play(normal), playHigh_m: play(high),
      slopeLow_deg: slope(low), slopeNormal_deg: slope(normal), slopeHigh_deg: slope(high),
      note: [
        l.type === 'SHORE' && l.span < SHORT_SHORE_SPAN_M ? `Dây bờ ngắn (< ${SHORT_SHORE_SPAN_M} m): góc cáp đổi nhiều theo mực nước, giữ bè kém khi chùng` : '',
        steepest > STEEP_DEG ? `Cáp dốc tới ${steepest.toFixed(0)}°: thành phần đứng lớn tại bích bè` : '',
        l.type === 'BED' ? 'Đo cao độ đáy thực tế trước khi cắt' : ''
      ].filter(Boolean).join('; ')
    };
  });
  const shore = rows.filter((r) => r.type === 'SHORE'), bed = rows.filter((r) => r.type === 'BED');
  const governedBy = { MNC: 0, MNDB: 0, MNLKT: 0 };
  for (const r of rows) governedBy[r.governing]++;
  return {
    levels: { mnc_m: low, mndb_m: normal, mnlkt_m: high }, cleatAboveWater_m: cleat, allowance_m, rows,
    totals: {
      lines: rows.length, shoreLines: shore.length, bedLines: bed.length,
      shoreLength_m: shore.reduce((s, r) => s + r.cutLength_m, 0), bedLength_m: bed.reduce((s, r) => s + r.cutLength_m, 0),
      governedBy,
      maxBedSlackLow_m: bed.reduce((m, r) => Math.max(m, r.slackLow_m), 0),
      maxShoreSlackNormal_m: shore.reduce((m, r) => Math.max(m, r.slackNormal_m), 0),
      shortShoreLines: shore.filter((r) => r.span_m < SHORT_SHORE_SPAN_M).length
    }
  };
}

const n = (v: number, d: number) => Number(v.toFixed(d));

/** The sheet `ChieuDaiCatCap`, appended to a workbook. */
export function appendCableCuttingSheet(wb: XLSX.WorkBook, s: CableCuttingSchedule, state: ProjectState): void {
  const code = state.meta.code || state.code || 'HV-FPV-2026';
  const lv = s.levels, T = s.totals;
  const rows: any[][] = [
    [`BẢNG CHIỀU DÀI CẮT CÁP NEO (${T.lines} TUYẾN: ${T.shoreLines} dây bờ, ${T.bedLines} dây đáy) — ${code}`],
    [`Nguyên tắc: KHÔNG lắp cáp bằng cách kéo căng. Mỗi dây cắt theo khoảng cách thẳng từ bích bè tới chốt neo ở mực nước mà khoảng cách đó DÀI NHẤT: dây đáy ở MNLKT ${lv.mnlkt_m} m, dây bờ ở MNC ${lv.mnc_m} m. Ở các mực nước khác dây chùng đúng bằng cột "Độ chùng".`],
    [`Giả thiết: cáp thẳng, không giãn (chưa xét độ võng và độ giãn khi chịu lực); bích bè cao hơn mặt nước ${String(s.cleatAboveWater_m).replace('.', ',')} m; chiều dài tính từ CHỐT tới CHỐT${s.allowance_m > 0 ? `, đã cộng ${String(s.allowance_m).replace('.', ',')} m dự phòng` : ', CHƯA gồm đoạn bện đầu, khuyên lót, ma-ní, tăng đơ'}.`],
    ['Cao độ đáy hồ tại đế là cao độ THIẾT KẾ (giả định): đáy thật thấp hơn thì dây đáy phải dài hơn — phải đo cao độ đáy từng đế trước khi cắt. Cao độ mặt đất tại cọc bờ lấy theo địa hình IFC, chưa phải khảo sát. Đầu dây phía bè cần có đoạn điều chỉnh.'],
    [''],
    ['STT', 'KÝ HIỆU DÂY', 'BÈ', 'LOẠI', 'MÃ ĐẾ', 'Tầm vươn (m)', 'Cao độ chốt neo (m)',
      `Khoảng cách ở MNC (m)`, `Khoảng cách ở MNDB (m)`, `Khoảng cách ở MNLKT (m)`, 'Mực nước chi phối', 'CHIỀU DÀI CẮT (m)',
      'Độ chùng ở MNC (m)', 'Độ chùng ở MNDB (m)', 'Độ chùng ở MNLKT (m)',
      'Độ rơ ngang ở MNC (m)', 'Độ rơ ngang ở MNDB (m)', 'Độ rơ ngang ở MNLKT (m)',
      'Góc cáp ở MNC (°)', 'Góc cáp ở MNDB (°)', 'Góc cáp ở MNLKT (°)', 'GHI CHÚ']
  ];
  for (const r of s.rows) {
    rows.push([
      r.no, r.code, r.raft, r.type === 'SHORE' ? 'BỜ' : 'ĐÁY', r.anchorId, n(r.span_m, 2), n(r.pinLevel_m, 2),
      n(r.chordLow_m, 2), n(r.chordNormal_m, 2), n(r.chordHigh_m, 2), r.governing, n(r.cutLength_m, 2),
      n(r.slackLow_m, 2), n(r.slackNormal_m, 2), n(r.slackHigh_m, 2),
      n(r.playLow_m, 2), n(r.playNormal_m, 2), n(r.playHigh_m, 2),
      n(r.slopeLow_deg, 1), n(r.slopeNormal_deg, 1), n(r.slopeHigh_deg, 1), r.note
    ]);
  }
  rows.push(['']);
  rows.push(['TỔNG HỢP']);
  rows.push(['Tổng chiều dài cắt dây bờ (chốt tới chốt)', n(T.shoreLength_m, 1), 'm']);
  rows.push(['Tổng chiều dài cắt dây đáy (chốt tới chốt)', n(T.bedLength_m, 1), 'm']);
  rows.push(['Số dây do MNC chi phối', T.governedBy.MNC, 'dây']);
  rows.push(['Số dây do MNDB chi phối', T.governedBy.MNDB, 'dây']);
  rows.push(['Số dây do MNLKT chi phối', T.governedBy.MNLKT, 'dây']);
  rows.push(['Độ chùng lớn nhất của dây đáy khi hồ ở MNC', n(T.maxBedSlackLow_m, 2), 'm']);
  rows.push(['Độ chùng lớn nhất của dây bờ khi hồ ở MNDB', n(T.maxShoreSlackNormal_m, 2), 'm']);
  rows.push([`Số dây bờ ngắn dưới ${SHORT_SHORE_SPAN_M} m (cần xem xét bỏ hoặc dời cọc)`, T.shortShoreLines, 'dây']);
  rows.push(['Góc cáp: dương = neo thấp hơn bích bè (cáp chúc xuống từ bè); âm = neo cao hơn bích bè.']);
  rows.push(['Độ rơ ngang: quãng bích bè có thể dịch ra xa neo trước khi dây căng. Bảng này KHÔNG kiểm tra số dây làm việc theo từng hướng ở từng mực nước.']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [5, 12, 8, 7, 9, 11, 13, 13, 13, 13, 11, 13, 11, 11, 11, 12, 12, 12, 10, 10, 10, 70].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'ChieuDaiCatCap');
}
