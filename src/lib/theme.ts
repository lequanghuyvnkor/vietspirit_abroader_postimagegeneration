/** Interface colors derived from one accent the user picks per campaign: the accent itself plus a background tint of the same hue. */

export const DEFAULT_TINT = 0.65

export const PRESETS: { name: string; color: string }[] = [
  { name: 'Chàm', color: '#4f46e5' }, { name: 'Xanh dương', color: '#2563eb' }, { name: 'Xanh ngọc', color: '#0d9488' },
  { name: 'Xanh lá', color: '#16a34a' }, { name: 'Cam', color: '#ea580c' }, { name: 'San hô', color: '#e5484d' },
  { name: 'Hồng', color: '#db2777' }, { name: 'Tím', color: '#9333ea' }, { name: 'Navy', color: '#1e3a8a' }, { name: 'Than chì', color: '#3f3f46' },
]

export const isHex = (value: string | undefined): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

type Hsl = { h: number; s: number; l: number }

function toHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

function toHex({ h, s, l }: Hsl): string {
  const sat = Math.min(100, Math.max(0, s)) / 100, light = Math.min(100, Math.max(0, l)) / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${[f(0), f(8), f(4)].map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join('')}`
}

export function luminance(hex: string): number {
  const channel = (start: number) => { const value = parseInt(hex.slice(start, start + 2), 16) / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The CSS variables for one accent: readable accent text, a hue-tinted background, surfaces and lines. `tint` is 0 (almost neutral) to 1 (clearly colored). */
export function themeVars(color: string, tint: number | undefined, dark: boolean): Record<string, string> {
  const base = toHsl(color)
  const t = clamp(tint ?? DEFAULT_TINT, 0, 1)
  const { h } = base
  const hsl = (s: number, l: number) => toHex({ h, s, l })

  // The accent must stay readable as text and as a button fill: nudge its lightness until it passes 4.5:1 on the page.
  const page = dark ? hsl(8, 9) : '#ffffff'
  let accent: Hsl = { h, s: clamp(base.s, 25, 95), l: base.l }
  for (let i = 0; i < 20 && contrast(toHex(accent), page) < 4.5; i++) accent = { ...accent, l: accent.l + (dark ? 3 : -3) }
  const primary = toHex(accent)
  const hover = toHex({ ...accent, l: accent.l + (dark ? 6 : -6) })
  const ink = contrast(primary, '#ffffff') >= contrast(primary, '#111114') ? '#ffffff' : '#111114'

  if (dark) {
    return {
      '--primary': primary, '--primary-hover': hover, '--primary-ink': ink, '--primary-soft': hsl(clamp(accent.s * 0.5, 15, 60), 17),
      '--bg': hsl(8 + 22 * t, 7.5 - t), '--surface': hsl(8 + 18 * t, 10.5), '--surface-2': hsl(8 + 16 * t, 14),
      '--line': hsl(8 + 14 * t, 18), '--line-strong': hsl(8 + 12 * t, 26), '--ink': hsl(10, 93), '--muted': hsl(6 + 6 * t, 66),
    }
  }
  return {
    '--primary': primary, '--primary-hover': hover, '--primary-ink': ink, '--primary-soft': hsl(clamp(accent.s, 30, 90), 95.5),
    '--bg': hsl(10 + 38 * t, 98 - 4.5 * t), '--surface': '#ffffff', '--surface-2': hsl(8 + 28 * t, 96 - 4.5 * t),
    '--line': hsl(10 + 22 * t, 91 - 3.5 * t), '--line-strong': hsl(10 + 14 * t, 83 - 3 * t), '--ink': hsl(20, 10), '--muted': hsl(6 + 8 * t, 42),
  }
}

const KEYS = ['--primary', '--primary-hover', '--primary-ink', '--primary-soft', '--bg', '--surface', '--surface-2', '--line', '--line-strong', '--ink', '--muted']

/** Puts the variables on the page (or clears them when `vars` is null, back to the default look). */
export function applyTheme(vars: Record<string, string> | null): void {
  const style = document.documentElement.style
  for (const key of KEYS) { if (vars?.[key]) style.setProperty(key, vars[key]); else style.removeProperty(key) }
}
