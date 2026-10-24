# Thuyết minh tính toán hệ neo: cọc khoan nhồi ven bờ + đế BTCT vít xoắn

## 1. Phương án neo

- Áp dụng phương án Chủ đầu tư đã chốt cho Huổi Vanh ngày 12/10/2026 (Cọc khoan nhồi D350 ven bờ + đế BTCT giữ bằng vít xoắn dưới đáy hồ); CHƯA chốt riêng cho hồ này.
- Hệ neo: 271 tuyến cáp tại 235 điểm neo = 172 cọc khoan nhồi ven bờ + 63 đế đáy hồ (36 đế dùng chung hai bè).
- Gió tính toán V = 20 m/s là cấp gió vận hành, THẤP HƠN gió tiêu chuẩn TCVN 2737:2023 vùng II-B (MỐC TẠM lấy theo Huổi Vanh — vùng gió của Hồ Bản Mòng chưa tra cứu) (V ≈ 29,7 m/s, q0 = 0,54 kN/m²): áp lực gió chỉ bằng 45% mức tiêu chuẩn. Cáp, cọc và đế neo định cỡ ở cấp gió này CHƯA được kiểm tra với bão thiết kế; nhập V = 30 m/s ở Tab 2 để kiểm tra.
- Vận hành dây: BÙ LIÊN TỤC — mỗi dây luôn vừa căng ở mọi mực nước nhờ thiết bị tự căng (đối trọng / tời), có bộ KHÓA chống bão bắt buộc; thiết bị CHƯA chọn loại.
- Kết quả: 8/8 bè đạt; 172/172 cọc bờ đạt; 63/63 đế đạt.

## 2. Số liệu đầu vào và giả định

- Mực nước hồ: MNC 649,50 m; MNDB 662,76 m; MNLKT 669,05 m.
- Tấm pin: 3,106 m²/tấm, nghiêng 12°, hệ số cản 1,15, hệ số che chắn giữa các hàng 0,55; sóng và dòng chảy gộp bằng hệ số 1,05.
- Đất bờ (GIẢ ĐỊNH, chưa khảo sát): sét, c_u = 40 kPa. Bùn đáy hồ (GIẢ ĐỊNH): c_u = 20 kPa, γ' = 6 kN/m³.
- Hệ số an toàn: cáp ≥ 3,0; cọc bờ chịu ngang 2,5; hệ số tải uốn cọc 1,2; đế: trượt 1,5, lật 1,5, nhổ vít 2,0, nền 2,5; trọng lượng đế nhân 0,9 khi chống nhổ.

## 3. Lực gió lên bè (ví dụ BÈ 8, bè có lực dây lớn nhất)

- Áp lực gió: q = 0,5 × ρ × V² = 0,5 × 1,25 × 20² = 250 N/m².
- Diện tích đón gió của pin: A = số tấm × diện tích tấm × sin(nghiêng) = 2.884 × 3,106 × sin 12° = 1.862 m².
- Lực gió lên pin: F_pin = q × C_d × A × hệ số che chắn = 250 × 1,15 × 1.862 × 0,55 = 294,5 kN.
- Lực gió lên phao (mạn khô 0,35 m): F_phao = 11,8 kN. Tổng gió: 306,3 kN.
- Tổng lực môi trường: F = 306,3 × 1,05 = 321,6 kN.

## 4. Lực căng dây — phân tích cân bằng tĩnh theo mực nước

