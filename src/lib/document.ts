import { campaignWindow, emptyFoundation } from './foundation.ts'
import { slidesOf } from './pack.ts'
import { kindLabel, madeInApp } from './plan.ts'
import { count, engagementRate, groupTotals, percent, totalsOf } from './results.ts'
import { coverage } from './schedule.ts'
import { applyVars, unresolvedIn } from './text.ts'
import { STATUS_LABELS, formatOf } from './types.ts'
import type { Campaign, DocBlock, DocModel, Piece, Workspace } from './types.ts'

export type DocOptions = {
  /** Only pieces that reached "Sẵn sàng". */
  readyOnly: boolean
  /** Put the slide images in (references to be rendered later). */
  images: boolean
}

export const POST_REF = 'post:'
export const ASSET_REF = 'asset:'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long' })

/** Short stable fingerprint (FNV-1a) to tell whether a piece changed since a version was approved. */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) }
  return (hash >>> 0).toString(16)
}

export const sortedPieces = (campaign: Campaign): Piece[] =>
  [...campaign.pieces].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.plan.time.localeCompare(b.plan.time) || a.code.localeCompare(b.code))

export function documentPieces(campaign: Campaign, options: DocOptions): Piece[] {
  return sortedPieces(campaign).filter((piece) => !options.readyOnly || piece.status === 'ready')
}

/** What a piece contributes to the document, including what its slides say and when they last changed. */
export function pieceFingerprint(campaign: Campaign, piece: Piece): string {
  const slides = slidesOf(campaign, piece).map((post) => [post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.backgroundId, post.updatedAt])
  return fingerprint(JSON.stringify([piece.title, piece.date, piece.status, piece.plan, piece.caption, piece.hashtags, piece.checks.map((check) => [check.text, check.done]), slides]))
}

function strategyBlocks(campaign: Campaign): DocBlock[] {
  const foundation = campaign.foundation ?? emptyFoundation()
  const window = campaignWindow(campaign)
  const blocks: DocBlock[] = [{ t: 'h', level: 2, text: '1. Chiến lược' }]
  const rows: [string, string][] = [
    ['Mục tiêu', foundation.objective],
    ['Thời gian', window ? `${dmy(window.start)} – ${dmy(window.end)}` : ''],
    ['Ý tưởng lớn', foundation.bigIdea],
    ['Thông điệp chính', foundation.keyMessage],
    ['Giọng điệu', foundation.tone],
  ]
  const filled = rows.filter(([, value]) => value.trim())
  if (filled.length === 0 && campaign.strategy.trim()) {
    blocks.push(...campaign.strategy.split('\n').filter((line) => line.trim()).map((line): DocBlock => ({ t: 'p', text: line.trim() })))
  } else if (filled.length > 0) blocks.push({ t: 'kv', rows: filled })
  if (foundation.kpis.length > 0) blocks.push({ t: 'h', level: 3, text: 'KPI' }, { t: 'table', head: ['Chỉ số', 'Mục tiêu'], rows: foundation.kpis.map((kpi) => [kpi.label, kpi.target]) })
  if (foundation.audiences.length > 0) blocks.push({ t: 'h', level: 3, text: 'Đối tượng' }, { t: 'table', head: ['Nhóm', 'Insight', 'Rào cản'], rows: foundation.audiences.map((item) => [item.name, item.insight, item.barrier]) })
  if (foundation.pillars.length > 0) blocks.push({ t: 'h', level: 3, text: 'Trụ cột nội dung' }, { t: 'table', head: ['Trụ cột', 'Thông điệp', 'Bằng chứng'], rows: foundation.pillars.map((item) => [item.name, item.message, item.proof]) })
  if (foundation.dos.length > 0) blocks.push({ t: 'h', level: 3, text: 'Nên nói' }, { t: 'list', items: foundation.dos })
  const donts = [...campaign.guardrailNotes, ...campaign.guardrails].filter((line) => line.trim())
  if (donts.length > 0) blocks.push({ t: 'h', level: 3, text: 'Không được nói' }, { t: 'list', items: donts })
  const facts = Object.entries(campaign.variables).filter(([, value]) => value.trim())
  if (facts.length > 0) blocks.push({ t: 'h', level: 3, text: 'Dữ kiện đã xác nhận' }, { t: 'table', head: ['Biến', 'Giá trị'], rows: facts.map(([key, value]) => [`[${key}]`, value.trim()]) })
  return blocks
}

