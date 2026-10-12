# Thuyết minh tính toán hệ neo: cọc khoan nhồi ven bờ + đế BTCT vít xoắn

## 1. Phương án chốt

- Chủ đầu tư chốt ngày 12/10/2026: Cọc khoan nhồi D350 ven bờ + đế BTCT giữ bằng vít xoắn dưới đáy hồ.
- Hệ neo: 295 tuyến cáp tại 263 điểm neo = 231 cọc khoan nhồi ven bờ + 32 đế đáy hồ (cả 32 đế dùng chung cho hai dây của hai bè đối diện).
- Gió tính toán V = 20 m/s. Gió tính toán V = 20 m/s là cấp gió vận hành, THẤP HƠN gió tiêu chuẩn TCVN 2737:2023 vùng II-B (V ≈ 29,7 m/s, q0 = 0,54 kN/m²): áp lực gió chỉ bằng 45% mức tiêu chuẩn. Cáp, cọc và đế neo định cỡ ở cấp gió này CHƯA được kiểm tra với bão thiết kế; nhập V = 30 m/s ở Tab 2 để kiểm tra.
- Kết quả: 9/9 bè đạt; 231/231 cọc bờ đạt; 32/32 đế đạt.

## 2. Số liệu đầu vào và giả định

- Mực nước hồ: MNC 380,0 m; MNDB 384,5 m; MNLKT 386,0 m.
- Tấm pin: 2,701 m²/tấm, nghiêng 12°, hệ số cản 1,15, hệ số che chắn giữa các hàng 0,55; sóng và dòng chảy gộp bằng hệ số 1,05.
- Đất bờ (GIẢ ĐỊNH, chưa khảo sát): sét, c_u = 40 kPa. Bùn đáy hồ (GIẢ ĐỊNH): c_u = 20 kPa, γ' = 6 kN/m³.
- Hệ số an toàn: cáp ≥ 3,0; cọc bờ chịu ngang 2,5; hệ số tải uốn cọc 1,2; đế: trượt 1,5, lật 1,5, nhổ vít 2,0, nền 2,5; trọng lượng đế nhân 0,9 khi chống nhổ.

## 3. Lực gió lên bè (ví dụ BÈ 5A, bè có lực dây lớn nhất)

- Áp lực gió: q = 0,5 × ρ × V² = 0,5 × 1,25 × 20² = 250 N/m².
- Diện tích đón gió của pin: A = số tấm × diện tích tấm × sin(nghiêng) = 4.410 × 2,701 × sin 12° = 2.477 m².
- Lực gió lên pin: F_pin = q × C_d × A × hệ số che chắn = 250 × 1,15 × 2.477 × 0,55 = 391,6 kN.
- Lực gió lên phao (mạn khô 0,35 m): F_phao = 15,9 kN. Tổng gió: 407,5 kN.
- Tổng lực môi trường: F = 407,5 × 1,05 = 427,9 kN.

## 4. Lực căng một dây

- Tính hai cách, lấy giá trị lớn hơn; mọi dây của bè đều kiểm tra với lực này.
- Cách hệ số tập trung: T = F × k + T_0 = 427,9 × 0,144 + 5 = 66,6 kN.
- Cách chia cho số dây làm việc: T = F / (n × cos α) + T_0 = 427,9 / (6 × cos 30°) + 5 = 87,3 kN.
- Lực dây thiết kế của BÈ 5A: T = 87,3 kN; khi đứt một dây: 103,8 kN.
- Cáp PES-32, lực đứt 305 kN: hệ số an toàn 3,49 (yêu cầu ≥ 3,0); khi đứt một dây 2,94 (yêu cầu ≥ 2,0).

## 5. Cọc khoan nhồi ven bờ (ví dụ BÈ 5A)

- Cọc tròn D350 đổ tại chỗ, ngàm L_tk = 6,5 m, dài cả cọc 6,6 m; thép chủ 6Φ32 CB400-V, Đai xoắn Φ8 a150. Cáp móc cách mặt đất 0,1 m.
- BP-1, sức chịu ngang theo Broms (cọc ngắn trong đất sét): H_u = 290,2 kN; cho phép H_u / 2,5 = 116,1 kN ≥ T = 87,3 kN; mức sử dụng 0,75.
- BP-2, uốn thân cọc (TCVN 5574:2018): 1,2 × M_max = 1,2 × 84,9 = 101,8 kNm ≤ M_rd = 121,9 kNm; mức sử dụng 0,84.
- Cả hệ: 231 cọc, tổng dài 1.524,6 m, 146,7 m³ bê tông, 38,3 tấn thép. Lực kiểm tra cọc là toàn bộ lực dây (không giảm theo góc xiên), thiên về an toàn.

