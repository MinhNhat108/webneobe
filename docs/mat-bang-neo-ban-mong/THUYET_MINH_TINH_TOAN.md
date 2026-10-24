# Thuyết minh tính toán hệ neo: cọc khoan nhồi ven bờ + đế BTCT vít xoắn

## 1. Phương án neo

- Áp dụng phương án Chủ đầu tư đã chốt cho Huổi Vanh ngày 12/10/2026 (Cọc khoan nhồi D350 ven bờ + đế BTCT giữ bằng vít xoắn dưới đáy hồ); CHƯA chốt riêng cho hồ này.
- Hệ neo: 271 tuyến cáp tại 234 điểm neo = 133 cọc khoan nhồi ven bờ + 101 đế đáy hồ (37 đế dùng chung hai bè).
- Gió tính toán V = 20 m/s là cấp gió vận hành, THẤP HƠN gió tiêu chuẩn TCVN 2737:2023 vùng II-B (MỐC TẠM lấy theo Huổi Vanh — vùng gió của Hồ Bản Mòng chưa tra cứu) (V ≈ 29,7 m/s, q0 = 0,54 kN/m²): áp lực gió chỉ bằng 45% mức tiêu chuẩn. Cáp, cọc và đế neo định cỡ ở cấp gió này CHƯA được kiểm tra với bão thiết kế; nhập V = 30 m/s ở Tab 2 để kiểm tra.
- Vận hành dây: BÙ LIÊN TỤC — mỗi dây luôn vừa căng ở mọi mực nước nhờ thiết bị tự căng (đối trọng / tời), có bộ KHÓA chống bão bắt buộc; thiết bị CHƯA chọn loại.
- Kết quả: 8/8 bè đạt; 133/133 cọc bờ đạt; 101/101 đế đạt.

## 2. Số liệu đầu vào và giả định

- Mực nước hồ: MNC 649,50 m; MNDB 662,76 m; MNLKT 669,05 m.
- Tấm pin: 3,106 m²/tấm, nghiêng 12°, hệ số cản 1,15, hệ số che chắn giữa các hàng 0,55; sóng và dòng chảy gộp bằng hệ số 1,05.
- Đất bờ (GIẢ ĐỊNH, chưa khảo sát): sét, c_u = 40 kPa. Bùn đáy hồ (GIẢ ĐỊNH): c_u = 20 kPa, γ' = 6 kN/m³.
- Hệ số an toàn: cáp ≥ 3,0; cọc bờ chịu ngang 2,5; hệ số tải uốn cọc 1,2; đế: trượt 1,5, lật 1,5, nhổ vít 2,0, nền 2,5; trọng lượng đế nhân 0,9 khi chống nhổ.

## 3. Lực gió lên bè (ví dụ BÈ 7, bè có lực dây lớn nhất)

- Áp lực gió: q = 0,5 × ρ × V² = 0,5 × 1,25 × 20² = 250 N/m².
- Diện tích đón gió của pin: A = số tấm × diện tích tấm × sin(nghiêng) = 2.884 × 3,106 × sin 12° = 1.862 m².
- Lực gió lên pin: F_pin = q × C_d × A × hệ số che chắn = 250 × 1,15 × 1.862 × 0,55 = 294,5 kN.
- Lực gió lên phao (mạn khô 0,35 m): F_phao = 14,1 kN. Tổng gió: 308,6 kN.
- Tổng lực môi trường: F = 308,6 × 1,05 = 324,0 kN.

## 4. Lực căng dây — phân tích cân bằng tĩnh theo mực nước

