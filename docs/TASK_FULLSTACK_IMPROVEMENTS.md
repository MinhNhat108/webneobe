# KẾ HOẠCH PHÁT TRIỂN & CHỈ THỊ KỸ THUẬT CHO FULL-STACK DEVELOPER (SPRINT V2.1)

> **Ticket ID:** `bc611882-2d36-43f5-a98f-d3c9affe778c`  
> **Tiêu đề:** Xuất DXF mặt bằng neo và Tối ưu hóa dây neo 13 bè  
> **Người giao việc:** Senior Project Manager  
> **Người nhận nhiệm vụ:** Full-Stack Developer (Claude)  
> **Dự án:** Web tính neo bè pin mặt trời nổi (Huổi Vanh)  
> **Ngày phê duyệt:** 11/09/2026  

---

## 1. MỤC TIÊU SPRINT (SPRINT GOAL)
Nâng cấp ứng dụng từ mức "tính toán kiểm tra thụ động" lên "bộ công cụ thiết kế & xuất bản vẽ tự động", tập trung vào 2 năng lực cốt lõi:
1. **Feature 1 - Xuất bản vẽ CAD mặt bằng hệ neo (.DXF):** Cho phép tải xuống file `.dxf` chuẩn AutoCAD chứa toàn bộ 13 cụm bè, 299 vị trí cọc và đường cáp neo phân màu theo layer.
2. **Feature 2 - Thuật toán Tối ưu hóa Dây neo (Mooring Auto-Solver):** Tự động tìm kiếm cấu hình số lượng dây neo tối thiểu cho từng bè để đạt 100% tiêu chí an toàn (C1-C9 & BP1-BP5) với chi phí vật tư tối ưu nhất.

---

## 2. CHI TIẾT KỸ THUẬT & YÊU CẦU TRIỂN KHAI (USER STORIES)

### User Story 1: Xuất file CAD mặt bằng hệ neo (.DXF)
* **Mô tả:** Là một Kỹ sư thiết kế / Khảo sát, tôi muốn xuất trực tiếp dữ liệu 13 cụm bè và 299 điểm cọc neo ra file CAD `.dxf` từ trình duyệt, để tôi có thể mở ngay trên AutoCAD mà không phải nhập thủ công từng tọa độ.
* **Vị trí UI:**
  - Nút bấm **"Xuất CAD (.DXF)"** trên thanh `Header.tsx` (cạnh nút "Xuất Excel").
  - Hoặc trong tab `src/components/files/FilesView.tsx` và `src/components/results/MooringLayoutMap.tsx`.
* **Cấu trúc File DXF yêu cầu (`src/lib/io/dxfExport.ts`):**
  - Không cần cài thêm thư viện nặng ngoài; tạo trực tiếp chuỗi text DXF chuẩn ASCII (R12 hoặc 2000 format) với các cặp mã nhóm (Group Codes: 0, 8, 10, 20, 30, 11, 21, 31, 62...).
  - **Hệ thống Layer quy chuẩn:**
    - `01_BE_PIN` (Màu 4 - Cyan): Đường bao hình chữ nhật của 13 cụm bè (LWPOLYLINE hoặc 4 đoạn LINE khép kín) kèm chữ số định danh bè (TEXT/MTEXT).
    - `02_DAY_NEO_BO` (Màu 3 - Green): Đường thẳng nối từ mép bè tới vị trí cọc neo trên bờ (`shoreLineCount`).
    - `03_DAY_NEO_DAY` (Màu 1 - Red): Đường thẳng nối từ mép bè tới vị trí cọc cắm đáy hồ (`bedLineCount`).
    - `04_COC_NEO_BO` (Màu 2 - Yellow): Ký hiệu cọc bờ (vòng tròn CIRCLE bán kính 0.5m kèm tâm POINT).
    - `05_COC_NEO_DAY` (Màu 6 - Magenta): Ký hiệu cọc đáy hồ (hình vuông hoặc vòng tròn).
    - `06_TOA_DO_TEXT` (Màu 7 - White): Text ghi chú mã cọc (ví dụ: `B01-S01`, `B01-B01`).
