import type { Campaign, Piece, Workspace } from './types.ts'
import { inferBeats } from './beats.ts'
import { foundationBrief } from './foundation.ts'
import { COPY_CRAFT, EDITOR_SYSTEM, lintCopy } from './copyCraft.ts'
import { splitSlides } from './text.ts'

export type DraftSlide = { eyebrow: string; headline: string; accent: string; subtitle: string; cta: string }
export type Draft = { slides: DraftSlide[]; caption: string; hashtags: string }

const SYSTEM = `Bạn là content strategist tiếng Việt cho một thương hiệu tư vấn du học. Bạn soạn nháp chữ trên ảnh (từng slide) và caption cho một bài đăng mạng xã hội, bám sát kế hoạch đã duyệt.

Quy tắc bắt buộc:
- Chỉ trả về một đối tượng JSON hợp lệ, không giải thích, không markdown.
- Giữ nguyên mọi placeholder dạng [TÊN BIẾN] đúng từng ký tự; không tự bịa số liệu, mức giá, tên người, đường dẫn.
- Giọng điệu theo thương hiệu: điềm tĩnh, cụ thể, trưởng thành; không phóng đại, không giật gân.
- Tuyệt đối không viết những điều trong danh sách "Không được nói", và không hứa chắc kết quả đậu/visa/học bổng.
- Chữ trên ảnh phải ngắn: eyebrow tối đa 40 ký tự; headline tối đa 8 từ và là một ý trọn vẹn; accent (dòng nhấn, tùy chọn, có thể rỗng) tối đa 5 từ, là một cụm nhấn riêng, KHÔNG phải phần đuôi của câu trong headline (không tách một câu thành headline + accent); subtitle tối đa 22 từ; cta tối đa 5 từ và chỉ ở slide cuối hoặc khi bài chỉ có một ảnh.
- Số liệu, điều kiện, mốc thời gian chỉ lấy từ kế hoạch hoặc nguồn đã cho; không tự suy ra.
- Slide đầu là hook. Slide cuối chốt bằng CTA. Mỗi slide chỉ một ý.

${COPY_CRAFT}`

/** Builds the system and user prompts for drafting a piece's slide copy and caption. */
export function buildDraftRequest(workspace: Workspace, campaign: Campaign, piece: Piece, slideCount: number): { system: string; prompt: string } {
  const { company } = workspace
  const reel = piece.kind === 'reel'
  const labels = reel ? inferBeats(piece).map((beat, index) => `Cảnh ${index + 1} (${beat.start}–${beat.end}s): ${beat.label}`).join('\n') : splitSlides(piece.plan.structure).map((slide) => `S${slide.n}: ${slide.label}`).join('\n')
  const guardrails = campaign.guardrailNotes.map((line) => `- ${line}`).join('\n')
  const prompt = [
    `THƯƠNG HIỆU: ${company.name}${company.industry ? ` (${company.industry})` : ''}. Đối tượng: ${company.audience || 'xem kế hoạch'}. Giọng điệu: ${company.tone || 'xem kế hoạch'}.`,
    foundationBrief(campaign),
    guardrails && `KHÔNG ĐƯỢC NÓI:\n${guardrails}`,
    `BÀI CẦN SOẠN: ${piece.code} · ${piece.title}`,
    `Funnel: ${piece.plan.funnel} · Pillar: ${piece.plan.pillar} · Định dạng: ${piece.plan.format}`,
    `Mục tiêu: ${piece.plan.goal}`,
    `Hook/tiêu đề trong kế hoạch: ${piece.plan.hook}`,
    reel && 'ĐÂY LÀ REEL DỌC 1080×1920 KHÔNG CÓ NGƯỜI: mỗi phần tử trong "slides" là MỘT CẢNH theo thứ tự thời gian, hiện trên màn hình vài giây. Chữ trên màn hình cực ngắn (headline tối đa 6 từ, subtitle tối đa 12 từ), mỗi cảnh một ý, cảnh đầu là hook, cảnh cuối là CTA.',
    labels ? `Cấu trúc các ${reel ? 'cảnh' : 'slide'}:\n${labels}` : piece.plan.structure && `Cấu trúc nội dung: ${piece.plan.structure}`,
    `CTA: ${piece.plan.cta}`,
    `Đối tượng bài: ${piece.plan.audience}`,
    piece.visual.onImage && `Chữ trên ảnh gợi ý trong visual brief: ${piece.visual.onImage}`,
    piece.visual.avoid && `Visual cần tránh: ${piece.visual.avoid}`,
    piece.caption && `CAPTION ĐÃ CÓ TRONG KẾ HOẠCH (giữ nguyên, trả về trong trường caption):\n${piece.caption}`,
    `YÊU CẦU: trả về JSON dạng {"slides":[{"eyebrow":"","headline":"","accent":"","subtitle":"","cta":""}],"caption":"","hashtags":""} với đúng ${slideCount} phần tử trong "slides". Nếu kế hoạch chưa có caption, hãy viết caption 80-150 từ và 3-5 hashtag; nếu đã có thì giữ nguyên.`,
  ].filter(Boolean).join('\n\n')
  return { system: SYSTEM, prompt }
}

