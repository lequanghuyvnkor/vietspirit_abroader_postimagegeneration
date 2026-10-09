# Social Creative Studio: hướng dẫn sử dụng

Tài liệu cho người làm nội dung (marketing, vận hành). Phần cuối là **gợi ý tối ưu sản phẩm** dựa trên cách app đang vận hành.

---

## 1. Sản phẩm này làm gì

App chạy trên máy của bạn, gom toàn bộ một chiến dịch nội dung vào một nơi: **chiến lược → kế hoạch bài → làm chữ và ảnh → duyệt → đăng → đo kết quả → tổng kết**. Google Sheet và Google Docs chỉ còn là đường nhập/xuất tùy chọn.

```
① Nền tảng → ② Moodboard → ③ Kế hoạch → ④ Sản xuất → (duyệt) → ⑦ Đăng & đo
                                   ↘ ⑤ Lịch & xuất      ↘ ⑥ Tài liệu (PDF/Word, bản chốt)
```

Nguyên tắc cần nhớ:

- **AI chỉ vẽ nền ảnh.** Chữ, logo, CTA do app tự đặt lên, nên không sai chính tả và không có chữ lạ trong ảnh. Ảnh người thật (mentor) luôn là ảnh bạn tải lên, không do AI vẽ.
- **App lên lịch và nhắc, không tự đăng** lên Facebook/Instagram.
- **Số liệu kết quả nhập tay** từ phần thống kê của nền tảng.
- **Dữ liệu nằm trong thư mục `data/` của máy bạn.** Không có tài khoản trên mạng; chỉ máy này mở được app.

---

## 2. Bắt đầu lần đầu

### 2.1 Mở app
Chạy file **Social_Creative_Studio.bat** trên Desktop, trình duyệt mở `http://127.0.0.1:5190`.
Lần đầu app yêu cầu **đặt mật khẩu** (từ 8 ký tự). Quên mật khẩu thì không khôi phục được qua app; hãy lưu ở nơi an toàn.

> Muốn app mượt hơn khi có nhiều bài, mở bằng lệnh `npm run start` thay vì `npm run dev` (xem mục 9.1).

### 2.2 Thêm API key (cho phần AI)
Bấm **API** trên thanh trên → **Thêm key** (Google Gemini hoặc OpenAI). Key lưu trên máy, không bao giờ gửi lại trình duyệt (chỉ hiện 4 ký tự cuối). Có thể thêm nhiều key và chọn key khi dùng. Không có key vẫn làm được mọi thứ trừ: gợi ý khung bài, soạn chữ AI, vẽ nền AI, sửa bằng ghi chú, đọc moodboard.

### 2.3 Thiết lập doanh nghiệp (Workspace)
Mỗi công ty là một **Workspace**. Điền: tên thương hiệu, lĩnh vực, khách hàng mục tiêu, giọng điệu, **chân bài mặc định** (hotline, fanpage), **logo nền sáng** và (tùy chọn) logo nền tối. Chỉnh cỡ logo bằng thanh trượt; áp cho mọi bài.

### 2.4 Tạo chiến dịch
Trong Workspace có ba cách:

| Cách | Khi dùng |
|---|---|
| **Nhập moodboard từ PDF** | Đã có file moodboard: app tự lấy màu, font, mô tả không khí, cắt các thành phần đồ họa (sao, đường bay, thẻ…) |
| **+ Chiến dịch trống** | Bắt đầu từ số không |
| **Tạo từ mẫu** | Đã lưu mẫu từ chiến dịch cũ (xem 3.7): có sẵn nền tảng, trụ cột và danh sách bài đã xếp lịch |

**Màu giao diện:** khi tạo chiến dịch bạn chọn một màu (10 màu có sẵn hoặc màu bất kỳ). Màu đó là màu nhấn của nút, tab, liên kết, và **nền trang cũng ngả theo sắc ấy**. Đổi bất cứ lúc nào bằng nút **Màu giao diện** ở đầu trang chiến dịch (đổi là thấy ngay), kèm thanh **độ đậm của màu nền**. Mỗi chiến dịch một màu, nên nhìn là biết đang ở chiến dịch nào; ra ngoài chiến dịch thì app về màu chàm mặc định. Màu tự được chỉnh để chữ luôn đọc được, ở cả chế độ sáng và tối.

