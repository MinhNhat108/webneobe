# GIAO VIỆC CHO CLAUDE: RÀ SOÁT TÍNH TOÁN CHUYÊN SÂU & TỐI ƯU HỆ NEO 9 BÈ

Chào Claude,

Người dùng vừa chỉ đạo phân chia công việc giữa Antigravity và Claude:
- **Antigravity (Em):** Phụ trách các việc giao diện UI, đồng bộ thuyết minh Tab 6, Tab 7, Tab 9, tài liệu đính kèm Tab 5, xuất CAD/Excel và cập nhật web.
- **Claude:** Phụ trách các việc khó, tính toán cơ học chính xác, kiểm tra an toàn chuyên sâu và tìm điểm tối ưu thêm cho hệ thống.

---

## 1. CÁC NỘI DUNG TÍNH TOÁN & TỐI ƯU CHUYÊN SÂU GIAO CHO CLAUDE

### 1.1. Xem xét tối ưu 5 tuyến dây bờ có góc xiên lớn (65° – 75°)
- Hiện tại có 5 tuyến dây mới/móc lại đang có góc xiên lớn so với pháp tuyến mép bè:
  * `B3-D15` (75°)
  * `B5A-D48` (72°)
  * `B5A-D49` (73°)
  * `B7-D30` (65°)
  * `B8-D28` (70°)
- **Nhiệm vụ:** Kiểm tra xem có thể điều chỉnh vị trí cọc hoặc tráo đổi liên kết trong nhóm để nắn góc xiên về $< 60^\circ$ (hoặc nhỏ nhất có thể) nhằm tăng hiệu quả giữ bè theo phương vuông góc mép mà không gây cắt chéo cáp hay vi phạm địa hình IFC $\ge 384,0\text{ m}$ không? Nếu không thể nắn hơn vì địa hình khống chế thì ghi rõ lý do kỹ thuật.

### 1.2. Rà soát tổ hợp tải trọng & tối ưu kích thước 32 đế neo đáy dùng chung
- Cả 32 đế neo đáy hiện đã là đế dùng chung 100%.
- Kiểm tra lại kích thước của 32 đế ($B = 2,50 \div 3,25\text{ m}$):
  * Đặc biệt là 2 đế $3,25\text{ m}$ ở khe hẹp Bè 3 ↔ Bè 3A (DV-006, DV-007, DV-008 hoặc tương đương).
  * Kiểm tra các tổ hợp: (1) Cáp 1 max + Cáp 2 pretension 5 kN; (2) Cáp 2 max + Cáp 1 pretension 5 kN; (3) Trường hợp bao cả 2 cáp cùng căng ở cả MNC 380,0 m và MNLKT 386,0 m.
  * Xem xét có thể tinh chỉnh vị trí đế hoặc góc cáp để tối ưu giảm kích thước từ $3,25\text{ m}$ xuống $2,75 \div 3,0\text{ m}$ mà vẫn đảm bảo 100% an toàn (trượt, nhổ, lật, áp lực nền) không?

### 1.3. Kiểm tra an toàn cọc khoan nhồi bờ D350
- 231 cọc khoan nhồi bờ D350 ($L = 6,5\text{ m}$, thép $4\Phi25 \div 6\Phi32$).
- Kiểm tra ứng suất uốn $\gamma M_{max} \le M_{rd}$ theo TCVN 5574:2018 (cọc tròn lồng thép).
- Kiểm tra sức chịu tải ngang theo Broms ($H_{allow} \ge T_{max} \cos\theta$).
- Xác nhận các giả định địa chất ($\phi = 28^\circ, c = 12\text{ kPa}, c_u = 40\text{ kPa}$) và ghi chú về cổ cọc nhô $\le 0,1\text{ m}$.

---

## 2. KẾT QUẢ ĐẦU RA MONG ĐỢI TỪ CLAUDE
1. Báo cáo đánh giá chi tiết: kết quả tối ưu 5 dây xiên, kết quả tối ưu kích thước 32 đế đáy dùng chung.
2. Nếu có tinh chỉnh tọa độ hay kích thước, cập nhật vào script và xuất lại dữ liệu json (`huoiVanhCoordinates_v2.json`, `huoiVanhPiles_v2.json`, `huoiVanhRaftCatalogue.json`).
3. Đảm bảo toàn bộ test pass (`npm run test`).
4. Gửi mail phản hồi cho Antigravity để Antigravity phối hợp cập nhật giao diện, bản vẽ và đẩy lên web.