- Hồ sâu, mực nước dao động 19,55 m: góc dốc thật của dây thay đổi theo mực nước (dây đáy dốc tới 70°), nên KHÔNG dùng góc dây cố định 30° và hệ số tập trung.
- Mỗi bè: tải môi trường F đặt lần lượt theo 24 hướng (15°/hướng), ở mọi mực nước từ mức bè còn nổi tới MNLKT (bước 1 m, thêm MNDB và MNLKT). Bè tịnh tiến tới khi tổng lực các dây đang căng cân bằng F. Dây thẳng, đàn hồi EA = 15 × lực đứt (GIẢ ĐỊNH cho polyester), dây chùng không chịu lực; không xét xoay bè và tải động.
- Lực một dây: T = (EA / L_0) × (d − L_0) khi d > L_0, T = 0 khi d ≤ L_0 (dây chùng). d là khoảng cách thẳng bích bè – chốt neo khi bè đã dịch đi, L_0 là chiều dài dây lúc vừa căng. Cáp PES-36: EA = 15 × 385 = 5.775 kN. Dây càng ngắn (L_0 nhỏ) càng cứng nên nhận càng nhiều lực.
- Vị trí cân bằng: độ dịch u của bè sao cho tổng thành phần ngang của lực các dây đang căng bằng F theo hướng tải; T thiết kế = T lớn nhất trên mọi hướng, mọi mực nước + lực căng trước T_0 = 5 kN.
- BÈ 8 (bè có lực dây lớn nhất): F = 321,6 kN; chi phối ở mực nước 669,05 m, tải đẩy về hướng 75°, dây B8-D20 chịu 112,4 kN, 12 dây cùng căng; bè trôi 0,75 m. Mất dây B8-D20: dây lớn nhất còn lại 144,8 kN.
- Lực dây thiết kế của BÈ 8: T = 117,4 kN (đã cộng lực căng trước 5 kN; không nhỏ hơn F / (n × cos α) = 66,9 kN); khi đứt một dây: 149,8 kN. Cáp và cọc bờ của bè kiểm tra với lực này; mỗi đế vít xoắn kiểm tra với lực lớn nhất của chính (các) dây nối vào nó (bao mọi hướng, mọi mực nước).
- Cáp PES-36, lực đứt 385 kN: hệ số an toàn MBL / T = 385 / 117,4 = 3,28 (yêu cầu ≥ 3,0); khi đứt một dây 385 / 149,8 = 2,57 (yêu cầu ≥ 2,0).
- C9, khoảng cách trung bình giữa các dây: chu vi / số dây = 490,0 / 33 = 14,8 m ≤ 15 m (bắt buộc; các bè: 13,5–15,0 m).
- C8, khoảng hở đáy bè – đáy hồ = chiều sâu nước − mớn nước bè = 13,40 m ở MNDB ≥ 1,5 m; ở MNC còn 13,40 − (662,76 − 649,50) = 0,14 m — DƯỚI mức 1,5 m.
- Độ trôi bè lớn nhất (mọi hướng, mọi mực nước): 0,6 – 0,9 m tùy bè (kiểm tra C12: ≤ nửa khoảng hở nhỏ nhất tới bè bên cạnh).

## 5. Cọc khoan nhồi ven bờ (ví dụ BÈ 8)

- Cọc tròn D350 đổ tại chỗ, ngàm L_tk = 6,5 m, dài cả cọc 6,6 m; thép chủ 6Φ25 CB400-V, Đai xoắn Φ8 a150. Cáp móc cách mặt đất 0,1 m.
- Điểm neo CỌC ĐÔI: 2 cọc cạnh nhau, vuông góc phương cáp, cách nhau ≥ 3D; mỗi cọc chịu P = T / (2 × 0,9) = 65,2 kN (hệ số nhóm là GIẢ ĐỊNH); đài BTCT nối hai đầu cọc: thiết kế sơ bộ ở bảng thống kê vật tư neo (twinPileCap.ts).
- BP-1, sức chịu ngang theo Broms (cọc ngắn trong đất sét). Sức kháng của đất trên 1 m cọc: p = 9 × c_u × D = 9 × 40 × 0,35 = 126,0 kN/m; đoạn 1,5D = 0,525 m dưới mặt đất không tính, phần ngàm làm việc g = L_tk − 1,5D = 6,5 − 0,525 = 5,975 m; tim chốt cáp cao e = 0,10 m trên mặt đất.
- H_u là nghiệm dương của (0,5 / p) × H_u² + (e + 1,5D + g) × H_u − 0,5 × p × g² = 0, tức (0,5 / 126,0) × H_u² + 6,600 × H_u − 2.249,1 = 0 → H_u = 290,2 kN. Cho phép H_u / 2,5 = 116,1 kN ≥ P = 65,2 kN; mức sử dụng = 65,2 / 116,1 = 0,56.
- BP-2, uốn thân cọc (TCVN 5574:2018). Mô-men lớn nhất trong cọc: M_max = P × (e + 1,5D + 0,5 × P / p) = 65,2 × (0,10 + 0,525 + 0,5 × 65,2 / 126,0) = 57,6 kNm.
- Khả năng chịu uốn của lồng 6 thanh Φ25 đặt trên vòng tròn: M_rd = A_1 thanh × R_s × r × k(n) = 490,9 mm² × 350 MPa × 0,125 m × 3,46 = 74,4 kNm (r = D/2 − 50 mm tới tim thép; k(n) = 2 / tan(π/n) là cánh tay đòn của n thanh ở hướng BẤT LỢI nhất, vì lồng thả vào lỗ khoan không định hướng được; bỏ qua bê tông chịu kéo).
- Kiểm tra: 1,2 × M_max = 1,2 × 57,6 = 69,2 kNm ≤ M_rd = 74,4 kNm; mức sử dụng 0,93 (1,2 là hệ số tải trọng khi kiểm tra uốn).
- Cả hệ: 290 cọc, tổng dài 1.914,0 m, 184,1 m³ bê tông, 49,6 tấn thép. Lực kiểm tra cọc là toàn bộ lực dây (không giảm theo góc xiên), thiên về an toàn.

