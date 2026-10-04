# GIAO VIỆC: TRIỂN KHAI MỤC "BÁO GIÁ THI CÔNG CỌC BỜ (KHOAN NHỒI) & CỌC LÒNG HỒ (CỌC ĐÓNG)"

Chào Claude,

Người dùng vừa cung cấp các bảng giá tham khảo thực tế thị trường từ 3 ảnh chụp và yêu cầu:
> **"với các thông tin về giá kia, giúp t lập một mục nữa là Báo giá phương án thi công cọc nhồi ở bờ và cọc đóng ở lòng hồ cho t, mấy cái đơn giá thi công theo mét dài và giá nhân công+vật tư đấy mặc định theo thông tin ảnh đi, t có thể tùy chỉnh giá . lên kế hoạch và bảo claude làm cho"**

Dưới đây là kế hoạch chi tiết và hướng dẫn kỹ thuật để bạn triển khai:

---

## 1. NGUỒN ĐƠN GIÁ MẶC ĐỊNH (TRÍCH XUẤT TỪ 3 ẢNH NGƯỜI DÙNG CUNG CẤP)

### A. Cọc khoan nhồi trên bờ (Tiết diện tròn D350 mm):
*Trích xuất từ Bảng giá thi công cọc khoan nhồi (Ảnh 1):*
- **Loại cọc đang dùng:** Cọc Mini D350.
- **Đơn giá nhân công:** 260.000 – 280.000 VNĐ/md $\rightarrow$ **Mặc định: 270.000 VNĐ/md**.
- **Đơn giá trọn gói (Vật tư + Nhân công):** 460.000 – 500.000 VNĐ/md $\rightarrow$ **Mặc định: 480.000 VNĐ/md**.
- (Vật tư tương đương: 210.000 VNĐ/md).
- *Dữ liệu tham khảo mở rộng (Preset để người dùng chọn nhanh các đường kính khác nếu muốn):*
  + D300: Nhân công 200.000 | Trọn gói 400.000 VNĐ/md
  + D350: Nhân công 270.000 | Trọn gói 480.000 VNĐ/md (Mặc định)
  + D400: Nhân công 255.000 | Trọn gói 635.000 VNĐ/md
  + D500: Nhân công 290.000 | Trọn gói 785.000 VNĐ/md
  + D600: Nhân công 330.000 | Trọn gói 1.075.000 VNĐ/md

### B. Cọc vuông bê tông cốt thép 350x350 mm đóng dưới lòng hồ:
*Trích xuất từ Bảng giá cọc vuông 350x350 & ca máy đóng sà lan (Ảnh 2 & Ảnh 3):*
1. **Giá vật tư cọc đúc sẵn 350x350 tại xưởng:**
   - Dải trọn gói thị trường: 430.000 – 1.250.000 VNĐ/md.
   - Các mức tùy chọn (Preset):
     + *Cọc đúc sẵn đại trà (Thép tổ hợp/Đa Hội, mác 250 - 300):* 250.000 – 290.000 VNĐ/md (TB 270.000).
     + *Cọc sản xuất thương mại tiêu chuẩn (Thép Hòa Phát, Việt Đức, mác 300 - 350):* 320.000 – 450.000 VNĐ/md $\rightarrow$ **Mặc định đề xuất: 380.000 VNĐ/md**.
     + *Cọc vuông ly tâm dự ứng lực cường độ cao (Amaccao, Hùng Vương):* 650.000 – 1.027.000 VNĐ/md (TB 840.000).
2. **Đơn giá nhân công và ca máy đóng dưới hồ (Nước sâu > 1.5m, dùng sà lan/hệ phao nổi mang búa rung):**
   - Đơn giá đóng dưới nước: 120.000 – 220.000 VNĐ/md $\rightarrow$ **Mặc định: 170.000 VNĐ/md**.
   - Chi phí khấu hao lắp đặt sàn đạo / sà lan nổi bệ máy cho cả chiến dịch: 30 – 70 triệu VNĐ $\rightarrow$ **Mặc định: 50.000.000 VNĐ**.
