/** Background removal and component detection on raw RGBA pixels (no DOM needed). */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number }
export type Box = { x: number; y: number; w: number; h: number }

export type CutParams = {
  /** Color distance below which a pixel is treated as background. */
  threshold: number
  /** Width of the soft transition above the threshold. */
  softness: number
}

/** Smoothed average color along one edge, so a noisy border does not skew the background model. */
function edgeProfile(read: (index: number) => [number, number, number], length: number): Float32Array {
  const raw = new Float32Array(length * 3)
  for (let i = 0; i < length; i++) raw.set(read(i), i * 3)
  const out = new Float32Array(length * 3)
  const radius = Math.max(2, Math.round(length / 40))
  for (let i = 0; i < length; i++) {
    let r = 0, g = 0, b = 0, n = 0
    for (let k = Math.max(0, i - radius); k <= Math.min(length - 1, i + radius); k++) { r += raw[k * 3]; g += raw[k * 3 + 1]; b += raw[k * 3 + 2]; n++ }
    out.set([r / n, g / n, b / n], i * 3)
  }
  return out
}

/**
 * Estimates a smooth background (gradient) by interpolating the four border rows/columns.
 * Works when the region's border shows only background.
 */
export function estimateBackground({ data, width, height }: Pixels): Float32Array {
  const at = (x: number, y: number): [number, number, number] => { const i = (y * width + x) * 4; return [data[i], data[i + 1], data[i + 2]] }
  const left = edgeProfile((y) => at(0, y), height)
  const right = edgeProfile((y) => at(width - 1, y), height)
  const top = edgeProfile((x) => at(x, 0), width)
  const bottom = edgeProfile((x) => at(x, height - 1), width)
  const bg = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const v = height > 1 ? y / (height - 1) : 0
    for (let x = 0; x < width; x++) {
      const u = width > 1 ? x / (width - 1) : 0
      const o = (y * width + x) * 3
      for (let c = 0; c < 3; c++) bg[o + c] = ((1 - u) * left[y * 3 + c] + u * right[y * 3 + c] + (1 - v) * top[x * 3 + c] + v * bottom[x * 3 + c]) / 2
    }
  }
  return bg
}

/**
 * Turns the difference from the background into alpha. Colors are un-premultiplied against the background
 * so soft glows keep their own color instead of a dark halo.
 */
export function removeBackground(pixels: Pixels, { threshold, softness }: CutParams): Pixels {
  const { data, width, height } = pixels
  const bg = estimateBackground(pixels)
  const out = new Uint8ClampedArray(data.length)
  const span = Math.max(1, softness)
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    const o = p * 3
    const dr = data[i] - bg[o], dg = data[i + 1] - bg[o + 1], db = data[i + 2] - bg[o + 2]
    const distance = Math.sqrt(dr * dr + dg * dg + db * db)
    const alpha = Math.min(1, Math.max(0, (distance - threshold) / span))
    if (alpha <= 0.004) continue
    out[i] = Math.min(255, Math.max(0, (data[i] - (1 - alpha) * bg[o]) / alpha))
    out[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - (1 - alpha) * bg[o + 1]) / alpha))
    out[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - (1 - alpha) * bg[o + 2]) / alpha))
    out[i + 3] = Math.round(alpha * data[i + 3])
  }
  return { data: out, width, height }
}

/** Smallest box containing every pixel with alpha above the limit, plus a margin. */
export function contentBox({ data, width, height }: Pixels, alphaLimit = 8, margin = 2): Box | null {
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaLimit) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const x = Math.max(0, minX - margin)
  const y = Math.max(0, minY - margin)
  return { x, y, w: Math.min(width, maxX + margin + 1) - x, h: Math.min(height, maxY + margin + 1) - y }
}

/**
 * Splits a cut-out region into separate components: groups of visible pixels that are close to each other
 * (within `gap` pixels) become one component. Returns boxes in region coordinates, in reading order.
 */
export function findComponents({ data, width, height }: Pixels, gap: number, minSize: number): Box[] {
  const scale = Math.max(1, Math.round(Math.max(width, height) / 700))
  const cw = Math.ceil(width / scale)
  const ch = Math.ceil(height / scale)
  const mask = new Uint8Array(cw * ch)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Only clearly visible pixels count, so faint gradient streaks do not bridge separate elements.
      if (data[(y * width + x) * 4 + 3] > 110) mask[Math.floor(y / scale) * cw + Math.floor(x / scale)] = 1
    }
  }
  // Dilate so parts of one element (dots of a dashed line, letters of a stamp) merge into a single group.
  const radius = Math.max(0, Math.round(gap / scale))
  const grown = new Uint8Array(cw * ch)
  if (radius === 0) grown.set(mask)
  else {
    const horizontal = new Uint8Array(cw * ch)
    for (let y = 0; y < ch; y++) {
      let last = -Infinity
      const row = y * cw
      for (let x = 0; x < cw; x++) { if (mask[row + x]) last = x; if (x - last <= radius) horizontal[row + x] = 1 }
      last = Infinity
      for (let x = cw - 1; x >= 0; x--) { if (mask[row + x]) last = x; if (last - x <= radius) horizontal[row + x] = 1 }
    }
    for (let x = 0; x < cw; x++) {
      let last = -Infinity
      for (let y = 0; y < ch; y++) { if (horizontal[y * cw + x]) last = y; if (y - last <= radius) grown[y * cw + x] = 1 }
      last = Infinity
      for (let y = ch - 1; y >= 0; y--) { if (horizontal[y * cw + x]) last = y; if (last - y <= radius) grown[y * cw + x] = 1 }
    }
  }

  const label = new Int32Array(cw * ch)
  const boxes: Box[] = []
  const stack: number[] = []
  for (let start = 0; start < cw * ch; start++) {
    if (!grown[start] || label[start]) continue
    let minX = cw, minY = ch, maxX = 0, maxY = 0
    label[start] = boxes.length + 1
    stack.push(start)
    while (stack.length) {
      const index = stack.pop()!
      const x = index % cw, y = (index - x) / cw
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const next of [x > 0 ? index - 1 : -1, x < cw - 1 ? index + 1 : -1, y > 0 ? index - cw : -1, y < ch - 1 ? index + cw : -1]) {
        if (next >= 0 && grown[next] && !label[next]) { label[next] = boxes.length + 1; stack.push(next) }
      }
    }
    boxes.push({ x: minX * scale, y: minY * scale, w: (maxX - minX + 1) * scale, h: (maxY - minY + 1) * scale })
  }

  return boxes
    .filter((box) => box.w >= minSize && box.h >= minSize)
    .map((box) => {
      const x = Math.max(0, box.x - Math.round(gap / 2))
      const y = Math.max(0, box.y - Math.round(gap / 2))
      return { x, y, w: Math.min(width, box.x + box.w + Math.round(gap / 2)) - x, h: Math.min(height, box.y + box.h + Math.round(gap / 2)) - y }
    })
    .sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) / 2 ? a.y - b.y : a.x - b.x))
}
