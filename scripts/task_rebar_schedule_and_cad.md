# GIAO VIỆC: BỔ SUNG CỐT THÉP & CẤU TẠO CỌC VÀO BẢNG EXCEL VÀ BẢN VẼ CAD (.DXF)

Chào Claude,

Sau khi thống nhất phương án đồng nhất cọc vuông $350 \times 350\text{ mm}$ toàn hồ và cọc đôi cho BÈ 5, người dùng yêu cầu:
> **"lên kế hoạch để claude làm lại bản vẽ và bảng excel thống kê cọc với có cả thép đi kèm thép trong đấy nữa nhé"**
> Đồng thời người dùng lưu ý:
> - Cọc dài $8 \div 10.5\text{ m}$ thì phương án đúc/chia đoạn cọc thế nào?
> - Cốt thép cọc cấu tạo thực tế phải là 4 cây ở 4 góc hoặc 8 cây chu vi chứ không thể để 2 hay 3 cây (vì 2 hay 3 cây là số thanh trên 1 mặt chịu kéo khi tính toán cơ học).

Dưới đây là đặc tả kỹ thuật chi tiết để triển khai nâng cấp toàn diện:

---

## 1. QUY TẮC QUY ĐỔI TỪ SỐ CÂY MẶT CHỊU KÉO SANG LỒNG THÉP CẤU TẠO THỰC TẾ

Phần mềm đang lưu `rebarFaceCount` (số thanh trên một mặt chịu kéo). Khi xuất bảng thống kê vật liệu và bản vẽ thi công, cần quy đổi sang **cấu tạo lồng thép thực tế toàn tiết diện cọc $350 \times 350\text{ mm}$**:

1. **Khi `rebarFaceCount = 2` (ví dụ cọc bờ Bè 2, Bè 12; cọc đáy Bè 2, Bè 4, Bè 6, Bè 10, Bè 11, Bè 12):**
   - Cấu tạo lồng thép thực tế: **4 cây thép ở 4 góc cọc** $\rightarrow$ Ký hiệu: `4Φ<Dia>` (Ví dụ: `4Φ28`, `4Φ20`, `4Φ22`, `4Φ25`).
   - Mác thép: **CB400-V**.
   - Khi cọc chịu uốn theo bất kỳ phương nào, 2 cây ở mép kéo tham gia chịu lực, đúng chuẩn $2\Phi$ của mô hình tính.

2. **Khi `rebarFaceCount = 3` (ví dụ cọc bờ Bè 1, 3, 4, 5, 6, 8, 9; cọc đáy Bè 1, 3, 5, 7, 8, 9):**
   - Cấu tạo lồng thép thực tế: **8 cây thép bố trí chu vi đối xứng** (gồm 4 cây ở 4 góc + 4 cây ở giữa 4 cạnh) $\rightarrow$ Ký hiệu: `8Φ<Dia>` (Ví dụ: `8Φ20`, `8Φ25`, `8Φ28`, `8Φ32`).
   - Mác thép: **CB400-V**.
   - Mỗi mặt cọc đều có 3 cây (2 cây góc + 1 cây giữa). Cọc làm việc đối xứng 4 hướng, gió xoay chiều nào thì mặt chịu kéo cũng có đủ 3 cây tham gia chịu uốn.

3. **Khi `rebarFaceCount = 4` (ví dụ cọc bờ Bè 7, Bè 10):**
   - Cấu tạo lồng thép thực tế: **8 cây chu vi $8Φ<Dia>$** (hoặc 12 cây nếu xếp 4 cây/mặt). Khuyến nghị ghi `8Φ25` hoặc `12Φ25`.

4. **Cốt đai & phụ kiện cấu tạo:**
   - Cốt đai: Thép cuộn **$\Phi 8$ (CB240-T)**.
   - Bước đai: Đoạn đầu cọc và mũi cọc ($1.5\text{ m}$): **$\Phi 8$ a100**; Đoạn thân cọc: **$\Phi 8$ a200**.
   - Lớp bê tông bảo vệ: $a_s = 50\text{ mm}$ ($c = 35\text{ mm}$ đến mép ngoài cốt đai).
   - Móc cẩu: 2 móc cẩu $\Phi 16$ bố trí ở vị trí $0.207 L$ từ hai đầu cọc.
   - Hộp tôn đệm đầu cọc: thép tấm $t = 8\text{ mm}$ (dùng để cẩu lắp, bảo vệ đầu cọc khi đóng).

---

## 2. QUY CÁCH PHÂN ĐOẠN CỌC & CHIỀU DÀI CỌC

Cọc vuông $350 \times 350\text{ mm}$ có chiều dài đóng $L_{tk}$ cộng đoạn nhô ($0.5\text{ m}$ cho bờ, $1.0\text{ m}$ cho đáy):
- **Cọc bờ ($L_{tổng} = 7.0 \div 7.5\text{ m}$):**
  - **Đúc nguyên cây 1 đoạn**, không chia đốt (vận chuyển xe tải $8 \div 11\text{ m}$, thi công trên bờ cẩu hạ nguyên cây).
  - Ghi chú: `1 đoạn L = 7.0m` (hoặc `7.5m`).
