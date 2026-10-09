# GIAO VIỆC: BIẾN 100% ĐẾ NEO ĐÁY THÀNH ĐẾ DÙNG CHUNG (GHÉP CẶP 3 ĐẾ ĐƠN CÒN LẠI)

Chào Claude,

Người dùng vừa kiểm tra bản vẽ CAD và hình ảnh mặt bằng neo 9 bè và chỉ ra 3 vị trí đế neo đáy còn đang neo đơn 1 bè (kèm ảnh khoanh tròn):
- **Ảnh 1:** Khe giữa Bè 2 và Bè 3 — Đế `HV-DV003` (B2-D12) đang neo đơn 1 bè Bè 2.
- **Ảnh 2:** Khe giữa Bè 5A và Bè 6 — Đế `HV-DV026` (B5A-D14) đang neo đơn 1 bè Bè 5A.
- **Ảnh 3:** Khe giữa Bè 7 và Bè 8 — Đế `HV-DV031` (B8-D30) đang neo đơn 1 bè Bè 8.

### Ý kiến chỉ đạo của người dùng:
> *"có một số chỗ b bảo claude kiểm tra lại giúp t sao ko nối luôn vào bè còn lại mà để neo 1 bè thôi. Đoạn nào neo đế giữa 2 đáy dùng chung đc thì cứ cho dùng chung. cho nó an toàn. bảo claude tính toán lại dựa trên các thắc mắc này của t đi"*

---

## 1. NGUYÊN NHÂN KỸ THUẬT VÌ SAO TRƯỚC ĐÓ CÒN 3 ĐẾ ĐƠN
Thuật toán trước đó trong `scripts/planMooringLayoutV2.mjs` (Step 2d) chỉ ghép đôi các tuyến cáp có sẵn theo tỉ lệ 1:1. Do số lượng dây neo nguyên bản ở các cạnh đối diện bị lệch số lẻ:
1. Khe B2 ↔ B3: B2 có 3 dây hướng sang (`B2-D12, B2-D17, B2-D18`), B3 chỉ có 2 dây (`B3-D13, B3-D17`) $\rightarrow$ Dư lẻ `B2-D12`.
2. Khe B5A ↔ B6: B5A có 3 dây hướng sang (`B5A-D13, B5A-D14, B5A-D15`), B6 chỉ có 2 dây (`B6-D17, B6-D27`) $\rightarrow$ Dư lẻ `B5A-D14`.
3. Khe B8 ↔ B7: B8 có 4 dây hướng sang (`B8-D29, B8-D30, B8-D31, B8-D32`), B7 chỉ có 3 dây (`B7-D25, B7-D20, B7-D24`) $\rightarrow$ Dư lẻ `B8-D30`.

---

## 2. YÊU CẦU TRIỂN KHAI

Bổ sung 3 tuyến cáp mới trên mép các bè đối diện để nối vào 3 đế neo đáy nói trên, đưa toàn bộ hệ neo đáy đạt **100% ĐẾ DÙNG CHUNG (32/32 ĐẾ DÙNG CHUNG, 0 ĐẾ ĐƠN)**:

### 2.1. Khe Bè 2 ↔ Bè 3 (Đế HV-DV003)
- Bổ sung 1 cleat và 1 tuyến cáp trên mép Tây Bắc của **BÈ 3** (nằm giữa khoảng `B3-D17` và `B3-D13`).
- Nối tuyến cáp mới này vào đế `HV-DV003` (cùng với `B2-D12`).
- Nắn/cân bằng vị trí đế `HV-DV003` về tim khe giữa Bè 2 và Bè 3 để cân bằng lực kéo 2 chiều.

### 2.2. Khe Bè 5A ↔ Bè 6 (Đế HV-DV026)
- Bổ sung 1 cleat và 1 tuyến cáp trên mép Nam của **BÈ 6** (nằm giữa khoảng `B6-D17` và `B6-D27`, khoảng $x \approx 355 \div 365\text{ m}, y \approx -54 \div -56\text{ m}$).
- Nối tuyến cáp mới này vào đế `HV-DV026` (cùng với `B5A-D14`).
- Cân bằng vị trí đế `HV-DV026` về tim khe giữa Bè 5A và Bè 6.

### 2.3. Khe Bè 7 ↔ Bè 8 (Đế HV-DV031)
- Bổ sung 1 cleat và 1 tuyến cáp trên mép Bắc của **BÈ 7** (trên cạnh $y = 79.19\text{ m}$, khoảng trống $26\text{ m}$ giữa `B7-D25` tại $x=86.85$ và `B7-D20` tại $x=112.85$, đặt cleat tại $x \approx 95 \div 100\text{ m}$).
- Nối tuyến cáp mới này vào đế `HV-DV031` (cùng với `B8-D30`).
- Cân bằng vị trí đế `HV-DV031` về tim khe giữa Bè 7 và Bè 8.

---

## 3. CÁC TIÊU CHÍ KỸ THUẬT & KIỂM TRA BẮT BUỘC
1. **Tổng số tuyến cáp:** Tăng từ 292 lên **295 tuyến cáp**.
2. **Tổng số điểm neo:** Giữ nguyên **263 điểm neo** = **231 cọc khoan nhồi bờ D350** + **32 đế neo đáy vít xoắn (100% DÙNG CHUNG)**.
3. **Ràng buộc hình học:**
   - Đảm bảo C9, G1..G4: Không chồng chéo cáp, cự ly cọc $\ge 7\text{ m}$ giữa 2 đế đáy, khoảng cách mép bè $\ge 5\text{ m}$.
4. **Kiểm tra an toàn chịu lực:**
   - Chạy kịch bản tính toán kiểm tra chịu lực (nhổ, trượt ngang, nén lún) cho cả 3 đế mới ghép chung.
   - Kích thước đế dự kiến $2,5 \times 2,5 \times 0,4\text{ m}$ hoặc $2,75 \times 2,75 \times 0,4\text{ m}$.
5. **Cập nhật dữ liệu & Bản vẽ:**
   - Cập nhật `src/data/huoiVanhCoordinates_v2.json` và `src/data/huoiVanhPiles_v2.json`.
   - Xuất lại bản vẽ DXF/DWG vào `docs/mat-bang-neo-9-be/HOHUOIVANH_MAT_BANG_NEO_9_BE_PA3_DE_VIT.dwg` và `.dxf`.
   - Cập nhật bảng thống kê Excel `docs/mat-bang-neo-9-be/HOHUOIVANH_BANG_THONG_KE_NEO_9_BE_PA3_DE_VIT.xlsx`.
6. **Kiểm thử:**
   - Chạy `npm run test` (toàn bộ tests pass).
   - Chạy `npm run build` (build sạch không lỗi).
   - Báo cáo lại kết quả chi tiết để Antigravity review và đẩy lên GitHub.
