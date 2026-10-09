import { drawCover, loadImage, renderPost, type BgView, type LayoutInfo } from './render.ts'
import { formatOf } from './types.ts'
import type { Campaign, Post, Workspace } from './types.ts'

/** What the layout pass decides for one slide. */
export type LayoutPatch = Pick<Post, 'textAnchor' | 'textScale' | 'bgView' | 'panel'>

const GRID_WIDTH = 72
const ANCHORS: NonNullable<Post['textAnchor']>[] = ['top', 'middle', 'bottom']
const SCALES = [1, 0.92, 0.84]
/** Small preferences so that equal scores resolve to the usual look: text at the top, full size. */
const ANCHOR_BIAS = { top: 0, middle: 0.03, bottom: 0.05 }
/** Above this score no placement is calm enough, so the slide gets a frosted panel behind the text. */
const PANEL_THRESHOLD = 0.5

type Grid = { width: number; height: number; luma: Float32Array }

/** The background as the slide will show it (same crop and zoom), at low resolution. */
async function gridOf(assetId: string, post: Post, view: BgView | undefined): Promise<Grid | null> {
  const image = await loadImage(assetId)
  if (!image) return null
  const { width, height } = formatOf(post.format)
  const gw = GRID_WIDTH
  const gh = Math.round((GRID_WIDTH * height) / width)
  const canvas = document.createElement('canvas')
  canvas.width = gw
  canvas.height = gh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  drawCover(ctx, image, gw, gh, view)
  const { data } = ctx.getImageData(0, 0, gw, gh)
  const luma = new Float32Array(gw * gh)
  for (let i = 0; i < luma.length; i++) luma[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
  return { width: gw, height: gh, luma }
}

/** How hard it would be to read text over this rectangle: brightness, contrast and edges, 0 = ideal. */
export function rectCost(grid: Grid, box: { x0: number; y0: number; x1: number; y1: number }, lightText: boolean): number {
  const x0 = Math.max(0, Math.floor(box.x0 * grid.width)), x1 = Math.min(grid.width, Math.ceil(box.x1 * grid.width))
  const y0 = Math.max(0, Math.floor(box.y0 * grid.height)), y1 = Math.min(grid.height, Math.ceil(box.y1 * grid.height))
  if (x1 - x0 < 2 || y1 - y0 < 2) return 0
  let sum = 0
  let sumSquares = 0
  let edges = 0
  let count = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = grid.luma[y * grid.width + x]
      sum += v
      sumSquares += v * v
      count++
      if (x + 1 < x1) edges += Math.abs(grid.luma[y * grid.width + x + 1] - v)
      if (y + 1 < y1) edges += Math.abs(grid.luma[(y + 1) * grid.width + x] - v)
    }
  }
  const mean = sum / count
  const spread = Math.sqrt(Math.max(0, sumSquares / count - mean * mean))
  const edge = edges / (count * 2)
  const tone = lightText ? Math.max(0, mean - 0.28) : Math.max(0, 0.72 - mean)
  return tone * 3.2 + spread * 2.2 + edge * 5
}

/** Slides that share one picture look at different parts of it, so swiping feels like moving across a scene. */
function viewFor(index: number, count: number): BgView | undefined {
  if (count < 2) return undefined
  return { zoom: 1.16, x: -0.85 + (1.7 * index) / (count - 1), y: 0 }
}

/**
 * Chooses, for each slide, where its text sits (top, middle or bottom), how large it is, which part of the shared picture
 * shows, and whether it needs a frosted panel. It scores the real background at the real text position, so it
 * works whatever the picture turned out to be. No AI is called.
 */
export async function planLayouts(workspace: Workspace, campaign: Campaign, slides: Post[]): Promise<Map<string, LayoutPatch>> {
  const patches = new Map<string, LayoutPatch>()
  const lightText = campaign.keyVisual.textTone === 'light'
  const shared = new Set(slides.map((slide) => slide.backgroundId)).size === 1
  const canvas = document.createElement('canvas')

  for (const [index, slide] of slides.entries()) {
    // A full-frame photo is darkened from below, so the text goes at the bottom, full size.
    if (slide.hero?.layout === 'full') { patches.set(slide.id, { textAnchor: 'bottom', textScale: 1, bgView: slide.bgView, panel: false }); continue }
    const assetId = campaign.backgrounds.find((item) => item.id === slide.backgroundId)?.assetId
    if (!assetId) continue
    const view = shared ? viewFor(index, slides.length) : slide.bgView
    const grid = await gridOf(assetId, slide, view)
    if (!grid) continue
    let best: { cost: number; anchor: NonNullable<Post['textAnchor']>; scale: number } | null = null
    for (const anchor of ANCHORS) {
      for (const scale of SCALES) {
        const layout: Partial<LayoutInfo> = {}
        await renderPost(canvas, { ...slide, textAnchor: anchor, textScale: scale, bgView: view, panel: false }, campaign, workspace, { parts: [], layoutOut: layout })
        if (layout.textTop === undefined || layout.height === undefined || layout.width === undefined) continue
        const box = { x0: 0.06, x1: 0.94, y0: Math.max(0, (layout.textTop - 24) / layout.height), y1: Math.min(1, ((layout.textBottom ?? layout.textTop) + 24) / layout.height) }
        const cost = rectCost(grid, box, lightText) + ANCHOR_BIAS[anchor] + (1 - scale) * 0.5
        if (!best || cost < best.cost) best = { cost, anchor, scale }
      }
    }
    if (best) patches.set(slide.id, { textAnchor: best.anchor, textScale: best.scale, bgView: view, panel: best.cost > PANEL_THRESHOLD })
  }
  return patches
}

/** Writes the chosen layouts onto the campaign's slides. */
export function applyLayouts(campaign: Campaign, patches: Map<string, LayoutPatch>): void {
  for (const post of campaign.posts) {
    const patch = patches.get(post.id)
    if (patch) Object.assign(post, patch)
  }
}
