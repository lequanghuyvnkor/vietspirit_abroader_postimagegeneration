import { api } from './api.ts'
import { buildDraftRequest, parseDraft, type Draft } from './ai.ts'
import { draftSlides, formatKeyOf } from './plan.ts'
import { buildBackgroundPrompt, generationRefs } from './prompt.ts'
import { splitSlides } from './text.ts'
import { formatOf, newId, now } from './types.ts'
import type { Campaign, Company, FormatKey, Piece, Workspace } from './types.ts'

export const slideCountOf = (campaign: Campaign, piece: Piece) =>
  campaign.posts.filter((post) => post.pieceId === piece.id && !post.variantOf).length || splitSlides(piece.plan.structure).length || 1

/** Asks the chosen provider for slide copy (and caption/hashtags when the plan has none). */
export async function fetchDraft(workspace: Workspace, campaign: Campaign, piece: Piece, keyId?: string): Promise<Draft> {
  const { system, prompt } = buildDraftRequest(workspace, campaign, piece, slideCountOf(campaign, piece))
  const { text } = await api.generateText({ system, prompt, json: true, keyId })
  return parseDraft(text)
}

/** Writes a draft into the campaign's slides for the piece, creating the slides if there are none. */
export function applyDraft(campaign: Campaign, pieceId: string, draft: Draft, company: Company): void {
  const piece = campaign.pieces.find((item) => item.id === pieceId)
  if (!piece) return
  let targets = campaign.posts.filter((post) => post.pieceId === pieceId && !post.variantOf)
  if (targets.length === 0) {
    campaign.posts.push(...draftSlides(piece, company, campaign.backgrounds))
    targets = campaign.posts.filter((post) => post.pieceId === pieceId && !post.variantOf)
  }
  targets.forEach((post, index) => {
    const slide = draft.slides[index]
    if (slide) Object.assign(post, { eyebrow: slide.eyebrow, headline: slide.headline, accent: slide.accent, subtitle: slide.subtitle, cta: slide.cta, updatedAt: now() })
  })
  if (!piece.caption.trim() && draft.caption) piece.caption = draft.caption
  if (!piece.hashtags.trim() && draft.hashtags) piece.hashtags = draft.hashtags
  if (piece.status === 'brief') piece.status = 'copy'
}

/** Generates one background plate from the piece's visual brief. */
export async function generatePieceBackground(workspace: Workspace, campaign: Campaign, piece: Piece, keyId?: string): Promise<{ assetId: string; format: FormatKey; label: string }> {
  const format = formatKeyOf(piece.visual.format)
  const [width, height] = formatOf(format).generate
  const variation = [piece.visual.hero, piece.visual.palette && `Palette: ${piece.visual.palette}`, piece.visual.avoid && `Tránh: ${piece.visual.avoid}`].filter(Boolean).join('. ')
  const assetId = await api.generate({ prompt: buildBackgroundPrompt(workspace, campaign, format, variation), width, height, quality: 'high', referenceIds: generationRefs(campaign.keyVisual), keyId })
  return { assetId, format, label: `${piece.code} · ${piece.visual.hero.slice(0, 28) || 'nền'}` }
}

/** Saves a generated background and uses it on the piece's slides of the same format. */
export function attachBackground(campaign: Campaign, pieceId: string, result: { assetId: string; format: FormatKey; label: string }): void {
  const id = newId()
  campaign.backgrounds.push({ id, assetId: result.assetId, format: result.format, label: result.label })
  campaign.posts.filter((post) => post.pieceId === pieceId && post.format === result.format).forEach((post) => { post.backgroundId = id })
}
