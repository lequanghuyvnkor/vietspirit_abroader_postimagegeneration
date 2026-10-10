import { api, assetUrl } from './api.ts'
import { guessRole } from './motifs.ts'
import type { Component, MotifRole } from './types.ts'

const MAX_PIECES = 16
const CELL = 220

const SYSTEM = `Bạn là art director phân loại các mảnh đồ họa thương hiệu cắt ra từ một file moodboard. Bạn nhận MỘT ảnh gồm nhiều ô đánh số (số nằm ở góc trên bên trái mỗi ô, nền xám để thấy cả mảnh sáng lẫn tối). Mỗi ô là một mảnh đồ họa.

Gán cho mỗi mảnh đúng một vai trò:
- "hero": biểu tượng chủ đạo của chiến dịch (hình lớn, đặc trưng, thường chỉ có một hoặc hai mảnh), dùng làm điểm nhấn chính của ảnh.
- "line": đường dài mảnh: đường bay, quỹ đạo, vệt sáng, đường nối; dùng nối các slide.
- "decor": họa tiết nhỏ lặp lại: sao nhỏ, chấm sáng, hạt, ngôi sao điểm; rải làm nền.
- "off": không dùng: logo, chữ, mảnh vụn, mảng xám, thẻ giao diện, ô màu trơn, bản sao thừa, hình quá mờ.

Quy tắc: chỉ trả về một đối tượng JSON hợp lệ, không giải thích. Nếu không chắc, chọn "off". Tối đa hai mảnh "hero".`

/** One image with every piece in a numbered grid on grey, small enough to send to the text model. */
async function contactSheet(pieces: Component[]): Promise<string> {
  const columns = Math.min(4, pieces.length)
  const rows = Math.ceil(pieces.length / columns)
  const canvas = document.createElement('canvas')
  canvas.width = columns * CELL
  canvas.height = rows * CELL
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#7a7f8a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await Promise.all(pieces.map(async (piece, index) => {
    const bitmap = await createImageBitmap(await (await fetch(assetUrl(piece.assetId))).blob())
    const x = (index % columns) * CELL
    const y = Math.floor(index / columns) * CELL
    const ratio = Math.min((CELL - 24) / bitmap.width, (CELL - 24) / bitmap.height, 4)
    const w = Math.max(1, Math.round(bitmap.width * ratio))
    const h = Math.max(1, Math.round(bitmap.height * ratio))
    ctx.drawImage(bitmap, x + (CELL - w) / 2, y + (CELL - h) / 2, w, h)
    ctx.strokeStyle = '#ffffff55'
    ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2)
    ctx.fillStyle = '#111'
    ctx.fillRect(x, y, 30, 24)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(String(index + 1), x + 7, y + 17)
  }))
  return canvas.toDataURL('image/jpeg', 0.85)
}

const ROLES: MotifRole[] = ['hero', 'line', 'decor', 'off']

/** Reads the AI reply: roles by piece number. A piece the AI did not mention keeps the shape-based guess. */
export function parseRoles(raw: string, pieces: Component[]): Map<string, MotifRole> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try { data = JSON.parse(cleaned) } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại.') }
  const list = Array.isArray(data) ? data : (data as { roles?: unknown }).roles
  if (!Array.isArray(list)) throw new Error('AI không trả về danh sách vai trò. Thử lại.')
  const result = new Map<string, MotifRole>()
  for (const entry of list) {
    const item = (entry ?? {}) as { n?: unknown; role?: unknown }
    const piece = typeof item.n === 'number' ? pieces[item.n - 1] : undefined
    if (piece && typeof item.role === 'string' && ROLES.includes(item.role as MotifRole)) result.set(piece.id, item.role as MotifRole)
  }
  // At most two heroes: the rest are demoted to the shape-based guess.
  let heroes = 0
  for (const [id, role] of result) {
    if (role !== 'hero') continue
    heroes += 1
    if (heroes > 2) result.set(id, guessRole(pieces.find((piece) => piece.id === id)!))
  }
  for (const piece of pieces) if (!result.has(piece.id)) result.set(piece.id, guessRole(piece))
  return result
}

/** Asks the AI to give every brand graphic a role (hero, line, decor, off). Returns the roles by component id. */
export async function classifyMotifs(components: Component[], keyId?: string): Promise<Map<string, MotifRole>> {
  const pieces = components.filter((item) => !/^logo/i.test(item.name)).slice(0, MAX_PIECES)
  if (pieces.length === 0) throw new Error('Chưa có họa tiết nào để phân loại.')
  const image = await contactSheet(pieces)
  const prompt = `Có ${pieces.length} mảnh đồ họa đánh số từ 1 đến ${pieces.length}. Trả về JSON dạng {"roles":[{"n":1,"role":"hero"}]} với đủ ${pieces.length} phần tử.`
  const { text } = await api.generateText({ system: SYSTEM, prompt, json: true, keyId, images: [image] })
  return parseRoles(text, pieces)
}