---

## 3. Đi qua bảy tab của chiến dịch

### ① Nền tảng
Nơi duy nhất ghi **mục tiêu, thời gian, KPI, đối tượng (insight, rào cản), ý tưởng lớn, thông điệp chính, trụ cột nội dung, giọng điệu, điều nên nói, điều không được nói**, và **các biến** (dữ kiện như số suất, ưu đãi, hạn chót).

- Mọi lời nhắc gửi cho AI đều đọc từ đây, nên điền kỹ thì AI viết sát.
- **Biến** `[TÊN BIẾN]`: điền một lần, app thay vào caption, ảnh, tài liệu. Còn biến trống thì bài **không thể duyệt**.
- Có phần **kiểm tra dữ kiện** (ngày ngoài kỳ chiến dịch, giá trị trùng/lệch, AI soát mâu thuẫn).

### ② Moodboard
**Phần HÌNH của chiến dịch** (trái với ① là phần LỜI). Nút **Nhập moodboard từ PDF** nằm ở đây và chỉ đổi Moodboard: không đụng Nền tảng, Kế hoạch hay tên chiến dịch. Nhập lại vào chiến dịch đang có thì app hỏi từng phần (màu/font/mô tả, thành phần đồ họa, ảnh moodboard, logo Workspace); ảnh moodboard và logo mặc định **được giữ nguyên**.

**Mô tả không khí** (phần hình của ý tưởng) do AI đổi từ **Ý tưởng lớn** ở ① Nền tảng: bấm **AI đọc moodboard** (hoặc **AI gợi ý từ Ý tưởng lớn** khi chưa có ảnh), xem đề xuất rồi mới áp dụng. Vì vậy Nền tảng chỉ giữ phần lời, Moodboard chỉ giữ phần hình.

Chọn ảnh theo vai trò: **chủ thể** (biểu tượng chính, gửi cho AI làm tham chiếu đầu tiên), **không khí** (màu, ánh sáng), **mẫu bài hoàn chỉnh** (chỉ để xem, không gửi AI). Chỉnh bảng màu, màu nhấn, màu chữ, font, điều cần tránh. Có thêm **thành phần đồ họa** cắt từ PDF/ảnh để đặt lên bài.

### ③ Kế hoạch (bảng tính nhiều sheet)
Giao diện như Google Sheet của dự án: **6 sheet ở thanh dưới**, mọi ô sửa trực tiếp, cùng một nguồn dữ liệu.

| Sheet | Nội dung |
|---|---|
| **01 Chiến lược** | Mục tiêu, thời gian, ý tưởng lớn, thông điệp, giọng điệu; bảng KPI, Đối tượng, Trụ cột; điều Nên nói / Không được nói (cùng dữ liệu với tab ① Nền tảng) |
| **02 Lịch nội dung** | Mỗi dòng một bài: ID, tên, loại, ngày, giờ, funnel, pillar, hook, format, mục tiêu, cấu trúc, CTA, đối tượng, KPI, paid, điều kiện, story. Cột cuối: Mở, ↑ ↓, Nhân bản, Xóa |
| **03 Caption** | Caption, hashtag, ghi chú compliance của từng bài |
| **04 Visual Brief** | Khổ ảnh, hero visual, bố cục, typography, palette (tham khảo), chữ trên ảnh, motion, tài nguyên, điều cần tránh |
| **05 Checklist duyệt** | Ma trận mục kiểm tra × bài: tick ô để mục đó bắt buộc với bài |
| **06 Tổng quan** | Bảng phủ phễu và trụ cột, danh sách bài còn điểm cần xem lại |

