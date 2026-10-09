import { cardOf, type DocsCard, type DocsImage } from './docsExport.ts'
import { slidesOf } from './pack.ts'
import { renderBlob } from './render.ts'
import { tokensIn } from './text.ts'
import type { Campaign, DocsSync, Piece, Workspace } from './types.ts'

const KEY = 'docs-sync'
const MAX_IMAGES = 12
const IMAGE_WIDTH = 520

/** The link and URL the user typed in an earlier version (kept in the browser): used to prefill a campaign. */
export function loadDocsSync(): { url: string; doc: string } {
  try { return { url: '', doc: '', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { url: '', doc: '' } }
}

/** Accepts a full docs.google.com link or a bare id. */
export function docIdOf(input: string): string {
  return input.match(/\/document\/d\/([\w-]+)/)?.[1] ?? input.trim()
}

const URL_OK = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/
const DOC_OK = /\/document\/d\/[\w-]+|^[\w-]{25,}$/

export const docsSyncReady = (settings: Pick<DocsSync, 'url' | 'doc'>) => URL_OK.test(settings.url.trim()) && DOC_OK.test(settings.doc.trim())

export function emptyDocsSync(prefill?: { url: string; doc: string }): DocsSync {
  return { url: prefill?.url ?? '', doc: prefill?.doc ?? '', auto: true, sent: {} }
}

const hash = (text: string) => {
  let value = 5381
  for (let i = 0; i < text.length; i++) value = ((value << 5) + value + text.charCodeAt(i)) | 0
  return `${(value >>> 0).toString(36)}-${text.length.toString(36)}`
}

/** Fingerprint of everything that shows in the piece's Docs tab: the text rows plus whatever changes how its images look. */
export function pieceSignature(workspace: Workspace, campaign: Campaign, piece: Piece): string {
  const slides = slidesOf(campaign, piece).map(({ updatedAt: _updatedAt, ...rest }) => rest)
  const backgrounds = slides.map((post) => campaign.backgrounds.find((item) => item.id === post.backgroundId)?.assetId ?? null)
  const components = slides.flatMap((post) => post.layers.map((layer) => campaign.components.find((item) => item.id === layer.componentId)?.assetId ?? null))
  const { company } = workspace
  const kv = campaign.keyVisual
  // Only the shared facts this piece actually uses: editing one blank (a discount, a deadline) must not mark every piece as changed.
  const texts = [piece.caption, piece.plan.cta, ...slides.flatMap((post) => [post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.footer])]
  const used = [...new Set(texts.flatMap(tokensIn))].sort().map((key) => [key, campaign.variables[key] ?? ''])
  return hash(JSON.stringify([
    cardOf(campaign, piece),
    slides, backgrounds, components,
    [kv.palette, kv.accentColor, kv.textTone, kv.displayFont, kv.displayFontAssetId, kv.bodyFont],
    // The default footer is not listed: every slide already carries its own footer text.
    [company.name, company.logoId, company.logoDarkId, company.logoHeight],
    used,
  ]))
}

/** Downsizes a rendered slide to a small JPEG: a Docs tab does not need 1080px, and the upload stays light. */
async function shrink(blob: Blob): Promise<Pick<DocsImage, 'data' | 'w' | 'h'>> {
  const bitmap = await createImageBitmap(blob)
  const ratio = Math.min(1, IMAGE_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], w: canvas.width, h: canvas.height }
}

/** The tab for one piece: its text rows and its images (finished slides, or the scenes of a reel made in the app). */
export async function buildCard(workspace: Workspace, campaign: Campaign, piece: Piece): Promise<DocsCard> {
  const card = cardOf(campaign, piece)
  const slides = slidesOf(campaign, piece)
  const images: DocsImage[] = []
  for (const [index, post] of slides.slice(0, MAX_IMAGES).entries()) {
    const caption = piece.kind === 'reel' ? `Cảnh ${index + 1} · ${post.duration ?? 3}s` : `${index + 1}/${slides.length}`
    images.push({ name: `${piece.code}-${index + 1}`, caption, ...(await shrink(await renderBlob(post, campaign, workspace))) })
  }
  const imagesTitle = images.length === 0 ? '' : piece.kind === 'reel' ? `Reel · ${slides.length} cảnh (bản MP4 xuất từ trang bài)` : `Ảnh hoàn chỉnh (${slides.length})${slides.length > MAX_IMAGES ? ` · hiện ${MAX_IMAGES} ảnh đầu` : ''}`
  return { ...card, imagesTitle, images }
}

export type SyncResult = { ok?: boolean; created?: number; updated?: number; warnings?: string[]; error?: string }

/** Sends one piece to the Apps Script web app, which rebuilds that piece's tab. */
export async function pushPiece(settings: Pick<DocsSync, 'url' | 'doc'>, workspace: Workspace, campaign: Campaign, piece: Piece): Promise<SyncResult> {
  if (!URL_OK.test(settings.url.trim())) throw new Error('Ô thứ hai cần URL ứng dụng web dạng https://script.google.com/macros/s/…/exec (Apps Script → Triển khai → Quản lý bản triển khai → Ứng dụng web), không phải link trang soạn code.')
  if (!DOC_OK.test(settings.doc.trim())) throw new Error('Ô thứ nhất cần link Google Docs dạng https://docs.google.com/document/d/…')
  const card = await buildCard(workspace, campaign, piece)
  // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer.
  const response = await fetch(settings.url.trim(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ doc: docIdOf(settings.doc), campaign: campaign.name, cards: [card] }) })
  if (!response.ok) throw new Error(`Máy chủ Apps Script trả về ${response.status}`)
  const result = (await response.json()) as SyncResult
  if (result.error) throw new Error(result.error)
  return result
}
