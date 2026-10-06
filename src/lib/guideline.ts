import { FORMATS, type FormatKey, type KeyVisual } from './types.ts'

export type TextItem = { str: string; x: number; y: number; height: number }

export type Extracted = Pick<KeyVisual, 'concept' | 'palette' | 'accentColor' | 'displayFont' | 'bodyFont' | 'avoid' | 'guideline'> & {
  textToneHint: KeyVisual['textTone'] | null
}

const SECTION_KINDS: [string, string, RegExp][] = [
  ['logo', 'Logo', /logo/i],
  ['colors', 'Màu & gradient', /màu|color|colour|gradient/i],
  ['fonts', 'Phông chữ', /phông|font|typo|chữ/i],
  ['graphics', 'Yếu tố đồ họa', /đồ họa|graphic|yếu tố|element|họa tiết|pattern|hiệu ứng|effect/i],
  ['layout', 'Bố cục & khổ', /bố cục|layout|khổ|format|grid/i],
  ['mood', 'Mood & tone', /mood|tone|phong cách|style|giọng/i],
]

const HEADING = /^\s*\d{1,2}\s*[·.\-–—:)]\s*\S.{2,60}$/
const HEX = /#[0-9a-f]{6}\b/gi

/** Aspect ratio -> post format, with a small tolerance. Null for pages that are not a post size. */
export function formatForSize(width: number, height: number): FormatKey | null {
  const ratio = width / height
  return FORMATS.find((format) => Math.abs(ratio / (format.width / format.height) - 1) < 0.05)?.key ?? null
}

const readingOrder = (a: TextItem, b: TextItem) => (Math.abs(b.y - a.y) > Math.max(a.height, b.height) * 0.5 ? b.y - a.y : a.x - b.x)

/** Joins items into reading-order lines. */
export function itemsToLines(items: TextItem[]): string[] {
  const sorted = items.filter((item) => item.str.trim()).sort(readingOrder)
  const lines: { y: number; parts: TextItem[] }[] = []
  for (const item of sorted) {
    const line = lines.find((entry) => Math.abs(entry.y - item.y) < Math.max(item.height, 1) * 0.5)
    if (line) line.parts.push(item)
    else lines.push({ y: item.y, parts: [item] })
  }
  return lines.map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.str.trim()).join(' '))
}

/** Splits a multi-column guideline page into its numbered sections ("01 · LOGO"...) using item positions. */
function regions(items: TextItem[]) {
  const headings = items.filter((item) => HEADING.test(item.str) && item.str === item.str.toUpperCase())
  const sections = new Map<TextItem, TextItem[]>(headings.map((heading) => [heading, []]))
  const intro: TextItem[] = []
  const rightBound = (heading: TextItem) => Math.min(Infinity, ...headings.filter((other) => other !== heading && Math.abs(other.y - heading.y) < 30 && other.x > heading.x + 20).map((other) => other.x))
  for (const item of items) {
    if (headings.includes(item)) continue
    const owners = headings.filter((heading) => item.x >= heading.x - 12 && item.x < rightBound(heading) - 4 && item.y <= heading.y + 4).sort((a, b) => a.y - b.y)
    if (owners.length) sections.get(owners[0])!.push(item)
    else intro.push(item)
  }
  return { headings, sections, intro }
}

function saturation(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  const max = Math.max(r, g, b)
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max
}

function pickAccent(lines: string[], palette: string[]): string | null {
  const nearWord = /đỏ|red|nhấn|accent|cta|nút/i
  for (const line of lines) {
    for (const match of line.matchAll(HEX)) {
      if (nearWord.test(line.slice(Math.max(0, match.index - 60), match.index + 20))) return match[0].toUpperCase()
    }
  }
  return [...palette].sort((a, b) => saturation(b) - saturation(a))[0] ?? null
}

function cleanFontName(raw: string): string {
  return raw.replace(/\s+\d{3}(?:\s*\/\s*\d{3})*\b.*$/, '').replace(/\b(Light|Regular|Medium|SemiBold|Bold|Italic)\b.*$/i, '').trim()
}

function pickFonts(lines: string[]): { display: string | null; body: string | null } {
  const found: { name: string; description: string }[] = []
  for (const line of lines) {
    const [name, ...rest] = line.split(/\s[—–-]\s/)
    if (!rest.length || !/^[A-Z][A-Za-z0-9]*(?: [A-Za-z0-9/]+){0,4}$/.test(name.trim())) continue
    const clean = cleanFontName(name)
    if (clean.length >= 3 && !found.some((item) => item.name === clean)) found.push({ name: clean, description: rest.join(' ') })
  }
  const display = found.find((item) => /tiêu đề|heading|headline|title|display/i.test(item.description)) ?? found[0]
  const body = found.find((item) => item !== display && /nội dung|body|text|mảnh|đoạn/i.test(item.description)) ?? found.find((item) => item !== display)
  return { display: display?.name ?? null, body: body?.name ?? null }
}

/** Extracts key visual inputs from the text layer of a guideline PDF (one item list per page). */
export function parseGuideline(pages: TextItem[][]): Extracted {
  const allLines = pages.flatMap(itemsToLines)
  const anchor = pages.findIndex((items) => items.some((item) => /guideline/i.test(item.str)))
  const { headings, sections, intro } = regions(pages[Math.max(anchor, 0)] ?? [])
  const byKind = (kind: string) => {
    const [, , pattern] = SECTION_KINDS.find(([key]) => key === kind)!
    const heading = headings.find((item) => pattern.test(item.str))
    return heading ? itemsToLines(sections.get(heading)!) : []
  }

  // Concept: the intro column that starts with the word "Concept".
  const conceptItem = intro.find((item) => /^concept\b/i.test(item.str.trim()))
  const concept = conceptItem
    ? intro.filter((item) => Math.abs(item.x - conceptItem.x) < 6 && item.y <= conceptItem.y + 2).sort((a, b) => b.y - a.y).map((item) => item.str.trim()).join(' ').trim().replace(/^concept\s*/i, '').replace(/[“”]/g, '"')
    : ''

  const colorLines = [...byKind('colors'), ...allLines]
  const palette = [...new Set(colorLines.flatMap((line) => [...line.matchAll(HEX)].map((match) => match[0].toUpperCase())))].slice(0, 6)
  const fonts = pickFonts([...byKind('fonts'), ...allLines])

  const mood = byKind('mood')
  const avoidAt = mood.findIndex((line) => /^(tránh|avoid)/i.test(line))
  const avoid = avoidAt >= 0 ? mood.slice(avoidAt).join(' ').replace(/^(tránh|avoid)\s*:?\s*/i, '').trim() : ''

  const notes = (['logo', 'graphics', 'layout', 'mood'] as const)
    .map((kind) => {
      const lines = kind === 'mood' && avoidAt >= 0 ? mood.slice(0, avoidAt) : byKind(kind)
      return lines.length ? `${SECTION_KINDS.find(([key]) => key === kind)![1]}: ${lines.join(' ')}` : ''
    })
    .filter(Boolean)
    .join('\n')

  return {
    concept,
    palette,
    accentColor: pickAccent(colorLines, palette) ?? '#E5484D',
    displayFont: fonts.display ?? '',
    bodyFont: fonts.body ?? '',
    avoid,
    guideline: notes.slice(0, 2000),
    textToneHint: /nền (đậm|tối)|dark|night|đêm/i.test(`${mood.join(' ')} ${concept}`) ? 'light' : null,
  }
}
