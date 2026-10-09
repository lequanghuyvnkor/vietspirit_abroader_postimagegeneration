import { draftSlides, madeInApp, parsePlan, type ParsedPlan } from './plan.ts'
import type { Campaign, Check, Company, Piece, SheetConflict, SheetSync } from './types.ts'
import type { Sheets } from './xlsx.ts'

const URL_OK = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/

export function emptySheetSync(): SheetSync {
  return { url: '', token: '', auto: true, hash: '', pulledAt: '', conflicts: [] }
}

export const sheetSyncReady = (settings: Pick<SheetSync, 'url' | 'token'>) => URL_OK.test(settings.url.trim()) && settings.token.trim().length > 0

/** The Sheet is connected and still owns the plan (not frozen). */
export const sheetOwnsPlan = (settings: SheetSync | undefined) => Boolean(settings && sheetSyncReady(settings) && !settings.frozen)

/** A short code works, but anyone who learns the URL could guess it. */
export const tokenIsShort = (token: string) => token.trim().length > 0 && token.trim().length < 8

/** What is wrong with the pasted URL, in words the user can act on. */
export function sheetUrlProblem(url: string): string {
  const value = url.trim()
  if (!value || URL_OK.test(value)) return ''
  if (/docs\.google\.com\/spreadsheets/.test(value)) return 'Đây là link của Google Sheet. Cần URL ứng dụng web của Apps Script (kết thúc bằng /exec): Sheet → Tiện ích mở rộng → Apps Script → Triển khai.'
  if (/script\.google\.com\/.*\/(edit|projects|home)/.test(value)) return 'Đây là link trang soạn code. Cần URL ứng dụng web: Triển khai → Quản lý bản triển khai → Ứng dụng web → URL (kết thúc bằng /exec).'
  return 'URL cần có dạng https://script.google.com/macros/s/…/exec'
}

async function call(settings: Pick<SheetSync, 'url' | 'token'>, extra: string): Promise<Record<string, unknown>> {
  if (!sheetSyncReady(settings)) throw new Error('Cần URL ứng dụng web Apps Script và mã bí mật (đúng mã đã đặt trong script).')
  const response = await fetch(`${settings.url.trim()}?token=${encodeURIComponent(settings.token.trim())}${extra}`)
  if (!response.ok) throw new Error(`Apps Script trả về ${response.status}`)
  const data = (await response.json()) as Record<string, unknown>
  if (data.error === 'forbidden') throw new Error('Mã bí mật không khớp với mã trong script của Sheet (hoặc script chưa đặt mã).')
  if (typeof data.error === 'string') throw new Error(data.error)
  return data
}

/** A short fingerprint of the whole plan, to learn cheaply whether the Sheet changed. */
export async function checkSheet(settings: Pick<SheetSync, 'url' | 'token'>): Promise<string> {
  return String((await call(settings, '&check=1')).hash ?? '')
}

export async function readSheet(settings: Pick<SheetSync, 'url' | 'token'>): Promise<{ hash: string; plan: ParsedPlan }> {
  const data = await call(settings, '')
  const sheets = data.sheets as Sheets | undefined
  if (!sheets || typeof sheets !== 'object') throw new Error('Script không trả về các tab của Sheet. Kiểm tra lại script và bản triển khai.')
  return { hash: String(data.hash ?? ''), plan: parsePlan(sheets) }
}

export type MergeReport = { added: string[]; updated: string[]; missing: string[]; conflicts: SheetConflict[] }

type Synced = SheetConflict['field']
const FIELDS: Synced[] = ['caption', 'hashtags', 'date', 'time']
const read = (piece: Piece, field: Synced): string => (field === 'time' ? piece.plan.time : piece[field])
const write = (piece: Piece, field: Synced, value: string) => { if (field === 'time') piece.plan.time = value; else piece[field] = value }

/**
 * Brings the Sheet's plan into the campaign without losing work done here.
 * The Sheet owns the plan (title, funnel, hook, structure, visual brief, checklist, strategy).
 * Fields the app also edits (caption, hashtags, date, time) follow the Sheet only when the Sheet changed and the app did not;
 * when both changed, the app's text is kept and the Sheet's text is offered as a conflict.
 * Status, slides, uploaded photos and who produces a piece belong to the app and are never touched.
 */
