# Thuyết minh tính toán hệ neo: cọc khoan nhồi ven bờ + đế BTCT vít xoắn

## 1. Phương án chốt

- Chủ đầu tư chốt ngày 12/10/2026: Cọc khoan nhồi D350 ven bờ + đế BTCT giữ bằng vít xoắn dưới đáy hồ. Lực dây tính lại ngày 23/10/2026 bằng cân bằng tĩnh của bè trên từng dây theo mực nước (thay cách góc dây 30° + hệ số tập trung); cáp, cọc, đế định cỡ lại theo lực này.
- Hệ neo: 222 tuyến cáp tại 211 điểm neo = 175 cọc khoan nhồi ven bờ + 36 đế đáy hồ (11 đế dùng chung hai bè).
- Mặt bằng bè: bản vẽ CAD 27/10/2026, 4 bè, 98.803 m²; số tấm pin theo bản vẽ bố trí bè pin 28/10/2026: BÈ 1 2.800, BÈ 2 9.114, BÈ 3 1.400, BÈ 4 5.600, tổng 18.914 tấm.
- Gió tính toán V = 20 m/s là cấp gió vận hành, THẤP HƠN gió tiêu chuẩn TCVN 2737:2023 vùng II-B (V ≈ 29,7 m/s, q0 = 0,54 kN/m²): áp lực gió chỉ bằng 45% mức tiêu chuẩn. Cáp, cọc và đế neo định cỡ ở cấp gió này CHƯA được kiểm tra với bão thiết kế; nhập V = 30 m/s ở Tab 2 để kiểm tra.
- Vận hành dây: căng chỉnh lại dây mỗi khi mực nước thay đổi 1,0 m (trong mỗi khoảng, dây đặt bằng khoảng cách bích – chốt dài nhất của khoảng).
- Kết quả: 4/4 bè đạt; 175/175 cọc bờ đạt; 36/36 đế đạt.

## 2. Số liệu đầu vào và giả định

- Mực nước hồ: MNC 380,00 m; MNDB 384,50 m; MNLKT 386,00 m.
- Tấm pin: 2,701 m²/tấm, nghiêng 10°, hệ số cản 1,15, hệ số che chắn giữa các hàng 0,55; sóng và dòng chảy gộp bằng hệ số 1,05.
- Đất bờ (GIẢ ĐỊNH, chưa khảo sát): sét, c_u = 40 kPa. Bùn đáy hồ (GIẢ ĐỊNH): c_u = 20 kPa, γ' = 6 kN/m³.
- Hệ số an toàn: cáp ≥ 3,0; cọc bờ chịu ngang 2,5; hệ số tải uốn cọc 1,2; đế: trượt 1,5, lật 1,5, nhổ vít 2,0, nền 2,5; trọng lượng đế nhân 0,9 khi chống nhổ.

## 3. Lực gió lên bè (ví dụ BÈ 2, bè có lực dây lớn nhất)

- Áp lực gió: q = 0,5 × ρ × V² = 0,5 × 1,25 × 20² = 250 N/m².
- Diện tích đón gió của pin: A = số tấm × diện tích tấm × sin(nghiêng) = 9.114 × 2,701 × sin 10° = 4.275 m².
- Lực gió lên pin: F_pin = q × C_d × A × hệ số che chắn = 250 × 1,15 × 4.275 × 0,55 = 675,9 kN.
- Lực gió lên phao (mạn khô 0,35 m): F_phao = 25,6 kN. Tổng gió: 701,5 kN.
- Tổng lực môi trường: F = 701,5 × 1,05 = 736,6 kN.

## 4. Lực căng dây — phân tích cân bằng tĩnh theo mực nước

