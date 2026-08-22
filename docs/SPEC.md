# SPEC — Web tính neo bè (Mooring / Raft Anchoring Calculation)

Version 1.0 — author: Project Manager — status: APPROVED FOR IMPLEMENTATION
Audience: the Full-Stack Developer step, then the QA step. Read this file before writing any code.

---

## 0. Product summary

A **100% client-side web application** that lets a marine / solar FPV engineer:

1. enter or import (Excel/CSV) the parameters of a raft (bè) and its environment,
2. attach and preview supporting documents (PDF, images, DXF drawings),
3. run the mooring calculation (environmental loads → line tension → catenary → anchor holding),
4. read a verdict table with **ĐẠT / KHÔNG ĐẠT** per check,
5. export the whole thing as an Excel workbook or a printable PDF report.

No backend, no database, no account. Uploaded drawings never leave the browser — this is a hard
requirement (client data is confidential) and it also makes the app deployable as static files.

---

## 1. Technology decision (fixed, do not re-litigate)

| Concern | Choice | Reason |
|---|---|---|
| Build | **Vite** | fastest static SPA toolchain, zero server |
| Framework | **React 18 + TypeScript (strict)** | calculation code must be typed; components are stateful |
| Styling | **Tailwind CSS v3** | requested by the client |
| State | **Zustand** + `persist` middleware (localStorage) | one flat project store, survives reload |
| Excel I/O | **SheetJS (`xlsx`)** | requested by the client; read + write |
| PDF report | **`window.print()` + a dedicated `@media print` stylesheet** | pixel-reliable, no headless-canvas artefacts, no extra MB |
| PDF preview | native `<iframe src={objectURL}>` | browser-native, zero dependency |
| Image preview | `<img src={objectURL}>` | — |
| DXF preview | **`dxf-parser` + custom `<canvas>` renderer** | see §6.3, degraded mode allowed |
| Tests | **Vitest** on `src/lib/calc/**` | the formulas are the product; they must be unit-tested |

UI language: **Vietnamese** (labels, units, verdicts). Code, identifiers and comments: **English**.
Units: **SI** everywhere internally (N, m, kg, s). The display layer converts to **kN / tấn / m / m/s**.

---

## 2. Scope

### 2.1 IN SCOPE (v1)

- Manual input form for raft, environment, chain/rope, anchor, and acceptance criteria.
- Excel/CSV import (`.xlsx`, `.xls`, `.csv`) with an editable preview grid and column mapping.
- Excel export of inputs + results; printable PDF report.
- Attachment panel (PDF / PNG / JPG / DXF) with in-page preview.
- Full calculation module per §5, with the checks of §5.6.
- Per-check and overall **ĐẠT / KHÔNG ĐẠT** verdict showing the governing value.
- Intact case + one-line-damaged case.
- Reference tables (anchor types, chain grades, soils) shipped as editable JSON, all values overridable in the UI.
- Autosave of the current project to localStorage; "Dự án mới" reset.

### 2.2 OUT OF SCOPE (v1 — do not build)

- Any backend, API, auth, multi-user, cloud storage.
- Dynamic / time-domain mooring analysis, FEM, irregular-wave spectral analysis.
- Multi-directional load rosette (360° sweep). v1 uses **one governing load direction**.
- DXF *editing*, layer manager, entity snapping, 3D DXF, blocks/xrefs beyond §6.3.
- Automatic drawing → geometry extraction (the drawing is documentary only).
- Mobile-first layout. Target is desktop ≥ 1280 px; the app must merely not break below that.
- i18n framework. Vietnamese strings are inline; no `t()` layer.
- Charts/graphs beyond the single catenary profile sketch.

### 2.3 Explicit non-goal: engineering authority

The app is a **calculation aid**, not a certification tool. Every result screen and the PDF report
must carry the disclaimer:

> *"Kết quả mang tính tham khảo kỹ thuật. Các thông số vật liệu (MBL, hệ số bám neo) phải được kiểm chứng theo catalogue nhà sản xuất và quy chuẩn áp dụng."*

---

## 3. Data model (`src/lib/calc/types.ts`)

