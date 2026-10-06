import type { Campaign, Piece, Workspace } from './types.ts'
import { splitSlides } from './text.ts'

export type DraftSlide = { eyebrow: string; headline: string; accent: string; subtitle: string; cta: string }
export type Draft = { slides: DraftSlide[]; caption: string; hashtags: string }

const SYSTEM = `Bạn là content strategist tiếng Việt cho một thương hiệu tư vấn du học. Bạn soạn nháp chữ trên ảnh (từng slide) và caption cho một bài đăng mạng xã hội, bám sát kế hoạch đã duyệt.

Quy tắc bắt buộc:
- Chỉ trả về một đối tượng JSON hợp lệ, không giải thích, không markdown.
- Giữ nguyên mọi placeholder dạng [TÊN BIẾN] đúng từng ký tự; không tự bịa số liệu, mức giá, tên người, đường dẫn.
- Giọng điệu theo thương hiệu: điềm tĩnh, cụ thể, trưởng thành; không phóng đại, không giật gân.
- Tuyệt đối không viết những điều trong danh sách "Không được nói", và không hứa chắc kết quả đậu/visa/học bổng.
- Chữ trên ảnh phải ngắn: eyebrow tối đa 40 ký tự; headline tối đa 8 từ; accent (dòng nhấn, tùy chọn, có thể rỗng) tối đa 5 từ; subtitle tối đa 22 từ; cta tối đa 5 từ và chỉ ở slide cuối hoặc khi bài chỉ có một ảnh.
- Slide đầu là hook. Slide cuối chốt bằng CTA. Mỗi slide chỉ một ý.`

/** Builds the system and user prompts for drafting a piece's slide copy and caption. */
export function buildDraftRequest(workspace: Workspace, campaign: Campaign, piece: Piece, slideCount: number): { system: string; prompt: string } {
  const { company } = workspace
  const labels = splitSlides(piece.plan.structure).map((slide) => `S${slide.n}: ${slide.label}`).join('\n')
  const guardrails = [...campaign.guardrailNotes, ...campaign.guardrails].map((line) => `- ${line}`).join('\n')
  const prompt = [
    `THƯƠNG HIỆU: ${company.name}${company.industry ? ` (${company.industry})` : ''}. Đối tượng: ${company.audience || 'xem kế hoạch'}. Giọng điệu: ${company.tone || 'xem kế hoạch'}.`,
    campaign.strategy && `CHIẾN LƯỢC CHIẾN DỊCH:\n${campaign.strategy}`,
    guardrails && `KHÔNG ĐƯỢC NÓI:\n${guardrails}`,
    `BÀI CẦN SOẠN: ${piece.code} · ${piece.title}`,
    `Funnel: ${piece.plan.funnel} · Pillar: ${piece.plan.pillar} · Định dạng: ${piece.plan.format}`,
    `Mục tiêu: ${piece.plan.goal}`,
    `Hook/tiêu đề trong kế hoạch: ${piece.plan.hook}`,
    labels ? `Cấu trúc các slide:\n${labels}` : piece.plan.structure && `Cấu trúc nội dung: ${piece.plan.structure}`,
    `CTA: ${piece.plan.cta}`,
    `Đối tượng bài: ${piece.plan.audience}`,
    piece.visual.onImage && `Chữ trên ảnh gợi ý trong visual brief: ${piece.visual.onImage}`,
    piece.visual.avoid && `Visual cần tránh: ${piece.visual.avoid}`,
    piece.caption && `CAPTION ĐÃ CÓ TRONG KẾ HOẠCH (giữ nguyên, trả về trong trường caption):\n${piece.caption}`,
    `YÊU CẦU: trả về JSON dạng {"slides":[{"eyebrow":"","headline":"","accent":"","subtitle":"","cta":""}],"caption":"","hashtags":""} với đúng ${slideCount} phần tử trong "slides". Nếu kế hoạch chưa có caption, hãy viết caption 80-150 từ và 3-5 hashtag; nếu đã có thì giữ nguyên.`,
  ].filter(Boolean).join('\n\n')
  return { system: SYSTEM, prompt }
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export function parseDraft(raw: string): Draft {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try { data = JSON.parse(cleaned) } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại hoặc đổi model văn bản.') }
  const record = data as { slides?: unknown[]; caption?: unknown; hashtags?: unknown }
  if (!Array.isArray(record.slides) || record.slides.length === 0) throw new Error('AI không trả về slide nào. Thử lại.')
  return {
    slides: record.slides.map((slide) => {
      const item = (slide ?? {}) as Record<string, unknown>
      return { eyebrow: text(item.eyebrow, 60), headline: text(item.headline, 120), accent: text(item.accent, 60), subtitle: text(item.subtitle, 240), cta: text(item.cta, 50) }
    }),
    caption: text(record.caption, 4000),
    hashtags: text(record.hashtags, 400),
  }
}