Thao tác như bảng tính: **mũi tên ↑ ↓ hoặc Enter** chuyển dòng, cột ID và Tên bài được ghim khi cuộn ngang, ô nhiều dòng giãn ra khi bấm vào (**Alt+Enter** xuống dòng). Bảng dài (hơn 60 dòng) chỉ vẽ phần đang nhìn thấy nên vẫn mượt.
- **AI gợi ý khung bài**, **Sắp theo ngày**, **Tạo slide nháp** nằm ở thanh công cụ.
- **Google Sheet / Excel** chỉ để nhập một lần, ở khung "Kết nối Google Sheet" phía trên. Khi Sheet còn nối, các sheet chỉ để xem; bấm **Đóng băng Sheet và soạn trong app** để chuyển hẳn sang soạn trong app.

### ④ Sản xuất
Mọi bài xếp theo trạng thái: **Brief → Copy → Visual → Chờ duyệt → Sẵn sàng**. Mỗi thẻ có nút **Tạo ảnh** riêng. Muốn làm cả nhóm: tick thẻ rồi dùng **Soạn chữ** / **Tạo ảnh** ở trên (không tick thì hai nút không chạy, để tránh tốn tiền AI ngoài ý muốn). Khung đỏ **"việc quá hạn theo lịch lùi"** hiện ở đây.

### ⑤ Lịch & xuất
- **Lịch tháng:** kéo thẻ bài sang ngày khác để dời lịch; kéo vào khung "Chưa xếp lịch" để bỏ ngày. Màu thẻ theo phễu.
- **Lịch lùi:** từ ngày đăng, app tính hạn *chữ xong* (mặc định 5 ngày trước), *hình xong* (3 ngày), *duyệt xong* (1 ngày). Đổi số ngày ngay dưới lịch.
- **Bảng theo ngày** (đổi ngày, giờ, trạng thái, bên sản xuất; xuất CSV) và **Xuất ảnh hoàn chỉnh** (zip, mỗi bài một thư mục).

### ⑥ Tài liệu (trang như Google Docs)
Ba chế độ xem ở đầu tab:

1. **Trang bài:** thanh bên trái liệt kê **Tổng quan** và từng bài như các tab của Google Docs (chấm màu theo trạng thái, kèm ngày đăng); bấm để mở trang. Trang bài là tờ giấy có thể sửa trực tiếp: tên, ngày, giờ, loại, funnel, hook, mục tiêu, cấu trúc, CTA, caption, hashtag, tick mục duyệt, kèm ảnh các slide. **+ Trang bài mới** thêm một bài. Trang Tổng quan có chiến lược và bảng lịch (bấm một dòng để mở bài đó).
2. **Xuất & bản duyệt:** Xem, PDF (hộp thoại in), Word, Markdown; **Chốt bản duyệt (v1, v2…)** giữ nguyên chữ và ảnh tại thời điểm chốt; app báo "Từ v1 đến nay: N bài đã đổi".
3. **Google Docs (tùy chọn):** đẩy sang Google Docs khi cần.

Dữ liệu ở Trang bài, Kế hoạch (bảng tính), trang từng bài và tab ① Nền tảng là **một**; sửa ở đâu cũng thấy ở các nơi còn lại.

### ⑦ Đăng & đo
1. **Đăng bài:** danh sách chờ đăng, khung nhắc "cần đăng ngay / việc đăng hôm nay" (tùy chọn nhắc bằng thông báo trình duyệt, chỉ chạy khi app đang mở). Đăng xong bấm **Đã đăng…** để ghi giờ thật, link bài, ghi chú.
2. **Số liệu:** nhập tay Tiếp cận, Tương tác, Nhấp link, Lead cho từng bài. App tính tỷ lệ tương tác và tổng hợp theo **phễu, trụ cột, loại bài**, kèm top bài.
3. **Xem lại hằng tuần:** mỗi tuần ba ô: điều làm tốt, điều chưa tốt, việc tuần tới.
4. **Tổng kết chiến dịch** và nút **Lưu chiến dịch này làm mẫu**.