function scheduleBlocks(campaign: Campaign, pieces: Piece[]): DocBlock[] {
  const blocks: DocBlock[] = [{ t: 'h', level: 2, text: '2. Lịch đăng' }]
  blocks.push({ t: 'table', head: ['Ngày', 'Giờ', 'Mã', 'Bài', 'Loại', 'Phễu', 'Trạng thái'], rows: pieces.map((piece) => [piece.date ? `${weekday(piece.date)} ${dmy(piece.date).slice(0, 5)}` : 'Chưa xếp lịch', piece.plan.time, piece.code, piece.title, kindLabel(piece), piece.plan.funnel, STATUS_LABELS[piece.status]]) })
  const data = coverage({ ...campaign, pieces })
  if (pieces.length > 0) blocks.push({ t: 'p', text: `Phễu: ${data.funnel.map((item) => `${item.key} ${item.count} bài`).join(' · ')}.` })
  return blocks
}

function pieceBlocks(campaign: Campaign, piece: Piece, options: DocOptions): DocBlock[] {
  const fill = (text: string) => applyVars(text, campaign.variables)
  const rows: [string, string][] = [
    ['Ngày giờ đăng', piece.date ? `${weekday(piece.date)}, ${dmy(piece.date)} ${piece.plan.time}`.trim() : 'Chưa xếp lịch'],
    ['Loại', `${kindLabel(piece)}${piece.plan.format ? ` · ${piece.plan.format}` : ''}`],
    ['Phễu · Trụ cột', [piece.plan.funnel, piece.plan.pillar].filter(Boolean).join(' · ')],
    ['Trạng thái', STATUS_LABELS[piece.status]],
    ['Mục tiêu', fill(piece.plan.goal)],
    ['Hook', fill(piece.plan.hook)],
    ['Cấu trúc', fill(piece.plan.structure)],
    ['CTA', fill(piece.plan.cta)],
    ['Caption', fill(piece.caption)],
    ['Hashtag', piece.hashtags],
    ['Bên sản xuất', piece.kind === 'reel' && piece.production === 'external' ? `Bên ngoài. ${piece.productionNote}`.trim() : ''],
    ['Điều kiện trước đăng', fill(piece.plan.conditions)],
    ['Đã đăng', piece.published ? `${new Date(piece.published.at).toLocaleString('vi-VN')}${piece.published.url ? ` · ${piece.published.url}` : ''}` : ''],
  ]
  const blocks: DocBlock[] = [{ t: 'break' }, { t: 'h', level: 3, text: `${piece.code} · ${piece.title || piece.plan.hook}` }, { t: 'kv', rows: rows.filter(([, value]) => value.trim()) }]
  if (options.images && madeInApp(piece)) {
    const slides = slidesOf(campaign, piece)
    if (slides.length > 0) {
      blocks.push({ t: 'images', items: slides.map((post, index) => {
        const format = formatOf(post.format)
        return { ref: `${POST_REF}${post.id}`, caption: `${piece.kind === 'reel' ? 'Cảnh' : slides.length > 1 ? 'Slide' : 'Ảnh'} ${index + 1}${post.headline ? `: ${fill(post.headline)}` : ''}`, w: format.width, h: format.height }
      }) })
    }
  }
  if (piece.checks.length > 0) blocks.push({ t: 'p', text: 'Mục cần duyệt:' }, { t: 'list', items: piece.checks.map((check) => `${check.done ? '[x]' : '[ ]'} ${check.text}${check.owner ? ` (${check.owner})` : ''}`) })
  return blocks
}

