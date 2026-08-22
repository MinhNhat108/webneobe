# TÀI LIỆU KỸ THUẬT & HƯỚNG DẪN DÀNH CHO FULLSTACK DEVELOPER
## DỰ ÁN: WEB TÍNH TOÁN HỆ NEO BÈ PIN MẶT TRỜI NỔI (FLOATING SOLAR FPV)

> **Mục đích:** Tài liệu bàn giao kỹ thuật, kiến trúc mã nguồn, quy trình build/deploy, luồng dữ liệu state management và hướng dẫn mở rộng/bảo trì dành cho lập trình viên Fullstack.  
> **Phiên bản:** 2.0 (Chuẩn hóa Hồ Huổi Vanh - 13 Cụm Bè & 299 Điểm Neo)

---

## 1. TỔNG QUAN CÔNG NGHỆ (TECH STACK)

- **Frontend Core:** React 18.3 (`react`, `react-dom`) + TypeScript 5.7 (Strict Type Checking).
- **Build Tool & Dev Server:** Vite 7 (với `@vitejs/plugin-react`).
- **Styling:** Tailwind CSS v3.4 + `@layer components` trong `src/index.css` + `clsx` & `tailwind-merge` (`src/lib/cn.ts`).
- **State Management & Persistence:** Zustand v5 (`zustand/middleware/persist` có migration versioning).
- **Calculation Engine (Pure TS):** Thuật toán cơ học thủy công, phương pháp Broms, tiêu chuẩn an toàn C1-C7, chạy 100% Client-Side.
- **I/O & File Parsers:**
  - `xlsx` (SheetJS): Đọc/ghi file Excel `.xlsx`, `.csv`.
  - `dxf-parser`: Đọc và render bản vẽ CAD `.dxf` trực tiếp trên HTML5 Canvas.
- **Icon Set:** `lucide-react`.
- **Testing Framework:** `vitest` (30 test cases kiểm thử tự động toàn diện).

---

## 2. CẤU TRÚC THƯ MỤC MÃ NGUỒN

```
Web tính neo bè/
├── dist/                         # Thư mục build tĩnh sau khi chạy `npm run build`
├── docs/                         # Hồ sơ kỹ thuật và hướng dẫn
│   ├── SPEC.md                   # Đặc tả kỹ thuật phần mềm (Design Specification)
│   ├── HUONG_DAN_SU_DUNG.md      # Sách hướng dẫn sử dụng cho người dùng cuối (End-user)
│   └── FULLSTACK_DEVELOPER_GUIDE.md # Tài liệu kiến trúc cho Fullstack Developer (File này)
├── public/
│   └── docs_huoi_vanh/           # Tài liệu đính kèm mặc định (PDF bản vẽ, Excel, ảnh phối cảnh)
├── src/
│   ├── components/               # Giao diện người dùng (UI Components)
│   │   ├── auth/                 # Màn hình PasswordGate bảo vệ truy cập
│   │   ├── excel/                # ImportDialog, PreviewGrid (Nhập Excel)
│   │   ├── files/                # AttachmentPanel, DxfViewer (CAD), PdfViewer, ImageViewer
│   │   ├── input/                # Biểu mẫu nhập liệu (ProjectForm, RaftForm, EnvForm, LineForm, AnchorForm, CriteriaForm)
│   │   ├── layout/               # AppShell (Main Layout), Header, Sidebar
│   │   ├── map/                  # MooringLayoutMap (Canvas 2D tương tác 13 bè & 299 điểm neo)
│   │   ├── report/               # ReportView (Báo cáo in ấn A4 chuẩn duyệt)
│   │   └── results/              # VerdictBadge, CheckTable, IntermediateTable, RaftsOverviewTable
│   ├── data/                     # Dữ liệu tĩnh dự án Hồ Huổi Vanh & Catalogue tra cứu
│   │   ├── huoiVanhProject.ts    # Dữ liệu mặc định 13 cụm bè và thông số thiết kế
│   │   ├── huoiVanhCoordinates.json # 299 tọa độ điểm neo X, Y, Z và tim tuyến cáp
│   │   ├── pesCables.json        # Catalogue cáp Polyester PES (PES-24 đến PES-48, MBL, trọng lượng)
│   │   ├── chainGrades.json      # Cấp xích neo (U1, U2, U3)
│   │   ├── anchorTypes.json      # Hệ số bám mỏ neo (Danforth, AC-14, Hall...)
│   │   ├── soils.json            # Thông số đất nền (bùn, sét, cát)
│   │   └── importKeys.json       # Mapping key-value khi import từ Excel
│   ├── lib/
│   │   ├── calc/                 # THƯ VIỆN TÍNH TOÁN CƠ HỌC HỆ NEO
│   │   │   ├── index.ts          # Pipeline tính toán chính: calculateProject()
│   │   │   ├── loads.ts          # Tính tải trọng gió FPV, sóng, dòng chảy, lực căng cáp T_max
│   │   │   ├── broms.ts          # Phương pháp Broms cọc ngàm đất dính, M_rd bê tông, ma sát nhổ
│   │   │   ├── catenary.ts       # Mô hình hình học dây võng Catenary (khi áp dụng)
│   │   │   ├── checks.ts         # Đánh giá 7 tiêu chí an toàn (C1 -> C7, PASS/FAIL/SKIP)
│   │   │   ├── constants.ts      # Hằng số vật lý, hàm phụ trợ
│   │   │   ├── types.ts          # TypeScript interfaces/types toàn hệ thống
│   │   │   └── __tests__/        # Unit tests với Vitest (30 bài kiểm thử)
│   │   ├── io/                   # Thư viện đọc/ghi file
│   │   │   ├── excelExport.ts    # Xuất file Excel 6 sheets định dạng đẹp
│   │   │   ├── excelImport.ts    # Phân tích file Excel/CSV nạp vào Store
│   │   │   └── dxf.ts            # Parser DXF CAD
│   │   ├── cn.ts                 # Tiện ích nối class Tailwind (clsx + twMerge)
│   │   └── format.ts             # Định dạng số liệu, đơn vị đo
│   ├── store/
│   │   └── useProjectStore.ts    # Global State Store (Zustand + LocalStorage Persist)
│   ├── App.tsx                   # Root Component quản lý Auth Gate & AppShell
│   ├── index.css                 # Base, Component & Utility CSS layer
│   └── main.tsx                  # Entry point React 18
├── index.html                    # Single Page HTML Template
├── package.json                  # Dependencies & Scripts
├── tailwind.config.js            # Cấu hình Theme, Color Palette & Animations
├── tsconfig.json                 # TypeScript Configuration (Strict mode)
└── vite.config.ts                # Cấu hình Vite Build, relative base & Rollup code-splitting
```

