# Social Creative Studio: quy trình làm việc

Ba quy trình của app: **tạo chữ**, **tạo ảnh**, **quản lý chiến dịch**. Mỗi quy trình ghi rõ ai làm gì (bạn, AI, hay app tự làm), điểm dừng để bạn kiểm tra, và bước nào tốn tiền AI.

Hướng dẫn bấm nút từng màn hình nằm ở `HUONG_DAN_SU_DUNG.md`. Tài liệu này nói về **thứ tự và lý do**.

## 0. Nguyên tắc chung

| Nguyên tắc | Ý nghĩa trong thực tế |
|---|---|
| **AI chỉ vẽ nền** | Chữ, logo, nút CTA, họa tiết thương hiệu do app đặt lên. Ảnh không bao giờ có chữ sai chính tả hay logo méo. Ảnh người thật là ảnh bạn tải lên. |
| **Một nguồn sự thật** | Lời nằm ở ① Nền tảng và ③ Kế hoạch. Hình nằm ở ② Moodboard. Mọi lời nhắc gửi AI đều đọc từ đó, không có chỗ thứ ba. |
| **AI đề xuất, bạn duyệt** | Mô tả moodboard, khung bài, bản chỉnh ảnh đều hiện ra để bạn xem rồi mới áp dụng. Không bước nào tự ghi đè công sức của bạn. |
| **Có quy tắc kiểm tra bằng máy** | App tự soát ngày, biến trống, cụm bị cấm, văn phong máy, độ sáng vùng chữ. AI không phải người duy nhất soát. |
| **Chỉ chạy khi bạn tick** | Soạn chữ và tạo ảnh hàng loạt chỉ chạy trên thẻ bài đã tick, để không tốn tiền ngoài ý muốn. |

Việc tốn tiền AI (cần API key): gợi ý khung bài, soạn chữ, viết lại caption, đọc moodboard, **tạo nền ảnh**, **chỉnh ảnh khi cần đổi nền**. Mọi việc còn lại miễn phí: bố cục, đặt họa tiết, soát, lịch, xuất.

---

## 1. Quy trình tạo CHỮ

```
① Nền tảng (lời) ─┐
③ Kế hoạch (bài) ─┼→ Soạn nháp bằng AI → bạn sửa → Soi văn phong → Soát → Sẵn sàng
Biến [TÊN BIẾN] ──┘
```

### Bước 1. Chuẩn bị "nguyên liệu" cho AI (làm một lần cho cả chiến dịch)
- ① Nền tảng: mục tiêu, đối tượng, ý tưởng lớn, thông điệp, trụ cột, giọng điệu, điều nên nói.
- **Điều không được nói**: viết cụm cấm trong ngoặc kép. App dặn AI tránh, và cảnh báo khi cụm đó xuất hiện nguyên văn.
- **Biến** `[TÊN BIẾN]`: số suất, ưu đãi, hạn chót. Điền một lần, app thay vào caption, ảnh, tài liệu. AI được dặn giữ nguyên placeholder, không tự bịa số liệu.

### Bước 2. Mỗi bài có một "bản đặt hàng" trong Kế hoạch
Sheet 01 và 03: tên, funnel, trụ cột, hook, mục tiêu, cấu trúc từng slide (S1, S2…), CTA, đối tượng, chữ gợi ý trên ảnh, điều cần tránh. **Cấu trúc slide quyết định số slide AI viết.** Bài nào thiếu cấu trúc thì AI viết 1 slide.

### Bước 3. Soạn nháp bằng AI
Nút *Soạn nháp bằng AI* ở trang bài (hoặc *Soạn chữ* hàng loạt ở ④ Sản xuất, trên các thẻ đã tick).
- AI nhận: thương hiệu, nền tảng, điều cấm, kế hoạch của bài, bộ nguyên tắc viết tiếng Việt (rõ ràng, cụ thể, nói lời của người đọc, bỏ từ rỗng, không văn "không chỉ… mà còn").
- AI trả về từng slide gồm: dòng nhỏ, tiêu đề (tối đa 8 từ), dòng nhấn, mô tả phụ, CTA; cộng caption và hashtag nếu kế hoạch chưa có.
- **App ghi vào slide**, nhưng **không ghi đè caption và hashtag bạn đã viết**. Bài từ trạng thái Brief chuyển sang Copy.
- Bài reel: mỗi "slide" là một cảnh, chữ cực ngắn.

