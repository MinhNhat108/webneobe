#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const wb = XLSX.utils.book_new();

// SHEET 1: BẢNG TỔNG HỢP TOÀN BỘ 4 NHÓM VẬT TƯ ORDER
const dataTongHop = [
  ['BẢNG THỐNG KÊ VẬT TƯ ĐẶT HÀNG HỆ NEO BÈ PIN HỒ HUỔI VANH'],
  ['DỰ ÁN: HỆ THỐNG NEO 9 CỤM BÈ PIN NĂNG LƯỢNG MẶT TRỜI NỔI HỒ HUỔI VANH'],
  ['Địa điểm: Hồ Thủy điện Huổi Vanh, Tỉnh Điện Biên · Quy mô: 9 Cụm Bè · 295 Tuyến Cáp Chạc Y · 231 Cọc Bờ D350 · 32 Đế Đáy Dùng Chung'],
  ['(Ghi chú: Chưa bao gồm kết cấu bè pin, phao nổi và nhà điều hành - theo yêu cầu chờ bản vẽ bổ sung)'],
  [''],
  ['STT', 'TÊN HẠNG MỤC VẬT TƯ / THIẾT BỊ', 'QUY CÁCH KỸ THUẬT / TIÊU CHUẨN', 'ĐVT', 'KHỐI LƯỢNG THIẾT KẾ', 'HỆ SỐ DỰ PHÒNG / HAO HỤT', 'KHỐI LƯỢNG ĐẶT HÀNG (ORDER)', 'GHI CHÚ THI CÔNG / MỤC ĐÍCH SỬ DỤNG'],
  
  // I. DÂY CÁP
  ['I', 'NHÓM DÂY CÁP NEO POLYYESTER (PES) CHỊU LỰC CAO (Phương án chạc chữ Y bám vào bè)', '', '', '', '', '', ''],
  ['1', 'Cáp neo chính Polyester (Dây bờ)', 'Polyester PES-28 đến PES-36, MBL 180 - 320 kN, bện 8-12 tao, chống UV', 'md', 5694, '8%', 6150, '231 tuyến cáp chính từ cọc bờ ra chạc Y (đóng cuộn 500m/1000m)'],
  ['2', 'Cáp neo chính Polyester (Dây đáy)', 'Polyester PES-32 đến PES-36, MBL 240 - 320 kN, bện 8-12 tao, chống UV', 'md', 1059, '8%', 1150, '64 tuyến cáp chính từ 32 đế đáy ra chạc Y (đóng cuộn 500m)'],
  ['3', 'Cáp nhánh Bridle chữ Y (Bám vào 2 bích bè)', 'Polyester PES-24 đến PES-30, MBL 140 - 210 kN, 2 nhánh x 3,5m/tuyến', 'md', 2065, '8%', 2250, '590 nhánh cáp (295 tuyến x 2 nhánh x 3,5m; gia công bấm khuyên 2 đầu)'],
  ['', 'TỔNG CỘNG CHIỀU DÀI CÁP NEO PES CÁC LOẠI', 'Tổng chiều dài cáp chính + cáp nhánh chạc Y', 'md', 8818, '8%', 9550, 'Tổng lượng cáp PES cần đặt hàng ~ 9.550 md'],

  // II. CỌC BỜ D350
  ['II', 'NHÓM CỌC KHOAN NHỒI TRÒN BỜ D350 (231 CỌC, L = 6,5 M)', '', '', '', '', '', ''],
  ['4', 'Khoan tạo lỗ cọc bờ D350', 'Đường kính D350 mm, chiều sâu ngàm đất L = 6,5 m (nhô mặt đất 0,1 m)', 'md', 1501.5, '0%', 1501.5, '231 cọc khoan nhồi tròn ven sườn đồi cao trình ≥ +384,0m'],
  ['5', 'Bê tông thương phẩm cọc bờ', 'Bê tông C25/30 (M350), đá 1x2, độ sụt 18±2cm đổ tại chỗ', 'm³', 144.5, '5%', 151.7, 'Đã gồm 5% hao hụt đổ bê tông cọc khoan nhồi trong đất'],
  ['6', 'Thép chủ lồng cọc bờ (CB400-V)', 'Thanh vằn CB400-V gồm Φ25, Φ28, Φ32 (cây dài tiêu chuẩn 11,7m)', 'kg', 31442, '3%', 32385, 'Tương đương ~2.750 cây thép 11,7m (~32,4 tấn)'],
  ['7', 'Thép đai xoắn cọc bờ (CB240-T)', 'Thép cuộn tròn trơn Φ8 bước xoắn a100 đoạn đầu cọc, a150 đoạn thân', 'kg', 5156, '5%', 5415, 'Gia cường chịu mômen uốn và lực cắt đầu cọc (~5,4 tấn)'],
  ['8', 'Bản nắp thép đỉnh cọc mạ kẽm', 'Thép tấm SS400 kích thước 400x400x20 mm, mạ kẽm nhúng nóng', 'tấm', 231, '0%', 231, 'Bản mã đậy nắp đỉnh cọc, hàn râu thép ngàm sâu vào cọc (~5,8 tấn)'],
  ['9', 'Tai neo thép đỉnh cọc (Padeye đơn)', 'Thép tấm SS400 dày t = 25 mm, vát góc, lỗ chốt cáp Φ40 mm', 'cái', 231, '0%', 231, 'Hàn chắc chắn trên bản nắp đỉnh cọc (~1,2 tấn)'],
  ['10', 'Bulông neo / Râu thép ngàm đầu cọc', 'Thanh thép vằn 4Φ25 L = 600 mm hàn chân bản nắp ngàm vào bê tông', 'thanh', 924, '2%', 942, '942 thanh râu thép ngàm giữ bản nắp'],

  // III. ĐẾ NEO ĐÁY PA3
  ['III', 'NHÓM ĐẾ NEO ĐÁY LÒNG HỒ BTCT + VÍT XOẮN PA3 (32 ĐẾ DÙNG CHUNG 100%)', '', '', '', '', '', ''],
  ['11', 'Bê tông đúc sẵn đế neo đáy', 'Bê tông C25/30 (M350) chống thấm B8-B10, chống ăn mòn nước hồ', 'm³', 92.8, '3%', 95.6, 'Đúc sẵn 32 đế trên bờ, đạt cường độ cẩu hạ đáy hồ'],
  ['12', 'Cốt thép lưới bản đế đáy (CB400-V)', 'Thép vằn CB400-V Φ14 a150 lưới 2 lớp trên dưới + đai C', 'kg', 7218, '3%', 7435, 'Cốt thép bản đế chống uốn, cắt và chống lật đế (~7,4 tấn)'],
  ['13', 'Cọc vít xoắn ống thép Ø89×5 mạ kẽm', 'Ống thép đúc Ø89×5 mm mạ kẽm nhúng nóng, cánh xoắn Ø250-300 mm', 'md', 474, '5%', 498, '128 cọc vít (4 cọc/đế, chiều dài cây 3,0m - 4,5m)'],
  ['14', 'Nắp chụp khóa đầu cọc vít vào đế', 'Thép ống lồng Ø114x6 hàn bản bích chặn khóa đầu vít sau khi vặn', 'bộ', 128, '0%', 128, 'Khóa cứng đầu cọc vít neo vào bản bê tông đế'],
  ['15', 'Cụm tai neo đôi mặt đế (Double Padeye)', 'Thép tấm SS400 t = 25 mm có 2 lỗ chốt Φ40 mm, hàn sườn tăng cường', 'bộ', 32, '0%', 32, 'Tai neo đôi chịu lực 2 hướng kéo về 2 cụm bè đối diện'],

  // IV. PHỤ KIỆN
  ['IV', 'NHÓM PHỤ KIỆN LIÊN KẾT & VẬN HÀNH HỆ NEO', '', '', '', '', '', ''],
  ['16', 'Tăng đơ 2 đầu ma-nê cọc bờ', 'Tăng đơ thép rèn mạ kẽm, WLL 10 - 12 tấn, hành trình điều chỉnh ±300 mm', 'bộ', 231, '2%', 236, 'Lắp tại đầu 231 cọc bờ để vi chỉnh độ căng theo mùa (US FF-T-791b)'],
  ['17', 'Vòng chia chạc Y (Master Link)', 'Vòng khuyên chủ tam giác / tròn Grade 80, WLL ≥ 12 tấn, tải đứt ≥ 480 kN', 'cái', 295, '2%', 301, 'Cụm chia chạc 1 cáp chính thành 2 nhánh Bridle (EN 1677-4)'],
  ['18', 'Ma-nê thân cong (Bow Shackle) 17T', 'Ma-nê thép rèn mạ kẽm chốt an toàn (Safety Pin), WLL 17 tấn', 'cái', 120, '4 cái', 124, 'Cọc bờ tải lớn (Bè 3A, 5A) - RR-C-271D Grade A'],
  ['19', 'Ma-nê thân cong (Bow Shackle) 12T', 'Ma-nê thép rèn mạ kẽm chốt an toàn (Safety Pin), WLL 12 tấn', 'cái', 470, '15 cái', 485, 'Cọc bờ thường, đế đáy và cụm chia chạc Y - RR-C-271D'],
  ['20', 'Ma-nê thân cong (Bow Shackle) 8.5T', 'Ma-nê thép rèn mạ kẽm chốt ren / chốt chẻ, WLL 8.5 tấn', 'cái', 1180, '36 cái', 1216, 'Liên kết 2 đầu nhánh chạc Y vào vòng chia và bích bè'],
  ['21', 'Khuyên lót bện cáp (Thimbles) bảo vệ mắt', 'Khuyên thép mạ kẽm dập rãnh sâu hàng hải cho cáp Ø24-Ø36', 'cái', 1770, '80 cái', 1850, '1.770 mắt cáp bện đều có khuyên lót chống gập gãy (US FF-T-276b)'],
  ['22', 'Đoạn xích neo vi chỉnh bích bè', 'Xích neo Grade 80 đúc mạ kẽm Ø13-Ø16 mm, dài L = 1,2 - 1,5 m/đoạn', 'đoạn', 590, '12 đoạn', 602, 'Lắp tại 590 bích mép bè để tinh chỉnh từng mắt xích (~750m)'],
  ['23', 'Phao nổi treo cáp đáy chống kẹt bùn', 'Phao nhựa PE đúc rỗng / bọt xốp chịu nước, sức nổi 15 - 20 kg', 'quả', 64, '4 quả', 68, 'Treo cách 32 đế neo 3m để nhấc nhẹ bụng cáp khi nước cạn (MNC)']
];

