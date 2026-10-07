import { formatOf, type Campaign, type FormatKey, type Workspace } from './types.ts'

/** Builds a background-plate prompt from the campaign's key visual inputs. No text is ever requested from the model. */
export function buildBackgroundPrompt(workspace: Workspace, campaign: Campaign, format: FormatKey, variation: string): string {
  const { company } = workspace
  const kv = campaign.keyVisual
  const { width, height } = formatOf(format)
  const lines = [
    `Create a background image plate for a social media post (${width}x${height}). Text and logo are added later in a separate layout step.`,
    kv.concept && `Key visual concept: ${kv.concept}`,
    kv.subject && `Main visual element: ${kv.subject}`,
    kv.referenceIds.length > 0 && 'The attached reference images are finished sample posts that show the target look. Match their art style, color grading, lighting, atmosphere and graphic elements, but reproduce only the background scene: leave out every piece of text, logo, button and UI card that appears on them.',
    kv.palette.length > 0 && `Color palette (use as the dominant colors): ${kv.palette.join(', ')}.`,
    `Mood: ${[company.tone, company.industry].filter(Boolean).join(', ') || 'polished and professional'}. Brand: ${company.name}${company.audience ? `, audience: ${company.audience}` : ''}.`,
    `Composition: the headline, lead text, button and footer are added on top later, so the upper 55% of the frame must be calm, dark and empty: only a soft gradient, faint stars or haze, with no cards, tickets, panels, icons, lines or bright glows there. Put the horizon, the main subject and every graphic element in the lower 40% of the frame, with the brightest point below the middle. ${format === 'story' ? 'For stories, also keep the top and bottom 13% completely clear. ' : ''}`,
    variation && `Variation for this version: ${variation}`,
    kv.avoid && `Avoid: ${kv.avoid}.`,
    'Strictly no rendered text, letters, numbers, logos or watermarks anywhere in the image.',
  ]
  return lines.filter(Boolean).join('\n\n')
}
