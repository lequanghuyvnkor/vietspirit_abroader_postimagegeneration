import { api } from './api.ts'
import { scheduleWindow } from './plan.ts'
import { newId } from './types.ts'
import type { Campaign, Foundation } from './types.ts'
import { describeVariables } from './variables.ts'

export function emptyFoundation(): Foundation {
  return { objective: '', start: '', end: '', kpis: [], audiences: [], bigIdea: '', keyMessage: '', pillars: [], tone: '', dos: [] }
}

/** The campaign period: set on the foundation, else read from the imported strategy text. */
export function campaignWindow(campaign: Campaign): { start: string; end: string } | null {
  const { start, end } = campaign.foundation ?? emptyFoundation()
  if (start && end) return { start, end }
  return scheduleWindow(campaign.strategy)
}

const isEmpty = (f: Foundation) => !f.objective.trim() && !f.keyMessage.trim() && !f.bigIdea.trim() && f.pillars.length === 0 && f.audiences.length === 0

export const hasFoundation = (campaign: Campaign) => !isEmpty(campaign.foundation ?? emptyFoundation())

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** The foundation as plain text for every AI prompt (copy, caption, checks). Falls back to the raw strategy text. */
export function foundationBrief(campaign: Campaign): string {
  const f = campaign.foundation ?? emptyFoundation()
  if (isEmpty(f)) return campaign.strategy ? `CHIẾN LƯỢC CHIẾN DỊCH:\n${campaign.strategy}` : ''
  const window = campaignWindow(campaign)
  const facts = Object.entries(campaign.variables).filter(([, value]) => value.trim()).map(([key, value]) => `- ${key}: ${value.trim().replace(/\s+/g, ' ')}`)
  return [
    'NỀN TẢNG CHIẾN DỊCH',
    f.objective && `Mục tiêu: ${f.objective}`,
    window && `Thời gian: ${dm(window.start)} – ${dm(window.end)}`,
    f.kpis.length > 0 && `KPI: ${f.kpis.map((kpi) => `${kpi.label}${kpi.target ? ` (${kpi.target})` : ''}`).join('; ')}`,
    ...f.audiences.map((item) => `Đối tượng "${item.name}": ${[item.insight && `insight: ${item.insight}`, item.barrier && `rào cản: ${item.barrier}`].filter(Boolean).join('; ')}`),
    f.bigIdea && `Ý tưởng lớn: ${f.bigIdea}`,
    f.keyMessage && `Thông điệp chính: ${f.keyMessage}`,
    ...f.pillars.map((pillar, index) => `Trụ cột ${index + 1} "${pillar.name}": ${pillar.message}${pillar.proof ? ` (bằng chứng: ${pillar.proof})` : ''}`),
    f.tone && `Giọng điệu: ${f.tone}`,
    f.dos.length > 0 && `Nên nói:\n${f.dos.map((line) => `- ${line}`).join('\n')}`,
    facts.length > 0 && `Dữ kiện đã xác nhận (chỉ dùng đúng các giá trị này):\n${facts.join('\n')}`,
    // Until the foundation is complete, the imported strategy still carries what it does not cover yet.
    (!f.keyMessage.trim() || f.pillars.length < 2) && campaign.strategy && `CHIẾN LƯỢC GỐC (tham khảo thêm):\n${campaign.strategy}`,
  ].filter(Boolean).join('\n')
}

export type FactIssue = { text: string; keys: string[]; level: 'warn' | 'info' }

const DATE = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?/g

/** Checks the campaign facts without AI: dates outside the campaign, duplicated values, blanks still used in copy. */
export function factIssues(campaign: Campaign): FactIssue[] {
  const out: FactIssue[] = []
  const window = campaignWindow(campaign)
  const year = window?.start.slice(0, 4) ?? String(new Date().getFullYear())
  for (const [key, raw] of Object.entries(campaign.variables)) {
    const value = raw.trim()
    if (!value || !window) continue
    const late = [...value.matchAll(DATE)].map((match) => `${match[3] ?? year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`).filter((iso) => iso > window.end)
    if (late.length) out.push({ text: `[${key}] có ngày ${late.map(dm).join(', ')}, sau khi chiến dịch kết thúc (${dm(window.end)}). Nếu ưu đãi kéo dài hơn chiến dịch, bài đăng cần nói rõ; nếu không, sửa lại ngày.`, keys: [key], level: 'warn' })
  }
  const byValue = new Map<string, string[]>()
  for (const [key, raw] of Object.entries(campaign.variables)) {
    const value = raw.trim().toLowerCase().replace(/\s+/g, ' ')
    // "Không có" in two unrelated fields is a normal answer, not a duplicate.
    if (value.length >= 6 && !/^(không( có| áp dụng)?|chưa có|n\/?a|none)\.?$/.test(value)) byValue.set(value, [...(byValue.get(value) ?? []), key])
  }
  for (const keys of byValue.values()) if (keys.length > 1) out.push({ text: `${keys.map((key) => `[${key}]`).join(' và ')} cùng một giá trị. Nên giữ một tên để khỏi sửa chỗ này quên chỗ kia.`, keys, level: 'info' })
  const empty = describeVariables(campaign).filter((item) => !item.value.trim() && item.usedIn.length > 0)
  if (empty.length) out.push({ text: `${empty.length} dữ kiện còn trống nhưng đã dùng trong bài: ${empty.map((item) => `[${item.key}]`).join(', ')}.`, keys: empty.map((item) => item.key), level: 'warn' })
  return out
}