3. **Chi phí vận chuyển & bốc xếp đường thủy (Logistics):**
   - Tỷ lệ cẩu bốc xếp 2 đầu (từ xe tải xuống bờ, cẩu lên sà lan): 5% – 10% chi phí mua cọc $\rightarrow$ **Mặc định: 7%**.
4. **Các hệ số chi phí chung (tùy chọn bật/tắt):**
   - Dự phòng phí: **5%**.
   - Thuế VAT: **8%** (hoặc 10%, có thể chỉnh về 0%).

---

## 2. KIẾN TRÚC MÃ NGUỒN CẦN TRIỂN KHAI

### 2.1. Module tính toán chi phí (`src/lib/calc/costEstimate.ts`)
Tạo mới file này để đóng gói toàn bộ logic tính toán tài chính:
```typescript
export interface CostParams {
  // Cọc bờ D350 khoan nhồi
  shoreBoredCostMode: 'turnkey' | 'detailed'; // Trọn gói hoặc Tách riêng
  shoreTurnkeyRate_VND_m: number;   // Mặc định: 480_000
  shoreLaborRate_VND_m: number;     // Mặc định: 270_000
  shoreMaterialRate_VND_m: number;  // Mặc định: 210_000

  // Cọc đáy 350x350 đóng sà lan
  bedMaterialRate_VND_m: number;    // Mặc định: 380_000
  bedMaterialPreset: 'standard' | 'mass' | 'prestressed' | 'custom';
  bedDrivingRate_VND_m: number;     // Mặc định: 170_000 (ca máy búa sà lan + nhân công)
  bedBargeSetup_VND: number;        // Mặc định: 50_000_000 (khấu hao sà lan / sàn đạo nổi)
  bedLogisticsPercent: number;      // Mặc định: 7 (%)

  // Dự phòng & Thuế
  contingencyPercent: number;       // Mặc định: 5 (%)
  vatPercent: number;               // Mặc định: 8 (%)
  includeVat: boolean;              // Mặc định: true
}

export interface RaftCostBreakdown {
  raftId: number;
  raftName: string;
  shorePiles: number;
  shoreMeters: number;
  shoreCost_VND: number;
  bedPiles: number;
  bedMeters: number;
  bedCost_VND: number;
  totalCost_VND: number;
}

export interface CostEstimateSummary {
  // Khối lượng
  totalShorePiles: number;
  totalShoreMeters: number;
  totalBedPiles: number;
  totalBedMeters: number;
  totalPiles: number;
  totalMeters: number;

  // Thành tiền cấu phần
  shoreTotal_VND: number;
  bedMaterialTotal_VND: number;
  bedDrivingTotal_VND: number;
  bedLogisticsTotal_VND: number;
  bedBargeSetup_VND: number;
  bedTotal_VND: number;

  // Tổng hợp dự toán
  directTotal_VND: number;
  contingency_VND: number;
  vat_VND: number;
  grandTotal_VND: number;

  // Phân bổ 12 bè
  raftBreakdowns: RaftCostBreakdown[];
}
```
- Viết hàm `calculateCostEstimate(params: CostParams, scheduleRows: PileScheduleRow[], raftsSummary: RaftSummaryItem[]): CostEstimateSummary`.
- Lấy số lượng cọc và chiều dài thực tế chính xác từ `buildPileSchedule` (141 cọc bờ = 939.6 md; 202 cọc đáy = 2.117,5 md).

### 2.2. Cập nhật Store (`src/store/useProjectStore.ts`)
- Thêm `costParams: CostParams` vào `ProjectStore`.
- Thêm action `updateCostParams: (params: Partial<CostParams>) => void`.
- Thêm action `resetCostParams: () => void` để hoàn tác về mặc định.
- Cho phép lưu và khôi phục trong `persist` (với migration v16 nếu cần).

