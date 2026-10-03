# GIAO VIỆC: LẬP BẢN VẼ CAD (.DXF) VÀ BẢNG THỐNG KÊ KỸ THUẬT CHO PHƯƠNG ÁN 2 (KHỐI BÊ TÔNG NEO ĐÁY & CỌC NEO BỜ)

Chào Claude,

Người dùng vừa yêu cầu lập kế hoạch tính toán và tạo bản vẽ kỹ thuật CAD (.dxf) cho **Phương Án 2 (Neo bờ bằng cọc vuông BTCT & Neo đáy bằng khối bê tông trọng lực)**:
> **"m lên kế hoạch tính toán và tạo bản vẽ neo đáy bằn khối bê tông và neo bờ bằng cọc rồi nhờ claude làm giúp t đc k"**

Đây là bước tiếp nối bài toán so sánh kỹ thuật: Sau khi đã tính toán cơ học thủy công cho 175 khối bê tông đáy hồ (DW-1...DW-4) và 129 cọc bờ, hệ thống cần **xuất ra bản vẽ AutoCAD (.dxf) chuyên nghiệp, đúng tỷ lệ, kèm đầy đủ bảng kê trắc đạc và chi tiết cấu tạo** để Chủ đầu tư và các kỹ sư có thể mở trực tiếp trên AutoCAD, BricsCAD kiểm tra.

Dưới đây là đặc tả kỹ thuật chi tiết để Claude triển khai:

---

## 1. YÊU CẦU NGUYÊN TẮC
1. **Tuyệt đối KHÔNG có yếu tố tiền bạc/chi phí/VNĐ**: Toàn bộ nội dung bản vẽ, ghi chú và bảng thống kê là kỹ thuật cơ học thủy công thuần túy.
2. **Bảo toàn 100% Phương Án 1**: Bản vẽ CAD PA1 hiện tại (`buildMooringPileDxf`) vẫn giữ nguyên vẹn chức năng khi người dùng chọn PA1.
3. **Định dạng CAD chuẩn R12 ASCII (`AC1009`)**: Dùng cú pháp `pair(code, value)` và các thực thể cơ bản (`LINE`, `CIRCLE`, `POINT`, `TEXT`) như kiến trúc hiện có trong `src/lib/io/dxfExport.ts`. Không dùng ký tự có dấu trong DXF (dùng hàm `toAsciiCad()` để tránh lỗi font khi mở trên AutoCAD).
4. **Tọa độ thực tế**: Tất cả 304 điểm neo (129 cọc bờ + 175 khối neo đáy) phải đặt đúng tọa độ trắc đạc $(X, Y, Z)$ từ `MOORING_LINES_V2`.

---

## 2. NỘI DUNG BẢN VẼ CAD PHƯƠNG ÁN 2 (`buildMooringDeadweightDxf`)

Tên file xuất: `mat-bang-he-neo-PA2-khoi-be-tong_<PROJECT_CODE>_<YYYYMMDD>.dxf`

### 2.1. Cấu trúc Layer cho PA2:
- `01_BE_PIN` (Màu Cyan / 4): 12 đường bao đa giác cụm pin mặt trời (`RAFT_POLYGONS_V2`) và tên các cụm bè (`BÈ 1` ... `BÈ 12`).
- `02_DAY_NEO_BO` (Màu Green / 3): Các tuyến cáp neo từ vành bè vào 129 cọc bờ.
- `03_DAY_NEO_DAY` (Màu Red / 1): Các tuyến cáp neo từ vành bè đến 175 khối bê tông neo đáy hồ.
- `04_COC_NEO_BO` (Màu Yellow / 2): 129 cọc vuông BTCT neo bờ. Vẽ hình vuông tiết diện cọc đúng tỷ lệ ($a \times a$, ví dụ $0.45\text{m} \div 0.60\text{m}$) hoặc hình tròn bán kính $R$, kèm điểm `POINT` tâm tọa độ.
- `05_KHOI_NEO_DAY_BE_TONG` (Màu Magenta / 6): 175 khối bê tông neo đáy hồ.
  - **Vẽ đúng kích thước hình học thật theo thiết kế**: Khối hộp vuông $L \times W$ (kích thước dao động từ $3.35\text{m} \times 3.35\text{m}$ đến $5.50\text{m} \times 5.50\text{m}$ tùy theo từng cụm bè được tính từ `sizeDeadweightBlock` / `compareMooringOptions`).
  - Hình vẽ khối gồm:
    1. Khung chữ nhật bao quanh tâm $(x, y)$: 4 đoạn thẳng `LINE` tạo thành viền khối.
    2. Hai đường chéo `LINE` nối 4 góc (ký hiệu dấu `X` phân biệt trực quan với cọc đóng PA1).
    3. Điểm `POINT` tại tâm tọa độ trắc đạc $(x, y)$.