## 6. Đế BTCT + vít xoắn (ví dụ BM-DV057, đế làm việc nặng nhất)

- Một vít: ống Ø89×5, ren Ø105, ngàm 3,0 m. Sức chịu nhổ cực hạn Q_u = α × c_u × π × D_ren × L = 0,8 × 20 × π × 0,105 × 3,0 = 15,8 kN; cho phép Q_a = Q_u / 2 = 7,9 kN. Sức chịu ngang cực hạn H_u = 15,0 kN.
- Đế BM-DV057 giữ hai dây B7-D28 (BÈ 7, T = 76,0 kN, dài 25,52 m) và B8-D26 (BÈ 8, T = 67,2 kN, dài 25,52 m). Bích bè cao hơn mặt nước 0,35 m.
- Mỗi dây tách thành lực ngang T_h = T × cos θ và lực nhổ T_v = T × sin θ, θ là góc dốc của dây (tan θ = chênh cao bích bè – chốt đế / khoảng cách ngang): dây thoải khi nước thấp (trượt chi phối), dốc khi nước cao (nhổ, lật chi phối).
- Tổ hợp chi phối: cả hai dây căng (MN cao). Lực nhổ T_v = 89,0 kN (hai dây cộng lại), lực ngang T_h = 6,9 kN (cộng véc-tơ).
- Đế 3,50 × 3,50 × 0,4 m: thể tích 4,90 m³, nặng 122,5 kN trên cạn, W' = 4,90 × (25 − 10) = 73,5 kN trong nước (đã trừ lực đẩy nổi).
- SV-1 nhổ: T_v ≤ 0,9 × W' + 4 × Q_a = 97,8 kN; mức sử dụng 0,91.
- SV-2 trượt: 1,5 × T_h ≤ bám dính đáy + gờ + 4 × H_u. Bám dính đáy = 0,5 × c_u × B² = 0,0 kN (lấy bằng 0 khi T_v > W': đế bị nhấc khỏi bùn); gờ sâu z = 0,15 m: B × (0,5 × γ' × z² + 2 × c_u × z) = 21,2 kN; H_u một vít = 15,0 kN (Broms, đầu tự do ở mặt bùn). 1,5 × 6,9 = 10,4 ≤ 81,2 kN; mức sử dụng 0,52.
- SV-3 lật quanh mép đáy phía xa dây: M_lật = T_h × (t + h_tai) + T_v × B / 2 = 6,9 × (0,4 + 0,15) + 89,0 × 3,50 / 2 = 159,6 kNm; M_giữ = W' × B / 2 + (n/2) × Q_u × (B − c) + (n/2) × Q_u × c = 239,5 kNm (c = 0,15 m từ mép đế tới tim lỗ vít). 1,5 × 159,6 = 239,3 ≤ 239,5 kNm; mức sử dụng 1,00.
- SV-4 một vít: lực nhổ lên vít chịu nặng nhất N_1 = max[(T_v − 0,9 × W') / n ; (M_lật − 0,9 × W' × B / 2) / (B − c) / (n/2)] = 6,5 kN ≤ Q_a = 7,9 kN; mức sử dụng 0,83.
- SV-5 áp lực lên nền bùn: W' / B² = 6,0 kPa ≤ 5,14 × c_u / 2,5 = 41,1 kPa (sức chịu tải giới hạn của nền sét mềm); mức sử dụng 0,15.
- SV-6 thép bản đế: tai neo kéo lên ở giữa, 4 vít giữ ở các góc; mô-men trên 1 m bản M = (n/2) × Q_u × (s/2) / B = 14,48 kNm/m (s = B − 2c); thép cần A_s = M / (0,9 × h_0 × R_s) = 177 mm²/m, tối thiểu 0,1% = 350 mm²/m; bố trí lưới Ø12 a200 hai lớp = 565 mm²/m; mức sử dụng 0,62.
- Cả hệ: 63 đế (19 đế 2,50 m, 4 đế 2,75 m, 5 đế 3,00 m, 4 đế 3,25 m, 5 đế 3,50 m, 8 đế 3,75 m, 11 đế 4,00 m, 3 đế 4,25 m, 2 đế 4,75 m, 1 đế 5,25 m, 1 đế 5,50 m), 313,5 m³ bê tông, 13,8 tấn thép bản, 252 vít (937 m), đế nặng nhất khi cẩu 30,8 tấn.
- Tổng lực nhổ lên 63 đế 4.671 kN, tổng sức chống nhổ 6.244 kN. Mức sử dụng lớn nhất: nhổ 0,92, trượt 0,99, lật 1,00, một vít 1,00.

