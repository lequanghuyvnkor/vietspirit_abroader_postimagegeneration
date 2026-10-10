import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPalette } from '../src/lib/palette.ts'
import { applyMotifs, compositeMode, planMotifs } from '../src/lib/motifs.ts'
import { buildBackgroundPrompt } from '../src/lib/prompt.ts'
import { makeCampaign, makeWorkspace, withSlides } from './fixtures.mts'
import { newId } from '../src/lib/types.ts'
import type { Component } from '../src/lib/types.ts'

function swatches(colors: [number, number, number][], noise = 0) {
  const width = 120
  const height = 40
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colors[Math.min(colors.length - 1, Math.floor((x / width) * colors.length))]
      const i = (y * width + x) * 4
      const jitter = noise ? ((x * 7 + y * 13) % (noise * 2 + 1)) - noise : 0
      data.set([r + jitter, g + jitter, b + jitter, 255], i)
    }
  }
  return data
}

const near = (hex: string, rgb: number[], tolerance = 8) => [1, 3, 5].every((at, k) => Math.abs(parseInt(hex.slice(at, at + 2), 16) - rgb[k]) <= tolerance)

test('a colour page gives its palette dark to light, a vivid accent and the text tone', () => {
  const reading = extractPalette(swatches([[0, 26, 69], [18, 43, 115], [32, 110, 210], [255, 255, 255], [190, 110, 50]], 2))!
  assert.ok(reading.palette.length >= 4)
  assert.ok(near(reading.palette[0], [0, 26, 69]), reading.palette[0])
  assert.ok(near(reading.palette[reading.palette.length - 1], [255, 255, 255]))
  assert.ok(!near(reading.accentColor, [255, 255, 255]) && !near(reading.accentColor, [0, 26, 69]), reading.accentColor)
  // A page that is mostly dark navy wants light text.
  const dark = extractPalette(swatches([[0, 26, 69], [0, 26, 69], [0, 26, 69], [255, 255, 255]]))!
  assert.equal(dark.textTone, 'light')
  const light = extractPalette(swatches([[250, 250, 250], [250, 250, 250], [20, 40, 90]]))!
  assert.equal(light.textTone, 'dark')
})

test('colours close together are merged and an empty image gives nothing', () => {
  const reading = extractPalette(swatches([[10, 30, 80], [14, 33, 84], [12, 31, 82]]))!
  assert.equal(reading.palette.length, 1)
  assert.equal(extractPalette(new Uint8ClampedArray(400)), null)
})

function withTexture() {
  const campaign = makeCampaign('C', ['Một'])
  withSlides(makeWorkspace('W', [campaign]), campaign)
  const texture: Component = { id: newId(), name: 'contour', assetId: 'a', width: 1200, height: 1200, role: 'texture' }
  campaign.components = [texture]
  return { campaign, texture }
}

test('a pattern page alone switches composite mode on and covers every slide without needing a free band', () => {
  const { campaign, texture } = withTexture()
  assert.equal(compositeMode(campaign), true)
  const slides = campaign.posts.filter((post) => post.pieceId === campaign.pieces[0].id)
  const plan = planMotifs(campaign, slides, new Map())
  for (const post of slides) {
    const layers = plan.get(post.id)!
    assert.equal(layers.length, 1)
    assert.equal(layers[0].componentId, texture.id)
    // It always reaches past the frame on every side, whatever the slide shape.
    const width = layers[0].w
    assert.ok(width >= 1)
  }
  assert.equal(applyMotifs(campaign, campaign.pieces[0].id, new Map()), slides.length)
})

test('on a carousel the pattern is wider than the frame and moves from slide to slide', () => {
  const { campaign } = withTexture()
  const slides = campaign.posts.filter((post) => post.pieceId === campaign.pieces[0].id)
  assert.ok(slides.length >= 3)
  const plan = planMotifs(campaign, slides, new Map())
  const xs = slides.map((post) => plan.get(post.id)![0].x)
  assert.ok(xs[0] > xs[xs.length - 1])
  for (const post of slides) {
    const layer = plan.get(post.id)![0]
    assert.ok(layer.x - layer.w / 2 <= 0 && layer.x + layer.w / 2 >= 1)
  }
})

test('the background prompt does not push any theme of its own, and tells the AI the graphics come later', () => {
  const { campaign } = withTexture()
  const workspace = makeWorkspace('W', [campaign])
  campaign.keyVisual.concept = 'Bản khảo sát địa hình, nền xanh navy đậm.'
  const zones = { logoBottom: 0.1, textTop: 0.12, textBottom: 0.5, lower: 0.9, freeFrom: 0.53, freeTo: 0.87 }
  for (const prompt of [buildBackgroundPrompt(workspace, campaign, 'feed', '', zones), buildBackgroundPrompt(workspace, campaign, 'feed', '')]) {
    assert.doesNotMatch(prompt, /planet|space photography|city lights|constellation scenery/i)
  }
  const composite = buildBackgroundPrompt(workspace, campaign, 'feed', '', zones)
  assert.match(composite, /contour line, grid, map line, pattern/)
  assert.match(composite, /moodboard concept/)
})
