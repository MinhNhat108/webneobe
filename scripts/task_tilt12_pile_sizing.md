# GIAO VIỆC: ĐỔI GÓC NGHIÊNG MẶC ĐỊNH SANG 12 ĐỘ & TÍNH TOÁN PHƯƠNG ÁN CỌC VUÔNG 300x300 / 350x350 (CHO PHÉP TĂNG CHIỀU DÀI CỌC)

Chào Claude,

Người dùng vừa chỉ đạo yêu cầu kỹ thuật mới:
> **"chỉnh lại thông số mặc định trên web là 12 độ đi b, sau đó giao cluade tính với cọc vuông 300x300 hoặc 350x350 , chiều dài cọc có thể tăng lên mà"**

Đây là một hướng tối ưu hóa kết cấu rất hay: Khi giảm góc nghiêng giàn pin từ $15^\circ$ xuống $12^\circ$, diện tích đón gió hiệu dụng giảm $\approx 20\%$, kéo theo tổng lực gió $F_{env}$ và lực căng cáp $T_{max}$ của 12 cụm bè giảm từ $18.5\% \div 19.5\%$. Người dùng muốn xem xét việc giảm tiết diện cọc xuống **$300 \times 300\text{ mm}$** hoặc **$350 \times 350\text{ mm}$** bằng cách **tăng chiều dài cọc $L_{tk}$** để bù lại.

Dưới đây là các nhiệm vụ cụ thể để Claude thực hiện:

---

## 1. CẬP NHẬT GÓC NGHIÊNG MẶC ĐỊNH SANG 12.0° VÀ ĐỒNG BỘ TOÀN DỰ ÁN
1. **Thiết lập mặc định `solarTilt_deg = 12.0`**:
   - `src/data/huoiVanhProject.ts`: `HUOI_VANH_DEFAULT_PROJECT.raft.solarTilt_deg = 12.0`.
   - `src/components/simulation/SimulationView.tsx`: fallback `?? 12`.
   - `src/components/simulation/ThreeSimulationCanvas.tsx`: fallback `?? 12`.
   - `src/store/useProjectStore.ts`: version migrate lên v11 để trình duyệt tự nhận 12.0°.
2. **Cập nhật các test suite**:
   - Khi giảm góc nghiêng xuống 12°, tải trọng gió giảm dẫn đến lực kéo đáy giảm, khối lượng và kích thước khối bê tông neo đáy (PA2) định cỡ lại:
     - Khối nhỏ nhất từ ~51 T giảm xuống ~42 T.
     - Số cặp khối chồng lấn giảm từ 34 cặp xuống 31 cặp.
   - Cập nhật các assert trong `src/lib/calc/__tests__/deadweight.test.ts` và `src/lib/io/__tests__/deadweightDxf.test.ts` để 100% test PASS.

---

## 2. BÀI TOÁN TÍNH TOÁN CỌC VUÔNG 300x300 VÀ 350x350 KHI CHO PHÉP TĂNG CHIỀU DÀI CỌC ($L_{tk}$)

Phân tích kỹ lưỡng cơ học Broms cho 12 cụm bè khi góc nghiêng là $12^\circ$:

### 2.1. Đối với cọc neo đáy hồ (Bed Piles - 175 cọc):
- Cọc đáy chịu tải ngang $H = T \cos\alpha$ và tải nhổ $V = T \sin\alpha$.
- Sức chịu nhổ $V_{uplift} = \alpha \cdot c_u \cdot (4a) \cdot L_{tk}$. Khi tăng chiều dài cọc $L_{tk}$ (ví dụ từ $8.0 \div 10.5\text{ m}$ lên $12.0 \div 14.0\text{ m}$), sức chịu nhổ tăng tỷ lệ thuận với $L_{tk}$.
- **Đánh giá cọc $350 \times 350\text{ mm}$ đáy hồ**:
  - Với $L_{tk} = 12.0\text{ m}$: 9/12 cụm bè (Bè 1, 2, 3, 4, 7, 9, 10, 11, 12) **ĐẠT 100%** cả kiểm tra nhổ, kiểm tra ngang và uốn!
  - Chỉ còn Bè 5 (quá lớn) và Bè 6, Bè 8 là hơi vượt uốn.