```ts
type ProjectMeta = { name, code, location, designer, date, note }

type RaftInput = {
  length_m, width_m, draft_m, freeboardHeight_m,
  displacement_t,                       // khối lượng bè
  windAreaOverride_m2?,                 // if absent: width_m * freeboardHeight_m
  currentAreaOverride_m2?,              // if absent: width_m * draft_m
}

type EnvInput = {
  waterDepth_m, tideRange_m,
  windSpeed_ms, windCd,                 // default 1.2
  currentSpeed_ms, currentCd,           // default 1.2
  waveHs_m, waveTp_s, waveCd,           // default 1.0
  combinationFactor,                    // default 1.0
  waterDensity, airDensity, gravity,    // 1025 / 1.225 / 9.81, editable
}

type LineInput = {
  count,                                // N — số dây neo
  effectiveCount,                       // N_eff — số dây chịu tải theo hướng tính
  horizontalAngle_deg,                  // α — góc dây so với hướng tải
  type: 'chain' | 'rope' | 'combo',
  chainDiameter_mm, chainGrade: 'U1' | 'U2' | 'U3' | 'custom',
  mbl_kN,                               // input; estimator (§5.4) may prefill
  unitWeightAir_kgpm,                   // input; estimator may prefill
  totalLength_m,
  groundedLengthMin_m,                  // default 5
  seabedFrictionCoef,                   // default 1.0
}

type AnchorInput = {
  mode: 'drag' | 'deadweight',
  anchorType,                           // Danforth / AC-14 / Hall / Stockless / khối bê tông
  soil: 'sand' | 'mud' | 'clay' | 'rock',
  weight_t,                             // trọng lượng trong không khí
  holdingCoef?,                         // HC — drag mode
  frictionCoef?,                        // μ — deadweight mode
  concreteDensity,                      // 2400, deadweight mode
}

type Criteria = {
  sfAnchorIntact,   // 1.5
  sfAnchorDamaged,  // 1.1
  sfLineIntact,     // 3.0
  sfLineDamaged,    // 2.0
  minScopeRatio,    // 5.0  (L_total / d)
  maxOffset_m,      // allowable horizontal excursion
}

type Attachment = { id, name, mime, size, kind: 'pdf' | 'image' | 'dxf' | 'other', blobUrl }
type ProjectState = { meta, raft, env, line, anchor, criteria, attachments, results }
```

Every numeric field is a `number` in SI *after* parsing; the form keeps the raw string so a
half-typed `"1."` never blows up the calculation.

---

## 4. Screen layout

Single page, persistent left sidebar, content area with 5 sections:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Header:  Tên dự án · [Nhập Excel] [Xuất Excel] [In báo cáo PDF]      │
├───────────┬──────────────────────────────────────────────────────────┤
│ Sidebar   │  1. Thông tin dự án                                      │
│ 1 Dự án   │  2. Dữ liệu đầu vào   (Bè | Môi trường | Dây/Xích | Neo) │
│ 2 Đầu vào │  3. Tài liệu đính kèm  (upload + khung preview)          │
│ 3 Tài liệu│  4. Kết quả tính toán  (bảng trung gian + bảng kiểm tra) │
│ 4 Kết quả │  5. Báo cáo            (bản in A4)                       │
│ 5 Báo cáo │                                                          │
└───────────┴──────────────────────────────────────────────────────────┘
```

- Results recompute **live** (debounced ~200 ms) on any input change; keep an explicit
  "Tính lại" button anyway for user confidence.
- A sticky status strip at the top of section 4 shows the overall verdict badge
  (green **ĐẠT** / red **KHÔNG ĐẠT**) and names the governing (worst) check.

---

## 5. Calculation module (the core — implement exactly as written)

All formulas produce **N** internally. `g = 9.81 m/s²`.

### 5.1 Environmental loads (`loads.ts`)

```
A_wind    = windAreaOverride_m2    ?? (width_m × freeboardHeight_m)
A_current = currentAreaOverride_m2 ?? (width_m × draft_m)