const ws1 = XLSX.utils.aoa_to_sheet(dataTongHop);
ws1['!cols'] = [6, 40, 45, 10, 18, 16, 20, 42].map(wch => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws1, 'TONG_HOP_VAT_TU_ORDER');

// SHEET 2: BẢNG 1 - DÂY CÁP BRIDLE
const dataCap = [
  ['I. BẢNG THỐNG KÊ CHI TIẾT ĐẶT HÀNG DÂY CÁP NEO POLYYESTER (PES) CHỊU LỰC CAO'],
  ['Phương án: Cáp chia 2 nhánh chữ Y (Bridle Mooring) bám vào 2 bích trên mép bè'],
  ['STT', 'TÊN VẬT TƯ', 'QUY CÁCH KỸ THUẬT', 'ĐVT', 'KL THIẾT KẾ', 'HAO HỤT DỰ PHÒNG', 'KL ĐẶT HÀNG (ORDER)', 'GHI CHÚ THI CÔNG'],
  ['1', 'Cáp neo chính Polyester (Dây bờ)', 'Polyester PES-28 đến PES-36, MBL 180-320 kN, bện 8-12 tao, chống UV', 'md', 5694, '8%', 6150, '231 tuyến cáp chính từ cọc bờ ra chạc Y (đóng cuộn 500m/1000m)'],
  ['2', 'Cáp neo chính Polyester (Dây đáy)', 'Polyester PES-32 đến PES-36, MBL 240-320 kN, bện 8-12 tao, chống UV', 'md', 1059, '8%', 1150, '64 tuyến cáp chính từ 32 đế đáy ra chạc Y (đóng cuộn 500m)'],
  ['3', 'Cáp nhánh Bridle chữ Y (Bám vào 2 bích bè)', 'Polyester PES-24 đến PES-30, MBL 140-210 kN, 2 nhánh x 3,5m/tuyến', 'md', 2065, '8%', 2250, '590 nhánh cáp (295 tuyến x 2 nhánh x 3,5m; gia công bấm khuyên 2 đầu)'],
  ['', 'TỔNG CỘNG DÂY CÁP PES TẤT CẢ CÁC LOẠI', 'Cáp bện tổng hợp công trình nổi', 'md', 8818, '8%', 9550, 'Tổng lượng cáp PES cần order ~ 9.550 md']
];
const ws2 = XLSX.utils.aoa_to_sheet(dataCap);
ws2['!cols'] = [6, 38, 42, 10, 16, 16, 18, 40].map(wch => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws2, '1.DAY_CAP_BRIDLE_Y');

