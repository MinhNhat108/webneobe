# GIAO VIỆC: ĐIỀU CHỈNH PHƯƠNG ÁN 2 THÀNH BÀI TOÁN KỸ THUẬT THUẦN TÚY (BỎ TOÀN BỘ TÍNH TOÁN TIỀN TỆ)

Chào Claude,

Người dùng vừa phản hồi rõ ràng về định hướng của Phương Án 2:
> **"Bỏ các tính toán về tiền đi, ở đây t đang muốn tính toán về kỹ thuật thôi, cái này m hiểu là m làm một bài toán với các bè pin kia nhưng thay từ cọc đóng lòng hồ thành neo đáy bằng cục bê tông. Lên kế hoạch lại đi và giao cho claude làm."**

Yêu cầu cốt lõi:
1. **Loại bỏ 100% các yếu tố tiền tệ, đơn giá, chi phí, tỷ VNĐ, tiền ca máy, v.v.** Không để bất kỳ chữ nào về giá cả hay tiền bạc trong giao diện và code.
2. **Xem Phương Án 2 như một bài toán kỹ thuật cơ học thủy công hoàn chỉnh**: Người dùng muốn kiểm toán kỹ thuật một hệ thống neo mà 175 điểm neo đáy lòng hồ được thiết kế bằng **Khối bê tông trọng lực (Deadweight Sinker Block)** thay cho cọc đóng.

---

## 1. LOẠI BỎ TOÀN BỘ TÍNH TOÁN VỀ TIỀN
- Trong `src/lib/calc/optionComparison.ts`: Bỏ toàn bộ các trường `_vnd`, `price`, `costInputs`, `DEFAULT_COST_INPUTS`, `CostBreakdown`, `cheaper`.
- Đổi tên thành module so sánh kỹ thuật: `technicalComparison.ts` (hoặc giữ file nhưng chỉ so sánh các đại lượng kỹ thuật).
- Trong `src/components/results/OptionComparisonView.tsx`:
  - Đổi tiêu đề thành: **"So Sánh Kỹ Thuật Hai Phương Án Neo Đáy Hồ: PA1 (Cọc Đóng BTCT) & PA2 (Khối Bê Tông Neo Đáy)"**.
  - Bỏ toàn bộ bảng đơn giá vật liệu/ca máy (`PRICE_FIELDS`), bỏ các số tiền tỷ VNĐ, bỏ thanh so sánh chi phí.
  - Thay vào đó là **Bảng Thông Số Kỹ Thuật Đầu Vào của Khối Bê Tông**:
    - Hệ số ma sát bùn đáy $\mu$ (mặc định 0.35).
    - Hệ số an toàn trượt yêu cầu $SF_{slide}$ (mặc định 1.5).
    - Hệ số an toàn nhấc bổng yêu cầu $SF_{uplift}$ (mặc định 1.5).
    - Sức chịu tải cho phép của nền bùn đáy hồ $q_{allow}$ (mặc định 40 kPa).
    - Khối lượng riêng bê tông $\rho_c$ (2.4 t/m³).

---

## 2. BÀI TOÁN KỸ THUẬT HOÀN CHỈNH CHO PHƯƠNG ÁN 2

Khi người dùng chọn **Phương Án 2 (Neo Khối Bê Tông)**:
1. **Kiểm toán Tiêu chuẩn Kỹ thuật (Tab 4 - Kết Quả & Kiểm Tra)**:
   - 129 cọc bờ vẫn kiểm tra sức chịu tải Broms cọc bờ (**BP-1, BP-2**).
   - 175 điểm neo đáy hồ chuyển sang kiểm toán theo bộ tiêu chí ổn định của khối bê tông trọng lực:
     - **DW-1 (Ổn định chống trượt đáy)**: $SF_{slide} = \frac{\mu (W_{sub} - V)}{H} \ge 1.5$ (Hiển thị giá trị tính, ngưỡng $\ge 1.5$, ĐẠT / KHÔNG ĐẠT).
     - **DW-2 (Ổn định chống nhấc bổng)**: $SF_{uplift} = \frac{W_{sub}}{V} \ge 1.5$ (ĐẠT / KHÔNG ĐẠT).
     - **DW-3 (Ổn định chống lật)**: $SF_{overturn} = \frac{W_{net} \cdot (L/2)}{H \cdot H_{block}} \ge 1.5$ (ĐẠT / KHÔNG ĐẠT).
     - **DW-4 (Áp lực tiếp xúc nền bùn)**: $q_{contact} = \frac{W_{sub} - V}{L \cdot W} \le q_{allow}$ (kPa).
   - Các kiểm toán cọc đáy Broms (BP-3, BP-4, BP-5) ghi chú là "Không áp dụng (dùng khối bê tông trọng lực)".

