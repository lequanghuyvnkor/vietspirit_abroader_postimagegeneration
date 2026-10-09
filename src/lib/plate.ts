import { api } from './api.ts'
import { buildBackgroundPrompt, generationRefs, type Zones } from './prompt.ts'
import { drawCover, loadImage, renderPost, type LayoutInfo } from './render.ts'
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
  const lowers = layouts.flatMap((layout) => [layout.ctaTop, layout.footerTop]).filter((value): value is number => value !== null)
  const lower = lowers.length > 0 ? frac(Math.min(...lowers)) : 0.95
  const logoBottom = frac(Math.max(...layouts.map((layout) => layout.logoBottom)))
  const from = Math.min(0.9, textBottom + MARGIN_FRACTION)
  const to = Math.max(from, lower - MARGIN_FRACTION)
  return { logoBottom, textTop, textBottom, lower, freeFrom: from, freeTo: to }
}

export type PlateCheck = { ok: boolean; mean: number; spread: number }

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
  const ok = lightText ? mean <= 0.4 && spread <= 0.16 : mean >= 0.6 && spread <= 0.16
  return { ok, mean, spread }
}

export type PlateResult = { assetId: string; format: FormatKey; label: string; warning?: string; zones: Zones }

/**
 * Makes the background for a piece (or for one slide) after measuring where its text goes.
 * The result is checked at the text band; one retry is made with that finding spelled out.
 */
export async function generatePlate(workspace: Workspace, campaign: Campaign, piece: Piece, keyId?: string, onlyPostId?: string): Promise<PlateResult> {
  const all = slidesOf(campaign, piece)
  const slides = onlyPostId ? all.filter((post) => post.id === onlyPostId) : all
  if (slides.length === 0) throw new Error('Bài này chưa có slide. Tạo slide (bước 1 hoặc "Tạo lại từ kế hoạch") rồi mới tạo ảnh.')
  if (!campaign.keyVisual.concept.trim()) throw new Error('Chưa có "Mô tả không khí". Điền ở tab Moodboard (hoặc bấm "AI đọc moodboard").')
  const format = slides[0].format ?? formatKeyOf(piece.visual.format)
  const [width, height] = formatOf(format).generate
  const zones = await measureZones(workspace, campaign, slides)
  const lightText = campaign.keyVisual.textTone === 'light'
  const variation = [piece.visual.hero, piece.visual.palette && `Palette: ${piece.visual.palette}`, piece.visual.avoid && `Tránh: ${piece.visual.avoid}`].filter(Boolean).join('. ')
  const refs = generationRefs(campaign.keyVisual)

  const make = (extra: string) => api.generate({ prompt: buildBackgroundPrompt(workspace, campaign, format, [variation, extra].filter(Boolean).join(' '), zones), width, height, quality: 'high', referenceIds: refs, keyId })
  let assetId = await make('')
  let check = await plateQuality(assetId, zones, format, lightText)
  let warning: string | undefined
  if (check && !check.ok) {
    const finding = lightText
      ? `Previous attempt was ${check.mean > 0.4 ? 'too bright' : 'too busy'} in the text band (brightness ${Math.round(check.mean * 100)}%, contrast ${Math.round(check.spread * 100)}%). Make the text band much darker and smoother, and move every bright or detailed element lower, into the free band only.`
      : `Previous attempt was ${check.mean < 0.6 ? 'too dark' : 'too busy'} in the text band (brightness ${Math.round(check.mean * 100)}%, contrast ${Math.round(check.spread * 100)}%). Make the text band much lighter and smoother, and move every dark or detailed element lower, into the free band only.`
    const retry = await make(finding)
    const retryCheck = await plateQuality(retry, zones, format, lightText)
    // Lower is better: how far the text band is from calm and dark (light text) or calm and light (dark text).
    const badness = (item: PlateCheck) => (lightText ? item.mean : 1 - item.mean) + item.spread
    if (retryCheck && (retryCheck.ok || badness(retryCheck) < badness(check))) {
      void api.deleteAsset(assetId)
      assetId = retry
      check = retryCheck
    } else void api.deleteAsset(retry)
    if (check && !check.ok) warning = 'Vùng chữ vẫn hơi sáng hoặc nhiều chi tiết; app sẽ làm dịu vùng đó khi vẽ chữ. Nếu chữ khó đọc, bấm "Tạo lại nền slide này".'
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
