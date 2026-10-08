# Nghiên cứu: ưu tiên cọc khoan nhồi ven bờ và đế neo đáy dùng chung giữa hai bè

> **KẾT QUẢ TRIỂN KHAI (2026-10-08, sau khi Chủ đầu tư duyệt):** mặt bằng chính thức do `scripts/planMooringLayoutV2.mjs` sinh ra có **214 cọc bờ (85 điểm chuyển từ neo đáy) và 51 đế (27 đế dùng chung + 24 đế đơn)**, không phải 225 / 40 như ước tính dưới đây. Lý do: nghiên cứu này chưa xét điều kiện khả thi của cọc bờ (dây không cắt dây khác, cọc cách nhau ≥ 3 m, có đất ≥ 384,0 m trong 60 m) — 12 dây ven bờ không chuyển được nên giữ đế đơn. Bê tông đế thực tế 144,4 m³. Các số dưới đây giữ nguyên để tham khảo.

Sinh bởi `scripts/studySharedBedAnchors.ts`. **Đây là nghiên cứu: chưa thay đổi mặt bằng neo, web hay bản vẽ.**
Gió tính toán V = 20 m/s. Gió tính toán V = 20 m/s là cấp gió vận hành, THẤP HƠN gió tiêu chuẩn TCVN 2737:2023 vùng II-B (V ≈ 29,7 m/s, q0 = 0,54 kN/m²): áp lực gió chỉ bằng 45% mức tiêu chuẩn. Cáp, cọc và đế neo định cỡ ở cấp gió này CHƯA được kiểm tra với bão thiết kế; nhập V = 30 m/s ở Tab 2 để kiểm tra.

## 1. Quy tắc và ngưỡng đã dùng (cần Chủ đầu tư xác nhận)
- Điểm neo đáy **nằm giữa hai bè**: có bè khác trong vòng **45 m** tính từ điểm móc cáp theo phương dây (±30°).
- Điểm còn lại: tìm vị trí cọc khoan nhồi trên bờ / mép nước theo phương dây (quét ±45°), tại chỗ địa hình IFC đạt cao độ **≥ 384,0 m** (MNDB 384.5 m − 0,5 m, "mấp mé nước"), dây dài không quá **60 m**, không đi qua hay sát bè khác.
- Lực dây: lực bất lợi nhất của bè (chưa có mô hình chia lực từng dây). Dây chùng lấy lực căng trước 5 kN. c_u bùn = 20 kPa (giả định).
- Đế đặt ở cao độ đáy thiết kế (378,3–378,5 m); hai mực nước MNC 380 và MNLKT 386 m.

## 2. Phân loại 163 điểm neo đáy hiện tại
| Loại | Số điểm | Xử lý theo chỉ đạo mới |
|---|---|---|
| Giữa hai bè | 66 | giữ neo đáy, ghép thành đế dùng chung |
| Ven bờ, có vị trí đặt cọc trong 60 m | 96 | chuyển sang cọc khoan nhồi D350 (dây dài 3,0–56,5 m) |
| Mặt nước trống, không có bờ trong 60 m và không có bè đối diện | 1 | **chưa có lời giải theo chỉ đạo mới** — giữ đế đơn, hoặc kéo dây dài hơn tới bờ |

| Bè | T dây (kN) | Bờ hiện tại | Đáy hiện tại | → chuyển lên bờ | → giữa hai bè | → mặt nước trống |
|---|---|---|---|---|---|---|
| BÈ 1 | 30,2 | 14 | 5 | 3 | 2 | 0 |
| BÈ 2 | 27,8 | 10 | 10 | 5 | 5 | 0 |
| BÈ 3 | 40,1 | 11 | 10 | 3 | 7 | 0 |
| BÈ 3A | 73,7 | 17 | 33 | 14 | 19 | 0 |
| BÈ 5A | 87,3 | 9 | 40 | 26 | 14 | 0 |
| BÈ 6 | 41,9 | 16 | 14 | 12 | 1 | 1 |
| BÈ 7 | 45,6 | 18 | 14 | 5 | 9 | 0 |
| BÈ 8 | 59,1 | 20 | 31 | 23 | 8 | 0 |
| BÈ 9 | 30,9 | 14 | 6 | 5 | 1 | 0 |

## 3. Đế dùng chung trong từng khe
Mỗi đế dùng chung đặt ở trung điểm hai điểm neo hiện tại của hai dây đối diện (hai dây lệch nhau không quá 12 m dọc khe). Dây không có dây đối diện vẫn dùng đế riêng.