---

## 4. Trang từng bài (bấm **Mở**)

Từ trên xuống:

1. **Sửa kế hoạch của bài** (mở rộng ra): tên, loại, brief, visual brief, mục duyệt.
2. **1 · Chữ:** *Soạn nháp bằng AI* (chữ từng slide), *AI viết lại caption* (viết rồi tự biên tập một lần), hashtag. Có phần **soi văn phong** (dấu hiệu văn máy, văn thủ tục).
3. **2 · Hình:** *Tạo ảnh* (app đo chỗ đặt chữ rồi nhờ AI vẽ nền chỉ ở phần còn trống), *Bố cục tự động* (miễn phí, thử các vị trí và cỡ chữ trên nền hiện có). Mỗi slide có **Chỉnh**:
   - đổi chữ, vị trí, cỡ chữ, logo (ẩn/vị trí/kích thước), thành phần đồ họa, tấm kính mờ sau chữ;
   - **ảnh chủ đạo** (ảnh thật của mentor): đặt dưới/bên phải/toàn khung, dạng bo góc/tròn/tách nền, kèm bảng tên;
   - **Khoanh vùng + ghi chú** để AI chỉnh đúng chỗ bạn khoanh, tạo *bản chỉnh* bên cạnh bản gốc; bấm *Dùng bản này* khi ưng.
4. **Tài nguyên:** tải ảnh thật cần cho bài (mentor, credential…), tách nền khi nền trơn.
5. **3 · Duyệt** (hai tầng, xem mục 5).
6. **4 · Xuất:** gói zip (ảnh và caption), reel: storyboard hoặc MP4 (reel không người, dựng trong trình duyệt Chrome/Edge, không có tiếng).

Reel **có người thật** do bên khác quay: app giữ caption, mục duyệt, tài nguyên và xuất **phiếu bàn giao** (.md); không làm hình ở đây.

---

## 5. Quy trình duyệt hai tầng

**Tầng 1, app tự soát** (không tốn AI): ✖ chặn (còn biến trống, dùng cụm bị cấm, chưa có caption), ⚠ cảnh báo (nhắc ngày sau kỳ chiến dịch, **số liệu không thấy trong kế hoạch/dữ kiện**, văn phong máy, thiếu hook, chưa có slide…). Còn ✖ thì không gửi duyệt được.

**Tầng 2, bạn duyệt thương hiệu:** tick hết mục duyệt → **Gửi duyệt** → **Duyệt thương hiệu** (ghi chú) hoặc **Yêu cầu sửa** (bắt buộc ghi lý do; bài về "Copy").

**Khóa theo nội dung:** bài đã duyệt hiện 🔒. Sửa bất cứ chữ, ảnh, slide, ngày hay brief thì bài **tự về "Chờ duyệt"**, để không có bản nào đang đi đăng mà khác với bản đã duyệt. Trạng thái "Sẵn sàng" chỉ đặt được qua nút Duyệt.

**Lịch sử phiên bản:** mỗi lần gửi duyệt, duyệt, yêu cầu sửa, sửa sau duyệt đều được lưu, cho biết khác bản hiện tại ở đâu, và **Khôi phục** được.

**Duyệt nhanh (trên thanh trên):** gom mọi bài chờ duyệt ở mọi chiến dịch thành thẻ gọn (ảnh vuốt ngang, caption, kết quả tự soát, nút Duyệt/Yêu cầu sửa), thiết kế vừa màn hình nhỏ.

---

## 6. Lối tắt và công cụ chung

| Việc | Cách |
|---|---|
| Tìm mọi thứ (bài, caption, slide, giá trị biến, link) | **Ctrl+K** hoặc nút **Tìm**, không cần gõ dấu, ↑ ↓ rồi Enter |
| Duyệt các bài đang chờ | Nút **Duyệt nhanh (N)** |
| Quay lại bản cũ, hoàn tác | Nút **Sao lưu** → *Hoàn tác thay đổi gần nhất* hoặc chọn một bản |
| Thuê/giao việc cho bên ngoài | Phiếu bàn giao của reel; Word/PDF từ tab Tài liệu |

