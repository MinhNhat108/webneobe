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
- **Hệ cọc neo (V2, 2026-09-27):** **304 điểm neo = 304 tuyến cáp**, là KẾT QUẢ THIẾT KẾ của `scripts/planMooringLayoutV2.mjs`; **343 cọc** vì 39 điểm neo của BÈ 5 dùng cọc đôi (141 cọc bờ + 202 cọc đáy). KHÔNG lấy cọc từ DXF (cọc trong DXF Revit là cọc dummy; từ DXF chỉ lấy 12 đa giác bè):
  - **129 Cọc bờ (`SHORE`)** bố trí trên sườn đồi ven hồ (script không bao giờ dời cọc bờ).
  - **175 Cọc đáy hồ (`BED`)**, cách mọi bè $\ge 5.0\,\text{m}$, đặt trên tim khe khi khe giữa hai bè hẹp hơn 35 m.
  - **CỌC BỜ: CỌC KHOAN NHỒI TRÒN D350, đổ bê tông tại chỗ** (`shorePileShape: 'circular'`; Chủ đầu tư chốt 2026-10-04 là phương án chính: khoan, thả lồng thép, đổ bê tông — máy nhỏ đi được trên bờ dốc, không rung). **CỌC ĐÁY: CỌC VUÔNG ĐÚC SẴN 350 × 350, 4 thanh thép góc**, đóng từ sà lan (`bedPileShape: 'square'`). Thép từng bè trong `HUOI_VANH_RAFTS`: cọc bờ `shoreRebarCount` thanh trên vòng tròn (4Φ32, 6Φ25–6Φ32, 8Φ28–8Φ32; $L_{tk} = 6.5 \div 7.0$ m), cọc đáy 4Φ20–4Φ32 ($L_{tk} = 8 \div 10.5$ m). CB400-V, riêng BÈ 9 CB500-V. Cả 12 bè ĐẠT với $\gamma = 1.2$.
  - **Cọc tròn yếu hơn cọc vuông khi chịu uốn:** 4 thanh trên vòng tròn chỉ cho $M_{rd} = R_s A_{bar} \cdot 2 r_s$ ở hướng lồng thép bất lợi nhất (lồng không định hướng khi thả vào lỗ khoan) — bằng MỘT NỬA cọc vuông 4 thanh góc cùng cỡ. Vì vậy cọc bờ tròn D350 cần 4–8 thanh (hàm lượng 3,1–6,7%), KHÔNG giữ được "4 thanh" như cọc vuông. Xem `ringLeverFactor()` trong `broms.ts`.
  - **Điều kiện về điểm móc cáp cọc bờ:** cáp phải móc sát cổ cọc, cách mặt đất 0,1 m (`anchor.shoreArm_e_m = 0.1`, trước 2026-10-04 là 0,5 m). Móc cao hơn thì mômen tăng và thép đã chọn không đủ. Đây là yêu cầu thi công, phải ghi trên bản vẽ.
  - **BÈ 5 dùng CỌC ĐÔI** (Chủ đầu tư chốt 2026-10-03): mỗi điểm neo 2 cọc 350×350 đặt cạnh nhau, vuông góc phương cáp, cách nhau ≥ 3a, chung đài/bích neo (`shorePilesPerPoint` / `bedPilesPerPoint` = 2). Mỗi cọc kiểm tra với $T / (2 \times 0{,}9)$ — hệ số làm việc nhóm 0,9 là GIẢ ĐỊNH (`anchor.pileGroupEfficiency`). Một cọc 350 đơn không chịu nổi BÈ 5 (uốn cọc bờ 1,09; cọc đáy cần 16 m). Đài/bích neo chung chưa được thiết kế. Mô phỏng 3D vẽ một cọc đại diện mỗi điểm.
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
  - Góc nghiêng giàn pin: $12^\circ$ (người dùng chốt 2026-10-03, trước đó $15^\circ$), hệ số khí động $C_d = 1.15$, xét hiệu ứng chắn gió giàn pin.
- **Tải trọng thủy lực & kết hợp:** DNV-ST-0119 & TCVN 6170-3:1998
  - Lực dòng chảy và sóng nhỏ hồ chứa kết hợp $1.05 \times F_{\text{wind}}$.