F_wind    = 0.5 × ρ_air   × Cd_wind    × A_wind    × V_wind²
F_current = 0.5 × ρ_water × Cd_current × A_current × V_current²
F_wave    = 0.5 × ρ_water × g × (Hs/2)² × width_m × Cd_wave    // mean wave-drift, reflection model
F_env     = combinationFactor × (F_wind + F_current + F_wave)
```

### 5.2 Load per line (`loads.ts`)

```
N_eff_used = max(1, effectiveCount)              // intact case
H_line     = F_env / (N_eff_used × cos α)        // horizontal tension at fairlead, N
```

Damaged case: `N_eff_damaged = max(1, effectiveCount − 1)` → `H_line_damaged`.
Guard: clamp `α` to `[0°, 80°]` so `cos α` is never 0.

### 5.3 Catenary (`catenary.ts`)

Submerged unit weight of the line, N/m:

```
w = unitWeightAir_kgpm × g × (1 − ρ_water / ρ_steel),  ρ_steel = 7850   // ≈ 0.869 × dry weight
```

Vertical drop `d = waterDepth_m + tideRange_m` (conservative, high water).

```
s          = √( d × (d + 2H/w) )            // suspended length required, m
T_top      = H + w × d                      // top tension, N
x_susp     = (H/w) × asinh( w × s / H )     // horizontal projection of the suspended part, m
L_ground   = totalLength_m − s              // line lying on the seabed, m (negative → uplift)
F_friction = seabedFrictionCoef × w × max(0, L_ground)
X_deficit  = max(0, s + groundedLengthMin_m − totalLength_m)   // "chiều dài còn thiếu", m
```

Edge cases: `w ≤ 0`, `H ≤ 0`, `d ≤ 0` → return `null` and flag the dependent checks
"Không tính được".

### 5.4 Chain MBL estimator (`constants.ts` — indicative only, always overridable)

Stud-link chain, `d` in mm, result in kN (IACS-consistent):

```
MBL_kN = c × d² × (44 − 0.08 × d) / 1000        c = 15.1 (U1) | 21.6 (U2) | 31.1 (U3)
```

Sanity anchors for the unit tests: `d = 32 mm` → U1 ≈ 641 kN, U2 ≈ 916 kN, U3 ≈ 1320 kN
(±2 % of catalogue). Dry unit weight estimator: `kg/m ≈ 0.0219 × d²` (d in mm).
Both estimators are **prefill only**: once the user edits `mbl_kN` or `unitWeightAir_kgpm`, the
estimator must never overwrite it, and the UI labels an un-edited value
"ước tính — cần kiểm chứng catalogue".

### 5.5 Anchor resistance (`anchor.ts`)

```
drag:       R_anchor = HC × weight_t × 1000 × g
deadweight: W_sub = weight_t × 1000 × (1 − ρ_water / ρ_concrete);  R_anchor = μ × W_sub × g
total:      R_total = R_anchor + F_friction
```

Default HC table (`src/data/anchorTypes.json`, editable in-app):

| Loại neo | cát (sand) | bùn (mud) | sét (clay) |
|---|---|---|---|
| Danforth / neo bản | 12 | 8 | 10 |
| AC-14 | 10 | 7 | 9 |
| Hall | 4 | 2.5 | 3 |
| Stockless | 5 | 3 | 4 |

Default μ table (deadweight, `src/data/soils.json`): cát 0.55 · bùn 0.35 · sét 0.45 · đá 0.6.
Every cell is a **default**, badged "mặc định", replaced by a plain value once edited.

### 5.6 Checks (`checks.ts`) — the deliverable table

| # | Kiểm tra | Công thức | Ngưỡng | Bắt buộc |
|---|---|---|---|---|
| C1 | Sức giữ neo (nguyên vẹn) | `SF = R_total / H_line` | ≥ `sfAnchorIntact` (1.5) | ✔ |
| C2 | Bền dây/xích (nguyên vẹn) | `SF = MBL / T_top` | ≥ `sfLineIntact` (3.0) | ✔ |
| C3 | Không nhổ neo (uplift) | `L_ground ≥ groundedLengthMin_m` | ≥ 5 m | ✔ |
| C4 | Tỷ lệ chiều dài dây (scope) | `L_total / d` | ≥ `minScopeRatio` (5) | ✔ |
| C5 | Sức giữ neo (đứt 1 dây) | `SF = R_total / H_line_damaged` | ≥ `sfAnchorDamaged` (1.1) | ✔ |
| C6 | Bền dây/xích (đứt 1 dây) | `SF = MBL / T_top_damaged` | ≥ `sfLineDamaged` (2.0) | ✔ |
| C7 | Chuyển vị / trôi bè | `X_deficit ≤ maxOffset_m` | user | ✖ (cảnh báo) |

Each row returns
`{ id, label, formula, actual, unit, threshold, status: 'PASS' | 'FAIL' | 'NA', margin }`
with `margin = actual / threshold − 1` (inverted for ≤-type checks).
Overall verdict = `FAIL` if any mandatory row is `FAIL` or `NA`, else `PASS`.
UI mapping: `PASS → "ĐẠT"` (green), `FAIL → "KHÔNG ĐẠT"` (red), `NA → "Không tính được"` (amber).

---

## 6. File handling

### 6.1 Excel / CSV import

- Accept `.xlsx`, `.xls`, `.csv`; ≤ 10 MB; parse with SheetJS inside `try/catch`, never crash the app.
- Two layouts, auto-detected:
  - **Key–value**: first column = parameter code (`RAFT_LENGTH`, `WIND_SPEED`, …), second column = value.
    The code list ships as `src/data/importKeys.json` and drives the downloadable template.
  - **Tabular**: header row + data row → a **column-mapping dialog** binds each header to a field of §3.
    The mapping is remembered in localStorage per header signature.
- Preview grid: shows every parsed sheet, **cells editable in place**, invalid cells outlined red with
  the reason on hover. "Áp dụng vào biểu mẫu" writes into the store — nothing is applied silently.
- A "Tải file mẫu (.xlsx)" button generates the template client-side from `importKeys.json`.

### 6.2 Excel export

One workbook, sheets `ThongTinDuAn`, `DuLieuDauVao`, `KetQuaTrungGian`, `BangKiemTra`, `GhiChu`.
Filename `neo-be_<project-code>_<YYYYMMDD>.xlsx`. Numbers written as numbers (not strings) with the
unit in the adjacent column. The check sheet carries the ĐẠT / KHÔNG ĐẠT text plus the numeric margin.

### 6.3 Attachments & preview

- Drag-and-drop + file picker, multiple files, ≤ 25 MB each, held in memory as `Blob` + object URL.
  **Revoke object URLs on removal and on unmount** (QA verifies this).
- PDF → `<iframe>`; PNG/JPG/WEBP → `<img>` with fit/zoom toggle; DXF → canvas renderer supporting
  `LINE`, `LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `ARC`, `TEXT`, auto fit-to-extents, pan and zoom.
