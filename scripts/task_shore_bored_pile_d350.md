# GIAO VIỆC: TRIỂN KHAI PHƯƠNG ÁN CHÍNH NEO BỜ LÀ CỌC KHOAN NHỒI TRÒN D350 mm & CỌC ĐÁY LÀ CỌC VUÔNG 350x350 mm

Chào Claude,

Người dùng vừa chính thức phê duyệt phương án thi công thực tế cho dự án:
> **"vậy t nghĩ phương án neo bờ bằng việc khoan rồi thả lồng thép rồi đổ bê tông để làm cọc 350mm là phương án chính, còn phương án kia là phụ thôi"**
> **"ok giúp t"**

Đây là sự kết hợp biện pháp thi công tối ưu nhất cho hồ đồi núi Huổi Vanh:
1. **Neo bờ (141 điểm neo bờ):** **CỌC KHOAN NHỒI TRÒN $\Phi 350\text{ mm}$ ĐỔ BÊ TÔNG TẠI CHỖ (PHƯƠNG ÁN CHÍNH)**.
   - Máy khoan nhỏ gọn (2–4T) dễ di chuyển trên bờ dốc $20^\circ \div 35^\circ$, không gây rung chấn nứt taluy bờ dốc.
   - Thân cọc chìm dưới đất: Tiết diện tròn đường kính $D = 0.35\text{ m}$ (`shorePileShape = 'circular'`).
   - Cốt thép: Lồng 4 thanh góc ($4\Phi 25$ đến $4\Phi 32$ CB400-V), cốt đai xoắn $\Phi 8$ a150.
   - Thể tích bê tông cọc tròn: $A_c = \dfrac{\pi \cdot 0.35^2}{4} \approx 0.0962\text{ m}^2$, tiết kiệm thêm $21.5\%$ bê tông cọc bờ (giảm $\approx 24.5\text{ m}^3$ bê tông toàn bờ).
   - Đầu cọc nhô khỏi mặt đất $0.1 \div 0.2\text{ m}$: Cố-pha đài vuông hoặc tròn có bu-lông neo bắt bích ma-nê neo cáp bè.
2. **Neo lòng hồ (202 cọc đáy / 175 điểm neo đáy):** **CỌC VUÔNG ĐÚC SẴN $350 \times 350\text{ mm}$ ĐÓNG TỪ SÀ LAN**.
   - Giữ nguyên tiết diện vuông $350 \times 350\text{ mm}$ (`bedPileShape = 'square'`), đúc sẵn vận chuyển bằng sà lan phẳng và đóng bằng búa sà lan cắm sâu $8.0 \div 10.5\text{ m}$.
   - Riêng BÈ 5 dùng cụm cọc đôi $2 \times 350 \times 350\text{ mm}$.

Dưới đây là các yêu cầu triển khai kỹ thuật cụ thể:

---

## 1. THIẾT LẬP THAM SỐ ENGINE & STATE

1. **Trong `HUOI_VANH_DEFAULT_PROJECT` (`src/data/huoiVanhProject.ts`):**
   - Đặt `anchor.shorePileShape = 'circular'` (cọc bờ mặc định là tròn).
   - Đặt `anchor.bedPileShape = 'square'` (cọc đáy mặc định là vuông).
   - `anchor.shoreD_m = 0.35` (đường kính D350 mm).
   - `anchor.shoreArm_e_m = 0.1` (tai neo sát cổ cọc).
2. **Kiểm toán cơ học cả 12 bè:**
   - Đảm bảo cọc bờ tròn $\Phi 350\text{ mm}$ với 4 thanh góc và $e = 0.1\text{ m}$ đạt 100% tất cả các tiêu chí Broms (BP-1 đến BP-5) cho cả 12 cụm bè (overallVerdict = PASS).

---

## 2. CẬP NHẬT CẤU TẠO LỒNG THÉP & VẬT TƯ (`src/lib/calc/pileCage.ts` & `pileSchedule.ts`)