2. **Thuyết minh Kỹ thuật (Tab 6 - Báo Cáo Kỹ Thuật)**:
   - Khi ở PA2: Phần tính toán neo đáy hồ thể hiện rõ công thức cơ học thủy công:
     - Lực kéo ngang $H$, lực kéo đứng $V$ tại đáy hồ.
     - Trọng lượng nổi $W_{sub}$, trọng lượng khô $W_{air}$ của khối bê tông.
     - Kích thước khối hộp $L \times W \times H$, diện tích đáy, thể tích bê tông.
     - Bảng kiểm toán an toàn (chống trượt, chống nhấc, chống lật, áp lực nền bùn).
   - Không chứa bất kỳ thông tin nào về tiền tệ.

3. **Bảng So Sánh Kỹ Thuật Đối Đầu (Tab 9)**:
   - So sánh trực diện các thông số kỹ thuật cốt lõi:
     - **Cơ chế làm việc:** Cọc ngàm đất sâu (chịu lực ngang qua tương tác đất - cọc Broms) vs Khối bê tông (chịu lực qua ma sát đáy và trọng lượng bản thân).
     - **Tổng thể tích bê tông:** PA1 ($\approx 396\text{ m}^3$ cọc đáy) vs PA2 ($\approx 6.550\text{ m}^3$ khối bê tông $\rightarrow$ gấp 16.5 lần).
     - **Kích thước một điểm neo:** Cọc $0.35 \div 0.60$ m vs Khối hộp $3.5 \div 5.0$ m mỗi chiều.
     - **Trọng lượng một điểm neo:** Cọc $2.5 \div 8$ tấn vs Khối bê tông $52 \div 158$ tấn.
     - **Ổn định chuyển vị bè:** PA1 chuyển vị chân neo $\approx 0$ (cọc ngàm cứng); PA2 có nguy cơ trượt lết tích lũy khi gặp bão giật vượt ngưỡng.
     - **Không gian chiếm dụng khe hẹp giữa các bè:** PA1 cọc chiếm diện tích $< 0.36\text{ m}^2$; PA2 khối hộp chiếm $15 \div 25\text{ m}^2$ đáy hồ, có nguy cơ chiếm hết khoảng lưu thông của khe hẹp $12 \div 20$ m.
     - **Ma trận đánh giá rủi ro kỹ thuật địa chất & thủy công.**

4. **Mô phỏng 3D (Tab 8)**:
   - Giữ nguyên hiển thị 3D xuất sắc của bạn (khối hộp bê tông trên đáy hồ khi chọn PA2).
   - Đảm bảo Inspector khi click vào khối bê tông chỉ hiện thuần túy thông số kỹ thuật (Kích thước $L \times W \times H$, Thể tích, Trọng lượng $W_{air}, W_{sub}$, $SF_{slide}, SF_{uplift}, SF_{overturn}, q_{contact}$).

---

## 3. KIỂM THỬ
- Cập nhật test suite để kiểm tra tính toàn vẹn kỹ thuật của PA2 và bảng so sánh kỹ thuật (bỏ các assert về `_vnd`).
- Đảm bảo 100% test PASS và `npm run build` sạch.

Claude triển khai điều chỉnh nhé! Cảm ơn bạn.
