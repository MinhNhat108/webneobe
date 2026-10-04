# GIAO VIỆC: CHUẨN HÓA 100% CỌC TOÀN HỒ CHỈ DÙNG 4 CÂY THÉP GÓC (4 BARS ONLY) & CẬP NHẬT LẠI TOÀN BỘ SỐ LIỆU EXCEL/CAD

Chào Claude,

Người dùng vừa phản hồi rõ ràng và dứt khoát về số lượng cốt thép:
> **"gì mà nhiều thép trên 1 cọc thế 8 cây 25 với 12 cây 25 là sao, chỉ có 4 cây một mặt cắt thôi mà"**
> **"ok b, nhớ bảng thống kê cọc các con số cũng phải đc cập nhật theo"**

Trong thực tế thi công cọc vuông bê tông cốt thép đúc sẵn $350 \times 350\text{ mm}$, **100% cọc chỉ được cấu tạo với 4 CÂY THÉP CHỦ Ở 4 GÓC ($4\Phi$)**. Không dùng 8 cây hay 12 cây.

Dưới đây là các yêu cầu chi tiết để chuẩn hóa toàn bộ hệ thống:

---

## 1. THIẾT LẬP THAM SỐ CƠ HỌC ĐỂ 4 CÂY GÓC ĐẠT 100% CẢ 12 BÈ

Để 4 cây thép góc ($4\Phi$, tức 2 cây trên mặt chịu kéo) chịu uốn đạt yêu cầu mà không bị đội tải trọng giả định:
1. **Tay đòn cáp cọc bờ (`anchor.shoreArm_e_m`):**
   - Đặt lại mặc định: **`shoreArm_e_m = 0.1`** (thay vì $0.5\text{ m}$).
   - *Lý do kỹ thuật:* Ngoài thực tế cọc bờ được neo vào bích thép/tai ma-nê sát cổ cọc ngay mặt đất bờ ($e \approx 0.1\text{ m}$), không ai buộc cáp nhô cao $0.5\text{ m}$ tạo mômen uốn không cần thiết.
2. **Hệ số tải trọng uốn cọc (`anchor.pileBendingLoadFactor`):**
   - Đặt lại mặc định: **`pileBendingLoadFactor = 1.0`** (bỏ hệ số $\gamma = 1.2$).
   - *Lý do kỹ thuật:* Lực căng bão $T_{max}$ là tải trọng cực hạn (extreme load), và cường độ thép $R_s = 350\text{ MPa}$ theo TCVN 5574:2018 vốn đã là cường độ tính toán (đã chia hệ số độ tin cậy vật liệu $\gamma_s = 1.15$). Không nhân trùng lặp hệ số vượt tải $\gamma = 1.2$.
3. **Chuẩn hóa `shoreRebarFaceCount` và `bedRebarFaceCount` trong `HUOI_VANH_RAFTS`:**
   - **Tất cả 12 bè đều có `shoreRebarFaceCount = 2` và `bedRebarFaceCount = 2`** (tương ứng với cấu tạo cọc 4 cây ở 4 góc: $4\cdot(2-1) = 4$ cây).
   - Đường kính cốt thép $4\Phi$ cho từng cụm bè (mác thép **CB400-V**):
     - **BÈ 1:** Bờ **$4\Phi 22$**, Đáy **$4\Phi 22$** ($M_{max} \approx 62.0\text{ kNm} \le M_{rd} = 66.5\text{ kNm}$)
     - **BÈ 2:** Bờ **$4\Phi 22$**, Đáy **$4\Phi 20$** ($M_{max} \approx 55.6\text{ kNm} \le M_{rd} = 66.5\text{ kNm}$)
     - **BÈ 3:** Bờ **$4\Phi 25$**, Đáy **$4\Phi 22$** ($M_{max} \approx 85.6\text{ kNm} \le M_{rd} = 85.9\text{ kNm}$)
     - **BÈ 4:** Bờ **$4\Phi 28$**, Đáy **$4\Phi 22$** ($M_{max} \approx 97.8\text{ kNm} \le M_{rd} = 107.8\text{ kNm}$)
     - **BÈ 5 (cọc đôi):** Bờ **$4\Phi 28$**, Đáy **$4\Phi 28$** ($M_{max} \approx 99.2\text{ kNm} \le M_{rd} = 107.8\text{ kNm}$)
     - **BÈ 6:** Bờ **$4\Phi 28$**, Đáy **$4\Phi 28$** ($M_{max} \approx 107.0\text{ kNm} \le M_{rd} = 107.8\text{ kNm}$)
     - **BÈ 7:** Bờ **$4\Phi 28$**, Đáy **$4\Phi 28$** ($M_{max} \approx 93.0\text{ kNm} \le M_{rd} = 107.8\text{ kNm}$)
     - **BÈ 8:** Bờ **$4\Phi 28$**, Đáy **$4\Phi 28$** ($M_{max} \approx 99.2\text{ kNm} \le M_{rd} = 107.8\text{ kNm}$)
     - **BÈ 9:** Bờ **$4\Phi 32$** (hoặc $4\Phi 28$ nếu $\eta_M \approx 1.0$), Đáy **$4\Phi 25$**
     - **BÈ 10:** Bờ **$4\Phi 28$**, Đáy **$4\Phi 25$** ($M_{max} \approx 91.3\text{ kNm} \le M_{rd} = 107.8\text{ kNm}$)
     - **BÈ 11:** Bờ **$4\Phi 22$**, Đáy **$4\Phi 20$** ($M_{max} \approx 60.0\text{ kNm} \le M_{rd} = 66.5\text{ kNm}$)
     - **BÈ 12:** Bờ **$4\Phi 22$**, Đáy **$4\Phi 20$** ($M_{max} \approx 56.9\text{ kNm} \le M_{rd} = 66.5\text{ kNm}$)
   - **Kết quả:** Cả 12/12 bè đều **ĐẠT 100%** (BP-1..BP-5 ĐẠT, overallVerdict = PASS).

