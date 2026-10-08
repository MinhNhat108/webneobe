# GIAO VIỆC: CHUYỂN ĐỔI MẶT BẰNG 9 BÈ PIN, NEO ĐÁY ĐẾ VÍT XOẮN & NEO BỜ CỌC KHOAN NHỒI D350

Chào Claude,

Người dùng vừa cung cấp bộ hồ sơ thiết kế cập nhật mới nhất cho dự án Điện mặt trời nổi Hồ Huổi Vanh:
- File CAD: `Tài liệu hồ Huổi Vanh/HỒ HUỔI VANH.dxf`
- File PDF: `Tài liệu hồ Huổi Vanh/HOHUOIVANH.BỐ TRÍ BÈ PIN.pdf`
- File Excel & Hình ảnh: `Tài liệu hồ Huổi Vanh/BANG_TINH_NEO_DE_VIT_XOAN.xlsx` và `NEO ĐẾ VÍT XOẮN.png`

Người dùng yêu cầu triển khai 4 công việc trọng tâm:
1. **Cập nhật lại tính toán với NEO ĐÁY tham khảo bảng tính NEO ĐẾ VÍT XOẮN. NEO BỜ bằng CỌC KHOAN NHỒI.**
2. **Sửa lại bản vẽ bố trí neo với phương án trên.**
3. **Cập nhật lại lên Web: Chuyển đổi toàn bộ tính toán cũ 12 bè sang phương án MỚI 9 BÈ PIN.**
4. **Rà soát tính toán và kiểm tra an toàn hệ neo.**

---

## 1. DỮ LIỆU ĐẦU VÀO MỚI (9 BÈ PIN)

Từ file `HỒ HUỔI VANH.dxf` và PDF, mặt bằng hồ chính thức gồm **9 bè pin** được đánh số lại như sau:

| STT | Tên bè mới | Ghi chú chuyển đổi | Số đỉnh | Diện tích ($m^2$) | Diện tích (ha) | Chu vi ($m$) | Tọa độ trọng tâm $(X, Y)$ |
|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | **BÈ 1** | Bè 1 cũ | 6 | $4.222,1$ | $0,42$ | $280,7$ | $(-166.5, 76.3)$ |
| 2 | **BÈ 2** | Bè 2 cũ | 6 | $4.115,0$ | $0,41$ | $287,5$ | $(-92.6, 1.9)$ |
| 3 | **BÈ 3** | Bè 3 cũ | 6 | $5.575,2$ | $0,56$ | $312,0$ | $(-4.8, -64.0)$ |
| 4 | **BÈ 3A** | Gộp Bè 4 + 5 cũ | 10 | $19.103,3$ | $1,91$ | $625,1$ | $(78.8, -175.4)$ |
| 5 | **BÈ 5A** | Gộp Bè 6 + 7 cũ | 6 | $23.037,1$ | $2,30$ | $660,2$ | $(327.9, -158.9)$ |
| 6 | **BÈ 6** | Bè 8 cũ (eo Đông) | 6 | $9.713,7$ | $0,97$ | $442,7$ | $(400.9, 8.1)$ |
| 7 | **BÈ 7** | Bè 9 cũ (nhánh Tây Bắc) | 6 | $11.143,0$ | $1,11$ | $474,4$ | $(141.5, -8.8)$ |
| 8 | **BÈ 8** | Gộp Bè 10 + 11 cũ | 8 | $14.945,7$ | $1,49$ | $573,6$ | $(124.7, 193.8)$ |
| 9 | **BÈ 9** | Bè 12 cũ (vịnh Bắc) | 4 | $4.018,2$ | $0,40$ | $293,0$ | $(147.1, 354.3)$ |
| | **TỔNG** | **9 BÈ** | | **$95.873,3\text{ m}^2$** | **$\approx 9,59\text{ ha}$** | | |

* **Quy mô thiết bị trên hồ (khớp theo PDF):**
  - Tổng số tấm pin: **18.354 tấm**.
  - Inverter: **26 bộ** (5 bộ SG350HX + 21 bộ SG-510HX).
  - Phao nổi: **24.543 phao** (18.723 phao đỡ pin + 5.820 phao đi lại).

---

## 2. GIẢI PHÁP NEO MỚI: NEO BỜ CỌC KHOAN NHỒI D350 & NEO ĐÁY ĐẾ VÍT XOẮN

### 2.1. Neo bờ: Cọc khoan nhồi tròn D350 mm
- Tiếp tục duy trì giải pháp cọc khoan nhồi tròn $\Phi 350\text{ mm}$ đổ tại chỗ đã thống nhất trong bản vẽ `CVB-01`:
  + Ngàm vào tầng đá/sét cứng $L = 6,5 \div 7,0\text{ m}$.
  + Cổ cọc nhô khỏi mặt đất $e \le 100\text{ mm}$ (ràng buộc bắt buộc của tính toán uốn).
  + Bản mã $400 \times 400 \times 20\text{ mm}$ (SS400), râu neo $4\Phi 22$ CB400-V cắm sâu $600\text{ mm}$.
  + Tai neo dày $25\text{ mm}$, ma-ní móng ngựa mạ kẽm WLL 12T (chốt $\Phi 35\text{ mm}$).
  + Bố trí cốt thép chủ phù hợp với tải trọng 9 bè mới (từ $6\Phi 28$ đến $8\Phi 32$).