### Bước 4. Viết lại caption (khi cần)
Nút *AI viết lại caption*: hai lượt. Lượt 1 viết caption mới từ kế hoạch (caption cũ chỉ để tham khảo). Lượt 2, một "biên tập viên" AI đọc bản nháp cùng danh sách lỗi mà quy tắc máy phát hiện, rồi viết lại. Lượt 2 lỗi thì giữ bản lượt 1.

### Bước 5. Bạn đọc và sửa tay
Đây là bước **bắt buộc có người**. Chỗ thường phải sửa: số liệu, tên riêng, dữ kiện nội bộ, giọng điệu. Dùng *Soi văn phong* để máy chỉ ra các mẫu câu "nghe như máy".

### Bước 6. Soát chữ
Soát tự động báo ✖ (chặn) khi còn biến trống, cụm cấm, thiếu caption; ⚠ (cảnh báo) khi ngày ngoài kỳ chiến dịch, số liệu không có trong kế hoạch, văn phong máy. Xem phần 3.

**Điểm dừng của bạn:** sau bước 3 (xem AI viết có đúng ý không) và sau bước 5 (chốt chữ trước khi làm ảnh, vì ảnh được đo theo độ dài chữ).

---

## 2. Quy trình tạo ẢNH

```
② Moodboard ──┐
Chữ đã chốt ──┼→ Đo chỗ chữ → AI vẽ nền → Kiểm độ sáng vùng chữ → (thử lại 1 lần)
Họa tiết ─────┘        → Chọn bố cục → Đặt họa tiết → Ghép chữ, logo → Chỉnh → Xuất
```

### Điều kiện trước khi tạo ảnh
1. Có **slide** (tạo từ kế hoạch hoặc qua bước soạn chữ).
2. Có **Mô tả không khí** ở ② Moodboard (điền tay, hoặc *AI đọc moodboard* rồi duyệt đề xuất).
3. Khuyên: chốt chữ trước, vì app đo chỗ đặt chữ trên chữ thật.

### Chuẩn bị Moodboard (làm một lần)
- **Bài mẫu cho AI**: các ảnh tham chiếu, tối đa 4 ảnh được gửi cho AI. **Mức bám bài mẫu** quyết định AI bám tới đâu: *Giống tổng thể* (mặc định, bám màu, ánh sáng, chiều sâu, kiểu cảnh, độ chi tiết) hoặc *Chỉ học màu, ánh sáng*. Cả hai mức đều không chép chữ, logo, thẻ, khung vào nền. Ảnh *Chỉ để xem* được giữ lại nhưng không gửi.
- Bảng màu, màu nhấn, font, điều cần tránh, chữ sáng hay tối.
- **Họa tiết thương hiệu** (thẻ riêng): gán vai trò cho từng hình đã cắt: *Họa tiết lớn*, *Đường bay*, *Họa tiết điểm*, *Không dùng*. Có hai cách gán nhanh: *Gợi ý vai trò* (đoán theo hình dạng, miễn phí) và *AI phân loại* (AI nhìn tất cả họa tiết, tốn một lượt AI). Có vai trò thì app tự đặt các hình đó lên ảnh và dặn AI không vẽ lại sao hay đường bay.

### Chuỗi xử lý khi bấm Tạo ảnh
| # | Ai làm | Việc | Tốn AI |
|---|---|---|---|
| 1 | App | **Đo vùng chữ**: dựng thử layout thật của các slide để biết chữ chiếm từ đâu đến đâu (vùng còn trống gọi là "free band") | không |
| 2 | App | **Soạn prompt**: mô tả không khí (đã lọc bỏ ý về thẻ, vé, giao diện, và ý về sao/đường bay nếu app tự đặt họa tiết), bảng màu, tông thương hiệu, bố cục theo vùng đã đo, điều cần tránh, quy tắc "tuyệt đối không có chữ" | không |
| 3 | AI | **Vẽ nền** với tối đa 4 ảnh bài mẫu làm tham chiếu | **có** |
| 4 | App | **Kiểm vùng chữ** trên ảnh vừa vẽ: sáng/tối đúng tông chữ, độ tương phản thấp, không có vệt ngang trên trời | không |
| 5 | AI | Nếu kiểm không đạt: **vẽ lại một lần** với nhận xét cụ thể ("quá sáng ở vùng chữ…"); app giữ bản tốt hơn, xóa bản kia | **có** (chỉ khi lỗi) |
| 6 | App | Gắn nền vào các slide cùng khổ. Slide dùng ảnh chủ đạo toàn khung thì bỏ qua | không |
| 7 | App | **Chọn bố cục** (vị trí, cỡ chữ) trên nền mới, chọn chỗ êm nhất | không |
| 8 | App | **Đặt họa tiết** vào vùng trống **của từng slide** sau khi bố cục đã chốt (nếu đã gán vai trò; slide có chữ chiếm gần hết khung thì không có họa tiết, app báo số slide đã đặt được): họa tiết lớn đi dọc carousel, đường bay nối tiếp giữa các slide, họa tiết điểm rải theo hạt giống cố định nên cùng slide luôn ra cùng hình | không |
| 9 | App | **Ghép lớp**: nền → lớp tối nhẹ → họa tiết → chữ, logo, CTA | không |