1. **Phân biệt lồng thép cọc tròn vs cọc vuông:**
   - Cọc tròn bờ ($\Phi 350\text{ mm}$):
     + Thể tích bê tông: $V = \dfrac{\pi \cdot D^2}{4} \cdot L_{tot}$.
     + Cốt đai: Đai xoắn tròn $\Phi 8$ a150 (chu vi đai tròn $\pi \cdot (D - 2c)$).
   - Cọc vuông đáy ($350 \times 350\text{ mm}$):
     + Thể tích bê tông: $V = D^2 \cdot L_{tot}$.
     + Cốt đai: Đai vuông $\Phi 8$ a100/a200.
2. **Cập nhật Bảng tổng hợp vật tư toàn hồ:**
   - 343 cọc: 141 cọc bờ (tròn $\Phi 350\text{ mm}$) + 202 cọc đáy (vuông $350 \times 350\text{ mm}$).
   - Tính toán lại chính xác tổng khối lượng bê tông (giảm thêm khoảng $24.5\text{ m}^3$) và tổng khối lượng thép (tấn) theo từng đường kính.

---

## 3. CẬP NHẬT BẢNG EXCEL, WEB & BẢN VẼ CAD (.DXF)

1. **File Excel (`ThongKeCoc` & `BangThongKeCoc`):**
   - Cột `LOẠI` hoặc `TIẾT DIỆN`:
     + Cọc bờ ghi: `BỜ (Tròn D350 - Khoan nhồi tại chỗ)`
     + Cọc đáy ghi: `ĐÁY HỒ (Vuông 350x350 - Đúc sẵn)`
   - Cột `V BÊ TÔNG 1 CỌC`: cọc bờ tính theo tiết diện tròn.
   - Bảng tổng hợp vật tư cuối sheet cập nhật đầy đủ các con số mới.
2. **Bản vẽ CAD (.dxf) (`dxfExport.ts` & `pileCageDetailDxf.ts`):**
   - Trên mặt bằng tọa độ:
     + Các điểm neo bờ vẽ hình tròn đường kính $0.35\text{ m}$ (layer `04_COC_NEO_BO`), nhãn điểm ghi rõ dạng `HV-P... (D350 KHOAN NHOI)`.
     + Các điểm neo đáy giữ hình vuông $0.35\text{ m}$ (layer `05_COC_NEO_DAY`), BÈ 5 ghi `2x(350x350)`.
   - Bảng thống kê cọc trên CAD: Cập nhật cột quy cách/tiết diện cọc tương ứng.
   - Layer chi tiết cấu tạo cọc `08_CHI_TIET_COC`:
     + **Chi tiết 1 (Mặt cắt 1-1: Cọc khoan nhồi bờ tròn $\Phi 350\text{ mm}$):** Vẽ vòng tròn bê tông $\Phi 350$, vòng đai xoắn lùi $35\text{ mm}$, 4 hình tròn thép chủ phân bố đều theo đường tròn. Ghi chú: `4D (CB400-V) - Coc khoan nhoi do tai cho, Dai xoan D8 a150, Be tong B25`.
     + **Chi tiết 2 (Mặt cắt 2-2: Cọc vuông đáy hồ $350 \times 350\text{ mm}$):** Hình vuông $350 \times 350$, đai vuông $\Phi 8$, 4 thép góc. Ghi chú: `4D (CB400-V) - Coc duc san thi cong sa lan, Dai D8 a100/a200`.
     + Giữ chi tiết cọc đôi BÈ 5 đáy hồ và sơ đồ cẩu lắp cọc đúc sẵn.
3. **Bộ nhớ trình duyệt (Store migration):**
   - Migrate lên phiên bản mới (v15) để tự động kích hoạt `shorePileShape: 'circular'` và cập nhật danh mục cho toàn bộ người dùng web.

---

## 4. KIỂM THỬ & CHẤT LƯỢNG
- Cập nhật test suite, đảm bảo 100% tests PASS và build production sạch.