- **Đường cong Catenary & Cáp neo:**
  - Cáp sợi tổng hợp Polyester (PES-28, PES-32, PES-36, PES-40, PES-48).
  - Hệ số an toàn kéo đứt: $SF = T_{\text{brk}} / T_{\max} \ge 1.67$.
- **Địa kỹ thuật cọc neo Broms:**
  - Đất sườn đồi: Đất sét dẻo cứng, $\phi = 28^\circ, c = 12\,\text{kPa}, \gamma = 18\,\text{kN/m}^3$.
  - Cọc vuông BTCT: Kiểm tra Broms BP-1..BP-5 (ngang, uốn, nhổ) tại chiều sâu thiết kế $L_{tk}$, FS Broms = 2.5; chọn hệ số sử dụng $\le 0.95$.
  - **Uốn cọc theo TCVN 5574:2018** (`pileMrd_kNm` trong `broms.ts`, sửa 2026-10-03): $M_{rd} = R_s \cdot A_{s,kéo} \cdot (a - 2a_s)$ với thép một mặt, $a_s = 50$ mm, CB400-V $R_s = 350$ MPa; cọc không thép chỉ có $M = R_{bt} \cdot W$. Kiểm tra $\gamma \cdot M_{max} \le M_{rd}$ với $\gamma = 1.2$ (`anchor.pileBendingLoadFactor`, hệ số vượt tải gió TCVN 2737:1995). Công thức cũ $0.9 R_b W + A_s f_y 0.85D$ cho kết quả cao hơn 5–12 lần — KHÔNG dùng lại.
  - Góc cáp tại cọc đáy lấy theo tuyến cáp đáy NGẮN NHẤT của mỗi bè (`bedAnchorDist_m`), tức cáp dốc nhất và lực nhổ lớn nhất.
- **Tải gió trong engine:** nghiêng 12°, $C_d = 1.15$, $V = 30\,\text{m/s}$ ($q = 0.56 \ge 0.54\,\text{kN/m}^2$). So với 15°: lực môi trường và $T_{\max}$ giảm 17–19%. Danh mục cáp/cọc trong `HUOI_VANH_RAFTS` vẫn là bộ đã định cỡ ở 15° (dư an toàn hơn ở 12°), CHƯA định cỡ lại.
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
  - `deadweight.ts`: Phương án 2 — khối bê tông trọng lực thay cọc đáy hồ (cọc bờ giữ nguyên). DW-1 trượt, DW-2 nhấc bổng, DW-3 lật, DW-4 áp lực nền bùn (q = max của nước lặng và áp lực mép khi chịu tải). Hai cơ chế chống trượt (`slidingModel`): `friction` (MẶC ĐỊNH, đáy phẳng, μ·(W_sub − V)) và `shear_key` (gờ chống trượt cắm vào bùn, c_u·A + 2·c_u·z_s·B, theo NCEL). Tai neo cáp đặt cao `tieHeight_m` = 0,3 m trên đáy khối. Mặc định μ = 0,35; c_u bùn mặt = 10 kPa; z_s = 0,5 m; SF = 1,5; q_allow = 40 kPa; ρ_c = 2,4 — đều là GIẢ ĐỊNH, chưa có khảo sát đáy hồ. Khối lượng làm tròn lên 0,5 T, kích thước làm tròn lên 0,05 m. Với đáy phẳng, cáp thoải hơn KHÔNG làm khối nhẹ đi (H tăng).
  - `technicalComparison.ts`: `compareMooringOptions()` — so sánh KỸ THUẬT thuần túy PA1/PA2 (kích thước, trọng lượng, thể tích bê tông, diện tích chiếm đáy, hệ số an toàn). KHÔNG có tiền tệ / đơn giá (yêu cầu của người dùng 2026-10-03). Kết quả ở 12°, đáy phẳng: khối 42–129 tấn, đáy 2,9–4,3 m, ~5.390 m³. Với gờ chống trượt: 9–26 tấn, ~1.260 m³ nếu c_u bùn mặt 10–20 kPa (c_u = 5 kPa: 13–45 tấn, đáy tới 6,15 m).
