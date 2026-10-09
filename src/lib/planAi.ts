import { api } from './api.ts'
import { campaignWindow, foundationBrief } from './foundation.ts'
import { suggestDates } from './plan.ts'
import { DEFAULT_FORMAT, FUNNELS } from './planEdit.ts'
import type { Campaign, PieceKind, Workspace } from './types.ts'

export type Idea = { title: string; kind: PieceKind; funnel: string; pillar: string; goal: string; hook: string; structure: string; cta: string; audience: string; time: string; date: string }

const SYSTEM = `Bạn là content strategist tiếng Việt, lập khung lịch nội dung mạng xã hội cho một chiến dịch tư vấn du học. Bạn chỉ đề xuất khung (ý tưởng từng bài), chưa viết caption.

Quy tắc bắt buộc:
- Chỉ trả về một đối tượng JSON hợp lệ, không giải thích, không markdown.
- Bám nền tảng chiến dịch đã cho: mục tiêu, đối tượng, thông điệp, các trụ cột. Không bịa số liệu, mức giá, tên người, học bổng, ưu đãi; nếu cần một dữ kiện chưa có thì viết placeholder dạng [TÊN BIẾN].
- Không hứa chắc kết quả đậu/visa/học bổng. Giọng điềm tĩnh, cụ thể.
- Phễu: TOFU (nhận biết), MOFU (cân nhắc), BOFU (chuyển đổi). Chia theo tỷ lệ yêu cầu và xếp thứ tự theo thời gian: TOFU trước, BOFU gần cuối kỳ.
- Mỗi trụ cột phải xuất hiện ít nhất một lần; không lặp cùng một ý.`

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** The share of each funnel stage for `count` pieces: about 40% awareness, 35% consideration, the rest conversion (each at least one when it fits). */
export function funnelMix(count: number): Record<string, number> {
  const bofu = Math.max(count >= 3 ? 1 : 0, Math.round(count * 0.25))
  const mofu = Math.max(count >= 2 ? 1 : 0, Math.round(count * 0.35))
  return { TOFU: Math.max(0, count - bofu - mofu), MOFU: mofu, BOFU: bofu }
}

/** Asks the AI for a skeleton of `count` new pieces that balances funnel and pillars and avoids what the plan already has. */
export async function suggestSkeleton(workspace: Workspace, campaign: Campaign, count: number, note: string, keyId?: string): Promise<Idea[]> {
  const mix = funnelMix(count)
  const window = campaignWindow(campaign)
  const existing = campaign.pieces.map((piece) => `- ${piece.code} · ${piece.plan.funnel || '?'} · ${piece.kind} · ${piece.title || piece.plan.hook}`).join('\n')
  const prompt = [
    `THƯƠNG HIỆU: ${workspace.company.name}${workspace.company.industry ? ` (${workspace.company.industry})` : ''}.`,
    foundationBrief(campaign) || 'Chưa có nền tảng chiến dịch: hãy bám tên chiến dịch và thương hiệu.',
    `TÊN CHIẾN DỊCH: ${campaign.name}`,
    window && `Kỳ chiến dịch: ${window.start} đến ${window.end}.`,
    existing && `CÁC BÀI ĐÃ CÓ TRONG KẾ HOẠCH (không lặp ý, chỉ bổ sung chỗ còn thiếu):\n${existing}`,
    note.trim() && `YÊU CẦU THÊM CỦA NGƯỜI DÙNG: ${note.trim()}`,
    `YÊU CẦU: đề xuất đúng ${count} bài mới. Tỷ lệ phễu: ${FUNNELS.map((funnel) => `${funnel} ${mix[funnel]} bài`).join(', ')}. Trộn các dạng: "static" (ảnh đơn), "carousel", "reel" (reel không người, làm bằng đồ họa). Xếp các bài theo thứ tự đăng; ngày cụ thể do ứng dụng điền.`,
    'Trả về JSON dạng {"ideas":[{"title":"tên bài ngắn","kind":"static|carousel|reel","funnel":"TOFU|MOFU|BOFU","pillar":"tên trụ cột (đúng như trong nền tảng nếu có)","goal":"mục tiêu một câu","hook":"câu hook mở bài","structure":"cấu trúc: với carousel liệt kê S1: ...; S2: ...; với reel liệt kê theo mốc giây 0-3s: ...","cta":"lời kêu gọi hành động","audience":"nhóm đối tượng","time":"giờ đăng gợi ý, ví dụ 20:30"}]}',
  ].filter(Boolean).join('\n\n')
  const { text } = await api.generateText({ system: SYSTEM, prompt, json: true, keyId })
  const ideas = parseIdeas(text)
  if (ideas.length === 0) throw new Error('AI không đề xuất bài nào. Thử lại.')
  const picked = ideas.slice(0, count)
  const dates = window ? suggestDates(picked.length, window) : picked.map(() => '')
  return picked.map((idea, index) => ({ ...idea, date: dates[index] }))
}

export function parseIdeas(raw: string): Idea[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try { data = JSON.parse(cleaned) } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại hoặc đổi model văn bản.') }
  const list = Array.isArray(data) ? data : (data as { ideas?: unknown }).ideas
  if (!Array.isArray(list)) return []
  return list.map((entry): Idea => {
    const item = (entry ?? {}) as Record<string, unknown>
    const kind: PieceKind = item.kind === 'carousel' || item.kind === 'reel' ? item.kind : 'static'
    const funnel = clip(item.funnel, 8).toUpperCase()
    return {
      title: clip(item.title, 120), kind, funnel: FUNNELS.includes(funnel) ? funnel : '', pillar: clip(item.pillar, 120), goal: clip(item.goal, 300),
      hook: clip(item.hook, 200), structure: clip(item.structure, 800), cta: clip(item.cta, 120), audience: clip(item.audience, 160),
      time: clip(item.time, 20), date: '',
    }
  }).filter((idea) => idea.title || idea.hook)
}

export const formatFor = (idea: Idea): string => {
  const slides = idea.structure.match(/S\d+/gi)?.length
  if (idea.kind === 'carousel' && slides && slides > 1) return `Carousel ${slides} slides`
  return DEFAULT_FORMAT[idea.kind]
}