---

## 3. LUỒNG DỮ LIỆU & QUẢN LÝ STATE (ZUSTAND STORE)

### 3.1 Store: `src/store/useProjectStore.ts`
Store lưu trữ trạng thái hiện tại của ứng dụng và tự động tính toán lại kết quả:

```typescript
interface ProjectStore {
  currentProject: ProjectState;     // Thông số dự án đang tính toán
  projectList: Array<...>;          // Danh sách các dự án
  activeRaftId: number;             // ID cụm bè đang chọn (1 -> 13)
  raftsSummary: RaftSummaryItem[];  // Bảng tổng hợp 13 bè Huổi Vanh
  results: CalcResults;             // Kết quả tính toán cơ học (luôn đồng bộ)
  
  // Actions cập nhật từng phần
  updateMeta: (meta: Partial<ProjectMeta>) => void;
  updateRaft: (raft: Partial<RaftInput>) => void;
  updateEnv: (env: Partial<EnvInput>) => void;
  updateLine: (line: Partial<LineInput>) => void;
  updateAnchor: (anchor: Partial<AnchorInput>) => void;
  updateCriteria: (criteria: Partial<Criteria>) => void;
  
  // Hành động chuyển bè & dự án
  setActiveRaft: (raftId: number) => void;
  createNewProject: (name?: string, systemType?: SystemType) => void;
  resetToHuoiVanh: () => void;
  importProjectState: (state: ProjectState, rafts?: RaftSummaryItem[]) => void;
  recalculate: () => void;
}
```

### 3.2 Cơ chế Real-time Reactive Pipeline
Mỗi khi một hàm `updateRaft()`, `updateEnv()`, `updateLine()`, `updateAnchor()` được gọi:
1. State mới được hợp nhất (`mergedState = { ...current, ...partial }`).
2. Hàm `calculateProject(mergedState)` được thực thi đồng bộ ngay lập tức.
3. `results` mới được lưu vào store, kích hoạt React re-render lại toàn bộ bảng kiểm tra, kết quả và huy hiệu trong thời gian $< 1\text{ ms}$.

### 3.3 Persistence & Migration (LocalStorage)
Store được bọc bởi middleware `persist` với khóa lưu trữ `'mooring-calc-storage'`:
- `version: 3`: Tự động sanitize và nâng cấp phiên bản dữ liệu lưu trong trình duyệt.
- `onRehydrateStorage`: Khi trang web khởi động, nếu trong localStorage có dữ liệu cũ, hệ thống tự động chuẩn hóa về `systemType: 'solar_fpv'` và chạy `calculateProject()` đảm bảo không bị lỗi dữ liệu rác.

---

## 4. KIẾN TRÚC THƯ VIỆN TÍNH TOÁN CƠ HỌC (`src/lib/calc/`)

Pipeline tính toán được gói gọn trong hàm `calculateProject(state: ProjectState)`:

