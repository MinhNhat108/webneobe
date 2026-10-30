/**
 * Open issues of the ACTIVE lake that must stay in front of whoever reads a
 * result (header bar, report). Every number comes from the data files; none is
 * typed in here. Huổi Vanh: the line-operation rule of the equilibrium tension
 * (2026-10-23) and the findings on the 4-raft plan (2026-10-27).
 */
import { ACTIVE_LAKE, ACTIVE_LAKE_ID } from './lakes';
import { RAFT_POLYGONS_V2, LAYOUT_COUNTS, MOORING_LINES_V2, bedAnchorsOf, RAFT_TIES, obliqueShoreLines } from './huoiVanhLayout';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS } from './huoiVanhProject';
import { CABLE_MBL_KN } from '../lib/calc/raftState';
import { STANDBY_SLACK_M } from '../lib/calc/mooringEquilibrium';
import { groundAt, RAFT_MODELS } from '../components/simulation/sceneModel';

const vn = (x: number, d = 2) => x.toFixed(d).replace('.', ',');

interface PolygonWithBed {
  name: string;
  designBed_m?: number;
  bedRange_m?: { p10: number; p90: number; max: number };
}

/** Rafts that rest on the bottom (anywhere under them) at the dead level MNC, from the IFC ground under them. */
export function raftsAgroundAtMnc(): Array<{ name: string; highestGround_m: number; medianGround_m: number }> {
  const draft = HUOI_VANH_DEFAULT_PROJECT.raft.draft_m ?? 0.2;
  return (RAFT_POLYGONS_V2 as PolygonWithBed[])
    .filter((p) => p.bedRange_m && p.designBed_m !== undefined && p.bedRange_m.max + draft > ACTIVE_LAKE.levels.mnc_m)
    .map((p) => ({ name: p.name, highestGround_m: p.bedRange_m!.max, medianGround_m: p.designBed_m! }));
}

/**
 * Lines whose straight chord cleat → pin runs UNDER the IFC ground somewhere
 * between 15 % and 90 % of the span, at a level where the raft edge is afloat
 * (every metre from the floating level to MNLKT). The rope then lies on the
 * slope: it bends there (the equilibrium model takes it straight) and chafes.
 * The IFC grid is ~10 m, so only contacts deeper than 0.3 m are counted.
 */
export function linesOnSlope(): Array<{ code: string; depth_m: number; fromLevel_m: number; toLevel_m: number }> {
  const cleat = HUOI_VANH_DEFAULT_PROJECT.raft.freeboardHeight_m ?? 0.35;
  const out: Array<{ code: string; depth_m: number; fromLevel_m: number; toLevel_m: number }> = [];
  for (const l of MOORING_LINES_V2) {
    const layout = HUOI_VANH_RAFTS.find((r) => r.name === l.raft)?.mooringLayout;
    const pin = layout?.lines.find((q) => q.code === l.code)?.pin_m;
    if (!layout || pin === undefined) continue;
    const edge = groundAt(l.xRaft, l.yRaft);
    const hits: number[] = [];
    let depth = 0;
    for (let w = Math.ceil(Math.max(ACTIVE_LAKE.levels.mnc_m, layout.floatLevel_m)); w <= ACTIVE_LAKE.levels.mnlkt_m; w += 1) {
      if (edge !== null && edge > w) continue;
      const zc = w + cleat;
      let worst = -Infinity;
      for (let s = 0.15; s <= 0.9 + 1e-9; s += 0.025) {
        const g = groundAt(l.xRaft + s * (l.xAnchor - l.xRaft), l.yRaft + s * (l.yAnchor - l.yRaft));
        if (g !== null) worst = Math.max(worst, g - (zc + s * (pin - zc)));
      }
      if (worst > 0.3) { hits.push(w); depth = Math.max(depth, worst); }
    }
    if (hits.length) out.push({ code: l.code, depth_m: depth, fromLevel_m: hits[0], toLevel_m: hits[hits.length - 1] });
  }
  return out;
}

