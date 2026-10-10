# Social Creative Studio: hướng dẫn sử dụng

Tài liệu cho người làm nội dung (marketing, vận hành). Thứ tự và lý do của từng quy trình (chữ, ảnh, quản lý) nằm ở `QUY_TRINH.md`.

---

## 1. Sản phẩm này làm gì

App chạy trên máy của bạn, gom toàn bộ một chiến dịch nội dung vào **một nơi duy nhất**: **chiến lược → kế hoạch bài → làm chữ và ảnh → soát → đăng → đo kết quả**. Không còn nối với Google Sheet hay Google Docs: mọi thứ soạn ngay trong app, cần gửi người khác thì xuất Word hoặc PDF.

```
① Nền tảng → ② Moodboard → ③ Kế hoạch → ④ Sản xuất → ⑦ Đăng & đo
                                  ↘ ⑤ Lịch & xuất        ↘ ⑥ Tài liệu (xem, Word, PDF)
```

Nguyên tắc cần nhớ:

- **AI chỉ vẽ nền ảnh.** Chữ, logo, CTA do app tự đặt lên, nên không sai chính tả và không có chữ lạ trong ảnh. Ảnh người thật (mentor) luôn là ảnh bạn tải lên.
- **App lên lịch và nhắc, không tự đăng** lên Facebook/Instagram.
- **Số liệu kết quả nhập tay** từ phần thống kê của nền tảng.
- **Dữ liệu nằm trong thư mục `data/` của máy bạn.** Không có tài khoản trên mạng; chỉ máy này mở được app.

---

## 2. Bắt đầu lần đầu

### 2.1 Mở app
Chạy file **Social_Creative_Studio.bat** trên Desktop, trình duyệt mở `http://127.0.0.1:5190`. Lần đầu app yêu cầu **đặt mật khẩu** (từ 8 ký tự); quên mật khẩu thì không khôi phục được qua app.

> Muốn app mượt hơn khi có nhiều bài, mở bằng lệnh `npm run start` thay vì `npm run dev`.

### 2.2 Thêm API key (cho phần AI)
Bấm **API** trên thanh trên → **Thêm key** (Google Gemini hoặc OpenAI). Key lưu trên máy, không bao giờ gửi lại trình duyệt (chỉ hiện 4 ký tự cuối). Không có key vẫn làm được mọi thứ trừ: gợi ý khung bài, soạn chữ AI, vẽ nền AI, sửa bằng ghi chú, đọc moodboard.

### 2.3 Thiết lập doanh nghiệp (Workspace)
Mỗi công ty là một **Workspace**. Điền: tên thương hiệu, lĩnh vực, khách hàng mục tiêu, giọng điệu, **chân bài mặc định**, **logo nền sáng** và (tùy chọn) logo nền tối.

### 2.4 Tạo chiến dịch
| Cách | Khi dùng |
|---|---|
| **+ Chiến dịch trống** | Bắt đầu từ số không |
| **Nhập moodboard từ PDF** | Đã có file PDF key visual: app lấy màu, font, mô tả không khí và giữ các trang bài mẫu làm ảnh tham chiếu. Tự cắt họa tiết là tùy chọn thử nghiệm; nên tải từng ảnh họa tiết riêng ở tab Moodboard |
| **Tạo từ mẫu** | Đã lưu mẫu từ chiến dịch cũ: có sẵn nền tảng, trụ cột và danh sách bài đã xếp lịch |

**Màu giao diện:** khi tạo chiến dịch bạn chọn một màu (10 màu có sẵn hoặc màu bất kỳ). Màu đó là màu nhấn của nút, tab, liên kết, và **nền trang ngả theo sắc ấy**. Đổi bất cứ lúc nào bằng nút **Màu giao diện** ở đầu trang chiến dịch (kèm thanh độ đậm của nền). Mỗi chiến dịch một màu nên nhìn là biết đang ở chiến dịch nào.

---

## 3. Bảy tab của chiến dịch

### ① Nền tảng: phần LỜI
Mục tiêu, thời gian, KPI, đối tượng, ý tưởng lớn, thông điệp, trụ cột, giọng điệu, điều nên nói, **điều không được nói**, và các **biến** `[TÊN BIẾN]` (dữ kiện như số suất, ưu đãi, hạn chót: điền một lần, app thay vào caption, ảnh, tài liệu). Mọi lời nhắc gửi AI đều đọc từ đây.

