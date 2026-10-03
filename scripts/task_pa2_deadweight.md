# GIAO VIỆC: TRIỂN KHAI PHƯƠNG ÁN 2 (KHỐI BÊ TÔNG NEO ĐÁY LÒNG HỒ) SONG SONG VỚI PHƯƠNG ÁN 1 (CỌC ĐÓNG BTCT) & MODULE PHÂN TÍCH SO SÁNH KINH TẾ CHO CHỦ ĐẦU TƯ

Chào Claude,

Người dùng yêu cầu bổ sung **Phương Án 2 (Khối bê tông neo đáy lòng hồ)** song song với **Phương Án 1 (Cọc đóng BTCT hiện tại)** để Chủ Đầu Tư (CĐT) có cơ sở đối chiếu, phân tích và nhìn thấy rõ ràng phương án nào có lợi hơn về mặt kinh tế và kỹ thuật.
Yêu cầu: **Phương án 1 (cọc đóng) giữ nguyên 100%, bổ sung thêm Phương án 2 và bảng so sánh phương án.**

---

## 1. BẢN CHẤT KỸ THUẬT CỦA 2 PHƯƠNG ÁN

- **PHƯƠNG ÁN 1 (Thiết kế cơ sở - Khuyến nghị):**
  - **129 cọc bờ:** Cọc vuông BTCT ($0.45 \div 0.60$ m, $L_{tk} = 6.5 \div 8.5$ m) cắm sườn đồi.
  - **175 cọc đáy hồ:** Cọc vuông BTCT ($0.35 \div 0.60$ m, $L_{tk} = 8.0 \div 12.5$ m) đóng ngàm sâu vào nền đất đáy hồ.
  - Tổng cộng: **304 cọc vuông BTCT**. Toàn bộ logic hiện tại giữ nguyên không đổi.

- **PHƯƠNG ÁN 2 (Phương án so sánh kinh tế kỹ thuật):**
  - **129 cọc bờ:** **GIỮ NGUYÊN là cọc vuông BTCT** (do bờ hồ dốc $20^\circ \div 40^\circ$, không thể đặt khối bê tông vì sẽ bị trượt lăn xuống lòng hồ).
  - **175 điểm neo đáy hồ:** Thay toàn bộ bằng **Khối bê tông trọng lực (Deadweight Sinker Block)** thả chìm đặt tựa trên mặt bùn đáy lòng hồ.

---

## 2. ENGINE TÍNH TOÁN KỸ THUẬT KHỐI BÊ TÔNG NEO ĐÁY (`deadweight.ts` hoặc tích hợp vào engine)

Với mỗi cụm bè (BÈ 1 đến BÈ 12), từ lực căng thiết kế cáp đáy $T_{max}$ và góc nghiêng cáp $\alpha_{bed}$:
1. **Phân rã lực tác dụng lên khối bê tông:**
   - Lực kéo ngang: $H = T_{max} \cdot \cos\alpha_{bed}$
   - Lực kéo nhổ đứng: $V = T_{max} \cdot \sin\alpha_{bed}$
2. **Quy đổi trọng lượng trong nước:**
   - Khối lượng riêng bê tông: $\rho_{bt} = 2.4\text{ T/m}^3$; nước: $\rho_n = 1.0\text{ T/m}^3$.
   - Trọng lượng chìm: $W_{sub} = W_{air} \cdot (1 - \rho_n / \rho_{bt}) = 0.5833 \cdot W_{air}$ (kN hoặc tấn).
3. **Điều kiện kiểm tra an toàn theo tiêu chuẩn FPV / DNV-ST-0119 / API RP 2SK:**
   - **Chống nhấc bổng (Uplift check, $SF_{uplift} \ge 1.5$):**
     $$W_{sub} \ge 1.5 \cdot V \implies W_{air,uplift} \ge \frac{1.5 \cdot V}{0.5833 \cdot g}$$
   - **Chống trượt lết trên bùn đáy hồ (Sliding check, $SF_{slide} \ge 1.5$, hệ số ma sát bùn đáy $\mu = 0.35$):**
     $$R_{slide} = \mu \cdot (W_{sub} - V) \ge 1.5 \cdot H \implies W_{sub} \ge \frac{1.5 \cdot H}{\mu} + V$$
     $$W_{air,slide} \ge \frac{W_{sub}}{0.5833 \cdot g}$$
4. **Xác định khối lượng và kích thước khối bê tông:**
   - Trọng lượng thiết kế chọn cho mỗi khối: $W_{block} = \max(W_{air,uplift}, W_{air,slide})$ (tấn), làm tròn lên bước $0.5$ tấn.
   - Thể tích khối bê tông: $V_{bt} = W_{block} / 2.4$ (m³).
   - Kích thước hình học khối hộp: $L \times W \times H$ (dạng khối hộp dẹp đế rộng, ví dụ $L = W = 1.4 \times H$ để chống lật).
   - Xuất bảng kích thước & khối lượng chi tiết cho 12 cụm bè (bè nhỏ $15 \div 20\text{ T}$, bè lớn như BÈ 5 lên tới $35 \div 42\text{ T}$).