---

## 7. An toàn dữ liệu

- App **tự sao lưu đầy đủ mỗi ngày** (cả ảnh), giữ 14 bản; giữ **lịch sử thay đổi** (khoảng 5 phút một mốc, 40 bản); tự giữ bản trước khi dữ liệu giảm đột ngột; ảnh bị xóa nằm trong thùng rác 30 ngày.
- **Khôi phục** nằm ở nút **Sao lưu**; trước mỗi lần khôi phục app tự lưu trạng thái hiện tại.
- **Điều bạn nên làm:** bản sao lưu nằm cùng ổ với dữ liệu, nên chưa chống được hỏng ổ cứng hay mất máy. Mỗi tuần chép thư mục `data\backups` (hoặc cả `data`) sang ổ ngoài/Drive.
- Thư mục `data/` chứa mật khẩu đã mã hóa và **API key**: đừng gửi cả thư mục cho người khác.

---

### Tách bạch dữ liệu giữa các doanh nghiệp

- Mỗi **Workspace** là một doanh nghiệp; chiến dịch, bài, ảnh, mẫu của workspace này không hiện ở workspace khác.
- **Mỗi chiến dịch phải có Google Sheet và Google Docs riêng.** Nếu hai chiến dịch (kể cả ở hai workspace) cùng nối một Sheet, app **dừng kéo**, báo đỏ ở đầu trang và ở trang chủ, kèm nút gỡ.
- **Lần kéo Sheet đầu tiên luôn có bước xem trước**: app cho biết Sheet có bao nhiêu bài, sẽ thêm bài nào, có thay chiến lược hiện có không; chưa đồng ý thì chưa có gì đổi. Tự kéo chỉ bật sau lần đầu.
- Khung **"Kiểm tra dữ liệu"** tự phát hiện: dùng chung Sheet/Docs, hoặc từ ba bài trở lên giống hệt (cùng mã và tiêu đề) giữa hai workspace. Nút **"Gỡ dữ liệu Sheet khỏi chiến dịch này"** xóa các bài kéo từ Sheet (kèm slide), chiến lược và điều không được nói do Sheet ghi vào, ngắt kết nối; giữ nguyên bài bạn tự tạo, Nền tảng, Moodboard. Trước khi sửa app tự tạo bản sao lưu đầy đủ.
- Bài kéo từ Sheet có nhãn **Sheet** trong bảng kế hoạch.

---

## 8. Quy trình mẫu cho một chiến dịch 2 tuần

| Thời điểm | Việc |
|---|---|
| **Ngày 0** (chuẩn bị) | Workspace (logo, chân bài) → tạo chiến dịch → ① Nền tảng đủ trụ cột, KPI, điều không được nói, điền biến → ② Moodboard |
| **Ngày 1** | ③ Kế hoạch: AI gợi ý khung → chỉnh bảng → xem bảng phủ phễu → tạo slide nháp |
| **Ngày 2–4** | ④ Sản xuất theo lô: soạn chữ cho nhóm bài → tạo ảnh từng bài (xem kỹ trước khi tạo tiếp) → chỉnh bằng ghi chú khoanh vùng |
| **Trước hạn "duyệt xong"** | Gửi duyệt → duyệt (hoặc yêu cầu sửa) → tab Tài liệu: **chốt bản v1** gửi người liên quan |
| **Mỗi ngày đăng** | Tab ⑦: đăng xong bấm "Đã đăng…" (giờ và link) |
| **Sau mỗi bài 24–48 giờ** | Nhập số liệu |
| **Mỗi cuối tuần** | Xem lại tuần, sao lưu ra ổ ngoài |
| **Cuối chiến dịch** | Tổng kết → lưu làm mẫu → xuất Word/PDF có mục Kết quả |

---

