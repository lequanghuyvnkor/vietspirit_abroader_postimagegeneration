/**
 * Copy craft for Vietnamese social posts: the writing rules the AI is given, and a rule-based check that flags the patterns
 * that make a post read as generated or bureaucratic.
 *
 * The principles are adapted from two MIT-licensed open-source collections:
 *  - coreyhaines31/marketingskills (copywriting, social, carousel frameworks, "No AI tells")
 *  - blader/humanizer, built on Wikipedia's "Signs of AI writing"
 * Rewritten here for Vietnamese and for this app; no text is copied.
 */

/** Added to every prompt that writes copy (slide text, caption). */
export const COPY_CRAFT = `NGUYÊN TẮC VIẾT (áp dụng cho mọi chữ bạn viết):
1. Rõ ràng hơn khéo léo. Người đọc lướt rất nhanh; nếu phải đoán nghĩa, họ đã bỏ qua.
2. Cụ thể hơn chung chung. Dùng con số, mốc ngày, tên riêng, việc làm được có trong dữ kiện. "Bài luận thiếu câu chuyện riêng" hơn "hồ sơ chưa tối ưu". Không có dữ kiện thì đừng viết ra điều đó; không bịa số liệu hay lời chứng thực.
3. Nói bằng lời của người đọc. Học sinh và phụ huynh nói "chưa biết hồ sơ mình đã đủ mạnh chưa", không nói "readiness", "sàng lọc", "phương án triển khai". Thuật ngữ tiếng Anh chỉ giữ khi chính họ vẫn dùng (IELTS, CV, KAIST).
4. Lợi ích trước tính năng: nói điều người đọc có được hoặc tránh được, rồi mới nói việc ta làm.
5. Câu chủ động, câu ngắn xen câu dài. Bỏ "rất", "khá", "hết sức", "nhằm", "góp phần", "đáp ứng nhu cầu".
6. Một ý cho mỗi slide, mỗi đoạn. Slide 1 phải tự đứng được như một ảnh bìa: người chưa biết đây là carousel vẫn muốn dừng lại.
7. Mở bài bằng điều người đọc quan tâm nhất (nỗi lo, mốc thời gian, kết quả cụ thể), trong dòng đầu khoảng 100 ký tự vì phần sau bị cắt sau "xem thêm". Không mở bằng tên công ty hay lời chào.
8. Kết bằng một việc làm cụ thể và đường dẫn hoặc cách làm, đúng việc plan yêu cầu. Điều kiện pháp lý và miễn trừ gói trong một câu ngắn ở cuối, không chiếm quá nửa đoạn.

KHÔNG VIẾT (dấu hiệu văn bản máy hoặc văn bản thủ tục):
- Phủ định rồi đảo: "Không chỉ X mà còn Y", "Không phải X, mà là Y", "Đây không phải X. Đây là Y". Nói thẳng Y kèm lý do.
- Chuỗi phủ định: "Không X, không Y, không Z". Nói điều gì xảy ra, theo thứ tự xảy ra. Một vế phủ định thật sự quan trọng thì nêu một lần, gần nút kêu gọi.
- Câu tự hỏi tự đáp và câu chốt hai chấm: "Kết quả? Nhanh gấp ba.", "Điều tuyệt vời nhất:". Nói thẳng điều đó.
- Câu đã đủ ý rồi còn kéo thêm vế sau dấu phẩy ("…, giúp bạn…, đảm bảo…, mang lại…"). Dừng ở ý chính.
- Mở bài sáo rỗng: "Trong thời đại…", "Bạn đã bao giờ tự hỏi", "Hãy cùng khám phá", "Đừng bỏ lỡ", "Bạn có biết".
- Từ rỗng: tối ưu, đột phá, toàn diện, giải pháp tối ưu, đồng hành cùng bạn trên hành trình, nâng tầm, chinh phục (trừ khi chính nghĩa đen).
- Câu hỏi câu tương tác: "Bạn nghĩ sao?", "Đồng ý không?". Kết ở ý chính, hoặc hỏi một câu thật sự cần câu trả lời.
- Biểu tượng cảm xúc làm đầu dòng, dấu gạch ngang dài (—), nhiều hơn một dấu chấm than.
- Cả bài là các câu một dòng ngắt liên tục. Viết thành đoạn, xuống dòng đúng chỗ người ta ngừng lại.
- Danh sách đánh số nhồi trong một câu ("(1)…; (2)…; (3)…"). Nếu có từ 3 ý trở lên, mỗi ý một dòng.
- Quá một câu cụt và một danh sách ba ý trong cùng một bài.
- Tự tạo vẻ chân thành ("Thành thật mà nói, mình từng rất sợ…") khi dữ kiện không có câu chuyện thật đó.

KHUNG CHO CAROUSEL (chọn một theo nội dung, rồi viết đúng vai từng slide):
- Danh sách tài liệu/việc cần chuẩn bị: slide 1 nêu đúng số lượng và thứ nhận được; mỗi slide giữa một mục với 2-3 chi tiết cụ thể; slide cuối chốt việc làm. Không thêm slide độn cho đủ số.
- Một kết quả có quy trình: slide 1 nêu kết quả như một sự thật; slide 2 gọi tên vấn đề thật; các slide giữa là các bước có tên; slide cuối là bằng chứng.
- Nhiều quan niệm sai: slide 1 nêu điều nhiều người tin sai; mỗi slide một hiểu lầm kèm cách hiểu đúng; slide cuối tóm lại.`