---

## 3. ENGINE & BẢNG SO SÁNH KINH TẾ (COST ANALYSIS ENGINE)

Xây dựng module tính toán so sánh chi phí chi tiết giữa 2 phương án:
1. **Đơn giá định mức tham chiếu chuẩn thủy công (VNĐ):**
   - Bê tông mác B25 (bao gồm vật liệu + đổ đúc): $1.800.000\text{ đ/m}^3$.
   - Cốt thép (CB300/CB400): $18.000\text{ đ/kg}$ (PA1 cọc đóng cần $\sim 130\text{ kg/m}^3$ thép chịu uốn; PA2 khối bê tông chỉ cần $\sim 50\text{ kg/m}^3$ thép cấu tạo lưới & móc cẩu).
   - Ván khuôn: $150.000\text{ đ/m}^2$.
   - **Ca máy & biện pháp thi công thủy công mặt nước:**
     - **PA1 (Cọc đóng):** Sà lan búa rung đóng cọc thông dụng: $\sim 3.500.000\text{ đ/cọc}$ (175 cọc $\times 3.5\text{ tr} \approx 612.5\text{ triệu}$).
     - **PA2 (Khối bê tông chìm):** Cần cẩu nổi siêu trọng $40 \div 50\text{ tấn}$ vận chuyển và thả định vị khối $20 \div 40\text{ tấn}$ chìm đáy hồ, ca máy lớn, định vị thủy âm/thợ lặn: $\sim 25.000.000\text{ đ/khối}$ (175 khối $\times 25\text{ tr} \approx 4.375\text{ tỷ}$).
2. **Bảng so sánh đối đầu trực diện (Head-to-Head Comparison):**
   - Tổng thể tích bê tông: PA1 ($\approx 250\text{ m}^3$) vs PA2 ($\approx 2.000 \div 2.500\text{ m}^3$).
   - Tổng khối lượng cốt thép (tấn).
   - Tổng chi phí vật tư & đúc sẵn.
   - Tổng chi phí thi công mặt nước.
   - **TỔNG MỨC ĐẦU TƯ (VNĐ) & MỨC TIẾT KIỆM (DELTA):** Làm nổi bật rõ ràng phương án cọc đóng tiết kiệm $\approx 8 \div 12\text{ TỶ ĐỒNG}$ cho Chủ Đầu Tư!
3. **Bảng phân tích rủi ro kỹ thuật (Risk Assessment Matrix):**
   - Tiêu chí: Chống trôi bè trong bão, Kiểm soát độ lún bùn, Chiếm chỗ khe bè hẹp, Độ bền 25 năm, Khả năng nghiệm thu theo TCVN.

---

## 4. TÍCH HỢP GIAO DIỆN NGƯỜI DÙNG (UI/UX)

1. **Thanh chọn Phương Án (Store & Header):**
   - Trong `useProjectStore`: thêm `mooringOption: 'PA1_PILE' | 'PA2_DEADWEIGHT'` (mặc định `'PA1_PILE'`).
   - Trên Header / thanh công cụ: Nút chuyển đổi rõ ràng giữa:
     - `[ 🟢 Phương Án 1: Cọc Đóng BTCT (Khuyến Nghị) ]`
     - `[ 🟡 Phương Án 2: Khối Bê Tông Neo Đáy (So Sánh) ]`
2. **Giao diện So Sánh Kinh Tế - Kỹ Thuật:**
   - Hiển thị bảng tổng hợp so sánh 2 phương án đối chiếu rõ ràng: Khối lượng, Chi phí, Đánh giá rủi ro.
   - Biểu đồ trực quan (hoặc thanh so sánh tỷ lệ) thể hiện chênh lệch chi phí.
3. **Cập nhật Mô phỏng 3D (Tab 8):**
   - Khi chọn **Phương Án 2**:
     - 175 cọc đáy hồ được hiển thị thành các **khối hộp bê tông trọng lực (3D Box Mesh / Sinker)** đặt trên mặt bùn lòng hồ (kích thước $L \times W \times H$ đúng theo tính toán của bè đó), thay vì cọc dài cắm sâu.
     - Khi nhấp chuột vào khối bê tông: Inspector hiển thị thông tin: *Khối bê tông neo đáy (BÈ X), Kích thước, Trọng lượng W (tấn), $SF_{slide}$, $SF_{uplift}$, Kết luận*.
   - Khi chọn **Phương Án 1**: hiển thị cọc đóng như bình thường.
4. **Báo cáo Kỹ thuật (Tab 6):**
   - Bổ sung mục tóm tắt phân tích so sánh kinh tế kỹ thuật giữa 2 phương án để CĐT đưa vào hồ sơ duyệt dự án.

---

## 5. YÊU CẦU KIỂM THỬ
- Viết bài test cho phần tính toán khối bê tông và so sánh kinh tế (`deadweight.test.ts` hoặc tương đương).
- Toàn bộ 136 bài test hiện có phải tiếp tục PASS 100%.
- `npm run build` thành công không cảnh báo lỗi.

Nhờ Claude triển khai gói tính năng quan trọng này nhé! Cảm ơn bạn.