## 9. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp / cách xử lý |
|---|---|
| Mở app không thấy gì | `.bat` còn chạy bản cũ: đóng cửa sổ lệnh cũ rồi chạy lại |
| Gõ chậm, trễ | Mở bằng `npm run start`; bảng kế hoạch nhiều bài đã gom lần gõ |
| Không nút **Duyệt** | Còn mục ✖ hoặc mục duyệt chưa tick (có dòng "Cần: …" bên cạnh) |
| Bài tự về "Chờ duyệt" | Bạn đã sửa nội dung sau khi duyệt (đúng thiết kế); duyệt lại |
| Không đặt được "Sẵn sàng" | Phải đi qua bước Duyệt |
| Bảng kế hoạch bị khóa | Google Sheet vẫn đang là nguồn; bấm *Đóng băng Sheet* |
| AI vẽ sai ngôi sao/biểu tượng | Moodboard chưa có ảnh **Biểu tượng chính**; chọn từ thành phần đã cắt |
| Mất ảnh sau khi xóa | Vào **Sao lưu**, khôi phục: app lấy ảnh lại từ bản sao lưu hoặc thùng rác |
| PDF in bị cắt | Chọn khổ A4, tắt "Header and footers"; hoặc xuất Word rồi lưu PDF |

---

# Gợi ý tối ưu sản phẩm

Xếp theo mức ưu tiên (giá trị cho bạn so với công sức). Mỗi mục nêu **vấn đề thấy được** và **cách làm**.

## A. Nên làm sớm (giá trị cao, công sức nhỏ)

1. **Chạy bản đã dựng sẵn (`npm run start`) làm mặc định.**
   *Vấn đề:* chế độ dev của React chậm khoảng 6 lần khi có hàng trăm bài (đo được ~1 giây mỗi phím gõ ở 168 bài, bản dựng sẵn ~150 ms). *Cách làm:* đổi file `.bat` trên Desktop sang `npm run start`. Đánh đổi: mở app chậm thêm 1–2 giây.
2. **Sao lưu ra ngoài máy.**
   *Vấn đề:* sao lưu hiện cùng ổ với dữ liệu. *Cách làm:* thêm nút "Tải bản sao lưu về (.zip)" và tùy chọn tự chép sang thư mục Drive/ổ ngoài đã chọn mỗi đêm.
3. **Chuẩn hóa trụ cột.**
   *Vấn đề:* kế hoạch đánh số P1–P5 nhưng Nền tảng chỉ có 3 trụ cột, nên bảng phủ trụ cột chỉ khớp được một phần. *Cách làm:* nhập đủ trụ cột trong Nền tảng và ghi trụ cột của bài bằng cách chọn từ danh sách (đổi ô trụ cột thành ô chọn thay vì gõ tự do).
4. **Điền "điều không được nói" và danh sách biến ngay từ đầu.** Tầng tự soát và nhiều cảnh báo chỉ mạnh khi dữ liệu này đầy đủ. Có thể thêm bước "Kiểm tra sẵn sàng bắt đầu sản xuất" ở tab Nền tảng.
5. **Nhập số liệu bằng tệp.** Nhập tay 4 số cho từng bài tốn thời gian. *Cách làm:* nút "Nhập từ CSV" nhận tệp xuất từ Meta Business Suite và ghép theo link bài đã lưu ở "Đã đăng".

## B. Giá trị cao, công sức vừa