- Hồ sâu, mực nước dao động 19,55 m: góc dốc thật của dây thay đổi theo mực nước (dây đáy dốc tới 70°), nên KHÔNG dùng góc dây cố định 30° và hệ số tập trung.
- Mỗi bè: tải môi trường F đặt lần lượt theo 24 hướng (15°/hướng), ở mọi mực nước từ mức bè còn nổi tới MNLKT (bước 1 m, thêm MNDB và MNLKT). Bè tịnh tiến tới khi tổng lực các dây đang căng cân bằng F. Dây thẳng, đàn hồi EA = 15 × lực đứt (GIẢ ĐỊNH cho polyester), dây chùng không chịu lực; không xét xoay bè và tải động.
- Lực một dây: T = (EA / L_0) × (d − L_0) khi d > L_0, T = 0 khi d ≤ L_0 (dây chùng). d là khoảng cách thẳng bích bè – chốt neo khi bè đã dịch đi, L_0 là chiều dài dây lúc vừa căng. Cáp PES-36: EA = 15 × 385 = 5.775 kN. Dây càng ngắn (L_0 nhỏ) càng cứng nên nhận càng nhiều lực.
- Vị trí cân bằng: độ dịch u của bè sao cho tổng thành phần ngang của lực các dây đang căng bằng F theo hướng tải; T thiết kế = T lớn nhất trên mọi hướng, mọi mực nước + lực căng trước T_0 = 5 kN.
- BÈ 7 (bè có lực dây lớn nhất): F = 324,0 kN; chi phối ở mực nước 654,00 m, tải đẩy về hướng 135°, dây B7-D06 chịu 102,0 kN, 22 dây cùng căng; bè trôi 0,27 m. Mất dây B7-D06: dây lớn nhất còn lại 118,3 kN.
- Lực dây thiết kế của BÈ 7: T = 107,0 kN (đã cộng lực căng trước 5 kN; không nhỏ hơn F / (n × cos α) = 67,4 kN); khi đứt một dây: 123,3 kN. Cáp và cọc bờ của bè kiểm tra với lực này; mỗi đế vít xoắn kiểm tra với lực lớn nhất của chính (các) dây nối vào nó (bao mọi hướng, mọi mực nước).
- Cáp PES-36, lực đứt 385 kN: hệ số an toàn MBL / T = 385 / 107,0 = 3,60 (yêu cầu ≥ 3,0); khi đứt một dây 385 / 123,3 = 3,12 (yêu cầu ≥ 2,0).
- C9, khoảng cách trung bình giữa các dây: chu vi / số dây = 583,9 / 40 = 14,6 m ≤ 15 m (bắt buộc; các bè: 13,5–15,0 m).
- C8, khoảng hở đáy bè – đáy hồ = chiều sâu nước − mớn nước bè = 13,40 m ở MNDB ≥ 1,5 m; ở MNC còn 13,40 − (662,76 − 649,50) = 0,14 m — DƯỚI mức 1,5 m.
- Độ trôi bè lớn nhất (mọi hướng, mọi mực nước): 0,5 – 0,9 m tùy bè (kiểm tra C12: ≤ nửa khoảng hở nhỏ nhất tới bè bên cạnh).

## 5. Cọc khoan nhồi ven bờ (ví dụ BÈ 7)

- Cọc tròn D350 đổ tại chỗ, ngàm L_tk = 6,5 m, dài cả cọc 6,6 m; thép chủ 6Φ25 CB400-V, Đai xoắn Φ8 a150. Cáp móc cách mặt đất 0,1 m.
- Điểm neo CỌC ĐÔI: 2 cọc cạnh nhau, vuông góc phương cáp, cách nhau ≥ 3D; mỗi cọc chịu P = T / (2 × 0,9) = 59,4 kN (hệ số nhóm là GIẢ ĐỊNH); đài BTCT nối hai đầu cọc: thiết kế sơ bộ ở bảng thống kê vật tư neo (twinPileCap.ts).
- BP-1, sức chịu ngang theo Broms (cọc ngắn trong đất sét). Sức kháng của đất trên 1 m cọc: p = 9 × c_u × D = 9 × 40 × 0,35 = 126,0 kN/m; đoạn 1,5D = 0,525 m dưới mặt đất không tính, phần ngàm làm việc g = L_tk − 1,5D = 6,5 − 0,525 = 5,975 m; tim chốt cáp cao e = 0,10 m trên mặt đất.
- H_u là nghiệm dương của (0,5 / p) × H_u² + (e + 1,5D + g) × H_u − 0,5 × p × g² = 0, tức (0,5 / 126,0) × H_u² + 6,600 × H_u − 2.249,1 = 0 → H_u = 290,2 kN. Cho phép H_u / 2,5 = 116,1 kN ≥ P = 59,4 kN; mức sử dụng = 59,4 / 116,1 = 0,51.
- BP-2, uốn thân cọc (TCVN 5574:2018). Mô-men lớn nhất trong cọc: M_max = P × (e + 1,5D + 0,5 × P / p) = 59,4 × (0,10 + 0,525 + 0,5 × 59,4 / 126,0) = 51,2 kNm.
- Khả năng chịu uốn của lồng 6 thanh Φ25 đặt trên vòng tròn: M_rd = A_1 thanh × R_s × r × k(n) = 490,9 mm² × 350 MPa × 0,125 m × 3,46 = 74,4 kNm (r = D/2 − 50 mm tới tim thép; k(n) = 2 / tan(π/n) là cánh tay đòn của n thanh ở hướng BẤT LỢI nhất, vì lồng thả vào lỗ khoan không định hướng được; bỏ qua bê tông chịu kéo).
- Kiểm tra: 1,2 × M_max = 1,2 × 51,2 = 61,4 kNm ≤ M_rd = 74,4 kNm; mức sử dụng 0,83 (1,2 là hệ số tải trọng khi kiểm tra uốn).
- Cả hệ: 220 cọc, tổng dài 1.452,0 m, 139,7 m³ bê tông, 38,8 tấn thép. Lực kiểm tra cọc là toàn bộ lực dây (không giảm theo góc xiên), thiên về an toàn.

