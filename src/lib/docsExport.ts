import { kindLabel } from './plan.ts'
import { applyVars } from './text.ts'
import type { Campaign, Piece } from './types.ts'

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

const weekday = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long' })
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`

/** What the piece ships as: finished images, or a reel (made in the app or handed to another team). */
function mediaText(campaign: Campaign, piece: Piece): string {
  const slides = campaign.posts.filter((post) => post.pieceId === piece.id && !post.excluded)
  if (piece.kind === 'reel') return piece.production === 'external' ? 'Reel · bên ngoài sản xuất (có người)' : slides.length ? `Reel · ${slides.length} cảnh làm trong app` : 'Reel · chưa có cảnh'
  return slides.length ? `${slides.length} ảnh hoàn chỉnh` : 'Chưa có ảnh'
}

export function cardRows(campaign: Campaign, piece: Piece): [string, string][] {
  const fill = (text: string) => applyVars(text, campaign.variables)
  const all: [string, string][] = [
    ['Ngày giờ đăng', piece.date ? `${weekday(piece.date)}, ${dayMonth(piece.date)} ${piece.plan.time}`.trim() : 'Chưa xếp lịch'],
    ['Loại', `${kindLabel(piece)}${piece.plan.format ? ` · ${piece.plan.format}` : ''}`],
    ['Bên sản xuất', piece.production === 'external' ? 'Bên ngoài' : 'Nội bộ'],
    ['Mục tiêu', piece.plan.goal],
    ['Hook', piece.plan.hook],
    ['Caption', fill(piece.caption)],
    ['Ảnh / Reel', mediaText(campaign, piece)],
    ['Hashtag', piece.hashtags],
    ['CTA', fill(piece.plan.cta)],
  ]
  return all.filter(([, value]) => value.trim())
}

/** One card per piece (a titled one-cell-wide table), grouped by publish date; pastes into Google Docs with formatting kept. */
export function buildDocsHtml(campaign: Campaign): string {
  const pieces = [...campaign.pieces].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.plan.time.localeCompare(b.plan.time) || a.code.localeCompare(b.code))
  const body = pieces.map((piece) => `<h2>${esc(`${piece.date ? dayMonth(piece.date).slice(0, 5) : 'Chưa xếp lịch'} · ${piece.code} · ${piece.title}`)}</h2>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">
${cardRows(campaign, piece).map(([label, value]) => `<tr><td style="width:24%;background:#f1f3f4"><b>${esc(label)}</b></td><td>${esc(value)}</td></tr>`).join('\n')}
</table>
<p></p>`).join('\n')
  return `<h1>${esc(campaign.name)} · Lịch đăng (${pieces.length} bài)</h1>\n${body}`
}

export async function copyDocsHtml(campaign: Campaign): Promise<void> {
  const html = buildDocsHtml(campaign)
  const plain = html.replace(/<\/(h1|h2|tr|p)>/g, '\n').replace(/<\/td>/g, ': ').replace(/<[^>]+>/g, '')
  await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })])
}

export type DocsImage = { name: string; caption: string; data: string; w: number; h: number }
export type DocsCard = { tab: string; title: string; rows: [string, string][]; imagesTitle: string; images: DocsImage[] }

/** The text part of a piece's Docs tab: one tab per piece, titled by its code. */
export function cardOf(campaign: Campaign, piece: Piece): Pick<DocsCard, 'tab' | 'title' | 'rows'> {
  return { tab: piece.code, title: `${piece.date ? `${dayMonth(piece.date).slice(0, 5)} · ` : ''}${piece.code} · ${piece.title}`, rows: cardRows(campaign, piece) }
}
