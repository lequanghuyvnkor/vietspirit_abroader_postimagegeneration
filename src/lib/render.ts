import { assetUrl } from './api.ts'
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
        document.head.appendChild(link)
      }
    } catch { /* Fall back to the generic family. */ }
  }
  await Promise.race([
    Promise.all([300, 400, 600, 700].map((weight) => document.fonts.load(`${weight} 24px "${name}"`).catch(() => []))),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ])
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

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
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

/** Draws a post at its native size. Single source of truth for preview and export. */
export async function renderPost(canvas: HTMLCanvasElement, post: Post, campaign: Campaign, workspace: Workspace): Promise<void> {
  const format = formatOf(post.format)
  const { width, height } = format
  const kv = campaign.keyVisual
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as Ctx | null
  if (!ctx) return

  const background = campaign.backgrounds.find((item) => item.id === post.backgroundId)
  const dark = kv.textTone === 'dark'
  const text = dark ? '#14161c' : '#ffffff'
  const accent = safeColor(kv.accentColor, '#FF4D5E')
  const display = `"${kv.displayFont || 'Playfair Display'}", serif`
  const body = `"${kv.bodyFont || 'Be Vietnam Pro'}", sans-serif`
  const logoId = !dark && workspace.company.logoDarkId ? workspace.company.logoDarkId : workspace.company.logoId

  const [bgImage, logo] = await Promise.all([
    loadImage(background?.assetId ?? null),
    loadImage(logoId),
    ensureFont(kv.displayFont, kv.displayFontAssetId),
    ensureFont(kv.bodyFont, null),
  ])

  // Background: generated plate, or palette gradient as fallback.
  const colors = kv.palette.map((hex) => safeColor(hex, '#888888'))
  const gradient = ctx.createLinearGradient(0, 0, width * 0.4, height)
  colors.slice(0, 3).forEach((color, index, list) => gradient.addColorStop(list.length === 1 ? 0 : index / (list.length - 1), color))
  if (colors.length === 1) gradient.addColorStop(1, colors[0])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  if (bgImage) drawCover(ctx, bgImage, width, height)

  // Legibility scrims at top and bottom, where text sits.
  if (post.scrim) {
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

  const isCover = post.format === 'cover'
  const safe = post.format === 'story' ? STORY_SAFE : 0
  const left = MARGIN
  const top = MARGIN + safe
  const bottom = height - MARGIN - safe
  const textWidth = isCover ? width * 0.55 : width - MARGIN * 2
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.letterSpacing = '0px'

  // Logo (small) or company name as text.
  const logoHeight = 40
  if (logo) {
    const logoWidth = Math.min(logo.naturalWidth * (logoHeight / logo.naturalHeight), width * 0.3)
    ctx.drawImage(logo, left, top, logoWidth, logoWidth * (logo.naturalHeight / logo.naturalWidth))
  } else if (workspace.company.name) {
    ctx.fillStyle = text
    ctx.font = `700 28px ${display}`
    ctx.fillText(workspace.company.name, left, top + 30)
  }

  const headSize = isCover ? 64 : post.format === 'story' ? 112 : post.format === 'square' ? 92 : 104
  let y = top + (isCover ? 84 : 170)

  if (post.eyebrow) {
    ctx.fillStyle = text
    ctx.globalAlpha = 0.85
    ctx.font = `600 22px ${body}`
    ctx.letterSpacing = '5.5px'
    ctx.fillText(post.eyebrow.toUpperCase(), left, y)
    ctx.letterSpacing = '0px'
    ctx.globalAlpha = 1
    y += 28
  }
  y += headSize * 0.85

  // Headline: normal part, then accent part in accent color.
  ctx.font = `700 ${headSize}px ${display}`
  const headLines = [
    ...wrap(ctx, post.headline, textWidth).map((line) => ({ line, color: text })),
    ...wrap(ctx, post.accent, textWidth).map((line) => ({ line, color: accent })),
  ]
  for (const { line, color } of headLines) {
    ctx.fillStyle = color
    ctx.fillText(line, left, y)
    y += headSize * 1.1
  }

  if (post.subtitle) {
    y += 14
    ctx.fillStyle = text
    ctx.globalAlpha = 0.92
    ctx.font = `300 ${isCover ? 28 : 32}px ${body}`
    for (const line of wrap(ctx, post.subtitle, textWidth * (isCover ? 1 : 0.8))) {
      ctx.fillText(line, left, y + 20)
      y += isCover ? 40 : 46
    }
    ctx.globalAlpha = 1
  }

  // Footer line.
  const footerY = bottom
  if (post.footer) {
    ctx.fillStyle = text
    ctx.globalAlpha = 0.75
    ctx.font = `400 22px ${body}`
    ctx.fillText(post.footer, left, footerY)
    ctx.globalAlpha = 1
    ctx.fillStyle = text
    ctx.globalAlpha = 0.25
    ctx.fillRect(left, footerY - 44, width - MARGIN * 2, 1)
    ctx.globalAlpha = 1
  }

  // CTA button: right side on covers, anchored above the footer otherwise.
  if (post.cta) {
    ctx.font = `600 28px ${body}`
    const buttonWidth = ctx.measureText(post.cta).width + 72
    const buttonHeight = 72
    const buttonX = isCover ? width - MARGIN - buttonWidth : left
    const buttonY = isCover ? (footerY - 44 - buttonHeight) / 2 + 20 : footerY - 44 - 40 - buttonHeight
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, buttonHeight / 2)
    ctx.fill()
    ctx.fillStyle = contrastColor(accent)
    ctx.fillText(post.cta, buttonX + 36, buttonY + 46)
  }
}

export async function exportPost(post: Post, campaign: Campaign, workspace: Workspace): Promise<void> {
  const canvas = document.createElement('canvas')
  await renderPost(canvas, post, campaign, workspace)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Không xuất được ảnh.')
  const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const link = document.createElement('a')
  link.download = `${slug(workspace.name) || 'workspace'}-${slug(campaign.name) || 'chien-dich'}-${slug(post.name) || 'bai-dang'}-${post.format}.png`
  link.href = URL.createObjectURL(blob)
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
