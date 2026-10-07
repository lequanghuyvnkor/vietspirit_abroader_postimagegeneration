import type { Layer, Post, Shade } from './types.ts'

/** A rectangle the user drew on the slide, as fractions of the canvas (0..1). */
export type Region = { x: number; y: number; w: number; h: number }

export type TextField = 'eyebrow' | 'headline' | 'accent' | 'subtitle' | 'cta'

/** What the AI decided to change for a comment on a region. Everything is optional. */
export type RevisePlan = {
  summary: string
  text?: Partial<Record<TextField, string>>
  layout?: { textScale?: number; textAnchor?: 'top' | 'middle' | 'bottom'; scrim?: boolean }
  shades?: Shade[]
  layers?: { index: number; scale?: number; dx?: number; dy?: number; opacity?: number; remove?: boolean }[]
  /** Set when the picture itself has to change (objects, glow, composition), not the text layout. */
  background?: { instruction: string } | null
}

const SYSTEM = `Bạn là art director chỉnh một ảnh social đã dựng xong (nền AI + thành phần đồ họa + chữ). Người dùng khoanh một vùng trên ảnh và ghi chú muốn chỉnh gì. Bạn thấy ảnh với khung ĐỎ đánh dấu vùng đó.

Chỉ trả về một đối tượng JSON hợp lệ, không giải thích. Chỉ đưa vào những thay đổi TỐI THIỂU cần để đáp ứng ghi chú; bỏ trống mọi thứ không cần đổi.

Chọn cách sửa theo nguyên nhân:
- Vấn đề đọc chữ (chữ khó đọc, nền sáng/rối sau chữ): dùng "shades" (làm tối nhẹ vùng đó) và/hoặc "layout" (đổi cỡ chữ, vị trí khối chữ). Đây là cách ưu tiên, nhanh và miễn phí.
- Vấn đề lời văn (đổi từ, rút gọn, sai ý): dùng "text".
- Vấn đề thành phần đồ họa (to/nhỏ, dịch chuyển, mờ hơn, bỏ): dùng "layers".
- Vấn đề nằm trong bức ảnh nền (có vật thể/thẻ/đường/quầng sáng cần bỏ, đổi, thêm, làm sạch; đổi bố cục ảnh): dùng "background" với "instruction" là chỉ dẫn tiếng Anh ngắn, cụ thể cho công cụ chỉnh ảnh, chỉ mô tả thay đổi bên trong vùng đã khoanh. Chỉ dùng khi không thể xử lý bằng cách trên.

Định dạng:
{
  "summary": "một câu tiếng Việt nói bạn đã chỉnh gì",
  "text": { "eyebrow"?: "", "headline"?: "", "accent"?: "", "subtitle"?: "", "cta"?: "" },
  "layout": { "textScale"?: số 0.6-1.4, "textAnchor"?: "top"|"middle"|"bottom", "scrim"?: true|false },
  "shades": [ { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1, "strength": 0.1-0.8, "tone": "dark"|"light" } ],
  "layers": [ { "index": số thứ tự thành phần (bắt đầu từ 0), "scale"?: hệ số nhân kích thước, "dx"?: dịch ngang (phần của chiều rộng), "dy"?: dịch dọc, "opacity"?: 0-1, "remove"?: true } ],
  "background": { "instruction": "..." }
}

Quy tắc: giữ nguyên placeholder dạng [TÊN BIẾN]; không bịa số liệu; không hứa chắc kết quả đậu/visa/học bổng; chữ ngắn gọn.`

const pct = (value: number) => `${Math.round(value * 100)}%`

/** Prompts for turning a region + comment into a RevisePlan. The marked slide image is sent alongside. */
export function buildReviseRequest(post: Post, region: Region, comment: string, allowBackground: boolean): { system: string; prompt: string } {
  const layers = post.layers.map((layer, index) => `${index}: tâm (${pct(layer.x)}, ${pct(layer.y)}), rộng ${pct(layer.w)} chiều rộng ảnh, độ đậm ${pct(layer.opacity)}`).join('\n')
  const prompt = [
    `Vùng khoanh: góc trái-trên (${pct(region.x)}, ${pct(region.y)}), rộng ${pct(region.w)}, cao ${pct(region.h)} (tính theo khung ảnh, gốc ở góc trái-trên).`,
    `GHI CHÚ CỦA NGƯỜI DÙNG: ${comment}`,
    'NỘI DUNG HIỆN TẠI:',
    `eyebrow: ${post.eyebrow}\nheadline: ${post.headline}\naccent: ${post.accent}\nsubtitle: ${post.subtitle}\ncta: ${post.cta}`,
    `Cỡ chữ: x${post.textScale ?? 1}; vị trí khối chữ: ${post.textAnchor ?? 'top'}; làm tối mép: ${post.scrim ? 'bật' : 'tắt'}.`,
    layers ? `THÀNH PHẦN ĐỒ HỌA (theo thứ tự vẽ):\n${layers}` : 'Chưa có thành phần đồ họa nào.',
    allowBackground ? 'Được phép dùng "background" nếu cần sửa chính bức ảnh nền.' : 'KHÔNG được dùng "background" (người dùng không cho sửa ảnh nền); hãy xử lý bằng shades/layout/text/layers.',
  ].join('\n\n')
  return { system: SYSTEM, prompt }
}