- "Không được nói": app cảnh báo khi một cụm đặt trong **ngoặc kép** (hoặc cả dòng nếu ngắn) xuất hiện nguyên văn trong caption hay slide, và dặn AI tránh các ý đó.
- Có phần **kiểm tra dữ kiện** (ngày ngoài kỳ chiến dịch, giá trị lệch, AI soát mâu thuẫn).

### ② Moodboard: phần HÌNH
Cách làm khuyên dùng: **tải từng phần của moodboard bằng một ảnh riêng**, mỗi loại ảnh có cách xử lý riêng:

| Nút | Ảnh tải lên | App làm gì |
|---|---|---|
| **+ Bài mẫu cho AI** | Bài đăng mẫu hoàn chỉnh | Gửi cho AI làm tham chiếu khi vẽ nền (tối đa 4 ảnh) |
| **+ Chỉ để xem** | Trang tham khảo | Giữ trong moodboard, không gửi AI |
| **+ Trang màu (tự đọc màu)** | Trang bảng màu | Tự đọc bảng màu, màu nhấn, màu chữ; bạn xem rồi bấm *Áp dụng màu* |
| **+ Trang họa tiết (tự tách nền)** | Ảnh họa tiết: đường đồng mức, điểm đánh dấu, đường bay… | Tự xóa nền phẳng, chỉ giữ nét vẽ; bạn chọn dùng làm *Họa tiết phủ nền*, *Họa tiết lớn*, *Đường bay* hoặc *Họa tiết điểm* và chỉnh *Độ tách nền* nếu nét mờ bị mất |

Mỗi ảnh nên chỉ chứa **một phần** (cắt sẵn từ file moodboard): nền ảnh càng đơn giản, tách càng sạch. Họa tiết nhỏ nên bật *Cắt sát hình*; họa tiết phủ cả slide thì bỏ tích.

Các thiết lập khác: bảng màu, màu nhấn, font, điều cần tránh; **Mức bám bài mẫu** (*Giống tổng thể*: AI bám màu, ánh sáng, chiều sâu, kiểu cảnh, độ chi tiết; hoặc *Chỉ học màu, ánh sáng*; chữ, logo, thẻ trong bài mẫu không bao giờ được chép vào nền); **Nền ảnh**: *AI vẽ* (tốn phí) hoặc *Gradient màu thương hiệu* (miễn phí, luôn khớp với họa tiết đặt lên). **Mô tả không khí** do AI đổi từ **Ý tưởng lớn** ở ①: bấm **AI đọc moodboard**, xem đề xuất rồi mới áp dụng.

Nút **Nhập moodboard từ PDF** vẫn còn, dùng để lấy nhanh màu, font, mô tả và các trang bài mẫu từ cả file; phần tự cắt họa tiết trong PDF là thử nghiệm nên tắt sẵn.

**Họa tiết thương hiệu** (thẻ riêng): mỗi họa tiết có một vai trò (*Họa tiết phủ nền*, *Họa tiết lớn*, *Đường bay*, *Họa tiết điểm*, *Không dùng*); nút *Gợi ý vai trò* đoán theo hình dạng, nút *AI phân loại* cho AI nhìn tất cả họa tiết và gán vai trò. Khi có vai trò, app tự đặt họa tiết lên slide: họa tiết phủ nền nằm dưới chữ trên cả khung (trên carousel nó nối liền từ slide này sang slide kia, có thanh *Độ đậm*), các họa tiết còn lại nằm trong vùng trống của từng slide, và AI được dặn không tự vẽ họa tiết nữa. Chọn *AI tự vẽ theo mô tả* nếu muốn cách cũ. Họa tiết do app đặt có thể kéo/xóa trong Chỉnh; cái bạn đã sửa sẽ được giữ khi đặt lại.

### ③ Kế hoạch (bảng tính, 4 sheet ở thanh dưới)
| Sheet | Nội dung |
|---|---|
| **01 Lịch nội dung** | Mỗi dòng một bài: ID, tên, loại, ngày, giờ, funnel, pillar, hook, format, mục tiêu, cấu trúc, CTA, đối tượng, trạng thái. Cột cuối: Mở, ↑ ↓, Nhân bản, Xóa |
| **02 Caption** | Caption và hashtag từng bài |
| **03 Visual Brief** | Khổ ảnh, hero visual, bố cục, typography, palette (chỉ tham khảo), chữ trên ảnh, motion, tài nguyên, điều cần tránh |
| **04 Checklist** | Ma trận mục kiểm tra × bài: tick ô để mục đó áp dụng cho bài |