- **Đánh giá cọc $300 \times 300\text{ mm}$ đáy hồ**: Vẫn bị quá mảnh ($L/a = 12.0 / 0.3 = 40$), uốn $\eta_M > 1.0$ ở đa số các bè.

### 2.2. Đối với cọc neo bờ (Shore Piles - 129 cọc):
- **Phân tích bản chất cơ học Broms**:
  - Cọc bờ có tay đòn nhô khỏi mặt đất $e = 0.5\text{ m}$ chịu lực kéo ngang lớn $H$.
  - Khi cọc đã cắm sâu hơn độ sâu ngàm tới hạn ($L \ge 4\text{ m}$), cọc làm việc như cọc dài uốn mềm.
  - Vị trí mô men uốn nguy hiểm nhất $M_{max}$ nằm ở độ sâu nông ($1.5 \div 2.0\text{ m}$ dưới mặt đất). Do đó: **Việc tăng chiều dài cọc $L_{tk}$ từ 6.5m lên 8m, 10m hay 15m KHÔNG LÀM GIẢM ĐƯỢC $M_{max}$ và không cứu được kiểm tra uốn $BP-2$!**
  - Khả năng chịu uốn $M_{rd}$ chỉ phụ thuộc vào tiết diện ($W = a^3/6$) và cốt thép dọc $A_s$.
  - Khi ở 12° tilt:
    - Cọc bờ $350 \times 350\text{ mm}$ **ĐẠT ở 4 cụm bè**: Bè 1 ($\eta_M = 0.96$), Bè 2 ($\eta_M = 0.87$), Bè 11 ($\eta_M = 0.93$), Bè 12 ($\eta_M = 0.89$).
    - Ở các bè còn lại: $\eta_M = 1.29 \div 1.79$ (riêng Bè 5 là 3.26). Để cọc $350\times 350$ đạt được ở các bè này, bắt buộc phải khai báo cốt thép chịu uốn hoặc tăng số cọc bờ để chia tải.
    - Cọc bờ $300 \times 300\text{ mm}$: $\eta_M$ vượt từ $1.4 \div 5.8$ lần $\to$ không thể áp dụng cho cọc bờ.

---

## 3. BÁO CÁO KẾT QUẢ & ĐỀ XUẤT PHƯƠNG ÁN TỐI ƯU
Claude lập bảng tổng hợp số liệu chi tiết cho 12 cụm bè và trả lời rõ cho người dùng:
1. Bảng so sánh tải trọng giữa $15^\circ$ và $12^\circ$ (lực gió, $T_{max}$).
2. Kết quả kiểm toán khi dùng cọc $300 \times 300$ và $350 \times 350$ với chiều dài tăng lên ($L_{tk} = 10\text{ m} \div 14\text{ m}$).
3. Giải thích rõ ràng nguyên lý tại sao việc tăng chiều dài cọc giải quyết được cọc đáy (sức kháng nhổ bùn), nhưng không giải quyết được uốn cọc bờ (do $M_{max}$ tập trung gần mặt đất).
4. Đề xuất phương án kết hợp tối ưu:
   - Cọc đáy: Giảm xuống **$350 \times 350\text{ mm}$** và tăng chiều dài lên $12.0\text{ m}$ (cho 11 cụm bè, trừ Bè 5).
   - Cọc bờ: Dùng **$450 \times 450\text{ mm}$** (hoặc $350 \times 350\text{ mm}$ cho các bè 1, 2, 11, 12).
   - Riêng Bè 5 ($16.436\text{ m}^2$) giữ cọc $600 \times 600\text{ mm}$.

Claude triển khai cập nhật code mặc định 12°, kiểm tra test suite và gửi phản hồi nhé! Cảm ơn bạn.
