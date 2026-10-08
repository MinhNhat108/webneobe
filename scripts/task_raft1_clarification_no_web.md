# ĐIỀU CHỈNH YÊU CẦU: KHÔNG CẦN ĐƯA LÊN WEB, CHỈ CẦN THUYẾT MINH TÍNH TOÁN VÀ FILE BẢN VẼ CAD

Chào Claude,

Người dùng vừa có chỉ đạo điều chỉnh rất rõ ràng:
> **"cái nhiệm vụ này ko cần tải lên web đâu. t chỉ cần bản vẽ cad để xem cluade tính toán kết cấu bè pin thế nào thôi"**

### Yêu cầu cụ thể:
1. **KHÔNG sửa code giao diện Web hay thêm tab/mục mới vào Web app.** Giữ nguyên web app hiện tại.
2. **Tập trung vào 2 sản phẩm:**
   - **(1) Bản thuyết minh tính toán kết cấu chi tiết:**
     + Trình bày rõ mô hình tính toán: lực gió bão $V = 30\text{ m/s}$, lực kéo cáp $T_{max} \approx 135.7\text{ kN}$ tác dụng vào mép bè.
     + Cơ chế truyền lực từ cáp neo $\rightarrow$ ống hộp 40x60 $\rightarrow$ móc chữ 几 $\rightarrow$ dầm C52 $\rightarrow$ cụm phao nổi.
     + Kiểm toán ứng suất ống 40x60: kiểm tra bền uốn, cắt, kéo dọc trục theo TCVN 5575:2012 / AISC.
     + Kiểm toán liên kết móc chữ 几 và bu-lông M10*120, bu-lông đai ốc thoi M10*30: lực cắt và lực ép mặt.
     + Kết luận: Cần bố trí ống 40x60 dài bao nhiêu nhịp dầm C52 tại mỗi điểm neo, và khoảng cách các thanh giằng ngang trung gian là bao nhiêu để bè ổn định.
   - **(2) File bản vẽ CAD hoàn thiện (`.dxf` / `.dwg`):**
     + Bổ sung trực tiếp các thanh ống 40x60 (màu xanh cyan/blue) và các móc chữ 几 (màu vàng yellow) lên mặt bằng BÈ 1 dựa trên file `be_pin_1.dxf` (hoặc tạo file mới `be_pin_1_bo_tri_ong_40x60.dxf`).
     + Vẽ kèm khung tên, bảng thống kê vật tư (số mét ống 40x60, số móc 几, số bu lông M10) và khung chi tiết phóng to liên kết 40x60 - dầm C52 đúng theo tài liệu mẫu.
     + Có thể dùng `accoreconsole.exe` nếu cần convert ngược sang `.dwg` hoặc để file `.dxf` chuẩn AutoCAD đọc được ngay.

Nhờ Claude ưu tiên thực hiện 2 sản phẩm này nhé!
