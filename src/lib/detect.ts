import { contentBox, removeBackground, type Box, type Pixels } from './cutout.ts'

/** Automatic discovery of graphic elements on a guideline page (no user selection). Pure pixel code. */

export type Found = { box: Box; cut: Pixels; role: 'component' | 'logo-light' | 'logo-dark' }

type Options = {
  /** Text boxes (page pixel coordinates) from the PDF text layer; blobs that are mostly text are dropped. */
  textBoxes: Box[]
  /** Elements closer than this (full-resolution px) are grouped into one component. */
  gap?: number
  threshold?: number
  softness?: number
  /** Logo lockups: text is part of the design, so skip every text filter. */
  keepText?: boolean
}

function downsample({ data, width, height }: Pixels, factor: number): Pixels {
  const w = Math.ceil(width / factor)
  const h = Math.ceil(height / factor)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let dy = 0; dy < factor; dy++) {
        const py = y * factor + dy
        if (py >= height) break
        for (let dx = 0; dx < factor; dx++) {
          const px = x * factor + dx
          if (px >= width) break
          const i = (py * width + px) * 4
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
        }
      }
      out.set([r / n, g / n, b / n, 255], (y * w + x) * 4)
    }
  }
  return { data: out, width: w, height: h }
}

const median = (values: number[]) => { values.sort((a, b) => a - b); return values[values.length >> 1] }

/**
 * Local background: the median color in a window much larger than any element, sampled on a coarse grid and
 * interpolated. Elements vanish from it while gradients and large panels stay.
 */
function localBackground({ data, width, height }: Pixels, radius: number): Float32Array {
  const step = Math.max(4, Math.round(radius / 2))
  const stride = Math.max(1, Math.round(radius / 9))
  const gw = Math.ceil(width / step) + 1
  const gh = Math.ceil(height / step) + 1
  const grid = new Float32Array(gw * gh * 3)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const cx = Math.min(width - 1, gx * step), cy = Math.min(height - 1, gy * step)
      const channels: number[][] = [[], [], []]
      for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y += stride) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x += stride) {
          const i = (y * width + x) * 4
          channels[0].push(data[i]); channels[1].push(data[i + 1]); channels[2].push(data[i + 2])
        }
      }
      for (let c = 0; c < 3; c++) grid[(gy * gw + gx) * 3 + c] = median(channels[c])
    }
  }
  const bg = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const fy = y / step, y0 = Math.floor(fy), ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = x / step, x0 = Math.floor(fx), tx = fx - x0
      for (let c = 0; c < 3; c++) {
        const a = grid[(y0 * gw + x0) * 3 + c], b = grid[(y0 * gw + Math.min(gw - 1, x0 + 1)) * 3 + c]
        const d = grid[(Math.min(gh - 1, y0 + 1) * gw + x0) * 3 + c], e = grid[(Math.min(gh - 1, y0 + 1) * gw + Math.min(gw - 1, x0 + 1)) * 3 + c]
        bg[(y * width + x) * 3 + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty
      }
    }
  }
  return bg
}

function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (radius <= 0) return mask
  const horizontal = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    let last = -Infinity
    for (let x = 0; x < w; x++) { if (mask[y * w + x]) last = x; if (x - last <= radius) horizontal[y * w + x] = 1 }
    last = Infinity
    for (let x = w - 1; x >= 0; x--) { if (mask[y * w + x]) last = x; if (last - x <= radius) horizontal[y * w + x] = 1 }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let last = -Infinity
    for (let y = 0; y < h; y++) { if (horizontal[y * w + x]) last = y; if (y - last <= radius) out[y * w + x] = 1 }
    last = Infinity
    for (let y = h - 1; y >= 0; y--) { if (horizontal[y * w + x]) last = y; if (last - y <= radius) out[y * w + x] = 1 }
  }
  return out
}

/** Connected components of a mask. Returns a label map (0 = none) and each label's bounding box. */
function label(mask: Uint8Array, w: number, h: number) {
  const labels = new Int32Array(w * h)
  const boxes: Box[] = []
  const stack: number[] = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue
    const id = boxes.length + 1
    let minX = w, minY = h, maxX = 0, maxY = 0
    labels[start] = id
    stack.push(start)
    while (stack.length) {
      const index = stack.pop()!
      const x = index % w, y = (index - x) / w
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const next of [x > 0 ? index - 1 : -1, x < w - 1 ? index + 1 : -1, y > 0 ? index - w : -1, y < h - 1 ? index + w : -1]) {
        if (next >= 0 && mask[next] && !labels[next]) { labels[next] = id; stack.push(next) }
      }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 })
  }
  return { labels, boxes }
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