```
[Input State: Raft, Env, Line, Anchor, Criteria]
                      │
                      ▼
 1. loads.ts: calculateLoads()
    ├── Dynamic wind pressure q = 0.5 * rho_air * V_wind^2
    ├── Wind load on tilted FPV panels: F_wind_panel = q * Cd * A_panel * sin(tilt) * eta_shield
    ├── Wind load on floats: F_wind_float = q * Cd * A_float
    ├── Environmental total: F_env = (F_wind + F_current + F_wave) * waveCurrentFactor
    └── Governed Line Tension: T_max = max(T_focus, T_geometric)
                      │
                      ▼
 2. broms.ts: calculateBromsCohesive()
    ├── Ultimate Lateral Capacity Hu via moment equilibrium in cohesive soil (cu)
    ├── Allowable Lateral Capacity H_allow = Hu / FS (FS = 2.5)
    ├── Max Bending Moment M_max & Plastic Concrete Moment Capacity Mrd = 0.9 * Rb * D^3 / 6
    └── Pile Uplift Capacity: Tv_allow = (alpha * cu * Perimeter * L) / FS_uplift
                      │
                      ▼
 3. checks.ts: evaluateChecks()
    ├── C1: Sức chịu ngang cọc bờ (H_applied <= H_allow_shore)
    ├── C2: Bền kéo đứt cáp nguyên vẹn (T_max * FS_intact <= MBL)
    ├── C3: Sức bám cọc đáy kéo ngang (H_bed <= H_allow_bed)
    ├── C4: Ổn định mỏ neo kéo ngang (nếu dùng mỏ neo)
    ├── C5: Sức chịu nhổ cọc đáy lòng hồ (Tv_bed <= Tv_allow_bed)
    ├── C6: Bền kéo đứt cáp khi đứt 1 dây (T_max_damaged * FS_damaged <= MBL)
    └── C7: Bền tiết diện uốn cọc bờ (M_max <= Mrd)
                      │
                      ▼
[Output: CalcResults (overallVerdict: 'PASS' | 'FAIL' | 'NA')]
```

---

## 5. CÁC ĐIỂM CẦN LƯU Ý KHI PHÁT TRIỂN & MỞ RỘNG (DEV GUIDELINES)

1. **Relative Base Path trong `vite.config.ts`:**
   - Thuộc tính `base: './'` được thiết lập để toàn bộ tài nguyên (JS, CSS, hình ảnh) được nạp bằng đường dẫn tương đối.
   - Nhờ đó, ứng dụng có thể chạy trên bất kỳ môi trường nào: Localhost, Netlify (Root domain `/`) hoặc GitHub Pages (Subpath `https://username.github.io/repo-name/`).

2. **Rollup Manual Chunks:**
   - Các thư viện nặng như `xlsx` (~420 KB) và `dxf-parser` (~25 KB) đã được tách thành các chunks riêng biệt (`manualChunks`) trong `vite.config.ts`. Điều này giúp trang web tải cực nhanh ở lần truy cập đầu tiên mà không làm nghẽn băng thông.

3. **Chạy Unit Test trước khi commit:**
   - Luôn chạy `npm test` để đảm bảo 30 bài kiểm thử Vitest pass 100%.
   - File test đặt tại: `src/lib/calc/__tests__/calc.test.ts`.

4. **Biến số và quy ước code:**
   - Giao diện người dùng: Tiếng Việt chuẩn kỹ thuật thủy công.
   - Mã nguồn, hàm, biến, type interface: Tiếng Anh chuẩn CamelCase / PascalCase.
   - Không sử dụng các class animation ngoài Tailwind core (đã cấu hình real keyframes trong `tailwind.config.js`).

---

## 6. QUY TRÌNH BUILD & DEPLOYMENT

### 6.1 Lệnh phát triển (Scripts)
```bash
# Cài đặt thư viện
npm install

# Khởi chạy server dev (Port mặc định: 5173)
npm run dev

# Chạy toàn bộ test cases
npm run test

# Đóng gói sản phẩm production vào thư mục dist/
npm run build

# Xem thử bản build production trên máy
npm run preview
```

### 6.2 Triển khai lên GitHub & Netlify (CI/CD Tự Động)
1. **Khởi tạo và đẩy lên GitHub:**
   ```bash
   git init
   git add .
   git commit -m "feat: release solar fpv mooring calc web v2.0"
   git branch -M main
   git remote add origin https://github.com/<your-username>/web-tinh-neo-be.git
   git push -u origin main
   ```
2. **Liên kết Netlify:**
   - Vào [app.netlify.com](https://app.netlify.com) -> Nhấn **Add new site** -> **Import an existing project**.
   - Chọn GitHub và chọn repository `web-tinh-neo-be`.
   - Cấu hình Build:
     - **Build command:** `npm run build`
     - **Publish directory:** `dist`
   - Nhấn **Deploy site**. Mỗi khi có `git push`, Netlify sẽ tự động kích hoạt pipeline build và phát hành bản mới sau 10 giây.

---
*Tài liệu kỹ thuật nội bộ bàn giao cho đội ngũ phát triển Fullstack.*