import { api } from './api.ts'
import { applyMotifs, compositeMode, type FreeBand } from './motifs.ts'
import { buildBackgroundPrompt, generationRefs, type Zones } from './prompt.ts'
import { drawCover, loadImage, renderPost, type LayoutInfo } from './render.ts'
import { applyLayouts, planLayouts, type LayoutPatch } from './autoLayout.ts'
import { slidesOf } from './pack.ts'
import { formatKeyOf } from './plan.ts'
import { formatOf, newId } from './types.ts'
import type { Campaign, FormatKey, Piece, Post, Workspace } from './types.ts'

const MARGIN_FRACTION = 0.03

/** Measures the real layout of each slide and merges them: the text band is the union, the free band is what is left. */
export async function measureZones(workspace: Workspace, campaign: Campaign, slides: Post[]): Promise<Zones> {
  const canvas = document.createElement('canvas')
  const layouts: LayoutInfo[] = []
  for (const slide of slides) {
    const layout: Partial<LayoutInfo> = {}
    // No parts: only the layout is worked out, nothing is drawn.
    await renderPost(canvas, slide, campaign, workspace, { parts: [], layoutOut: layout })
    layouts.push(layout as LayoutInfo)
  }
  const height = layouts[0]?.height ?? 1350
  const frac = (value: number) => Math.min(1, Math.max(0, value / height))
  const textTop = frac(Math.min(...layouts.map((layout) => layout.textTop)))
  const textBottom = frac(Math.max(...layouts.map((layout) => layout.textBottom)))
  const lowers = layouts.flatMap((layout) => [layout.ctaTop, layout.footerTop, layout.heroTop]).filter((value): value is number => value !== null && value !== undefined)
  const lower = lowers.length > 0 ? frac(Math.min(...lowers)) : 0.95
  const logoBottom = frac(Math.max(...layouts.map((layout) => layout.logoBottom)))
  const from = Math.min(0.9, textBottom + MARGIN_FRACTION)
  const to = Math.max(from, lower - MARGIN_FRACTION)
  return { logoBottom, textTop, textBottom, lower, freeFrom: from, freeTo: to }
}

export type PlateCheck = { ok: boolean; mean: number; spread: number; seam: number }

/** How bright and how busy the generated picture is exactly where the text will sit. */
export async function plateQuality(assetId: string, zones: Zones, format: FormatKey, lightText: boolean): Promise<PlateCheck | null> {
  const image = await loadImage(assetId)
  if (!image) return null
  const { width, height } = formatOf(format)
  const scale = 100 / width
  const canvas = document.createElement('canvas')
  canvas.width = 100
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  drawCover(ctx, image, canvas.width, canvas.height)
  const y0 = Math.floor(canvas.height * zones.textTop)
  const y1 = Math.max(y0 + 1, Math.ceil(canvas.height * zones.textBottom))
  const x0 = Math.floor(canvas.width * 0.05)
  const data = ctx.getImageData(x0, y0, Math.floor(canvas.width * 0.9), y1 - y0).data
  let sum = 0
  let sumSquares = 0
  const count = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
    sum += luminance
    sumSquares += luminance * luminance
  }
  const mean = sum / count
  const spread = Math.sqrt(Math.max(0, sumSquares / count - mean * mean))
  // A "seam": the average brightness of the sky jumps between two neighbouring rows, which is how flat bands and hard steps look.
  const rows: number[] = []
  const skyRows = Math.max(3, Math.floor(canvas.height * Math.min(0.6, zones.freeFrom)))
  const sky = ctx.getImageData(0, 0, canvas.width, skyRows).data
  for (let row = 0; row < skyRows; row++) {
    let total = 0
    for (let x = 0; x < canvas.width; x++) { const i = (row * canvas.width + x) * 4; total += (0.2126 * sky[i] + 0.7152 * sky[i + 1] + 0.0722 * sky[i + 2]) / 255 }
    rows.push(total / canvas.width)
  }
  let seam = 0
  for (let row = 1; row < rows.length; row++) seam = Math.max(seam, Math.abs(rows[row] - rows[row - 1]))
  const ok = (lightText ? mean <= 0.4 && spread <= 0.16 : mean >= 0.6 && spread <= 0.16) && seam <= 0.045
  return { ok, mean, spread, seam }
}

export type PlateResult = { assetId: string; format: FormatKey; label: string; warning?: string; zones: Zones }

/**
 * Makes the background for a piece (or for one slide) after measuring where its text goes.
 * The result is checked at the text band; one retry is made with that finding spelled out.
 */
