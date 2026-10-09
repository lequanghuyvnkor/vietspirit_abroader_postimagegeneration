import { formatForSize } from './guideline.ts'
import { capitalize, splitSlides, tokensIn } from './text.ts'
import { splitAssetList } from './assets.ts'
import { inferBeats, sceneSeconds } from './beats.ts'
import { newId, now } from './types.ts'
import type { Background, Campaign, Check, Company, FormatKey, Piece, PieceKind, Post, Production, VisualBrief } from './types.ts'
import type { Sheets } from './xlsx.ts'

export type ParsedPlan = {
  title: string
  strategy: string
  guardrailNotes: string[]
  pieces: Piece[]
}

type Table = { header: string[]; rows: string[][] }

/** Finds the table whose header row satisfies `isHeader`; rows run until the first fully empty row. */
function findTable(grid: string[][] | undefined, isHeader: (row: string[]) => boolean): Table | null {
  if (!grid) return null
  const start = grid.findIndex((row) => row && isHeader(row))
  if (start < 0) return null
  const rows: string[][] = []
  for (let i = start + 1; i < grid.length; i++) {
    const row = grid[i] ?? []
    if (!row.some((cell) => cell?.trim())) break
    if (/^\d+\.\s/.test(row[0] ?? '')) break
    rows.push(row)
  }
  return { header: grid[start].map((cell) => (cell ?? '').trim()), rows }
}

const sheetNamed = (sheets: Sheets, pattern: RegExp) => sheets[Object.keys(sheets).find((name) => pattern.test(name)) ?? '']

function column(table: Table, row: string[], ...names: string[]): string {
  for (const name of names) {
    const index = table.header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase())
    if (index >= 0) return (row[index] ?? '').trim()
  }
  return ''
}