/** A request that rewrites the caption from scratch; the plan's caption is only a reference. Placeholders stay as [TOKENS]. */
export function buildCaptionRequest(workspace: Workspace, campaign: Campaign, piece: Piece): { system: string; prompt: string } {
  const base = buildDraftRequest(workspace, campaign, { ...piece, caption: '' }, 1)
  const values = Object.entries(campaign.variables).filter(([, value]) => value.trim()).map(([key, value]) => `- [${key}] = ${value.trim().slice(0, 120)}`).join('\n')
  const prompt = [
    base.prompt,
    piece.caption.trim() && `CAPTION HIỆN CÓ (chỉ để tham khảo ý và dữ kiện, hãy viết lại cho tự nhiên, không chép nguyên văn):\n${piece.caption}`,
    values && `GIÁ TRỊ CÁC BIẾN (để chọn cách diễn đạt cho khớp, nhưng trong caption vẫn viết placeholder dạng [TÊN BIẾN], ứng dụng sẽ tự thay):\n${values}`,
    'YÊU CẦU RIÊNG: chỉ cần caption và hashtag; trong JSON, "slides" có thể để mảng rỗng. Caption 70-130 từ. Dòng đầu là câu giữ chân (khoảng 100 ký tự, nêu điều người đọc quan tâm nhất), không mở bằng tên công ty. Chia đoạn ngắn, danh sách từ 3 ý trở lên thì mỗi ý một dòng. Một câu điều kiện ở cuối. Kết bằng một việc cụ thể kèm placeholder đường dẫn/hotline nếu kế hoạch có.',
  ].filter(Boolean).join('\n\n')
  return { system: base.system, prompt }
}

/** Second pass: an editor reads the draft against the writing rules and the rule-based findings, and rewrites it. */
export function buildEditRequest(workspace: Workspace, campaign: Campaign, piece: Piece, draft: { caption: string; hashtags: string }): { system: string; prompt: string } {
  const findings = lintCopy(draft.caption, { caption: true })
  const base = buildDraftRequest(workspace, campaign, { ...piece, caption: '' }, 1).prompt
  const prompt = [
    base.split('\n\n').filter((block) => /^(THƯƠNG HIỆU|NỀN TẢNG|CHIẾN LƯỢC|KHÔNG ĐƯỢC NÓI|BÀI CẦN SOẠN|Mục tiêu|Hook|CTA|Đối tượng bài)/.test(block)).join('\n\n'),
    `BẢN NHÁP CẦN BIÊN TẬP:\n${draft.caption}`,
    findings.length > 0 && `LỖI ĐÃ PHÁT HIỆN BẰNG QUY TẮC:\n${findings.map((hit) => `- ${hit.rule}${hit.excerpt ? ` ("${hit.excerpt}")` : ''}`).join('\n')}`,
    'Tự rà theo từng nguyên tắc ở trên. Trả về JSON dạng {"caption":"bản đã viết lại","hashtags":"3-5 hashtag cách nhau bằng dấu cách","changes":"một câu nói đã sửa gì chính"}.',
  ].filter(Boolean).join('\n\n')
  return { system: EDITOR_SYSTEM, prompt }
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export function parseDraft(raw: string): Draft {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try { data = JSON.parse(cleaned) } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại hoặc đổi model văn bản.') }
  const record = data as { slides?: unknown[]; caption?: unknown; hashtags?: unknown }
  if (!Array.isArray(record.slides) || record.slides.length === 0) {
    if (typeof record.caption === 'string' && record.caption.trim()) return { slides: [], caption: text(record.caption, 4000), hashtags: text(record.hashtags, 400) }
    throw new Error('AI không trả về slide nào. Thử lại.')
  }
  return {
    slides: record.slides.map((slide) => {
      const item = (slide ?? {}) as Record<string, unknown>
      return { eyebrow: text(item.eyebrow, 60), headline: text(item.headline, 120), accent: text(item.accent, 60), subtitle: text(item.subtitle, 240), cta: text(item.cta, 50) }
    }),
    caption: text(record.caption, 4000),
    hashtags: text(record.hashtags, 400),
  }
}
