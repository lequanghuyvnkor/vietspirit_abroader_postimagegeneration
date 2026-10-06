export type FormatKey = 'feed' | 'square' | 'story' | 'cover'

export type Company = {
  name: string
  industry: string
  audience: string
  tone: string
  /** Footer line on posts, e.g. page name · hotline. */
  footer: string
  /** Logo for light backgrounds. */
  logoId: string | null
  /** Optional logo variant for dark backgrounds. */
  logoDarkId: string | null
}

export type KeyVisual = {
  concept: string
  subject: string
  /** HEX colors; the first three also form the fallback gradient. */
  palette: string[]
  accentColor: string
  /** 'light' = light text on a dark background, 'dark' = the opposite. */
  textTone: 'light' | 'dark'
  displayFont: string
  displayFontAssetId: string | null
  bodyFont: string
  avoid: string
  /** Free-form guideline notes (graphic elements, layout, mood) fed into the image prompt. */
  guideline: string
  referenceIds: string[]
}

export type Background = {
  id: string
  assetId: string
  format: FormatKey
  label: string
}

export type Post = {
  id: string
  name: string
  format: FormatKey
  eyebrow: string
  headline: string
  /** Rendered on its own line(s) in the accent color. */
  accent: string
  subtitle: string
  cta: string
  footer: string
  backgroundId: string | null
  scrim: boolean
  layers: Layer[]
  updatedAt: string
}

/** A full-size image (PDF page or upload) that components are cut from. */
export type Source = { id: string; assetId: string; label: string }

/** A cut-out graphic element (transparent PNG) reusable across the campaign's posts. */
export type Component = { id: string; name: string; assetId: string; width: number; height: number }

/** A component placed on a post. Position is the center, as a fraction of the canvas. */
export type Layer = { id: string; componentId: string; x: number; y: number; /** width as a fraction of canvas width */ w: number; opacity: number; rotation: number }

export type Campaign = {
  id: string
  name: string
  keyVisual: KeyVisual
  backgrounds: Background[]
  sources: Source[]
  components: Component[]
  posts: Post[]
  updatedAt: string
}

export type Workspace = {
  id: string
  name: string
  company: Company
  campaigns: Campaign[]
  updatedAt: string
}

export type Store = { workspaces: Workspace[] }

export type Format = { key: FormatKey; label: string; width: number; height: number; generate: [number, number] }

export const FORMATS: Format[] = [
  { key: 'feed', label: 'Feed dọc 4:5', width: 1080, height: 1350, generate: [1088, 1344] },
  { key: 'square', label: 'Vuông 1:1', width: 1080, height: 1080, generate: [1088, 1088] },
  { key: 'story', label: 'Story 9:16', width: 1080, height: 1920, generate: [1088, 1920] },
  { key: 'cover', label: 'Bìa 1640×624', width: 1640, height: 624, generate: [1632, 624] },
]

export function formatOf(key: FormatKey): Format {
  return FORMATS.find((format) => format.key === key) ?? FORMATS[0]
}

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

export function emptyCompany(name = ''): Company {
  return { name, industry: '', audience: '', tone: '', footer: '', logoId: null, logoDarkId: null }
}

export function emptyKeyVisual(): KeyVisual {
  return {
    concept: '', subject: '', palette: ['#0A1A44', '#12307A', '#1B4AA8'], accentColor: '#FF4D5E', textTone: 'light',
    displayFont: 'Playfair Display', displayFontAssetId: null, bodyFont: 'Be Vietnam Pro', avoid: '', guideline: '', referenceIds: [],
  }
}

export function newPost(name: string, company: Company): Post {
  return {
    id: newId(), name, format: 'feed', eyebrow: '', headline: '', accent: '', subtitle: '', cta: '',
    footer: company.footer, backgroundId: null, scrim: true, layers: [], updatedAt: now(),
  }
}

export function newCampaign(name: string, keyVisual: KeyVisual = emptyKeyVisual(), sources: Source[] = []): Campaign {
  return { id: newId(), name, keyVisual, backgrounds: [], sources, components: [], posts: [], updatedAt: now() }
}
