import { compositeMode } from './motifs.ts'
import { formatOf, type Campaign, type FormatKey, type Workspace } from './types.ts'

/**
 * Where the text will sit, as fractions of the image height measured from the top. The scene may only use the free band.
 * Measured from the real layout of the slides (see plate.ts), not guessed.
 */
export type Zones = { logoBottom: number; textTop: number; textBottom: number; lower: number; freeFrom: number; freeTo: number }

const percent = (value: number) => `${Math.round(value * 100)}%`

/** Clauses that ask for cards, tickets or panels are dropped: those are layout, added later, and the model draws them as blank rectangles under the text. */
const LAYOUT_WORDS = /(thẻ|card|boarding|panel|\bvé\b|ticket|giao diện|\bui\b|khung chứa|nút bấm|button)/i
/** Clauses that describe the brand symbol or its route lines: in composite mode the app draws those itself, so the AI must not hear about them. */
const MOTIF_WORDS = /(ngôi sao|chòm sao|sao|quỹ đạo|đường bay|vệt|route|orbit|flight path|constellation|star)/i
export const sceneConcept = (concept: string, composite = false) => concept
  // Split at ";" too: the brief often joins the star, the route and the card in one sentence, and only the card clause may go.
  .split(/(?<=[.!?;])\s+/)
  .filter((clause) => !LAYOUT_WORDS.test(clause) && !(composite && MOTIF_WORDS.test(clause)))
  .join(' ')
  .replace(/[;,]\s*$/, '.')
  .trim()

/** The moodboard reference images, at most four (what the image models accept). Images kept only for viewing are never sent. */
export const generationRefs = (kv: Campaign['keyVisual']): string[] => kv.referenceIds.slice(0, 4)

/** Builds a background-plate prompt from the campaign's key visual inputs. No text is ever requested from the model. */
export function buildBackgroundPrompt(workspace: Workspace, campaign: Campaign, format: FormatKey, variation: string, zones?: Zones): string {
  const { company } = workspace
  const kv = campaign.keyVisual
  const { width, height } = formatOf(format)
  const composite = compositeMode(campaign)
  const refs = generationRefs(kv).length
  const lines = [
    `Create a background image plate for a social media post (${width}x${height}). Text and logo are added later in a separate layout step.`,
    kv.concept && `Moodboard concept: ${zones || composite ? sceneConcept(kv.concept, composite) : kv.concept}`,
    composite && 'IMPORTANT: the brand graphics (patterns, symbols, lines and small ornaments) are placed on top afterwards by the app as separate transparent images. Do NOT draw any symbol, star, constellation, route line, orbit, contour line, grid, map line, pattern, arrow or ornament anywhere. Keep the whole picture as clean atmosphere only (smooth gradient, soft glow, gentle depth) where those graphics will sit.',
    refs > 0 && (kv.refFidelity === 'style'
      ? `The ${refs} attached image(s) are moodboard references of the campaign's look. Take ONLY their color grading, lighting, atmosphere and material feel. Do not copy any object, card, panel, ticket, badge, icon, frame, line, chart, text or layout from them.`
      : `The ${refs} attached image(s) are finished sample posts of this campaign. Match their overall look as closely as you can: color grading, lighting, depth, the kind of scenery, the level of detail and the visual style, so the new picture could sit in the same series. Do not copy any text, logo, card, panel, ticket, badge, icon, frame or chart from them; those are added separately.`),
    kv.palette.length > 0 && `Color palette (use as the dominant colors): ${kv.palette.join(', ')}.`,
    `Mood: ${[company.tone, company.industry].filter(Boolean).join(', ') || 'polished and professional'}. Brand: ${company.name}${company.audience ? `, audience: ${company.audience}` : ''}.`,
    zones ? zoneLines(zones, format, kv.textTone === 'light') : `Composition: the headline, lead text, button and footer are added on top later, so the upper 55% of the frame must be calm, dark and empty: only a soft gradient or faint haze, with no cards, tickets, panels, icons, lines or bright glows there. Put the scene detail in the lower 40% of the frame, with the brightest point below the middle. ${format === 'story' ? 'For stories, also keep the top and bottom 13% completely clear. ' : ''}`,
    variation && `Variation for this version: ${variation}`,
    kv.avoid && `Avoid: ${kv.avoid}.`,
    'Strictly no rendered text, letters, numbers, logos or watermarks anywhere in the image.',
  ]
  return lines.filter(Boolean).join('\n\n')
}

/** The composition instruction when the text layout is known. The scene itself comes from the moodboard concept and references, never from here. */
function zoneLines(zones: Zones, format: FormatKey, lightText: boolean): string {
  const tone = lightText ? 'dark' : 'light'
  const horizon = Math.min(0.78, Math.max(0.36, zones.freeFrom))
  const free = zones.freeTo - zones.freeFrom
  return [
    'Composition. Headline and lead text, a button and a footer are laid over this picture afterwards.',
    `The upper ${percent(horizon)} of the frame is calm ${tone} space behind that text: smooth, deep, within the palette, changing only slightly toward the lower part. Nothing sharp, bright or detailed in it.`,
    'Below it the rest of the frame carries the scene described in the moodboard concept, down to the bottom edge, with no empty strip and with the detail concentrated there. Keep the lowest 15% a calmer, darker part so a footer line stays readable.',
    free < 0.12 ? 'The text needs most of the height, so keep the scene compact and low and the upper part quiet.' : '',
    'ONE continuous image. All tone changes are smooth and gradual. Never paint horizontal bands, stripes, steps, flat dark rectangles, vignette boxes or visible seams at any height.',
    'Do not draw any card, panel, ticket, frame, button, badge, window, label or text-like shape anywhere, including blank glass or frosted rectangles. They are added by the layout, never by the picture.',
    'Style: exactly the medium, color grading and level of detail of the moodboard concept and the attached references. Do not invent another theme, genre or subject.',
    format === 'story' ? 'For stories also keep the top and bottom 13% completely clear.' : '',
  ].filter(Boolean).join('\n')
}
