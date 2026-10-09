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

/** A real photo that leads a slide (a mentor's portrait). Never drawn by AI: the app only places and frames it. */
export type HeroPhoto = {
  assetId: string
  /** bottom: a card under the text; right: a card at the right with the text in a column on the left; full: the photo fills the slide. */
  layout: 'bottom' | 'right' | 'full'
  /** rounded: a rounded card; circle: a round portrait; cutout: a background-removed photo standing on the slide. */
  shape: 'rounded' | 'circle' | 'cutout'
  /** Vertical focus of the crop, 0 = top, 1 = bottom (faces sit in the upper part, so the default is 0.3). */
  focusY?: number
  /** Name plate over the photo: first line in bold (the name), the rest smaller (school, verified achievement). [VARIABLES] are filled. */
  caption?: string
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
  /** Which part of the background shows: a zoom and a shift (-1..1 of the spare room), so slides sharing one picture look like a pan. */
  bgView?: { zoom: number; x: number; y: number }
  hero?: HeroPhoto
  /** A frosted panel behind the text, for backgrounds with no calm place for it. */
  panel?: boolean
  /** Carousel page dots and the swipe arrow (default on for slides of a carousel). */
  chrome?: boolean
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
export type PieceStatus = 'brief' | 'copy' | 'visual' | 'ready'

export const STATUS_LABELS: Record<PieceStatus, string> = { brief: 'Brief', copy: 'Copy', visual: 'Visual', ready: 'Sẵn sàng' }

export type PiecePlan = {
  funnel: string; pillar: string; format: string; goal: string; hook: string; structure: string; cta: string
  audience: string; time: string
}

export type VisualBrief = {
  format: string; hero: string; layout: string; typography: string; palette: string
  onImage: string; motion: string; assets: string; avoid: string
}

/** A piece of real material the piece needs (mentor portrait, logo, credential, consent...). */
export type PieceAsset = { id: string; label: string; assetId: string | null; done: boolean; note: string }

export type Check = { id: string; text: string; owner: string; done: boolean }



/** What a piece looked like at one moment: enough to restore it. Pictures stay referenced by background id. */
export type PieceSnapshot = { title: string; date: string; plan: PiecePlan; visual: VisualBrief; caption: string; hashtags: string; checks: Check[]; posts: Post[] }

export type PieceVersionEvent = 'manual' | 'restore'

export type PieceVersion = { id: string; at: string; event: PieceVersionEvent; note: string; snapshot: PieceSnapshot }


/** The real publication of a piece: when it actually went out and where. */
export type Published = { at: string; url: string; note: string }

/** Results typed in by hand from the platform's insights. `null` = not entered. */
export type Metrics = { reach: number | null; engagement: number | null; clicks: number | null; leads: number | null; updatedAt: string }

/** One piece of a reusable template: the plan without dates, captions, pictures or results. */
export type TemplatePiece = { title: string; kind: PieceKind; plan: PiecePlan; visual: VisualBrief; production: Production; productionNote: string; checks: { text: string; owner: string }[]; /** Days after the campaign start. */ dayOffset: number | null }

export type CampaignTemplate = {
  id: string
  name: string
  at: string
  strategy: string
  foundation: Foundation
  /** Look of the key visual without any picture (pictures stay with the campaign they belong to). */
  style: Pick<KeyVisual, 'concept' | 'subject' | 'palette' | 'accentColor' | 'textTone' | 'displayFont' | 'bodyFont' | 'avoid'>
  guardrailNotes: string[]
  /** Variable names only: the values belong to each campaign. */
  variableKeys: string[]
  lead?: Lead
  pieces: TemplatePiece[]
}


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
  checks: Check[]
  assets: PieceAsset[]
  production: Production
  published?: Published
  metrics?: Metrics
  history?: PieceVersion[]
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


export type DocImage = { ref: string; caption: string; w: number; h: number }

/** The campaign document as plain data, so one source feeds the preview, PDF, Word, Markdown and the approved versions. */
export type DocBlock =
  | { t: 'h'; level: 1 | 2 | 3; text: string }
  | { t: 'p'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'kv'; rows: [string, string][] }
  | { t: 'images'; items: DocImage[] }
  | { t: 'break' }

export type DocModel = {
  title: string
  blocks: DocBlock[]
}


/** Days before the publish date by which text, images and approval must be done (the backward schedule). */
export type Lead = { copy: number; visual: number; review: number }

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
  lead?: Lead
  /** Accent color of the interface while this campaign is open (the page background follows it). */
  themeColor?: string
  /** How strongly the page background takes that color, 0 to 1. */
  themeTint?: number
  /** Campaign strategy text given to the AI as context. */
  strategy: string
  /** "Do not say" lines: sent to the AI, and phrases in quotes (or short lines) are flagged when they appear in copy. */
  guardrailNotes: string[]
  updatedAt: string
}

export type Workspace = {
  id: string
  name: string
  company: Company
  campaigns: Campaign[]
  templates?: CampaignTemplate[]
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
  return { id: newId(), name, keyVisual, backgrounds: [], sources, components: [], posts: [], pieces: [], variables: {}, foundation: { objective: '', start: '', end: '', kpis: [], audiences: [], bigIdea: '', keyMessage: '', pillars: [], tone: '', dos: [] }, strategy: '', guardrailNotes: [], updatedAt: now() }
}
