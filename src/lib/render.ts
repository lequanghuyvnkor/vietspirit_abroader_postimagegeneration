import { assetUrl } from './api.ts'
import { applyVars } from './text.ts'
import { contentBox, removeBackground } from './cutout.ts'
import { formatOf, type Campaign, type Post, type Workspace } from './types.ts'

const MARGIN = 64
const STORY_SAFE = 250
const loadedFonts = new Set<string>()
const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

export function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
}

function contrastColor(hex: string): string {
  const value = parseInt(hex.slice(1), 16)
  const luminance = (0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255
  return luminance > 0.6 ? '#111111' : '#ffffff'
}

export async function ensureFont(family: string, assetId: string | null): Promise<void> {
  const name = family.trim()
  if (!name) return
  const key = `${name}|${assetId ?? ''}`
  if (!loadedFonts.has(key)) {
    loadedFonts.add(key)
    try {
      if (assetId) {
        const face = new FontFace(name, `url(${assetUrl(assetId)})`)
        document.fonts.add(await face.load())
      } else {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@300;400;500;600;700;800&display=swap`
        // Wait for the stylesheet itself: until it is in, document.fonts knows nothing about the family and the first draw falls back.
        await new Promise<void>((resolve) => { link.onload = () => resolve(); link.onerror = () => resolve(); setTimeout(resolve, 3500); document.head.appendChild(link) })
      }
    } catch { /* Fall back to the generic family. */ }
  }
  await Promise.race([
    Promise.all([300, 400, 600, 700].map((weight) => document.fonts.load(`${weight} 24px "${name}"`).catch(() => []))),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ])
}

const logoCache = new Map<string, Promise<HTMLImageElement | null>>()

/** True when the whole image border is one opaque color: a logo exported on a flat tile instead of transparent. */
function hasFlatBorder({ data, width, height }: { data: Uint8ClampedArray; width: number; height: number }): boolean {
  const border: number[] = []
  const step = Math.max(1, Math.floor(Math.max(width, height) / 60))
  for (let x = 0; x < width; x += step) border.push((x) * 4, ((height - 1) * width + x) * 4)
  for (let y = 0; y < height; y += step) border.push((y * width) * 4, (y * width + width - 1) * 4)
  const mean = [0, 0, 0]
  for (const i of border) { if (data[i + 3] < 250) return false; for (let c = 0; c < 3; c++) mean[c] += data[i + c] / border.length }
  return border.every((i) => [0, 1, 2].every((c) => Math.abs(data[i + c] - mean[c]) < 26))
}

/** The logo with its flat background removed and cropped to the mark, so it sits on any post without a box. Logos that already have transparency are untouched. */
export function loadLogo(assetId: string | null): Promise<HTMLImageElement | null> {
  if (!assetId) return Promise.resolve(null)
  let cached = logoCache.get(assetId)
  if (!cached) {
    cached = (async () => {
      const image = await loadImage(assetId)
      if (!image) return null
      const ratio = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      if (!hasFlatBorder(pixels)) return image
      const cut = removeBackground(pixels, { threshold: 40, softness: 45 })
      const box = contentBox(cut, 8, 4)
      if (!box || box.w < 8 || box.h < 8) return image
      const full = document.createElement('canvas')
      full.width = cut.width
      full.height = cut.height
      full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(cut.data), cut.width, cut.height), 0, 0)
      const out = document.createElement('canvas')
      out.width = box.w
      out.height = box.h
      out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
      return await new Promise<HTMLImageElement>((resolve) => { const result = new Image(); result.onload = () => resolve(result); result.onerror = () => resolve(image); result.src = out.toDataURL('image/png') })
    })()
    logoCache.set(assetId, cached)
  }
  return cached
}

export function loadImage(assetId: string | null): Promise<HTMLImageElement | null> {
  if (!assetId) return Promise.resolve(null)
  let cached = imageCache.get(assetId)
  if (!cached) {
    cached = new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => { imageCache.delete(assetId); resolve(null) }
      image.src = assetUrl(assetId)
    })
    imageCache.set(assetId, cached)
  }
  return cached
}

export function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word }
      else line = next
    }
    if (line) lines.push(line)
  }
  return lines
}

type Ctx = CanvasRenderingContext2D & { letterSpacing: string }

/** Which layers of a slide to draw: the background with components and shade, the text block, the CTA button. */
export type RenderPart = 'plate' | 'text' | 'cta'

/** Where the text of a post sits, in canvas pixels: used to ask the image model for a background that leaves that room free. */
export type LayoutInfo = { width: number; height: number; logoBottom: number; textTop: number; textBottom: number; ctaTop: number | null; footerTop: number | null }

/** Draws a post at its native size. Single source of truth for preview and export. */
export async function renderPost(canvas: HTMLCanvasElement, post: Post, campaign: Campaign, workspace: Workspace, options: { selectedLayerId?: string | null; parts?: RenderPart[]; layoutOut?: Partial<LayoutInfo> } = {}): Promise<void> {
  const format = formatOf(post.format)
  const { width, height } = format
  const kv = campaign.keyVisual
  // [PLACEHOLDER] tokens are replaced with the campaign's values at draw time; stored text is untouched.
  const fill = (value: string) => applyVars(value, campaign.variables ?? {})
  post = { ...post, eyebrow: fill(post.eyebrow), headline: fill(post.headline), accent: fill(post.accent), subtitle: fill(post.subtitle), cta: fill(post.cta), footer: fill(post.footer) }
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as Ctx | null
  if (!ctx) return
  const parts = new Set<RenderPart>(options.parts ?? ['plate', 'text', 'cta'])

  const background = campaign.backgrounds.find((item) => item.id === post.backgroundId)
  const dark = kv.textTone === 'dark'
  const text = dark ? '#14161c' : '#ffffff'
  const accent = safeColor(kv.accentColor, '#FF4D5E')
  const display = `"${kv.displayFont || 'Playfair Display'}", serif`
  const body = `"${kv.bodyFont || 'Be Vietnam Pro'}", sans-serif`
  const placement = post.logo ?? {}
  const onDarkBackground = placement.variant ? placement.variant === 'dark' : !dark
  const logoId = placement.hidden ? null : onDarkBackground && workspace.company.logoDarkId ? workspace.company.logoDarkId : workspace.company.logoId

  const layerImages = await Promise.all(post.layers.map((layer) => loadImage(campaign.components.find((item) => item.id === layer.componentId)?.assetId ?? null)))
  const [bgImage, logo] = await Promise.all([
    loadImage(background?.assetId ?? null),
    loadLogo(logoId),
    ensureFont(kv.displayFont, kv.displayFontAssetId),
    ensureFont(kv.bodyFont, null),
  ])

  // Background: generated plate, or palette gradient as fallback.
  const colors = kv.palette.map((hex) => safeColor(hex, '#888888'))
  const gradient = ctx.createLinearGradient(0, 0, width * 0.4, height)
  colors.slice(0, 3).forEach((color, index, list) => gradient.addColorStop(list.length === 1 ? 0 : index / (list.length - 1), color))
  if (colors.length === 1) gradient.addColorStop(1, colors[0])
  if (parts.has('plate')) {
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    if (bgImage) drawCover(ctx, bgImage, width, height)
  }

  // Legibility scrims at top and bottom, where text sits.
  if (post.scrim && parts.has('plate')) {
    const tint = dark ? '255,255,255' : '0,0,0'
    const top = ctx.createLinearGradient(0, 0, 0, height * 0.6)
    top.addColorStop(0, `rgba(${tint},0.45)`)
    top.addColorStop(1, `rgba(${tint},0)`)
    ctx.fillStyle = top
    ctx.fillRect(0, 0, width, height * 0.6)
    const bottom = ctx.createLinearGradient(0, height * 0.65, 0, height)
    bottom.addColorStop(0, `rgba(${tint},0)`)
    bottom.addColorStop(1, `rgba(${tint},0.5)`)
    ctx.fillStyle = bottom
    ctx.fillRect(0, height * 0.65, width, height * 0.35)
  }

  // Graphic components cut from the key visual, drawn under the text.
  if (parts.has('plate')) post.layers.forEach((layer, index) => {
    const image = layerImages[index]
    if (!image) return
    const w = layer.w * width
    const h = w * (image.naturalHeight / image.naturalWidth)
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.translate(layer.x * width, layer.y * height)
    ctx.rotate((layer.rotation * Math.PI) / 180)
    ctx.drawImage(image, -w / 2, -h / 2, w, h)
    if (options.selectedLayerId === layer.id) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#4da3ff'
      ctx.lineWidth = Math.max(2, width / 400)
      ctx.setLineDash([width / 80, width / 120])
      ctx.strokeRect(-w / 2, -h / 2, w, h)
    }
    ctx.restore()
  })

  const isCover = post.format === 'cover'
  const safe = post.format === 'story' ? STORY_SAFE : 0
  const left = MARGIN
  const top = MARGIN + safe
  const bottom = height - MARGIN - safe
  const textWidth = isCover ? width * 0.55 : width - MARGIN * 2
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.letterSpacing = '0px'

  // ---- Measure the text block first, so it can be fitted, anchored and shaded before anything is drawn.
  const scale = Math.min(1.4, Math.max(0.6, post.textScale ?? 1))
  const baseHead = (isCover ? 60 : post.format === 'story' ? 104 : post.format === 'square' ? 84 : 96) * scale
  const maxHeadLines = isCover ? 2 : 3
  let subSize = Math.round((isCover ? 28 : 32) * Math.min(1.15, scale))
  let subLine = Math.round(subSize * 1.45)
  const maxSubLines = isCover ? 3 : 5
  ctx.font = `400 22px ${body}`
  const footerLines = post.footer ? wrap(ctx, post.footer, width - MARGIN * 2).slice(0, 6) : []
  const footerLineHeight = 30
  // A multi-line footer grows upward, so the separator, the CTA and the text area all move with it.
  const footerY = bottom - Math.max(0, footerLines.length - 1) * footerLineHeight
  const ctaHeight = 72
  const ctaTop = isCover ? 0 : footerY - 44 - 40 - ctaHeight
  const logoHeight = Math.min(260, Math.max(20, (workspace.company.logoHeight ?? 64) * Math.min(2, Math.max(0.5, placement.scale ?? 1))))
  const areaTop = top + (placement.hidden ? 70 : Math.max(70, logoHeight + 30))
  const areaBottom = post.cta && !isCover ? ctaTop - 30 : post.footer ? footerY - 44 - 30 : bottom
  const maxBlock = Math.max(200, (areaBottom - areaTop) * 0.62)

  const layout = (size: number) => {
    ctx.font = `700 ${size}px ${display}`
    const lines = [
      ...wrapBalanced(ctx, post.headline, textWidth).map((line) => ({ line, color: text })),
      ...wrapBalanced(ctx, post.accent, textWidth).map((line) => ({ line, color: accent })),
    ]
    ctx.font = `300 ${subSize}px ${body}`
    const subLines = post.subtitle ? wrap(ctx, post.subtitle, textWidth * (isCover ? 1 : 0.8)) : []
    // A lead text that is still too long is cut with an ellipsis rather than spilling over the artwork.
    if (subLines.length > maxSubLines) { subLines.length = maxSubLines; subLines[maxSubLines - 1] = `${subLines[maxSubLines - 1].replace(/[\s,.;:]+$/, '')}…` }
    // Vietnamese stacks diacritics above and below the line, so lines need more air than Latin text.
    const lineHeight = size * 1.2
    const eyebrowHeight = post.eyebrow ? 52 : 0
    const height = eyebrowHeight + lines.length * lineHeight + (subLines.length ? 18 + subLines.length * subLine : 0)
    return { lines, subLines, lineHeight, eyebrowHeight, height }
  }
  let headSize = baseHead
  let block = layout(headSize)
  while ((block.lines.length > maxHeadLines || block.height > maxBlock) && headSize > baseHead * 0.55) { headSize *= 0.94; block = layout(headSize) }
  // Heading already at its smallest and the block is still too tall (a long lead text): shrink the lead text, down to 75%.
  const subFloor = Math.round(subSize * 0.75)
  while (block.height > maxBlock && subSize > subFloor) { subSize -= 1; subLine = Math.round(subSize * 1.45); block = layout(headSize) }

  const anchor = post.textAnchor ?? 'top'
  const blockTop = anchor === 'middle' ? areaTop + Math.max(0, (areaBottom - areaTop - block.height) / 2)
    : anchor === 'bottom' ? Math.max(areaTop, areaBottom - block.height)
    : areaTop + (isCover ? 10 : 50)

  // ---- Local legibility shade: darken (or lighten) behind the text only where the background is busy or bright.
  const blockBox = { x: left - 28, y: blockTop - 22, w: textWidth + 56, h: block.height + 44 }
  if (options.layoutOut) Object.assign(options.layoutOut, { width, height, logoBottom: top + (placement.hidden ? 0 : logoHeight), textTop: blockTop, textBottom: blockTop + block.height, ctaTop: post.cta && !isCover ? ctaTop : null, footerTop: post.footer ? footerY - 44 : null })
  if (parts.has('plate')) {
  const lum = regionLuminance(ctx, blockBox)
  const need = dark ? Math.max(0, 0.72 - lum * 0.9) : Math.max(0, (lum - 0.2) * 2.1)
  if (need > 0.04) feather(ctx, blockBox, dark ? '255,255,255' : '0,0,0', Math.min(0.72, need), 70)
  for (const shade of post.shades ?? []) {
    feather(ctx, { x: shade.x * width, y: shade.y * height, w: shade.w * width, h: shade.h * height }, shade.tone === 'light' ? '255,255,255' : '0,0,0', Math.min(0.9, Math.max(0, shade.strength)), Math.min(shade.w * width, shade.h * height) * 0.35)
  }
  }

  // ---- Logo (size set in the workspace) or company name as text.
  if (parts.has('text')) {
  if (logo) {
    const logoWidth = Math.min(logo.naturalWidth * (logoHeight / logo.naturalHeight), width * 0.3)
    const drawnHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth)
    const position = placement.position ?? 'top-left'
    const logoX = position === 'top-right' ? width - MARGIN - logoWidth : position === 'top-center' ? (width - logoWidth) / 2 : left
    ctx.drawImage(logo, logoX, top, logoWidth, drawnHeight)
  } else if (workspace.company.name && !placement.hidden) {
    ctx.fillStyle = text
    ctx.font = `700 28px ${display}`
    ctx.fillText(workspace.company.name, left, top + 30)
  }

  // ---- Text block.
  let y = blockTop
  ctx.save()
  ctx.shadowColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 14
  if (post.eyebrow) {
    ctx.fillStyle = text
    ctx.globalAlpha = 0.85
    ctx.font = `600 22px ${body}`
    ctx.letterSpacing = '5.5px'
    ctx.fillText(post.eyebrow.toUpperCase(), left, y + 22)
    ctx.letterSpacing = '0px'
    ctx.globalAlpha = 1
    y += block.eyebrowHeight
  }
  ctx.font = `700 ${headSize}px ${display}`
  for (const { line, color } of block.lines) {
    ctx.fillStyle = color
    ctx.fillText(line, left, y + headSize * 0.92)
    y += block.lineHeight
  }
  if (block.subLines.length) {
    y += 18
    ctx.fillStyle = text
    ctx.globalAlpha = 0.94
    ctx.font = `300 ${subSize}px ${body}`
    for (const line of block.subLines) {
      ctx.fillText(line, left, y + subSize)
      y += subLine
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // ---- Footer line.
  if (post.footer) {
    ctx.fillStyle = text
    ctx.globalAlpha = 0.75
    ctx.font = `400 22px ${body}`
    footerLines.forEach((line, index) => ctx.fillText(line, left, footerY + index * footerLineHeight))
    ctx.globalAlpha = 1
    ctx.fillStyle = text
    ctx.globalAlpha = 0.25
    ctx.fillRect(left, footerY - 44, width - MARGIN * 2, 1)
    ctx.globalAlpha = 1
  }

  }

  // ---- CTA button: right side on covers, anchored above the footer otherwise.
  if (post.cta && parts.has('cta')) {
    ctx.font = `600 28px ${body}`
    const buttonWidth = ctx.measureText(post.cta).width + 72
    const buttonX = isCover ? width - MARGIN - buttonWidth : left
    const buttonY = isCover ? (footerY - 44 - ctaHeight) / 2 + 20 : ctaTop
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(buttonX, buttonY, buttonWidth, ctaHeight, ctaHeight / 2)
    ctx.fill()
    ctx.fillStyle = contrastColor(accent)
    ctx.fillText(post.cta, buttonX + 36, buttonY + 46)
  }
}

/** Wraps text, then narrows the measure as far as possible without adding a line, so lines come out even. */
function wrapBalanced(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines = wrap(ctx, text, maxWidth)
  if (lines.length < 2) return lines
  let low = maxWidth * 0.5
  let high = maxWidth
  for (let i = 0; i < 8; i++) {
    const mid = (low + high) / 2
    if (wrap(ctx, text, mid).length <= lines.length) high = mid
    else low = mid
  }
  return wrap(ctx, text, high)
}

/** Mix of average and bright-end luminance (0..1) of a canvas region, so glows count more than the mean. */
function regionLuminance(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }): number {
  const x = Math.max(0, Math.round(box.x)), y = Math.max(0, Math.round(box.y))
  const w = Math.min(ctx.canvas.width - x, Math.round(box.w)), h = Math.min(ctx.canvas.height - y, Math.round(box.h))
  if (w < 4 || h < 4) return 0
  const sample = document.createElement('canvas')
  sample.width = 40
  sample.height = 40
  const sctx = sample.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, 40, 40)
  const { data } = sctx.getImageData(0, 0, 40, 40)
  const values: number[] = []
  for (let i = 0; i < data.length; i += 4) values.push((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255)
  values.sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return mean * 0.5 + values[Math.floor(values.length * 0.9)] * 0.5
}

/** Soft-edged tinted rectangle: a local scrim without a visible box. */
function feather(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, rgb: string, alpha: number, edge: number): void {
  const w = Math.max(2, Math.round(box.w)), h = Math.max(2, Math.round(box.h))
  const layer = document.createElement('canvas')
  layer.width = w
  layer.height = h
  const lctx = layer.getContext('2d')!
  lctx.fillStyle = `rgba(${rgb},${alpha})`
  lctx.fillRect(0, 0, w, h)
  const fade = Math.min(edge, w / 2, h / 2)
  lctx.globalCompositeOperation = 'destination-in'
  const horizontal = lctx.createLinearGradient(0, 0, w, 0)
  horizontal.addColorStop(0, 'rgba(0,0,0,0)')
  horizontal.addColorStop(fade / w, 'rgba(0,0,0,1)')
  horizontal.addColorStop(1 - fade / w, 'rgba(0,0,0,1)')
  horizontal.addColorStop(1, 'rgba(0,0,0,0)')
  lctx.fillStyle = horizontal
  lctx.fillRect(0, 0, w, h)
  const vertical = lctx.createLinearGradient(0, 0, 0, h)
  vertical.addColorStop(0, 'rgba(0,0,0,0)')
  vertical.addColorStop(fade / h, 'rgba(0,0,0,1)')
  vertical.addColorStop(1 - fade / h, 'rgba(0,0,0,1)')
  vertical.addColorStop(1, 'rgba(0,0,0,0)')
  lctx.fillStyle = vertical
  lctx.fillRect(0, 0, w, h)
  ctx.drawImage(layer, box.x, box.y)
}

export async function renderBlob(post: Post, campaign: Campaign, workspace: Workspace): Promise<Blob> {
  const canvas = document.createElement('canvas')
  await renderPost(canvas, post, campaign, workspace)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Không xuất được ảnh.')
  return blob
}

export async function exportPost(post: Post, campaign: Campaign, workspace: Workspace): Promise<void> {
  const blob = await renderBlob(post, campaign, workspace)
  const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const link = document.createElement('a')
  link.download = `${slug(workspace.name) || 'workspace'}-${slug(campaign.name) || 'chien-dich'}-${slug(post.name) || 'bai-dang'}-${post.format}.png`
  link.href = URL.createObjectURL(blob)
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
