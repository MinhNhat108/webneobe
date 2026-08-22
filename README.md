# Web Tính Toán Hệ Neo Bè & Bè Pin Nổi (Mooring / Raft Anchoring Calculation)

Ứng dụng web tính toán kỹ thuật hệ thống neo cho **Bè Pin Năng Lượng Mặt Trời Nổi (FPV - Floating Solar)**, hỗ trợ quản lý đa dự án, bản đồ tọa độ neo 2D/3D trực quan, xem trước tài liệu/bản vẽ kỹ thuật (PDF, DXF CAD, Excel), xuất/nhập Excel và in báo cáo kỹ thuật A4 chuẩn kiểm định.

---

## 🌟 1. Tính Năng Nổi Bật

### 1. Quản lý dự án chuyên sâu & Dữ liệu Hồ Huổi Vanh có sẵn:
- Tích hợp sẵn toàn bộ dữ liệu **Dự án Điện mặt trời nổi Hồ Huổi Vanh**:
  - **13 cụm bè pin nổi** (tổng diện tích 81.115 m², 17.367 tấm pin).
  - Hệ thống **299 điểm tọa độ neo** (cọc neo bờ và cọc neo đáy lòng hồ).
  - Tải trọng môi trường: Vận tốc gió thiết kế $30\text{ m/s}$, áp lực động $q = 562.5\text{ Pa}$, diện tích chắn gió tấm pin nghiêng $12^\circ$, hệ số che chắn $\eta = 0.55$, dòng chảy & sóng $1.05$.
  - Lựa chọn cáp Polyester chuyên dụng: **PES-24, PES-28, PES-32, PES-36** (MBL $172 \sim 385\text{ kN}$).
  - Tính toán sức chịu tải cọc neo BTCT theo **phương pháp Broms cho nền đất dính** ($c_u = 40\text{ kPa}$ đất bờ, $c_u = 20\text{ kPa}$ bùn đáy hồ).
  - Đính kèm sẵn bản vẽ mặt bằng PDF, bảng tính gốc Excel và ảnh phối cảnh.
- Khả năng **tạo dự án mới**, sao chép dự án hoặc chuyển đổi giữa các dự án bất kỳ lúc nào.

### 2. Mô hình tính toán kỹ thuật chuyên dụng:
- **Điện mặt trời nổi trên hồ chứa (Floating Solar FPV)**:
  - Tải trọng gió trên tấm pin + phao nổi, phân bố lực qua mô hình tập trung lực $k_{focus}$, lực căng trước $T_0$.
  - Kiểm tra sức bền đứt cáp (Hệ số an toàn $FS = 3.0$ khi nguyên vẹn, $FS = 2.0$ khi đứt 1 dây).
  - Kiểm tra cọc neo bờ & cọc neo đáy lòng hồ (chịu lực kéo ngang, chịu lực kéo nhổ ma sát thân cọc, mômen uốn tiết diện bê tông B25 theo Broms).
  - Bảng đánh giá tiêu chuẩn kỹ thuật với kết luận **ĐẠT / KHÔNG ĐẠT**.

### 3. Bản đồ mặt bằng tọa độ tương tác:
- Hiển thị trực quan toàn bộ mặt bằng 13 cụm bè, đường dây neo, vị trí cọc neo bờ (xanh lá) và cọc đáy hồ (cam).
- Phóng to, thu nhỏ, kéo rê (Pan & Zoom) và lọc theo từng cụm bè.
- Bấm vào điểm neo để xem chi tiết tọa độ $X, Y, Z$, nhịp dây thực tế và góc phương vị.

### 4. Xử lý tài liệu & Xem trước (Preview):
- Khung xem trước trực tiếp:
  - Bản vẽ thiết kế **PDF** qua `<iframe>` nhúng sẵn.
  - Bản vẽ CAD **DXF** vẽ trực tiếp trên Canvas với khả năng zoom/pan.
  - Ảnh phối cảnh **PNG / JPG / WEBP** chất lượng cao.
- Hỗ trợ kéo thả tải lên nhiều file cùng lúc (giới hạn 25 MB/file) và tự động giải phóng bộ nhớ (Object URL Revocation).

### 5. Xuất / Nhập Excel & Báo cáo kỹ thuật A4:
- **Nhập Excel/CSV**: Tự động nhận diện định dạng Key-Value hoặc bảng biểu, bảng xem trước cho phép chỉnh sửa từng ô trước khi nạp.
- **Tải file mẫu**: Tự tạo file template `.xlsx` chuẩn để nhập liệu nhanh.
- **Xuất Excel**: Tạo file workbook `.xlsx` với 5+ sheets chuẩn kỹ thuật (`ThongTinDuAn`, `DuLieuDauVao`, `KetQuaTrungGian`, `BangKiemTra`, `TongHop13Be`, `GhiChu`).
- **In báo cáo**: Định dạng A4 chuyên nghiệp, sạch sẽ, sẵn sàng lưu PDF hoặc in trình duyệt (`Ctrl + P`).

---

## 🚀 2. Cài Đặt & Chạy Ứng Dụng

Yêu cầu môi trường: **Node.js $\ge 18$**.

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy máy chủ phát triển (Dev Server)
npm run dev

# 3. Chạy kiểm thử tự động (Unit tests)
npm run test

# 4. Đóng gói sản phẩm tĩnh (Production Build)
npm run build
```

Sau khi chạy `npm run dev`, mở trình duyệt truy cập: `http://localhost:5173`.

---

## 📁 3. Cấu Trúc Thư Mục Dự Án

```
├── public/
│   └── docs_huoi_vanh/      # Tài liệu mẫu PDF, Excel, ảnh dự án Huổi Vanh
├── src/
│   ├── components/
│   │   ├── layout/          # AppShell, Header, Sidebar
│   │   ├── input/           # Form nhập thông số (Bè, Môi trường, Dây, Cọc, Tiêu chuẩn)
│   │   ├── map/             # Bản đồ tọa độ 13 bè & 299 điểm neo
│   │   ├── results/         # Bảng kiểm tra ĐẠT/KHÔNG ĐẠT, Bảng trung gian, Sơ đồ Catenary
│   │   ├── files/           # Xem trước PDF, Ảnh, DXF Canvas
│   │   ├── excel/           # Dialog nhập Excel, PreviewGrid
│   │   └── report/          # Báo cáo in ấn A4
│   ├── lib/
│   │   ├── calc/            # Thư viện tính toán cơ học hệ neo, Broms, Catenary, Checks
│   │   └── io/              # Xuất nhập Excel SheetJS, DXF Parser
│   ├── store/               # Quản lý State dự án với Zustand & LocalStorage
│   └── data/                # Dữ liệu 13 bè, 299 tọa độ, catalogue cáp PES, cấp xích, loại neo
├── Tài liệu hồ Huổi Vanh/  # Thư mục hồ sơ tài liệu gốc
└── docs/
    └── SPEC.md              # Đặc tả kỹ thuật phần mềm
```
