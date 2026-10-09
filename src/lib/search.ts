import type { Store } from './types.ts'

export type Hit = {
  kind: 'campaign' | 'piece' | 'slide'
  workspaceId: string
  campaignId: string
  pieceId?: string
  postId?: string
  title: string
  /** Where it is: workspace · campaign (· piece). */
  where: string
  /** The matching field, e.g. "Caption", and a short stretch of text around the match. */
  field: string
  excerpt: string
  score: number
}

/** Lower case without Vietnamese accents, one character for one character so match positions line up with the original text. */
export function fold(text: string): string {
  return Array.from(text.toLowerCase(), (char) => (char === 'đ' ? 'd' : char.normalize('NFD').replace(/[̀-ͯ]/g, '') || char)).join('')
}

const terms = (query: string) => fold(query).split(/\s+/).filter(Boolean)

type Field = { label: string; text: string; weight: number }

function best(fields: Field[], needles: string[]): { field: Field; at: number; score: number } | null {
  let result: { field: Field; at: number; score: number } | null = null
  const folded = fields.map((field) => fold(field.text))
  // Every term must be found somewhere in the item.
  if (!needles.every((needle) => folded.some((text) => text.includes(needle)))) return null
  fields.forEach((field, index) => {
    const at = folded[index].indexOf(needles[0])
    if (at < 0) return
    const score = field.weight + (at === 0 ? 2 : 0) + needles.filter((needle) => folded[index].includes(needle)).length
    if (!result || score > result.score) result = { field, at, score }
  })
  if (result) return result
  const first = fields.findIndex((_, index) => needles.some((needle) => folded[index].includes(needle)))
  return first >= 0 ? { field: fields[first], at: Math.max(0, folded[first].indexOf(needles.find((needle) => folded[first].includes(needle))!)), score: 1 } : null
}

const around = (text: string, at: number) => {
  const start = Math.max(0, at - 36)
  const piece = text.slice(start, at + 90).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${piece}${at + 90 < text.length ? '…' : ''}`
}

/** Searches campaigns, pieces (plan, caption, checklist, links) and slide texts across every workspace. */
export function searchStore(store: Store, query: string, limit = 40): Hit[] {
  const needles = terms(query)
  if (needles.length === 0) return []
  const hits: Hit[] = []
  for (const workspace of store.workspaces) {
    for (const campaign of workspace.campaigns) {
      const base = { workspaceId: workspace.id, campaignId: campaign.id }
      const where = `${workspace.name} · ${campaign.name}`
      const foundation = campaign.foundation
      const campaignMatch = best([
        { label: 'Tên chiến dịch', text: campaign.name, weight: 10 },
        { label: 'Mục tiêu', text: foundation?.objective ?? '', weight: 4 },
        { label: 'Ý tưởng lớn', text: foundation?.bigIdea ?? '', weight: 4 },
        { label: 'Thông điệp', text: foundation?.keyMessage ?? '', weight: 4 },
        { label: 'Chiến lược', text: campaign.strategy, weight: 2 },
        ...Object.entries(campaign.variables).map(([key, value]) => ({ label: `Biến [${key}]`, text: `${key} ${value}`, weight: 3 })),
      ], needles)
      if (campaignMatch) hits.push({ ...base, kind: 'campaign', title: campaign.name, where: workspace.name, field: campaignMatch.field.label, excerpt: around(campaignMatch.field.text, campaignMatch.at), score: campaignMatch.score + 1 })

      for (const piece of campaign.pieces) {
        const match = best([
          { label: 'Mã bài', text: piece.code, weight: 12 },
          { label: 'Tên bài', text: piece.title, weight: 10 },
          { label: 'Hook', text: piece.plan.hook, weight: 8 },
          { label: 'Caption', text: piece.caption, weight: 6 },
          { label: 'Hashtag', text: piece.hashtags, weight: 5 },
          { label: 'Mục tiêu', text: piece.plan.goal, weight: 4 },
          { label: 'Cấu trúc', text: piece.plan.structure, weight: 4 },
          { label: 'CTA', text: piece.plan.cta, weight: 4 },
          { label: 'Trụ cột', text: piece.plan.pillar, weight: 4 },
          { label: 'Phễu', text: piece.plan.funnel, weight: 3 },
          { label: 'Visual brief', text: Object.values(piece.visual).join(' · '), weight: 3 },
          { label: 'Mục duyệt', text: piece.checks.map((check) => check.text).join(' · '), weight: 3 },
          { label: 'Link bài đăng', text: `${piece.published?.url ?? ''} ${piece.published?.note ?? ''}`, weight: 2 },
        ], needles)
        if (match) hits.push({ ...base, kind: 'piece', pieceId: piece.id, title: `${piece.code} · ${piece.title || piece.plan.hook}`, where, field: match.field.label, excerpt: around(match.field.text, match.at), score: match.score + 5 })
      }
      for (const post of campaign.posts) {
        const match = best([
          { label: 'Tiêu đề slide', text: post.headline, weight: 6 },
          { label: 'Dòng nhấn', text: post.accent, weight: 4 },
          { label: 'Câu dẫn', text: post.subtitle, weight: 3 },
          { label: 'Nhãn', text: post.eyebrow, weight: 2 },
          { label: 'CTA', text: post.cta, weight: 2 },
        ], needles)
        if (!match) continue
        const piece = post.pieceId ? campaign.pieces.find((item) => item.id === post.pieceId) : undefined
        hits.push({ ...base, kind: 'slide', pieceId: piece?.id, postId: post.id, title: post.name, where: piece ? `${where} · ${piece.code}` : where, field: match.field.label, excerpt: around(match.field.text, match.at), score: match.score })
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