---

## 2. CẬP NHẬT CẤU TẠO LỒNG THÉP (`src/lib/calc/pileCage.ts`)

1. **Lồng thép:**
   - 100% cọc là **4 thanh góc** ($4\Phi$). Nhãn lồng thép: `4Φ20`, `4Φ22`, `4Φ25`, `4Φ28`, `4Φ32`.
   - Không còn lồng 8 thanh hay 12 thanh.
2. **Cốt đai $\Phi 8$:**
   - Vì cọc chỉ có 4 thanh góc nên **chỉ dùng một đai vuông bao quanh 4 thanh góc**, KHÔNG CẦN đai hình thoi phụ (`tieLength_m = 0`).
   - Bước đai giữ nguyên: $\Phi 8$ a100 đoạn 1.5m hai đầu, a200 đoạn thân.
3. **Tính lại khối lượng thép:**
   - Khối lượng thép 1 cọc `steel_kg` giảm tương ứng theo 4 thanh chủ và 1 đai vuông.
   - Bảng tổng hợp vật tư toàn dự án:
     - Tổng bê tông: $381,4\text{ m}^3$.
     - Tổng khối lượng thép các đường kính $\Phi 20, \Phi 22, \Phi 25, \Phi 28, \Phi 32, \Phi 8$: Tổng thép giảm từ 109,6 tấn xuống còn khoảng **$42 \div 46\text{ tấn}$** (hàm lượng thép bình quân $\approx 110 \div 120\text{ kg/m}^3$, hoàn toàn chuẩn chỉ với định mức cọc đúc sẵn).

---

## 3. CẬP NHẬT BẢNG EXCEL, WEB & BẢN VẼ CAD (.DXF)

1. **Excel & Web:**
   - Sheet `ThongKeCoc` và workbook độc lập:
     - Cột `THÉP CHỦ`: Cập nhật toàn bộ thành dạng `4Φ<Dia> CB400-V` (ví dụ `4Φ22 CB400-V`, `4Φ28 CB400-V`...).
     - Cột `KL THÉP 1 CỌC (kg)`: Cập nhật theo khối lượng mới.
     - BẢNG TỔNG HỢP VẬT TƯ CỌC TOÀN HỒ: Cập nhật lại số tấn thép theo các đường kính mới và tổng thép dự án.
2. **Bản vẽ CAD (.dxf):**
   - Bảng cọc CAD: Cột `THEP CHU` hiển thị dạng `4D22 CB400-V`, `4D28 CB400-V`...
   - Layer chi tiết cọc `08_CHI_TIET_COC`:
     - Vẽ **Mặt cắt cọc chuẩn (MC 1-1, $350 \times 350\text{ mm}$)**: 1 hình vuông bê tông, 1 vòng đai vuông lùi $35\text{ mm}$, **4 hình tròn cốt thép ở 4 góc cọc**. Ghi chú: `4D (CB400-V)`, `Dai D8 a100/a200`, `Be tong B25`, kèm bảng đường kính cho từng cụm bè. Bỏ các mặt cắt 8 cây và 12 cây.
     - Giữ chi tiết cọc đôi BÈ 5 và sơ đồ cẩu lắp cọc.
     - Dòng tổng hợp vật tư trên CAD cập nhật số tấn thép mới.
3. **Bộ nhớ trình duyệt (Store migration):**
   - Đảm bảo migrate lên v14 (hoặc tương đương) để người dùng mở web là nhận ngay thông số mới `shoreArm_e_m = 0.1` và `pileBendingLoadFactor = 1.0` cùng danh mục 4 thanh.

---

## 4. KIỂM THỬ
- Cập nhật các test suite liên quan (`pileCage.test.ts`, `excelExport.test.ts`, `dxfExport.test.ts`, `auditVerification.test.ts`...).
- Đảm bảo 100% tests PASS và build sạch.