// SHEET 3: BẢNG 2 - CỌC BỜ D350
const dataCoc = [
  ['II. BẢNG THỐNG KÊ CHI TIẾT ĐẶT HÀNG CỌC KHOAN NHỒI TRÒN BỜ D350 (231 CỌC, L = 6,5 M)'],
  ['Cọc D350 mm, L = 6,5 m (nhô 0,1 m) · Bê tông C25/30 · Thép CB400-V + CB240-T · Bản mã 400x400x20 + Tai neo t=25'],
  ['STT', 'TÊN VẬT TƯ / CÔNG VIỆC', 'QUY CÁCH KỸ THUẬT', 'ĐVT', 'KL THIẾT KẾ', 'HỆ SỐ HAO HỤT', 'KL ĐẶT HÀNG (ORDER)', 'GHI CHÚ'],
  ['1', 'Khoan tạo lỗ cọc bờ D350', 'Cọc D350 mm, chiều sâu ngàm L = 6,5 m', 'md', 1501.5, '0%', 1501.5, '231 cọc ven sườn đồi cao trình ≥ +384,0m'],
  ['2', 'Bê tông cọc khoan nhồi', 'Bê tông C25/30 (M350), đá 1x2, độ sụt 18±2cm', 'm³', 144.5, '5%', 151.7, 'Đã gồm 5% hao hụt đổ bê tông cọc khoan trong đất'],
  ['3', 'Thép chủ lồng cọc (CB400-V)', 'Thép thanh vằn Φ25, Φ28, Φ32 (cây dài 11,7m)', 'kg', 31442, '3%', 32385, 'Tương đương ~2.750 cây thép 11,7m (~32,4 tấn)'],
  ['4', 'Thép đai xoắn cọc (CB240-T)', 'Thép cuộn tròn trơn Φ8 bước xoắn a100/a150', 'kg', 5156, '5%', 5415, 'Gia cường chịu uốn và cắt đầu cọc (~5,4 tấn)'],
  ['5', 'Bản nắp thép đỉnh cọc mạ kẽm', 'Thép tấm SS400 kích thước 400x400x20 mm mạ kẽm', 'tấm', 231, '0%', 231, 'Bản mã đậy đỉnh cọc, hàn râu thép ngàm sâu (~5,8 tấn)'],
  ['6', 'Tai neo đỉnh cọc (Padeye đơn)', 'Thép tấm SS400 dày t = 25 mm, lỗ chốt Φ40 mm', 'cái', 231, '0%', 231, 'Hàn chắc chắn trên bản nắp đỉnh cọc (~1,2 tấn)'],
  ['7', 'Bulông neo / Râu thép ngàm', 'Thép thanh vằn 4Φ25 L = 600 mm hàn chân bản nắp', 'thanh', 924, '2%', 942, '942 thanh râu thép ngàm bản nắp vào bê tông']
];
const ws3 = XLSX.utils.aoa_to_sheet(dataCoc);
ws3['!cols'] = [6, 32, 40, 10, 16, 14, 18, 38].map(wch => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws3, '2.COC_BO_D350');