- **Degraded mode is required**: any unsupported entity or parser failure shows
  "Không hiển thị được bản vẽ — tải xuống để xem" plus a download link. A DXF must never break the page.
- Attachments appear in the PDF report as a filename table (they are not embedded).

### 6.4 PDF report (print)

A dedicated `ReportView` rendered A4 portrait, `@page { size: A4; margin: 15mm }`: cover block
(project meta, date, designer) → input tables → intermediate results → check table with verdict
badges → catenary sketch → attachment list → disclaimer + signature block.
`@media print` hides sidebar/header/buttons; tables use `break-inside: avoid`.

---

## 7. Acceptance criteria (numbered — QA verifies each one)

**Setup & shell**

1. `npm install && npm run dev` starts the app with zero console errors; `npm run build` produces a
   static `dist/` needing no server routes.
2. The 5 sections of §4 are reachable from the sidebar and the layout holds at 1280×800 with no
   horizontal scroll.

**Input**

3. Every field of §3 is present, labelled in Vietnamese with its unit, and shows its default value.
4. A non-numeric or invalid-negative value marks the field red with an inline message, and no `NaN`
   appears anywhere on screen.
5. Reloading the page restores the last project state (localStorage autosave).

**Excel import**

6. Importing the generated template `.xlsx` fills the form with exactly the values in the file.
7. A `.csv` and an `.xls` file in the same key–value layout also import correctly.
8. A tabular file with unknown headers opens the mapping dialog; after mapping, values land in the
   right fields.
9. Editing a cell in the preview grid and pressing "Áp dụng vào biểu mẫu" transfers the edited value.
10. A corrupt / non-spreadsheet file produces a Vietnamese error message and leaves the app usable.

**Attachments**

11. Uploading a PDF shows it in the preview frame; uploading a PNG/JPG shows the image.
12. A DXF with LINE/LWPOLYLINE/CIRCLE/ARC renders fitted on canvas with working zoom + pan; an
    unsupported or corrupt DXF shows the fallback message and a download link.
13. Removing an attachment removes the preview and revokes its object URL (no leaked `blob:` URLs).

**Calculation**

14. `F_wind`, `F_current`, `F_wave`, `F_env`, `H_line`, `T_top`, `s`, `L_ground`, `F_friction`,
    `R_total` are each displayed with formula, substituted values and result — the report must be
    auditable by a reviewing engineer, not a black box.
15. Vitest covers each load formula, catenary `s` / `T_top` / `x_susp`, the MBL estimator against the
    §5.4 sanity anchors, both anchor modes, and all 7 checks in passing and failing states.
    `npm run test` is green.
16. The check table renders C1–C7 with actual value, threshold, margin and a **ĐẠT / KHÔNG ĐẠT** badge.
17. Lowering the anchor weight until `SF < 1.5` flips C1 to KHÔNG ĐẠT and the overall badge to
    KHÔNG ĐẠT, naming C1 as the governing check.
18. A `totalLength_m` shorter than the required suspended length flips C3 to KHÔNG ĐẠT (uplift)
    instead of silently producing a negative grounded length.
