# GIAO VIỆC: TRIỂN KHAI BẢN VẼ CAD CHI TIẾT CẤU TẠO ĐẦU CỌC KHOAN NHỒI BỜ D350 VÀ LIÊN KẾT TAI NEO CÁP

Chào Claude,

Người dùng vừa yêu cầu:
> **"giờ tạo giúp t hình ảnh cấu của cái đầu cọc nhồi ở ven bờ kết nối với cáp đc ko. m hay claude làm tốt hơn thì bảo ban nhau chia ra mà làm"**

Phân chia công việc:
1. **Phía tôi (Antigravity):** Đang sử dụng engine đồ họa 3D render ảnh phối cảnh thực tế & ảnh cắt lớp 3D kỹ thuật (3D visual rendering) trực quan sinh động cho người dùng.
2. **Phía bạn (Claude):** Triển khai **bản vẽ kỹ thuật CAD 2D chuẩn kích thước gia công cơ khí** cho chi tiết đầu cọc bờ D350 và liên kết tai neo cáp:
   - Cập nhật vào layer `08_CHI_TIET_COC` trong file xuất CAD DXF (`src/lib/io/pileCageDetailDxf.ts`).
   - Cập nhật hiển thị chi tiết trực quan lên giao diện Web (ví dụ trong Tab 5 Tài liệu hoặc có bản vẽ minh họa).

---

### CÁC YÊU CẦU THIẾT KẾ CẤU TẠO ĐẦU CỌC BỜ D350 mm (e <= 0.1 m):

1. **Đầu cọc nhô khỏi mặt đất:**
   - Cọc bê tông tròn D350 mm, đầu cọc nhô cao $e = 0.1\text{ m}$ (100 mm) so với mặt đất tự nhiên (đúng yêu cầu thi công đã đặt ra để giảm cánh tay đòn uốn).
   - Đỉnh cọc được đổ phẳng hoặc có cổ vát cố-pha $400 \times 400$ mm bọc ngoài.

2. **Bản mã nắp đỉnh cọc (Cap plate):**
   - Bản thép hình vuông $400 \times 400 \times 20\text{ mm}$ (thép SS400 hoặc Q345).
   - 4 bu-lông neo / râu neo thép gân $\Phi 22 \div \Phi 25$ hàn vào mặt dưới bản mã, cắm sâu vào bê tông cọc $L_{neo} \ge 600\text{ mm}$ (ngàm chắc vào lồng thép cọc).

3. **Tai neo cáp (Padeye / Anchor Lug):**
   - Tấm tai neo thép dày $t = 25\text{ mm}$, cao $180\text{ mm}$, hàn đứng chắc chắn trên bản mã đỉnh cọc bằng đường hàn góc liên tục $h_f = 10\text{ mm}$ kèm 2 sườn tăng cường chống uốn ngang $t = 12\text{ mm}$.
   - Khoan lỗ xỏ ma-nê $\Phi 42\text{ mm}$ (tim lỗ cách mép đỉnh $50\text{ mm}$).
   - Bố trí hướng của tai neo xoay theo phương kéo cáp về phía bè nổi.

4. **Liên kết ma-nê & cáp neo:**
   - Ma-nê cẩu/neo dạng móng ngựa (Bow Shackle) tải trọng làm việc SWL 25T (chịu lực kéo $T_{max} \approx 100 \div 225\text{ kN}$).
   - Khuyên lót cáp giọt lệ (Thimble) bọc đầu cáp chống mài mòn, ép ống bấm chì hoặc bện đầu cáp chuyên dụng.
   - Cáp kéo xiên góc $\alpha \approx 12^\circ \div 15^\circ$ xuống mặt hồ.

5. **Nội dung vẽ trên CAD DXF (`pileCageDetailDxf.ts`):**
   - Vẽ **Chi tiết 3: CẤU TẠO ĐẦU CỌC BỜ D350 & TAI NEO CÁP (Tỷ lệ 10:1 hoặc 20:1)**:
     + Hình chiếu đứng (Mặt cắt cắt dọc đỉnh cọc qua tim cọc, bản mã, tai neo, bu-lông neo và ma-nê nối cáp).
     + Hình chiếu bằng đỉnh cọc (Thấy bản mã $400 \times 400$, 4 bu-lông neo, tai neo ở giữa, sườn tăng cường).
     + Đầy đủ ghi chú kích thước và vật liệu: Bê tông B25, Bản mã $t=20$, Tai neo $t=25$ lỗ D42, Bu lông neo 4D22 cắm 600mm, Ma-nê SWL 25T, Cáp neo xiên góc $12^\circ - 15^\circ$.

Nhờ bạn triển khai phần bản vẽ CAD này nhé! Cảm ơn bạn.