- Mực nước dao động 6,00 m trong khi dây đáy chỉ dài 14,1–29,8 m: chiều dài cần của dây đổi theo mực nước, dây chùng – căng khác nhau, nên số dây thật sự chịu lực thay đổi theo hướng tải và mực nước. Cách góc dây 30° + hệ số tập trung (coi mọi dây cùng làm việc) cho lực dây thấp hơn thực tế nên không dùng nữa.
- Mỗi bè: tải môi trường F đặt lần lượt theo 24 hướng (15°/hướng), ở mọi mực nước từ mức bè còn nổi tới MNLKT (bước 1 m, thêm MNDB và MNLKT). Bè tịnh tiến tới khi tổng lực các dây đang căng cân bằng F. Dây thẳng, đàn hồi EA = 15 × lực đứt (GIẢ ĐỊNH cho polyester), dây chùng không chịu lực; không xét xoay bè và tải động.
- Lực một dây: T = (EA / L_0) × (d − L_0) khi d > L_0, T = 0 khi d ≤ L_0 (dây chùng). d là khoảng cách thẳng bích bè – chốt neo khi bè đã dịch đi, L_0 là chiều dài dây lúc vừa căng. Cáp PES-40: EA = 15 × 475 = 7.125 kN. Dây càng ngắn (L_0 nhỏ) càng cứng nên nhận càng nhiều lực.
- Vị trí cân bằng: độ dịch u của bè sao cho tổng thành phần ngang của lực các dây đang căng bằng F theo hướng tải; T thiết kế = T lớn nhất trên mọi hướng, mọi mực nước + lực căng trước T_0 = 5 kN.
- BÈ 2 (bè có lực dây lớn nhất): F = 736,6 kN; chi phối ở mực nước 383,00 m, tải đẩy về hướng 150°, dây B2-D29 chịu 104,0 kN, 29 dây cùng căng; bè trôi 0,24 m. Mất dây B2-D29: dây lớn nhất còn lại 97,6 kN.
- Lực dây thiết kế của BÈ 2: T = 146,8 kN (đã cộng lực căng trước 5 kN; không nhỏ hơn F / (n × cos α) = 146,8 kN); khi đứt một dây: 175,1 kN. Cáp và cọc bờ của bè kiểm tra với lực này; mỗi đế vít xoắn kiểm tra với lực lớn nhất của chính (các) dây nối vào nó (bao mọi hướng, mọi mực nước).
- Cáp PES-40, lực đứt 475 kN: hệ số an toàn MBL / T = 475 / 146,8 = 3,24 (yêu cầu ≥ 3,0); khi đứt một dây 475 / 175,1 = 2,71 (yêu cầu ≥ 2,0).
- C9, khoảng cách trung bình giữa các dây: chu vi / số dây = 1.061,8 / 78 = 13,6 m ≤ 15 m (bắt buộc; các bè: 13,3–14,8 m).
- C8, khoảng hở đáy bè – đáy hồ = chiều sâu nước − mớn nước bè = 6,00 m ở MNDB ≥ 1,5 m; ở MNC còn 6,00 − (384,50 − 380,00) = 1,50 m (vừa đúng giới hạn).
- Độ trôi bè lớn nhất (mọi hướng, mọi mực nước): 0,4 – 0,6 m tùy bè (kiểm tra C12: ≤ nửa khoảng hở nhỏ nhất tới bè bên cạnh).

## 5. Cọc khoan nhồi ven bờ (ví dụ BÈ 2)

