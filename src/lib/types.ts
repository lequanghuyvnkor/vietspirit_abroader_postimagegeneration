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
  /** Logo height on the canvas, in px at 1080 wide (default 64). */
  logoHeight?: number
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
  /** Main visual element images (extracted from the key visual or added by hand); sent first as generation references. */
  subjectIds: string[]
  /** Moodboard images for atmosphere, color and light only. */
  referenceIds: string[]
  /** Finished sample posts on the moodboard: shown for reference, never sent to the image model. */
  sampleIds: string[]
}

export type Background = {
  id: string
  assetId: string
  format: FormatKey
  label: string
}

/** How the brand logo sits on one post. All fields optional: the defaults are top-left, workspace size, picked by background tone. */
export type LogoPlacement = {
  position?: 'top-left' | 'top-center' | 'top-right'
  /** Multiplier on the workspace logo height. */
  scale?: number
  /** Which logo file: for light backgrounds, or for dark ones. Default follows the campaign's text tone. */
  variant?: 'light' | 'dark'
  hidden?: boolean
}

export type Post = {
  id: string
  name: string
  /** Content piece (from the plan) this slide belongs to. */
  pieceId?: string
  /** Set when this slide is a revision made from another slide (the id of the original). */
  variantOf?: string
  /** Kept but not exported: a superseded original or a revision not chosen yet. */
  excluded?: boolean
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
  logo?: LogoPlacement
  /** Reel scenes: seconds on screen (default 3). */
  duration?: number
  /** Multiplier for the headline and lead text size (default 1). */
  textScale?: number
  /** Where the text block sits between the logo and the CTA/footer (default top). */
  textAnchor?: 'top' | 'middle' | 'bottom'
  /** Extra soft darkening/lightening patches, in canvas fractions, for legibility. */
  shades?: Shade[]
  updatedAt: string
}

export type Shade = { x: number; y: number; w: number; h: number; strength: number; tone: 'dark' | 'light' }

export type PieceKind = 'static' | 'carousel' | 'reel'
/** Who makes the piece: made in this app, or handed to another team (reels with real people). */
export type Production = 'internal' | 'external'
export type PieceStatus = 'brief' | 'copy' | 'visual' | 'review' | 'ready'

export const STATUS_LABELS: Record<PieceStatus, string> = { brief: 'Brief', copy: 'Copy', visual: 'Visual', review: 'Chờ duyệt', ready: 'Sẵn sàng' }

export type PiecePlan = {
  funnel: string; pillar: string; format: string; goal: string; hook: string; structure: string; cta: string
  audience: string; kpi: string; paid: string; conditions: string; story: string; time: string
}

export type VisualBrief = {
  format: string; hero: string; layout: string; typography: string; palette: string
  onImage: string; motion: string; assets: string; avoid: string
}

/** A piece of real material the piece needs (mentor portrait, logo, credential, consent...). */
export type PieceAsset = { id: string; label: string; assetId: string | null; done: boolean; note: string }

export type Check = { id: string; text: string; owner: string; done: boolean }

/** One planned content item (a post, carousel or reel). Carousel slides are `Post`s that point back here. */
export type Piece = {
  id: string
  code: string
  title: string
  kind: PieceKind
  /** Publish date (YYYY-MM-DD), set by the team. */
  date: string
  status: PieceStatus
  plan: PiecePlan
  visual: VisualBrief
  caption: string
  hashtags: string
  compliance: string
  checks: Check[]
  assets: PieceAsset[]
  production: Production
  /** Hand-off note for whoever produces it (shown in the plan and in the hand-off brief). */
  productionNote: string
}

/** A full-size image (PDF page or upload) that components are cut from. */
export type Source = { id: string; assetId: string; label: string }

/** A cut-out graphic element (transparent PNG) reusable across the campaign's posts. */
export type Component = { id: string; name: string; assetId: string; width: number; height: number }

/** A component placed on a post. Position is the center, as a fraction of the canvas. */
export type Layer = { id: string; componentId: string; x: number; y: number; /** width as a fraction of canvas width */ w: number; opacity: number; rotation: number }

export type Kpi = { id: string; label: string; target: string }
export type Audience = { id: string; name: string; insight: string; barrier: string }
export type Pillar = { id: string; name: string; message: string; proof: string }

/** The campaign's communication foundation: what every post, AI prompt and check is built on. */
export type Foundation = {
  objective: string
  /** Campaign period, YYYY-MM-DD. */
  start: string
  end: string
  kpis: Kpi[]
  audiences: Audience[]
  bigIdea: string
  keyMessage: string
  pillars: Pillar[]
  tone: string
  dos: string[]
}

/** Link to the campaign's Google Docs (through an Apps Script web app) and what was last sent to it. */
export type DocsSync = {
  url: string
  doc: string
  /** Re-send the changed pieces a few seconds after any edit. */
  auto: boolean
  /** Per piece id: fingerprint of the content and images last sent. */
  sent: Record<string, string>
}

export type Campaign = {
  id: string
  name: string
  keyVisual: KeyVisual
  backgrounds: Background[]
  sources: Source[]
  components: Component[]
  posts: Post[]
  pieces: Piece[]
  /** Values for [PLACEHOLDER] tokens, filled once and applied everywhere. */
  variables: Record<string, string>
  foundation: Foundation
  docsSync?: DocsSync
  /** Campaign strategy text given to the AI as context. */
  strategy: string
  /** "Do not say" statements from the plan, shown as reference. */
  guardrailNotes: string[]
  /** Extra phrases flagged when they appear in copy. */
  guardrails: string[]
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
    displayFont: 'Playfair Display', displayFontAssetId: null, bodyFont: 'Be Vietnam Pro', avoid: '', subjectIds: [], referenceIds: [], sampleIds: [],
  }
}

export function newPost(name: string, company: Company): Post {
  return {
    id: newId(), name, format: 'feed', eyebrow: '', headline: '', accent: '', subtitle: '', cta: '',
    footer: company.footer, backgroundId: null, scrim: true, layers: [], updatedAt: now(),
  }
}

export function newCampaign(name: string, keyVisual: KeyVisual = emptyKeyVisual(), sources: Source[] = []): Campaign {
  return { id: newId(), name, keyVisual, backgrounds: [], sources, components: [], posts: [], pieces: [], variables: {}, foundation: { objective: '', start: '', end: '', kpis: [], audiences: [], bigIdea: '', keyMessage: '', pillars: [], tone: '', dos: [] }, strategy: '', guardrailNotes: [], guardrails: [], updatedAt: now() }
}
