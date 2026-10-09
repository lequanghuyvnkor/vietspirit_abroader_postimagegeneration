import { lintCopy } from './copyCraft.ts'
import { campaignWindow, foundationBrief } from './foundation.ts'
import { allSlidesOf, slidesOf } from './pack.ts'
import { madeInApp, pieceTexts } from './plan.ts'
import { pieceIssues } from './planCheck.ts'
import { fingerprint } from './document.ts'
import { applyVars, lintText, unresolvedIn } from './text.ts'
import { newId, now } from './types.ts'
import type { Campaign, Piece, PieceSnapshot, PieceVersion, PieceVersionEvent, Store, Workspace } from './types.ts'

const MAX_VERSIONS = 20

/** Everything a reviewer approves (text, dates, slide content and pictures), but not status or ticks: editing any of it voids an approval. */
export function contentFingerprint(campaign: Campaign, piece: Piece): string {
  const posts = allSlidesOf(campaign, piece).map((post) => { const { updatedAt: _unused, ...rest } = post; return rest })
  return fingerprint(JSON.stringify([piece.title, piece.date, piece.plan, piece.visual, piece.caption, piece.hashtags, piece.compliance, piece.checks.map((check) => check.text), posts]))
}

export type AutoCheck = { text: string; level: 'block' | 'warn' | 'info' | 'ok' }

const NUMBER = /\d[\d.,]*\d|\d/g
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

/** Fact check without AI: variables, forbidden phrases, dates outside the campaign, and figures that appear nowhere in the plan. */
export function autoChecks(campaign: Campaign, piece: Piece): AutoCheck[] {
  const out: AutoCheck[] = []
  const texts = pieceTexts(campaign, piece)
  const filled = texts.map((text) => applyVars(text, campaign.variables))
  const whole = filled.join('\n')

  const missing = [...new Set(texts.flatMap((text) => unresolvedIn(text, campaign.variables)))]
  if (missing.length) out.push({ level: 'block', text: `Còn ${missing.length} biến chưa điền: ${missing.map((key) => `[${key}]`).join(', ')}.` })
  const banned = lintText(whole, campaign.guardrails)
  for (const hit of banned) out.push({ level: 'block', text: `Cụm không được dùng: ${hit.rule}${hit.excerpt ? ` (…${hit.excerpt}…)` : ''}.` })
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
  if (unknown.length) out.push({ level: 'warn', text: `Số liệu chưa thấy trong kế hoạch hoặc dữ kiện đã xác nhận: ${unknown.slice(0, 6).join(', ')}. Kiểm tra nguồn trước khi duyệt.` })

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
    compliance: piece.compliance, checks: piece.checks, posts: allSlidesOf(campaign, piece),
  })
}

/** Keeps the current state of the piece in its history. */
export function recordVersion(campaign: Campaign, piece: Piece, event: PieceVersionEvent, note = ''): void {
  const snapshot = snapshotOf(campaign, piece)
  const last = piece.history?.at(-1)
  // Pressing the same button twice without a change adds nothing to the history.
  if (last && last.event === event && last.note === note && JSON.stringify(last.snapshot) === JSON.stringify(snapshot)) return
  const version: PieceVersion = { id: newId(), at: now(), event, note, snapshot }
  piece.history = [...(piece.history ?? []), version].slice(-MAX_VERSIONS)
}

/** Puts a saved version back (the current state is saved first); the piece goes back to "copy" for a new review. */
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
  piece.compliance = snap.compliance
  piece.checks = snap.checks
  campaign.posts = [...campaign.posts.filter((post) => post.pieceId !== piece.id), ...snap.posts]
  piece.status = 'copy'
  delete piece.approval
  return true
}

export function submitForReview(campaign: Campaign, piece: Piece): void {
  piece.status = 'review'
  delete piece.reviewNote
  recordVersion(campaign, piece, 'submitted')
}

export function approvePiece(campaign: Campaign, piece: Piece, note: string): void {
  piece.status = 'ready'
  piece.approval = { at: now(), fingerprint: contentFingerprint(campaign, piece), note }
  delete piece.reviewNote
  recordVersion(campaign, piece, 'approved', note)
}

export function requestChanges(campaign: Campaign, piece: Piece, note: string): void {
  piece.status = 'copy'
  piece.reviewNote = note
  delete piece.approval
  recordVersion(campaign, piece, 'changes', note)
}

export function reopenPiece(campaign: Campaign, piece: Piece): void {
  piece.status = 'copy'
  delete piece.approval
  recordVersion(campaign, piece, 'reopened')
}

/** An approved piece whose content changed no longer matches what was approved: back to review, with the change kept in history. */
export function revokeStaleApprovals(campaign: Campaign): string[] {
  const revoked: string[] = []
  for (const piece of campaign.pieces) {
    if (piece.status !== 'ready' || !piece.approval || piece.approval.fingerprint === contentFingerprint(campaign, piece)) continue
    piece.status = 'review'
    delete piece.approval
    piece.reviewNote = 'Đã sửa sau khi được duyệt: cần duyệt lại.'
    recordVersion(campaign, piece, 'edited', 'Sửa sau khi đã duyệt')
    revoked.push(piece.code)
  }
  return revoked
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
  const now = allSlidesOf(campaign, piece)
  if (snap.posts.length !== now.length) out.push(`số slide (${snap.posts.length} → ${now.length})`)
  else snap.posts.forEach((post, index) => {
    const current = now[index]
    const strip = (item: typeof post) => { const { updatedAt: _unused, ...rest } = item; return rest }
    if (current && !same(strip(post), strip(current))) out.push(`slide ${index + 1}`)
  })
  return out
}

export type ReviewEntry = { workspace: Workspace; campaign: Campaign; piece: Piece }

/** Pieces waiting for brand approval across every campaign, soonest publish date first. */
export const reviewQueue = (store: Store): ReviewEntry[] =>
  store.workspaces.flatMap((workspace) => workspace.campaigns.flatMap((campaign) => campaign.pieces.filter((piece) => piece.status === 'review').map((piece) => ({ workspace, campaign, piece }))))
    .sort((a, b) => (a.piece.date || '9999').localeCompare(b.piece.date || '9999'))