- Cọc tròn D350 đổ tại chỗ, ngàm L_tk = 6,5 m, dài cả cọc 6,6 m; thép chủ 6Φ28 CB500-V, Đai xoắn Φ8 a150. Cáp móc cách mặt đất 0,1 m.
- Điểm neo CỌC ĐÔI: 2 cọc cạnh nhau, vuông góc phương cáp, cách nhau ≥ 3D; mỗi cọc chịu P = T / (2 × 0,9) = 81,5 kN (hệ số nhóm là GIẢ ĐỊNH); đài BTCT nối hai đầu cọc: thiết kế sơ bộ ở bảng thống kê vật tư neo (twinPileCap.ts).
- BP-1, sức chịu ngang theo Broms (cọc ngắn trong đất sét). Sức kháng của đất trên 1 m cọc: p = 9 × c_u × D = 9 × 40 × 0,35 = 126,0 kN/m; đoạn 1,5D = 0,525 m dưới mặt đất không tính, phần ngàm làm việc g = L_tk − 1,5D = 6,5 − 0,525 = 5,975 m; tim chốt cáp cao e = 0,10 m trên mặt đất.
- H_u là nghiệm dương của (0,5 / p) × H_u² + (e + 1,5D + g) × H_u − 0,5 × p × g² = 0, tức (0,5 / 126,0) × H_u² + 6,600 × H_u − 2.249,1 = 0 → H_u = 290,2 kN. Cho phép H_u / 2,5 = 116,1 kN ≥ P = 81,5 kN; mức sử dụng = 81,5 / 116,1 = 0,70.
- BP-2, uốn thân cọc (TCVN 5574:2018). Mô-men lớn nhất trong cọc: M_max = P × (e + 1,5D + 0,5 × P / p) = 81,5 × (0,10 + 0,525 + 0,5 × 81,5 / 126,0) = 77,3 kNm.
- Khả năng chịu uốn của lồng 6 thanh Φ28 đặt trên vòng tròn: M_rd = A_1 thanh × R_s × r × k(n) = 615,8 mm² × 435 MPa × 0,125 m × 3,46 = 116,0 kNm (r = D/2 − 50 mm tới tim thép; k(n) = 2 / tan(π/n) là cánh tay đòn của n thanh ở hướng BẤT LỢI nhất, vì lồng thả vào lỗ khoan không định hướng được; bỏ qua bê tông chịu kéo).
- Kiểm tra: 1,2 × M_max = 1,2 × 77,3 = 92,8 kNm ≤ M_rd = 116,0 kNm; mức sử dụng 0,80 (1,2 là hệ số tải trọng khi kiểm tra uốn).
- Cọc ĐƠN theo lực của chính dây (như đế neo đáy): ở BÈ 1 44/46 điểm, BÈ 2 46/47 điểm, BÈ 4 55/55 điểm, lực lớn nhất của CHÍNH dây (mọi mực nước, mọi hướng gió, cộng lực căng trước) không quá 73,3 kN (BÈ 1), 91,4 kN (BÈ 2), 89,3 kN (BÈ 4) nên dùng một cọc 6Φ28 CB400-V, L_tk 6,5 m; 6Φ28 CB500-V, L_tk 6,5 m (BP-1 0,63 / 0,79 / 0,77, BP-2 0,86 / 0,93 / 0,91); chỉ các dây lực lớn hơn mới dùng cọc của bè. Lực bè T ở trên là lực bất lợi nhất của bè, có sàn F/(6 cos 30°).
- Cả hệ: 178 cọc, tổng dài 1.174,8 m, 113,0 m³ bê tông, 35,8 tấn thép. Lực kiểm tra cọc là toàn bộ lực dây (không giảm theo góc xiên), thiên về an toàn.

## 6. Đế BTCT + vít xoắn (ví dụ HV-DV004, đế làm việc nặng nhất)

- Một vít: ống Ø89×5, ren Ø105, ngàm 3,0 m. Sức chịu nhổ cực hạn Q_u = α × c_u × π × D_ren × L = 0,8 × 20 × π × 0,105 × 3,0 = 15,8 kN; cho phép Q_a = Q_u / 2 = 7,9 kN. Sức chịu ngang cực hạn H_u = 15,0 kN.
- Đế HV-DV004 giữ hai dây B2-D57 (BÈ 2, T = 50,5 kN, dài 14,14 m) và B4-D20 (BÈ 4, T = 61,9 kN, dài 14,15 m). Bích bè cao hơn mặt nước 0,35 m.
- Mỗi dây tách thành lực ngang T_h = T × cos θ và lực nhổ T_v = T × sin θ, θ là góc dốc của dây (tan θ = chênh cao bích bè – chốt đế / khoảng cách ngang): dây thoải khi nước thấp (trượt chi phối), dốc khi nước cao (nhổ, lật chi phối).
- Tổ hợp chi phối: cả hai dây căng (MN cao). Lực nhổ T_v = 51,6 kN (hai dây cộng lại), lực ngang T_h = 10,1 kN (cộng véc-tơ).
- Đế 2,50 × 2,50 × 0,4 m: thể tích 2,50 m³, nặng 62,5 kN trên cạn, W' = 2,50 × (25 − 10) = 37,5 kN trong nước (đã trừ lực đẩy nổi).
- SV-1 nhổ: T_v ≤ 0,9 × W' + 4 × Q_a = 65,4 kN; mức sử dụng 0,79.
- SV-2 trượt: 1,5 × T_h ≤ bám dính đáy + gờ + 4 × H_u. Bám dính đáy = 0,5 × c_u × B² = 0,0 kN (lấy bằng 0 khi T_v > W': đế bị nhấc khỏi bùn); gờ sâu z = 0,15 m: B × (0,5 × γ' × z² + 2 × c_u × z) = 15,2 kN; H_u một vít = 15,0 kN (Broms, đầu tự do ở mặt bùn). 1,5 × 10,1 = 15,2 ≤ 75,1 kN; mức sử dụng 0,62.
- SV-3 lật quanh mép đáy phía xa dây: M_lật = T_h × (t + h_tai) + T_v × B / 2 = 10,1 × (0,4 + 0,15) + 51,6 × 2,50 / 2 = 70,0 kNm; M_giữ = W' × B / 2 + (n/2) × Q_u × (B − c) + (n/2) × Q_u × c = 126,0 kNm (c = 0,15 m từ mép đế tới tim lỗ vít). 1,5 × 70,0 = 105,0 ≤ 126,0 kNm; mức sử dụng 0,83.
- SV-4 một vít: lực nhổ lên vít chịu nặng nhất N_1 = max[(T_v − 0,9 × W') / n ; (M_lật − 0,9 × W' × B / 2) / (B − c) / (n/2)] = 5,9 kN ≤ Q_a = 7,9 kN; mức sử dụng 0,75.
- SV-5 áp lực lên nền bùn: W' / B² = 6,0 kPa ≤ 5,14 × c_u / 2,5 = 41,1 kPa (sức chịu tải giới hạn của nền sét mềm); mức sử dụng 0,15.
- SV-6 thép bản đế: tai neo kéo lên ở giữa, 4 vít giữ ở các góc; mô-men trên 1 m bản M = (n/2) × Q_u × (s/2) / B = 13,93 kNm/m (s = B − 2c); thép cần A_s = M / (0,9 × h_0 × R_s) = 170 mm²/m, tối thiểu 0,1% = 350 mm²/m; bố trí lưới Ø12 a200 hai lớp = 565 mm²/m; mức sử dụng 0,62.
- Cả hệ: 36 đế (36 đế 2,50 m), 89,3 m³ bê tông, 4,3 tấn thép bản, 144 vít (533 m), đế nặng nhất khi cẩu 6,4 tấn.
- Tổng lực nhổ lên 36 đế 818 kN, tổng sức chống nhổ 2.355 kN. Mức sử dụng lớn nhất: nhổ 0,80, trượt 0,91, lật 0,83, một vít 0,75.