6. **Khóa cứng bài đã duyệt.** Hiện là *khóa theo nội dung* (sửa thì về chờ duyệt). Nếu cần chặn hẳn việc gõ vào bài đã duyệt, cần khóa các ô nhập ở màn hình sửa slide.
7. **Nhắc việc ngoài app.** Nhắc đăng bài chỉ chạy khi app đang mở. *Cách làm:* xuất lịch `.ics` (đưa lên Google Calendar/điện thoại) hoặc gửi nhắc qua Zalo/Telegram/email một lần mỗi sáng.
8. **Tốc độ dựng tài liệu có ảnh.** Dựng 55 slide mất ~25 giây vì phải vẽ lại từng slide. *Cách làm:* lưu ảnh đã vẽ theo phiên bản slide (cache) để lần sau chỉ vẽ slide đã đổi.
9. **PDF thật.** PDF hiện đi qua hộp thoại in của trình duyệt (phụ thuộc cài đặt in). *Cách làm:* sinh PDF trực tiếp, kèm mục lục và đánh số trang.
10. **Tầng tự soát bằng AI.** Tầng 1 đang là quy tắc: so số liệu với kế hoạch, cụm cấm, ngày. *Cách làm:* thêm một lượt AI đối chiếu caption với bảng dữ kiện và "điều không được nói" rồi gắn cờ đoạn nghi vấn (người vẫn quyết định).
11. **Báo chi phí AI.** Mỗi lần tạo ảnh tốn tiền nhưng app chưa hiện tổng. *Cách làm:* đếm số ảnh/lần gọi theo chiến dịch và hiện ước tính; đặt hạn mức có cảnh báo.
12. **Mẫu bố cục.** Lưu "bố cục slide" yêu thích (vị trí chữ, panel, ảnh mentor) và áp cho cả loạt, để các bài cùng chiến dịch đồng nhất mà không chỉnh tay từng slide.

## C. Chiến lược (cần cân nhắc kỹ)

13. **Làm việc nhóm.** App chạy một máy một người. Nếu có thêm người duyệt/biên tập, có hai hướng: (a) chỉ gửi **bản chốt PDF/Word** (đã có); (b) đưa app lên máy chủ có tài khoản và phân quyền (soạn, duyệt, chỉ xem). (b) là dự án riêng, kèm bảo mật.
14. **Duyệt từ điện thoại thật.** Trang *Duyệt nhanh* đã vừa màn hình nhỏ, nhưng máy chủ chỉ nhận kết nối từ chính máy bạn. Mở ra mạng nội bộ cần mật khẩu mạnh và HTTPS; hoặc dùng truy cập từ xa có mã hóa. Nên quyết định cùng với mục 13.
15. **Tự kéo số liệu và tự đăng.** Cần xin quyền ứng dụng Meta (kiểm duyệt app, token), nên chỉ đáng làm khi khối lượng đăng lớn. Trước mắt, nhập CSV (mục 5) cho phần lớn lợi ích.
16. **Kiểm thử tự động.** Các hàm quan trọng (hợp nhất Sheet, duyệt/khóa, lịch lùi, tổng hợp số liệu) chưa có test. Thêm bộ test nhỏ cho các hàm này giảm rủi ro khi sửa app về sau.

## D. Cải thiện cách dùng (không cần sửa code)

- Đặt **mã bài, tên bài, hook** theo quy ước cố định (ví dụ `P03 · Chủ đề · Tầng phễu`) để tìm kiếm nhanh.
- Gửi duyệt **theo lô nhỏ**, vì tầng tự soát và danh sách "Duyệt nhanh" hiệu quả nhất khi hàng chờ ngắn.
- Mỗi lần chốt bản gửi người khác, ghi **ghi chú** nêu rõ vòng duyệt nào.
- Nhập số liệu vào **cùng một khung giờ** sau mỗi bài (ví dụ 48 giờ) để các bài so sánh được với nhau.
- Mỗi chiến dịch kết thúc: viết **tổng kết** và **lưu mẫu** ngay, khi còn nhớ rõ điều gì hiệu quả.

## E. Hạn chế đã biết (để bạn không bất ngờ)

- App không tự đăng, không tự kéo số liệu.
- "Khóa" là theo nội dung, không chặn thao tác gõ.
- Chưa dùng được từ thiết bị khác qua mạng.
- Một số kiểm tra chỉ thực hiện được trên dữ liệu thử, chưa chạy trên dữ liệu thật: tạo ảnh AI thật sau các thay đổi mới nhất (ảnh mentor, bố cục tự động), PDF in qua trình duyệt, tệp Word mở bằng Microsoft Word, thông báo trình duyệt.