## 7. Chiều dài cắt cáp và điều chỉnh dây

- Mỗi dây cắt đủ dài cho mực nước làm khoảng cách bích – chốt dài nhất (99 dây đáy ở MNLKT, 172 dây bờ ở MNC). Tổng chiều dài cắt: dây bờ 8.492 m, dây đáy 2.663 m, chưa gồm đoạn bện đầu và phụ kiện.
- Thiết bị bù / điều chỉnh ở đầu bè phải thu – xả được: dây đáy tới 15,9 m, dây bờ tới 4,6 m (độ chùng lớn nhất của dây cắt cố định), và giữ được lực dây thiết kế. Thiết bị này CHƯA thiết kế.

## 8. Giả định và vấn đề còn mở

- Mực nước hồ dao động 19,55 m (MNC 649,50 → MNDB 662,76 → MNLKT 669,05 m), gấp hơn 3 lần Huổi Vanh. Cáp cắt cố định không dùng được (lực dây và độ trôi quá lớn — xem bảng so sánh cách bù ở Mục 4). Lực dây tính bằng cân bằng tĩnh từng dây theo mực nước, với giả định dây được BÙ dao động mực nước (mặc định: bù liên tục bằng bộ tự căng có khóa chống bão — CHƯA chọn loại; so sánh cách bù ở Mục 4). Mô hình lấy độ cứng của chính sợi cáp, nên thiết bị bù phải KHÓA được khi có gió bão (khóa an toàn khi mất điện / mất tín hiệu).
- Nếu khóa của thiết bị bù KHÔNG khóa kịp, đối trọng chỉ giữ lực căng 5 kN và hành trình dư 3 m mỗi chiều: bè trôi 5,1–6,3 m (tới hết hành trình rồi dây mới căng) và lực dây vọt tới 92–264 kN (hệ số an toàn cáp chỉ 1,5–2,6; đế và cọc không được tính cho lực này). Đối trọng treo tự do KHÔNG đủ giữ bè: cần bộ khóa / phanh chủ động, dự phòng, kiểm tra định kỳ.
- Theo địa hình IFC, 7/8 bè chạm đáy khi nước xuống MNC 649,50 m: BÈ 1 (đáy cao nhất 652,50, trung vị 647,33 m); BÈ 2 (đáy cao nhất 653,28, trung vị 647,00 m); BÈ 4 (đáy cao nhất 652,12, trung vị 647,00 m); BÈ 5 (đáy cao nhất 651,37, trung vị 649,00 m); BÈ 6 (đáy cao nhất 650,47, trung vị 647,27 m); BÈ 7 (đáy cao nhất 653,19, trung vị 649,11 m); BÈ 8 (đáy cao nhất 651,24, trung vị 649,16 m). Đáy thiết kế từng bè là trung vị địa hình IFC dưới bè, chưa phải khảo sát.
- Đế vít xoắn đặt trên mặt đất IFC tại chỗ (không phải đáy thiết kế chung như Huổi Vanh): 22/63 đế có nền cao hơn MNC (tới 658,11 m) nên lộ khô khi hồ xuống mực nước chết.
- Theo địa hình IFC (lưới ~10 m), 9/271 dây tì lên sườn dốc giữa bè và neo khi nước ở 650–653 m (B1-D01, B2-D08, B3-D13, B3-D38, B6-D09, B6-D17, B8-D06, B8-D12, B8-D18; sâu nhất 1,6 m dưới mặt đất): mô hình coi dây thẳng — cần ống / con lăn chống mài mòn ở đoạn tì, hoặc dời cọc theo khảo sát địa hình.
- 27/63 đế vít xoắn là đế ĐƠN ở vùng nước trống (không đối diện bè nào và xa bờ hơn tầm dây bờ cho phép 80 m): quy tắc của Huổi Vanh "đế chỉ đặt giữa hai bè" không áp dụng được cho mặt bằng này — cần Chủ đầu tư xác nhận.
- Vùng gió TCVN 2737:2023 của Sơn La CHƯA tra cứu: mốc so sánh 29,7 m/s (vùng II-B của Huổi Vanh) chỉ là tạm. Độ cứng dây EA = 15 × lực đứt là giả định; mô hình cân bằng không xét xoay bè và tải động.
- Mô hình cân bằng không xét phân bố tải không đều trên bè lớn và tải động khi dây đang chùng bị giật căng.
- Chưa có khảo sát địa chất: c_u đất bờ và bùn đáy là giả định (lấy như Huổi Vanh).
- Đế đặt trên địa hình IFC tại chỗ, chưa phải khảo sát. 160/172 cọc bờ đứng ở chỗ mặt đất thấp hơn MNDB.