/** Huổi Vanh: the line tension holds only while the lines are re-tensioned as the water moves. */
function huoiVanhCaveats(): string[] {
  const out: string[] = [];
  const step = HUOI_VANH_DEFAULT_PROJECT.line.adjustStep_m;
  const na = HUOI_VANH_RAFTS.filter((r) => r.noAdjust);
  if (na.length && step) {
    const { mnc_m, mnlkt_m } = ACTIVE_LAKE.levels;
    const sf = na.map((r) => (CABLE_MBL_KN[r.selectedCable] ?? 0) / r.noAdjust!.maxTension_kN);
    const tt = na.map((r) => r.noAdjust!.maxTension_kN);
    out.push(
      `Lực dây tính bằng cân bằng tĩnh của bè trên từng dây theo mực nước (${vn(mnc_m, 1)}–${vn(mnlkt_m, 1)} m), với QUY TRÌNH VẬN HÀNH BẮT BUỘC: ` +
      `chỉnh lại độ căng mọi dây mỗi khi mực nước thay đổi ${vn(step, 1)} m. Nếu cáp cắt một lần rồi để nguyên, dây đáy chùng khi nước thấp và lực dồn vào ít dây: ` +
      `lực dây tới ${vn(Math.min(...tt), 0)}–${vn(Math.max(...tt), 0)} kN; ${sf.filter((x) => x < 3).length}/${na.length} bè khi đó không còn đủ hệ số an toàn cáp (thấp nhất ${vn(Math.min(...sf), 1)}, yêu cầu ≥ 3).`
    );
  }
  const standby = HUOI_VANH_RAFTS.flatMap((r) => r.mooringLayout?.standbyLines ?? []);
  if (standby.length) {
    out.push(`${standby.length} dây quá ngắn (${standby.join(', ')}) lắp làm DÂY DỰ PHÒNG: cắt dài thêm ${vn(STANDBY_SLACK_M, 1)} m, không tính chịu lực (dây ngắn như vậy cứng tới mức hút gần hết tải của bè).`);
  }
  // mặt bằng 4 bè (27/10/2026)
  const ground = [...RAFT_MODELS].filter((r) => r.groundingLevel_m > ACTIVE_LAKE.levels.mnc_m).sort((a, b) => b.groundingLevel_m - a.groundingLevel_m);
  if (ground.length) {
    out.push(
      `Theo địa hình IFC, ${ground.length}/${RAFT_MODELS.length} bè chạm đáy một phần khi nước xuống thấp: ` +
      ground.map((r) => `${r.name} từ ${vn(r.groundingLevel_m, 1)} m`).join(', ') + ` (MNDB ${vn(ACTIVE_LAKE.levels.mndb_m, 1)}, MNC ${vn(ACTIVE_LAKE.levels.mnc_m, 1)} m). ` +
      'Cần nhà sản xuất bè xác nhận bè chịu được nằm trên đáy, hoặc thu mép bè / nạo vét theo khảo sát.'
    );
  }
  const dense = HUOI_VANH_RAFTS.filter((r) => (r.shoreRebarCount ?? 0) * (r.shoreRebarDia_mm ?? 0) ** 2 > 0.04 * 350 ** 2 + 1e-6);
  if (dense.length) {
    out.push(`Cọc bờ ${dense.map((r) => `${r.name} ${r.shoreRebarCount}Φ${r.shoreRebarDia_mm}`).join(', ')}: hàm lượng thép vượt 4% tiết diện D350 (khó đổ bê tông); muốn dưới 4% phải dùng 3 cọc mỗi điểm — đài 3 cọc CHƯA thiết kế.`);
  }
  const ob = obliqueShoreLines();
  if (ob.length) out.push(`${ob.length} dây bờ lệch quá 60° so với pháp tuyến mép bè (${ob.map((x) => `${x.code} ${vn(x.deg, 0)}°`).join(', ')}): trong tầm 60 m không có bờ theo phương vuông góc mép.`);
  // Chủ đầu tư 28/10/2026: đế vít xoắn dọc mép nam BÈ 2 và mép trên cùng BÈ 4; chỗ nào neo bờ được thì neo bờ, đế chỉ ở
  // chỗ không neo bờ được (khe BÈ 2 – BÈ 4, giữa khe BÈ 2 – BÈ 3), dùng chung giữa hai bè khi được
  const bases = bedAnchorsOf();
  const dry = bases.filter((b) => b.z >= ACTIVE_LAKE.levels.mnc_m);
  if (dry.length) {
    out.push(
      `${dry.length}/${bases.length} đế vít xoắn đứng trên nền cao hơn MNC ${vn(ACTIVE_LAKE.levels.mnc_m, 1)} m theo địa hình IFC (khe BÈ 2 – BÈ 3, mép trên cùng BÈ 4; cao nhất ${vn(Math.max(...dry.map((b) => b.z)), 2)} m): ` +
      'đế lộ khô khi nước chết, nước nông khi thi công — cao độ đặt đế lấy theo địa hình IFC, CHƯA khảo sát.'
    );
  }
  const single = LAYOUT_COUNTS.bedBases - LAYOUT_COUNTS.sharedBases;
  if (single > 0) out.push(`${single}/${LAYOUT_COUNTS.bedBases} đế vít xoắn là đế ĐƠN (một dây): dọc mép nam BÈ 2 và mép trên cùng BÈ 4.`);
  return out;
}