Thao tác như bảng tính: **↑ ↓ hoặc Enter** chuyển dòng, cột ID và Tên bài ghim khi cuộn ngang, ô nhiều dòng giãn ra khi bấm vào (**Alt+Enter** xuống dòng). Thanh công cụ có **+ Thêm dòng**, **AI gợi ý khung bài** (cân phễu và trụ cột), **Sắp theo ngày**; phía dưới có **Tạo slide nháp**. **Nhập từ Excel** (nút góc phải) dùng một lần để bắt đầu từ kế hoạch có sẵn.

### ④ Sản xuất
Mọi bài xếp theo trạng thái **Brief → Copy → Visual → Sẵn sàng**. Bài tự chuyển sang **Copy** khi soạn chữ xong và sang **Visual** khi mọi slide đã có ảnh nền; **Sẵn sàng** do bạn bấm sau khi soát. Mỗi thẻ có nút **Tạo ảnh** riêng; muốn làm cả nhóm thì tick thẻ rồi dùng **Soạn chữ** / **Tạo ảnh** ở trên (không tick thì hai nút không chạy, để tránh tốn tiền AI ngoài ý muốn). Khung đỏ "việc quá hạn theo lịch lùi" hiện ở đây.

### ⑤ Lịch & xuất
- **Lịch tháng:** kéo thẻ bài sang ngày khác để dời lịch; kéo vào khung "Chưa xếp lịch" để bỏ ngày. Màu thẻ theo phễu.
- **Lịch lùi:** từ ngày đăng, app tính hạn *chữ xong* (5 ngày trước), *hình xong* (3 ngày), *sẵn sàng đăng* (1 ngày); đổi số ngày ngay dưới lịch.
- **Bảng phủ phễu và trụ cột** kèm cảnh báo thiếu.
- **Xuất ảnh hoàn chỉnh:** zip PNG từng slide kèm caption, mỗi bài một thư mục.

### ⑥ Tài liệu: xem và xuất
- **Trang bài:** thanh bên trái liệt kê **Tổng quan** và từng bài như các tab của một tài liệu; bấm để đọc trang (chỉ đọc). Muốn sửa thì bấm "Mở trang bài" hoặc sửa ở ③.
- **Xuất Word / PDF:** Xem trước, PDF (hộp thoại in, chọn *Lưu thành PDF*), Word (.docx). Có tùy chọn kèm ảnh và chỉ bài "Sẵn sàng". Tài liệu gồm: chiến lược, lịch, từng bài, và mục Kết quả khi đã có bài đăng.

### ⑦ Đăng & đo
1. **Đăng bài:** danh sách chờ đăng, khung nhắc "cần đăng ngay / việc đăng hôm nay" (tùy chọn nhắc bằng thông báo trình duyệt, chỉ chạy khi app đang mở). Đăng xong bấm **Đã đăng…** để ghi giờ thật, link bài, ghi chú.
2. **Số liệu:** nhập tay Tiếp cận, Tương tác, Nhấp link, Lead cho từng bài; app tính tỷ lệ tương tác và tổng hợp theo **phễu, trụ cột, loại bài**, kèm top bài.
3. **Lưu chiến dịch làm mẫu** để dùng lại cho chiến dịch sau.

---

## 4. Trang từng bài (bấm **Mở**)

1. **Sửa kế hoạch của bài** (mở rộng ra): tên, loại, brief, visual brief, mục kiểm tra.
2. **1 · Chữ:** *Soạn nháp bằng AI* (chữ từng slide), *AI viết lại caption*, hashtag, soi văn phong.
3. **2 · Hình:** *Tạo ảnh* (app đo chỗ đặt chữ rồi nhờ AI vẽ nền chỉ ở phần còn trống), *Bố cục tự động* (miễn phí), *Đặt lại họa tiết* (miễn phí, khi đã gán vai trò họa tiết). Mỗi slide có **Chỉnh**: đổi chữ, vị trí, cỡ chữ, logo, thành phần đồ họa, ảnh chủ đạo (ảnh thật của mentor), và **Khoanh vùng + ghi chú** để AI chỉnh đúng chỗ bạn khoanh (tạo *bản chỉnh* bên cạnh, bấm *Dùng bản này* khi ưng).
4. **Tài nguyên:** tải ảnh thật cần cho bài, tách nền khi nền trơn.
5. **3 · Soát và sẵn sàng:** app tự soát (✖ chặn: còn biến trống, cụm bị cấm, chưa có caption; ⚠ cảnh báo: ngày sau kỳ chiến dịch, số liệu không thấy trong kế hoạch, điều "Không được nói", văn phong máy…), tick mục kiểm tra, rồi **Đánh dấu sẵn sàng**. Có **Phiên bản đã lưu**: lưu lại trước khi sửa lớn và khôi phục khi cần.
6. **4 · Xuất:** gói zip (ảnh + caption); reel không người: storyboard hoặc MP4 (dựng trong Chrome/Edge, không có tiếng).

