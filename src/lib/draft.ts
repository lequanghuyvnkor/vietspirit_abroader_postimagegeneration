import { api } from './api.ts'
import { buildCaptionRequest, buildDraftRequest, buildEditRequest, parseDraft, type Draft } from './ai.ts'
import { draftSlides } from './plan.ts'
import { inferBeats } from './beats.ts'
import { splitSlides } from './text.ts'
import { now } from './types.ts'
import type { Campaign, Company, Piece, Workspace } from './types.ts'

export const slideCountOf = (campaign: Campaign, piece: Piece) =>
  campaign.posts.filter((post) => post.pieceId === piece.id && !post.variantOf).length || (piece.kind === 'reel' ? inferBeats(piece).length : splitSlides(piece.plan.structure).length) || 1

/** Asks the chosen provider for slide copy (and caption/hashtags when the plan has none). */
export async function fetchDraft(workspace: Workspace, campaign: Campaign, piece: Piece, keyId?: string): Promise<Draft> {
  const { system, prompt } = buildDraftRequest(workspace, campaign, piece, slideCountOf(campaign, piece))
  const { text } = await api.generateText({ system, prompt, json: true, keyId })
  return parseDraft(text)
}

/** Rewrites the caption (and hashtags) of a piece, even when the plan already has one. */
export async function fetchCaption(workspace: Workspace, campaign: Campaign, piece: Piece, keyId?: string): Promise<{ caption: string; hashtags: string }> {
  const { system, prompt } = buildCaptionRequest(workspace, campaign, piece)
  const { text } = await api.generateText({ system, prompt, json: true, keyId })
  const first = parseDraft(text)
  if (!first.caption) throw new Error('AI không trả về caption. Thử lại.')
  // Second pass: an editor checks the draft against the writing rules; if it fails, the first draft is still usable.
  try {
    const edit = buildEditRequest(workspace, campaign, piece, first)
    const reply = await api.generateText({ system: edit.system, prompt: edit.prompt, json: true, keyId })
    const edited = parseDraft(reply.text)
    if (edited.caption.length > 40) return { caption: edited.caption, hashtags: edited.hashtags || first.hashtags }
  } catch { /* keep the first draft */ }
  return first
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