const contains = (outer: Box, inner: Box) => inner.x >= outer.x - 2 && inner.y >= outer.y - 2 && inner.x + inner.w <= outer.x + outer.w + 2 && inner.y + inner.h <= outer.y + outer.h + 2

/** Faint leftovers (panel borders, gradient smudges) have no solid pixel; real elements always do. */
function dropWeak(cut: Pixels): void {
  const { data, width, height } = cut
  const ink = new Uint8Array(width * height)
  for (let p = 0; p < ink.length; p++) if (data[p * 4 + 3] > 40) ink[p] = 1
  const { labels, boxes } = label(ink, width, height)
  const strong = new Uint8Array(boxes.length + 1)
  for (let p = 0; p < ink.length; p++) if (ink[p] && data[p * 4 + 3] >= 200) strong[labels[p]] = 1
  for (let p = 0; p < ink.length; p++) if (ink[p] && !strong[labels[p]]) data[p * 4 + 3] = 0
}

/** Mostly letters: the share of ink lying inside (generously widened) text boxes is high. */
function isTextBlob(cut: Pixels, boxes: Box[]): boolean {
  const { data, width, height } = cut
  let total = 0, inText = 0
  const inflated = boxes.map((b) => ({ x: b.x - b.w * 0.04 - 4, y: b.y - b.h * 0.3, w: b.w * 1.08 + 8, h: b.h * 1.7 }))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 40) continue
      total++
      if (inflated.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) inText++
    }
  }
  return total > 0 && inText / total > 0.55
}

/**
 * Removes text that sits beside an element (captions under a tile) while keeping text that is part of its
 * design (words on a card, a button or a stamp): a caption touches no other ink.
 */
function eraseCaptions(cut: Pixels, boxes: Box[]): void {
  const { data, width, height } = cut
  const local = boxes.filter((box) => box.x < width && box.y < height && box.x + box.w > 0 && box.y + box.h > 0)
  if (!local.length) return
  const inText = new Uint8Array(width * height)
  for (const box of local) {
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(height, Math.ceil(box.y + box.h)); y++) {
      for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(width, Math.ceil(box.x + box.w)); x++) inText[y * width + x] = 1
    }
  }
  const body = new Uint8Array(width * height)
  for (let p = 0; p < body.length; p++) if (data[p * 4 + 3] > 40 && !inText[p]) body[p] = 1
  const near = dilate(body, width, height, 4)
  for (const box of local) {
    const x0 = Math.max(0, Math.floor(box.x)), x1 = Math.min(width, Math.ceil(box.x + box.w))
    const y0 = Math.max(0, Math.floor(box.y)), y1 = Math.min(height, Math.ceil(box.y + box.h))
    let touching = 0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (near[y * width + x]) touching++
    if (touching === 0) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[(y * width + x) * 4 + 3] = 0
  }
}

/** Drops ink groups far smaller than the main element (leftover streaks of a gradient background). */
function dropStrays(cut: Pixels): void {
  const { data, width, height } = cut
  const ink = new Uint8Array(width * height)
  for (let p = 0; p < ink.length; p++) if (data[p * 4 + 3] > 40) ink[p] = 1
  const { labels, boxes } = label(dilate(ink, width, height, 8), width, height)
  if (boxes.length < 2) return
  const mass = new Float64Array(boxes.length + 1)
  const light = new Float64Array(boxes.length + 1)
  for (let p = 0; p < ink.length; p++) {
    if (!ink[p]) continue
    mass[labels[p]]++
    light[labels[p]] += 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2]
  }
  let main = 1
  for (let id = 1; id < mass.length; id++) if (mass[id] > mass[main]) main = id
  const mainLight = light[main] / mass[main]
  for (let p = 0; p < ink.length; p++) {
    const id = labels[p]
    if (!id || id === main) continue
    const tiny = mass[id] < mass[main] * 0.03
    const darkSmear = mass[id] < mass[main] * 0.3 && light[id] / mass[id] < mainLight * 0.35
    if (tiny || darkSmear) data[p * 4 + 3] = 0
  }
}