Nếu sau lần thử lại ảnh vẫn chưa đạt, app hiện cảnh báo và đã tự chọn lại vị trí chữ. Chưa vừa ý thì bấm *Nền riêng* ở đúng slide đó.

### Chỉnh sau khi tạo (ưu tiên từ rẻ đến đắt)
1. **Bố cục tự động**: chọn lại vị trí chữ, miễn phí. Sau đó họa tiết được đặt lại theo vị trí chữ mới.
2. **Đặt lại họa tiết**: miễn phí. Họa tiết bạn đã kéo, sửa hay thêm bằng tay được giữ nguyên.
3. **Chỉnh tay** trong *Chỉnh*: chữ, cỡ chữ, vị trí, logo, họa tiết, ảnh chủ đạo.
4. **Khoanh vùng + ghi chú**: AI đọc ghi chú và chọn cách sửa rẻ nhất đủ dùng: làm tối vùng chữ → đổi bố cục → sửa lời → dịch họa tiết → **chỉ khi cần mới vẽ lại nền**. Kết quả là một *bản chỉnh* đặt cạnh bản gốc, chưa xuất; bấm *Dùng bản này* khi ưng.
5. **Nền riêng**: vẽ lại nền cho một slide.

### Ảnh người thật
Ảnh mentor/học viên luôn do bạn tải lên ở *Tài nguyên* hoặc *Ảnh chủ đạo*; app có thể tách nền khi nền trơn. AI không vẽ người.

**Điểm dừng của bạn:** xem **một bài** trước khi chạy hàng loạt (tạo ảnh từng bài rồi mới tạo tiếp), vì nếu mô tả không khí chưa đúng thì cả lô sẽ sai cùng một kiểu.

---

## 3. Quy trình QUẢN LÝ chiến dịch

### 3.1 Vòng đời một bài

```
Brief → Copy → Visual → Sẵn sàng      rồi, ghi riêng:  Đã đăng → Có số liệu
```

| Trạng thái | Nghĩa | Chuyển khi |
|---|---|---|
| **Brief** | Mới có kế hoạch | Soạn chữ bằng AI xong thì tự chuyển sang Copy |
| **Copy** | Đã có chữ | Tự chuyển sang Visual khi mọi slide của bài đã có ảnh nền (slide dùng ảnh chủ đạo toàn khung được tính là đã có) |
| **Visual** | Đã có ảnh, chờ soát | Bạn soát xong và bấm *Đánh dấu sẵn sàng*. Bài đã Sẵn sàng không bị kéo lùi khi tạo lại ảnh |
| **Sẵn sàng** | Đủ điều kiện đăng | Bỏ đánh dấu thì bài quay về Copy |

*Đã đăng* và *Có số liệu* không phải trạng thái: đó là bản ghi riêng ở ⑦ (giờ đăng thật, link, số liệu). Khi khôi phục một phiên bản đã lưu, bài cũng quay về Copy để soát lại.

### 3.2 Soát và duyệt (bạn là người duyệt cuối)
- **Soát tự động** chặn ✖: còn biến trống, cụm bị cấm xuất hiện, chưa có caption. Cảnh báo ⚠: ngày sau kỳ chiến dịch, số liệu không có trong kế hoạch, điều "Không được nói", văn phong máy.
- **Checklist** theo ma trận mục kiểm tra × bài (Sheet 04): tick mục nào áp dụng cho bài nào. Còn mục chưa tick thì không thể đánh dấu sẵn sàng.
- **Phiên bản đã lưu** của từng bài: lưu lại trước khi sửa lớn, khôi phục khi cần.

