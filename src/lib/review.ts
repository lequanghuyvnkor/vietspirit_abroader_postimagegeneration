import { lintCopy } from './copyCraft.ts'
import { campaignWindow, foundationBrief } from './foundation.ts'
import { allSlidesOf, slidesOf } from './pack.ts'
import { madeInApp, pieceTexts } from './plan.ts'
import { pieceIssues } from './planCheck.ts'
import { fold } from './search.ts'
import { applyVars, lintText, unresolvedIn } from './text.ts'
import { newId, now } from './types.ts'
import type { Campaign, Piece, PieceSnapshot, PieceVersion, PieceVersionEvent } from './types.ts'

const MAX_VERSIONS = 20

export type AutoCheck = { text: string; level: 'block' | 'warn' | 'info' | 'ok' }

const NUMBER = /\d[\d.,]*\d%?|\d%?/g
const DATE = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?/g
const digits = (text: string) => text.replace(/[^\d]/g, '')

/** Numbers that matter in copy (amounts, percentages, counts of 10 or more), without dates, times and years. */
function figuresIn(text: string): string[] {
  const clean = text.replace(DATE, ' ').replace(/\d{1,2}\s*[:h]\s*\d{2}/g, ' ')
  return [...new Set([...clean.matchAll(NUMBER)].map((match) => match[0]).filter((token) => {
    const value = digits(token)
    // Slide counters like "01" and "02" are not figures.
    if (value.length < 2 || (value.length === 2 && value.startsWith('0'))) return false
    return !(value.length === 4 && /^20[2-3]\d$/.test(value))
  }))]
}

/**
 * Phrases to look for in the copy from the "Không được nói" lines: whatever sits in quotes, else the short sentence itself.
 * Long descriptive lines ("Không hứa chắc kết quả…") cannot be matched word for word, so they are left to the AI instructions.
 */