- `06_TOA_DO_TEXT` (Màu White / 7): Nhãn ghi chú tại từng điểm neo:
  - Cọc bờ: `HV-P001 (N1-02)`
  - Khối neo đáy: `HV-DW001 (N1-01) [3.5x3.5x1.8m, 53T]` (hoặc tên ngắn gọn kèm kích thước).
- `07_BANG_THONG_KE_COC_BO` (Màu White / 7): Bảng thống kê 129 cọc neo bờ.
- `08_BANG_THONG_KE_KHOI_NEO_DAY` (Màu White / 7): Bảng thống kê 175 khối bê tông neo đáy hồ.
- `09_CHI_TIET_CAU_TAO` (Màu White / 7 hoặc Yellow / 2): Khung bản vẽ chi tiết cấu tạo cọc bờ và khối bê tông đáy.

---

### 2.2. Bảng Thống Kê trong CAD (Đặt bên phải mặt bằng hệ neo):
Tương tự như hàm `scheduleTable` trong `dxfExport.ts`, vẽ 2 bảng riêng biệt rõ ràng:

#### Bảng 1: BẢNG THỐNG KÊ CỌC NEO BỜ BTCT (129 CỌC)
- Các cột:
  1. `MA COC` (`HV-P001` ... `HV-P129`)
  2. `KY HIEU KS` (`N1-02`...)
  3. `CUM BE` (`BE 1`...)
  4. `X (m)`, `Y (m)`, `Z (m)`
  5. `CANH a (m)` ($0.45 \div 0.60$)
  6. `L_opt (m)` (Chiều sâu ngàm tối ưu Broms)
  7. `L_tk (m)` (Chiều sâu đóng cọc thiết kế)
  8. `T_max (kN)`
  9. `P_max (kN)`
  10. `KET LUAN` (`DAT`)

#### Bảng 2: BẢNG THỐNG KÊ KHỐI BÊ TÔNG NEO ĐÁY HỒ (175 KHỐI)
- Các cột:
  1. `MA KHOI` (`HV-DW001` ... `HV-DW175`)
  2. `KY HIEU KS` (`N1-01`...)
  3. `CUM BE` (`BE 1`...)
  4. `X (m)`, `Y (m)`, `Z (m)`
  5. `L (m)` (Chiều dài khối)
  6. `W (m)` (Chiều rộng khối)
  7. `H (m)` (Chiều cao khối)
  8. `V (m3)` (Thể tích bê tông)
  9. `W_kk (T)` (Trọng lượng trong không khí)
  10. `T_max (kN)` (Lực kéo cáp lớn nhất)
  11. `SF_truot` (Hệ số an toàn trượt $\ge 1.5$)
  12. `SF_nho` (Hệ số an toàn nhấc bổng $\ge 1.5$)
  13. `SF_lat` (Hệ số an toàn lật $\ge 1.5$)
  14. `q_day (kPa)` (Ứng suất tiếp xúc đáy bùn $\le 40\text{ kPa}$)
  15. `KET LUAN` (`DAT`)

---

### 2.3. Bản Vẽ Chi Tiết Cấu Tạo (Vẽ bằng vector CAD ở góc bản vẽ):
Bổ sung hàm vẽ chi tiết cấu tạo dạng macro vector CAD (sử dụng `line`, `circle`, `text`):
1. **Chi tiết A - Cọc vuông BTCT neo bờ**:
   - Mặt cắt dọc cọc: Đoạn ngàm đất $L_{tk}$, đoạn nhô khỏi mặt đất $e = 0.5\text{m}$, đỉnh cọc có bản mã thép và tai móc cáp mạ kẽm.
   - Mặt cắt ngang cọc: Tiết diện vuông $a \times a$, 4 thanh thép chủ $\Phi 20 \div \Phi 22$, cốt đai $\Phi 8a100/200$.
   - Ghi chú: Bê tông C25/30, mác chống thấm W6, cốt thép CB400-V.