## 6. Đế BTCT + vít xoắn (ví dụ BM-DV074, đế làm việc nặng nhất)

- Một vít: ống Ø89×5, ren Ø105, ngàm 3,0 m. Sức chịu nhổ cực hạn Q_u = α × c_u × π × D_ren × L = 0,8 × 20 × π × 0,105 × 3,0 = 15,8 kN; cho phép Q_a = Q_u / 2 = 7,9 kN. Sức chịu ngang cực hạn H_u = 15,0 kN.
- Đế BM-DV074 giữ hai dây B7-D06 (BÈ 7, T = 107,0 kN, dài 14,01 m) và B8-D19 (BÈ 8, T = 61,0 kN, dài 14,01 m). Bích bè cao hơn mặt nước 0,35 m.
- Mỗi dây tách thành lực ngang T_h = T × cos θ và lực nhổ T_v = T × sin θ, θ là góc dốc của dây (tan θ = chênh cao bích bè – chốt đế / khoảng cách ngang): dây thoải khi nước thấp (trượt chi phối), dốc khi nước cao (nhổ, lật chi phối).
- Tổ hợp chi phối: cả hai dây căng (MN cao). Lực nhổ T_v = 136,1 kN (hai dây cộng lại), lực ngang T_h = 26,9 kN (cộng véc-tơ).
- Đế 5,00 × 5,00 × 0,4 m: thể tích 10,00 m³, nặng 250,0 kN trên cạn, W' = 10,00 × (25 − 10) = 150,0 kN trong nước (đã trừ lực đẩy nổi).
- SV-1 nhổ: T_v ≤ 0,9 × W' + 4 × Q_a = 166,7 kN; mức sử dụng 0,82.
- SV-2 trượt: 1,5 × T_h ≤ bám dính đáy + gờ + 4 × H_u. Bám dính đáy = 0,5 × c_u × B² = 250,0 kN (lấy bằng 0 khi T_v > W': đế bị nhấc khỏi bùn); gờ sâu z = 0,15 m: B × (0,5 × γ' × z² + 2 × c_u × z) = 30,3 kN; H_u một vít = 15,0 kN (Broms, đầu tự do ở mặt bùn). 1,5 × 26,9 = 40,4 ≤ 340,3 kN; mức sử dụng 0,45.
- SV-3 lật quanh mép đáy phía xa dây: M_lật = T_h × (t + h_tai) + T_v × B / 2 = 26,9 × (0,4 + 0,15) + 136,1 × 5,00 / 2 = 355,0 kNm; M_giữ = W' × B / 2 + (n/2) × Q_u × (B − c) + (n/2) × Q_u × c = 533,3 kNm (c = 0,15 m từ mép đế tới tim lỗ vít). 1,5 × 355,0 = 532,5 ≤ 533,3 kNm; mức sử dụng 1,00.
- SV-4 một vít: lực nhổ lên vít chịu nặng nhất N_1 = max[(T_v − 0,9 × W') / n ; (M_lật − 0,9 × W' × B / 2) / (B − c) / (n/2)] = 1,8 kN ≤ Q_a = 7,9 kN; mức sử dụng 0,23.
- SV-5 áp lực lên nền bùn: W' / B² = 6,0 kPa ≤ 5,14 × c_u / 2,5 = 41,1 kPa (sức chịu tải giới hạn của nền sét mềm); mức sử dụng 0,15.
- SV-6 thép bản đế: tai neo kéo lên ở giữa, 4 vít giữ ở các góc; mô-men trên 1 m bản M = (n/2) × Q_u × (s/2) / B = 14,88 kNm/m (s = B − 2c); thép cần A_s = M / (0,9 × h_0 × R_s) = 182 mm²/m, tối thiểu 0,1% = 350 mm²/m; bố trí lưới Ø12 a200 hai lớp = 565 mm²/m; mức sử dụng 0,62.
- Cả hệ: 101 đế (54 đế 2,50 m, 8 đế 2,75 m, 1 đế 3,00 m, 9 đế 3,25 m, 12 đế 3,50 m, 7 đế 3,75 m, 3 đế 4,00 m, 2 đế 4,25 m, 1 đế 4,50 m, 3 đế 4,75 m, 1 đế 5,00 m), 405,0 m³ bê tông, 17,9 tấn thép bản, 404 vít (1.506 m), đế nặng nhất khi cẩu 28,7 tấn.
- Tổng lực nhổ lên 101 đế 5.894 kN, tổng sức chống nhổ 8.693 kN. Mức sử dụng lớn nhất: nhổ 0,93, trượt 0,99, lật 1,00, một vít 0,95.