export function bannedPhrases(notes: string[]): string[] {
  const out: string[] = []
  for (const note of notes) {
    const quoted = [...note.matchAll(/["“”«]([^"“”«»]{3,60})["“”»]/g)].map((match) => match[1].trim())
    if (quoted.length) { out.push(...quoted); continue }
    const tail = note.includes(':') ? note.slice(note.lastIndexOf(':') + 1).trim() : note.trim()
    if (tail.length >= 4 && tail.length <= 50) out.push(tail)
  }
  return [...new Set(out)]
}

/** Fact check without AI: variables, forbidden phrases, "do not say" lines, dates outside the campaign, and figures that appear nowhere in the plan. */
export function autoChecks(campaign: Campaign, piece: Piece): AutoCheck[] {
  const out: AutoCheck[] = []
  const texts = pieceTexts(campaign, piece)
  const filled = texts.map((text) => applyVars(text, campaign.variables))
  const whole = filled.join('\n')

  const missing = [...new Set(texts.flatMap((text) => unresolvedIn(text, campaign.variables)))]
  if (missing.length) out.push({ level: 'block', text: `Còn ${missing.length} biến chưa điền: ${missing.map((key) => `[${key}]`).join(', ')}.` })
  for (const hit of lintText(whole, [])) out.push({ level: 'block', text: `Cụm không được dùng: ${hit.rule}${hit.excerpt ? ` (…${hit.excerpt}…)` : ''}.` })
  const folded = fold(whole)
  for (const phrase of bannedPhrases(campaign.guardrailNotes)) {
    if (folded.includes(fold(phrase))) out.push({ level: 'warn', text: `Chữ đang nói điều thuộc mục "Không được nói": «${phrase}».` })
  }
  if (!piece.caption.trim()) out.push({ level: 'block', text: 'Chưa có caption.' })
  if (!piece.plan.hook.trim()) out.push({ level: 'warn', text: 'Thiếu hook trong kế hoạch.' })
  if (!piece.plan.cta.trim()) out.push({ level: 'info', text: 'Thiếu CTA trong kế hoạch.' })
  if (madeInApp(piece) && slidesOf(campaign, piece).length === 0) out.push({ level: 'warn', text: 'Bài chưa có slide/ảnh nào.' })

  const window = campaignWindow(campaign)
  const year = window?.start.slice(0, 4) ?? String(new Date().getFullYear())
  if (window) {
    const late = [...whole.matchAll(DATE)].map((match) => `${match[3] ?? year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`).filter((iso) => iso > window.end)
    if (late.length) out.push({ level: 'warn', text: `Chữ nhắc ngày ${[...new Set(late)].map((iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`).join(', ')}, sau khi chiến dịch kết thúc.` })
  }

  // Figures: allowed when they appear in the plan, the foundation or the confirmed facts.
  const known = new Set(figuresIn([
    JSON.stringify(piece.plan), JSON.stringify(piece.visual), foundationBrief(campaign), campaign.strategy,
    ...Object.values(campaign.variables), ...campaign.guardrailNotes,
  ].join('\n')).map(digits))
  const unknown = figuresIn(whole).filter((token) => !known.has(digits(token)))
  if (unknown.length) out.push({ level: 'warn', text: `Số liệu chưa thấy trong kế hoạch hoặc dữ kiện đã xác nhận: ${unknown.slice(0, 6).join(', ')}. Kiểm tra nguồn trước khi đăng.` })

  const style = lintCopy(applyVars(piece.caption, campaign.variables), { caption: true }).filter((hit) => hit.level === 'warn')
  const slideText = slidesOf(campaign, piece).flatMap((post) => lintCopy(applyVars([post.eyebrow, post.headline, post.accent, post.subtitle].filter(Boolean).join('. '), campaign.variables)).filter((hit) => hit.level === 'warn'))
  const styleRules = [...new Set([...style, ...slideText].map((hit) => hit.rule))]
  if (styleRules.length) out.push({ level: 'warn', text: `Văn phong cần xem lại (${styleRules.length}): ${styleRules.slice(0, 3).join('; ')}.` })

  for (const issue of pieceIssues(campaign, piece)) {
    if (issue.level === 'warn' && !out.some((item) => item.text.startsWith(issue.text.slice(0, 12)))) out.push({ level: 'warn', text: issue.text })
  }
  if (out.length === 0) out.push({ level: 'ok', text: 'Không thấy vấn đề: biến đã điền, không có cụm cấm, số liệu khớp kế hoạch.' })
  return out
}

export const blockersOf = (checks: AutoCheck[]) => checks.filter((check) => check.level === 'block')

export function snapshotOf(campaign: Campaign, piece: Piece): PieceSnapshot {
  return structuredClone({
    title: piece.title, date: piece.date, plan: piece.plan, visual: piece.visual, caption: piece.caption, hashtags: piece.hashtags,
    checks: piece.checks, posts: allSlidesOf(campaign, piece),
  })
}

/** Keeps the current state of the piece in its history (the same state twice in a row is not added again). */
export function recordVersion(campaign: Campaign, piece: Piece, event: PieceVersionEvent, note = ''): void {
  const snapshot = snapshotOf(campaign, piece)
  const last = piece.history?.at(-1)
  if (last && last.event === event && last.note === note && JSON.stringify(last.snapshot) === JSON.stringify(snapshot)) return
  const version: PieceVersion = { id: newId(), at: now(), event, note, snapshot }
  piece.history = [...(piece.history ?? []), version].slice(-MAX_VERSIONS)
}

/** Puts a saved version back (the current state is saved first); the piece goes back to "copy". */
export function restoreVersion(campaign: Campaign, piece: Piece, versionId: string): boolean {
  const version = piece.history?.find((item) => item.id === versionId)
  if (!version) return false
  recordVersion(campaign, piece, 'restore', 'Trước khi khôi phục một phiên bản cũ')
  const snap = structuredClone(version.snapshot)
  piece.title = snap.title
  piece.date = snap.date
  piece.plan = snap.plan
  piece.visual = snap.visual
  piece.caption = snap.caption
  piece.hashtags = snap.hashtags
  piece.checks = snap.checks
  campaign.posts = [...campaign.posts.filter((post) => post.pieceId !== piece.id), ...snap.posts]
  piece.status = 'copy'
  return true
}

/** What differs between a saved version and the piece now, in a few words each. */
export function diffSummary(campaign: Campaign, piece: Piece, snap: PieceSnapshot): string[] {
  const out: string[] = []
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  if (snap.title !== piece.title) out.push('tên bài')
  if (snap.date !== piece.date) out.push('ngày đăng')
  if (!same(snap.plan, piece.plan)) out.push('kế hoạch/brief')
  if (!same(snap.visual, piece.visual)) out.push('visual brief')
  if (snap.caption !== piece.caption) out.push('caption')
  if (snap.hashtags !== piece.hashtags) out.push('hashtag')
  const current = allSlidesOf(campaign, piece)
  if (snap.posts.length !== current.length) out.push(`số slide (${snap.posts.length} → ${current.length})`)
  else snap.posts.forEach((post, index) => {
    const now = current[index]
    const strip = (item: typeof post) => { const { updatedAt: _unused, ...rest } = item; return rest }
    if (now && !same(strip(post), strip(now))) out.push(`slide ${index + 1}`)
  })
  return out
}
