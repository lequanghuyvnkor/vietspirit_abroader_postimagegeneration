import { api, assetUrl } from './api.ts'
import type { KeyVisual } from './types.ts'

/** What an image on the moodboard is for. Only `mood` and `subject` images are sent to the image model. */
export type MoodRole = 'subject' | 'mood' | 'sample'

export const ROLE_LABELS: Record<MoodRole, { title: string; hint: string }> = {
  subject: { title: 'Biểu tượng chính', hint: 'AI giữ hình này trong cảnh' },
  mood: { title: 'Không khí / màu', hint: 'AI chỉ học màu, ánh sáng, chất liệu' },
  sample: { title: 'Bài mẫu', hint: 'Chỉ để tham khảo, không gửi cho AI tạo nền' },
}

const FIELD: Record<MoodRole, 'subjectIds' | 'referenceIds' | 'sampleIds'> = { subject: 'subjectIds', mood: 'referenceIds', sample: 'sampleIds' }

export type MoodImage = { assetId: string; role: MoodRole }

export function moodImages(kv: KeyVisual): MoodImage[] {
  return (Object.keys(FIELD) as MoodRole[]).flatMap((role) => (kv[FIELD[role]] ?? []).map((assetId) => ({ assetId, role })))
}

/** Moves an image to another role (it is stored in one list per role). */
export function setRole(kv: KeyVisual, assetId: string, role: MoodRole): Partial<KeyVisual> {
  const change: Partial<KeyVisual> = {}
  for (const each of Object.keys(FIELD) as MoodRole[]) {
    const list = (kv[FIELD[each]] ?? []).filter((id) => id !== assetId)
    change[FIELD[each]] = each === role ? [...list, assetId] : list
  }
  return change
}

export function addImages(kv: KeyVisual, assetIds: string[], role: MoodRole): Partial<KeyVisual> {
  return { [FIELD[role]]: [...(kv[FIELD[role]] ?? []), ...assetIds.filter((id) => !(kv[FIELD[role]] ?? []).includes(id))] }
}

export function removeImage(kv: KeyVisual, assetId: string): Partial<KeyVisual> {
  return { subjectIds: (kv.subjectIds ?? []).filter((id) => id !== assetId), referenceIds: kv.referenceIds.filter((id) => id !== assetId), sampleIds: (kv.sampleIds ?? []).filter((id) => id !== assetId) }
}

export type MoodReading = Pick<KeyVisual, 'concept' | 'subject' | 'palette' | 'accentColor' | 'textTone' | 'avoid'>

const SYSTEM = `Bạn là art director. Bạn nhận vài ảnh moodboard của một chiến dịch mạng xã hội và viết hướng dẫn thị giác để một mô hình tạo ảnh vẽ NỀN cho bài đăng (chữ, logo, nút được ghép sau).

Quy tắc:
- Chỉ trả về một đối tượng JSON hợp lệ, không giải thích, không markdown.
- "concept": 3-5 câu tiếng Việt mô tả bối cảnh, không khí, ánh sáng, chất liệu, góc nhìn. Mô tả cái cần VẼ, không mô tả chữ hay giao diện.
- "subject": một cụm ngắn mô tả biểu tượng/hình chủ đạo lặp lại trong các ảnh (rỗng nếu không có).
- "palette": 3-6 mã HEX, màu chủ đạo trước.
- "accentColor": một mã HEX nổi bật dùng cho nút và dòng nhấn.
- "textTone": "light" nếu nền tối (chữ sáng), "dark" nếu nền sáng.
- "avoid": những thứ không nên xuất hiện trong nền, gồm cả thẻ giao diện, huy hiệu, chữ, logo nếu ảnh mẫu có chúng.`

const hex = (value: unknown) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : null)

/** Downsizes an asset to a JPEG data URL small enough to send to the text model. */
async function asDataUrl(assetId: string): Promise<string> {
  const blob = await (await fetch(assetUrl(assetId))).blob()
  const bitmap = await createImageBitmap(blob)
  const ratio = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Lets the text model look at the moodboard (mood images first, then samples and the main symbol) and fill the visual direction. */
export async function readMoodboard(kv: KeyVisual, keyId?: string): Promise<MoodReading> {
  const picked = [...kv.referenceIds, ...(kv.sampleIds ?? []), ...(kv.subjectIds ?? [])].slice(0, 3)
  if (picked.length === 0) throw new Error('Moodboard chưa có ảnh nào.')
  const images = await Promise.all(picked.map(asDataUrl))
  const prompt = [
    `Có ${images.length} ảnh moodboard đính kèm.`,
    kv.concept.trim() && `Mô tả hiện có (giữ ý chính nếu còn đúng):\n${kv.concept}`,
    'Trả về JSON dạng {"concept":"","subject":"","palette":["#000000"],"accentColor":"#000000","textTone":"light","avoid":""}.',
  ].filter(Boolean).join('\n\n')
  const { text } = await api.generateText({ system: SYSTEM, prompt, json: true, keyId, images })
  let data: Record<string, unknown>
  try { data = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown> } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại.') }
  const palette = Array.isArray(data.palette) ? data.palette.map(hex).filter((value): value is string => value !== null).slice(0, 6) : []
  return {
    concept: typeof data.concept === 'string' ? data.concept.trim().slice(0, 1200) : kv.concept,
    subject: typeof data.subject === 'string' ? data.subject.trim().slice(0, 200) : kv.subject,
    palette: palette.length >= 2 ? palette : kv.palette,
    accentColor: hex(data.accentColor) ?? kv.accentColor,
    textTone: data.textTone === 'dark' ? 'dark' : data.textTone === 'light' ? 'light' : kv.textTone,
    avoid: typeof data.avoid === 'string' ? data.avoid.trim().slice(0, 600) : kv.avoid,
  }
}