- Phương án neo đáy nằm TRONG dự án: `anchor.bedAnchorOption` (`PA1_PILE` mặc định / `PA2_DEADWEIGHT`) và `anchor.deadweight`. Ở PA2, `calculateProject` trả `bedBlock`, các dòng cọc đáy (C11, BP-3..BP-5) thành "Không áp dụng" và DW-1..DW-4 thay thế; BP-1, BP-2 (cọc bờ) giữ nguyên. Tab 4, báo cáo, 3D, bảng 12 bè, Excel tổng hợp, và nút "Bảng Neo" / "Xuất CAD" đều đi theo phương án đang chọn.
- `src/lib/calc/pileCage.ts`: từ thép dùng trong kiểm tra uốn sang LỒNG THÉP thực tế và khối lượng một cọc. Cọc VUÔNG đúc sẵn: k thanh mỗi mặt → 4·(k − 1) thanh (2 → 4 thanh góc; 3 → 8; 4 → 12), đai Φ8 a100/a200, 2 móc cẩu Φ16, đúc nguyên một đoạn khi ≤ 12 m. Cọc TRÒN khoan nhồi: n thanh trên vòng tròn, đai xoắn Φ8 a150, đổ tại chỗ, không có móc cẩu. Đai và móc cẩu là CẤU TẠO (chưa tính lực cắt).
- `src/lib/io/pileSchedule.ts`: mỗi dòng có `pileCount`, `Ltotal_m`, `cage` (lồng thép, đai, phân đoạn, bê tông và thép một cọc); `summarisePileMaterials()` cho bảng tổng hợp vật tư. Hiện tại: 343 cọc (141 cọc bờ tròn D350 + 202 cọc đáy vuông), 3.057,1 m, 349,8 m³ bê tông, ≈ 87,2 tấn thép (≈ 249 kg/m³). `src/lib/io/pileCageDetailDxf.ts` vẽ chi tiết trên layer `08_CHI_TIET_COC`: mặt cắt cọc khoan nhồi tròn (4 / 6 / 8 thanh) và cọc vuông 4 thanh, cụm cọc đôi, sơ đồ cẩu. Đài/bích neo cọc đôi và mối nối cọc CHƯA thiết kế — bản vẽ ghi rõ.
- `src/lib/io/deadweightSchedule.ts`, `deadweightDxf.ts`, `deadweightExcel.ts`: bảng thống kê và bản vẽ DXF R12 của PA2 (129 cọc bờ + 175 khối `HV-DW001..175`, lấy từ `results.bedBlock`). Bản vẽ/bảng PA1 (`dxfExport.ts`, `pileSchedule.ts`) không đổi. Mã cọc bờ giữ nguyên như PA1. Chi tiết khối chỉ là sơ đồ kích thước: cốt thép, tai cẩu, móc cáp CHƯA thiết kế nên không vẽ; KHÔNG vẽ chi tiết cấu tạo cọc (người dùng tự làm).
- **PA2 và mặt bằng hiện tại:** 304 điểm neo được bố trí cho cọc. `findBlockClashes()`: đáy phẳng → 18 cặp khối chồng lấn (tâm cách nhau từ 3,0 m, đáy khối 2,9–4,3 m); gờ chống trượt c_u = 20 kPa → 0 cặp, c_u = 10 → 8 cặp, c_u = 5 → 35 cặp. Bảng, bản vẽ và Tab 9 đều ghi cảnh báo này — không được ẩn.
- `src/components/simulation/`: Mô phỏng 3D WebGL Three.js (Mục 8 trên Web):
  - `ThreeSimulationCanvas.tsx`: Canvas WebGL, địa hình IFC, hạt gió 3D, mực nước động.
  - `SimulationControls.tsx`: Bảng điều khiển vận tốc gió, góc phương vị, thanh trượt mực nước.

---

## 4. QUY TẮC PHÁT TRIỂN & KIỂM THỬ
- Lệnh chạy test: `npx vitest run` (Toàn bộ tests phải luôn luôn PASS — 183 tests tại 2026-10-04).
- Lệnh build dự án: `npm run build` (Không được có lỗi TypeScript hay Vite build).
- Luôn đảm bảo tính trung thực kỹ thuật, không làm tròn cẩu thả dẫn đến sai lệch an toàn kết cấu thủy công.
