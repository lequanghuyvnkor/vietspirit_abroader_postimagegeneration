import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMotifs, compositeMode, guessRole, planMotifs } from '../src/lib/motifs.ts'
import { makeCampaign, makePiece, makeWorkspace, withSlides } from './fixtures.mts'
import { newId } from '../src/lib/types.ts'
import type { Component } from '../src/lib/types.ts'

const comp = (name: string, width: number, height: number, role?: Component['role']): Component => ({ id: newId(), name, assetId: 'a', width, height, role } as Component)

function setup() {
  const campaign = makeCampaign('C', ['Một'])
  campaign.pieces = [makePiece('P01', 'Một')]
  withSlides(makeWorkspace('W', [campaign]), campaign)
  campaign.components = [comp('star', 300, 300, 'hero'), comp('route', 1400, 100, 'line'), comp('dot', 60, 60, 'decor')]
  return campaign
}
const band = { freeFrom: 0.45, freeTo: 0.9 }

test('guessRole by shape', () => {
  assert.equal(guessRole(comp('logo vs', 100, 100)), 'off')
  assert.equal(guessRole(comp('x', 1400, 100)), 'line')
  assert.equal(guessRole(comp('x', 60, 60)), 'decor')
  assert.equal(guessRole(comp('x', 500, 400)), 'off')
})

test('composite only with explicit roles and not in ai mode', () => {
  const campaign = setup()
  assert.equal(compositeMode(campaign), true)
  campaign.keyVisual.motifMode = 'ai'
  assert.equal(compositeMode(campaign), false)
  campaign.keyVisual.motifMode = 'composite'
  campaign.components.forEach((item) => { item.role = undefined })
  assert.equal(compositeMode(campaign), false)
})

test('motifs stay inside the free band and are deterministic', () => {
  const campaign = setup()
  const slides = campaign.posts.filter((post) => post.pieceId === campaign.pieces[0].id)
  const one = planMotifs(campaign, slides, band)
  const two = planMotifs(campaign, slides, band)
  for (const post of slides) {
    const a = one.get(post.id)!
    assert.ok(a.length > 0)
    assert.deepEqual(a.map(({ id: _i, ...rest }) => rest), two.get(post.id)!.map(({ id: _i, ...rest }) => rest))
    for (const layer of a) assert.ok(layer.y >= band.freeFrom - 0.01 && layer.y <= 1, `y ${layer.y}`)
  }
})

test('apply replaces auto layers only and keeps manual ones', () => {
  const campaign = setup()
  const piece = campaign.pieces[0]
  const first = campaign.posts.find((post) => post.pieceId === piece.id)!
  first.layers.push({ id: 'manual', componentId: campaign.components[0].id, x: 0.5, y: 0.5, w: 0.2, opacity: 1, rotation: 0 })
  applyMotifs(campaign, piece.id, band)
  applyMotifs(campaign, piece.id, band)
  assert.equal(first.layers.filter((layer) => layer.id === 'manual').length, 1)
  assert.equal(first.layers.filter((layer) => layer.auto).length, new Set(first.layers.filter((l) => l.auto).map((l) => l.id)).size)
  assert.ok(first.layers.some((layer) => layer.auto))
})

test('AI roles are read by piece number, unknown ones fall back to the shape guess, at most two heroes', async () => {
  const { parseRoles } = await import('../src/lib/motifAi.ts')
  const pieces = [comp('a', 300, 300), comp('b', 1400, 100), comp('c', 60, 60), comp('d', 300, 300), comp('e', 300, 300)]
  const roles = parseRoles('```json\n{"roles":[{"n":1,"role":"hero"},{"n":2,"role":"line"},{"n":4,"role":"hero"},{"n":5,"role":"hero"},{"n":9,"role":"hero"},{"n":3,"role":"nonsense"}]}\n```', pieces)
  assert.equal(roles.get(pieces[0].id), 'hero')
  assert.equal(roles.get(pieces[1].id), 'line')
  assert.equal(roles.get(pieces[2].id), 'decor')
  assert.equal([...roles.values()].filter((role) => role === 'hero').length, 2)
  assert.throws(() => parseRoles('not json', pieces))
})