// SHEET 4: BẢNG 3 - ĐẾ NEO ĐÁY PA3
const dataDe = [
  ['III. BẢNG THỐNG KÊ CHI TIẾT ĐẶT HÀNG ĐẾ NEO ĐÁY LÒNG HỒ BTCT + VÍT XOẮN PA3 (32 ĐẾ DÙNG CHUNG)'],
  ['Bê tông C25/30 chống thấm B8-B10 · Thép lưới Φ14 a150 · Cọc vít xoắn Ø89x5 mạ kẽm · Tai neo đôi · Phao treo'],
  ['STT', 'TÊN VẬT TƯ', 'QUY CÁCH KỸ THUẬT', 'ĐVT', 'KL THIẾT KẾ', 'HỆ SỐ HAO HỤT', 'KL ĐẶT HÀNG (ORDER)', 'GHI CHÚ'],
  ['1', 'Bê tông đúc sẵn đế neo đáy', 'Bê tông C25/30 (M350) chống thấm B8-B10', 'm³', 92.8, '3%', 95.6, 'Đúc sẵn 32 đế trên bờ, đạt cường độ cẩu hạ đáy hồ'],
  ['2', 'Cốt thép lưới đế (CB400-V)', 'Thép vằn Φ14 a150 lưới 2 lớp + đai C', 'kg', 7218, '3%', 7435, 'Cốt thép bản đế chống uốn, cắt (~7,4 tấn)'],
  ['3', 'Cọc vít xoắn ống thép mạ kẽm', 'Thép ống Ø89x5 mm mạ kẽm, cánh xoắn Ø250-300 mm', 'md', 474, '5%', 498, '128 cọc vít (4 cọc/đế, chiều dài cây 3,0 - 4,5 m)'],
  ['4', 'Nắp chụp khóa cọc vít', 'Thép ống lồng Ø114x6 hàn bản bích chặn', 'bộ', 128, '0%', 128, 'Khóa cứng đầu cọc vít vào bản bê tông đế'],
  ['5', 'Cụm tai neo đôi mặt đế', 'Thép tấm SS400 t = 25 mm có 2 lỗ chốt Φ40 mm', 'bộ', 32, '0%', 32, 'Chịu lực kéo 2 hướng đối diện về 2 bè']
];
const ws4 = XLSX.utils.aoa_to_sheet(dataDe);
ws4['!cols'] = [6, 32, 40, 10, 16, 14, 18, 38].map(wch => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws4, '3.DE_NEO_DAY_PA3');