## 7. Chiều dài cắt cáp và điều chỉnh dây

- Mỗi dây cắt đủ dài cho mực nước làm khoảng cách bích – chốt dài nhất (46 dây đáy ở MNLKT, 176 dây bờ ở MNC). Tổng chiều dài cắt: dây bờ 4.748 m, dây đáy 911 m, chưa gồm đoạn bện đầu và phụ kiện.
- QUY TRÌNH VẬN HÀNH BẮT BUỘC: chỉnh lại mọi dây cho vừa căng mỗi khi mực nước thay đổi 1,0 m (đo từ MNC). Đầu dây phải chỉnh được: dây đáy tới 1,7 m cả mùa (đoạn xích chỉnh), dây bờ tới 2,7 m (tăng đơ, thêm đoạn xích ở dây ngắn).

## 8. Giả định và vấn đề còn mở

- Lực dây tính bằng cân bằng tĩnh của bè trên từng dây theo mực nước (380,0–386,0 m), với QUY TRÌNH VẬN HÀNH BẮT BUỘC: chỉnh lại độ căng mọi dây mỗi khi mực nước thay đổi 1,0 m. Nếu cáp cắt một lần rồi để nguyên, dây đáy chùng khi nước thấp và lực dồn vào ít dây: lực dây tới 66–150 kN; 1/4 bè khi đó không còn đủ hệ số an toàn cáp (thấp nhất 2,1, yêu cầu ≥ 3).
- Theo địa hình IFC, 4/4 bè chạm đáy một phần khi nước xuống thấp: BÈ 3 từ 384,1 m, BÈ 1 từ 383,4 m, BÈ 4 từ 382,5 m, BÈ 2 từ 382,5 m (MNDB 384,5, MNC 380,0 m). Cần nhà sản xuất bè xác nhận bè chịu được nằm trên đáy, hoặc thu mép bè / nạo vét theo khảo sát.
- 4 dây bờ lệch quá 60° so với pháp tuyến mép bè (B2-D34 72°, B2-D35 72°, B2-D36 70°, B2-D43 64°): trong tầm 60 m không có bờ theo phương vuông góc mép.
- 8/36 đế vít xoắn đứng trên nền cao hơn MNC 380,0 m theo địa hình IFC (khe BÈ 2 – BÈ 3, mép trên cùng BÈ 4; cao nhất 382,98 m): đế lộ khô khi nước chết, nước nông khi thi công — cao độ đặt đế lấy theo địa hình IFC, CHƯA khảo sát.
- 25/36 đế vít xoắn là đế ĐƠN (một dây): dọc mép nam BÈ 2 và mép trên cùng BÈ 4.
- Mô hình cân bằng không xét phân bố tải không đều trên bè lớn và tải động khi dây đang chùng bị giật căng. Độ cứng dây EA = 15 × lực đứt là giả định.
- Chưa có khảo sát địa chất: c_u đất bờ và bùn đáy là giả định. Sức chịu của vít tỷ lệ thuận với c_u; cọc bờ không đạt ở một số bè nếu c_u đất bờ chỉ 20 kPa.
- Hệ số che chắn 0,55 và diện tích chiếu của tấm nghiêng quyết định lực gió; lực gió trên một m² bè ở đây thấp hơn một số hồ sơ tham khảo.
- Sức chịu nhổ và sức chịu ngang của vít tính độc lập, chưa xét tương tác. Đầu cọc, đài cọc đôi, tai neo mặt đế mới có thiết kế sơ bộ (bảng thống kê vật tư neo, sheet KiemTra_DauCoc_De); chưa thiết kế: khóa đầu vít, móc cẩu, chống ăn mòn.
- Cao độ đáy đặt đế là đáy thiết kế, chưa phải khảo sát; tại 0 đế địa hình IFC cao hơn đáy thiết kế trên 0,5 m. 163/175 cọc bờ đứng ở chỗ mặt đất thấp hơn MNDB (thi công mùa nước thấp, có ống vách).
- 4 dây bờ lệch quá 60° so với pháp tuyến mép bè (giữ bè theo phương vuông góc mép kém; lực dây đã tính theo đúng phương vị): cọc mới — trong tầm 60 m không có bờ theo phương vuông góc mép — B2-D34 (72°), B2-D35 (72°), B2-D36 (70°), B2-D43 (64°).
- Lớp bê tông bảo vệ cọc bờ tới đai chỉ 26–30 mm (tính với 50 mm tới tim thép chủ).

