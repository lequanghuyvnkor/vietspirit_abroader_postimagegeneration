import { formatOf, newId } from './types.ts'
import type { Campaign, Component, Layer, MotifRole, Post } from './types.ts'

export const ROLE_LABELS: Record<MotifRole, string> = { texture: 'Họa tiết phủ nền', hero: 'Họa tiết lớn', line: 'Đường bay / vệt dài', decor: 'Họa tiết điểm', off: 'Không dùng' }

/** A rough first guess from the shape alone (logos and long thin pieces are easy; the main symbol needs a human or the AI). */
export function guessRole(component: Component): MotifRole {
  if (/^logo/i.test(component.name)) return 'off'
  const aspect = component.width / Math.max(1, component.height)
  if (aspect >= 7 || aspect <= 1 / 7) return 'line'
  if (Math.max(component.width, component.height) <= 140 && aspect >= 0.6 && aspect <= 1.7) return 'decor'
  return 'off'
}

export type MotifPool = { texture: Component[]; hero: Component[]; line: Component[]; decor: Component[] }

/** The graphics the user (or the AI) has given a role. A graphic with no role is never used on its own. */
export function motifPool(campaign: Campaign): MotifPool {
  const pool: MotifPool = { texture: [], hero: [], line: [], decor: [] }
  for (const component of campaign.components) if (component.role && component.role !== 'off') pool[component.role].push(component)
  return pool
}

export const motifCount = (pool: MotifPool) => pool.texture.length + pool.hero.length + pool.line.length + pool.decor.length

/**
 * "composite": the app puts the brand graphics on the slide itself (exact shapes), and the AI is told to leave that room as plain atmosphere.
 * "ai": the graphics are sent to the AI as references and it draws its own version. Composite is the default once any graphic has a role.
 */
export const compositeMode = (campaign: Campaign): boolean => campaign.keyVisual.motifMode !== 'ai' && motifCount(motifPool(campaign)) > 0

function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let state = (h ^ (h >>> 16)) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type FreeBand = { freeFrom: number; freeTo: number }
/** One band for every slide, or the band of each slide (slides differ: a text-heavy slide has no room while a cover has plenty). */
export type Bands = FreeBand | Map<string, FreeBand>

const layer = (component: Component, x: number, y: number, w: number, opacity: number, rotation: number): Layer => ({ id: newId(), componentId: component.id, x, y, w, opacity, rotation, auto: true })

/**
 * Where the brand graphics go on each slide of a piece: only inside the free band (the room the text does not use).
 * The main symbol travels across a carousel, the long line continues from slide to slide, and small ornaments are scattered
 * with a fixed seed so the same slide always gets the same picture.
 */
/**
 * A pattern that covers the whole slide. On a carousel it is wider than the frame and moves a little from slide to slide,
 * so the pattern runs on across the swipe the way a continuous artwork would.
 */
function textureLayer(component: Component, width: number, height: number, count: number, progress: number, opacity: number): Layer {
  const aspect = component.width / Math.max(1, component.height)
  const cover = Math.max(1, (height / width) * aspect)
  if (count <= 1) return layer(component, 0.5, 0.5, cover, opacity, 0)
  // Just wide enough to cover the frame with room to move; no larger, so the pattern is not blown up more than it has to be.
  return layer(component, 0.5 + 0.24 * (1 - 2 * progress), 0.5, Math.max(cover, 1.5), opacity, 0)
}

export function planMotifs(campaign: Campaign, slides: Post[], bands: Bands, density = 0.5): Map<string, Layer[]> {
  const pool = motifPool(campaign)
  const out = new Map<string, Layer[]>()
  const count = slides.length
  slides.forEach((post, index) => {
    const { width, height } = formatOf(post.format)
    const layers: Layer[] = []
    out.set(post.id, layers)
    if (post.hero?.layout === 'full') return
    const progress = count > 1 ? index / (count - 1) : 0.5
    // The pattern needs no free band: it sits under everything, like the pattern on the finished sample posts.
    if (pool.texture.length > 0) layers.push(textureLayer(pool.texture[0], width, height, count, progress, campaign.keyVisual.textureOpacity ?? 0.6))
    const band = bands instanceof Map ? bands.get(post.id) : bands
    if (!band) return
    const top = band.freeFrom * height
    const room = (band.freeTo - band.freeFrom) * height
    if (room < height * 0.07) return
    const random = seeded(post.id)
    let heroBox: { x0: number; x1: number; y0: number; y1: number } | null = null

    if (pool.line.length > 0) {
      const line = pool.line[index % pool.line.length]
      layers.push(layer(line, 0.5 + ((count - 1) / 2 - index) * 0.16, (top + room * 0.88) / height, 1.3, 0.8, -2))
    }
    if (pool.hero.length > 0) {
      const hero = pool.hero[0]
      const aspect = hero.width / Math.max(1, hero.height)
      let h = room * 0.62
      let w = h * aspect
      if (w > width * 0.42) { w = width * 0.42; h = w / aspect }
      const x = count > 1 ? 0.28 + 0.44 * progress : 0.7
      const y = (top + room * 0.5) / height
      layers.push(layer(hero, x, y, w / width, 1, 0))
      heroBox = { x0: x - w / width / 2 - 0.03, x1: x + w / width / 2 + 0.03, y0: y - h / height / 2 - 0.03, y1: y + h / height / 2 + 0.03 }
    }
    if (pool.decor.length > 0) {
      const wanted = 2 + Math.round(4 * density)
      for (let placed = 0, tries = 0; placed < wanted && tries < wanted * 12; tries++) {
        const x = 0.06 + random() * 0.88
        const y = (top + room * (0.05 + random() * 0.9)) / height
        if (heroBox && x > heroBox.x0 && x < heroBox.x1 && y > heroBox.y0 && y < heroBox.y1) continue
        layers.push(layer(pool.decor[(index + placed) % pool.decor.length], x, y, 0.03 + random() * 0.04, 0.45 + random() * 0.45, Math.round(random() * 40 - 20)))
        placed++
      }
    }
  })
  return out
}

/** Slides of a piece that carry the motifs: originals only, in order. */
const baseSlides = (campaign: Campaign, pieceId: string) => campaign.posts.filter((post) => post.pieceId === pieceId && !post.variantOf && !post.excluded)

/** Replaces the automatic graphics of a piece's slides (or of one slide) by a fresh plan. Graphics the user placed or moved are kept. */
/** Returns how many slides ended up with at least one automatic graphic (a slide whose text fills the frame gets none). */
export function applyMotifs(campaign: Campaign, pieceId: string, band: Bands, onlyPostId?: string): number {
  if (!compositeMode(campaign)) return 0
  const slides = baseSlides(campaign, pieceId)
  const plan = planMotifs(campaign, slides, band, campaign.keyVisual.motifDensity ?? 0.5)
  let changed = 0
  for (const post of slides) {
    if (onlyPostId && post.id !== onlyPostId) continue
    const fresh = plan.get(post.id) ?? []
    post.layers = [...post.layers.filter((item) => !item.auto), ...fresh]
    if (fresh.length > 0) changed += 1
  }
  return changed
}

export function clearAutoMotifs(campaign: Campaign, pieceId: string): void {
  for (const post of campaign.posts) if (post.pieceId === pieceId) post.layers = post.layers.filter((item) => !item.auto)
}
