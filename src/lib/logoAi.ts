import { api } from './api.ts'
import { renderPost } from './render.ts'
import type { Campaign, LogoPlacement, Post, Workspace } from './types.ts'

export const POSITION_LABELS: Record<NonNullable<LogoPlacement['position']>, string> = { 'top-left': 'Trên trái', 'top-center': 'Trên giữa', 'top-right': 'Trên phải' }

const SYSTEM = `Bạn là art director đặt logo thương hiệu lên ảnh mạng xã hội. Bạn nhận một ảnh bài đăng đã hoàn thiện (chưa có logo) và chọn nơi đặt logo.

Quy tắc:
- Chỉ trả về một đối tượng JSON hợp lệ, không giải thích, không markdown.
- Logo chỉ được đặt ở hàng trên cùng: "top-left", "top-center" hoặc "top-right". Chọn vị trí có vùng nền sạch, đủ tương phản, không đè lên chữ, nhân vật hay họa tiết quan trọng.
- Logo phải đủ lớn để đọc được nhưng không lấn át tiêu đề. "scale" từ 0.6 đến 1.6 (1 = cỡ chuẩn của thương hiệu): logo có nhiều chữ hoặc dạng ngang thì cần lớn hơn; biểu tượng đơn giản thì nhỏ hơn.
- Nếu có hai bản logo, chọn "variant": "light" (bản cho nền sáng) hoặc "dark" (bản cho nền tối) theo độ sáng thực tế của vùng đặt logo.
- Logo thương hiệu luôn phải hiện; bạn chỉ chọn vị trí, cỡ và bản logo, không có lựa chọn ẩn logo.`

function parse(raw: string): LogoPlacement & { reason: string } {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: Record<string, unknown>
  try { data = JSON.parse(cleaned) as Record<string, unknown> } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại.') }
  const position = data.position === 'top-left' || data.position === 'top-center' || data.position === 'top-right' ? data.position : undefined
  const scale = typeof data.scale === 'number' && Number.isFinite(data.scale) ? Math.min(1.6, Math.max(0.6, data.scale)) : undefined
  const variant = data.variant === 'light' || data.variant === 'dark' ? data.variant : undefined
  // The brand logo is never hidden by the AI: hiding it is a manual choice.
  return { position, scale, variant, hidden: false, reason: typeof data.reason === 'string' ? data.reason.slice(0, 200) : '' }
}

/** Shows the model the finished post without its logo and lets it choose position, size and logo version. */
export async function suggestLogo(workspace: Workspace, campaign: Campaign, post: Post, keyId?: string): Promise<LogoPlacement & { reason: string }> {
  const bare: Post = { ...post, logo: { ...post.logo, hidden: true } }
  const canvas = document.createElement('canvas')
  await renderPost(canvas, bare, campaign, workspace)
  const shot = document.createElement('canvas')
  const ratio = Math.min(1, 900 / Math.max(canvas.width, canvas.height))
  shot.width = Math.round(canvas.width * ratio)
  shot.height = Math.round(canvas.height * ratio)
  shot.getContext('2d')!.drawImage(canvas, 0, 0, shot.width, shot.height)
  const { company } = workspace
  const prompt = [
    `Ảnh đính kèm là bài "${post.name}" (${canvas.width}×${canvas.height}px), chưa có logo. Thương hiệu: ${company.name || 'chưa đặt tên'}.`,
    `Bản logo: ${company.logoId ? 'có bản cho nền sáng' : 'chưa có bản nền sáng'}; ${company.logoDarkId ? 'có bản cho nền tối' : 'không có bản riêng cho nền tối'}.`,
    'Trả về JSON dạng {"position":"top-left|top-center|top-right","scale":1,"variant":"light|dark","reason":"một câu giải thích"}.',
  ].join('\n')
  const { text } = await api.generateText({ system: SYSTEM, prompt, json: true, keyId, images: [shot.toDataURL('image/jpeg', 0.85)] })
  return parse(text)
}
