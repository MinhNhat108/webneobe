# SÁCH HƯỚNG DẪN SỬ DỤNG PHẦN MỀM TÍNH TOÁN HỆ NEO BÈ PIN NỔI (SOLAR FPV)

> **Dự án:** Ứng dụng tính toán cơ học và kiểm tra an toàn hệ neo cho Bè Pin Mặt Trời Nổi (Floating Solar FPV)  
> **Phiên bản:** 2.0 (Chuẩn hóa Hồ Huổi Vanh - 13 Cụm Bè & 299 Điểm Neo)  
> **Đối tượng sử dụng:** Kỹ sư Thủy công, Kỹ sư Kết cấu Công trình, Kỹ sư Năng lượng Tái tạo & Ban Quản lý Dự án.

---

## MỤC LỤC
1. [Giới Thiệu Chung & Đăng Nhập](#1-giới-thiệu-chung--đăng-nhập)
2. [Giao Diện Làm Việc & Điều Hướng](#2-giao-diện-làm-việc--điều-hướng)
3. [Hướng Dẫn Chi Tiết 6 Bước Tính Toán](#3-hướng-dẫn-chi-tiết-6-bước-tính-toán)
   - [Bước 1: Quản Lý Dự Án & Chọn Cụm Bè](#bước-1-quản-lý-dự-án--chọn-cụm-bè)
   - [Bước 2: Thiết Lập Thông Số Đầu Vào (Input)](#bước-2-thiết-lập-thông-số-đầu-vào-input)
   - [Bước 3: Xem & Khai Thác Bản Đồ Mặt Bằng Tọa Độ](#bước-3-xem--khai-thác-bản-đồ-mặt-bằng-tọa-độ)
   - [Bước 4: Đánh Giá Kết Quả & Kiểm Tra An Toàn (Results)](#bước-4-đánh-giá-kết-quả--kiểm-tra-an-toàn-results)
   - [Bước 5: Quản Lý & Xem Trước Bản Vẽ, Hồ Sơ Thiết Kế](#bước-5-quản-lý--xem-trước-bản-vẽ-hồ-sơ-thiết-kế)
   - [Bước 6: Xuất / Nhập Excel & In Báo Cáo Kỹ Thuật A4](#bước-6-xuất--nhập-excel--in-báo-cáo-kỹ-thuật-a4)
4. [Nguyên Lý Tính Toán Cơ Học Cốt Lõi](#4-nguyên-lý-tính-toán-cơ-học-cốt-lõi)
5. [Các Câu Hỏi Thường Gặp (FAQ) & Xử Lý Sự Cố](#5-các-câu-hỏi-thường-gặp-faq--xử-lý-sự-cố)

---

## 1. GIỚI THIỆU CHUNG & ĐĂNG NHẬP

### 1.1 Mục đích ứng dụng
Phần mềm cung cấp giải pháp tính toán toàn diện, kiểm tra khả năng chịu lực và độ an toàn cho hệ thống neo các cụm bè pin năng lượng mặt trời nổi (FPV) trên mặt nước hồ chứa/thủy điện:
- Tự động xác định tải trọng môi trường (Gió bão, sóng, dòng chảy).
- Tính toán lực căng cáp lớn nhất ($T_{max}$) và lựa chọn quy cách cáp Polyester chuyên dụng (PES).
- Kiểm tra sức chịu tải của hệ thống cọc neo bê tông cốt thép (BTCT) ngàm trong nền đất bờ và bùn đáy hồ theo **phương pháp Broms**.
- Đánh giá tổng thể độ an toàn: **ĐẠT (PASS)** hoặc **KHÔNG ĐẠT (FAIL)** theo tiêu chuẩn kỹ thuật (TCVN, QCVN, DNV-ST-0119, API RP 2SK).

### 1.2 Mở khóa & Đăng nhập hệ thống
Khi truy cập lần đầu, hệ thống yêu cầu mật khẩu bảo vệ để đảm bảo an toàn dữ liệu công trình:
- **Mật khẩu truy cập mặc định:** `123456` (hoặc `huoivanh123`, `neobe2026`, `admin`).
- Tích chọn **"Ghi nhớ đăng nhập trên thiết bị này"** để không phải nhập lại mật khẩu trong những lần truy cập sau.
- Nhấn **"Mở Khóa Truy Cập"** để vào không gian làm việc.

---

## 2. GIAO DIỆN LÀM VIỆC & ĐIỀU HƯỚNG

Giao diện phần mềm được tối ưu hóa cho màn hình kỹ sư với 3 khu vực chính:

- **Thanh tiêu đề (Header):**
  - Hiển thị tên và mã dự án đang mở.
  - Nút **Tính Lại** (`Refresh`): Buộc hệ thống tính toán lại toàn bộ dữ liệu.
  - Nút **Nhập Excel** (`FileSpreadsheet`): Mở hộp thoại đọc file thông số từ bảng tính.
  - Nút **Xuất Excel** (`Download`): Tải xuống file `.xlsx` đầy đủ 6 sheet tính toán.
  - Nút **In Báo Cáo** (`Printer`): Chuyển nhanh đến trang báo cáo in ấn A4.
  - Nút **Khóa / Đăng xuất** (`Lock`): Khóa bảo vệ màn hình.
- **Thanh bên trái (Sidebar):** Quản lý quy trình 6 bước tính toán và hiển thị huy hiệu trạng thái tổng thể (ĐẠT / KHÔNG ĐẠT / N/A).

---

## 3. HƯỚNG DẪN CHI TIẾT 6 BƯỚC TÍNH TOÁN

### BƯỚC 1: QUẢN LÝ DỰ ÁN & CHỌN CỤM BÈ
*(Nhấp vào mục "1. Dự Án & Cụm Bè" ở thanh menu trái)*

1. **Chuyển đổi giữa 12 cụm bè (Dự án Hồ Huổi Vanh):**
   - Trên thanh *“Chọn cụm bè cần tính toán chi tiết”*, nhấp vào bất kỳ cụm bè nào từ **BÈ 1** đến **BÈ 12**.
   - Phần mềm sẽ tự động nạp diện tích, kích thước, số lượng tấm pin, số dây neo và loại cáp tương ứng của bè đó vào toàn bộ mô hình.
2. **Khôi phục dữ liệu gốc:**
   - Nếu bạn đã chỉnh sửa thông số thử nghiệm và muốn quay về dữ liệu thiết kế chuẩn ban đầu, nhấn nút **"Dữ liệu gốc Huổi Vanh"**.
3. **Tạo dự án mới:**
   - Nhấn nút **"Tạo dự án mới"**, nhập tên dự án (ví dụ: *Dự án FPV Hồ Thác Bà*). Hệ thống sẽ tạo một không gian tính toán độc lập với các thông số mặc định.
4. **Chỉnh sửa thông tin hồ sơ:**
   - Điền Tên dự án, Mã số, Địa điểm, Tên kỹ sư thiết kế, Ngày lập và Ghi chú hồ sơ.

---

### BƯỚC 2: THIẾT LẬP THÔNG SỐ ĐẦU VÀO (INPUT)
*(Nhấp vào mục "2. Thông Số Đầu Vào" ở thanh menu trái)*

Mục này gồm 5 bảng biểu mẫu kỹ thuật. Mỗi khi bạn thay đổi bất kỳ ô số nào, phần mềm sẽ **tự động tính toán lại tức thì**:

#### 1. Hình học Bè & Hệ thống Tấm pin nổi (RaftForm)
- **Chiều dài ($L$) & Chiều rộng ($W$):** Kích thước mặt bằng cụm bè (m).
- **Mớn nước ($d$) & Chiều cao nổi (Freeboard):** Chiều sâu chìm dưới nước và chiều cao mép phao nổi nhô trên mặt nước (m).
- **Khối lượng bè (Displacement):** Tổng trọng lượng phao nổi, tấm pin, khung giá đỡ và thiết bị (tấn).
- **Thông số pin mặt trời (FPV):**
  - *Số lượng tấm pin:* Tổng module quang điện trên bè (ví dụ: 1.488 tấm).
  - *Diện tích 1 tấm pin:* Thường từ $2.5 \sim 2.8\text{ m}^2$ (mặc định $2.701\text{ m}^2$).
  - *Góc nghiêng pin (Tilt):* Góc lắp đặt so với phương ngang (mặc định $12^\circ$).
  - *Hệ số che chắn (Shielding):* Hệ số giảm cản gió giữa các hàng pin nối tiếp nhau (mặc định $0.55$).
- **Khoảng cách 4 cạnh bè tới bờ / cọc đáy:**
  - Nhập khoảng cách mép bè tới bờ Nam, bờ Bắc, bờ Đông và mép cụm bè lân cận (cạnh Tây).
  - Khung hiển thị trực tiếp sẽ cập nhật ngay **Chiều dài dây cáp thực tế** và **Góc nghiêng kéo cáp $\theta$** tương ứng.

#### 2. Điều kiện Tự nhiên & Môi trường Hồ chứa (EnvForm)
- **Độ sâu nước ($h$):** Mực nước tại vị trí đặt cụm bè (m).
- **Vận tốc gió thiết kế ($V_{wind}$):** Vận tốc gió cực đại tính toán ứng với chu kỳ lặp thiết kế (ví dụ: $30\text{ m/s}$, bão cấp 11).
- **Vận tốc dòng chảy ($V_{current}$) & Chiều cao sóng ($H_s$):** Tác động dòng chảy mặt và sóng mặt hồ.
- **Hệ số tổ hợp tải trọng:** Hệ số tăng tải xét đến sự đồng thời của gió, sóng và dòng chảy (mặc định $1.05$).

#### 3. Hệ thống Dây Cáp & Xích Neo (LineForm)
- **Loại liên kết neo:** Chọn **Cáp Polyester (PES)** hoặc **Xích neo (Stud-link Chain)**.
- **Bảng tra Catalogue Cáp PES:** Bấm chọn trực tiếp các mã cáp tiêu chuẩn:
  - `PES-24` (Sức đứt MBL: $172\text{ kN}$)
  - `PES-28` (Sức đứt MBL: $235\text{ kN}$)
  - `PES-32` (Sức đứt MBL: $305\text{ kN}$)
  - `PES-36` (Sức đứt MBL: $385\text{ kN}$)
  - `PES-48` (Sức đứt MBL: $688\text{ kN}$)
- **Lực căng trước ($T_0$):** Lực căng đặt sẵn khi lắp đặt dây cáp (mặc định $5\text{ kN}$).
- **Hệ số tập trung lực ($k_{focus}$):** Hệ số phân bố lực bất lợi nhất lên cụm dây neo chịu lực chính khi gió thổi chéo góc (từ $0.15 \sim 0.35$).
- **Số lượng dây:** Tổng số dây neo, số dây kéo lên bờ (Shore) và số dây neo vào cọc lòng hồ (Bed).

#### 4. Hệ Cọc Neo & Mỏ Neo Cố Định (AnchorForm)
- **Chế độ neo:**
  - **Hệ Cọc Neo Đóng (Phương pháp Broms):** Dùng cọc bê tông cốt thép vuông đóng ngàm vào đất bờ và bùn lòng hồ (Phương án chính của Hồ Huổi Vanh).
  - **Mỏ Neo Kéo (Drag Anchor):** Dùng mỏ neo Danforth, AC-14, Hall thả cắm vào nền đáy.
  - **Khối Bê Tông Trọng Lực (Deadweight):** Dùng khối bê tông chìm giữ bằng ma sát đáy.
- **Thông số đất nền & Cọc Broms:**
  - *Lực dính đất bờ ($c_u$ bờ):* Sức kháng cắt không thoát nước tầng đất bờ (mặc định $40\text{ kPa}$).
  - *Lực dính bùn lòng hồ ($c_u$ đáy):* Lực dính lớp bùn đáy hồ (mặc định $20\text{ kPa}$).
  - *Kích thước cọc bờ:* Cạnh cọc vuông $D$ (ví dụ: $0.45\text{ m}$) và Chiều sâu ngàm $L$ (ví dụ: $6.5\text{ m}$).
  - *Kích thước cọc lòng hồ:* Cạnh cọc vuông $D$ (ví dụ: $0.35\text{ m}$) và Chiều sâu ngàm $L$ (ví dụ: $8.0\text{ m}$).
  - *Hệ số an toàn cọc:* $FS = 2.5$.

#### 5. Tiêu chuẩn Kiểm tra An toàn (CriteriaForm)
- Thiết lập các hệ số an toàn cho phép: Hệ số an toàn bền cáp nguyên vẹn ($FS \ge 3.0$), đứt 1 dây ($FS \ge 2.0$), hệ số an toàn nhổ cọc ($FS \ge 2.0$).

---

### BƯỚC 3: XEM & KHAI THÁC BẢN ĐỒ MẶT BẰNG TỌA ĐỘ
*(Nhấp vào mục "3. Mặt Bằng & Tọa Độ Neo" ở thanh menu trái)*

1. **Tổng quan mặt bằng 299 điểm neo:**
   - Bản đồ số hóa toàn bộ vị trí 12 cụm bè trên lòng hồ Huổi Vanh.
   - **Điểm màu xanh lá:** Cọc neo bờ.
   - **Điểm màu cam:** Cọc neo đáy lòng hồ (dùng chung giữa 2 bè lân cận).
   - **Đường nét đứt màu xanh/cam:** Hướng và tim tuyến của từng sợi cáp neo nối từ mép bè tới cọc.
2. **Thao tác tương tác bản đồ:**
   - **Kéo chuột (Pan):** Di chuyển góc nhìn khắp lòng hồ.
   - **Cuộn chuột (Zoom):** Phóng to chi tiết cụm bè hoặc thu nhỏ toàn cảnh.
   - **Bộ lọc cụm bè:** Bấm chọn xem riêng từng bè hoặc xem đồng thời toàn bộ 12 bè.
3. **Tra cứu tọa độ kỹ thuật:**
   - Nhấp chuột trực tiếp vào một điểm cọc hoặc điểm mép bè bất kỳ trên bản đồ: Cửa sổ pop-up sẽ hiển thị ngay **Mã điểm cọc, Tọa độ thực tế ($X, Y, Z$), Chiều dài nhịp cáp và Góc phương vị**.

---

### BƯỚC 4: ĐÁNH GIÁ KẾT QUẢ & KIỂM TRA AN TOÀN (RESULTS)
*(Nhấp vào mục "4. Kết Quả & Kiểm Tra" ở thanh menu trái)*

Trang này tổng hợp toàn bộ kết luận kỹ thuật của phương án thiết kế:

1. **Huy hiệu kết luận tổng thể (Verdict Banner):**
   - **Màu xanh lá - ĐẠT YÊU CẦU THIẾT KẾ:** Tất cả các điều kiện an toàn bắt buộc đều thỏa mãn.
   - **Màu đỏ - KHÔNG ĐẠT YÊU CẦU:** Có ít nhất một hạng mục bị vi phạm (ví dụ: lực căng vượt quá sức bền cáp hoặc cọc không đủ khả năng chịu nhổ). Phần mềm sẽ chỉ rõ *Hạng mục vi phạm nặng nhất* để kỹ sư kịp thời điều chỉnh.
2. **Bảng đánh giá chi tiết từng tiêu chí kiểm tra (Check Table):**
   - `C1:` Sức chịu tải ngang cọc bờ theo Broms ($H_{applied} \le H_{allow}$).
   - `C2:` Sức bền kéo đứt dây cáp neo khi hệ thống nguyên vẹn ($T_{max} \times 3.0 \le \text{MBL}$).
   - `C3 & C4:` Ổn định mỏ neo / cọc neo đáy khi kéo ngang ($H \le H_{allow}$).
   - `C5:` Khả năng chống nhổ cọc neo đáy lòng hồ do góc nghiêng cáp ($T_v \le T_{v,allow}$).
   - `C6:` Sức bền dây cáp khi xảy ra sự cố đứt 1 dây bất kỳ ($T_{max,dam} \times 2.0 \le \text{MBL}$).
   - `C7:` Khả năng chịu uốn của tiết diện bê tông cốt thép cọc bờ ($M_{max} \le M_{rd}$).
   - Cột **Dư an toàn (%)** cho biết phương án thiết kế còn dư bao nhiêu % khả năng chịu lực (tối ưu hóa kinh tế).
3. **Bảng kết quả trung gian:**
   - Áp lực gió động $q$ (Pa), diện tích cản gió $A_{wind}$ ($\text{m}^2$).
   - Tổng lực môi trường $F_{env}$ (kN).
   - Lực căng lớn nhất $T_{max}$ (kN).
   - Chi tiết lực chịu tải và mômen uốn của cọc bờ, cọc đáy hồ, thể tích bê tông cọc ($\text{m}^3$).
4. **Bảng tổng hợp 12 cụm bè:** Bảng đối chiếu toàn diện kích thước, số lượng cáp và phương án chọn cáp của cả 12 cụm bè.

---

### BƯỚC 5: QUẢN LÝ & XEM TRƯỚC BẢN VẼ, HỒ SƠ THIẾT KẾ
*(Nhấp vào mục "5. Tài Liệu Đính Kèm" ở thanh menu trái)*

Phần mềm tích hợp sẵn bộ tài liệu kỹ thuật gốc của hồ Huổi Vanh:
1. **Xem trực tiếp bản vẽ CAD (.DXF):**
   - Trình phân tích CAD nhúng vẽ trực tiếp file DXF lên Canvas.
   - Hỗ trợ cuộn chuột để Zoom in/out, kéo rê để di chuyển bản vẽ mặt bằng bố trí hệ neo.
2. **Xem bản vẽ PDF & Ảnh thiết kế:**
   - Xem trực tiếp hồ sơ thiết kế PDF và ảnh phối cảnh JPG độ phân giải cao mà không cần phần mềm bên ngoài.
3. **Tải lên tài liệu mới:**
   - Kéo thả file PDF, DWG/DXF, XLSX, PNG/JPG từ máy tính vào ô tải lên (hỗ trợ file dung lượng lên tới $25\text{ MB}$).

---

### BƯỚC 6: XUẤT / NHẬP EXCEL & IN BÁO CÁO KỸ THUẬT A4
*(Sử dụng các nút bấm trên thanh Header hoặc mục "6. Báo Cáo Kỹ Thuật")*

#### 1. Nhập dữ liệu từ Excel/CSV (`Nhập Excel`):
- Nhấn nút **"Nhập Excel"** trên Header.
- Bấm **"Tải file mẫu chuẩn (.xlsx)"** nếu bạn muốn điền thông số sẵn từ máy tính.
- Chọn file Excel của bạn tải lên: Bảng xem trước **PreviewGrid** sẽ hiển thị dữ liệu. Bạn có thể nhấp đúp trực tiếp vào từng ô để sửa nhanh giá trị trước khi nhấn **"Áp dụng vào biểu mẫu tính toán"**.

#### 2. Xuất bảng tính ra file Excel (`Xuất Excel`):
- Nhấn nút **"Xuất Excel"** trên Header.
- Phần mềm sẽ xuất file workbook `.xlsx` chuẩn kỹ thuật với 6 sheet chi tiết:
  - `ThongTinDuAn`: Thông tin chung và hồ sơ dự án.
  - `DuLieuDauVao`: Bảng thông số hình học, tải trọng gió, cáp, cọc.
  - `KetQuaTrungGian`: Toàn bộ các bước giải công thức lực và mômen.
  - `BangKiemTra`: Bảng tổng hợp kiểm tra ĐẠT / KHÔNG ĐẠT có công thức và ghi chú.
  - `TongHopCumBe`: Bảng số liệu tổng hợp của toàn bộ 12 cụm bè hồ Huổi Vanh.
  - `GhiChu`: Cam kết kỹ thuật và ngày giờ xuất báo cáo.

#### 3. Xem trước & In báo cáo thuyết minh A4 (`In Báo Cáo`):
- Nhấp vào mục **"6. Báo Cáo Kỹ Thuật"** (hoặc nút **"In Báo Cáo"** trên Header).
- Giao diện được định dạng chuyên nghiệp chuẩn in ấn: Tiêu đề cơ quan, khung kết luận tổng thể, bảng thông số, bảng kết quả cơ học, bảng kiểm tra an toàn và **khung 3 chữ ký** (Người lập, Người kiểm tra, Chủ nhiệm dự án).
- Nhấn **"In Báo Cáo / Xuất PDF"** hoặc nhấn phím tắt **`Ctrl + P`** trên trình duyệt để in trực tiếp ra máy in hoặc lưu thành file PDF.

---

## 4. NGUYÊN LÝ TÍNH TOÁN CƠ HỌC CỐT LÕI

Phần mềm vận hành dựa trên các tiêu chuẩn kỹ thuật hàng hải và công trình thủy công:

1. **Tải trọng gió trên hệ bè pin nổi:**
   $$q = \frac{1}{2} \cdot \rho_{air} \cdot V_{wind}^2$$
   $$F_{wind,panel} = q \cdot C_d \cdot A_{panel} \cdot \sin(\theta_{tilt}) \cdot \eta_{shield}$$
   $$F_{env} = (F_{wind,panel} + F_{wind,float}) \times 1.05$$
2. **Lực căng cáp neo lớn nhất ($T_{max}$):**
   $$T_{max} = F_{env} \cdot k_{focus} + T_0$$
   *Trong đó:* $k_{focus}$ là hệ số tập trung lực bất lợi, $T_0$ là lực căng trước lắp đặt.
3. **Phương pháp Broms kiểm tra cọc neo bê tông trong nền đất dính ($c_u$):**
   - Sức kháng đất giới hạn: $p_u = 9 \cdot c_u \cdot D$.
   - Sức chịu tải ngang cực hạn $H_u$ được giải chính xác từ phương trình cân bằng mômen uốn của cọc ngắn/trung bình ngàm trong đất.
   - Sức chịu ngang cho phép: $H_{allow} = \frac{H_u}{FS}$ (với $FS = 2.5$).
   - Sức chịu nhổ cọc lòng hồ: Tính theo ma sát thành bên $Q_{uplift} = \alpha \cdot c_u \cdot (4D) \cdot L$.
4. **Kiểm tra bền tiết diện cọc uốn:**
   $$M_{rd} = 0.9 \cdot R_b \cdot \frac{D^3}{6} \ge M_{max}$$

---

## 5. CÁC CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ

### Q1: Khi bảng kết quả báo "KHÔNG ĐẠT" (Màu đỏ), tôi cần xử lý thế nào?
> **Trả lời:** Hãy nhìn vào dòng *Hạng mục vi phạm* hiển thị trên thanh kết luận:
> - **Nếu vi phạm sức đứt cáp (C2/C6):** Vào mục *3. Dây Cáp* -> Chọn mã cáp lớn hơn (ví dụ nâng từ `PES-28` lên `PES-32` hoặc `PES-36`) hoặc tăng thêm số lượng dây neo.
> - **Nếu vi phạm sức chịu cọc bờ (C1/C7):** Vào mục *4. Hệ Mỏ Neo* -> Tăng kích thước tiết diện cọc $D$ (ví dụ từ $0.40\text{ m}$ lên $0.45\text{ m}$) hoặc tăng chiều sâu ngàm cọc $L$.
> - **Nếu vi phạm cọc lòng hồ bị nhổ (C5):** Tăng chiều sâu cọc ngàm $L$ trong bùn hoặc kéo dài khoảng cách cọc ra xa để giảm góc nghiêng cáp $\theta$.

### Q2: Làm thế nào để khôi phục lại dữ liệu chuẩn ban đầu của dự án?
> **Trả lời:** Vào mục **"1. Dự Án & Cụm Bè"** -> Bấm nút **"Dữ liệu gốc Huổi Vanh"** trên góc phải. Toàn bộ thông số 12 cụm bè sẽ được nạp lại về trạng thái thiết kế chuẩn ban đầu.

### Q3: Dữ liệu tôi nhập có bị mất khi tắt trình duyệt hoặc mất điện không?
> **Trả lời:** **Không bị mất.** Phần mềm có tính năng tự động lưu tức thì (Auto-save) vào bộ nhớ cục bộ (LocalStorage) của trình duyệt. Lần sau mở web lên, toàn bộ dữ liệu bạn đã nhập sẽ hiển thị lại nguyên vẹn.

### Q4: Tôi có thể sử dụng phần mềm trên điện thoại hoặc máy tính bảng không?
> **Trả lời:** **Có.** Giao diện web được thiết kế Responsive tương thích hoàn toàn với màn hình máy tính bàn, laptop, iPad/máy tính bảng và điện thoại thông minh.

---
*Tài liệu được biên soạn phục vụ công tác thiết kế, thẩm định và quản lý dự án hệ thống neo bè.*