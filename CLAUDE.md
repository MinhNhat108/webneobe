# CLAUDE.md - Hướng Dẫn Kỹ Thuật Dự Án Điện Mặt Trời Nổi Hồ Huổi Vanh

Dự án phát triển ứng dụng Web kỹ thuật chuyên sâu phục vụ tính toán, thẩm định và mô phỏng 3D hệ thống neo bè cho dự án **Điện mặt trời nổi (FPV) Thủy điện Huổi Vanh**, tỉnh Điện Biên.

---

## 1. TỔNG QUAN HỆ THỐNG V2 (CẬP NHẬT THEO CAD & IFC MỚI)
- **Quy mô:** 12 Cụm bè pin mặt trời nổi (BÈ 1 đến BÈ 12).
- **Tổng diện tích mặt bằng:** $90.724\,\text{m}^2$ (Tăng 61.4% so với thiết kế sơ bộ $56.214\,\text{m}^2$; DXF Revit cập nhật 27/09/2026 23:12 cắt lại BÈ 5).
  - **BÈ 5 (Đại cụm phía Nam):** $16.436\,\text{m}^2$, hình chữ nhật $150 \times 109.57\,\text{m}$ (Chu vi $P = 519.1\,\text{m}$; mép Đông lùi từ X = 232.81 về 213.01 m, trước đây 19.405 m²).
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
  - Mức tối thiểu để cả 12 bè đạt C9 là $\sum \lceil P/15 \rceil = 300$ dây (BÈ 5 cần 35). Thiết kế giữ 304 dây: BÈ 5 có 39 dây với bước móc dọc mép $\le 15\,\text{m}$ trên toàn chu vi (mép Đông 150 m có 11 dây); không bè nào có cung hở > 60°.
  - Khi một đa giác bè thay đổi, script tự gắn lại móc của cọc bờ lên mép mới (cọc bờ không dời) và bố trí lại toàn bộ dây đáy của bè đó.
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
  - Cọc vuông BTCT: Kiểm tra Broms BP-1..BP-5 (ngang, uốn, nhổ) tại chiều sâu thiết kế $L_{tk}$, FS Broms = 2.5; thiết kế chọn hệ số sử dụng $\le 0.95$ cho cả 12 bè (cáp BÈ 5 PES-48 = 0.945).
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
- `src/lib/calc/raftState.ts`: `buildRaftProjectState()` ánh xạ một dòng `HUOI_VANH_RAFTS` thành `ProjectState` (dùng chung cho store và test). `resolveRaftState()` là quy tắc DUY NHẤT cho mọi màn hình nhiều bè (3D, bản đồ, bảng 12 bè, Excel/CAD): bè đang chọn = đúng `currentProject` đã sửa ở Tab 2 (kèm danh sách sai khác so với thiết kế chốt), 11 bè còn lại = catalogue. `HUOI_VANH_DEFAULT_PROJECT` KHÔNG phải BÈ 1 — trạng thái mở đầu là `buildRaftProjectState(default, BÈ 1)`.
- `src/data/huoiVanhTerrainMesh.json`: Lưới độ cao 128 × 113 (ô ~9 m) của Toposolid trong `dia hinh ho.ifc`, sinh bởi `node scripts/extractTerrainFromIfc.mjs` (không sửa tay). Hàng 0 = phía NAM (`rowOrder: south-to-north`). Cao độ lưu theo hệ IFC.
- **Hai hệ cao độ:** mặt nước trong IFC (slab "mat nuoc") ở 402,0 m ≡ MNDB 384,5 m của dự án → **IFC = cao độ dự án + 17,5 m**. Mô phỏng 3D (`src/components/simulation/sceneModel.ts`) quy đổi mọi thứ về cao độ dự án.
- `src/lib/calc/`: Bộ máy tính toán thủy lực, khí động và địa kỹ thuật:
  - `loads.ts`: Tính toán tải trọng gió, sóng, dòng chảy.
  - `catenary.ts`: Giải phương trình đường dây xích Catenary.
  - `broms.ts`: Tính toán sức chịu tải cọc theo phương pháp Broms.
  - `checks.ts`: Các kiểm tra an toàn C1..C11 và BP-1..BP-5 (C9 là kiểm tra bắt buộc).
  - `deadweight.ts`: Phương án 2 — khối bê tông trọng lực thay 175 cọc đáy hồ (cọc bờ giữ nguyên). Định cỡ theo DW-1 trượt, DW-2 nhấc bổng, DW-3 lật, DW-4 áp lực nền bùn (q = max của nước lặng và áp lực mép khi chịu tải). Mặc định μ = 0,35; SF = 1,5; q_allow = 40 kPa; ρ_c = 2,4 — đều là GIẢ ĐỊNH, chưa có khảo sát đáy hồ. Khối lượng làm tròn lên 0,5 T, kích thước làm tròn lên 0,05 m.
  - `technicalComparison.ts`: `compareMooringOptions()` — so sánh KỸ THUẬT thuần túy PA1/PA2 (kích thước, trọng lượng, thể tích bê tông, diện tích chiếm đáy, hệ số an toàn). KHÔNG có tiền tệ / đơn giá (yêu cầu của người dùng 2026-10-03). Kết quả hiện tại: khối 51–156 tấn, đáy 3,35–5,5 m, ~6.530 m³ so với ~396 m³ cọc đáy.
- Phương án neo đáy nằm TRONG dự án: `anchor.bedAnchorOption` (`PA1_PILE` mặc định / `PA2_DEADWEIGHT`) và `anchor.deadweight`. Ở PA2, `calculateProject` trả `bedBlock`, các dòng cọc đáy (C11, BP-3..BP-5) thành "Không áp dụng" và DW-1..DW-4 thay thế; BP-1, BP-2 (cọc bờ) giữ nguyên. Tab 4, báo cáo, 3D, bảng 12 bè và Excel tổng hợp đi theo. Bảng thống kê cọc và DXF vẫn liệt kê cọc đáy PA1.
- `src/components/simulation/`: Mô phỏng 3D WebGL Three.js (Mục 8 trên Web):
  - `ThreeSimulationCanvas.tsx`: Canvas WebGL, địa hình IFC, hạt gió 3D, mực nước động.
  - `SimulationControls.tsx`: Bảng điều khiển vận tốc gió, góc phương vị, thanh trượt mực nước.

---

## 4. QUY TẮC PHÁT TRIỂN & KIỂM THỬ
- Lệnh chạy test: `npx vitest run` (Toàn bộ tests phải luôn luôn PASS — 153 tests tại 2026-10-03).
- Lệnh build dự án: `npm run build` (Không được có lỗi TypeScript hay Vite build).
- Luôn đảm bảo tính trung thực kỹ thuật, không làm tròn cẩu thả dẫn đến sai lệch an toàn kết cấu thủy công.