/** Instruction for the second pass: an editor reads the draft against the same rules and the rule-based findings. */
export const EDITOR_SYSTEM = `Bạn là biên tập viên tiếng Việt khó tính cho mạng xã hội. Bạn nhận bản nháp một caption cùng danh sách lỗi đã phát hiện, rồi viết lại bản tốt hơn.

${COPY_CRAFT}

CÁCH LÀM:
- Giữ nguyên mọi dữ kiện, con số, mốc ngày, placeholder dạng [TÊN BIẾN] đúng từng ký tự. Không thêm dữ kiện mới.
- Sửa từ gốc: viết lại câu từ dữ kiện, đừng chỉ thay từ đồng nghĩa (thay từ đồng nghĩa tạo ra dấu hiệu máy mới).
- Đoạn nào đã tự nhiên và cụ thể thì giữ, đừng sửa quá tay.
- Không dùng cụm trong "Không được nói". Không hứa chắc kết quả đậu, visa, học bổng.
- Chỉ trả về một đối tượng JSON hợp lệ, không markdown.`

export type CopyHit = { rule: string; excerpt: string; level: 'warn' | 'info' }

const RULES: { rule: string; pattern: RegExp; level: 'warn' | 'info' }[] = [
  { rule: 'Phủ định rồi đảo ("không chỉ X mà còn Y")', pattern: /không chỉ[^.\n]{2,80}mà còn|không chỉ\s+(là\s+)?[^.\n]{2,70}[,;]\s*(đây|mà|còn)\b|không phải[^.\n]{2,60}(mà là|[,;]\s*(mà|đây là))|không đơn thuần[^.\n]{2,60}mà/i, level: 'warn' },
  { rule: 'Chuỗi phủ định ("không X, không Y, không Z")', pattern: /(không|chẳng)\s[^,.;\n]{1,30}[,;]\s*(không|chẳng)\s[^,.;\n]{1,30}[,;]\s*(và\s)?(không|chẳng)\s/i, level: 'warn' },
  { rule: 'Câu tự hỏi tự đáp', pattern: /(Kết quả|Bí quyết|Điều tuyệt vời nhất|Điểm đặc biệt|Sự thật)\s*[?:]/, level: 'warn' },
  { rule: 'Mở bài sáo rỗng', pattern: /(trong (thế giới|thời đại|bối cảnh)[^.\n]{0,40}(hiện nay|ngày nay|nhanh|số)|bạn đã bao giờ tự hỏi|hãy cùng (khám phá|tìm hiểu|bắt đầu)|bạn có biết rằng)/i, level: 'warn' },
  { rule: 'Từ rỗng (tối ưu, toàn diện, đột phá, nâng tầm…)', pattern: /(giải pháp tối ưu|toàn diện|đột phá|nâng tầm|đồng hành cùng bạn trên hành trình|bứt phá|tối ưu hóa|tối ưu hoá)/i, level: 'info' },
  { rule: 'Câu kêu gọi tương tác sáo', pattern: /(bạn nghĩ sao\?|đồng ý không\?|đừng bỏ lỡ|comment ngay|chia sẻ ngay cho bạn bè)/i, level: 'info' },
  { rule: 'Kéo dài câu bằng vế "giúp… đảm bảo… mang lại…"', pattern: /,\s*(giúp|nhằm|đảm bảo|mang lại|góp phần)[^.\n]{8,80},\s*(giúp|nhằm|đảm bảo|mang lại|góp phần)/i, level: 'info' },
  { rule: 'Thuật ngữ tiếng Anh khó với học sinh (readiness, screening…)', pattern: /\b(readiness|screening|pipeline|workflow|onboarding|deliverable)\b/i, level: 'info' },
  { rule: 'Dấu gạch ngang dài (—) trong chữ ngắn', pattern: /—/, level: 'info' },
  { rule: 'Biểu tượng làm đầu dòng', pattern: /^\s*(✅|🚀|💡|🔥|📌|✨|👉)/m, level: 'info' },
]