---

## 5. Lối tắt và công cụ chung

| Việc | Cách |
|---|---|
| Tìm mọi thứ (bài, caption, slide, giá trị biến, link) | **Ctrl+K** hoặc nút **Tìm**, không cần gõ dấu |
| Quay lại bản cũ, hoàn tác | Nút **Sao lưu** → *Hoàn tác thay đổi gần nhất* hoặc chọn một bản |
| Gửi người khác xem | Tab ⑥ → Word hoặc PDF |

---

## 6. An toàn dữ liệu

- App **tự sao lưu đầy đủ mỗi ngày** (cả ảnh), giữ 14 bản. Trong hộp **Sao lưu** có ô **Thư mục sao lưu thứ hai**: điền một thư mục ở ổ khác hoặc thư mục Drive thì mỗi ngày app tự chép dữ liệu và toàn bộ ảnh sang đó (giữ 14 ngày), có nút *Chép ngay*; giữ **lịch sử thay đổi** (khoảng 5 phút một mốc, 40 bản); tự giữ bản trước khi dữ liệu giảm đột ngột; ảnh bị xóa nằm trong thùng rác 30 ngày.
- Mở app ở **hai cửa sổ** thì cửa sổ cũ bị chặn lưu (hiện thanh đỏ) để không ghi đè dữ liệu mới; tải lại để lấy bản mới nhất.
- **Điều bạn nên làm:** bản sao lưu mặc định nằm cùng ổ với dữ liệu nên chưa chống được hỏng ổ cứng. Hãy điền **Thư mục sao lưu thứ hai** như trên (hoặc mỗi tuần chép thư mục `data` sang ổ ngoài). Đừng gửi cả thư mục `data/` cho người khác vì có chứa API key.

---

## 7. Quy trình mẫu cho một chiến dịch 2 tuần

| Thời điểm | Việc |
|---|---|
| **Ngày 0** | Workspace (logo, chân bài) → tạo chiến dịch (chọn màu) → ① Nền tảng đủ trụ cột, KPI, điều không được nói, biến → ② Moodboard |
| **Ngày 1** | ③ Kế hoạch: AI gợi ý khung → chỉnh bảng → xem phủ phễu ở ⑤ → tạo slide nháp |
| **Ngày 2–4** | ④ Sản xuất theo lô: soạn chữ → tạo ảnh từng bài (xem kỹ trước khi tạo tiếp) → chỉnh bằng ghi chú khoanh vùng |
| **Trước hạn "sẵn sàng"** | Soát từng bài → đánh dấu sẵn sàng → tab ⑥ xuất Word/PDF nếu cần gửi người khác |
| **Mỗi ngày đăng** | Tab ⑦: đăng xong bấm "Đã đăng…" (giờ và link) |
| **Sau mỗi bài 24–48 giờ** | Nhập số liệu |
| **Cuối chiến dịch** | Lưu làm mẫu; xuất Word/PDF có mục Kết quả; sao lưu ra ổ ngoài |

---

## 8. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp / cách xử lý |
|---|---|
| Mở app không thấy gì | `.bat` còn chạy bản cũ: đóng cửa sổ lệnh cũ rồi chạy lại |
| Gõ chậm, trễ | Mở bằng `npm run start` |
| Không bấm được "Đánh dấu sẵn sàng" | Còn mục ✖ hoặc mục kiểm tra chưa tick (có dòng "Cần: …" bên cạnh) |
| AI vẽ sai ngôi sao/biểu tượng | Gán vai trò cho họa tiết ở thẻ **Họa tiết thương hiệu** để app tự đặt đúng hình lên ảnh |
| Mất ảnh sau khi xóa | Vào **Sao lưu**, khôi phục: app lấy ảnh lại từ bản sao lưu hoặc thùng rác |
| Thanh đỏ "Dữ liệu đã được lưu từ cửa sổ khác" | Bấm Tải lại; chỉ nên dùng một cửa sổ |
| PDF in bị cắt | Chọn khổ A4, tắt "Header and footers"; hoặc xuất Word rồi lưu PDF |

---

## 9. Hạn chế đã biết

- App không tự đăng, không tự kéo số liệu, không dùng được từ thiết bị khác qua mạng.
- Một số phần chỉ thử trên dữ liệu thử: tạo ảnh AI thật, PDF in qua trình duyệt, mở tệp Word bằng Microsoft Word, thông báo trình duyệt.
