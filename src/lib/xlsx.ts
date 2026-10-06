import { strFromU8, unzipSync } from 'fflate'

/** Minimal .xlsx reader: returns every sheet as a grid of strings (empty cells are ''). */
export type Sheets = Record<string, string[][]>

const decodeEntities = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, '&')

/** Joins every <t> text run of a shared string / rich text / inline string. */
function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeEntities(match[1])).join('')
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)![0]
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

export function readXlsx(bytes: Uint8Array): Sheets {
  const files = unzipSync(bytes)
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : '')

  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1]))
  const targets = new Map<string, string>()
  for (const match of read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)) {
    const id = match[1].match(/\bId="([^"]+)"/)?.[1]
    const target = match[1].match(/\bTarget="([^"]+)"/)?.[1]
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }

  const sheets: Sheets = {}
  for (const match of read('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decodeEntities(match[1].match(/\bname="([^"]*)"/)?.[1] ?? '')
    const rid = match[1].match(/\br:id="([^"]+)"/)?.[1]
    const path = rid ? targets.get(rid) : undefined
    if (!name || !path) continue
    const grid: string[][] = []
    for (const row of read(path).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rowIndex = Number(row[1].match(/\br="(\d+)"/)?.[1] ?? grid.length + 1) - 1
      const cells: string[] = (grid[rowIndex] ??= [])
      for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = cell[1].match(/\br="([A-Z]+\d+)"/)?.[1]
        const body = cell[2]
        if (!ref || !body) continue
        const type = cell[1].match(/\bt="([^"]+)"/)?.[1]
        const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        cells[columnIndex(ref)] = type === 's' ? (shared[Number(value)] ?? '') : type === 'inlineStr' ? textOf(body) : decodeEntities(value ?? '')
      }
    }
    for (let i = 0; i < grid.length; i++) grid[i] = Array.from(grid[i] ?? [], (cell) => cell ?? '')
    sheets[name] = grid
  }
  return sheets
}
