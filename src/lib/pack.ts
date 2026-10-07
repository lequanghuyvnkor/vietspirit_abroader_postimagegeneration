import { strToU8, zipSync } from 'fflate'
import { renderBlob } from './render.ts'
import { applyVars } from './text.ts'
import type { Campaign, Piece, Workspace } from './types.ts'

/** The slides that are exported (revisions not chosen and superseded originals are left out). */
export const slidesOf = (campaign: Campaign, piece: Piece) => campaign.posts.filter((post) => post.pieceId === piece.id && !post.excluded)

/** Every slide of the piece, revisions included, in display order. */
export const allSlidesOf = (campaign: Campaign, piece: Piece) => campaign.posts.filter((post) => post.pieceId === piece.id)

/** The original slides only: what the plan and the AI draft work on. */
export const baseSlidesOf = (campaign: Campaign, piece: Piece) => campaign.posts.filter((post) => post.pieceId === piece.id && !post.variantOf)

export function downloadBlob(blob: Blob, name: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

/**
 * Zips the finished images and caption of the given pieces. With `nested`, each piece gets its own folder
 * (for a whole campaign); otherwise files sit at the top level (for a single piece).
 */
export async function buildPack(workspace: Workspace, campaign: Campaign, pieces: Piece[], nested: boolean, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const total = pieces.reduce((sum, piece) => sum + slidesOf(campaign, piece).length, 0)
  const files: Record<string, Uint8Array> = {}
  let done = 0
  for (const piece of pieces) {
    const folder = nested ? `${piece.code}/` : ''
    for (const [index, post] of slidesOf(campaign, piece).entries()) {
      files[`${folder}${piece.code}-${String(index + 1).padStart(2, '0')}.png`] = new Uint8Array(await (await renderBlob(post, campaign, workspace)).arrayBuffer())
      onProgress?.(++done, total)
    }
    files[`${folder}${piece.code}-caption.txt`] = strToU8(applyVars([piece.caption, piece.hashtags].filter(Boolean).join('\n\n'), campaign.variables))
  }
  return new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' })
}
