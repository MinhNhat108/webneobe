# BÈ 1 — Bố trí và kiểm tra ống hộp 40×60 đặt ngang trên dầm C52

Sinh bởi `scripts/planRaft1Tubes.mjs` từ bản vẽ `be_pin_1.dxf`. Bản vẽ kèm theo: `be1_ong_40x60.dxf` (mm, cùng hệ tọa độ với bản vẽ gốc).

## 1. Số liệu đọc từ bản vẽ
- 78 dầm C52 chạy ngang qua các hàng phao (bản vẽ đặt tên block là "hOP 40X60", layer S-BEAM), bước xen kẽ 1,1 / 1,4 m, trung bình 1,24 m.
- 24 hàng phao đỡ pin, bước 2 m.
- Kích thước lưới dầm: 95,2 × 46,8 m.

## 2. Tải trọng
- Lực căng thiết kế một tuyến cáp của BÈ 1: **T = 69 kN** (bộ tính toán của dự án, góc nghiêng 12°, V = 30 m/s).
- Hệ số tải trọng 1.2 → lực tính toán **82,8 kN** mỗi tuyến. BÈ 1 có 19 tuyến cáp.

## 3. Sức chịu của cấu kiện
| Cấu kiện | Giá trị | Ghi chú |
|---|---|---|
| Ống 40×60×2 mm | A = 384 mm², W = 6,44 cm³ | Thép Q235 / SS400, f = 210 MPa — **giả định**, bản vẽ không ghi vật liệu và chiều dày |
| Ống chịu kéo dọc trục | 80,6 kN | |
| Ống chịu uốn | 1,35 kNm | |
| Một móc chữ 几 | 7 kN | **GIẢ ĐỊNH**: 2 đai ốc hình thoi × 3,5 kN (trượt trong rãnh C52). Cần số liệu nhà cung cấp |
| Dầm C52 chịu uốn | 0,84 kNm | **GIẢ ĐỊNH** W ≈ 4 cm³ |
| Bu lông M10 chịu cắt (1 mặt cắt) | 9,3 kN | TCVN 5575:2012, cấp bền 4.8 (**giả định**), A_bn = 58 mm², f_vb = 160 MPa |
| Ép mặt bu lông M10 lên thành ống 2 mm | 7,9 kN | f_cb = 395 MPa (thép f_u ≈ 370 MPa). Cả hai đều lớn hơn 3,5 kN/đai ốc: liên kết bị khống chế bởi trượt đai ốc trong rãnh C52, không phải thân bu lông |
| Ống chịu cắt | 27,3 kN | hai thành đứng, f_v = 0,58 f |

## 4. Kết quả kiểm tra
1. **Móc cáp vào MỘT điểm trên ống: KHÔNG ĐẠT.** Ống làm việc như dầm giữa hai dầm C52: M = 29,0 kNm, gấp **21 lần** khả năng chịu uốn 1,35 kNm. Kéo dài ống không giúp được: tải tập trung vẫn dồn vào hai móc gần nhất.
2. **Mỗi tuyến cáp cần 12 móc chữ 几** (82,8 / 7 kN), mỗi móc trên một dầm C52. Cáp phải nối qua dầm phân tải hoặc dây chân vịt 12 nhánh để mỗi móc nhận phần lực bằng nhau (hệ số sử dụng móc 0,99).
3. **Mép dài của bè** (cáp kéo dọc theo dầm C52): mép dưới cần 84 móc, mép trên cần 84 móc, trong khi mỗi mép chỉ có 78 dầm C52. Một hàng móc không đủ chỗ: 5 tuyến (B1-D01, B1-D02, B1-D05, B1-D11, B1-D14) phải đặt ống neo lùi vào hàng phao thứ hai, vì hai tuyến cạnh nhau không được dùng chung móc.
4. **Hai đầu hồi** (cáp kéo dọc theo ống): một ống chịu kéo được 80,6 kN < 82,8 kN → **2 ống mỗi tuyến** (hệ số sử dụng 0,51). Ở đây mỗi móc đẩy ngang dầm C52 tại vị trí cách hàng phao 0.3 m; dầm C52 chịu uốn chỉ cho phép **3,3 kN mỗi móc**, nên mỗi tuyến đầu hồi cần **26 móc**. (Đặt móc giữa hai hàng phao thì dầm C52 bị uốn 3,50 kNm > 0,84 kNm.)

## 5. Bố trí
- **Ống neo** (layer `09_ONG_40X60_NEO`): 24 thanh, 348,2 m, có móc chữ 几 tại mọi dầm C52 nó đi qua.
- **Ống giằng** (layer `09_ONG_40X60_GIANG`): 9 tuyến chạy suốt bè, cách nhau 6 m (mỗi 3 hàng phao) và ở hai hàng biên, 823,6 m, bắt 1 bu lông M10×120 tại mỗi dầm C52.
- Mọi ống đặt cách tim hàng phao 0.3 m, nơi dầm C52 được phao đỡ.

| Tuyến cáp | Loại | Mép bè | Số móc |
|---|---|---|---|
| B1-D01 | bờ | trên (dài) | 12 |
| B1-D02 | bờ | trên (dài) | 12 |
| B1-D03 | bờ | trên (dài) | 12 |
| B1-D04 | bờ | trên (dài) | 12 |
| B1-D05 | bờ | trên (dài) | 12 |
| B1-D06 | bờ | trên (dài) | 12 |
| B1-D07 | đáy | trên (dài) | 12 |
| B1-D08 | đáy | đầu hồi phải | 26 |
| B1-D09 | đáy | đầu hồi phải | 26 |
| B1-D10 | đáy | đầu hồi phải | 26 |
| B1-D11 | bờ | dưới (dài) | 12 |
| B1-D12 | bờ | dưới (dài) | 12 |
| B1-D13 | bờ | dưới (dài) | 12 |
| B1-D14 | bờ | dưới (dài) | 12 |
| B1-D15 | bờ | dưới (dài) | 12 |
| B1-D16 | bờ | dưới (dài) | 12 |
| B1-D17 | bờ | dưới (dài) | 12 |
| B1-D18 | bờ | đầu hồi trái | 26 |
| B1-D19 | đáy | đầu hồi trái | 26 |

## 6. Bảng vật tư BÈ 1
| Vật tư | Số lượng |
|---|---|
| Ống hộp 40×60×2 | 1.171,8 m ≈ 206 cây 6 m (gồm 5 % hao hụt) |
| Móc kẹp chữ 几 | 298 cái |
| Bu lông lục giác M10×120 | 820 bộ |
| Bu lông đai ốc hình thoi M10×30 | 596 bộ |

## 7. Giới hạn — phải đọc trước khi dùng
- Sức chịu của móc chữ 几, của dầm C52 và vật liệu ống là **giả định**. Mọi con số ở mục 4–6 tỷ lệ theo sức chịu của móc: nếu nhà cung cấp cho 14 kN/móc thì số móc mỗi tuyến giảm còn một nửa.
- Chưa kiểm tra: tai phao HDPE, liên kết dầm C52 với phao, dầm phân tải / dây chân vịt, mối nối ống, độ bền mỏi do sóng.
- Vị trí 19 điểm neo được quy đổi từ mặt bằng tổng thể (hệ tọa độ công trình, bè xoay 36°) sang bản vẽ bè theo tỷ lệ dọc hai cạnh; sai số cỡ 1–2 m dọc mép, không ảnh hưởng số lượng.
- Đây là phương án đề xuất. Nhà cung cấp hệ phao phải xác nhận trước khi thi công.
