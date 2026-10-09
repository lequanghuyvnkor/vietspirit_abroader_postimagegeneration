import { campaignWindow } from './foundation.ts'
import { emptyPiece } from './planEdit.ts'
import { addDays, daysBetween, pillarsOf } from './schedule.ts'
import { emptyKeyVisual, newCampaign, newId, now } from './types.ts'
import type { Campaign, CampaignTemplate, Metrics, Piece, TemplatePiece } from './types.ts'

export type Totals = { published: number; reach: number; engagement: number; clicks: number; leads: number; er: number | null; measured: number }

const num = (value: number | null | undefined) => value ?? 0

export function engagementRate(metrics: Metrics | undefined): number | null {
  return metrics && metrics.reach && metrics.reach > 0 && metrics.engagement !== null ? metrics.engagement / metrics.reach : null
}

/** A piece counts as measured once reach is typed in. */
export const isMeasured = (piece: Piece) => Boolean(piece.published && piece.metrics && piece.metrics.reach !== null)

export function totalsOf(pieces: Piece[]): Totals {
  const published = pieces.filter((piece) => piece.published)
  const measured = published.filter(isMeasured)
  const reach = measured.reduce((sum, piece) => sum + num(piece.metrics?.reach), 0)
  const withBoth = measured.filter((piece) => piece.metrics?.engagement !== null)
  const reachWithEngagement = withBoth.reduce((sum, piece) => sum + num(piece.metrics?.reach), 0)
  const engagement = withBoth.reduce((sum, piece) => sum + num(piece.metrics?.engagement), 0)
  return {
    published: published.length, measured: measured.length, reach, engagement,
    clicks: published.reduce((sum, piece) => sum + num(piece.metrics?.clicks), 0),
    leads: published.reduce((sum, piece) => sum + num(piece.metrics?.leads), 0),
    er: reachWithEngagement > 0 ? engagement / reachWithEngagement : null,
  }
}

export type GroupRow = Totals & { label: string; planned: number }

/** Plan versus results per funnel stage, pillar or kind. A piece that serves two pillars counts in both. */
export function groupTotals(campaign: Campaign, by: 'funnel' | 'pillar' | 'kind'): GroupRow[] {
  const groups = new Map<string, Piece[]>()
  const add = (label: string, piece: Piece) => groups.set(label, [...(groups.get(label) ?? []), piece])
  for (const piece of campaign.pieces) {
    if (by === 'funnel') add(piece.plan.funnel.toUpperCase() || 'Chưa chọn phễu', piece)
    else if (by === 'kind') add({ static: 'Ảnh', carousel: 'Carousel', reel: 'Reel' }[piece.kind], piece)
    else {
      const matched = pillarsOf(campaign, piece)
      if (matched.length) for (const index of matched) add(campaign.foundation.pillars[index].name, piece)
      else add(piece.plan.pillar.trim() || 'Chưa chọn trụ cột', piece)
    }
  }
  const order = by === 'funnel' ? ['TOFU', 'MOFU', 'BOFU'] : []
  return [...groups.entries()].map(([label, pieces]) => ({ label, planned: pieces.length, ...totalsOf(pieces) }))
    .sort((a, b) => (order.indexOf(a.label) + 1 || 99) - (order.indexOf(b.label) + 1 || 99) || b.planned - a.planned)
}

export const percent = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1).replace('.', ',')}%`)
export const count = (value: number) => value.toLocaleString('vi-VN')

const minutesOf = (time: string): number | null => {
  const match = time.match(/(\d{1,2})\s*[:h]\s*(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export type Reminder = { piece: Piece; kind: 'late' | 'due' | 'soon' }

/** Pieces to publish: overdue (date passed), due today, or due within the hour. Reminders only: the app never posts by itself. */
export function reminders(campaign: Campaign, today: string, minutesNow: number): Reminder[] {
  const out: Reminder[] = []
  for (const piece of campaign.pieces) {
    if (piece.published || !piece.date) continue
    if (piece.date < today) out.push({ piece, kind: 'late' })
    else if (piece.date === today) {
      const at = minutesOf(piece.plan.time)
      out.push({ piece, kind: at !== null && at - minutesNow <= 60 ? (at < minutesNow ? 'late' : 'soon') : 'due' })
    }
  }
  return out.sort((a, b) => (a.piece.date + a.piece.plan.time).localeCompare(b.piece.date + b.piece.plan.time))
}

const localDate = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const publishedDay = (piece: Piece) => (piece.published ? localDate(piece.published.at) : '')

/** Pieces ranked by a result, highest first, only those that have it. */
export function topPieces(campaign: Campaign, by: 'leads' | 'er' | 'reach', limit = 3): Piece[] {
  const value = (piece: Piece) => (by === 'er' ? engagementRate(piece.metrics) : piece.metrics?.[by]) ?? null
  return campaign.pieces.filter((piece) => piece.published && (value(piece) ?? 0) > 0).sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0)).slice(0, limit)
}

// ---------- Templates ----------
export function buildTemplate(campaign: Campaign, name: string): CampaignTemplate {
  const window = campaignWindow(campaign)
  const kv = campaign.keyVisual
  return structuredClone({
    id: newId(), name, at: now(), strategy: campaign.strategy,
    foundation: { ...campaign.foundation, start: '', end: '' },
    style: { concept: kv.concept, subject: kv.subject, palette: kv.palette, accentColor: kv.accentColor, textTone: kv.textTone, displayFont: kv.displayFont, bodyFont: kv.bodyFont, avoid: kv.avoid },
    guardrailNotes: campaign.guardrailNotes,
    variableKeys: Object.keys(campaign.variables), lead: campaign.lead,
    pieces: [...campaign.pieces].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).map((piece): TemplatePiece => ({
      title: piece.title, kind: piece.kind, plan: { ...piece.plan }, visual: { ...piece.visual }, production: piece.production, productionNote: piece.productionNote,
      checks: piece.checks.map((check) => ({ text: check.text, owner: check.owner })),
      dayOffset: window && piece.date ? daysBetween(window.start, piece.date) : null,
    })),
  })
}

/** A new campaign from a template: the structure and the plan, dated from `start`; no captions, pictures or results. */
export function campaignFromTemplate(template: CampaignTemplate, name: string, start: string): Campaign {
  const campaign = newCampaign(name, { ...emptyKeyVisual(), ...structuredClone(template.style) })
  campaign.strategy = template.strategy
  campaign.guardrailNotes = [...template.guardrailNotes]
  campaign.variables = Object.fromEntries(template.variableKeys.map((key) => [key, '']))
  campaign.lead = template.lead
  const offsets = template.pieces.map((piece) => piece.dayOffset).filter((value): value is number => value !== null)
  const span = offsets.length ? Math.max(...offsets) : 0
  campaign.foundation = { ...structuredClone(template.foundation), start, end: addDays(start, Math.max(span, 14)) }
  campaign.pieces = template.pieces.map((entry, index) => {
    const piece = emptyPiece(`P${String(index + 1).padStart(2, '0')}`, entry.kind)
    piece.title = entry.title
    piece.plan = { ...entry.plan }
    piece.visual = { ...entry.visual }
    piece.production = entry.production
    piece.productionNote = entry.productionNote
    piece.checks = entry.checks.map((check) => ({ id: newId(), text: check.text, owner: check.owner, done: false }))
    piece.date = entry.dayOffset === null ? '' : addDays(start, entry.dayOffset)
    return piece
  })
  return campaign
}
