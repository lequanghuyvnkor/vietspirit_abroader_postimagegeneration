import { contentBox, removeBackground } from './cutout.ts'
import { extractPalette, type PaletteReading } from './palette.ts'

/** Reads one uploaded image in the browser (nothing is sent to the server until the user confirms). */
export async function loadBitmap(file: File): Promise<ImageBitmap> {
  try { return await createImageBitmap(file) } catch { throw new Error('Không mở được ảnh này. Dùng PNG, JPG hoặc WebP.') }
}

function pixelsOf(bitmap: ImageBitmap, maxEdge: number) {
  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) }
}

/** A colour page: the palette, accent and text tone found in the picture. */
export function readColorPage(bitmap: ImageBitmap): PaletteReading {
  const { data } = pixelsOf(bitmap, 480)
  const reading = extractPalette(data.data)
  if (!reading) throw new Error('Không đọc được màu từ ảnh này.')
  return reading
}

export type MotifCut = { dataUrl: string; width: number; height: number }

/**
 * A motif page: the plain background (a flat colour or a smooth gradient) becomes transparent, so what is left, such as contour
 * lines, a marker or a route, can be laid over any background. `strength` is how different from the background a pixel has to be
 * to stay; `crop` trims the empty margin (leave it off for a pattern that must cover the whole slide).
 */
export function cutMotif(bitmap: ImageBitmap, { strength = 8, crop = false }: { strength?: number; crop?: boolean } = {}): MotifCut | null {
  const { canvas, data } = pixelsOf(bitmap, 1600)
  const cut = removeBackground(data, { threshold: strength, softness: Math.max(20, strength * 2), model: 'cells' })
  const box = crop ? contentBox(cut) : { x: 0, y: 0, w: cut.width, h: cut.height }
  if (!box || box.w < 8 || box.h < 8 || !contentBox(cut, 8, 0)) return null
  const full = document.createElement('canvas')
  full.width = canvas.width
  full.height = canvas.height
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(cut.data), cut.width, cut.height), 0, 0)
  const out = document.createElement('canvas')
  out.width = box.w
  out.height = box.h
  out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
  return { dataUrl: out.toDataURL('image/png'), width: box.w, height: box.h }
}
