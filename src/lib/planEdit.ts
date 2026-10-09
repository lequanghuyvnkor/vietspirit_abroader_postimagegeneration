import { defaultProductionNote, draftSlides, madeInApp } from './plan.ts'
import { newId } from './types.ts'
import type { Campaign, Company, Piece, PieceKind } from './types.ts'

export const FUNNELS = ['TOFU', 'MOFU', 'BOFU']

/** The plan's format line for a kind, used when the user switches kind and the old text no longer fits. */
export const DEFAULT_FORMAT: Record<PieceKind, string> = { static: 'Ảnh đơn (1080×1350)', carousel: 'Carousel 6 slides', reel: 'Reel 30s' }

export function emptyPiece(code: string, kind: PieceKind = 'static'): Piece {
  return {
    id: newId(), code, title: '', kind, date: '', status: 'brief',
    plan: { funnel: '', pillar: '', format: DEFAULT_FORMAT[kind], goal: '', hook: '', structure: '', cta: '', audience: '', kpi: '', paid: '', conditions: '', story: '', time: '' },
    visual: { format: '', hero: '', layout: '', typography: '', palette: '', onImage: '', motion: '', assets: '', avoid: '' },
    caption: '', hashtags: '', compliance: '', checks: [], assets: [], production: 'internal', productionNote: '',
  }
}

/** Next free code: P + (highest number in use + 1), two digits at least. */
export function nextCode(pieces: Piece[], taken: string[] = []): string {
  const numbers = [...pieces.map((piece) => piece.code), ...taken].map((code) => Number(code.match(/^P(\d+)$/i)?.[1] ?? 0))
  return `P${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`
}

export const codeIsTaken = (campaign: Campaign, piece: Piece): boolean =>
  !piece.code.trim() || campaign.pieces.some((other) => other.id !== piece.id && other.code.trim().toLowerCase() === piece.code.trim().toLowerCase())

/** Switches kind and fixes the format line so the plan and the kind agree (the kind is read from that line when a Sheet is pulled). */
export function setKind(piece: Piece, kind: PieceKind): void {
  piece.kind = kind
  piece.plan.format = DEFAULT_FORMAT[kind]
  piece.production = kind === 'reel' ? piece.production : 'internal'
  if (kind !== 'reel') piece.productionNote = ''
  else if (!piece.productionNote) piece.productionNote = defaultProductionNote(piece.production)
}

export function addPiece(campaign: Campaign, piece: Piece, afterId?: string): void {
  const at = afterId ? campaign.pieces.findIndex((item) => item.id === afterId) : -1
  campaign.pieces.splice(at >= 0 ? at + 1 : campaign.pieces.length, 0, piece)
}

/** A copy that starts again: same plan and caption, no date, no slides, nothing ticked, no photos. */
export function duplicatePiece(campaign: Campaign, id: string): Piece | null {
  const source = campaign.pieces.find((piece) => piece.id === id)
  if (!source) return null
  const copy: Piece = structuredClone(source)
  copy.id = newId()
  copy.code = nextCode(campaign.pieces)
  copy.title = `${source.title} (bản sao)`
  copy.date = ''
  copy.status = 'brief'
  copy.checks = copy.checks.map((check) => ({ ...check, id: newId(), done: false }))
  copy.assets = copy.assets.map((asset) => ({ ...asset, id: newId(), assetId: null, done: false }))
  delete copy.sheetBase
  delete copy.approval
  delete copy.reviewNote
  delete copy.history
  delete copy.published
  delete copy.metrics
  addPiece(campaign, copy, id)
  return copy
}

/** Removes a piece with its slides (and their revisions). Uploaded images stay in the backup/trash like any other file. */
export function removePiece(campaign: Campaign, id: string): void {
  campaign.posts = campaign.posts.filter((post) => post.pieceId !== id)
  campaign.pieces = campaign.pieces.filter((piece) => piece.id !== id)
}

export function movePiece(campaign: Campaign, id: string, delta: -1 | 1): void {
  const from = campaign.pieces.findIndex((piece) => piece.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= campaign.pieces.length) return
  const [moved] = campaign.pieces.splice(from, 1)
  campaign.pieces.splice(to, 0, moved)
}

/** Dated pieces by date (then time); undated pieces keep their order at the end. */
export function sortByDate(campaign: Campaign): void {
  const key = (piece: Piece) => `${piece.date || '9999'} ${piece.plan.time}`
  campaign.pieces = campaign.pieces.map((piece, index) => ({ piece, index })).sort((a, b) => key(a.piece).localeCompare(key(b.piece)) || a.index - b.index).map((entry) => entry.piece)
}

/** First-draft slides for every piece made in the app that has none yet; returns how many pieces got slides. */
export function draftMissingSlides(campaign: Campaign, company: Company): number {
  let count = 0
  for (const piece of campaign.pieces) {
    if (!madeInApp(piece) || campaign.posts.some((post) => post.pieceId === piece.id)) continue
    campaign.posts.push(...draftSlides(piece, company, campaign.backgrounds))
    count += 1
  }
  return count
}
