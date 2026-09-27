# CLAUDE.md - Hướng Dẫn Kỹ Thuật Dự Án Điện Mặt Trời Nổi Hồ Huổi Vanh

Dự án phát triển ứng dụng Web kỹ thuật chuyên sâu phục vụ tính toán, thẩm định và mô phỏng 3D hệ thống neo bè cho dự án **Điện mặt trời nổi (FPV) Thủy điện Huổi Vanh**, tỉnh Điện Biên.

---

## 1. TỔNG QUAN HỆ THỐNG V2 (CẬP NHẬT THEO CAD & IFC MỚI)
- **Quy mô:** 12 Cụm bè pin mặt trời nổi (BÈ 1 đến BÈ 12).
- **Tổng diện tích mặt bằng:** $93.693\,\text{m}^2$ (Tăng 66.7% so với thiết kế sơ bộ $56.214\,\text{m}^2$).
  - **BÈ 5 (Đại cụm phía Nam):** $19.405\,\text{m}^2$ (Chu vi $P = 558.7\,\text{m}$).
  - **BÈ 9 (Đại cụm trung tâm hồ):** $10.979\,\text{m}^2$ (Chu vi $P = 472.1\,\text{m}$).
  - **BÈ 8 (Cụm phía Đông Bắc):** $9.869\,\text{m}^2$ (Chu vi $P = 440.4\,\text{m}$).
  - **BÈ 10 (Cụm trung tâm - Bắc):** $9.580\,\text{m}^2$ (Chu vi $P = 432.5\,\text{m}$).
  - **BÈ 6 (Cụm Đông Nam):** $8.181\,\text{m}^2$ (Chu vi $P = 371.1\,\text{m}$).
  - **BÈ 4 (Cụm phía Nam):** $6.878\,\text{m}^2$ (Chu vi $P = 370.1\,\text{m}$).
  - **BÈ 7 (Cụm phía Đông):** $6.868\,\text{m}^2$ (Chu vi $P = 388.3\,\text{m}$).
  - **BÈ 3 (Cụm Tây Nam):** $5.584\,\text{m}^2$ (Chu vi $P = 312.0\,\text{m}$).
  - **BÈ 1 (Cụm Tây Bắc):** $4.122\,\text{m}^2$ (Chu vi $P = 276.2\,\text{m}$).
  - **BÈ 2 (Cụm phía Tây):** $4.118\,\text{m}^2$ (Chu vi $P = 288.0\,\text{m}$).
  - **BÈ 11 (Cụm phía Bắc):** $4.091\,\text{m}^2$ (Chu vi $P = 258.1\,\text{m}$).
  - **BÈ 12 (Cụm cực Bắc):** $4.018\,\text{m}^2$ (Chu vi $P = 293.0\,\text{m}$).
- **Hệ cọc neo (V2, 2026-09-27):** Tổng cộng **304 cọc = 304 tuyến cáp**, là KẾT QUẢ THIẾT KẾ của `scripts/planMooringLayoutV2.mjs`. KHÔNG lấy cọc từ DXF (cọc trong DXF Revit là cọc dummy; từ DXF chỉ lấy 12 đa giác bè):
  - **129 Cọc bờ (`SHORE`)** bố trí trên sườn đồi ven hồ (script không bao giờ dời cọc bờ).
  - **175 Cọc đáy hồ (`BED`)**, cách mọi bè $\ge 5.0\,\text{m}$, đặt trên tim khe khi khe giữa hai bè hẹp hơn 35 m.
  - **100% CỌC VUÔNG BTCT** (`shape: 'square'`, yêu cầu của Chủ đầu tư) — không dùng cọc tròn, không dùng công thức cọc tròn. Cạnh $a = 0.35 \div 0.60\,\text{m}$ và chiều sâu $L_{tk}$ định cỡ riêng từng bè trong `HUOI_VANH_RAFTS`.
  - Cần tối thiểu 303 dây để cả 12 bè đạt C9 ($\sum \lceil P/15 \rceil = 303$); dây thứ 304 (`B5-D39`) đóng cung hở 93° của BÈ 5 (giới hạn 60°).
- **Cao trình thủy văn hồ Huổi Vanh:**
  - Mực nước chết (MNC): $380.0\,\text{m}$.
  - Mực nước dâng bình thường (MNDB): $384.5\,\text{m}$.
  - Mực nước lũ kiểm tra (MNLKT): $386.0\,\text{m}$.

---

## 2. TIÊU CHUẨN KỸ THUẬT & CÔNG THỨC ÁP DỤNG
- **Tải trọng gió:** TCVN 2737:2023
  - Vùng gió II-B: $V_{100} = 29.7\,\text{m/s}$, áp lực gió cơ sở $q_0 = 0.54\,\text{kN/m}^2$.
  - Góc nghiêng giàn pin: $15^\circ$, hệ số khí động $C_d = 1.15$, xét hiệu ứng chắn gió giàn pin.