## 9. Giải thích bảng hạng mục kiểm tra (ví dụ BÈ 2)

- Mỗi dòng của bảng kiểm tra trên web: công thức, ý nghĩa các ký hiệu và kết quả của bè ví dụ. Mức sử dụng = tải trọng phải chịu / khả năng chịu (đã chia hệ số an toàn): ≤ 1,00 là đạt. Dòng "KHÔNG ÁP DỤNG" là phép kiểm của loại neo khác, không dùng cho phương án cọc khoan nhồi + đế vít xoắn.
- C1 — Sức giữ neo (nguyên vẹn): SF = R_total / H_line ≥ [SF]. R_total là tổng sức giữ của các neo, H_line là lực ngang trong dây; [SF] là hệ số an toàn yêu cầu. Dùng cho neo thả kéo lê trên đáy (neo cày, khối thả). Kết quả BÈ 2: KHÔNG ÁP DỤNG — hệ này không dùng neo thả: sức giữ là của cọc bờ (BP-1, BP-2) và đế vít xoắn (SV-1…SV-6).
- C2 — Bền dây/xích neo (nguyên vẹn): SF = MBL / T_max ≥ [SF]. MBL là lực kéo đứt nhỏ nhất của cáp (nhà sản xuất công bố), T_max là lực lớn nhất một dây phải chịu (mô hình cân bằng, đã cộng lực căng trước); [SF] = 3 khi đủ dây. Kết quả BÈ 2: ĐẠT: giá trị 3,24, yêu cầu 3, mức sử dụng 0,93.
- C3 — Không nhổ neo (chiều dài dây nằm đáy): L_ground ≥ L_ground,min. L_ground là chiều dài xích / cáp nằm trên đáy trước neo, L_ground,min là chiều dài tối thiểu để neo kéo lê không bị nhấc lên. Dùng cho neo thả. Kết quả BÈ 2: KHÔNG ÁP DỤNG — cọc và đế chịu được lực nhổ (kiểm ở SV-1, SV-4), không cần đoạn dây nằm trên đáy.
- C4 — Tỷ lệ chiều dài dây / chiều sâu nước (Scope ratio): L_total / d ≥ [scope]. L_total là chiều dài dây, d là chiều sâu nước; tỷ lệ [scope] (thường ≥ 5) bảo đảm dây xích đủ thoải cho neo thả. Kết quả BÈ 2: KHÔNG ÁP DỤNG — dây căng thẳng tới cọc / đế, chiều dài dây do mặt bằng quyết định.
- C5 — Sức giữ neo (khi đứt 1 dây): SF = R_total / H_line,dam ≥ [SF]. Như C1 nhưng với lực ngang H_line,dam khi đứt một dây. Kết quả BÈ 2: KHÔNG ÁP DỤNG — hệ này không dùng neo thả: sức giữ là của cọc bờ (BP-1, BP-2) và đế vít xoắn (SV-1…SV-6).
- C6 — Bền dây/xích neo (khi đứt 1 dây): SF = MBL / T_max,dam ≥ [SF]. Như C2 nhưng T_max,dam là lực lớn nhất trong các dây còn lại khi dây chịu lực lớn nhất bị đứt (tính lại ở mọi mực nước); [SF] = 2. Kết quả BÈ 2: ĐẠT: giá trị 2,71, yêu cầu 2, mức sử dụng 0,74.
- C7 — Độ thiếu chiều dài dây neo: X_deficit ≤ [maxOffset]. X_deficit là phần dây còn thiếu so với chiều dài cần của dây xích chùng (đường dây xích) ở độ trôi cho phép [maxOffset]. Kết quả BÈ 2: KHÔNG ÁP DỤNG — không có đoạn dây xích dự trữ; cáp cắt theo bảng chiều dài cắt cáp (mục 7).
- C8 — Khoảng hở an toàn đáy bè – đáy hồ: Clearance = h_nước − mớn nước bè ≥ [min]. h_nước là chiều sâu nước dưới bè ở độ sâu thiết kế, mớn nước là phần bè chìm dưới nước; [min] là khoảng hở tối thiểu để đáy bè không chạm đáy hồ. Kết quả BÈ 2: ĐẠT: giá trị 6,00 m, yêu cầu ≥ 1,5 m, mức sử dụng 0,25. Khoảng hở khi hồ xuống MNC: xem mục 4.
- C9 — Khoảng cách trung bình giữa các dây neo: P_bè / N_dây ≤ [maxSpacing]. P_bè là chu vi đa giác bè đo trên mặt bằng, N_dây là số dây neo của bè; [maxSpacing] = 15 m là yêu cầu bắt buộc để lực phân bố đều quanh bè. Kết quả BÈ 2: ĐẠT: giá trị 13,6 m, yêu cầu ≤ 15 m, mức sử dụng 0,91.
- C12 — Độ trôi ngang của bè (cân bằng tĩnh, mọi mực nước): u_max ≤ khe hở nhỏ nhất tới bè bên cạnh / 2. u_max là độ trôi ngang lớn nhất của bè trong mô hình cân bằng (mọi hướng, mọi mực nước); hai bè cạnh nhau có thể cùng trôi về phía nhau nên mỗi bè chỉ được trôi nửa khe hở. Kết quả BÈ 2: ĐẠT: giá trị 0,43 m, yêu cầu ≤ 14,12 m, mức sử dụng 0,03.
- C10 — Sức chịu tải cho phép của cọc BỜ (P_max): P_req = T_dây × SF ≤ P_max. P_max là sức chịu tải cho phép của cọc bờ theo catalogue hoặc thí nghiệm thử tải; chỉ kiểm khi có nhập P_max. Kết quả BÈ 2: KHÔNG ÁP DỤNG — chưa có catalogue hoặc thí nghiệm thử tải nên chưa có P_max; sức chịu cọc bờ đã kiểm bằng tính toán ở BP-1, BP-2.
- C11 — Sức chịu tải cho phép của cọc LÒNG HỒ (P_max): P_req = T_dây × SF ≤ P_max. Như C10 cho cọc đóng dưới đáy hồ (phương án PA1). Kết quả BÈ 2: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- BP-1 — Sức chịu ngang cọc neo BỜ (Broms): H_applied / H_allow ≤ 1,0. H_applied là lực ngang vào một cọc (T, hoặc T / (2 × 0,9) ở điểm cọc đôi), H_allow = H_u / 2,5 với H_u là sức chịu ngang giới hạn theo Broms (mục 5). Kết quả BÈ 2: ĐẠT: giá trị 0,702, yêu cầu ≤ 1,0, mức sử dụng 0,70.
- BP-2 — Uốn tiết diện cọc BỜ (TCVN 5574:2018): γ·M_max / M_rd ≤ 1,0. M_max là mô-men lớn nhất trong thân cọc, γ = 1,2 là hệ số tải trọng, M_rd là khả năng chịu uốn của lồng thép theo TCVN 5574:2018 (mục 5). Kết quả BÈ 2: ĐẠT: giá trị 0,800, yêu cầu ≤ 1,0, mức sử dụng 0,80.
- BP-3 — Sức chịu ngang cọc LÒNG HỒ (Cách 1): Th / H_allow ≤ 1,0. Sức chịu ngang của cọc đóng dưới đáy hồ (phương án PA1): T_h lực ngang, H_allow sức chịu cho phép. Kết quả BÈ 2: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- BP-4 — Sức chịu NHỔ cọc LÒNG HỒ (ma sát thân): Tv / Q_uplift,all ≤ 1,0. Sức chịu nhổ của cọc đóng dưới đáy hồ (PA1): T_v lực nhổ, Q_uplift,all sức chịu nhổ cho phép do ma sát thân cọc. Kết quả BÈ 2: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- BP-5 — Ứng suất uốn tiết diện cọc LÒNG HỒ: M_max / M_rd ≤ 1,0. Uốn thân cọc đóng dưới đáy hồ (PA1). Kết quả BÈ 2: KHÔNG ÁP DỤNG — neo đáy hồ là đế BTCT + vít xoắn (SV-1…SV-6), không phải cọc đóng.
- SV-1 — Đế vít xoắn — chống NHỔ: Tv / (0,9·W' + n·Q_a) ≤ 1,0. T_v là lực nhổ, W' là trọng lượng đế trong nước (đã trừ lực đẩy nổi, chỉ lấy 0,9), n vít × Q_a là sức chịu nhổ cho phép của các vít (mục 6). Kết quả BÈ 2: ĐẠT: giá trị 0,584, yêu cầu ≤ 1,0, mức sử dụng 0,58.
- SV-2 — Đế vít xoắn — chống TRƯỢT: 1,5·Th / (α·c_u·B² + R_gờ + n·H_u) ≤ 1,0. T_h là lực ngang nhân hệ số 1,5; chống trượt gồm bám dính đáy α·c_u·B² (bằng 0 khi đế bị nhấc), gờ đế R_gờ và sức chịu ngang của n vít H_u (mục 6). Kết quả BÈ 2: ĐẠT: giá trị 0,898, yêu cầu ≤ 1,0, mức sử dụng 0,90.
- SV-3 — Đế vít xoắn — chống LẬT: 1,5·M_o / M_r ≤ 1,0. M_o là mô-men lật quanh mép đáy phía xa dây (nhân 1,5), M_r là mô-men giữ do trọng lượng đế và các vít (mục 6). Kết quả BÈ 2: ĐẠT: giá trị 0,984, yêu cầu ≤ 1,0, mức sử dụng 0,98.
- SV-4 — Đế vít xoắn — lực nhổ một vít: N_1 / Q_a ≤ 1,0. N_1 là lực nhổ lên vít chịu nặng nhất sau khi trừ phần trọng lượng đế gánh, Q_a là sức chịu nhổ cho phép của một vít (mục 6). Kết quả BÈ 2: ĐẠT: giá trị 0,595, yêu cầu ≤ 1,0, mức sử dụng 0,60.
- SV-5 — Đế vít xoắn — áp lực lên nền bùn: W'/B² ≤ 5,14·c_u / 2,5. W'/B² là áp lực đế lên nền bùn, 5,14·c_u là sức chịu tải giới hạn của nền sét mềm, chia hệ số an toàn (mục 6). Kết quả BÈ 2: ĐẠT: giá trị 6,0, yêu cầu ≤ 41,1 kPa, mức sử dụng 0,15.
- SV-6 — Đế vít xoắn — cốt thép bản đế: max(A_s yc ; 0,1%) / A_s bố trí ≤ 1,0. A_s yc là thép bản đế cần theo mô-men uốn, 0,1% là hàm lượng tối thiểu, A_s bố trí là lưới thép đặt trong bản (mục 6). Kết quả BÈ 2: ĐẠT: giá trị 0,619, yêu cầu ≤ 1,0, mức sử dụng 0,62.