/** Finds separate graphic elements on a page and returns each one cut out with a transparent background. */
export function detectComponents(page: Pixels, { textBoxes: rawTextBoxes, gap = 12, threshold = 38, softness = 40, keepText = false }: Options): Found[] {
  // OCR boxes are tight; widen them a little so anti-aliased letter edges are covered.
  const textBoxes = rawTextBoxes.map((box) => ({ x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 }))
  const factor = Math.max(1, Math.ceil(Math.max(page.width, page.height) / 1000))
  const small = downsample(page, factor)
  const bg = localBackground(small, Math.round(70 / Math.max(1, factor / 3)))

  const mask = new Uint8Array(small.width * small.height)
  for (let p = 0; p < mask.length; p++) {
    const dr = small.data[p * 4] - bg[p * 3], dg = small.data[p * 4 + 1] - bg[p * 3 + 1], db = small.data[p * 4 + 2] - bg[p * 3 + 2]
    if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) mask[p] = 1
  }
  const grown = dilate(mask, small.width, small.height, Math.max(1, Math.round(gap / factor)))
  const { labels, boxes } = label(grown, small.width, small.height)

  const pageArea = page.width * page.height
  const full = boxes.map((box) => ({ x: box.x * factor, y: box.y * factor, w: box.w * factor, h: box.h * factor }))
  const keep: number[] = []
  full.forEach((box, index) => {
    const area = box.w * box.h
    if (area > pageArea * 0.18 || box.w < 22 || box.h < 22) return
    keep.push(index)
  })
  // A box that holds two or more other boxes is a panel, not an element.
  const finalIndexes = keep.filter((index) => keep.filter((other) => other !== index && contains(full[index], full[other])).length < 2)

  const found: Found[] = []
  for (const index of finalIndexes) {
    const id = index + 1
    const pad = 6
    const x0 = Math.max(0, full[index].x - pad), y0 = Math.max(0, full[index].y - pad)
    const x1 = Math.min(page.width, full[index].x + full[index].w + pad), y1 = Math.min(page.height, full[index].y + full[index].h + pad)
    const w = x1 - x0, h = y1 - y0
    const crop = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = ((y0 + y) * page.width + x0 + x) * 4
        crop.set([page.data[src], page.data[src + 1], page.data[src + 2], 255], (y * w + x) * 4)
      }
    }
    const cut = removeBackground({ data: crop, width: w, height: h }, { threshold, softness })
    // Keep only this element's own region, so a neighbouring element inside the padding does not leak in.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const owner = labels[Math.min(small.height - 1, Math.floor((y0 + y) / factor)) * small.width + Math.min(small.width - 1, Math.floor((x0 + x) / factor))]
        if (owner !== id) cut.data[(y * w + x) * 4 + 3] = 0
      }
    }
    dropWeak(cut)
    if (!keepText) {
      const local = textBoxes.map((t) => ({ x: t.x - x0, y: t.y - y0, w: t.w, h: t.h }))
      if (isTextBlob(cut, local)) continue
      eraseCaptions(cut, local)
    }
    dropStrays(cut)
    const content = contentBox(cut)
    if (!content || content.w < 20 || content.h < 20) continue
    // Page-wide strips (palette rows, panels) are layout, not elements.
    if (content.w > page.width * 0.4 || content.h > page.height * 0.4) continue
    const text = keepText ? 0 : textBoxes.reduce((sum, t) => sum + overlapArea({ x: x0 + content.x, y: y0 + content.y, w: content.w, h: content.h }, t), 0) / (content.w * content.h)
    // A panel with paragraphs of text is a layout card, not an element.
    if (!keepText && textBoxes.filter((t) => t.x + t.w / 2 > x0 + content.x && t.x + t.w / 2 < x0 + content.x + content.w && t.y + t.h / 2 > y0 + content.y && t.y + t.h / 2 < y0 + content.y + content.h).length >= 5) continue
    let opaque = 0
    for (let p = 0; p < w * h; p++) if (cut.data[p * 4 + 3] > 40) opaque++
    // Hairline fragments of a panel border carry almost no ink.
    if (opaque / (content.w * content.h) < 0.02) continue
    // A lone thin stroke (a corner of a panel border) is not an element; dotted paths and waves have more parts or more ink.
    const ink = new Uint8Array(w * h)
    for (let p = 0; p < ink.length; p++) if (cut.data[p * 4 + 3] > 40) ink[p] = 1
    const parts = label(ink, w, h).boxes.filter((part) => part.w * part.h > 6).length
    const fill = opaque / (content.w * content.h)
    if (parts <= 2 && (fill < 0.05 || (content.w * content.h < 15000 && fill < 0.15))) continue
    // Plain colour tiles (palette swatches) are not graphic elements.
    if (text < 0.05 && opaque / (content.w * content.h) > 0.92 && content.w > 60 && content.h > 60) continue
    const trimmed = new Uint8ClampedArray(content.w * content.h * 4)
    for (let y = 0; y < content.h; y++) trimmed.set(cut.data.subarray(((content.y + y) * w + content.x) * 4, ((content.y + y) * w + content.x + content.w) * 4), y * content.w * 4)
    found.push({ box: { x: x0 + content.x, y: y0 + content.y, w: content.w, h: content.h }, cut: { data: trimmed, width: content.w, height: content.h }, role: 'component' })
  }
  return found.sort((a, b) => (Math.abs(a.box.y - b.box.y) > Math.min(a.box.h, b.box.h) / 2 ? a.box.y - b.box.y : a.box.x - b.box.x))
}