- **Tải trọng thủy lực & kết hợp:** DNV-ST-0119 & TCVN 6170-3:1998
  - Lực dòng chảy và sóng nhỏ hồ chứa kết hợp $1.05 \times F_{\text{wind}}$.
- **Đường cong Catenary & Cáp neo:**
  - Cáp sợi tổng hợp Polyester (PES-28, PES-32, PES-36, PES-40, PES-48).
  - Hệ số an toàn kéo đứt: $SF = T_{\text{brk}} / T_{\max} \ge 1.67$.
- **Địa kỹ thuật cọc neo Broms:**
  - Đất sườn đồi: Đất sét dẻo cứng, $\phi = 28^\circ, c = 12\,\text{kPa}, \gamma = 18\,\text{kN/m}^3$.
  - Cọc vuông BTCT: Kiểm tra Broms BP-1..BP-5 (ngang, uốn, nhổ) tại chiều sâu thiết kế $L_{tk}$, FS Broms = 2.5; thiết kế chọn hệ số sử dụng $\le 0.95$ (riêng cáp BÈ 5 = 0.975 vì PES-48 là cáp lớn nhất trong danh mục).
  - Góc cáp tại cọc đáy lấy theo tuyến cáp đáy NGẮN NHẤT của mỗi bè (`bedAnchorDist_m`), tức cáp dốc nhất và lực nhổ lớn nhất.
- **Tải gió trong engine:** nghiêng 15°, $C_d = 1.15$, $V = 30\,\text{m/s}$ ($q = 0.56 \ge 0.54\,\text{kN/m}^2$).
- **Tiêu chuẩn khoảng cách cáp (C9, BẮT BUỘC):** $s_{\text{avg}} = P_{\text{bè}} / N_{\text{dây}} \le 15.0\,\text{m}$ cho tất cả 12 bè, với $P_{\text{bè}}$ là chu vi đa giác đo được (`raft.perimeter_m`).

---

## 3. CẤU TRÚC MÃ NGUỒN CHÍNH
- `src/data/huoiVanhProject.ts`: Danh mục 12 cụm bè và cấu hình dự án mặc định.
- `src/data/huoiVanhRaftPolygons_v2.json`: Đa giác ranh giới 12 cụm bè V2.
- `src/data/huoiVanhCoordinates_v2.json`: 304 tuyến cáp neo (sinh bởi `node scripts/planMooringLayoutV2.mjs`, không sửa tay).
- `src/data/huoiVanhPiles_v2.json`: 304 cọc vuông BTCT (129 SHORE + 175 BED), suy ra từ file tuyến cáp.
- `src/data/huoiVanhLayout.ts`: Điểm truy cập DUY NHẤT tới layout V2 cho engine, bản đồ, bảng cọc, Excel và CAD.
- `src/lib/calc/raftState.ts`: `buildRaftProjectState()` ánh xạ một dòng `HUOI_VANH_RAFTS` thành `ProjectState` (dùng chung cho store và test).
- `src/data/huoiVanhTerrainMesh.json`: Lưới độ cao $64 \times 64$ trích xuất từ file Revit `dia hinh ho.ifc`.
- `src/lib/calc/`: Bộ máy tính toán thủy lực, khí động và địa kỹ thuật:
  - `loads.ts`: Tính toán tải trọng gió, sóng, dòng chảy.
  - `catenary.ts`: Giải phương trình đường dây xích Catenary.
  - `broms.ts`: Tính toán sức chịu tải cọc theo phương pháp Broms.
  - `checks.ts`: Các kiểm tra an toàn C1..C11 và BP-1..BP-5 (C9 là kiểm tra bắt buộc).
- `src/components/simulation/`: Mô phỏng 3D WebGL Three.js (Mục 8 trên Web):
  - `ThreeSimulationCanvas.tsx`: Canvas WebGL, địa hình IFC, hạt gió 3D, mực nước động.
  - `SimulationControls.tsx`: Bảng điều khiển vận tốc gió, góc phương vị, thanh trượt mực nước.

---

## 4. QUY TẮC PHÁT TRIỂN & KIỂM THỬ
- Lệnh chạy test: `npx vitest run` (Toàn bộ 110 tests phải luôn luôn PASS).
- Lệnh build dự án: `npm run build` (Không được có lỗi TypeScript hay Vite build).
- Luôn đảm bảo tính trung thực kỹ thuật, không làm tròn cẩu thả dẫn đến sai lệch an toàn kết cấu thủy công.
