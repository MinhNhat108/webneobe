# GIAO VIỆC: TÍNH TOÁN ĐỒNG NHẤT CỌC VUÔNG 300x300 HOẶC 350x350 (TĂNG CHIỀU DÀI CỌC & TĂNG HÀM LƯỢNG CỐT THÉP)

Chào Claude,

Người dùng vừa ra chỉ đạo dứt khoát về giải pháp kết cấu:
> **"bảo claude là t chỉ dùng cọc 300x300 hoặc 350x350 thôi, còn lại chiều dài cọc thì m có thể tăng lên, nếu mô men uốn cao thì có thể tăng hàm lượng cốt thép cọc mà. bảo claude tính toán lại giúp t"**

Chỉ đạo này đã mở khóa nút thắt kỹ thuật quan trọng nhất: Trước đây engine đang kiểm tra cọc với giả thiết bê tông không có cốt thép (`As = 0`), nên cọc bị khống chế bởi khả năng chịu uốn thuần bê tông ($0.9 \cdot R_b \cdot W$). Khi người dùng cho phép **tăng hàm lượng cốt thép cọc** ($A_s$) và **tăng chiều dài cọc đóng** ($L_{tk}$), bài toán cơ học Broms hoàn toàn có thể giải quyết được!

Dưới đây là các yêu cầu tính toán và triển khai cụ thể:

---

## 1. NGUYÊN TẮC TÍNH TOÁN CƠ HỌC VÀ CỐT THÉP CỌC

1. **Khả năng chịu uốn có cốt thép ($M_{rd}$)**:
   - Áp dụng công thức chịu uốn của cọc vuông BTCT có xét đến cốt thép dọc:
     $$M_{rd} = M_{rd, bê tông} + M_{rd, thép}$$
     hoặc theo TCVN 5574:2018:
     $$M_{rd} = R_s \cdot A_{st} \cdot (h_0 - a')$$
     với thép CB400-V ($R_s = 350\text{ MPa}$, $f_y = 400\text{ MPa}$) hoặc CB300-V ($R_s = 260\text{ MPa}$).
   - Kích thước tiết diện:
     - **Cọc $350 \times 350\text{ mm}$**: Bố trí 4 thanh đến 8 thanh (ví dụ $4\Phi 20$, $4\Phi 22$, $8\Phi 20$, hoặc $8\Phi 22$, $A_s = 1.256 \div 3.041\text{ mm}^2$, hàm lượng thép $\mu = 1.0\% \div 2.5\%$).
     - **Cọc $300 \times 300\text{ mm}$**: Bố trí 4 thanh đến 8 thanh (ví dụ $4\Phi 18$, $4\Phi 20$, $8\Phi 18$, hoặc $8\Phi 20$, $A_s = 1.018 \div 2.513\text{ mm}^2$, hàm lượng thép $\mu = 1.1\% \div 2.8\%$).
2. **Chiều dài cọc đóng ($L_{tk}$)**:
   - Cho phép tăng chiều dài cọc đóng $L_{tk}$ để thỏa mãn sức kháng xô ngang của nền đất (Broms $L_{opt}$) và sức kháng nhổ cọc trong bùn hồ ($V_{uplift}$).
   - Đảm bảo độ mảnh cọc $L/a \le 35 \div 40$ để đảm bảo điều kiện thi công hạ cọc từ sà lan trên mặt nước.

---

## 2. BÀI TOÁN CỤ THỂ CHO 12 CỤM BÈ (GÓC NGHIÊNG 12.0°)

Claude tính toán và lập bảng thiết kế tối ưu cho 12 cụm bè theo 2 phương án:

### PHƯƠNG ÁN 1: ĐỒNG NHẤT TOÀN BỘ CỌC VUÔNG 350x350 mm
- **Cọc neo đáy hồ (175 cọc)**:
  - Tiết diện: $350 \times 350\text{ mm}$.
  - Cốt thép: $4\Phi 20$ hoặc $8\Phi 20$ (CB400-V).
  - Chiều dài $L_{tk}$: Xác định chiều dài cọc đóng cần thiết cho từng bè (khoảng $8.0\text{ m} \div 11.0\text{ m}$).
- **Cọc neo bờ (129 cọc)**:
  - Tiết diện: $350 \times 350\text{ mm}$.
  - Cốt thép: Bố trí thép chịu uốn $4\Phi 22 \div 8\Phi 22$ (CB400-V).
  - Chiều dài $L_{tk}$: $7.0\text{ m} \div 9.0\text{ m}$.
- **Xử lý BÈ 5 ($16.436\text{ m}^2$, $T_{max} = 176.2\text{ kN}$)**:
  - Nếu dùng cọc $350\times 350$ cho BÈ 5:
    - Phương án 5A: Tăng thêm số cọc neo cho Bè 5 (ví dụ từ 39 cọc lên 48-50 cọc, thêm 4 cọc bờ và 6 cọc đáy) để giảm lực căng $T_{max}$ xuống $\le 135\text{ kN}$, khi đó cọc $350\times 350$ đạt 100%!
    - Phương án 5B: Giữ nguyên 39 cọc nhưng dùng cốt thép cường độ cao (8D25 CB500-V) và tăng chiều sâu ngàm cắm đất ($L_{tk} \approx 10.5\text{ m}$ bờ, $15\text{ m}$ đáy).

### PHƯƠNG ÁN 2: ĐỒNG NHẤT TOÀN BỘ CỌC VUÔNG 300x300 mm
- Kiểm tra tính toán tương tự cho cọc $300 \times 300\text{ mm}$ với cốt thép $8\Phi 20$ và chiều dài cọc bờ $8.5 \div 9.5\text{ m}$, cọc đáy $10.0 \div 12.0\text{ m}$.
- Đánh giá khả năng thi công và độ mảnh cọc ($L/a$).

---

## 3. TRIỂN KHAI & ĐỒNG BỘ HỆ THỐNG
1. **Khai báo thông số cốt thép vào catalogue / state**:
   - Bổ sung cấu hình thép cho cọc vào `HUOI_VANH_RAFTS` (hoặc trong `anchor`: `shoreRebarArea_mm2`, `shoreRebarFy_MPa`, `bedRebarArea_mm2`, `bedRebarFy_MPa`).
   - Cập nhật hàm tính toán trong engine để nhận diện số thanh thép, đường kính thép và tính đúng $M_{rd}$.
2. **Giao diện Web**:
   - Tab 2 (Thông số đầu vào): Hiển thị ô chọn/xem cốt thép cọc (số thanh, đường kính $\Phi$, mác thép CB400-V).
   - Tab 6 & Tab 4: Báo cáo kỹ thuật thể hiện rõ kết cấu cọc vuông $350\times 350$ (hoặc $300\times 300$) kèm số thanh cốt thép và kiểm toán uốn ĐẠT.
3. **Bản vẽ CAD & Bảng Excel**:
   - Cập nhật bảng thống kê cọc bờ và cọc đáy theo tiết diện và chiều dài mới.
4. **Kiểm thử**:
   - Đảm bảo 100% test PASS và build sạch.

Claude triển khai tính toán chi tiết và gửi báo cáo nhé! Cảm ơn bạn rất nhiều.