const excerpt = (text: string, index: number, length: number) => text.slice(Math.max(0, index - 20), index + length + 25).replace(/\s+/g, ' ').trim()

/** Collapses a word written twice in a row ("suất suất" -> "suất"); only words of 4+ letters, to leave overlapping compounds alone. */
export const mergeRepeats = (text: string) => text.replace(/(^|[^\p{L}])(\p{L}{4,})\s+\2(?![\p{L}])/giu, '$1$2')

/** Rule-based check of a caption or slide text. Cheap, so it runs on every render. */
export function lintCopy(text: string, options: { caption?: boolean } = {}): CopyHit[] {
  const hits: CopyHit[] = []
  for (const { rule, pattern, level } of RULES) {
    const match = pattern.exec(text)
    if (match) hits.push({ rule, excerpt: excerpt(text, match.index, match[0].length), level })
  }
  const repeat = /(^|[^\p{L}])(\p{L}{2,})\s+\2(?![\p{L}])/iu.exec(text)
  // Vietnamese compounds can overlap ("cam kết kết quả"), so only a longer repeated word is a firm warning.
  if (repeat) hits.push({ rule: `Lặp từ liền nhau: "${repeat[2]} ${repeat[2]}"${repeat[2].length >= 4 ? '' : ' (có thể là hai từ ghép chồng nhau, xem lại)'}`, excerpt: excerpt(text, repeat.index, repeat[0].length), level: repeat[2].length >= 4 ? 'warn' : 'info' })
  if ((text.match(/!/g) ?? []).length > 1) hits.push({ rule: 'Nhiều hơn một dấu chấm than', excerpt: '', level: 'info' })
  if (options.caption) {
    const firstLine = text.trim().split('\n')[0] ?? ''
    if (firstLine.length > 140) hits.push({ rule: `Dòng đầu dài ${firstLine.length} ký tự: phần sau ~125 ký tự bị cắt sau "xem thêm", ý chính nên nằm trong đó`, excerpt: firstLine.slice(0, 60), level: 'warn' })
    const words = text.trim().split(/\s+/).filter(Boolean).length
    if (words > 170) hits.push({ rule: `Caption ${words} từ, dài quá mức đọc trên mạng xã hội (nên dưới 150)`, excerpt: '', level: 'info' })
    if (/\(\d\)[^()]{3,}\(\d\)[^()]{3,}\(\d\)/.test(text)) hits.push({ rule: 'Danh sách đánh số nhồi trong một câu: tách mỗi ý một dòng', excerpt: '', level: 'info' })
  }
  return hits
}
