import { api } from './api.ts'
import { contentBox, removeBackground } from './cutout.ts'
import { loadImage } from './render.ts'
import { newId } from './types.ts'
import type { Campaign, Component } from './types.ts'

export async function imageSize(assetId: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(assetId)
  if (!image) throw new Error('Không mở được ảnh.')
  return { width: image.naturalWidth, height: image.naturalHeight }
}

/** Finds the campaign component that wraps this image, or adds one (so any image can be placed as a layer). */
export function componentFor(campaign: Campaign, assetId: string, name: string, size: { width: number; height: number }): Component {
  const existing = campaign.components.find((item) => item.assetId === assetId)
  if (existing) return existing
  const created: Component = { id: newId(), name, assetId, width: size.width, height: size.height }
  campaign.components.push(created)
  return created
}

/**
 * Cuts a subject out of a photo taken against a plain backdrop (studio portrait, product on a table).
 * It models the border color, so it does not work for busy backgrounds; use the manual cutter for those.
 */
export async function removePlainBackground(assetId: string): Promise<string> {
  const image = await loadImage(assetId)
  if (!image) throw new Error('Không mở được ảnh.')
  const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * ratio)
  canvas.height = Math.round(image.naturalHeight * ratio)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const cut = removeBackground(ctx.getImageData(0, 0, canvas.width, canvas.height), { threshold: 40, softness: 45 })
  const box = contentBox(cut)
  if (!box || box.w < 40 || box.h < 40) throw new Error('Không tách được: nền ảnh không đồng nhất. Hãy dùng "Cắt từ ảnh/PDF" để cắt thủ công.')
  const out = document.createElement('canvas')
  out.width = box.w
  out.height = box.h
  const octx = out.getContext('2d')!
  const full = document.createElement('canvas')
  full.width = canvas.width
  full.height = canvas.height
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(cut.data), cut.width, cut.height), 0, 0)
  octx.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
  return api.uploadAsset('cutout.png', out.toDataURL('image/png'))
}

/** "Video/portrait thật; credential; consent" -> one slot per item. */
export function splitAssetList(text: string): string[] {
  return text.split(/[;\n]+/).map((part) => part.trim().replace(/\.$/, '')).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1))
}