* **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - [ ] Tạo file `src/lib/io/dxfExport.ts` với hàm `exportMooringToDXF(state: ProjectState, batchResults: RaftBatchResult[]): void`.
  - [ ] File DXF tải về có tên định dạng `mat-bang-neo_<code-du-an>_<YYYYMMDD>.dxf`.
  - [ ] File mở được trên AutoCAD / DWG TrueView mà không báo lỗi "Syntax error on line X".
  - [ ] Tọa độ các điểm neo khớp chính xác với `huoiVanhCoordinates.json`.

---

### User Story 2: Thuật toán Tối ưu hóa Dây neo (Mooring Auto-Solver)
* **Mô tả:** Là một Kỹ sư kết cấu, tôi muốn bấm 1 nút để hệ thống tự động tính toán và điều chỉnh số lượng dây neo (N_eff, tổng dây, cọc bờ, cọc đáy) cho cả 13 bè hoặc bè đang chọn, sao cho toàn bộ tiêu chí an toàn đạt chuẩn (PASS) mà không bị dư thừa dây quá mức.
* **Vị trí UI:**
  - Nút **"Tối Ưu Hóa Dây Neo"** (Icon `Wand2` hoặc `Sparkles`) tại:
    - Tab `LineForm.tsx` (Tối ưu cho bè hiện tại).
    - Tab `RaftsOverviewTable.tsx` / `ResultsView.tsx` (Nút "Tự Động Tối Ưu Toàn Bộ 13 Bè").
* **Nguyên tắc giải thuật (`src/lib/calc/optimizer.ts`):**
  1. Xác định điều kiện ràng buộc:
     - Tiêu chí bắt buộc: `C1` đến `C8` phải `PASS`.
     - Tiêu chí `C9` (khoảng cách $\le 15\text{ m}$): ưu tiên đạt nếu chu vi bè cho phép.
     - Cọc Broms bờ (`BP-1, BP-2`) và đáy (`BP-3, BP-4, BP-5`) phải `PASS` ($UF \le 1.0$).
  2. Bắt đầu từ giá trị tối thiểu:
     - $N_{eff,min} = \lceil \frac{F_{env}}{T_{allow} \cdot \cos\alpha} \rceil$.
     - $N_{total,min} = \max(4, \lceil \frac{\text{Chu vi}}{15} \rceil, N_{eff,min} \times 2)$.
  3. Lặp tăng dần ($N_{eff}++$ và phân bổ tỷ lệ bờ/đáy) cho đến khi toàn bộ hàm `evaluateChecks` trả về kết luận `overallStatus === 'PASS'`.
  4. Trả về cấu hình tối ưu kèm thông số so sánh trước và sau khi tối ưu.
* **Tiêu chí nghiệm thu (Acceptance Criteria):**
  - [ ] Hàm `optimizeMooringLine(projectState: ProjectState): OptimizedResult` chạy không block UI (thời gian thực thi < 500ms cho cả 13 bè).
  - [ ] Có thông báo Toast hoặc Modal hiển thị kết quả so sánh: (Số dây cũ $\rightarrow$ Số dây mới, T_max giảm từ X sang Y).
  - [ ] Trạng thái dự án tự động chuyển sang PASS cho các bè được áp dụng.

---

## 3. CHECKLIST KIỂM THỬ TRƯỚC KHI SUBMIT REVIEW (QA CHECKLIST)
Developer BẮT BUỘC kiểm tra đủ các bước sau trước khi tạo commit:
1. `npm test`: Toàn bộ test suite cũ (47 tests) và các test mới viết thêm PHẢI PASS 100%.
2. `npm run build`: Không có lỗi cú pháp TypeScript, không warning bundle chunk quá mức.
3. Chạy thử trên trình duyệt (`npm run dev`):
   - Bấm "Xuất CAD (.DXF)" $\rightarrow$ Tải file về thành công.
   - Thử mở hoặc kiểm tra định dạng text file `.dxf`.
   - Bấm nút "Tối Ưu Hóa Dây Neo" $\rightarrow$ Dữ liệu cập nhật mượt mà, không lỗi re-render vô tận.

---
