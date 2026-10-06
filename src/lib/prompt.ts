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
    `Composition: keep the upper third and the lower fifth calm and uncluttered so a headline, a button and a footer can sit on top. ${format === 'story' ? 'For stories, keep the top and bottom 13% completely clear. ' : ''}`,
    variation && `Variation for this version: ${variation}`,
    kv.avoid && `Avoid: ${kv.avoid}.`,
    'Strictly no rendered text, letters, numbers, logos or watermarks anywhere in the image.',
  ]
  return lines.filter(Boolean).join('\n\n')
}