const clamp = (value: unknown, min: number, max: number): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined)
const str = (value: unknown, max: number): string | undefined => (typeof value === 'string' ? value.trim().slice(0, max) : undefined)

export function parseRevise(raw: string): RevisePlan {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: Record<string, unknown>
  try { data = JSON.parse(cleaned) as Record<string, unknown> } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại hoặc diễn đạt ghi chú rõ hơn.') }

  const plan: RevisePlan = { summary: str(data.summary, 300) ?? 'Đã chỉnh theo ghi chú.' }
  const text = (data.text ?? {}) as Record<string, unknown>
  const fields: TextField[] = ['eyebrow', 'headline', 'accent', 'subtitle', 'cta']
  const textOut: Partial<Record<TextField, string>> = {}
  for (const field of fields) { const value = str(text[field], field === 'subtitle' ? 300 : 140); if (value !== undefined) textOut[field] = value }
  if (Object.keys(textOut).length) plan.text = textOut

  const layout = (data.layout ?? {}) as Record<string, unknown>
  const textScale = clamp(layout.textScale, 0.6, 1.4)
  const anchor = layout.textAnchor === 'top' || layout.textAnchor === 'middle' || layout.textAnchor === 'bottom' ? layout.textAnchor : undefined
  if (textScale !== undefined || anchor || typeof layout.scrim === 'boolean') plan.layout = { textScale, textAnchor: anchor, scrim: typeof layout.scrim === 'boolean' ? layout.scrim : undefined }

  if (Array.isArray(data.shades)) {
    plan.shades = data.shades.flatMap((item): Shade[] => {
      const shade = (item ?? {}) as Record<string, unknown>
      const x = clamp(shade.x, -0.1, 1), y = clamp(shade.y, -0.1, 1), w = clamp(shade.w, 0.02, 1.2), h = clamp(shade.h, 0.02, 1.2), strength = clamp(shade.strength, 0.05, 0.85)
      return x === undefined || y === undefined || w === undefined || h === undefined || strength === undefined ? [] : [{ x, y, w, h, strength, tone: shade.tone === 'light' ? 'light' : 'dark' }]
    })
  }
  if (Array.isArray(data.layers)) {
    plan.layers = data.layers.flatMap((item) => {
      const layer = (item ?? {}) as Record<string, unknown>
      return typeof layer.index === 'number' ? [{ index: Math.round(layer.index), scale: clamp(layer.scale, 0.2, 4), dx: clamp(layer.dx, -1, 1), dy: clamp(layer.dy, -1, 1), opacity: clamp(layer.opacity, 0.05, 1), remove: layer.remove === true }] : []
    })
  }
  const background = (data.background ?? null) as { instruction?: unknown } | null
  const instruction = background ? str(background.instruction, 600) : undefined
  if (instruction) plan.background = { instruction }
  return plan
}

/** Applies a plan to a post (everything except the background picture, which needs an image call). */
export function applyRevise(post: Post, plan: RevisePlan): Post {
  const next: Post = { ...post, layers: post.layers.map((layer) => ({ ...layer })), shades: [...(post.shades ?? [])] }
  if (plan.text) Object.assign(next, plan.text)
  if (plan.layout) {
    if (plan.layout.textScale !== undefined) next.textScale = plan.layout.textScale
    if (plan.layout.textAnchor) next.textAnchor = plan.layout.textAnchor
    if (plan.layout.scrim !== undefined) next.scrim = plan.layout.scrim
  }
  if (plan.shades) next.shades = [...(next.shades ?? []), ...plan.shades].slice(-8)
  if (plan.layers) {
    const removed = new Set<number>()
    for (const change of plan.layers) {
      const layer: Layer | undefined = next.layers[change.index]
      if (!layer) continue
      if (change.remove) { removed.add(change.index); continue }
      if (change.scale !== undefined) layer.w = Math.min(1.5, Math.max(0.03, layer.w * change.scale))
      if (change.dx !== undefined) layer.x += change.dx
      if (change.dy !== undefined) layer.y += change.dy
      if (change.opacity !== undefined) layer.opacity = change.opacity
    }
    next.layers = next.layers.filter((_, index) => !removed.has(index))
  }
  return next
}

/** Prompt for the image model: edit only inside the outlined area of the clean background plate. */
export function buildBackgroundEditPrompt(instruction: string, region: Region, palette: string[]): string {
  return [
    'Edit the first image, which is a background plate for a social media post.',
    `The second image is the same picture with a RED RECTANGLE outlining the only area that may change (from ${pct(region.x)} across and ${pct(region.y)} down, ${pct(region.w)} wide and ${pct(region.h)} tall).`,
    `Change, inside that rectangle only: ${instruction}`,
    'Return the first image with just that change applied. Everything outside the rectangle must stay exactly as it is: same composition, colors, lighting and style, blended seamlessly at the edges. Do not draw the red rectangle in the result.',
    palette.length ? `Keep the color palette: ${palette.join(', ')}.` : '',
    'The upper half of the frame must stay calm and uncluttered because text sits there. Strictly no text, letters, numbers, logos or watermarks.',
  ].filter(Boolean).join('\n\n')
}
