# NHIỆM VỤ (PM GIAO CLAUDE): LẬP BẢNG EXCEL THỐNG KÊ VẬT TƯ ORDER (PROCUREMENT BOQ)
**Dự án:** Hệ thống neo 9 cụm bè pin mặt trời nổi Hồ Huổi Vanh  
**Người giao (PM):** Antigravity  
**Người thực hiện:** Claude (Fullstack)  
**Ngày giao:** 15/10/2026  

---

## 1. YÊU CẦU CỦA CHỦ ĐẦU TƯ / USER
> *"m là PM hãy nhờ claude tạo bảng excel thống kê đầy đủ cáp cần để order vật tư, nhớ là phương án là dây cáp chia thành 2 nhánh bám vào bè, số lượng cọc, chiều dài cọc, thép , neo đáy các thứ . t có bản vẽ số trí neo bè r và nhà điều hành t gửi m sau, liện tại m thống kê những hạng mục mà m thấy thông tin chắc chắn đã. cái bè pin và cấu t bè pin, nhà điều hành t gửi sau"*

### Các nguyên tắc cốt lõi:
1. **Mục đích:** Bảng phục vụ mua hàng / đặt hàng vật tư thực tế (Order / Procurement Bill of Quantities - BOQ). Khối lượng phải có hệ số hao hụt thi công, quy cách đóng gói (cuộn cáp, mét dài, cây thép 11,7m, bộ phụ kiện).
2. **ĐẶC BIỆT: Phương án Cáp chia 2 nhánh bám vào bè (Bridle Mooring / Chạc chữ Y):**
   - Mỗi tuyến neo (trong 295 tuyến) gồm:
     * **Cáp chính (Main Mooring Line):** Chạy từ cọc bờ / đế neo đáy ra tới cụm chạc ba (cách mép bè khoảng 3,5 m).
     * **Cụm chia chạc:** 01 Khuyên tam giác / Vòng khuyên chủ (Master Link / Triangle Bridle Plate Grade 80, WLL ≥ 12T) + Ma-nê kết nối.
     * **02 Nhánh cáp phụ (Bridle Legs):** Tách từ chạc ba bám vào 2 bích bám (cleats) trên mép bè (chiều dài mỗi nhánh $L_{\text{bridle}} = 3,5\text{ m}$). Tổng cộng: $295 \times 2 = \mathbf{590\text{ nhánh cáp}}$.
3. **Phạm vi thống kê (Những hạng mục CHẮC CHẮN 100%):**
   - (A) Hệ cáp neo Polyester (cáp chính + cáp nhánh bridle + hao hụt bện khuyên/cắt dây).
   - (B) Cọc khoan nhồi bờ D350 (231 cọc, $L = 6,5\text{ m}$, bê tông, thép chủ, thép đai, nắp chụp đỉnh cọc, tai neo).
   - (C) Đế neo đáy BTCT + Vít xoắn PA3 (32 đế dùng chung 100%, bê tông chống thấm, thép lưới đế, 128 cọc vít xoắn $\Phi89 \times 5$, tai neo đôi, phao treo cáp đáy).
   - (D) Phụ kiện toàn hệ thống (Ma-nê các loại, Tăng đơ 10-12T, Khuyên lót cáp Thimble, Xích vi chỉnh bích bè).
4. **Hạng mục TẠM HOÃN (chờ User gửi bản vẽ sau):**
   - Kết cấu phao nổi bè pin, khung giàn nhôm/thép bè pin và Nhà điều hành trung tâm.

---

## 2. THÔNG SỐ VẬT TƯ ĐÃ ĐƯỢC CHỐT KỸ THUẬT

### A. Dây cáp & Phụ kiện liên kết:
* **Tổng số tuyến neo:** 295 tuyến (231 cọc bờ + 64 dây từ 32 đế dùng chung).
* **Cáp chính Polyester (PES-28 đến PES-36):**
  - Chiều dài chốt-tới-chạc = $L_{\text{cắt chốt-chốt}} - 3,5\text{ m}$ (trừ đoạn vươn của chạc Y).
  - Tổng chiều dài cáp chính thực tế: Dây bờ $\approx 5.694\text{ m}$, Dây đáy $\approx 1.059\text{ m}$ $\rightarrow$ Tổng cáp chính: $\approx \mathbf{6.753\text{ m}}$.
  - Hệ số hao hụt / cắt bện đầu khuyên ($8\%$): Order cáp chính $\approx \mathbf{7.300\text{ m}}$.
* **Cáp nhánh Bridle (PES-24 đến PES-28):**
  - 590 nhánh cáp, mỗi nhánh $L = 3,5\text{ m}$ $\rightarrow$ Tổng chiều dài: $\mathbf{2.065\text{ m}}$.
  - Hao hụt bện khuyên 2 đầu ($8\%$): Order cáp nhánh $\approx \mathbf{2.250\text{ m}}$.
* **Phụ kiện:**
  - Vòng chia chạc Y (Master Link WLL 12T): **295 cái**.
  - Khuyên lót bện cáp (Thimbles) thép mạ kẽm: $295 \times 2 + 590 \times 2 = \mathbf{1.770\text{ cái}}$.
  - Ma-nê (Bow Shackles WLL 8.5T / 12T / 17T): **1.770 cái**.
  - Tăng đơ đầu cọc bờ (WLL 10-12T, hành trình $\pm 300\text{ mm}$): **231 bộ**.
  - Đoạn xích neo vi chỉnh bích bè (Grade 80 $\Phi13 \div 16\text{ mm}$, $L = 1,2\text{ m}$): **590 đoạn** ($\approx 750\text{ m}$).
  - Phao nổi treo cáp đáy ($15 \div 20\text{ kg}$): **64 quả**.