function resultsBlocks(campaign: Campaign): DocBlock[] {
  const published = campaign.pieces.filter((piece) => piece.published)
  if (published.length === 0) return []
  const totals = totalsOf(campaign.pieces)
  const blocks: DocBlock[] = [{ t: 'break' }, { t: 'h', level: 2, text: '4. Kết quả' }]
  blocks.push({ t: 'kv', rows: [
    ['Bài đã đăng', `${totals.published}/${campaign.pieces.length}`], ['Tiếp cận', count(totals.reach)], ['Tỷ lệ tương tác', percent(totals.er)], ['Nhấp link', count(totals.clicks)], ['Lead', count(totals.leads)],
  ] })
  for (const [title, by] of [['Theo phễu', 'funnel'], ['Theo trụ cột', 'pillar'], ['Theo loại bài', 'kind']] as const) {
    blocks.push({ t: 'h', level: 3, text: title }, { t: 'table', head: [title.replace('Theo ', '').replace(/^./, (letter) => letter.toUpperCase()), 'Kế hoạch', 'Đã đăng', 'Tiếp cận', 'Tỷ lệ tương tác', 'Lead'], rows: groupTotals(campaign, by).map((row) => [row.label, String(row.planned), String(row.published), count(row.reach), percent(row.er), count(row.leads)]) })
  }
  blocks.push({ t: 'h', level: 3, text: 'Từng bài' }, { t: 'table', head: ['Bài', 'Đăng lúc', 'Tiếp cận', 'Tương tác', 'Tỷ lệ', 'Nhấp', 'Lead'], rows: published.map((piece) => [`${piece.code} · ${piece.title}`, new Date(piece.published!.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), piece.metrics?.reach?.toString() ?? '', piece.metrics?.engagement?.toString() ?? '', percent(engagementRate(piece.metrics)), piece.metrics?.clicks?.toString() ?? '', piece.metrics?.leads?.toString() ?? '']) })
  const reviews = (campaign.weeklyReviews ?? []).filter((item) => item.wins || item.problems || item.actions).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  if (reviews.length > 0) {
    blocks.push({ t: 'h', level: 3, text: 'Xem lại hằng tuần' })
    for (const review of reviews) blocks.push({ t: 'kv', rows: [[`Tuần ${dmy(review.weekStart).slice(0, 5)}`, ''], ['Điều làm tốt', review.wins], ['Điều chưa tốt', review.problems], ['Việc tuần tới', review.actions]].filter(([, value], index) => index === 0 || value) as [string, string][] })
  }
  const retro = campaign.retro
  if (retro && (retro.worked || retro.didnt || retro.next)) blocks.push({ t: 'h', level: 3, text: 'Tổng kết' }, { t: 'kv', rows: ([['Điều hiệu quả', retro.worked], ['Điều không hiệu quả', retro.didnt], ['Làm khác đi lần sau', retro.next]] as [string, string][]).filter(([, value]) => value) })
  return blocks
}

/** Compiles the campaign into one document: strategy, calendar, then each piece with its images, caption and checklist. */
export function buildDocument(workspace: Workspace, campaign: Campaign, options: DocOptions): DocModel {
  const pieces = documentPieces(campaign, options)
  const window = campaignWindow(campaign)
  const cover: [string, string][] = [
    ['Thương hiệu', workspace.company.name],
    ['Chiến dịch', campaign.name],
    ['Thời gian', window ? `${dmy(window.start)} – ${dmy(window.end)}` : ''],
    ['Số bài', `${pieces.length}${options.readyOnly ? ' (chỉ bài Sẵn sàng)' : ''}`],
  ]
  const blocks: DocBlock[] = [
    { t: 'h', level: 1, text: `${campaign.name} · Tài liệu kế hoạch nội dung` },
    { t: 'kv', rows: cover.filter(([, value]) => value.trim()) },
    ...strategyBlocks(campaign),
    ...scheduleBlocks(campaign, pieces),
    { t: 'h', level: 2, text: '3. Các bài đăng' },
    ...pieces.flatMap((piece) => pieceBlocks(campaign, piece, options)),
    ...resultsBlocks(campaign),
  ]
  return { title: campaign.name, blocks }
}

/** Variables still unfilled in the pieces of the document (the document would show them in square brackets). */
export function unresolvedInDocument(campaign: Campaign, pieces: Piece[]): string[] {
  return [...new Set(pieces.flatMap((piece) => [piece.caption, piece.plan.hook, piece.plan.cta, piece.plan.goal].flatMap((text) => unresolvedIn(text, campaign.variables))))]
}
