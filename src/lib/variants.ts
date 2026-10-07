import { newId, now } from './types.ts'
import type { Campaign, Post } from './types.ts'

/**
 * A revision of a slide is a copy that points back to the slide it was made from (`variantOf`).
 * Only one of a slide and its variants is exported: the others are `excluded`.
 */

export const rootOf = (post: Post): string => post.variantOf ?? post.id

/** Inserts a revised copy right after the last slide of the same family, not exported until chosen. */
export function addVariant(campaign: Campaign, source: Post, revised: Post, id: string = newId()): Post {
  const root = rootOf(source)
  const rootPost = campaign.posts.find((post) => post.id === root) ?? source
  const family = campaign.posts.filter((post) => rootOf(post) === root)
  const variant: Post = {
    ...structuredClone(revised),
    id,
    name: `${rootPost.name} · chỉnh ${family.length}`,
    variantOf: root,
    excluded: true,
    updatedAt: now(),
  }
  const lastIndex = Math.max(...family.map((post) => campaign.posts.indexOf(post)))
  campaign.posts.splice(lastIndex + 1, 0, variant)
  return variant
}

/** Makes `chosen` the exported version of its family and sets the others aside. */
export function chooseVersion(campaign: Campaign, chosenId: string): void {
  const chosen = campaign.posts.find((post) => post.id === chosenId)
  if (!chosen) return
  const root = rootOf(chosen)
  for (const post of campaign.posts) if (rootOf(post) === root) post.excluded = post.id !== chosenId
}

/** Removes a slide together with every revision made from it. */
export function removeFamily(campaign: Campaign, id: string): void {
  campaign.posts = campaign.posts.filter((post) => post.id !== id && post.variantOf !== id)
}

/** Removes one revision; if it was the exported one, the original becomes exported again. */
export function removeVariant(campaign: Campaign, id: string): void {
  const variant = campaign.posts.find((post) => post.id === id)
  if (!variant?.variantOf) return
  const root = variant.variantOf
  const wasUsed = !variant.excluded
  campaign.posts = campaign.posts.filter((post) => post.id !== id)
  if (wasUsed) chooseVersion(campaign, root)
}
