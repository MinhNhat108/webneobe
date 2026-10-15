#!/usr/bin/env node
/**
 * exportMaterialOrderBOQ.mjs — Bảng thống kê khối lượng vật tư phục vụ mua hàng (Order / Procurement BOQ)
 * 
 * Dự án: Hệ Thống Neo 9 Cụm Bè Pin Mặt Trời Nổi Hồ Huổi Vanh
 * Phương án thiết kế:
 *  - 295 tuyến cáp neo: Dây cáp chia 2 nhánh chữ Y (Bridle Mooring) bám vào 2 bích bè
 *  - 231 cọc khoan nhồi tròn D350 trên bờ (L = 6,5 m)
 *  - 32 đế neo đáy BTCT + vít xoắn PA3 (100% đế dùng chung giữa 2 bè)
 *  - Toàn bộ phụ kiện: Ma-nê, Tăng đơ 10-12T, Khuyên lót cáp, Vòng chia chạc Y, Xích vi chỉnh, Phao treo cáp
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COORDS_FILE = path.join(ROOT, 'src/data/huoiVanhCoordinates_v2.json');
const PILES_FILE = path.join(ROOT, 'src/data/huoiVanhPiles_v2.json');

const coords = JSON.parse(fs.readFileSync(COORDS_FILE, 'utf8'));
const piles = JSON.parse(fs.readFileSync(PILES_FILE, 'utf8'));

console.log(`Loaded ${coords.length} cable coordinates and ${piles.length} anchor points.`);

// 1. Phân loại tuyến cáp và tính chiều dài cáp chính + cáp nhánh Bridle Y
// Chiều dài mỗi nhánh bridle: 3,5 m (mỗi tuyến có 2 nhánh)
const BRIDLE_LEG_LENGTH_M = 3.5;
const BRIDLE_LEGS_COUNT = 2;
const CUTTING_ALLOWANCE_PERCENT = 0.08; // 8% hao hụt thi công, bện khuyên đầu cáp

// Mực nước: MNC = 380,0 m; MNDB = 384,5 m; MNLKT = 386,0 m
// Bích bè cao hơn mặt nước 0,35 m
const MNC_M = 380.0;
const MNDB_M = 384.5;
const MNLKT_M = 386.0;
const CLEAT_ABOVE_WATER = 0.35;

const cableRows = [];
let totalMainShoreM = 0;
let totalMainBedM = 0;
let totalBridleShoreM = 0;
let totalBridleBedM = 0;

for (let i = 0; i < coords.length; i++) {
  const c = coords[i];
  const isShore = c.type === 'SHORE';
  
  // Cao độ chốt neo:
  // Cọc bờ: zAnchor + 0.1m
  // Đế neo đáy: zAnchor + 0.55m
  const pinZ = isShore ? (c.zAnchor + 0.1) : (c.zAnchor + 0.55);

  // Khoảng cách 3D ở 3 mực nước
  const zCleatLow = MNC_M + CLEAT_ABOVE_WATER;
  const zCleatNorm = MNDB_M + CLEAT_ABOVE_WATER;
  const zCleatHigh = MNLKT_M + CLEAT_ABOVE_WATER;

  const dx = c.xAnchor - c.xRaft;
  const dy = c.yAnchor - c.yRaft;
  const span = Math.hypot(dx, dy);

  const chordLow = Math.hypot(span, pinZ - zCleatLow);
  const chordNorm = Math.hypot(span, pinZ - zCleatNorm);
  const chordHigh = Math.hypot(span, pinZ - zCleatHigh);

  // Mực nước chi phối: Dây bờ dài nhất ở MNC, dây đáy dài nhất ở MNLKT
  const governing = isShore ? 'MNC' : 'MNLKT';
  const chordGov = isShore ? chordLow : chordHigh;

  // Chiều dài cáp chính (từ mỏ neo tới cụm chạc Y):
  // Chạc Y vươn ra khỏi bè 3.5m (chiếu theo phương cáp ~3.0 - 3.5m)
  const mainLineLength = Math.max(1.0, chordGov - BRIDLE_LEG_LENGTH_M);
  const bridleTotalLength = BRIDLE_LEG_LENGTH_M * BRIDLE_LEGS_COUNT; // 2 x 3.5 = 7.0m
  const totalLineLength = mainLineLength + bridleTotalLength;
  const orderLineLength = totalLineLength * (1 + CUTTING_ALLOWANCE_PERCENT);

  if (isShore) {
    totalMainShoreM += mainLineLength;
    totalBridleShoreM += bridleTotalLength;
  } else {
    totalMainBedM += mainLineLength;
    totalBridleBedM += bridleTotalLength;
  }

  // Mã quy cách cáp đề xuất theo lực kéo từng bè
  let cableSpecMain = 'Polyester PES-32 (MBL 240 kN, Ø32mm)';
  let cableSpecBridle = 'Polyester PES-28 (MBL 180 kN, Ø28mm)';
  if (['BÈ 3A', 'BÈ 5A', 'BÈ 8'].includes(c.raft)) {
    cableSpecMain = 'Polyester PES-36 (MBL 320 kN, Ø36mm)';
    cableSpecBridle = 'Polyester PES-30 (MBL 210 kN, Ø30mm)';
  } else if (['BÈ 1', 'BÈ 2', 'BÈ 9'].includes(c.raft)) {
    cableSpecMain = 'Polyester PES-28 (MBL 180 kN, Ø28mm)';
    cableSpecBridle = 'Polyester PES-24 (MBL 140 kN, Ø24mm)';
  }

  cableRows.push({
    stt: i + 1,
    code: c.code,
    raft: c.raft,
    type: isShore ? 'Cọc bờ D350' : 'Đế neo đáy PA3',
    span: Number(span.toFixed(2)),
    pinZ: Number(pinZ.toFixed(2)),
    governingWater: governing,
    chordGov_m: Number(chordGov.toFixed(2)),
    mainLine_m: Number(mainLineLength.toFixed(2)),
    bridleLegs_m: `2 nhánh x ${BRIDLE_LEG_LENGTH_M} m`,
    bridleTotal_m: bridleTotalLength,
    totalLine_m: Number(totalLineLength.toFixed(2)),
    orderWithAllowance_m: Number(orderLineLength.toFixed(2)),
    cableSpecMain,
    cableSpecBridle
  });
}

// 2. Thống kê 231 Cọc Khoan Nhồi Bờ D350
// Phân bổ thép chủ theo bè:
// BÈ 1, 2, 3, 6, 9: 4Φ25 CB400-V (L=6.5m, G = 3.85 kg/m)
// BÈ 7: 4Φ28 CB400-V (G = 4.83 kg/m)
// BÈ 8: 6Φ25 CB400-V (G = 3.85 kg/m)
// BÈ 3A: 6Φ28 CB400-V (G = 4.83 kg/m)
// BÈ 5A: 6Φ32 CB400-V (G = 6.31 kg/m)
const raftRebarMap = {
  'BÈ 1': { rebar: '4Φ25', bars: 4, dia: 25, unitWeight: 3.853 },
  'BÈ 2': { rebar: '4Φ25', bars: 4, dia: 25, unitWeight: 3.853 },
  'BÈ 3': { rebar: '4Φ25', bars: 4, dia: 25, unitWeight: 3.853 },
  'BÈ 3A': { rebar: '6Φ28', bars: 6, dia: 28, unitWeight: 4.834 },
  'BÈ 5A': { rebar: '6Φ32', bars: 6, dia: 32, unitWeight: 6.313 },
  'BÈ 6': { rebar: '4Φ25', bars: 4, dia: 25, unitWeight: 3.853 },
  'BÈ 7': { rebar: '4Φ28', bars: 4, dia: 28, unitWeight: 4.834 },
  'BÈ 8': { rebar: '6Φ25', bars: 6, dia: 25, unitWeight: 3.853 },
  'BÈ 9': { rebar: '4Φ25', bars: 4, dia: 25, unitWeight: 3.853 }
};

const shorePiles = piles.filter((p) => p.type === 'SHORE');
const shoreByRaft = {};
for (const p of shorePiles) {
  const r = p.raft;
  if (!shoreByRaft[r]) shoreByRaft[r] = [];
  shoreByRaft[r].push(p);
}

const pileSummaryRows = [];
let totalPileMeters = 0;
let totalPileConcreteM3 = 0;
let totalMainRebarKg = 0;
let totalStirrupRebarKg = 0;

for (const [raftName, pileList] of Object.entries(shoreByRaft)) {
  const count = pileList.length;
  const L = 6.5; // m/cọc
  const totalM = count * L;
  totalPileMeters += totalM;

  // Thể tích bê tông cọc D350 = pi * r^2 * L * count
  const vol1 = Math.PI * Math.pow(0.175, 2) * L; // ~0.6253 m3
  const volRaft = vol1 * count;
  totalPileConcreteM3 += volRaft;

  const rebarSpec = raftRebarMap[raftName];
  // Thép chủ: bars x L x unitWeight
  const mainKg1 = rebarSpec.bars * L * rebarSpec.unitWeight;
  const mainKgRaft = mainKg1 * count;
  totalMainRebarKg += mainKgRaft;

  // Thép đai xoắn Φ8 a150 (bước 100mm ở 1.5m đầu cọc, 150mm ở thân cọc)
  // Chu vi 1 vòng đai D270mm = pi * 0.27 ~ 0.848m
  // Số vòng ~ 15 + 33 = 48 vòng -> L đai ~ 41m -> G_Φ8 = 0.395 kg/m -> ~16.2 kg/cọc
  const stirrupKg1 = 16.5;
  const stirrupKgRaft = stirrupKg1 * count;
  totalStirrupRebarKg += stirrupKgRaft;

  pileSummaryRows.push({
    raft: raftName,
    count,
    L_m: L,
    totalM_m: totalM,
    concrete_m3: Number(volRaft.toFixed(2)),
    rebarSpec: rebarSpec.rebar,
    mainSteel_kg: Math.round(mainKgRaft),
    stirrupSteel_kg: Math.round(stirrupKgRaft),
    totalSteel_kg: Math.round(mainKgRaft + stirrupKgRaft),
    capPlates: count,
    padeyes: count,
    turnbuckles: count
  });
}

// 3. Thống kê 32 Đế Neo Đáy BTCT + Vít Xoắn PA3 (100% Dùng Chung)
const bedBases = piles.filter((p) => p.type === 'BED');
// Phân bố kích thước theo sizing tối ưu của Claude (commit 7917680):
// 11 đế 2.5m; 19 đế 2.75m; 1 đế 3.0m; 1 đế 3.25m
// Chiều dài vít xoắn: trung bình 3.7m (từ 3.0 - 4.5m), tổng 474m / 128 vít
const baseSizeDist = [
  { sizeLabel: 'Đế loại 1: 2,50 x 2,50 x 0,40 m', side_m: 2.50, thk_m: 0.40, count: 11, vol1: 2.50, steel1: 185, screwL1: 3.0 },
  { sizeLabel: 'Đế loại 2: 2,75 x 2,75 x 0,40 m', side_m: 2.75, thk_m: 0.40, count: 19, vol1: 3.025, steel1: 228, screwL1: 3.8 },
  { sizeLabel: 'Đế loại 3: 3,00 x 3,00 x 0,40 m (HV-DV009)', side_m: 3.00, thk_m: 0.40, count: 1, vol1: 3.60, steel1: 275, screwL1: 4.5 },
  { sizeLabel: 'Đế loại 4: 3,25 x 3,25 x 0,40 m (HV-DV006)', side_m: 3.25, thk_m: 0.40, count: 1, vol1: 4.225, steel1: 325, screwL1: 4.5 }
];

let totalBaseConcreteM3 = 0;
let totalBaseRebarKg = 0;
let totalScrews = 0;
let totalScrewMeters = 0;

const baseSummaryRows = [];
for (const b of baseSizeDist) {
  const conc = b.vol1 * b.count;
  const steel = b.steel1 * b.count;
  const screws = b.count * 4;
  const screwM = b.screwL1 * screws;

  totalBaseConcreteM3 += conc;
  totalBaseRebarKg += steel;
  totalScrews += screws;
  totalScrewMeters += screwM;

  baseSummaryRows.push({
    type: b.sizeLabel,
    side_m: b.side_m,
    thk_m: b.thk_m,
    count: b.count,
    concrete_m3: Number(conc.toFixed(2)),
    rebar_kg: Math.round(steel),
    screwsCount: screws,
    screwTotalL_m: Math.round(screwM),
    doublePadeyes: b.count,
    markerBuoys: b.count * 2 // 2 dây/đế -> 2 phao treo
  });
}

// 4. Tạo Workbook Excel
const wb = XLSX.utils.book_new();

// ==========================================
// SHEET 1: BẢNG TỔNG HỢP VẬT TƯ ORDER
// ==========================================
const summaryAOA = [
  ['BẢNG TỔNG HỢP VẬT TƯ ĐẶT HÀNG (PROCUREMENT BILL OF QUANTITIES - BOQ)'],
  ['DỰ ÁN: HỆ THỐNG NEO 9 CỤM BÈ PIN NĂNG LƯỢNG MẶT TRỜI NỔI HỒ HUỔI VANH'],
  ['Quy mô: 9 Cụm Bè · 295 Tuyến Cáp Neo Chạc Y (Bridle) · 231 Cọc Khoan Nhồi Bờ D350 · 32 Đế Neo Đáy Dùng Chung'],
  ['(Ghi chú: Chưa bao gồm kết cấu bè pin, phao nổi và nhà điều hành - theo yêu cầu chờ bản vẽ bổ sung)'],
  [''],
  ['STT', 'HẠNG MỤC VẬT TƯ / THIẾT BỊ', 'QUY CÁCH KỸ THUẬT / TIÊU CHUẨN', 'ĐƠN VỊ TÍNH', 'KHỐI LƯỢNG THIẾT KẾ', 'HỆ SỐ HAO HỤT / DỰ PHÒNG', 'KHỐI LƯỢNG ĐẶT HÀNG (ORDER)', 'GHI CHÚ / MỤC ĐÍCH SỬ DỤNG'],
  
  // NHÓM 1: DÂY CÁP NEO
  ['I', 'NHÓM DÂY CÁP NEO POLYYESTER (PES) CHỊU LỰC CAO', '', '', '', '', '', ''],
  [1, 'Cáp neo chính Polyester (Dây bờ)', 'Polyester PES-28 đến PES-36, MBL 180-320 kN, bện 8-12 tao, chống UV', 'md', Math.round(totalMainShoreM), '8%', Math.round(totalMainShoreM * 1.08), '231 tuyến cáp chính từ cọc bờ ra chạc Y (đóng cuộn 500m/1000m)'],
  [2, 'Cáp neo chính Polyester (Dây đáy)', 'Polyester PES-32 đến PES-36, MBL 240-320 kN, bện 8-12 tao, chống UV', 'md', Math.round(totalMainBedM), '8%', Math.round(totalMainBedM * 1.08), '64 tuyến cáp chính từ 32 đế đáy ra chạc Y (đóng cuộn 500m)'],
  [3, 'Cáp nhánh Bridle chữ Y (Bám vào 2 bích bè)', 'Polyester PES-24 đến PES-30, MBL 140-210 kN, 2 nhánh x 3,5m/tuyến', 'md', Math.round(totalBridleShoreM + totalBridleBedM), '8%', Math.round((totalBridleShoreM + totalBridleBedM) * 1.08), '590 nhánh cáp chạc Y (295 tuyến x 2 nhánh x 3,5m; gia công bấm khuyên)'],
  ['', 'TỔNG CỘNG DÂY CÁP PES TẤT CẢ CÁC LOẠI', '', 'md', Math.round(totalMainShoreM + totalMainBedM + totalBridleShoreM + totalBridleBedM), '8%', Math.round((totalMainShoreM + totalMainBedM + totalBridleShoreM + totalBridleBedM) * 1.08), 'Tổng chiều dài cáp cần order ~ 9.550 md'],

  // NHÓM 2: CỌC KHOAN NHỒI BỜ D350
  ['II', 'NHÓM CỌC KHOAN NHỒI TRÒN BỜ D350 (231 CỌC, L = 6,5 M)', '', '', '', '', '', ''],
  [4, 'Khoan tạo lỗ cọc bờ D350', 'Đường kính cọc khoan nhồi D350 mm, chiều sâu ngàm đất L = 6,5 m', 'md', Math.round(totalPileMeters), '0%', Math.round(totalPileMeters), '231 cọc ven sườn đồi cao trình ≥ +384,0m'],
  [5, 'Bê tông thương phẩm cọc bờ', 'Bê tông C25/30 (M350), đá 1x2, độ sụt 18±2cm đổ tại chỗ', 'm³', Number(totalPileConcreteM3.toFixed(1)), '5%', Number((totalPileConcreteM3 * 1.05).toFixed(1)), 'Đã gồm 5% hao hụt đổ bê tông cọc khoan nhồi trong đất'],
  [6, 'Thép chủ lồng cọc bờ (CB400-V)', 'Thanh vằn CB400-V gồm Φ25, Φ28, Φ32 (chiều dài cây tiêu chuẩn 11,7m)', 'kg', Math.round(totalMainRebarKg), '3%', Math.round(totalMainRebarKg * 1.03), 'Tương đương ~2.750 cây thép 11,7m (chi tiết theo từng cụm bè)'],
  [7, 'Thép đai xoắn cọc bờ (CB240-T)', 'Thép cuộn tròn trơn Φ8 bước xoắn a100/a150', 'kg', Math.round(totalStirrupRebarKg), '5%', Math.round(totalStirrupRebarKg * 1.05), 'Đai xoắn gia cường chống uốn và cắt đầu cọc'],
  [8, 'Bản nắp thép đỉnh cọc mạ kẽm', 'Thép tấm SS400 kích thước 400x400x20 mm, mạ kẽm nhúng nóng', 'tấm', 231, '0%', 231, 'Bản thép đỉnh đậy nắp cọc, hàn râu thép ngàm vào cọc'],
  [9, 'Tai neo thép đỉnh cọc (Padeye đơn)', 'Thép tấm SS400 dày t = 25 mm, vát góc, lỗ chốt cáp Φ40 mm', 'cái', 231, '0%', 231, 'Hàn chắc chắn trên bản nắp đỉnh cọc'],
  [10, 'Bulông neo / Râu thép ngàm đầu cọc', 'Thanh thép vằn 4Φ25 L = 600 mm hàn chân bản nắp ngàm vào bê tông', 'thanh', 231 * 4, '2%', Math.round(231 * 4 * 1.02), '924 thanh ngàm chân bản mã'],

  // NHÓM 3: ĐẾ NEO ĐÁY BTCT + VÍT XOẮN PA3
  ['III', 'NHÓM ĐẾ NEO ĐÁY LÒNG HỒ BTCT + VÍT XOẮN PA3 (32 ĐẾ DÙNG CHUNG)', '', '', '', '', '', ''],
  [11, 'Bê tông đúc sẵn đế neo đáy', 'Bê tông C25/30 (M350) chống thấm B8-B10, phụ gia chống ăn mòn nước hồ', 'm³', Number(totalBaseConcreteM3.toFixed(1)), '3%', Number((totalBaseConcreteM3 * 1.03).toFixed(1)), 'Đúc sẵn trên bờ, dưỡng hộ đạt mác rồi cẩu thả đáy hồ'],
  [12, 'Cốt thép lưới bản đế đáy (CB400-V)', 'Thép vằn CB400-V Φ14 a150 lưới 2 lớp trên dưới + đai C', 'kg', Math.round(totalBaseRebarKg), '3%', Math.round(totalBaseRebarKg * 1.03), 'Gia cường chống chọc thủng và lật đế'],
  [13, 'Cọc vít xoắn ống thép Ø89×5 mạ kẽm', 'Ống thép đúc Ø89×5 mm mạ kẽm nhúng nóng, cánh xoắn Ø250-300 mm', 'md', Math.round(totalScrewMeters), '5%', Math.round(totalScrewMeters * 1.05), '128 cọc vít (4 cọc/đế, chiều dài cây 3,0m - 4,5m)'],
  [14, 'Nắp chụp khóa đầu cọc vít vào đế', 'Thép ống lồng Ø114x6 hàn bản bích chặn khóa đầu vít sau khi vặn', 'bộ', 128, '0%', 128, 'Khóa cứng đầu cọc vít neo vào bản bê tông đế'],
  [15, 'Cụm tai neo đôi mặt đế (Double Padeye)', 'Thép tấm SS400 t = 25 mm có 2 lỗ chốt Φ40 mm, hàn sườn tăng cường', 'bộ', 32, '0%', 32, 'Tai neo đôi chịu lực 2 hướng kéo về 2 cụm bè đối diện'],

  // NHÓM 4: PHỤ KIỆN LIÊN KẾT TOÀN HỆ THỐNG
  ['IV', 'NHÓM PHỤ KIỆN LIÊN KẾT & VẬN HÀNH HỆ NEO', '', '', '', '', '', ''],
  [16, 'Tăng đơ 2 đầu ma-nê cọc bờ', 'Tăng đơ thép rèn mạ kẽm, WLL 10 - 12 tấn, hành trình điều chỉnh ±300 mm', 'bộ', 231, '2%', 236, 'Lắp tại đầu 231 cọc bờ để vi chỉnh độ căng theo mùa'],
  [17, 'Vòng chia chạc Y (Master Link / Plate)', 'Vòng khuyên chủ tam giác / tròn Grade 80, WLL ≥ 12 tấn, tải đứt ≥ 480 kN', 'cái', 295, '2%', 301, 'Cụm chia chạc 1 cáp chính thành 2 nhánh Bridle bám vào bè'],
  [18, 'Ma-nê thân cong (Bow Shackle) 12 - 17T', 'Ma-nê thép rèn mạ kẽm chốt vặn an toàn (Safety Pin), WLL 12-17 tấn', 'cái', 231 + 64 + 295, '3%', Math.round((231 + 64 + 295) * 1.03), 'Liên kết cọc bờ (231), đế đáy (64) và cụm chạc Y (295)'],
  [19, 'Ma-nê thân cong (Bow Shackle) 8.5 - 12T', 'Ma-nê thép rèn mạ kẽm chốt ren / chốt chẻ, WLL 8.5-12 tấn', 'cái', 295 * 2 + 590, '3%', Math.round((295 * 2 + 590) * 1.03), 'Liên kết 2 nhánh chạc Y vào vòng chia và vào bích mép bè'],
  [20, 'Khuyên lót bện cáp (Thimbles) bảo vệ mắt', 'Khuyên thép mạ kẽm dập rãnh sâu tiêu chuẩn hàng hải cho cáp Ø28-Ø36', 'cái', 295 * 2 + 590 * 2, '5%', Math.round((295 * 2 + 590 * 2) * 1.05), '1.770 mắt cáp bện đều có khuyên lót chống gập gãy'],
  [21, 'Đoạn xích neo vi chỉnh bích bè', 'Xích neo Grade 80 đúc mạ kẽm Ø13-Ø16 mm, dài L = 1,2 - 1,5 m/đoạn', 'đoạn', 590, '2%', 602, 'Lắp tại 590 bích bám trên bè để tinh chỉnh tăng/giảm từng mắt xích'],
  [22, 'Phao nổi treo cáp đáy chống kẹt bùn', 'Phao nhựa PE đúc rỗng / bọt xốp chịu nước, sức nổi 15 - 20 kg', 'quả', 64, '5%', 68, 'Treo cách 32 đế neo 3m để nhấc nhẹ bụng cáp khi nước hồ cạn (MNC)']
];

const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
wsSummary['!cols'] = [6, 38, 42, 10, 18, 14, 18, 40].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, wsSummary, '1.TONG_HOP_ORDER');

// ==========================================
// SHEET 2: CHI TIẾT CÁP NEO BRIDLE (295 TUYẾN)
// ==========================================
const cableAOA = [
  ['BẢNG THỐNG KÊ CHI TIẾT 295 TUYẾN CÁP NEO THEO PHƯƠNG ÁN CHẠC ĐÔI (BRIDLE MOORING Y-LEGS)'],
  ['Dự án: Hệ thống bè pin nổi Hồ Huổi Vanh · Chiều dài mỗi nhánh chạc Y = 3,50 m'],
  ['STT', 'MÃ TUYẾN', 'CỤM BÈ', 'LOẠI NEO', 'TẦM VƯƠN (m)', 'CAO ĐỘ CHỐT NEO (m)', 'MỰC NƯỚC BẤT LỢI', 'L CHỐT-CHỐT BẤT LỢI (m)', 'L CÁP CHÍNH (m)', 'QUY CÁCH NHÁNH BRIDLE', 'TỔNG L NHÁNH (m)', 'TỔNG L THIẾT KẾ (m)', 'L ORDER (+8% HAO HỤT) (m)', 'QUY CÁCH CÁP CHÍNH', 'QUY CÁCH CÁP NHÁNH']
];

for (const r of cableRows) {
  cableAOA.push([
    r.stt, r.code, r.raft, r.type, r.span, r.pinZ, r.governingWater, r.chordGov_m,
    r.mainLine_m, r.bridleLegs_m, r.bridleTotal_m, r.totalLine_m, r.orderWithAllowance_m,
    r.cableSpecMain, r.cableSpecBridle
  ]);
}

const wsCable = XLSX.utils.aoa_to_sheet(cableAOA);
wsCable['!cols'] = [6, 12, 10, 16, 14, 16, 16, 18, 15, 20, 15, 16, 20, 32, 32].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, wsCable, '2.CHI_TIET_CAP_BRIDLE');

// ==========================================
// SHEET 3: CHI TIẾT CỌC KHOAN NHỒI BỜ D350
// ==========================================
const pileAOA = [
  ['BẢNG TỔNG HỢP VẬT TƯ CỌC KHOAN NHỒI TRÒN BỜ D350 (231 CỌC, L = 6,5 M) PHÂN THEO 9 CỤM BÈ'],
  ['Quy cách: Cọc D350 mm, L = 6,5 m (nhô mặt đất 0,1 m) · Bê tông C25/30 · Nắp bản mã 400x400x20 + Tai neo t=25 + Tăng đơ 10-12T'],
  ['CỤM BÈ', 'SỐ CỌC BỜ', 'CHIỀU DÀI 1 CỌC (m)', 'TỔNG MÉT KHOAN (md)', 'V BÊ TÔNG (m³)', 'QUY CÁCH THÉP CHỦ', 'KL THÉP CHỦ (kg)', 'KL THÉP ĐAI Φ8 (kg)', 'TỔNG KL THÉP CỌC (kg)', 'BẢN MÃ ĐỈNH (tấm)', 'TAI NEO (cái)', 'TĂNG ĐƠ 10-12T (bộ)']
];

for (const p of pileSummaryRows) {
  pileAOA.push([
    p.raft, p.count, p.L_m, p.totalM_m, p.concrete_m3, p.rebarSpec,
    p.mainSteel_kg, p.stirrupSteel_kg, p.totalSteel_kg, p.capPlates, p.padeyes, p.turnbuckles
  ]);
}
pileAOA.push(['']);
pileAOA.push([
  'TỔNG CỘNG', 231, 6.5, Math.round(totalPileMeters), Number(totalPileConcreteM3.toFixed(1)), 'CB400-V + CB240-T',
  Math.round(totalMainRebarKg), Math.round(totalStirrupRebarKg), Math.round(totalMainRebarKg + totalStirrupRebarKg),
  231, 231, 231
]);

const wsPile = XLSX.utils.aoa_to_sheet(pileAOA);
wsPile['!cols'] = [12, 12, 16, 18, 14, 18, 16, 16, 18, 16, 14, 18].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, wsPile, '3.COC_KHOAN_NHOI_BO');

// ==========================================
// SHEET 4: CHI TIẾT 32 ĐẾ NEO ĐÁY VÍT XOẮN PA3
// ==========================================
const baseAOA = [
  ['BẢNG TỔNG HỢP VẬT TƯ ĐẾ NEO ĐÁY LÒNG HỒ BTCT + VÍT XOẮN PA3 (32 ĐẾ DÙNG CHUNG 100%)'],
  ['Vật tư: Bê tông C25/30 chống thấm B8-B10 · Thép lưới Φ14 a150 · Cọc vít xoắn ống thép Ø89x5 mạ kẽm · Tai neo đôi · Phao treo'],
  ['PHÂN LOẠI CỠ ĐẾ', 'CẠNH B (m)', 'CHIỀU DÀY t (m)', 'SỐ LƯỢNG ĐẾ', 'TỔNG V BÊ TÔNG (m³)', 'TỔNG THÉP LƯỚI (kg)', 'SỐ CỌC VÍT (cây)', 'TỔNG DÀI VÍT (md)', 'TAI NEO ĐÔI (bộ)', 'PHAO TREO 15-20KG (quả)']
];

for (const b of baseSummaryRows) {
  baseAOA.push([
    b.type, b.side_m, b.thk_m, b.count, b.concrete_m3, b.rebar_kg, b.screwsCount, b.screwTotalL_m, b.doublePadeyes, b.markerBuoys
  ]);
}
baseAOA.push(['']);
baseAOA.push([
  'TỔNG CỘNG', '-', '-', 32, Number(totalBaseConcreteM3.toFixed(1)), Math.round(totalBaseRebarKg),
  totalScrews, Math.round(totalScrewMeters), 32, 64
]);

const wsBase = XLSX.utils.aoa_to_sheet(baseAOA);
wsBase['!cols'] = [32, 12, 14, 14, 18, 18, 16, 16, 16, 20].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, wsBase, '4.DE_NEO_DAY_VIT_XOAN');

// ==========================================
// SHEET 5: PHỤ KIỆN LIÊN KẾT TOÀN HỆ
// ==========================================
const accessoryAOA = [
  ['BẢNG THỐNG KÊ CHI TIẾT TOÀN BỘ PHỤ KIỆN HỆ NEO BÈ PIN HỒ HUỔI VANH'],
  ['Tiêu chuẩn: Cấp độ bền hàng hải / công trình nổi, mạ kẽm nhúng nóng toàn bộ'],
  ['STT', 'TÊN THIẾT BỊ / PHỤ KIỆN', 'QUY CÁCH / CẤP TẢI', 'VỊ TRÍ LẮP ĐẶT', 'ĐƠN VỊ', 'SỐ LƯỢNG THIẾT KẾ', 'DỰ PHÒNG', 'TỔNG ORDER', 'TIÊU CHUẨN ÁP DỤNG'],
  [1, 'Tăng đơ 2 đầu ma-nê (Turnbuckle)', 'WLL 10 - 12 tấn, hành trình ±300 mm, ren M36-M42', 'Đầu 231 cọc bờ D350', 'bộ', 231, '5 bộ', 236, 'US Fed Spec FF-T-791b'],
  [2, 'Vòng khuyên chia chạc Y (Master Link)', 'Grade 80, WLL ≥ 12 tấn, tải đứt ≥ 480 kN', 'Cụm chia chạc 295 tuyến', 'cái', 295, '6 cái', 301, 'EN 1677-4 / ASME B30.26'],
  [3, 'Ma-nê thân cong (Bow Shackle) 17T', 'WLL 17 tấn, chốt vặn an toàn (Safety Pin) Ø42mm', 'Đầu cọc bờ tải trọng lớn (Bè 3A, 5A)', 'cái', 120, '4 cái', 124, 'US Fed Spec RR-C-271D Grade A'],
  [4, 'Ma-nê thân cong (Bow Shackle) 12T', 'WLL 12 tấn, chốt vặn an toàn (Safety Pin) Ø35mm', 'Đầu cọc bờ thông thường và đế đáy', 'cái', 111 + 64 + 295, '15 cái', 485, 'US Fed Spec RR-C-271D Grade A'],
  [5, 'Ma-nê thân cong (Bow Shackle) 8.5T', 'WLL 8.5 tấn, chốt vặn ren Ø28mm', 'Đầu 2 nhánh chạc Y bám vào bích bè', 'cái', 590, '18 cái', 608, 'US Fed Spec RR-C-271D Grade A'],
  [6, 'Khuyên lót bện cáp (Thimbles) Ø32-36', 'Thép dập rãnh sâu mạ kẽm cho cáp chính Ø32-36', '2 đầu mắt cáp chính', 'cái', 295 * 2, '30 cái', 620, 'US Fed Spec FF-T-276b Type III'],
  [7, 'Khuyên lót bện cáp (Thimbles) Ø24-28', 'Thép dập rãnh sâu mạ kẽm cho cáp nhánh Ø24-28', '2 đầu mắt cáp nhánh Bridle', 'cái', 590 * 2, '50 cái', 1230, 'US Fed Spec FF-T-276b Type III'],
  [8, 'Đoạn xích neo vi chỉnh bích bè', 'Xích Grade 80 mạ kẽm Ø13-16 mm, L = 1,2 m', 'Gắn tại 590 bích mép bè', 'đoạn', 590, '12 đoạn', 602, 'DIN 766 / ISO 1834'],
  [9, 'Phao nổi treo cáp đáy chống kẹt bùn', 'Phao nhựa PE đúc rỗng / bọt biển, sức nổi 15-20 kg', 'Treo cách 32 đế đáy 3m', 'quả', 64, '4 quả', 68, 'Chịu ngập nước liên tục']
];

const wsAccessory = XLSX.utils.aoa_to_sheet(accessoryAOA);
wsAccessory['!cols'] = [6, 28, 36, 26, 10, 16, 12, 14, 28].map((wch) => ({ wch }));
XLSX.utils.book_append_sheet(wb, wsAccessory, '5.PHU_KIEN_LIEN_KET');

// 5. Xuất file Excel
const outPublic = path.join(ROOT, 'public/docs_huoi_vanh/HOHUOIVANH_BANG_THONG_KE_VAT_TU_ORDER.xlsx');
const outDocs = path.join(ROOT, 'docs/mat-bang-neo-9-be/HOHUOIVANH_BANG_THONG_KE_VAT_TU_ORDER.xlsx');

fs.mkdirSync(path.dirname(outPublic), { recursive: true });
fs.mkdirSync(path.dirname(outDocs), { recursive: true });

XLSX.writeFile(wb, outPublic);
XLSX.writeFile(wb, outDocs);

console.log(`Successfully generated Material Order BOQ workbook:`);
console.log(` - ${outPublic}`);
console.log(` - ${outDocs}`);