### 2.2. Neo đáy: Đế BTCT + 4 đinh vít xoắn (Tham khảo Sheet `6.DE_NEO_VIT`)
- **Cấu tạo đế:**
  + Kích thước đế: $B \times B \times t = 2,5 \times 2,5 \times 0,4\text{ m}$ (BTCT B25, thể tích $\approx 2,48\text{ m}^3$, trọng lượng chìm $W' = 37,5\text{ kN}$).
  + Gờ chống trượt (chân váy) sâu $d = 0,15\text{ m}$ chạy quanh chu vi đáy đế.
  + Tai neo cao $15\text{ cm}$ đặt tại tâm mặt trên đế.
  + 4 lỗ chờ $\Phi 120\text{ mm}$ tại 4 góc (tim lỗ cách mép $15\text{ cm}$, khoảng cách tâm 2 lỗ $s = 2,2\text{ m}$).
- **Cấu tạo đinh vít xoắn:**
  + 4 đinh vít xoắn ống thép $\Phi 89 \times 5\text{ mm}$ (thép S235, $f_y = 235\text{ MPa}$).
  + Ren xoắn liên tục $\Phi 105\text{ mm}$ dọc thân vít.
  + Chiều dài vít cắm ngập trong bùn $L = 3,0\text{ m}$ (tổng chiều dài vít kể cả phần khóa đầu $\approx 3,7\text{ m}$).
  + Khóa đầu vít vào mặt trên đế bằng bản mã và đai ốc.
- **Mô hình tính toán (Sheet 6):**
  + **TH1: Mực nước THẤP ($+378,5\text{ m}$):** Cáp thoải nhất $\rightarrow$ Lực ngang $T_h$ lớn nhất $\rightarrow$ Kiểm tra chống trượt ($FS \ge 1,5$):
    $$R_{trượt} = R_{bám\ dính} + R_{gờ} + 4 \cdot H_u \ge 1,5 \cdot T_h$$
    Trong đó $R_{bám\ dính} = \alpha \cdot c_u \cdot B^2$, $R_{gờ} = B \cdot (\gamma' d^2 / 2 + 2 c_u d)$, $H_u$ tính theo Broms đầu tự do cho ống $\Phi 89 \times 5$.
  + **TH2: Mực nước CAO ($+384,0\text{ m}$):** Cáp dốc nhất $\rightarrow$ Lực nhổ $T_v$ lớn nhất $\rightarrow$ Kiểm tra chống nhổ:
    $$R_{nhổ} = 0,9 W' + 4 \cdot Q_a \ge T_v$$
    Trong đó sức nhổ cho phép 1 vít $Q_a = (\alpha \cdot c_u \cdot \pi D_{ren} L) / FS$ ($FS = 2,0$).
  + Kiểm tra chống lật ($M_r \ge 1,5 M_o$).
  + Kiểm tra nhổ 1 vít ($N_1 \le Q_a$).
  + Kiểm tra áp lực đáy nền bùn ($\sigma \le q_a = 5,14 c_u / 2,5$).
  + Kiểm tra cốt thép bản đế: Lưới 2 lớp $\Phi 12$ a200 (CB300-V) hai phương.

---

## 3. CHI TIẾT 4 CÔNG VIỆC CẦN TRIỂN KHAI

### Việc 1: Xây dựng module tính toán Neo Đáy Vít Xoắn (`screwAnchorBed.ts`)
- Tạo file `src/lib/calc/screwAnchorBed.ts` mô phỏng đầy đủ các công thức từ sheet `6.DE_NEO_VIT`.
- Bổ sung type và logic kiểm toán trong engine cho phép chọn `bedAnchorType: 'screw_slab'`.
- Chạy kiểm toán cho tất cả các điểm neo đáy của 9 bè mới.

### Việc 2: Cập nhật dữ liệu 9 bè lên Web (`src/data/`)
- Thay thế `huoiVanhRaftPolygons_v2.json` bằng đa giác tọa độ chính xác của 9 bè từ `HỒ HUỔI VANH.dxf`.
- Cập nhật `HUOI_VANH_RAFTS_SUMMARY` trong `huoiVanhProject.ts` khớp với diện tích, chu vi, số pin 18.354, 26 inverter của 9 bè mới.
- Viết migration store (v16) để browser tự động load sang cấu hình 9 bè.

### Việc 3: Cập nhật giao diện Web App (10 Mục)
- Cập nhật toàn bộ các view/component: Tab 1 (Tổng quan), Tab 2 (Tải trọng), Tab 3 (Mặt bằng tọa độ), Tab 4 (Kiểm toán neo - bổ sung thẻ Đế vít xoắn), Tab 8 (Báo giá & Dự toán - chuyển đổi đơn giá đế BTCT + vít xoắn), Tab 9 (Bản vẽ CAD).

### Việc 4: Sửa đổi bản vẽ CAD bố trí neo & xuất bản vẽ mới
- Cập nhật `dxfExport.ts` để xuất bản vẽ mặt bằng 9 bè mới với mốc cọc bờ tròn D350 và mốc đế neo đáy vuông $2,5 \times 2,5\text{ m}$ (có 4 lỗ vít).
- Xuất bản vẽ chi tiết cấu tạo đế neo vít xoắn và cọc khoan nhồi bờ.

Cảm ơn bạn!