/** Accepts dd/mm[/yyyy] text or an Excel serial number; returns YYYY-MM-DD or ''. */
function toIsoDate(value: string): string {
  const text = value.trim()
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/)
  if (dmy) return `${dmy[3] ?? '2026'}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  if (/^\d{5}(\.\d+)?$/.test(text)) return new Date(Math.round((Number(text) - 25569) * 86400000)).toISOString().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

export function kindOf(format: string): PieceKind {
  if (/reel|video/i.test(format)) return 'reel'
  return /carousel|slide/i.test(format) ? 'carousel' : 'static'
}

const PEOPLE = /(mentor|chân dung|portrait|người thật|a-roll|footage|talking|diễn viên)/i
const NO_PEOPLE = /(không cần ảnh người|không có người|không người)/i

/** A reel whose brief shows real people goes to another team; motion-graphic reels are made here. */
export function guessProduction(visual: VisualBrief): Production {
  const text = [visual.hero, visual.assets, visual.layout].join(' ')
  return PEOPLE.test(text) && !NO_PEOPLE.test(text) ? 'external' : 'internal'
}

export const defaultProductionNote = (production: Production): string =>
  production === 'external' ? 'Reel có người thật: bên khác quay và dựng. Bàn giao: cấu trúc theo mốc giây, caption, phụ đề, tài nguyên (credential, consent).' : ''

/** Reads a cell like "Bên ngoài - agency quay" or "Nội bộ" from an optional production column. */
export function parseProduction(value: string): Production | null {
  if (/(bên ngoài|bên khác|external|agency|studio ngoài|thuê ngoài)/i.test(value)) return 'external'
  return /(nội bộ|internal|in-?house|team mình)/i.test(value) ? 'internal' : null
}

export function kindLabel(piece: Piece): string {
  if (piece.kind === 'carousel') return 'Carousel'
  if (piece.kind === 'static') return 'Ảnh'
  return piece.production === 'external' ? 'Reel · bên ngoài (có người)' : 'Reel · làm trong app (không người)'
}

export function formatKeyOf(text: string): FormatKey {
  const size = text.match(/(\d{3,4})\s*[×x*]\s*(\d{3,4})/)
  return (size && formatForSize(Number(size[1]), Number(size[2]))) || 'feed'
}

function productionOf(kind: PieceKind, cell: string, visual: VisualBrief): { production: Production; productionNote: string } {
  const production = parseProduction(cell) ?? (kind === 'reel' ? guessProduction(visual) : 'internal')
  return { production, productionNote: cell || defaultProductionNote(production) }
}

export function parsePlan(sheets: Sheets): ParsedPlan {
  const calendar = findTable(sheetNamed(sheets, /calendar/i), (row) => row[0]?.trim() === 'ID')
  if (!calendar) throw new Error('Không tìm thấy bảng lịch nội dung (sheet có cột "ID", "Title / Hook"…).')
  const captions = findTable(sheetNamed(sheets, /caption/i), (row) => row[0]?.trim() === 'ID')
  const visuals = findTable(sheetNamed(sheets, /visual/i), (row) => row[0]?.trim() === 'ID')
  const checklist = findTable(sheetNamed(sheets, /promo|source/i), (row) => row[0]?.trim() === 'Check')
  const byId = (table: Table | null, id: string) => table?.rows.find((row) => (row[0] ?? '').trim() === id)

  // Optional column in the calendar: who produces each piece ("Bên sản xuất", "Production", "Bàn giao"...).
  const productionColumn = calendar.header.findIndex((cell) => /(bên sản xuất|đơn vị thực hiện|người thực hiện|production|bàn giao|handoff)/i.test(cell))
  const pieces: Piece[] = calendar.rows.filter((row) => (row[0] ?? '').trim()).map((row) => {
    const code = row[0].trim()
    const cal = (...names: string[]) => column(calendar, row, ...names)
    const capRow = byId(captions, code)
    const cap = (...names: string[]) => (captions && capRow ? column(captions, capRow, ...names) : '')
    const visRow = byId(visuals, code)
    const vis = (...names: string[]) => (visuals && visRow ? column(visuals, visRow, ...names) : '')
    const format = cal('Format')
    const productionCell = productionColumn >= 0 ? (row[productionColumn] ?? '').trim() : ''

    const checks: Check[] = []
    if (cal('Điều kiện trước đăng')) checks.push({ id: newId(), text: cal('Điều kiện trước đăng'), owner: 'Marketing', done: false })
    if (cap('Compliance / cần duyệt')) checks.push({ id: newId(), text: cap('Compliance / cần duyệt'), owner: 'Compliance', done: false })
    if (checklist) {
      const index = checklist.header.indexOf(code)
      if (index >= 0) for (const item of checklist.rows) {
        if (/bắt buộc/i.test(item[index] ?? '')) checks.push({ id: newId(), text: `${(item[0] ?? '').trim()}: ${(item[1] ?? '').trim()}`, owner: (item[2] ?? '').trim(), done: false })
      }
    }

    return {
      id: newId(), code, title: cap('Tên bài') || cal('Title / Hook'), kind: kindOf(format), date: toIsoDate(cal('Ngày')),
      status: cap('Caption draft') ? 'copy' : 'brief',
      plan: {
        funnel: cal('Funnel'), pillar: cal('Pillar'), format, goal: cal('Mục tiêu'), hook: cal('Title / Hook'), structure: cal('Cấu trúc nội dung'),
        cta: cal('CTA'), audience: cal('Target audience'), kpi: cal('KPI chính'), paid: cal('Paid role'), conditions: cal('Điều kiện trước đăng'),
        story: cal('Story hỗ trợ'), time: cal('Giờ'),
      },
      visual: {
        format: vis('Khổ/định dạng'), hero: vis('Hero visual'), layout: vis('Bố cục'), typography: vis('Typography'), palette: vis('Palette'),
        onImage: vis('On-image copy'), motion: vis('Motion'), assets: vis('Asset cần chuẩn bị'), avoid: vis('Tránh'),
      },
      caption: [cap('Caption draft'), cap('CTA line')].filter(Boolean).join('\n\n'),
      hashtags: cap('Hashtags'),
      compliance: cap('Compliance / cần duyệt'),
      checks,
      assets: splitAssetList(vis('Asset cần chuẩn bị')).map((label) => ({ id: newId(), label, assetId: null, done: false, note: '' })),
      ...productionOf(kindOf(format), productionCell, {
        hero: vis('Hero visual'), layout: vis('Bố cục'), assets: vis('Asset cần chuẩn bị'), format: '', typography: '', palette: '', onImage: '', motion: '', avoid: '',
      }),
    }
  })

  // Strategy: summary key/value pairs plus the message architecture (with the "do not say" column).
  const strategySheet = sheetNamed(sheets, /strategy/i)
  const lines: string[] = []
  const summary = findTable(strategySheet, (row) => row[0]?.trim() === 'Hạng mục')
  for (const row of summary?.rows ?? []) {
    for (let i = 0; i + 1 < row.length; i += 2) if (row[i]?.trim() && row[i + 1]?.trim()) lines.push(`${row[i].trim()}: ${row[i + 1].trim()}`)
  }
  const architecture = findTable(strategySheet, (row) => row.some((cell) => cell?.trim() === 'Không được nói'))
  const guardrailNotes: string[] = []
  for (const row of architecture?.rows ?? []) {
    const layer = column(architecture!, row, 'Lớp thông điệp')
    const notSay = column(architecture!, row, 'Không được nói')
    const key = column(architecture!, row, 'Key message')
    const disclosure = column(architecture!, row, 'Disclosure bắt buộc')
    if (notSay) guardrailNotes.push(`${layer}: ${notSay}`)
    lines.push(`Thông điệp ${layer}: ${key} (không được nói: ${notSay}; disclosure: ${disclosure})`)
  }

  return { title: strategySheet?.[0]?.[0]?.trim() ?? '', strategy: lines.join('\n').slice(0, 5000), guardrailNotes, pieces }
}

/** True when the piece is made in this app: everything except reels handed to another team. */
export const madeInApp = (piece: Piece): boolean => piece.kind !== 'reel' || piece.production === 'internal'

/** First-draft slides (or reel scenes) for a piece, built from the plan with no AI. Reels made elsewhere get none. */
export function draftSlides(piece: Piece, company: Company, backgrounds: Background[]): Post[] {
  if (!madeInApp(piece)) return []
  const reel = piece.kind === 'reel'
  const format: FormatKey = reel ? 'story' : formatKeyOf(piece.visual.format)
  const background = backgrounds.find((item) => item.format === format)?.id ?? null
  const beats = reel ? inferBeats(piece) : []
  const fromStructure = piece.kind === 'carousel' ? splitSlides(piece.plan.structure) : []
  // A carousel typed in by hand has no "S1: …" structure yet: use the slide count in its format line ("Carousel 6 slides").
  const wanted = piece.kind === 'carousel' && fromStructure.length === 0 ? Number(piece.plan.format.match(/(\d{1,2})\s*(?:slides?|trang|ảnh)/i)?.[1] ?? 0) : 0
  const labels = wanted > 1 ? Array.from({ length: Math.min(wanted, 12) }, (_, i) => ({ n: i + 1, label: i === 0 ? 'hook' : i === Math.min(wanted, 12) - 1 ? 'CTA' : `ý ${i + 1}` })) : fromStructure
  const entries = reel ? beats.map((beat, index) => ({ n: index + 1, label: beat.label, seconds: sceneSeconds(beat) })) : labels.length ? labels.map((entry) => ({ ...entry, seconds: undefined })) : [{ n: 1, label: 'hook', seconds: undefined }]
  return entries.map((entry, index): Post => {
    const first = index === 0
    const last = index === entries.length - 1 && entries.length > 1
    return {
      id: newId(), name: `${piece.code} · ${reel ? `Cảnh ${entry.n}` : entries.length > 1 ? `Slide ${entry.n}` : 'Ảnh'}`, pieceId: piece.id, format,
      eyebrow: piece.plan.pillar.split('·').pop()!.trim().toUpperCase(), headline: first ? piece.visual.onImage || piece.plan.hook : capitalize(entry.label.replace(/\s*\+\s*CTA$/i, '')),
      accent: '', subtitle: '', cta: last || entries.length === 1 ? piece.plan.cta : '', footer: company.footer,
      backgroundId: background, scrim: true, layers: [], ...(entry.seconds ? { duration: entry.seconds } : {}), updatedAt: now(),
    }
  })
}

/** Every [PLACEHOLDER] used in the campaign's copy, with how often it appears. */
export function collectTokens(campaign: Campaign): Map<string, number> {
  const counts = new Map<string, number>()
  const texts = [
    ...campaign.pieces.map((piece) => piece.caption),
    ...campaign.posts.flatMap((post) => [post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.footer]),
  ]
  for (const text of texts) for (const token of tokensIn(text)) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

export function pieceTexts(campaign: Campaign, piece: Piece): string[] {
  return [piece.caption, ...campaign.posts.filter((post) => post.pieceId === piece.id).flatMap((post) => [post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.footer])]
}

/** Campaign window written in the strategy ("Thời gian: 07–21/10/2026"), as ISO dates. */
export function scheduleWindow(strategy: string): { start: string; end: string } | null {
  const match = strategy.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4})/)
  if (!match) return null
  const [, from, to, month, year] = match
  const iso = (day: string) => `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return Number(from) <= Number(to) ? { start: iso(from), end: iso(to) } : null
}

/** Spreads `count` dates evenly across the window, first piece on the first day and last on the last. */
export function suggestDates(count: number, window: { start: string; end: string }): string[] {
  const start = new Date(`${window.start}T00:00:00Z`).getTime()
  const end = new Date(`${window.end}T00:00:00Z`).getTime()
  return Array.from({ length: count }, (_, index) => new Date(count === 1 ? start : start + Math.round((index * (end - start)) / (count - 1) / 86400000) * 86400000).toISOString().slice(0, 10))
}