| Khe | Bề rộng khe nhỏ nhất (m) | Dây của hai bè | Đế dùng chung | Đế riêng còn lại | Cạnh đế dùng chung (m) | Nếu cả hai dây cùng căng (m) | Đế riêng hiện nay (m) | Tổ hợp chi phối |
|---|---|---|---|---|---|---|---|---|
| BÈ 1 ↔ BÈ 2 | 22,2 | 2 + 2 | 2 | 0 | 2,50–2,50 | 2,50–2,50 | 2,50–2,50 | BÈ 1 căng, BÈ 2 chùng (MNLKT) |
| BÈ 2 ↔ BÈ 3 | 13,1 | 3 + 2 | 2 | 1 | 2,50–2,50 | 2,50–2,50 | 2,50–2,50 | BÈ 3 căng, BÈ 2 chùng (MNLKT) |
| BÈ 3 ↔ BÈ 3A | 15,1 | 5 + 4 | 4 | 1 | 2,50–3,00 | 2,50–3,00 | 2,50–2,75 | BÈ 3A căng, BÈ 3 chùng (MNLKT) |
| BÈ 3A ↔ BÈ 5A | 41,9 | 10 + 10 | 10 | 0 | 2,75–2,75 | 2,75–2,75 | 2,75–2,75 | BÈ 5A căng, BÈ 3A chùng (MNLKT) |
| BÈ 3A ↔ BÈ 7 | 28,2 | 5 + 6 | 5 | 1 | 2,50–2,75 | 2,50–2,75 | 2,50–2,50 | BÈ 3A căng, BÈ 7 chùng (MNLKT) |
| BÈ 5A ↔ BÈ 6 | 38,8 | 4 + 1 | 1 | 3 | 2,50–2,75 | 2,50–2,75 | 2,75–2,75 | BÈ 5A căng, BÈ 6 chùng (MNLKT) |
| BÈ 7 ↔ BÈ 8 | 22,6 | 3 + 5 | 2 | 4 | 2,50–2,50 | 2,50–2,50 | 2,50–2,50 | BÈ 8 căng, một dây (MNLKT) |
| BÈ 8 ↔ BÈ 9 | 22,6 | 3 + 1 | 1 | 2 | 2,50–2,50 | 2,50–2,50 | 2,50–2,50 | BÈ 8 căng, BÈ 9 chùng (MNLKT) |

## 4. Tổng hợp
| | Hiện tại | Theo chỉ đạo mới |
|---|---|---|
| Điểm neo bờ (cọc khoan nhồi) | 129 | **225** (+96) |
| Đế neo đáy | 163 | **40** = 27 đế dùng chung + 12 đế riêng trong khe + 1 đế ở mặt nước trống |
| Tuyến cáp | 292 | 292 (không đổi) |

Bê tông các đế trong khe: 107,0 m³ (109,7 m³ nếu thiết kế cho trường hợp cả hai dây cùng căng).

## 5. Dùng chung được không — cơ học
- **Được**, với điều kiện đế có hai tai neo (hoặc tai neo đôi) và được kiểm tra theo các tổ hợp dưới đây.
- Khi gió thổi ngang khe, bè phía đầu gió trôi về phía khe nên dây của nó chùng; bè phía cuối gió trôi ra xa nên dây của nó căng. Hai dây **không căng cực đại cùng lúc**. Tổ hợp thiết kế: một dây ở lực cực đại, dây kia ở lực căng trước 5 kN, ở cả hai mực nước.
- Dây chùng kéo ngược lại nên lực trượt giảm một ít; nhưng lực nhổ **cộng thêm** phần đứng của dây chùng. Vì vậy đế dùng chung không nhỏ hơn đế riêng — lợi ích là **số lượng đế**, không phải kích thước.
- Cột "nếu cả hai dây cùng căng" là bao an toàn (ví dụ gió xiên, hoặc dây chùng bị căng do bè lệch): lực ngang triệt tiêu, lực nhổ gấp đôi. Nên dùng cột này nếu chưa có mô hình phân bố lực.
- Khe càng hẹp thì dây càng dốc khi nước cao, lực nhổ càng lớn: các khe hẹp nhất cho đế lớn nhất.

## 6. Giới hạn — phải đọc
- Vị trí cọc bờ mới lấy theo địa hình IFC; chưa kiểm tra đường tiếp cận của máy khoan, chưa kiểm tra dây mới có cắt dây khác không. Phải chạy lại `planMooringLayoutV2.mjs` (sau khi sửa quy tắc) mới có mặt bằng thật.
- Dây ra bờ dài hơn dây đáy cũ: độ chùng / độ trôi bè khi mực nước đổi 6 m chưa kiểm tra.
- Tai neo đôi, chọc thủng bản đế tại tai neo và xoắn đế khi hai dây lệch nhau **chưa thiết kế**.
- Đế dùng chung nối cơ học hai bè: sự cố ở một bè (đứt dây, trôi) truyền sang đế của bè kia.
- Các ngưỡng ở mục 1 là giả định của người lập; đổi ngưỡng thì số lượng đổi theo.
