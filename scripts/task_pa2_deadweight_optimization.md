# GIAO VIỆC: KIỂM TRA LẠI & TỐI ƯU CƠ CHẾ TÍNH TOÁN PHƯƠNG ÁN 2 (KHỐI BÊ TÔNG NEO ĐÁY)

Chào Claude,

Người dùng vừa phản hồi và đặt nghi vấn rất chính xác về mặt thực tế thi công:
> **"lên kế hoạch bảo clade kiểm tra lại cách tính phương án neo đáy bằng khối bê tông, t thấy nó đang khá lớn đó"**

Hiện tại kết quả tính toán của PA2 ra khối lượng **42 – 129 tấn/khối**, kích thước đáy rộng tới **3.05 – 5.05 m**, dẫn đến:
1. Tổng bê tông neo đáy vọt lên tới hơn **5.380 m³** (gấp gần 20 lần so với 202 cọc đáy 350x350 chỉ có 250 m³ bê tông).
2. Đáy khối quá to làm **31 cặp khối bị chồng lấn nhau trên mặt bằng CAD**.
3. Khối 50 – 130 tấn vượt quá sức nâng của cẩu sà lan lòng hồ (thường chỉ 25 – 40 tấn), không khả thi thi công thực tế.

Dưới đây là phân tích nguyên nhân và các hướng tối ưu kỹ thuật cụ thể:

---

## 1. NGUYÊN NHÂN TẠI SAO MÔ HÌNH HIỆN TẠI LẠI RA KHỐI LƯỢNG QUÁ LỚN

Phân tích mã nguồn `src/lib/calc/deadweight.ts` và `src/lib/calc/index.ts`:

1. **Góc kéo cáp đáy quá dốc ($\alpha = 27^\circ \div 49^\circ$):**
   - Hiện tại engine lấy góc nghiêng cáp đáy từ nhịp ngắn nhất: $\alpha = \arctan(\text{depth} / \text{bedDist})$.
   - Khi nhịp cáp chỉ có $5.4 \div 11.6\text{ m}$ mà nước sâu $6.2\text{ m}$, góc cáp vểnh lên tới $30^\circ \div 49^\circ$.
   - Cáp kéo nghiêng $30^\circ \div 49^\circ$ sinh ra **lực nhấc thẳng đứng $V = T \cdot \sin(\alpha)$ lên tới $30 \div 98\text{ kN}$ (tương đương 3 – 10 tấn lực nhổ)** bốc khối bê tông lên trời, triệt tiêu gần hết ma sát đáy!
   - *Thực tế:* Neo trọng lực lòng hồ luôn có đoạn **xích dằn đáy (grounded chain)** hoặc bố trí nhịp cáp dài lài sát đáy, góc cáp tác dụng vào khối bê tông ở đáy hồ chỉ từ $\mathbf{0^\circ \div 10^\circ}$ (lực nhấc $V \approx 0$).

2. **Cơ chế chống trượt giả định ma sát phẳng thuần túy ($\mu = 0.35$):**
   - Với $\mu = 0.35$ và $SF_{trượt} = 1.5$, lực nén cần thiết xuống bùn là $N = \dfrac{1.5 \cdot H}{0.35} \approx 4.29 \cdot H$.
   - Bê tông chìm trong nước mất $41.7\%$ trọng lượng do lực đẩy Archimedes ($k = 0.583$).
   - Kết quả: Khối lượng bê tông trong không khí phải gấp $\dfrac{4.29}{0.583} \approx \mathbf{7.35\text{ lần lực ngang } H}$! Lực $H = 10\text{ tấn}$ thì khối phải nặng $74\text{ tấn}$!
   - *Thực tế:* Khối bê tông nặng chìm xuống bùn sẽ lún ngập vào bùn sét hoặc có **gờ chống trượt (shear key)** cắm sâu vào bùn. Khi đó sức kháng trượt do **sức kháng cắt không thoát nước của bùn sét ($c_u = 20\text{ kPa}$)** và sức kháng bị động $E_p$, không phải ma sát Coulomb phẳng đơn thuần.

3. **Điểm buộc cáp ở đỉnh khối ($h \approx 2\text{ m}$):**
   - Điểm kéo ở đỉnh khối cao $2\text{ m}$ sinh ra mômen lật $M = H \cdot h$.
   - Lực lật gây lệch tâm nghiêm trọng ở đáy, làm engine phải mở rộng đáy khối ra $3.5 \div 5.5\text{ m}$ để ép áp lực mép $q_{edge} \le q_{allow} = 40\text{ kPa}$.
   - *Thực tế:* Tai neo của khối bê tông đáy hồ được đặt **sát chân khối ($h \approx 0.2 \div 0.4\text{ m}$)** hoặc gắn vào tấm thép ngàm dưới bùn, tay đòn lật gần như bằng 0.

---

## 2. KẾ HOẠCH BẢO CLAUDE KIỂM TRA & TỐI ƯU HÓA

Đề nghị Claude kiểm tra và xây dựng báo cáo phân tích đối chiếu theo 3 kịch bản:

### Kịch bản 1: Giữ nguyên mô hình trượt phẳng nhưng chuẩn hóa điều kiện biên thực tế
- **Điểm móc cáp neo chân khối:** Đặt chiều cao móc cáp $h_{tie} = 0.3\text{ m}$ (hoặc sát chân khối) thay vì ở đỉnh khối. Xem kích thước đáy và mômen lật giảm bao nhiêu, có hết chồng lấn 31 cặp khối hay không.
- **Góc cáp neo thực tế tại đáy hồ:** Khi có đoạn xích dằn đáy (grounded chain) hoặc góc lài $\alpha \le 10^\circ$ (thay vì $30^\circ \div 49^\circ$): Xem khối lượng khối bê tông của từng bè giảm từ 50–130T xuống còn bao nhiêu tấn.

### Kịch bản 2: Bổ sung cơ chế Gờ chống trượt (Shear Key / Lực dính bùn $c_u$)
- Khối bê tông có gờ chống trượt chôn sâu $0.4 \div 0.6\text{ m}$ vào nền bùn sét ($c_u = 20\text{ kPa}$).
- Sức kháng trượt: $R_u = A_{đáy} \cdot c_u + E_p + \mu \cdot N$.
- Khối lượng khối bê tông cần thiết để giữ bè là bao nhiêu (ước tính khoảng 10 – 25 tấn)?

### Kịch bản 3: Đánh giá so sánh khả thi thi công giữa PA1 và PA2
- Với cẩu thả sà lan 25 – 40 tấn: PA2 có thể chia nhỏ khối (khối modul ghép 10 – 15 tấn) như thế nào?
- Đánh giá tổng hợp: So sánh thể tích bê tông, diện tích chiếm đáy hồ, rủi ro trôi dạt và tính khả thi giữa Cọc $350 \times 350$ (PA1) và Khối bê tông tối ưu (PA2).