### B. Cọc khoan nhồi bờ tròn D350:
* Số lượng: **231 cọc**.
* Chiều dài: $6,5\text{ m/cọc}$ (cổ cọc nhô $\le 0,1\text{ m}$). Tổng mét khoan: $\mathbf{1.501,5\text{ md}}$.
* Bê tông C25/30 (đá 1x2, M350): $231 \times (\pi \times 0,175^2 \times 6,5) \times 1,05 = \mathbf{151,7\text{ m}^3}$ (đã gồm 5% hao hụt đổ bê tông cọc khoan nhồi).
* Cốt thép lồng cọc:
  - Thép chủ CB400-V: theo bảng phân bổ từng bè ($4\Phi25, 4\Phi28, 6\Phi25, 6\Phi28, 6\Phi32$) $\rightarrow$ Tổng thép chủ: $\approx \mathbf{31.500\text{ kg}}$ ($\approx 2.690$ cây thép 11,7m).
  - Thép đai xoắn $\Phi8$ CB240-T bước $a100/a150$ $\rightarrow$ Tổng thép đai: $\approx \mathbf{5.200\text{ kg}}$.
  - Thép đai định hình $\Phi14$ a2000: $\approx \mathbf{1.800\text{ kg}}$.
* Cụm đầu cọc bờ:
  - Bản nắp đỉnh cọc thép SS400 $400 \times 400 \times 20\text{ mm}$: **231 tấm** ($\approx 5.800\text{ kg}$).
  - Tai neo thép dày $25\text{ mm}$, lỗ $\Phi40$: **231 cái** ($\approx 1.200\text{ kg}$).
  - Râu thép/bulông neo $4\Phi25$ L=600mm ngàm vào đầu cọc: **924 thanh**.
  - Mạ kẽm nhúng nóng toàn bộ cụm đầu cọc.

### C. Đế neo đáy BTCT + Vít xoắn PA3 (32 đế dùng chung 100%):
* Số lượng: **32 đế đúc sẵn** (11 đế $2,5\text{ m}$, 19 đế $2,75\text{ m}$, 1 đế $3,0\text{ m}$, 1 đế $3,25\text{ m}$).
* Bê tông C25/30 chống thấm B8-B10: **$92,8\text{ m}^3$** (tính hao hụt đúc sẵn 3%: **$95,6\text{ m}^3$**).
* Cốt thép bản đế (2 lớp $\Phi14\text{ a150}$ CB400-V + đai C + gia cường lỗ): $\approx \mathbf{7.250\text{ kg}}$.
* Cọc vít xoắn ống thép $\Phi89 \times 5\text{ mm}$, ren $\Phi250 \div 300\text{ mm}$ mạ kẽm:
  - Số lượng: $32 \times 4 = \mathbf{128\text{ cọc vít}}$.
  - Tổng chiều dài: $\mathbf{474\text{ md}}$ (cây dài $3,0 \div 4,5\text{ m}$).
  - Nắp chụp thép khóa đầu cọc vít vào đế: **128 bộ**.
* Cụm tai neo đôi trên mặt đế (Double Padeye thép tấm dày $25\text{ mm}$): **32 bộ** ($\approx 1.600\text{ kg}$).

---

## 3. ĐẦU RA YÊU CẦU CLAUDE THỰC HIỆN
1. Viết script Node.js: `scripts/exportMaterialOrderBOQ.mjs` (sử dụng thư viện `xlsx`) để xuất file Excel:
   - **Tên file:** `public/docs_huoi_vanh/HOHUOIVANH_BANG_THONG_KE_VAT_TU_ORDER.xlsx` (và đồng thời xuất bản sao vào `docs/mat-bang-neo-9-be/`).
   - Cấu trúc file Excel gồm 5 sheet chuẩn:
     * Sheet 1: `1.TONG_HOP_ORDER` (Bảng tổng hợp vật tư mua hàng theo nhóm: Cáp, Bê tông, Thép, Vít xoắn, Phụ kiện liên kết, kèm quy cách order, đơn vị tính, số lượng, hệ số dự phòng).
     * Sheet 2: `2.CHI_TIET_CAP_BRIDLE` (295 dòng chi tiết từng tuyến cáp: mã tuyến, loại neo, tầm vươn, L chốt-chốt, L cáp chính, 2 nhánh chạc Y, tổng L order, chủng loại cáp PES).
     * Sheet 3: `3.COC_KHOAN_NHOI_BO` (Chi tiết 231 cọc D350: phân nhóm theo cụm bè, số lượng cọc, chiều dài, thể tích bê tông, khối lượng thép chủ $\Phi25 \div \Phi32$, thép đai $\Phi8$, bản mã đầu cọc).
     * Sheet 4: `4.DE_NEO_DAY_VIT_XOAN` (Chi tiết 32 đế neo: ký hiệu đế, 2 cụm bè dùng chung, kích thước B x t, thể tích bê tông, thép lưới, số cọc vít và chiều dài vít $\Phi89$, phao treo).
     * Sheet 5: `5.PHU_KIEN_LIEN_KET` (Thống kê chi tiết Ma-nê các cấp tải, Tăng đơ 10-12T, Khuyên lót cáp, Vòng chia chạc Y Master Link, Xích vi chỉnh bích bè).
2. Kiểm tra `npm test` và `npm run build` đảm bảo không ảnh hưởng tới các module hiện hữu.
3. Báo cáo kết quả lại cho PM sau khi hoàn thành.
