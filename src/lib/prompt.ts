import { formatOf, type Campaign, type FormatKey, type Workspace } from './types.ts'

/**
 * Where the text will sit, as fractions of the image height measured from the top. The scene may only use the free band.
 * Measured from the real layout of the slides (see plate.ts), not guessed.
 */
export type Zones = { logoBottom: number; textTop: number; textBottom: number; lower: number; freeFrom: number; freeTo: number }

const percent = (value: number) => `${Math.round(value * 100)}%`

/** Clauses that ask for cards, tickets or panels are dropped: those are layout, added later, and the model draws them as blank rectangles under the text. */
const LAYOUT_WORDS = /(thẻ|card|boarding|panel|\bvé\b|ticket|giao diện|\bui\b|khung chứa|nút bấm|button)/i
export const sceneConcept = (concept: string) => concept
  // Split at ";" too: the brief often joins the star, the route and the card in one sentence, and only the card clause may go.
  .split(/(?<=[.!?;])\s+/)
  .filter((clause) => !LAYOUT_WORDS.test(clause))
  .join(' ')
  .replace(/[;,]\s*$/, '.')
  .trim()

/** Main-symbol images first, then mood images, at most four (what the image models accept). Sample posts are never sent. */
export function generationRefs(kv: Campaign['keyVisual']): string[] {
  return [...(kv.subjectIds ?? []), ...kv.referenceIds].slice(0, 4)
}

/** Builds a background-plate prompt from the campaign's key visual inputs. No text is ever requested from the model. */
export function buildBackgroundPrompt(workspace: Workspace, campaign: Campaign, format: FormatKey, variation: string, zones?: Zones): string {
  const { company } = workspace
  const kv = campaign.keyVisual
  const { width, height } = formatOf(format)
  const refs = generationRefs(kv)
  const subjects = refs.filter((id) => (kv.subjectIds ?? []).includes(id)).length
  const moods = refs.length - subjects
  const lines = [
    `Create a background image plate for a social media post (${width}x${height}). Text and logo are added later in a separate layout step.`,
    kv.concept && `Key visual concept: ${zones ? sceneConcept(kv.concept) : kv.concept}`,
    kv.subject && `Main visual element: ${kv.subject}`,
    subjects > 0 && `The first ${subjects} attached image(s) show the campaign's main visual symbol. Keep that symbol recognisable (its shape and colors) in the scene, placed in the lower part of the frame.`,
    moods > 0 && `The ${subjects ? 'other' : ''} ${moods} attached image(s) are mood references. Take ONLY their color grading, lighting, atmosphere and material feel. Do not copy any object, card, panel, ticket, badge, icon, frame, line, chart, text or layout from them.`,
    kv.palette.length > 0 && `Color palette (use as the dominant colors): ${kv.palette.join(', ')}.`,
    `Mood: ${[company.tone, company.industry].filter(Boolean).join(', ') || 'polished and professional'}. Brand: ${company.name}${company.audience ? `, audience: ${company.audience}` : ''}.`,
    zones ? zoneLines(zones, format, kv.textTone === 'light') : `Composition: the headline, lead text, button and footer are added on top later, so the upper 55% of the frame must be calm, dark and empty: only a soft gradient, faint stars or haze, with no cards, tickets, panels, icons, lines or bright glows there. Put the horizon, the main subject and every graphic element in the lower 40% of the frame, with the brightest point below the middle. ${format === 'story' ? 'For stories, also keep the top and bottom 13% completely clear. ' : ''}`,
    variation && `Variation for this version: ${variation}`,
    kv.avoid && `Avoid: ${kv.avoid}.`,
    'Strictly no rendered text, letters, numbers, logos or watermarks anywhere in the image.',
  ]
  return lines.filter(Boolean).join('\n\n')
}

/** The composition instruction when the text layout is known. */
function zoneLines(zones: Zones, format: FormatKey, lightText: boolean): string {
  const tone = lightText ? 'dark' : 'light'
  const free = zones.freeTo - zones.freeFrom
  return [
    'Composition. Headline and lead text, a button and a footer are laid over this picture afterwards. Their positions are measured, as a percentage of the image height from the top edge:',
    `- 0%–${percent(zones.textTop)}: top margin with a small logo. Calm and ${tone}.`,
    `- ${percent(zones.textTop)}–${percent(zones.textBottom)}: headline and lead text across most of the width. THIS BAND MUST BE CALM AND ${tone.toUpperCase()}: a smooth soft gradient, haze or very faint stars only. No horizon line, planet, star, glow, route line, building or any bright or detailed element crosses it.`,
    `- ${percent(zones.lower)}–100%: button and footer. Calm and ${tone} as well.`,
    free >= 0.12
      ? `All scenery (horizon, planet, the main symbol, glows, route lines) belongs ONLY between ${percent(zones.freeFrom)} and ${percent(zones.freeTo)} of the height, with its brightest point inside that band.${free < 0.2 ? ' The band is narrow: keep the scene compact and low.' : ''}`
      : `There is almost no free space, so keep the whole picture a calm ${tone} gradient with only a faint soft glow near ${percent(zones.freeFrom)}–${percent(Math.min(1, zones.freeFrom + 0.1))}.`,
    'Do not draw any card, panel, ticket, frame, button, badge, window, label or text-like shape anywhere, including blank glass or frosted rectangles. They are added by the layout, never by the picture.',
    format === 'story' ? 'For stories also keep the top and bottom 13% completely clear.' : '',
  ].filter(Boolean).join('\n')
}
