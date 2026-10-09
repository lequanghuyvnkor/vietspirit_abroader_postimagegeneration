import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PRESETS, contrast, isHex, themeVars } from '../src/lib/theme.ts'

test('every preset gives readable accent text and button ink in light and dark mode', () => {
  for (const preset of PRESETS) {
    for (const dark of [false, true]) {
      const vars = themeVars(preset.color, 0.5, dark)
      const page = dark ? vars['--bg'] : '#ffffff'
      assert.ok(contrast(vars['--primary'], page) >= 4.4, `${preset.name} ${dark ? 'dark' : 'light'} accent on page`)
      assert.ok(contrast(vars['--primary'], vars['--primary-ink']) >= 4.4, `${preset.name} ${dark ? 'dark' : 'light'} button text`)
      for (const [key, value] of Object.entries(vars)) assert.match(value, /^#[0-9a-f]{6}$/i, `${preset.name} ${key}`)
    }
  }
})

test('a very light accent (yellow) is darkened until it is usable, and a black accent is lightened in dark mode', () => {
  assert.ok(contrast(themeVars('#fde047', 0.5, false)['--primary'], '#ffffff') >= 4.4)
  const dark = themeVars('#111111', 0.5, true)
  assert.ok(contrast(dark['--primary'], dark['--bg']) >= 4.4)
})

test('the background takes the hue of the accent, more with a higher tint, and tint 0 is nearly neutral', () => {
  const blue = themeVars('#2563eb', 1, false)['--bg'], red = themeVars('#e5484d', 1, false)['--bg']
  assert.notEqual(blue, red)
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  assert.ok(channel(blue, 2) > channel(blue, 0), 'blue background leans blue')
  assert.ok(channel(red, 0) > channel(red, 2), 'red background leans red')
  const spread = (hex: string) => Math.max(...[0, 1, 2].map((i) => channel(hex, i))) - Math.min(...[0, 1, 2].map((i) => channel(hex, i)))
  assert.ok(spread(themeVars('#2563eb', 0, false)['--bg']) < spread(themeVars('#2563eb', 1, false)['--bg']))
  assert.ok(spread(themeVars('#2563eb', 0, false)['--bg']) <= 6)
})

test('grey and out-of-range input does not break', () => {
  assert.doesNotThrow(() => themeVars('#808080', undefined, false))
  assert.doesNotThrow(() => themeVars('#000000', 5, true))
  assert.ok(isHex('#AbCdEf') && !isHex('red') && !isHex(undefined) && !isHex('#fff'))
})