## 7. Chiều dài cắt cáp và điều chỉnh dây

- Mỗi dây cắt đủ dài cho mực nước làm khoảng cách bích – chốt dài nhất (138 dây đáy ở MNLKT, 133 dây bờ ở MNC). Tổng chiều dài cắt: dây bờ 5.715 m, dây đáy 3.661 m, chưa gồm đoạn bện đầu và phụ kiện.
- Thiết bị bù / điều chỉnh ở đầu bè phải thu – xả được: dây đáy tới 15,9 m, dây bờ tới 4,6 m (độ chùng lớn nhất của dây cắt cố định), và giữ được lực dây thiết kế. Thiết bị này CHƯA thiết kế.

## 8. Giả định và vấn đề còn mở

- Mực nước hồ dao động 19,55 m (MNC 649,50 → MNDB 662,76 → MNLKT 669,05 m), gấp hơn 3 lần Huổi Vanh. Cáp cắt cố định không dùng được (lực dây và độ trôi quá lớn — xem bảng so sánh cách bù ở Mục 4). Lực dây tính bằng cân bằng tĩnh từng dây theo mực nước, với giả định dây được BÙ dao động mực nước (mặc định: bù liên tục bằng bộ tự căng có khóa chống bão — CHƯA chọn loại; so sánh cách bù ở Mục 4). Mô hình lấy độ cứng của chính sợi cáp, nên thiết bị bù phải KHÓA được khi có gió bão (khóa an toàn khi mất điện / mất tín hiệu).
- Nếu khóa của thiết bị bù KHÔNG khóa kịp, đối trọng chỉ giữ lực căng 5 kN và hành trình dư 3 m mỗi chiều: bè trôi 5,1–6,3 m (tới hết hành trình rồi dây mới căng) và lực dây vọt tới 108–296 kN (hệ số an toàn cáp chỉ 1,3–2,8; đế và cọc không được tính cho lực này). Đối trọng treo tự do KHÔNG đủ giữ bè: cần bộ khóa / phanh chủ động, dự phòng, kiểm tra định kỳ.
- Theo địa hình IFC, 7/8 bè chạm đáy khi nước xuống MNC 649,50 m: BÈ 1 (đáy cao nhất 652,50, trung vị 647,33 m); BÈ 2 (đáy cao nhất 653,28, trung vị 647,00 m); BÈ 4 (đáy cao nhất 652,12, trung vị 647,00 m); BÈ 5 (đáy cao nhất 651,37, trung vị 649,00 m); BÈ 6 (đáy cao nhất 650,47, trung vị 647,27 m); BÈ 7 (đáy cao nhất 653,19, trung vị 649,11 m); BÈ 8 (đáy cao nhất 651,24, trung vị 649,16 m). Đáy thiết kế từng bè là trung vị địa hình IFC dưới bè, chưa phải khảo sát.
- Đế vít xoắn đặt trên mặt đất IFC tại chỗ (không phải đáy thiết kế chung như Huổi Vanh): 52/101 đế có nền cao hơn MNC (tới 658,11 m) nên lộ khô khi hồ xuống mực nước chết.
- Theo địa hình IFC (lưới ~10 m), 7/271 dây tì lên sườn dốc giữa bè và neo khi nước ở 650–653 m (B1-D01, B2-D08, B3-D13, B3-D38, B6-D17, B8-D06, B8-D18; sâu nhất 1,6 m dưới mặt đất): mô hình coi dây thẳng — cần ống / con lăn chống mài mòn ở đoạn tì, hoặc dời cọc theo khảo sát địa hình.
- 64/101 đế vít xoắn là đế ĐƠN ở vùng nước trống (không đối diện bè nào và cách bờ quá 60 m): quy tắc của Huổi Vanh "đế chỉ đặt giữa hai bè" không áp dụng được cho mặt bằng này — cần Chủ đầu tư xác nhận.
- Vùng gió TCVN 2737:2023 của Sơn La CHƯA tra cứu: mốc so sánh 29,7 m/s (vùng II-B của Huổi Vanh) chỉ là tạm. Độ cứng dây EA = 15 × lực đứt là giả định; mô hình cân bằng không xét xoay bè và tải động.
- Mô hình cân bằng không xét phân bố tải không đều trên bè lớn và tải động khi dây đang chùng bị giật căng.
- Chưa có khảo sát địa chất: c_u đất bờ và bùn đáy là giả định (lấy như Huổi Vanh).
- Đế đặt trên địa hình IFC tại chỗ, chưa phải khảo sát. 126/133 cọc bờ đứng ở chỗ mặt đất thấp hơn MNDB.