19. Changing the chain grade U1→U3 raises the estimated MBL and can flip C2 from KHÔNG ĐẠT to ĐẠT;
    a manually edited MBL is never overwritten by the estimator afterwards.
20. Zero/blank critical inputs yield "Không tính được" (amber) — never `NaN`, `Infinity` or a crash.

**Export**

21. "Xuất Excel" downloads a workbook with the 5 sheets of §6.2; values match the screen and the check
    sheet shows the same verdicts.
22. "In báo cáo PDF" opens the print view: A4, no sidebar/buttons, tables not split mid-row, verdicts
    legible in black & white (shape/text, not colour alone).
23. The disclaimer of §2.3 appears both on screen (section 4) and in the printed report.

**Robustness**

24. No unhandled promise rejection and no error-boundary trip during the full flow
    import → attach → calculate → export, verified in the browser console.
25. `README.md` documents install/dev/build/test, the formula list with its source, the Excel template
    key list, and the DXF support matrix.

---

## 8. Task breakdown (implementation order — each step leaves the app runnable)

| # | Task | Covers | Est. |
|---|---|---|---|
| T1 | Scaffold: Vite + React + TS strict + Tailwind + Zustand + Vitest, folder tree of §9, app shell & sidebar | AC 1, 2 | S |
| T2 | Types + defaults + reference JSON (`anchorTypes`, `soils`, `chainGrades`, `importKeys`) | §3, §5.4, §5.5 | S |
| T3 | Calculation library `lib/calc/**` + full Vitest suite | AC 14, 15, 20 | **L — highest risk, before any UI polish** |
| T4 | Input forms (5 groups) + validation + localStorage persist + live recompute | AC 3, 4, 5 | M |
| T5 | Results section: intermediate table, check table, verdict badges, catenary sketch | AC 16–19, 23 | M |
| T6 | Excel import: parser, auto-detect, mapping dialog, editable preview grid, template generator | AC 6–10 | L |
| T7 | Attachments: upload, list, PDF/image preview, DXF canvas renderer + fallback, URL revocation | AC 11–13 | M |
| T8 | Excel export + print report view + print stylesheet | AC 21, 22 | M |
| T9 | Polish, empty states, error messages, README, final console-clean pass | AC 24, 25 | S |

Sequencing rules: **T2 before everything**, **T3 before T5**; T6 and T7 are independent of each other
and both depend on T4. If time runs short, cut in this order: T7 (DXF renderer only) → T6 (mapping
dialog only) → **never T3**.

---

## 9. Target file structure

```
├─ index.html
├─ package.json  vite.config.ts  tailwind.config.js  tsconfig.json
├─ README.md
├─ docs/SPEC.md
└─ src/
   ├─ main.tsx  App.tsx  index.css
   ├─ components/
   │   ├─ layout/   AppShell.tsx  Sidebar.tsx  Header.tsx
   │   ├─ input/    ProjectForm.tsx RaftForm.tsx EnvForm.tsx LineForm.tsx AnchorForm.tsx CriteriaForm.tsx NumberField.tsx
   │   ├─ excel/    ImportDialog.tsx  MappingDialog.tsx  PreviewGrid.tsx
   │   ├─ files/    AttachmentPanel.tsx  PdfViewer.tsx  ImageViewer.tsx  DxfViewer.tsx
   │   ├─ results/  IntermediateTable.tsx  CheckTable.tsx  VerdictBadge.tsx  CatenarySketch.tsx
   │   └─ report/   ReportView.tsx
   ├─ lib/
   │   ├─ calc/     types.ts constants.ts loads.ts catenary.ts anchor.ts checks.ts index.ts
   │   │            __tests__/*.test.ts
   │   ├─ io/       excelImport.ts excelExport.ts importKeys.ts dxf.ts
   │   └─ format.ts
   ├─ store/        useProjectStore.ts
   └─ data/         anchorTypes.json soils.json chainGrades.json importKeys.json
```

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Engineering coefficients (HC, μ, SF) are project/standard dependent | every default editable + badged "mặc định" + disclaimer §2.3 mandatory |
| DXF parsing is the classic time sink | strict entity subset + mandatory fallback (AC 12); first thing to cut |
| SheetJS `.xls` (BIFF) edge cases | wrap in try/catch, Vietnamese error message, never crash (AC 10) |
| Catenary division by zero (`w = 0`, `H = 0`, `α = 90°`) | explicit guards → `NA` status (AC 20), unit-tested |
| Print output differs across browsers | target Chromium print preview; page-break rules on tables |
| Large attachments blowing memory | 25 MB/file cap, object URLs revoked on removal (AC 13) |