## 6. Đế BTCT + vít xoắn (ví dụ HV-DV008, đế làm việc nặng nhất)

- Một vít: ống Ø89×5, ren Ø105, ngàm 3,0 m. Sức chịu nhổ cực hạn Q_u = α × c_u × π × D_ren × L = 0,8 × 20 × π × 0,105 × 3,0 = 15,8 kN; cho phép Q_a = Q_u / 2 = 7,9 kN. Sức chịu ngang cực hạn H_u = 15,0 kN.
- Đế HV-DV008 giữ hai dây B3-D20 (BÈ 3, T = 38,6 kN, dài 12,34 m) và B3A-D22 (BÈ 3A, T = 73,7 kN, dài 12,34 m). Bích bè cao hơn mặt nước 0,35 m.
- Tổ hợp chi phối: cả hai dây căng (MN cao). Lực nhổ T_v = 58,3 kN (hai dây cộng lại), lực ngang T_h = 29,9 kN (cộng véc-tơ).
- Đế 2,75 × 2,75 × 0,4 m: thể tích 3,03 m³, nặng 75,6 kN trên cạn, W' = 3,03 × (25 − 10) = 45,4 kN trong nước (đã trừ lực đẩy nổi).
- SV-1 nhổ: T_v ≤ 0,9 × W' + 4 × Q_a = 72,5 kN; mức sử dụng 0,80.
- SV-2 trượt: 1,5 × T_h ≤ bám dính đáy + gờ + 4 × H_u; mức sử dụng 0,67 (bám dính đáy lấy bằng 0 khi T_v > W').
- SV-3 lật quanh mép đế: 1,5 × M_lật = 1,5 × 96,7 ≤ M_giữ = 149,5 kNm; mức sử dụng 0,97.
- SV-4 một vít: N_1 = 7,8 kN ≤ Q_a; mức sử dụng 0,98. SV-5 nền: 0,15. SV-6 thép bản (lưới Ø12 a200, hai lớp): 0,62.
- Cả hệ: 32 đế (11 đế 2,50 m, 19 đế 2,75 m, 2 đế 3,25 m), 92,8 m³ bê tông, 4,4 tấn thép bản, 128 vít (474 m), đế nặng nhất khi cẩu 10,8 tấn.
- Tổng lực nhổ lên 32 đế 1.643 kN, tổng sức chống nhổ 2.275 kN. Mức sử dụng lớn nhất: nhổ 0,89, trượt 0,85, lật 0,97, một vít 0,99.

## 7. Chiều dài cắt cáp

- Cáp không lắp bằng cách kéo căng: mỗi dây cắt theo khoảng cách thẳng từ bích bè tới chốt neo ở mực nước mà khoảng cách đó dài nhất (64 dây đáy ở MNLKT, 231 dây bờ ở MNC).
- Tổng chiều dài cắt: dây bờ 6.509 m, dây đáy 1.129 m, chưa gồm đoạn bện đầu và phụ kiện. Phải đo cao độ đáy từng đế trước khi cắt dây đáy.

## 8. Giả định và vấn đề còn mở

- Chưa có khảo sát địa chất: c_u đất bờ và bùn đáy là giả định. Sức chịu của vít tỷ lệ thuận với c_u; cọc bờ không đạt ở một số bè nếu c_u đất bờ chỉ 20 kPa.
- Số dây làm việc lấy bằng 6 và góc dây 30° cho mọi bè là giả định; số dây thực sự căng theo từng hướng gió ở MNC và MNLKT chưa kiểm tra.
- Hệ số che chắn 0,55 và diện tích chiếu của tấm nghiêng quyết định lực gió; lực gió trên một m² bè ở đây thấp hơn một số hồ sơ tham khảo.
- Sức chịu nhổ và sức chịu ngang của vít tính độc lập, chưa xét tương tác. Chưa thiết kế: tai neo đôi của đế, khóa đầu vít, móc cẩu, chống ăn mòn, đài / bích neo đầu cọc.
- Cao độ đáy đặt đế là đáy thiết kế, chưa phải khảo sát; tại 4 đế địa hình IFC cao hơn đáy thiết kế trên 0,5 m. 183/231 cọc bờ đứng ở chỗ mặt đất thấp hơn MNDB (thi công mùa nước thấp, có ống vách).
- Ba dây của cọc bờ đã định vị còn rất xiên so với mép bè: B7-D01, B7-D09, B8-D13.
- Lớp bê tông bảo vệ cọc bờ tới đai chỉ 26–30 mm (tính với 50 mm tới tim thép chủ).
