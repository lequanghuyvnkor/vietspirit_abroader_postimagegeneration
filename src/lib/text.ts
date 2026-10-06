/** Placeholder substitution, copy linting and slide splitting. Pure functions, no DOM. */

const TOKEN = /\[([^\]\n]{2,60})\]/g

/** Placeholder names are matched case-insensitively. */
export const tokenKey = (inner: string) => inner.trim().toUpperCase()

export function tokensIn(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((match) => tokenKey(match[1])))]
}

export function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(TOKEN, (whole, inner: string) => vars[tokenKey(inner)]?.trim() || whole)
}

export function unresolvedIn(text: string, vars: Record<string, string>): string[] {
  return tokensIn(text).filter((key) => !vars[key]?.trim())
}

export type LintHit = { rule: string; excerpt: string }

const RULES: { rule: string; pattern: RegExp; negatable?: boolean }[] = [
  { rule: 'Cam kết kết quả (đậu / visa / học bổng)', pattern: /(bảo đảm|đảm bảo|cam kết|chắc chắn|100\s?%)[^.\n]{0,30}(đậu|đỗ|visa|admission|trúng tuyển|nhận học bổng|được nhận)/i },
  { rule: '"Cứu hồ sơ"', pattern: /cứu (hồ sơ|nguy)/i },
  { rule: 'Mentor "viết hộ/viết thay"', pattern: /viết (hộ|thay)\b/i, negatable: true },
  { rule: 'Học bổng do VietSpirit cấp', pattern: /học bổng[^.\n]{0,20}(do|của)\s+VietSpirit|VietSpirit[^.\n]{0,20}(cấp|trao)\s+học bổng/i },
  { rule: 'Hứa chắc kịp deadline', pattern: /còn\s+\d+\s+ngày[^.\n]{0,25}(chắc chắn|kịp)/i },
]

const excerptAround = (text: string, index: number, length: number) => text.slice(Math.max(0, index - 25), index + length + 25).replace(/\s+/g, ' ').trim()

/** Flags risky claims. Built-in rules plus the campaign's own phrases. Warnings only; context decides. */
export function lintText(text: string, customPhrases: string[]): LintHit[] {
  const hits: LintHit[] = []
  for (const { rule, pattern, negatable } of RULES) {
    const match = pattern.exec(text)
    // "Mentor không viết thay" is the opposite of the risky claim, so a nearby negation clears it.
    if (match && negatable && /(không|chẳng|đừng|tránh)[^.\n]{0,40}$/i.test(text.slice(Math.max(0, match.index - 45), match.index))) continue
    if (match) hits.push({ rule, excerpt: excerptAround(text, match.index, match[0].length) })
  }
  const lower = text.toLowerCase()
  for (const phrase of customPhrases.map((item) => item.trim()).filter(Boolean)) {
    const index = lower.indexOf(phrase.toLowerCase())
    if (index >= 0) hits.push({ rule: `Cụm bị cấm: "${phrase}"`, excerpt: excerptAround(text, index, phrase.length) })
  }
  return hits
}

/** "S1 hook. S2 nền tảng STEM. S3 ..." -> one entry per slide. Empty when the text has no slide markers. */
export function splitSlides(structure: string): { n: number; label: string }[] {
  return [...structure.matchAll(/\bS(\d{1,2})\b\s*[:.\-–]?\s*([\s\S]*?)(?=\s*\bS\d{1,2}\b|$)/g)]
    .map((match) => ({ n: Number(match[1]), label: match[2].replace(/[.\s]+$/, '').trim() }))
    .filter((slide) => slide.label)
}

export function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}
