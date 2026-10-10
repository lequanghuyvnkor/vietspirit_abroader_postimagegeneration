import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceToVisual, attachPlate } from '../src/lib/plate.ts'
import { normalize } from '../src/lib/store.ts'
import { buildBackgroundPrompt } from '../src/lib/prompt.ts'
import { makeCampaign, makeStore, makeWorkspace, withSlides } from './fixtures.mts'
import type { Store } from '../src/lib/types.ts'

function ready() {
  const campaign = makeCampaign('C', ['Một', 'Hai'])
  const workspace = makeWorkspace('W', [campaign])
  withSlides(workspace, campaign)
  campaign.keyVisual.concept = 'Bầu trời đêm êm'
  return { campaign, workspace }
}

test('a piece moves to Visual once every slide has its picture, not before and not when already ready', () => {
  const { campaign } = ready()
  const piece = campaign.pieces[0]
  piece.status = 'copy'
  const slides = campaign.posts.filter((post) => post.pieceId === piece.id)
  assert.ok(slides.length >= 2)
  // One slide gets a picture: still Copy.
  attachPlate(campaign, piece.id, { assetId: 'a1', format: slides[0].format, label: 'x' }, slides[0].id)
  assert.equal(piece.status, 'copy')
  // The rest get theirs: Visual.
  attachPlate(campaign, piece.id, { assetId: 'a2', format: slides[0].format, label: 'x' })
  assert.equal(piece.status, 'visual')
  // A piece marked ready is not pushed back.
  piece.status = 'ready'
  advanceToVisual(campaign, piece.id)
  assert.equal(piece.status, 'ready')
})

test('old data loses the main-symbol images and text but keeps the reference images', () => {
  const campaign = makeCampaign('C', ['Một'])
  Object.assign(campaign.keyVisual, { subject: 'ngôi sao đỏ', subjectIds: ['hero-1.png'], referenceIds: ['page-1.webp'], sampleIds: ['page-2.webp'] })
  const store = normalize({ workspaces: [makeWorkspace('W', [campaign])] } as Store)
  const kv = store.workspaces[0].campaigns[0].keyVisual as unknown as Record<string, unknown>
  assert.equal('subjectIds' in kv, false)
  assert.equal('subject' in kv, false)
  assert.deepEqual(kv.referenceIds, ['page-1.webp'])
  assert.deepEqual(kv.sampleIds, ['page-2.webp'])
  void makeStore
})

test('the prompt asks the AI to match the samples overall by default, and only colour and light when told', () => {
  const { campaign, workspace } = ready()
  campaign.keyVisual.referenceIds = ['one.png']
  assert.match(buildBackgroundPrompt(workspace, campaign, 'square', ''), /finished sample posts/)
  campaign.keyVisual.refFidelity = 'style'
  const style = buildBackgroundPrompt(workspace, campaign, 'square', '')
  assert.match(style, /Take ONLY their color grading/)
  assert.doesNotMatch(style, /Main visual element|main visual symbol/)
})
