# TÀI LIỆU KỸ THUẬT & CHỈ THỊ GIAO VIỆC: RÀ SOÁT CÔNG THỨC VÀ TRIỂN KHAI TAB HƯỚNG DẪN SỬ DỤNG HỆ NEO BÈ

> **Dự án:** Ứng dụng Web Tính Toán Cơ Học và Kiểm Tra An Toàn Hệ Neo Bè Pin Mặt Trời Nổi (Solar FPV)  
> **Địa điểm áp dụng:** Hồ Thủy Điện / Hồ Chứa Huổi Vanh (13 Cụm Bè & 299 Điểm Neo)  
> **Tiêu chuẩn áp dụng:** DNV-ST-0119, API RP 2SK, TCVN 11823, TCVN 10304, QCVN 02:2022/BXD  
> **Ngày cập nhật:** 22/08/2026

---

## MỤC LỤC
1. [Báo Cáo Rà Soát Công Thức & Kiểm Tra Logic Phần Mềm](#1-báo-cáo-rà-soát-công-thức--kiểm-tra-logic-phần-mềm)
2. [Danh Sách Các File Tạo Mới & Chỉnh Sửa](#2-danh-sách-các-file-tạo-mới--chỉnh-sửa)
3. [Lời Chỉ Đạo & Quy Trình Bàn Giao Cho Full-Stack Developer](#3-lời-chỉ-đạo--quy-trình-bàn-giao-cho-full-stack-developer)

---

## 1. BÁO CÁO RÀ SOÁT CÔNG THỨC & KIỂM TRA LOGIC PHẦN MỀM

### 1.1 Khảo sát các module tính toán cơ học (`src/lib/calc/`)

Đã đối soát toàn bộ mã nguồn tính toán trong thư mục `src/lib/calc/` với tài liệu thiết kế gốc của dự án và các tiêu chuẩn thủy công hàng hải quốc tế:

| Module mã nguồn | Nhiệm vụ kỹ thuật | Công thức cốt lõi áp dụng | Đánh giá & Kết luận |
| :--- | :--- | :--- | :--- |
| **`loads.ts`** | Tải trọng gió bão, dòng chảy & lực căng cáp neo | • Áp lực gió động: $q = 0.5 \cdot \rho_{air} \cdot V_{wind}^2$<br>• Lực cản dàn pin: $F_{wind,panel} = q \cdot C_d \cdot A_{panel} \cdot \sin(\theta_{tilt}) \cdot \eta_{shield}$<br>• Lực phao nổi: $F_{wind,float} = q \cdot C_{d,float} \cdot A_{float}$<br>• Tổng lực môi trường: $F_{env} = (F_{panel} + F_{float}) \times 1.05$<br>• Lực căng lớn nhất: $T_{max} = \max(F_{env} \cdot k_{focus} + T_0, \frac{F_{env}}{N_{eff} \cdot \cos\alpha} + T_0)$ | **ĐÃ CHUẨN XÁC 100%**.<br>Khớp hoàn toàn với mô hình phân bố lực của DNV-ST-0119. Có xét hệ số che chắn $\eta = 0.55$ và sự đồng thời của sóng dòng chảy ($1.05$). |
| **`broms.ts`** | Sức chịu tải cọc ngắn/trung bình ngàm trong đất dính | • Áp lực đất giới hạn: $p_u = 9 \cdot c_u \cdot D$<br>• Đoạn ngàm hữu hiệu: $g = L - 1.5D$<br>• PT cân bằng mômen Broms: $\frac{0.5}{p_u} H_u^2 + (e + 1.5D + g) H_u - 0.5 p_u g^2 = 0$<br>• Sức chịu ngang cho phép: $H_{allow} = H_u / 2.5$<br>• Mômen uốn lớn nhất: $M_{max} = H_{applied} \cdot (e + 1.5D + 0.5 \frac{H_{applied}}{p_u})$<br>• Sức chịu uốn cọc: $M_{rd} = 0.9 \cdot R_b \cdot \frac{D^3}{6}$<br>• Sức chịu nhổ: $Q_{uplift,all} = \frac{\alpha \cdot c_u \cdot 4D \cdot L}{2.0}$ | **ĐÃ CHUẨN XÁC 100%**.<br>Mô hình Broms kinh điển cho cọc BTCT vuông $0.45\text{m}$ (bờ) và $0.35\text{m}$ (đáy hồ). Hệ số an toàn chịu ngang $FS = 2.5$, chống nhổ $FS = 2.0$. |
| **`checks.ts`** | Đánh giá an toàn & kết luận ĐẠT / KHÔNG ĐẠT | • **Hệ cọc Broms (Huổi Vanh):**<br>&nbsp;&nbsp;- `C2`: Bền kéo cáp nguyên vẹn ($SF = MBL / T_{max} \ge 3.0$)<br>&nbsp;&nbsp;- `C6`: Bền kéo cáp đứt 1 dây ($SF = MBL / T_{max,dam} \ge 2.0$)<br>&nbsp;&nbsp;- `BP-1`: Sức chịu ngang cọc BỜ ($H / H_{allow} \le 1.0$)<br>&nbsp;&nbsp;- `BP-2`: Mômen uốn cọc BỜ ($M_{max} / M_{rd} \le 1.0$)<br>&nbsp;&nbsp;- `BP-3`: Sức chịu ngang cọc ĐÁY ($T_h / H_{allow} \le 1.0$)<br>&nbsp;&nbsp;- `BP-4`: Sức chịu NHỔ cọc ĐÁY ($T_v / Q_{uplift,all} \le 1.0$)<br>&nbsp;&nbsp;- `BP-5`: Mômen uốn cọc ĐÁY ($M_{max} / M_{rd} \le 1.0$)<br>• **Hệ mỏ neo kéo/trọng lực:** `C1` đến `C7` | **ĐÃ ĐỐI SOÁT & ĐỒNG BỘ**.<br>Đảm bảo giao diện hướng dẫn sử dụng phản ánh trung thực cả 2 chế độ kiểm tra (`BP-1` đến `BP-5` cho cọc và `C1` đến `C7` cho mỏ neo). |
| **`catenary.ts`** | Mô hình đường cong dây chùng Catenary | • Tọa độ võng dây: $y(x) = a \cdot [\cosh(x/a) - 1]$ với $a = H / w$<br>• Chiều dài dây nằm đáy: $L_{ground} = L_{total} - a \cdot \sinh(x_0/a)$<br>• Tỷ lệ chiều sâu (Scope): $Scope = L_{total} / d$ | **ĐÃ CHUẨN XÁC**.<br>Áp dụng khi dùng cáp nặng/xích neo có độ chùng tiếp đất. |
| **`anchor.ts`** | Mỏ neo kéo & Khối bê tông trọng lực | • Sức giữ mỏ neo: $R = W_{sub} \cdot k_{holding}$<br>• Neo trọng lực: $R = W_{sub} \cdot \mu_{friction}$ | **ĐÃ CHUẨN XÁC**. |

---

## 2. DANH SÁCH CÁC FILE TẠO MỚI & CHỈNH SỬA

| STT | Đường dẫn file | Trạng thái | Mô tả chức năng kỹ thuật |
| :---: | :--- | :---: | :--- |
| 1 | `src/components/guide/GuideView.tsx` | **TẠO MỚI** | Component giao diện sổ tay hướng dẫn tính toán gồm 6 phân hệ tương tác:<br>1. *Bắt đầu nhanh (Overview)*: 6 bước tính toán với nút nhảy trực tiếp vào tab.<br>2. *Quy trình 6 bước*: Hướng dẫn chi tiết từng màn hình.<br>3. *Sơ đồ cơ học SVG tương tác*: Mô phỏng gió bão, cọc bờ, cọc đáy và lực kéo cáp.<br>4. *Công thức & Ví dụ mẫu*: Trình bày công thức cơ học và số liệu mẫu thực tế của BÈ 1.<br>5. *Cẩm nang xử lý lỗi*: Hướng dẫn khắc phục nhanh khi báo KHÔNG ĐẠT.<br>6. *FAQ*: 6 câu hỏi thường gặp dạng accordion có tìm kiếm thời gian thực. |
| 2 | `src/components/layout/Sidebar.tsx` | **CHỈNH SỬA** | • Bổ sung kiểu `'guide'` vào `ActiveSection`.<br>• Thêm mục menu **"7. Hướng Dẫn Sử Dụng"** (Icon `BookOpen`, badge `HDSD`). |
| 3 | `src/components/layout/Header.tsx` | **CHỈNH SỬA** | • Thêm prop `onGoToGuide` vào `HeaderProps`.<br>• Thêm nút bấm **"Hướng Dẫn"** (Icon `BookOpen`) trên thanh tiêu đề để truy cập nhanh tài liệu từ bất kỳ đâu. |
| 4 | `src/components/layout/AppShell.tsx` | **CHỈNH SỬA** | • Import và render component `GuideView`.<br>• Kết nối sự kiện `onGoToGuide` và truyền hàm `onSelectSection` cho phép điều hướng ngược lại các tab tính toán. |
| 5 | `TASK.md` | **TẠO MỚI** | Tài liệu bàn giao dự án, báo cáo rà soát công thức toán học và lời chỉ đạo phân công Full-Stack Developer. |

---

## 3. LỜI CHỈ ĐẠO & QUY TRÌNH BÀN GIAO CHO FULL-STACK DEVELOPER

Dưới đây là nội dung văn bản chỉ đạo chi tiết từng bước, sẵn sàng copy để giao việc cho kỹ sư Full-Stack Developer phụ trách vận hành và phát triển hệ thống:

```markdown
================================================================================
CHỈ ĐẠO KỸ THUẬT: VẬN HÀNH & BẢO TRÌ MODULE HƯỚNG DẪN TÍNH TOÁN HỆ NEO BÈ PIN NỔI
================================================================================

Kính gửi: Full-Stack Developer phụ trách dự án,

Hệ thống tính toán hệ neo bè pin mặt trời nổi (FPV) phiên bản 2.0 đã được bổ sung
hoàn chỉnh tab "7. Hướng Dẫn Sử Dụng" (GuideView). Bạn được giao trách nhiệm tiếp nhận,
kiểm tra định kỳ và duy trì tính nhất quán kỹ thuật theo các chỉ đạo sau:

--------------------------------------------------------------------------------
1. QUẢN LÝ CẤU TRÚC CODE & LUỒNG DỮ LIỆU
--------------------------------------------------------------------------------
- Component chính: `src/components/guide/GuideView.tsx`
- Routing & Navigation: Được tích hợp tại `src/components/layout/AppShell.tsx`,
  `Sidebar.tsx` và `Header.tsx` thông qua enum `ActiveSection = 'project' | 'input' | 'map' | 'results' | 'files' | 'report' | 'guide'`.
- Cơ chế liên kết tương tác (Deep Linking): Khi người dùng bấm các nút hành động trong
  GuideView (ví dụ: "Chỉnh Cọc Bờ →", "Vào Nhập Thông Số"), GuideView sẽ gọi callback
  `onSelectSection(target)` để chuyển hướng trực tiếp sang tab tương ứng mà không làm
  mất trạng thái dữ liệu đang nhập (state trong Zustand store `useProjectStore`).

--------------------------------------------------------------------------------
2. NGUYÊN TẮC BẢO TOÀN CÔNG THỨC TOÁN HỌC & CƠ HỌC
--------------------------------------------------------------------------------
Mọi công thức hiển thị trong `GuideView.tsx` PHẢI LUÔN ĐỒNG BỘ 100% với logic thực thi:
1. Áp lực gió & lực cản: Đồng bộ với `src/lib/calc/loads.ts` (mật độ không khí 1.225/1.25,
   hệ số che chắn dàn pin 0.55, góc nghiêng 12 độ).
2. Sức chịu cọc bờ Broms: Đồng bộ với `src/lib/calc/broms.ts` (p_u = 9.c_u.D, đoạn ngàm
   hữu hiệu g = L - 1.5D, FS = 2.5).
3. Tiêu chí đánh giá an toàn: Đồng bộ với `src/lib/calc/checks.ts`. Phân biệt rõ hai chế
   độ:
   - Hệ neo cọc BTCT (Huổi Vanh): Đánh giá qua BP-1 đến BP-5 và C2, C6.
   - Hệ neo kéo / trọng lực: Đánh giá qua C1 đến C7.

--------------------------------------------------------------------------------
3. CHECKLIST KIỂM THỬ TRƯỚC KHI DEPLOY (QA / CI CHECKLIST)
--------------------------------------------------------------------------------
Mỗi khi cập nhật mã nguồn hoặc thông số dự án, BẮT BUỘC thực hiện 3 bước kiểm tra:
  Bước 1: Chạy kiểm thử tự động toàn bộ test suite
          `npm test`
          => Đảm bảo toàn bộ 30 unit tests trong `src/lib/calc/__tests__/` ĐẠT 100%.

  Bước 2: Kiểm tra biên dịch TypeScript và đóng gói Vite
          `npm run build`
          => Đảm bảo không có lỗi type check (tsc) hay cảnh báo bundle.

  Bước 3: Kiểm tra giao diện người dùng (UI/UX)
          `npm run dev`
          - Mở tab "7. Hướng Dẫn Sử Dụng", kiểm tra chuyển đổi mượt mà giữa 6 tab con.
          - Nhấp vào các nút mũi tên trên Sơ đồ cơ học SVG (Gió bão, Cọc bờ, Cọc đáy)
            để đảm bảo panel diễn giải hiển thị đúng.
          - Thử tìm kiếm từ khóa trong ô FAQ (ví dụ: "Broms", "Cáp", "MBL", "Không đạt").
          - Bấm nút "In Thuyết Minh / Xuất PDF" trong tab Báo Cáo Kỹ Thuật để xác nhận
            định dạng in A4 không bị vỡ khung.

--------------------------------------------------------------------------------
4. THÔNG TIN LIÊN HỆ & HỖ TRỢ KỸ THUẬT
--------------------------------------------------------------------------------
- Hồ sơ kỹ thuật: Tham khảo thư mục `docs/SPEC.md` và `docs/HUONG_DAN_SU_DUNG.md`.
- Dữ liệu tọa độ 299 điểm cọc: Tham khảo `src/data/huoiVanhCoordinates.json`.
- Catalogue cáp PES: Tham khảo `src/data/pesCables.json`.

Chúc bạn hoàn thành tốt nhiệm vụ được giao!
================================================================================
```
