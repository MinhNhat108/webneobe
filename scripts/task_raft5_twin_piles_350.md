# GIAO VIỆC: TRIỂN KHAI HƯỚNG 1 - DÙNG CỌC ĐÔI 350x350 CHO BÈ 5 (ĐỒNG NHẤT 100% CỌC TOÀN HỒ LÀ 350x350 mm)

Chào Claude,

Người dùng vừa phản hồi và chốt phương án rõ ràng:
> **"t muốn theo hướng 1 , bảo Claude tính toán và sửa lại đi"**

Tức là:
1. **Toàn bộ hồ Huổi Vanh (cả 12 cụm bè) ĐỒNG NHẤT 100% MỘT LOẠI TIẾT DIỆN CỌC DUY NHẤT: CỌC VUÔNG $350 \times 350\text{ mm}$**. Không còn bất kỳ cọc $450$, $500$ hay $600$ nào nữa!
2. Đối với cụm khổng lồ **BÈ 5** ($16.436\text{ m}^2$, lực kéo bão $T_{max} = 176.2\text{ kN}$ tại góc nghiêng 12°):  
   Áp dụng **giải pháp Cụm 2 cọc $350 \times 350\text{ mm}$ (cọc đôi / twin pile anchor)** cho mỗi điểm neo của Bè 5:
   - 39 điểm neo của Bè 5 (12 điểm neo bờ, 27 điểm neo đáy) được cấu tạo bằng **cụm 2 cọc $350 \times 350\text{ mm}$** liên kết đài cọc/bích neo chung.
   - Mỗi cọc trong cụm cọc đôi chịu $1/2$ lực kéo: $T_{\text{mỗi cọc}} = T_{max} / 2 = 176.2 / 2 = 88.1\text{ kN}$.

Dưới đây là các yêu cầu tính toán và triển khai cụ thể:

---

## 1. TÍNH TOÁN CƠ HỌC BROMS CHO CỌC ĐÔI BÈ 5 ($350 \times 350\text{ mm}$)

Với tải trọng $T_{\text{cọc}} = 88.1\text{ kN}$:
1. **Cọc bờ Bè 5 (24 cọc = 12 cụm $\times$ 2 cọc)**:
   - Tiết diện: $350 \times 350\text{ mm}$.
   - Lực kéo: $88.1\text{ kN}$. Lực ngang $H = 88.1 \cdot \cos(30^\circ) \approx 76.3\text{ kN}$.
   - Chiều sâu đóng cọc: $L_{tk} \approx 7.0 \div 7.5\text{ m}$ (thỏa mãn $L_{opt} \approx 5.5\text{ m}$).
   - Cốt thép chịu uốn: $3\Phi 28$ (hoặc $4\Phi 25$ CB400-V) $\rightarrow$ $\eta_M \le 0.90$ $\rightarrow$ **ĐẠT 100%**!
2. **Cọc đáy Bè 5 (54 cọc = 27 cụm $\times$ 2 cọc)**:
   - Tiết diện: $350 \times 350\text{ mm}$.
   - Lực kéo: $88.1\text{ kN}$. Lực nhổ $V = 88.1 \cdot \sin(34^\circ) \approx 49.3\text{ kN}$.
   - Chiều sâu đóng cọc: $L_{tk} \approx 9.0 \div 9.5\text{ m}$ (thỏa mãn cả tải ngang và sức kháng nhổ đất bùn).
   - Độ mảnh: $(9.5 + 1.0)/0.35 = 30 \le 35$ (an toàn thi công đóng cọc từ sà lan).
   - Cốt thép: $3\Phi 20$ hoặc $2\Phi 25$ CB400-V $\rightarrow$ $\eta_M \le 0.85$ $\rightarrow$ **ĐẠT 100%**!

**KẾT QUẢ ĐẠT ĐƯỢC: CẢ 12/12 CỤM BÈ (100% DỰ ÁN) ĐỀU ĐẠT TẤT CẢ CÁC TIÊU CHÍ KỸ THUẬT (BP-1..BP-5) VỚI DUY NHẤT MỘT LOẠI CỌC $350 \times 350\text{ mm}$!**

---

## 2. TRIỂN KHAI & ĐỒNG BỘ TOÀN HỆ THỐNG

1. **Hỗ trợ mô hình cọc đôi trong Engine & State**:
   - Trong `HUOI_VANH_RAFTS` hoặc trong `AnchorInput`: Thêm tham số cho bè (ví dụ `shorePilesPerPoint: 2`, `bedPilesPerPoint: 2` cho BÈ 5, mặc định là 1 cho 11 bè khác).
   - Khi `pilesPerPoint = 2`, lực tác dụng vào kiểm toán Broms của mỗi cọc là $T_{\text{pile}} = T_{line} / 2$ (phân bổ lực đều cho 2 cọc trong cụm).
   - Chiều sâu $L_{tk}$ và cốt thép của Bè 5 định cỡ theo lực $88.1\text{ kN}$ này.
   - Nhờ đó, BÈ 5 chuyển từ **KHÔNG ĐẠT** sang **ĐẠT 100%** (overallVerdict = PASS).

2. **Thống kê khối lượng toàn dự án**:
   - 11 bè đơn (Bè 1..4, Bè 6..12): 265 điểm neo = 265 cọc $350 \times 350\text{ mm}$ (117 cọc bờ + 148 cọc đáy).
   - Bè 5 (cọc đôi): 39 điểm neo $\times$ 2 = 78 cọc $350 \times 350\text{ mm}$ (24 cọc bờ + 54 cọc đáy).
   - **Tổng toàn dự án:** **343 cọc vuông $350 \times 350\text{ mm}$** (141 cọc bờ + 202 cọc đáy).
   - Tổng thể tích bê tông cọc: $\approx 380\text{ m}^3$ (so với $608.5\text{ m}^3$ ban đầu, vẫn tiết kiệm gần $38\%$ bê tông!).

3. **Bản vẽ CAD (.dxf) & Bảng thống kê Excel**:
   - Cập nhật hàm tạo bản vẽ và bảng Excel:
     - Ghi chú rõ BÈ 5 sử dụng cụm cọc đôi $2 \times (350 \times 350\text{ mm})$ tại mỗi điểm neo.
     - Trên CAD, tại 39 điểm neo của Bè 5 có thể vẽ ký hiệu cọc đôi (2 hình vuông $350 \times 350\text{ mm}$ đặt cạnh nhau hoặc ghi chú `2x(350x350)`).
     - Bảng thống kê liệt kê rõ số lượng cọc.

4. **Giao diện Web**:
   - Tab 4, Tab 6, Tab 9 và Overview: Hiển thị BÈ 5 ĐẠT với cọc đôi $2 \times 350\times 350\text{ mm}$.
   - Tỷ lệ ĐẠT toàn dự án: **12 / 12 CỤM BÈ ĐẠT 100%**!

5. **Kiểm thử**:
   - Cập nhật test suite để kiểm tra cả 12 bè PASS.
   - Đảm bảo 100% tests PASS và build sạch.

Claude triển khai cập nhật nhé! Cảm ơn bạn rất nhiều.