### 3.3 Lịch
- Mỗi bài có ngày giờ đăng; kéo thẻ trên lịch tháng để dời.
- **Lịch lùi** tính từ ngày đăng: chữ xong (5 ngày trước), hình xong (3 ngày), sẵn sàng đăng (1 ngày). Việc quá hạn hiện ở khung đỏ trong ④ Sản xuất.
- **Bảng phủ phễu và trụ cột** cảnh báo khi một phễu hay trụ cột chưa có bài.

### 3.4 Đăng và đo
1. App **nhắc, không tự đăng.** Bạn đăng tay lên nền tảng, rồi bấm *Đã đăng…* để ghi giờ thật, link, ghi chú.
2. Sau 24-48 giờ, **nhập tay** Tiếp cận, Tương tác, Nhấp link, Lead.
3. App tổng hợp theo phễu, trụ cột, loại bài, kèm top bài.
4. Cuối chiến dịch: **Lưu làm mẫu** để dùng lại; xuất Word/PDF có mục Kết quả.

### 3.5 Nhịp làm việc đề xuất

| Khi nào | Việc | Ai quyết |
|---|---|---|
| Đầu chiến dịch | ① ② ③: lời, hình, danh sách bài | Bạn (AI gợi ý khung bài và mô tả moodboard) |
| Theo lô | Soạn chữ → bạn chốt chữ → tạo ảnh | Bạn duyệt từng lô |
| Mỗi ngày | Xem khung "việc quá hạn" và "cần đăng hôm nay" | Bạn |
| Trước hạn sẵn sàng | Soát từng bài, đánh dấu sẵn sàng | Bạn |
| Mỗi ngày đăng | Đăng, bấm *Đã đăng…* | Bạn |
| 24-48 giờ sau đăng | Nhập số liệu | Bạn |
| Cuối chiến dịch | Lưu mẫu, xuất báo cáo, sao lưu ra ổ ngoài | Bạn |

### 3.6 Quản lý dữ liệu
- Dữ liệu trong thư mục `data/` của máy, chỉ một người dùng. Mở app ở hai cửa sổ thì cửa sổ cũ bị chặn lưu để không ghi đè.
- Sao lưu đầy đủ mỗi ngày (kể cả ảnh, giữ 14 bản), lịch sử thay đổi mỗi vài phút, thùng rác 30 ngày cho ảnh bị xóa. Nút *Sao lưu* → *Hoàn tác thay đổi gần nhất*.
- **Việc của bạn:** mỗi tuần chép `data\backups` sang ổ ngoài hoặc Drive. Đừng gửi cả thư mục `data/` cho người khác vì có API key.
- **Thư mục sao lưu thứ hai** (hộp Sao lưu): mỗi ngày app tự chép dữ liệu và toàn bộ ảnh sang một thư mục ở nơi khác (ổ ngoài, Drive), giữ 14 ngày. Đây là lớp bảo vệ khi hỏng ổ cứng.
- Mỗi doanh nghiệp là một Workspace riêng; không dữ liệu nào trộn giữa các Workspace.

---

## 4. Bản đồ quyết định: gặp vấn đề thì sửa ở đâu

| Hiện tượng | Sửa ở đâu | Tốn AI |
|---|---|---|
| Chữ AI viết sai ý, thiếu dữ kiện | Bổ sung ① Nền tảng và cấu trúc ở ③, rồi soạn lại | có |
| Chữ nghe như máy | *Soi văn phong*, sửa tay hoặc *AI viết lại caption* | tùy |
| Ảnh không đúng không khí | Sửa *Mô tả không khí* và bài mẫu ở ② rồi tạo lại **một bài** để thử | có |
| Chữ khó đọc trên ảnh | *Bố cục tự động*, hoặc khoanh vùng + ghi chú (AI ưu tiên làm tối vùng chữ) | không hoặc ít |
| Họa tiết sai chỗ, thừa, thiếu | Gán lại vai trò ở ②, bấm *Đặt lại họa tiết*, hoặc kéo tay trong *Chỉnh* | không |
| AI vẽ sao hay đường bay thay vì họa tiết của bạn | Gán vai trò họa tiết để app đặt hình đúng; kiểm tra chế độ "App đặt họa tiết" | không |
| Cả lô ảnh cùng một lỗi | Lỗi nằm ở moodboard, không phải từng ảnh: sửa ở ② | có |
| Lịch lệch, thiếu phủ phễu | ⑤ Lịch và xuất | không |
