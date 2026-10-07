import { tokenKey } from './text.ts'
import type { Campaign } from './types.ts'

export type GroupKey = 'contact' | 'offer' | 'mentor' | 'other'

export const GROUP_LABELS: Record<GroupKey, { title: string; hint: string }> = {
  contact: { title: 'Liên hệ & đăng ký', hint: 'Đường dẫn, hotline, kênh, giờ đóng form' },
  offer: { title: 'Ưu đãi & điều kiện', hint: 'Số suất, mức giảm, thời hạn, phạm vi, cấp độ giải' },
  mentor: { title: 'Mentor', hint: 'Tên, trường, kinh nghiệm đã xác thực' },
  other: { title: 'Khác', hint: '' },
}

export type VariableInfo = {
  key: string
  /** Readable name, e.g. "Số suất". */
  label: string
  group: GroupKey
  value: string
  /** Pieces whose caption or slides use it. */
  usedIn: { code: string; id: string }[]
  /** A sentence around its first use, with the token in place. */
  example: string
  /** Another variable that looks like the same thing (e.g. LINK and LINK FORM). */
  similar: string | null
}

const GROUPS: [GroupKey, RegExp][] = [
  ['mentor', /MENTOR|TRƯỜNG|CHƯƠNG TRÌNH|KINH NGHIỆM|CREDENTIAL/],
  ['contact', /LINK|HOTLINE|KÊNH|GIỜ|FORM|ZALO|EMAIL|WEBSITE|SĐT|QR/],
  ['offer', /SUẤT|MỨC|GIẢM|ƯU ĐÃI|THỜI HẠN|PHẠM VI|ĐỐI TƯỢNG|CỘNG DỒN|THANH TOÁN|HỦY|ĐỊNH NGHĨA|GÓI|GIÁ|CẤP/],
]

const KEEP_UPPER = new Set(['KAIST', 'GPA', 'CRM', 'QR', 'UTM', 'IELTS', 'SAT'])

/** "ĐỊNH NGHĨA — VÍ DỤ GIẢI NHÌ QUỐC GIA" -> "Định nghĩa: giải nhì quốc gia". */
export function humanize(key: string): string {
  const cleaned = key.replace(/\s*[—–-]\s*VÍ DỤ\s*/i, ': ').replace(/\s*[—–]\s*/g, ' · ')
  const lower = cleaned.toLowerCase().split(/(\s+)/).map((word) => (KEEP_UPPER.has(word.toUpperCase()) ? word.toUpperCase() : word)).join('')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const groupOf = (key: string): GroupKey => GROUPS.find(([, pattern]) => pattern.test(key))?.[0] ?? 'other'

/** Collects every [PLACEHOLDER] in the campaign's copy with where it is used and a short example. */
export function describeVariables(campaign: Campaign): VariableInfo[] {
  const map = new Map<string, VariableInfo>()
  const note = (text: string, piece: { code: string; id: string } | null) => {
    for (const match of text.matchAll(/\[([^\]\n]{2,60})\]/g)) {
      const key = tokenKey(match[1])
      let info = map.get(key)
      if (!info) {
        info = { key, label: humanize(key), group: groupOf(key), value: campaign.variables[key] ?? '', usedIn: [], example: '', similar: null }
        map.set(key, info)
      }
      if (piece && !info.usedIn.some((entry) => entry.id === piece.id)) info.usedIn.push(piece)
      if (!info.example) {
        const from = Math.max(0, match.index - 38), to = Math.min(text.length, match.index + match[0].length + 38)
        info.example = `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ')}${to < text.length ? '…' : ''}`
      }
    }
  }
  for (const piece of campaign.pieces) {
    const ref = { code: piece.code, id: piece.id }
    note(piece.caption, ref)
    for (const post of campaign.posts.filter((item) => item.pieceId === piece.id)) for (const field of [post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.footer]) note(field, ref)
  }
  for (const post of campaign.posts.filter((item) => !item.pieceId)) for (const field of [post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.footer]) note(field, null)

  const all = [...map.values()]
  for (const info of all) {
    // LINK vs LINK FORM: same words, one extends the other.
    info.similar = all.find((other) => other.key !== info.key && (other.key.startsWith(`${info.key} `) || info.key.startsWith(`${other.key} `)))?.key ?? null
  }
  const order: GroupKey[] = ['contact', 'offer', 'mentor', 'other']
  return all.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || b.usedIn.length - a.usedIn.length || a.label.localeCompare(b.label, 'vi'))
}