## 9. Giải thích bảng hạng mục kiểm tra (ví dụ BÈ 8)

- Mỗi dòng của bảng kiểm tra trên web: công thức, ý nghĩa các ký hiệu và kết quả của bè ví dụ. Mức sử dụng = tải trọng phải chịu / khả năng chịu (đã chia hệ số an toàn): ≤ 1,00 là đạt. Dòng "KHÔNG ÁP DỤNG" là phép kiểm của loại neo khác, không dùng cho phương án cọc khoan nhồi + đế vít xoắn.
- C1 — Sức giữ neo (nguyên vẹn): SF = R_total / H_line ≥ [SF]. R_total là tổng sức giữ của các neo, H_line là lực ngang trong dây; [SF] là hệ số an toàn yêu cầu. Dùng cho neo thả kéo lê trên đáy (neo cày, khối thả). Kết quả BÈ 8: KHÔNG ÁP DỤNG — hệ này không dùng neo thả: sức giữ là của cọc bờ (BP-1, BP-2) và đế vít xoắn (SV-1…SV-6).
- C2 — Bền dây/xích neo (nguyên vẹn): SF = MBL / T_max ≥ [SF]. MBL là lực kéo đứt nhỏ nhất của cáp (nhà sản xuất công bố), T_max là lực lớn nhất một dây phải chịu (mô hình cân bằng, đã cộng lực căng trước); [SF] = 3 khi đủ dây. Kết quả BÈ 8: ĐẠT: giá trị 3,28, yêu cầu 3, mức sử dụng 0,91.
- C3 — Không nhổ neo (chiều dài dây nằm đáy): L_ground ≥ L_ground,min. L_ground là chiều dài xích / cáp nằm trên đáy trước neo, L_ground,min là chiều dài tối thiểu để neo kéo lê không bị nhấc lên. Dùng cho neo thả. Kết quả BÈ 8: KHÔNG ÁP DỤNG — cọc và đế chịu được lực nhổ (kiểm ở SV-1, SV-4), không cần đoạn dây nằm trên đáy.
- C4 — Tỷ lệ chiều dài dây / chiều sâu nước (Scope ratio): L_total / d ≥ [scope]. L_total là chiều dài dây, d là chiều sâu nước; tỷ lệ [scope] (thường ≥ 5) bảo đảm dây xích đủ thoải cho neo thả. Kết quả BÈ 8: KHÔNG ÁP DỤNG — dây căng thẳng tới cọc / đế, chiều dài dây do mặt bằng quyết định.
- C5 — Sức giữ neo (khi đứt 1 dây): SF = R_total / H_line,dam ≥ [SF]. Như C1 nhưng với lực ngang H_line,dam khi đứt một dây. Kết quả BÈ 8: KHÔNG ÁP DỤNG — hệ này không dùng neo thả: sức giữ là của cọc bờ (BP-1, BP-2) và đế vít xoắn (SV-1…SV-6).
- C6 — Bền dây/xích neo (khi đứt 1 dây): SF = MBL / T_max,dam ≥ [SF]. Như C2 nhưng T_max,dam là lực lớn nhất trong các dây còn lại khi dây chịu lực lớn nhất bị đứt (tính lại ở mọi mực nước); [SF] = 2. Kết quả BÈ 8: ĐẠT: giá trị 2,57, yêu cầu 2, mức sử dụng 0,78.
- C7 — Độ thiếu chiều dài dây neo: X_deficit ≤ [maxOffset]. X_deficit là phần dây còn thiếu so với chiều dài cần của dây xích chùng (đường dây xích) ở độ trôi cho phép [maxOffset]. Kết quả BÈ 8: KHÔNG ÁP DỤNG — không có đoạn dây xích dự trữ; cáp cắt theo bảng chiều dài cắt cáp (mục 7).
- C8 — Khoảng hở an toàn đáy bè – đáy hồ: Clearance = h_nước − mớn nước bè ≥ [min]. h_nước là chiều sâu nước dưới bè ở độ sâu thiết kế, mớn nước là phần bè chìm dưới nước; [min] là khoảng hở tối thiểu để đáy bè không chạm đáy hồ. Kết quả BÈ 8: ĐẠT: giá trị 13,40 m, yêu cầu ≥ 1,5 m, mức sử dụng 0,11. Khoảng hở khi hồ xuống MNC: xem mục 4.
- C9 — Khoảng cách trung bình giữa các dây neo: P_bè / N_dây ≤ [maxSpacing]. P_bè là chu vi đa giác bè đo trên mặt bằng, N_dây là số dây neo của bè; [maxSpacing] = 15 m là yêu cầu bắt buộc để lực phân bố đều quanh bè. Kết quả BÈ 8: ĐẠT: giá trị 14,8 m, yêu cầu ≤ 15 m, mức sử dụng 0,99.
- C12 — Độ trôi ngang của bè (cân bằng tĩnh, mọi mực nước): u_max ≤ khe hở nhỏ nhất tới bè bên cạnh / 2. u_max là độ trôi ngang lớn nhất của bè trong mô hình cân bằng (mọi hướng, mọi mực nước); hai bè cạnh nhau có thể cùng trôi về phía nhau nên mỗi bè chỉ được trôi nửa khe hở. Kết quả BÈ 8: ĐẠT: giá trị 0,76 m, yêu cầu ≤ 13,10 m, mức sử dụng 0,06.
- C10 — Sức chịu tải cho phép của cọc BỜ (P_max): P_req = T_dây × SF ≤ P_max. P_max là sức chịu tải cho phép của cọc bờ theo catalogue hoặc thí nghiệm thử tải; chỉ kiểm khi có nhập P_max. Kết quả BÈ 8: KHÔNG ÁP DỤNG — chưa có catalogue hoặc thí nghiệm thử tải nên chưa có P_max; sức chịu cọc bờ đã kiểm bằng tính toán ở BP-1, BP-2.
- C11 — Sức chịu tải cho phép của cọc LÒNG HỒ (P_max): P_req = T_dây × SF ≤ P_max. Như C10 cho cọc đóng dưới đáy hồ (phương án PA1). Kết quả BÈ 8: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- BP-1 — Sức chịu ngang cọc neo BỜ (Broms): H_applied / H_allow ≤ 1,0. H_applied là lực ngang vào một cọc (T, hoặc T / (2 × 0,9) ở điểm cọc đôi), H_allow = H_u / 2,5 với H_u là sức chịu ngang giới hạn theo Broms (mục 5). Kết quả BÈ 8: ĐẠT: giá trị 0,562, yêu cầu ≤ 1,0, mức sử dụng 0,56.
- BP-2 — Uốn tiết diện cọc BỜ (TCVN 5574:2018): γ·M_max / M_rd ≤ 1,0. M_max là mô-men lớn nhất trong thân cọc, γ = 1,2 là hệ số tải trọng, M_rd là khả năng chịu uốn của lồng thép theo TCVN 5574:2018 (mục 5). Kết quả BÈ 8: ĐẠT: giá trị 0,930, yêu cầu ≤ 1,0, mức sử dụng 0,93.
- BP-3 — Sức chịu ngang cọc LÒNG HỒ (Cách 1): Th / H_allow ≤ 1,0. Sức chịu ngang của cọc đóng dưới đáy hồ (phương án PA1): T_h lực ngang, H_allow sức chịu cho phép. Kết quả BÈ 8: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- BP-4 — Sức chịu NHỔ cọc LÒNG HỒ (ma sát thân): Tv / Q_uplift,all ≤ 1,0. Sức chịu nhổ của cọc đóng dưới đáy hồ (PA1): T_v lực nhổ, Q_uplift,all sức chịu nhổ cho phép do ma sát thân cọc. Kết quả BÈ 8: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- BP-5 — Ứng suất uốn tiết diện cọc LÒNG HỒ: M_max / M_rd ≤ 1,0. Uốn thân cọc đóng dưới đáy hồ (PA1). Kết quả BÈ 8: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- SV-1 — Đế vít xoắn — chống NHỔ: Tv / (0,9·W' + n·Q_a) ≤ 1,0. T_v là lực nhổ, W' là trọng lượng đế trong nước (đã trừ lực đẩy nổi, chỉ lấy 0,9), n vít × Q_a là sức chịu nhổ cho phép của các vít (mục 6). Kết quả BÈ 8: ĐẠT: giá trị 0,740, yêu cầu ≤ 1,0, mức sử dụng 0,74.
- SV-2 — Đế vít xoắn — chống TRƯỢT: 1,5·Th / (α·c_u·B² + R_gờ + n·H_u) ≤ 1,0. T_h là lực ngang nhân hệ số 1,5; chống trượt gồm bám dính đáy α·c_u·B² (bằng 0 khi đế bị nhấc), gờ đế R_gờ và sức chịu ngang của n vít H_u (mục 6). Kết quả BÈ 8: ĐẠT: giá trị 0,658, yêu cầu ≤ 1,0, mức sử dụng 0,66.
- SV-3 — Đế vít xoắn — chống LẬT: 1,5·M_o / M_r ≤ 1,0. M_o là mô-men lật quanh mép đáy phía xa dây (nhân 1,5), M_r là mô-men giữ do trọng lượng đế và các vít (mục 6). Kết quả BÈ 8: ĐẠT: giá trị 0,989, yêu cầu ≤ 1,0, mức sử dụng 0,99.
- SV-4 — Đế vít xoắn — lực nhổ một vít: N_1 / Q_a ≤ 1,0. N_1 là lực nhổ lên vít chịu nặng nhất sau khi trừ phần trọng lượng đế gánh, Q_a là sức chịu nhổ cho phép của một vít (mục 6). Kết quả BÈ 8: ĐẠT: giá trị 0,515, yêu cầu ≤ 1,0, mức sử dụng 0,51.
- SV-5 — Đế vít xoắn — áp lực lên nền bùn: W'/B² ≤ 5,14·c_u / 2,5. W'/B² là áp lực đế lên nền bùn, 5,14·c_u là sức chịu tải giới hạn của nền sét mềm, chia hệ số an toàn (mục 6). Kết quả BÈ 8: ĐẠT: giá trị 6,0, yêu cầu ≤ 41,1 kPa, mức sử dụng 0,15.
- SV-6 — Đế vít xoắn — cốt thép bản đế: max(A_s yc ; 0,1%) / A_s bố trí ≤ 1,0. A_s yc là thép bản đế cần theo mô-men uốn, 0,1% là hàm lượng tối thiểu, A_s bố trí là lưới thép đặt trong bản (mục 6). Kết quả BÈ 8: ĐẠT: giá trị 0,619, yêu cầu ≤ 1,0, mức sử dụng 0,62.