export async function generatePlate(workspace: Workspace, campaign: Campaign, piece: Piece, keyId?: string, onlyPostId?: string): Promise<PlateResult> {
  const all = slidesOf(campaign, piece)
  const picked = onlyPostId ? all.filter((post) => post.id === onlyPostId) : all
  // Slides whose photo fills the whole frame have no use for a generated background.
  const slides = picked.filter((post) => post.hero?.layout !== 'full')
  if (picked.length > 0 && slides.length === 0) throw new Error('Các slide này dùng ảnh chủ đạo toàn khung nên không cần nền AI.')
  if (slides.length === 0) throw new Error('Bài này chưa có slide. Tạo slide (bước 1 hoặc "Tạo lại từ kế hoạch") rồi mới tạo ảnh.')
  if (!campaign.keyVisual.concept.trim()) throw new Error('Chưa có "Mô tả không khí". Điền ở tab Moodboard (hoặc bấm "AI đọc moodboard").')
  const format = slides[0].format ?? formatKeyOf(piece.visual.format)
  const [width, height] = formatOf(format).generate
  const zones = await measureZones(workspace, campaign, slides)
  const lightText = campaign.keyVisual.textTone === 'light'
  // The palette belongs to the campaign's Moodboard: a per-piece palette note from the plan must not compete with it.
  const variation = [piece.visual.hero, piece.visual.avoid && `Tránh: ${piece.visual.avoid}`].filter(Boolean).join('. ')
  const refs = generationRefs(campaign.keyVisual, compositeMode(campaign))

  const make = (extra: string) => api.generate({ prompt: buildBackgroundPrompt(workspace, campaign, format, [variation, extra].filter(Boolean).join(' '), zones), width, height, quality: 'high', referenceIds: refs, keyId })
  let assetId = await make('')
  let check = await plateQuality(assetId, zones, format, lightText)
  let warning: string | undefined
  if (check && !check.ok) {
    const seamNote = check.seam > 0.045 ? ' It also had a visible horizontal band or step in the sky: make the sky one smooth continuous gradient with no seam.' : ''
    const finding = lightText
      ? `Previous attempt was ${check.mean > 0.4 ? 'too bright' : 'too busy'} in the text band (brightness ${Math.round(check.mean * 100)}%, contrast ${Math.round(check.spread * 100)}%). Make the text band much darker and smoother, and move every bright or detailed element lower, into the free band only.${seamNote}`
      : `Previous attempt was ${check.mean < 0.6 ? 'too dark' : 'too busy'} in the text band (brightness ${Math.round(check.mean * 100)}%, contrast ${Math.round(check.spread * 100)}%). Make the text band much lighter and smoother, and move every dark or detailed element lower, into the free band only.${seamNote}`
    const retry = await make(finding)
    const retryCheck = await plateQuality(retry, zones, format, lightText)
    // Lower is better: how far the text band is from calm and dark (light text) or calm and light (dark text).
    const badness = (item: PlateCheck) => (lightText ? item.mean : 1 - item.mean) + item.spread + item.seam * 3
    if (retryCheck && (retryCheck.ok || badness(retryCheck) < badness(check))) {
      void api.deleteAsset(assetId)
      assetId = retry
      check = retryCheck
    } else void api.deleteAsset(retry)
    if (check && !check.ok) warning = 'Nền vẫn hơi sáng, nhiều chi tiết hoặc có vệt ngang ở phần trời. App đã tự chọn lại vị trí chữ; nếu chưa vừa ý, bấm "Nền riêng" ở slide đó.'
  }
  const label = onlyPostId ? `${piece.code} · ${slides[0].name}` : `${piece.code} · ${piece.title.slice(0, 28)}`
  return { assetId, format, label, warning, zones }
}

/** Saves a generated background and uses it on the given slides (default: all slides of the piece in the same format). */
export function attachPlate(campaign: Campaign, pieceId: string, result: Pick<PlateResult, 'assetId' | 'format' | 'label'>, onlyPostId?: string): void {
  const id = newId()
  campaign.backgrounds.push({ id, assetId: result.assetId, format: result.format, label: result.label })
  campaign.posts
    .filter((post) => post.pieceId === pieceId && !post.excluded && post.format === result.format && (!onlyPostId || post.id === onlyPostId))
    .forEach((post) => { post.backgroundId = id })
}

/**
 * What the pieces' slides look like with a new plate: layouts are chosen on a copy that already has the plate,
 * so the caller can attach the plate and the layouts in one edit.
 */
export async function layoutWithPlate(workspace: Workspace, campaign: Campaign, piece: Piece, result: Pick<PlateResult, 'assetId' | 'format' | 'label'>, onlyPostId?: string): Promise<Map<string, LayoutPatch>> {
  const preview = structuredClone(campaign)
  attachPlate(preview, piece.id, result, onlyPostId)
  const slides = slidesOf(preview, piece).filter((post) => !onlyPostId || post.id === onlyPostId)
  // A single replaced slide is judged against the whole set, so its crop matches its neighbours.
  const all = onlyPostId ? slidesOf(preview, piece) : slides
  const patches = await planLayouts(workspace, preview, all)
  if (onlyPostId) for (const id of [...patches.keys()]) if (id !== onlyPostId) patches.delete(id)
  return patches
}

/**
 * The free band (room the text leaves) of a piece's slides, measured on a copy that already has the new plate and layouts,
 * so the brand graphics are placed where the text will really be.
 */
export async function motifBand(workspace: Workspace, campaign: Campaign, piece: Piece, change?: { result: Pick<PlateResult, 'assetId' | 'format' | 'label'>; patches: Map<string, LayoutPatch>; onlyPostId?: string }): Promise<FreeBand> {
  const preview = structuredClone(campaign)
  if (change) { attachPlate(preview, piece.id, change.result, change.onlyPostId); applyLayouts(preview, change.patches) }
  const zones = await measureZones(workspace, preview, slidesOf(preview, piece).filter((post) => post.hero?.layout !== 'full'))
  return { freeFrom: zones.freeFrom, freeTo: zones.freeTo }
}

export { applyLayouts, applyMotifs, compositeMode }