2. **Chi tiết B - Khối bê tông trọng lực neo đáy hồ**:
   - Mặt bằng khối ($L \times W$): Bố trí 4 tai cẩu hạ thủy ở 4 góc ($\Phi 32$), 1 tai móc cáp chính D50 ở tâm đỉnh khối (có khớp xoay/ma ní cùm neo).
   - Mặt cắt đứng khối (Chiều cao $H$): Thể hiện tai móc cáp neo đỉnh, lưới thép chống nứt $\Phi 14a150$, và gờ chống trượt cao 200mm ở mặt đáy khối (shear keys) cắm vào bùn để tăng ma sát.
   - Ghi chú kỹ thuật thi công: Bê tông C25/30, đúc sẵn trên bãi đúc, vận chuyển bằng sà lan và cẩu nổi thả định vị bằng GPS xuống đáy hồ.

---

## 3. TÍCH HỢP GIAO DIỆN & XUẤT FILE

1. **`src/lib/io/dxfExport.ts`**:
   - Viết hàm `buildMooringDeadweightDxf(...)` (hoặc mở rộng `buildMooringPileDxf` với tham số `mooringOption: 'PA1_PILE' | 'PA2_DEADWEIGHT'`).
   - Cung cấp hàm `exportMooringDeadweightDxf(...)` để trigger tải file.
   - Thêm hàm `dxfFileNamePA2(...)` trả về `mat-bang-he-neo-PA2-khoi-be-tong_<CODE>_<DATE>.dxf`.

2. **Giao diện Người dùng**:
   - Trong `src/components/layout/Header.tsx`:
     - Khi `mooringOption === 'PA2_DEADWEIGHT'`:
       - Nút "Xuất CAD" sẽ tải bản vẽ PA2 (`exportMooringDeadweightDxf` hoặc tự động chọn theo option hiện tại).
       - Title của nút hiển thị: `"Xuất bản vẽ CAD PA2: Khối bê tông neo đáy hồ & Cọc neo bờ (.DXF)"`.
     - Cập nhật dòng text thông báo ở Header bar PA2 từ:
       *"Đang tính 175 neo đáy bằng khối bê tông... Bảng thống kê cọc và bản vẽ CAD vẫn liệt kê cọc đáy của PA1."*
       thành:
       *"Đang chọn Phương án 2: 175 khối bê tông neo đáy (DW-1…DW-4) + 129 cọc neo bờ. Bản vẽ CAD và Bảng thống kê phản ánh trực tiếp khối bê tông."*
   - Trong `src/components/map/MooringLayoutMap.tsx`:
     - Nút "Xuất CAD" tự động nhận diện `mooringOption` đang chọn (PA1 hay PA2) và tải đúng bản vẽ tương ứng.
   - Trong `src/lib/io/excelExport.ts`:
     - Khi xuất Excel Bảng Cọc / Bảng Khối Neo: Nếu đang chọn PA2, bổ sung sheet `ThongKeKhoiBeTong` (175 khối neo đáy) và `ThongKeCocBo` (129 cọc bờ), hoặc tự động cập nhật bảng thống kê tương ứng.

---

## 4. KIỂM THỬ (TEST SUITE)
1. Thêm unit test trong `src/lib/io/__tests__/dxfExport.test.ts`:
   - Kiểm tra `buildMooringDeadweightDxf`:
     - Xuất đủ 129 cọc bờ và 175 khối neo đáy hồ.
     - Khối neo đáy nằm trên layer `05_KHOI_NEO_DAY_BE_TONG` và có kích thước thực $L \times W > 3.0\text{m}$.
     - R12 ASCII chuẩn, parse thành công bằng `dxf-parser`.
     - Chứa đầy đủ 2 bảng thống kê và chi tiết cấu tạo.
2. Chạy `npm test` đảm bảo toàn bộ test PASS (153+ test).
3. Chạy `npm run build` đảm bảo build sạch không có lỗi TypeScript hay ESLint.

Nhờ Claude triển khai giúp nhé! Cảm ơn bạn rất nhiều.