export function mergePlan(campaign: Campaign, plan: ParsedPlan, company: Company, options: { makeSlides: boolean }): MergeReport {
  const report: MergeReport = { added: [], updated: [], missing: [], conflicts: [] }
  campaign.strategy = plan.strategy
  campaign.guardrailNotes = plan.guardrailNotes

  for (const parsed of plan.pieces) {
    const existing = campaign.pieces.find((piece) => piece.code === parsed.code)
    if (!existing) {
      parsed.sheetBase = { caption: parsed.caption, hashtags: parsed.hashtags, date: parsed.date, time: parsed.plan.time, linked: true, assets: parsed.assets.map((asset) => asset.label) }
      campaign.pieces.push(parsed)
      if (options.makeSlides) campaign.posts.push(...draftSlides(parsed, company, campaign.backgrounds))
      report.added.push(parsed.code)
      continue
    }

    const before = JSON.stringify([existing.title, existing.kind, existing.plan, existing.visual, existing.compliance, existing.assets.map((asset) => asset.label), existing.checks.map((check) => check.text), ...FIELDS.map((field) => read(existing, field))])
    existing.sheetBase ??= { caption: '', hashtags: '', date: '', time: '' }

    existing.title = parsed.title
    existing.kind = parsed.kind
    existing.compliance = parsed.compliance
    const time = existing.plan.time
    existing.plan = { ...parsed.plan, time }
    existing.visual = { ...parsed.visual }

    // The list of materials belongs to the app once a piece is linked (items get renamed, removed, filled with photos here).
    // The Sheet can only add items that were not in it at the last pull.
    const knownLabels = existing.sheetBase.assets
    if (knownLabels) for (const asset of parsed.assets) if (!knownLabels.includes(asset.label) && !existing.assets.some((old) => old.label === asset.label)) existing.assets.push(asset)
    existing.sheetBase.assets = parsed.assets.map((asset) => asset.label)
    // Checklist: items ticked in the app stay ticked.
    existing.checks = parsed.checks.map((check): Check => { const old = existing.checks.find((item) => item.text === check.text); return old ? { ...check, id: old.id, done: old.done } : check })

    for (const field of FIELDS) {
      const fromSheet = read(parsed, field)
      const base = existing.sheetBase[field]
      const current = read(existing, field)
      const linked = existing.sheetBase.linked === true
      if (!linked) {
        // First time this piece meets the Sheet: equal or empty text is simply adopted; different text is the app's work.
        if (current === fromSheet || !current.trim()) write(existing, field, fromSheet)
        else report.conflicts.push({ code: existing.code, field, sheetValue: fromSheet })
      } else if (fromSheet !== base) {
        if (current === base) write(existing, field, fromSheet)
        else if (current !== fromSheet) report.conflicts.push({ code: existing.code, field, sheetValue: fromSheet })
      }
      existing.sheetBase[field] = fromSheet
    }
    existing.sheetBase.linked = true

    // A piece that has just become one this app makes (a reel with people turned into a photo, say) has no slides yet.
    if (madeInApp(existing) && options.makeSlides && !campaign.posts.some((post) => post.pieceId === existing.id)) {
      campaign.posts.push(...draftSlides(existing, company, campaign.backgrounds))
      if (!report.updated.includes(existing.code)) report.updated.push(existing.code)
    }

    const after = JSON.stringify([existing.title, existing.kind, existing.plan, existing.visual, existing.compliance, existing.assets.map((asset) => asset.label), existing.checks.map((check) => check.text), ...FIELDS.map((field) => read(existing, field))])
    if (after !== before) report.updated.push(existing.code)
  }

  report.missing = campaign.pieces.filter((piece) => !plan.pieces.some((parsed) => parsed.code === piece.code)).map((piece) => piece.code)
  return report
}

/** A line the user can read: what the pull did. */
export function describeReport(report: MergeReport): string {
  const done = [
    report.added.length ? `thêm ${report.added.length} bài (${report.added.join(', ')})` : '',
    report.updated.length ? `cập nhật ${report.updated.length} bài (${report.updated.join(', ')})` : '',
  ].filter(Boolean)
  const notes = [
    report.conflicts.length ? `${report.conflicts.length} chỗ khác nhau giữa Sheet và app, giữ bản trong app` : '',
    report.missing.length ? `${report.missing.length} bài không còn trong Sheet (${report.missing.join(', ')}), vẫn giữ trong app` : '',
  ].filter(Boolean)
  const sentences = [done.length ? `Đã ${done.join('; ')}` : '', ...notes].filter(Boolean)
  return sentences.length ? `${sentences.join('. ')}.` : 'Sheet và app đã khớp, không có gì mới.'
}

/** Takes the Sheet's text for one field (resolving a conflict in the Sheet's favour). */
export function takeSheetValue(campaign: Campaign, conflict: SheetConflict): void {
  const piece = campaign.pieces.find((item) => item.code === conflict.code)
  if (piece) write(piece, conflict.field, conflict.sheetValue)
}