- **Cọc đáy ($L_{tổng} = 9.0 \div 11.5\text{ m}$):**
  - Quy cách tiêu chuẩn: Ưu tiên đúc liền 1 đoạn nếu sà lan có giá búa $\ge 15\text{ m}$.
  - Nếu chia 2 đoạn để vận chuyển/thi công sà lan nhỏ: Chia làm 2 đốt **C1 (mũi) + C2 (đầu)**:
    - Ví dụ cọc $9.0\text{ m} = 4.5\text{ m} + 4.5\text{ m}$.
    - Ví dụ cọc $9.5\text{ m} = 4.5\text{ m} + 5.0\text{ m}$.
    - Ví dụ cọc $10.5\text{ m} = 5.0\text{ m} + 5.5\text{ m}$.
    - Ví dụ cọc $11.5\text{ m} = 5.5\text{ m} + 6.0\text{ m}$.
  - Ghi chú kỹ thuật: Mối nối đặt sâu dưới bùn $> 4\text{ m}$ để né vùng mômen uốn cực đại ($M_{max}$ ở độ sâu $1.5 \div 3.0\text{ m}$). Mối nối hàn vát mép bản mã chu vi liên tục chịu kéo/nhổ.

---

## 3. CẬP NHẬT CODE DỮ LIỆU & BẢNG EXCEL

1. **Mở rộng `PileScheduleRow` (`src/lib/io/pileSchedule.ts`):**
   - `rebarConfig`: chuỗi ký hiệu lồng thép (ví dụ: `"4Φ28 CB400-V"`, `"8Φ25 CB400-V"`, `"8Φ32 CB400-V"`).
   - `rebarStirrup`: chuỗi cốt đai (ví dụ: `"Φ8 a100/a200"`).
   - `segmentNote`: quy cách đoạn cọc (ví dụ: `"1 đoạn (L=7.0m)"` hoặc `"2 đoạn (4.5+5.0m)"`).
   - `concreteVol_m3`: Thể tích bê tông 1 cọc ($0.35 \times 0.35 \times L_{tổng}$).
   - `steelWeight_kg`: Khối lượng thép 1 cọc (gồm thép dọc + cốt đai $\Phi 8$ + móc cẩu $\approx 3.8\text{ kg}$).

2. **Bảng thống kê cọc trong Excel (`src/lib/io/excelExport.ts`):**
   - Trong Sheet `ThongKeCoc` và workbook độc lập `buildPileScheduleWorkbook`:
     Thêm các cột rõ ràng:
     - `SỐ CỌC`
     - `a (m)`
     - `L_tk (m)`
     - `L_tổng (m)`
     - `PHÂN ĐOẠN CỌC`
     - `THÉP CHỦ`
     - `MÁC THÉP`
     - `CỐT ĐAI`
     - `V BÊ TÔNG 1 CỌC (m³)`
     - `KL THÉP 1 CỌC (kg)`
     - `P_req (kN)`, `P_max (kN)`, `KL`
   - Bổ sung **BẢNG TỔNG HỢP VẬT TƯ TOÀN HỒ** ở cuối sheet:
     - Tổng số cọc: **343 cọc** ($141$ cọc bờ, $202$ cọc đáy).
     - Tổng chiều dài cọc: **3.113,5 m**.
     - Tổng bê tông B25: **381,4 m³**.
     - Tổng khối lượng thép các đường kính ($\Phi 20, \Phi 22, \Phi 25, \Phi 28, \Phi 32, \Phi 8$) và Tổng trọng lượng thép (tấn).

---

## 4. CẬP NHẬT BẢN VẼ CAD (.DXF) (`src/lib/io/dxfExport.ts`)

1. **Bảng thống kê cọc trong CAD (`scheduleTable`):**
   - Bổ sung cột `THEP CHU` (ví dụ `4D28`, `8D25`, `8D32`), `THEP DAI` (`D8 a100/200`), `DOAN COC` (`1 DOAN` / `2 DOAN`).
   - Giữ định dạng thuần R12 ASCII, không dấu diacritics.

2. **Vẽ bổ sung các CHI TIẾT CẤU TẠO CỌC bằng thực thể CAD (LINE, CIRCLE, TEXT) trên Layer riêng (hoặc Layer `07_BANG_THONG_KE_COC`):**
   - **Chi tiết A - Mặt cắt cọc loại 4 thanh (MC 1-1, $350 \times 350\text{ mm}$):**
     - Vẽ hình vuông bê tông $350 \times 350$.
     - Vẽ đường bao đai vuông lùi vào $c = 35\text{ mm}$.
     - Vẽ 4 hình tròn đường kính biểu diễn 4 cây thép góc.
     - Kích thước & text: `4D (CB400-V)`, `Dai D8 a100/a200`, `Be tong B25`.
   - **Chi tiết B - Mặt cắt cọc loại 8 thanh (MC 2-2, $350 \times 350\text{ mm}$):**
     - Vẽ hình vuông bê tông $350 \times 350$.
     - Vẽ đai vuông và 8 hình tròn (4 cây góc + 4 cây giữa 4 cạnh).
     - Kích thước & text: `8D (CB400-V)`, `Dai D8 a100/a200`.
   - **Chi tiết C - Cụm cọc đôi BÈ 5:**
     - Mặt bằng 2 cọc vuông $350 \times 350$, khoảng cách tim $s = 1.05\text{ m} \ge 3a$.
     - Đài neo/bích giằng liên kết ma-nê neo cáp bè.
   - **Chi tiết D - Sơ đồ nối cọc chịu nhổ (nếu 2 đoạn):**
     - Mặt đứng mối nối cọc C1 + C2, hàn vát mép bản mã chu vi $t = 8\text{ mm}$ có gân tăng cường. Ghi chú: Mối nối đặt sâu dưới bùn $> 4\text{ m}$, né vùng mômen uốn cực đại.

---

## 5. KIỂM THỬ & CHẤT LƯỢNG
- Giữ 100% tests PASS (cập nhật các snapshot test của Excel và DXF tương ứng).
- Build sạch không lỗi type.