const parseJson = (raw: string): Record<string, unknown> => {
  try { return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown> } catch { throw new Error('AI trả về dữ liệu không đọc được. Thử lại.') }
}
const str = (value: unknown, max = 600) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[] : [])

const EXTRACT_SYSTEM = `Bạn là chiến lược gia truyền thông. Từ văn bản chiến lược của một chiến dịch mạng xã hội, bạn dựng "nền tảng chiến dịch" có cấu trúc. Chỉ dùng thông tin có trong văn bản, không bịa số liệu. Chỉ trả về JSON hợp lệ, không markdown. Viết tiếng Việt, ngắn gọn.`

/** Builds a structured foundation from the imported strategy text (the user reviews it before applying). */
export async function extractFoundation(campaign: Campaign, keyId?: string): Promise<Foundation> {
  if (!campaign.strategy.trim()) throw new Error('Chưa có văn bản chiến lược để đọc. Hãy điền nền tảng bằng tay.')
  const prompt = [
    `VĂN BẢN CHIẾN LƯỢC:\n${campaign.strategy}`,
    campaign.guardrailNotes.length > 0 && `ĐIỀU KHÔNG ĐƯỢC NÓI (đã có, không cần lặp lại):\n${campaign.guardrailNotes.join('\n')}`,
    'Trả về JSON: {"objective":"1-2 câu","start":"YYYY-MM-DD","end":"YYYY-MM-DD","kpis":[{"label":"","target":""}],"audiences":[{"name":"","insight":"điều họ thật sự lo/muốn","barrier":"điều khiến họ chần chừ"}],"bigIdea":"","keyMessage":"một câu","pillars":[{"name":"","message":"","proof":"bằng chứng có trong văn bản"}],"tone":"","dos":["điều nên nói"]}. 2-4 trụ cột, 1-3 đối tượng.',
  ].filter(Boolean).join('\n\n')
  const { text } = await api.generateText({ system: EXTRACT_SYSTEM, prompt, json: true, keyId })
  const data = parseJson(text)
  const iso = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '')
  const window = scheduleWindow(campaign.strategy)
  return {
    objective: str(data.objective),
    start: iso(data.start) || window?.start || '',
    end: iso(data.end) || window?.end || '',
    kpis: list(data.kpis).map((item) => ({ id: newId(), label: str(item.label, 120), target: str(item.target, 80) })).filter((item) => item.label),
    audiences: list(data.audiences).map((item) => ({ id: newId(), name: str(item.name, 120), insight: str(item.insight, 300), barrier: str(item.barrier, 300) })).filter((item) => item.name),
    bigIdea: str(data.bigIdea, 300),
    keyMessage: str(data.keyMessage, 300),
    pillars: list(data.pillars).map((item) => ({ id: newId(), name: str(item.name, 80), message: str(item.message, 300), proof: str(item.proof, 300) })).filter((item) => item.name),
    tone: str(data.tone, 200),
    dos: Array.isArray(data.dos) ? data.dos.map((line) => str(line, 200)).filter(Boolean).slice(0, 10) : [],
  }
}

const AUDIT_SYSTEM = `Bạn là người kiểm soát dữ kiện cho một chiến dịch truyền thông có ưu đãi. Tìm chỗ các dữ kiện mâu thuẫn nhau hoặc mâu thuẫn với nền tảng chiến dịch: ngày tháng lệch, bậc ưu đãi bị đảo, điều kiện tự mâu thuẫn, con số không khớp, cam kết vượt quá điều được nói. Không bắt lỗi chính tả hay văn phong. Chỉ trả về JSON hợp lệ, không markdown, tiếng Việt.`

/** Asks the text model for contradictions between facts (what plain rules cannot see, e.g. swapped tiers). */
export async function auditFacts(campaign: Campaign, keyId?: string): Promise<FactIssue[]> {
  const facts = Object.entries(campaign.variables).filter(([, value]) => value.trim())
  if (facts.length === 0) throw new Error('Chưa có dữ kiện nào để soát.')
  const prompt = [
    foundationBrief(campaign),
    campaign.guardrailNotes.length > 0 && `KHÔNG ĐƯỢC NÓI:\n${campaign.guardrailNotes.join('\n')}`,
    `DỮ KIỆN (tên biến = giá trị):\n${facts.map(([key, value]) => `[${key}] = ${value.trim().replace(/\s+/g, ' ')}`).join('\n')}`,
    'Trả về JSON: {"issues":[{"text":"mô tả ngắn mâu thuẫn và cách sửa","keys":["TÊN BIẾN"],"level":"warn|info"}]}. Trả mảng rỗng nếu không có mâu thuẫn.',
  ].filter(Boolean).join('\n\n')
  const { text } = await api.generateText({ system: AUDIT_SYSTEM, prompt, json: true, keyId })
  return list(parseJson(text).issues).map((item) => ({ text: str(item.text, 400), keys: Array.isArray(item.keys) ? item.keys.map((key) => str(key, 80)).filter(Boolean) : [], level: item.level === 'info' ? 'info' as const : 'warn' as const })).filter((item) => item.text)
}
