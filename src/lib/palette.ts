/** Reading a colour page: the main colours of an image, an accent, and whether text on it should be light or dark. */

export type PaletteReading = { palette: string[]; accentColor: string; textTone: 'light' | 'dark' }

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`
const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/**
 * Finds the colours that make up the image: pixels are grouped into coarse colour cells, small cells (anti-aliasing, noise)
 * are dropped, and colours too close to a bigger one are merged into it. The palette runs from dark to light, which is how
 * the fallback gradient uses it. The accent is the most vivid colour that is neither near white nor near black.
 */
export function extractPalette(data: Uint8ClampedArray, maxColors = 7): PaletteReading | null {
  const cells = new Map<number, { count: number; r: number; g: number; b: number }>()
  let total = 0
  const step = Math.max(1, Math.floor(data.length / 4 / 60000))
  for (let p = 0; p < data.length / 4; p += step) {
    const i = p * 4
    if (data[i + 3] < 200) continue
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const cell = cells.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    cell.count += 1
    cell.r += data[i]
    cell.g += data[i + 1]
    cell.b += data[i + 2]
    cells.set(key, cell)
    total += 1
  }
  if (total === 0) return null
  const ranked = [...cells.values()].filter((cell) => cell.count / total >= 0.003).sort((a, b) => b.count - a.count)
  const chosen: { rgb: number[]; share: number }[] = []
  for (const cell of ranked) {
    const rgb = [cell.r / cell.count, cell.g / cell.count, cell.b / cell.count]
    const near = chosen.find((item) => distance(item.rgb, rgb) < 42)
    if (near) { near.share += cell.count / total; continue }
    if (chosen.length < maxColors) chosen.push({ rgb, share: cell.count / total })
  }
  if (chosen.length === 0) return null
  const dominant = chosen.reduce((best, item) => (item.share > best.share ? item : best))
  const textTone = luminance(dominant.rgb[0], dominant.rgb[1], dominant.rgb[2]) < 0.5 ? 'light' : 'dark'
  // The accent is a colour that stands out: strongly coloured and neither near black nor near white.
  const score = (item: { rgb: number[] }) => { const l = luminance(item.rgb[0], item.rgb[1], item.rgb[2]); return l < 0.2 || l > 0.9 ? 0 : saturation(item.rgb[0], item.rgb[1], item.rgb[2]) * Math.min(1, l / 0.35) }
  const vivid = [...chosen].sort((a, b) => score(b) - score(a))[0]
  const ordered = [...chosen].sort((a, b) => luminance(a.rgb[0], a.rgb[1], a.rgb[2]) - luminance(b.rgb[0], b.rgb[1], b.rgb[2]))
  return { palette: ordered.map((item) => hex(item.rgb[0], item.rgb[1], item.rgb[2])), accentColor: score(vivid) > 0 ? hex(vivid.rgb[0], vivid.rgb[1], vivid.rgb[2]) : hex(dominant.rgb[0], dominant.rgb[1], dominant.rgb[2]), textTone }
}