### 2.3. Tạo UI Báo Giá (`src/components/cost/CostEstimateView.tsx`)
Thiết kế giao diện đẹp mắt, chuyên nghiệp:
1. **Header & Thẻ KPI:**
   - Tổng mức dự toán kinh phí: hiển thị to, rõ nét (dạng số tiền VNĐ đầy đủ và dạng Tỷ VNĐ).
   - Card Cọc bờ (141 cọc - 939.6 md - Tổng tiền VNĐ).
   - Card Cọc lòng hồ (202 cọc - 2.117,5 md - Tổng tiền VNĐ).
   - Card Chi phí trung bình mỗi cụm bè (VNĐ/bè).
2. **Khung tùy chỉnh đơn giá (Interactive Config Panel):**
   - Cho phép người dùng chỉnh sửa từng ô đơn giá (nhập số hoặc kéo thanh trượt).
   - Có các nút bấm Preset chọn nhanh (ví dụ: cọc đại trà 270k, cọc tiêu chuẩn Hòa Phát 380k, cọc ly tâm DƯL 840k).
   - Nút **"Khôi phục đơn giá mặc định (Theo ảnh tham khảo)"** để quay lại giá mẫu.
3. **Bảng Báo Giá Chi Tiết Hạng Mục Thi Công (Format chuẩn Dự toán Xây dựng):**
   - STT, Danh mục công việc, Đơn vị tính (md/chiến dịch), Khối lượng, Đơn giá (VNĐ), Thành tiền (VNĐ), Căn cứ & Ghi chú kỹ thuật.
4. **Bảng Phân Bổ Chi Phí Theo 12 Cụm Bè (BÈ 1 đến BÈ 12):**
   - Danh sách 12 cụm bè, số lượng cọc bờ & cọc đáy, khối lượng mét dài, tổng thành tiền mỗi cụm bè.
5. **Nút chức năng:**
   - Nút **"Xuất Báo Giá Excel (.xlsx)"**: Tải file bảng tính báo giá dự toán đẹp mắt.
   - Nút **"In / Xuất PDF Báo Giá"**: Dễ dàng in ấn hoặc lưu PDF báo giá gửi khách hàng.

### 2.4. Tích hợp Điều Hướng (`Sidebar.tsx` & `AppShell.tsx`)
- Thêm mục số 10 vào `Sidebar.tsx`:
  ```typescript
  {
    id: 'cost',
    label: '10. Báo Giá Thi Công',
    description: 'Cọc nhồi bờ & cọc đóng lòng hồ',
    icon: Receipt, // hoặc DollarSign, Coins, Calculator
    badge: (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
        VNĐ
      </span>
    )
  }
  ```
- Cập nhật `ActiveSection = ... | 'cost'`.
- Trong `AppShell.tsx`: render `<CostEstimateView />` khi `activeSection === 'cost'`.

### 2.5. Xuất File Excel Báo Giá (`src/lib/io/costExcelExport.ts`)
- Sử dụng thư viện `xlsx` đã có sẵn trong dự án.
- Tạo sheet `BaoGia_ThiCong` trình bày chuẩn chỉnh: Tiêu đề công trình, Bảng khối lượng đơn giá thành tiền, Bảng phân bổ 12 cụm bè, Định dạng số có dấu phẩy ngăn cách hàng nghìn.

---

## 3. KIỂM THỬ & CHẤT LƯỢNG
1. Viết unit test cho `costEstimate.test.ts`:
   - Kiểm tra tính toán đúng với đơn giá mặc định:
     + Cọc bờ: 939.6 md * 480.000 = 451.008.000 VNĐ.
     + Cọc đáy: 2.117,5 md * 380.000 (vật tư) + 2.117,5 md * 170.000 (đóng sà lan) + logistics + sàn đạo 50tr.
     + Tổng chi phí các bè cộng lại phải khớp chính xác 100% với tổng dự án.
2. Đảm bảo toàn bộ 183 tests hiện có vẫn PASS 100%, cộng thêm các test mới.
3. Build production (`npm run build`) không có cảnh báo hay lỗi TypeScript.

Nhờ Claude tiến hành triển khai nhé! Cảm ơn bạn.