export function lakeCaveats(): string[] {
  if (ACTIVE_LAKE_ID !== 'ban-mong') return huoiVanhCaveats();
  const { mnc_m, mndb_m, mnlkt_m } = ACTIVE_LAKE.levels;
  const out: string[] = [];
  out.push(
    `Mực nước hồ dao động ${vn(mnlkt_m - mnc_m)} m (MNC ${vn(mnc_m)} → MNDB ${vn(mndb_m)} → MNLKT ${vn(mnlkt_m)} m), gấp hơn 3 lần Huổi Vanh. ` +
    'Cáp cắt cố định không dùng được (lực dây và độ trôi quá lớn — xem bảng so sánh cách bù ở Mục 4). Lực dây tính bằng cân bằng tĩnh từng dây theo mực nước, với giả định dây được BÙ dao động mực nước (mặc định: bù liên tục bằng bộ tự căng có khóa chống bão — CHƯA chọn loại; so sánh cách bù ở Mục 4). ' +
      'Mô hình lấy độ cứng của chính sợi cáp, nên thiết bị bù phải KHÓA được khi có gió bão (khóa an toàn khi mất điện / mất tín hiệu).'
  );
  const lf = HUOI_VANH_RAFTS.filter((r) => r.lockFailure);
  if (lf.length) {
    const sf = lf.map((r) => (CABLE_MBL_KN[r.selectedCable] ?? 0) / r.lockFailure!.maxTension_kN);
    const dr = lf.map((r) => r.lockFailure!.drift_m), tt = lf.map((r) => r.lockFailure!.maxTension_kN);
    out.push(
      `Nếu khóa của thiết bị bù KHÔNG khóa kịp, đối trọng chỉ giữ lực căng ${vn(lf[0].lockFailure!.setTension_kN, 0)} kN và hành trình dư ${vn(lf[0].lockFailure!.stroke_m, 0)} m mỗi chiều: ` +
      `bè trôi ${vn(Math.min(...dr), 1)}–${vn(Math.max(...dr), 1)} m (tới hết hành trình rồi dây mới căng) và lực dây vọt tới ${vn(Math.min(...tt), 0)}–${vn(Math.max(...tt), 0)} kN ` +
      `(hệ số an toàn cáp chỉ ${vn(Math.min(...sf), 1)}–${vn(Math.max(...sf), 1)}; đế và cọc không được tính cho lực này). Đối trọng treo tự do KHÔNG đủ giữ bè: ` +
      'cần bộ khóa / phanh chủ động, dự phòng, kiểm tra định kỳ.'
    );
  }
  const aground = raftsAgroundAtMnc();
  if (aground.length) {
    out.push(
      `Theo địa hình IFC, ${aground.length}/${RAFT_POLYGONS_V2.length} bè chạm đáy khi nước xuống MNC ${vn(mnc_m)} m: ` +
      aground.map((r) => `${r.name} (đáy cao nhất ${vn(r.highestGround_m)}, trung vị ${vn(r.medianGround_m)} m)`).join('; ') +
      '. Đáy thiết kế từng bè là trung vị địa hình IFC dưới bè, chưa phải khảo sát.'
    );
  }
  const bases = bedAnchorsOf();
  const dry = bases.filter((b) => b.z > mnc_m);
  if (dry.length) {
    out.push(
      `Đế vít xoắn đặt trên mặt đất IFC tại chỗ (không phải đáy thiết kế chung như Huổi Vanh): ${dry.length}/${bases.length} đế có nền cao hơn MNC ` +
      `(tới ${vn(Math.max(...dry.map((b) => b.z)))} m) nên lộ khô khi hồ xuống mực nước chết.`
    );
  }
  const slope = linesOnSlope();
  if (slope.length) {
    const lo = Math.min(...slope.map((r) => r.fromLevel_m)), hi = Math.max(...slope.map((r) => r.toLevel_m));
    out.push(
      `Theo địa hình IFC (lưới ~10 m), ${slope.length}/${MOORING_LINES_V2.length} dây tì lên sườn dốc giữa bè và neo khi nước ở ${vn(lo, 0)}–${vn(hi, 0)} m ` +
      `(${slope.map((r) => r.code).join(', ')}; sâu nhất ${vn(Math.max(...slope.map((r) => r.depth_m)), 1)} m dưới mặt đất): mô hình coi dây thẳng — ` +
      'cần ống / con lăn chống mài mòn ở đoạn tì, hoặc dời cọc theo khảo sát địa hình.'
    );
  }
  if (RAFT_TIES.length) {
    const g = HUOI_VANH_RAFTS.find((r) => r.mooringLayout?.group)?.mooringLayout?.group;
    const pair = [...new Set(RAFT_TIES.flatMap((t) => t.rafts))].join(' – ');
    out.push(
      `${RAFT_TIES.length} dây nối ${pair} thay cho ${RAFT_TIES.length} đế dùng chung ở khe hẹp (dài ${vn(Math.min(...RAFT_TIES.map((t) => t.length_m)), 1)}–${vn(Math.max(...RAFT_TIES.map((t) => t.length_m)), 1)} m): hai bè tính như MỘT cụm trên các dây phía ngoài. ` +
      `Mỗi dây nối kiểm tra với ${vn(g?.tieDesign_kN ?? 0, 0)} kN (GIẢ ĐỊNH: một bè truyền toàn bộ lực của nó sang bè kia, một nửa số dây nối cùng làm việc) — chưa mô hình riêng. ` +
      'Dây nối dài cố định (hai bè cùng nổi, không cần bù mực nước); cần đệm chống va giữa hai bè và nhà sản xuất bè xác nhận khung chịu được lực tập trung tại điểm nối.'
    );
  }
  const single = LAYOUT_COUNTS.bedBases - LAYOUT_COUNTS.sharedBases;
  if (single > 0) {
    out.push(
      `${single}/${LAYOUT_COUNTS.bedBases} đế vít xoắn là đế ĐƠN (một dây), ở vùng nước trống xa bờ hơn tầm dây bờ cho phép 80 m hoặc ở khe không đặt được dây đối diện: ` +
      'quy tắc của Huổi Vanh "đế chỉ đặt giữa hai bè" không áp dụng được cho mặt bằng này — cần Chủ đầu tư xác nhận.'
    );
  }
  if (!ACTIVE_LAKE.codeWind.confirmed) {
    out.push(
      'Vùng gió TCVN 2737:2023 của Sơn La CHƯA tra cứu: mốc so sánh 29,7 m/s (vùng II-B của Huổi Vanh) chỉ là tạm. ' +
      'Độ cứng dây EA = 15 × lực đứt là giả định; mô hình cân bằng không xét xoay bè và tải động.'
    );
  }
  return out;
}