// SHEET 5: BẢNG 4 - PHỤ KIỆN
const dataPK = [
  ['IV. BẢNG THỐNG KÊ CHI TIẾT ĐẶT HÀNG NHÓM PHỤ KIỆN LIÊN KẾT & VẬN HÀNH TOÀN HỆ THỐNG'],
  ['Tiêu chuẩn hàng hải / công trình nổi, mạ kẽm nhúng nóng toàn bộ'],
  ['STT', 'TÊN PHỤ KIỆN', 'QUY CÁCH / CẤP TẢI', 'VỊ TRÍ LẮP ĐẶT', 'ĐVT', 'SL THIẾT KẾ', 'DỰ PHÒNG', 'KL ORDER', 'TIÊU CHUẨN ÁP DỤNG'],
  ['1', 'Tăng đơ 2 đầu ma-nê', 'WLL 10 - 12 tấn, hành trình ±300 mm', 'Đầu 231 cọc bờ D350', 'bộ', 231, '5 bộ', 236, 'US Fed Spec FF-T-791b'],
  ['2', 'Vòng chia chạc Y (Master Link)', 'Grade 80, WLL ≥ 12 tấn, tải đứt ≥ 480 kN', 'Cụm chia chạc 295 tuyến', 'cái', 295, '6 cái', 301, 'EN 1677-4 / ASME B30.26'],
  ['3', 'Ma-nê thân cong (Bow Shackle) 17T', 'WLL 17 tấn, chốt vặn an toàn Safety Pin', 'Cọc bờ tải lớn (Bè 3A, 5A)', 'cái', 120, '4 cái', 124, 'US Fed Spec RR-C-271D Grade A'],
  ['4', 'Ma-nê thân cong (Bow Shackle) 12T', 'WLL 12 tấn, chốt vặn an toàn Safety Pin', 'Cọc bờ thường & cụm chạc Y', 'cái', 470, '15 cái', 485, 'US Fed Spec RR-C-271D Grade A'],
  ['5', 'Ma-nê thân cong (Bow Shackle) 8.5T', 'WLL 8.5 tấn, chốt vặn ren bảo hiểm', '2 nhánh chạc Y & bích mép bè', 'cái', 1180, '36 cái', 1216, 'US Fed Spec RR-C-271D Grade A'],
  ['6', 'Khuyên lót bện cáp (Thimbles)', 'Thép dập rãnh sâu mạ kẽm cho cáp Ø24-Ø36', 'Mắt bện 2 đầu các sợi cáp', 'cái', 1770, '80 cái', 1850, 'US Fed Spec FF-T-276b Type III'],
  ['7', 'Đoạn xích neo vi chỉnh bích bè', 'Xích Grade 80 mạ kẽm Ø13-16 mm, L = 1,2 m', 'Gắn tại 590 bích mép bè', 'đoạn', 590, '12 đoạn', 602, 'DIN 766 / ISO 1834'],
  ['8', 'Phao nổi treo cáp đáy chống lún', 'Phao nhựa PE đúc rỗng, sức nổi 15-20 kg', 'Treo cách 32 đế neo 3m', 'quả', 64, '4 quả', 68, 'Chịu ngập nước liên tục']
];
const ws5 = XLSX.utils.aoa_to_sheet(dataPK);
ws5['!cols'] = [6, 28, 36, 26, 10, 16, 12, 14, 28].map(wch => ({ wch }));
XLSX.utils.book_append_sheet(wb, ws5, '4.PHU_KIEN_LIEN_KET');

// Xuất ra Desktop và thư mục làm việc
const pDesktop = 'C:/Users/nhatm/Desktop/BANG_THONG_KE_VAT_TU_ORDER_NEO_BE.xlsx';
const pWorkspace = './BANG_THONG_KE_VAT_TU_ORDER_NEO_BE.xlsx';
const pPublic = './public/docs_huoi_vanh/BANG_THONG_KE_VAT_TU_ORDER_NEO_BE.xlsx';

XLSX.writeFile(wb, pDesktop);
XLSX.writeFile(wb, pWorkspace);
XLSX.writeFile(wb, pPublic);

console.log('Successfully written exact BOQ Excel to:');
console.log(' - ' + pDesktop);
console.log(' - ' + pWorkspace);
console.log(' - ' + pPublic);
