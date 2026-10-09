import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addPiece, codeIsTaken, duplicatePiece, emptyPiece, movePiece, nextCode, removePiece, setKind, sortByDate } from '../src/lib/planEdit.ts'
import { parsePlan } from '../src/lib/plan.ts'
import { makeCampaign, makePiece, makeWorkspace, withSlides } from './fixtures.mts'

// ---------- plan editing ----------
test('nextCode skips used and reserved numbers, never reuses a deleted gap below the max', () => {
  const c = makeCampaign('X', ['a', 'b', 'c'])
  c.pieces[1].code = 'P07'
  assert.equal(nextCode(c.pieces), 'P08')
  assert.equal(nextCode(c.pieces, ['P08', 'P09']), 'P10')
  assert.equal(nextCode([]), 'P01')
})

test('codeIsTaken catches blank and duplicate codes case-insensitively', () => {
  const c = makeCampaign('X', ['a', 'b'])
  c.pieces[1].code = 'p01'
  assert.ok(codeIsTaken(c, c.pieces[1]))
  c.pieces[1].code = 'P02'
  assert.ok(!codeIsTaken(c, c.pieces[1]))
  c.pieces[1].code = ' '
  assert.ok(codeIsTaken(c, c.pieces[1]))
})

test('duplicatePiece starts clean: no date, history, results or photos', () => {
  const c = makeCampaign('X', ['gốc'])
  const p = c.pieces[0]
  Object.assign(p, { date: '2026-10-10', status: 'ready', history: [{ id: '1', at: 'x', event: 'manual', note: '', snapshot: {} as never }], published: { at: 'x', url: '', note: '' }, metrics: { reach: 5, engagement: 1, clicks: 0, leads: 1, updatedAt: 'x' } })
  p.checks = [{ id: 'c1', text: 'ok', owner: 'me', done: true }]
  p.assets = [{ id: 'a1', label: 'ảnh', assetId: 'file.png', done: true, note: '' }]
  const copy = duplicatePiece(c, p.id)!
  assert.equal(c.pieces[1].id, copy.id)
  assert.notEqual(copy.code, p.code)
  assert.equal(copy.date, '')
  assert.equal(copy.status, 'brief')
  for (const key of ['history', 'published', 'metrics'] as const) assert.equal(copy[key], undefined, key)
  assert.equal(copy.checks[0].done, false)
  assert.notEqual(copy.checks[0].id, 'c1')
  assert.equal(copy.assets[0].assetId, null)
  assert.equal(p.checks[0].done, true, 'the original is untouched')
})

test('removePiece also removes its slides and nothing else', () => {
  const ws = makeWorkspace('W'); const c = makeCampaign('X', ['a', 'b']); ws.campaigns.push(c); withSlides(ws, c)
  const keep = c.posts.filter((post) => post.pieceId === c.pieces[1].id).length
  removePiece(c, c.pieces[0].id)
  assert.equal(c.pieces.length, 1)
  assert.equal(c.posts.length, keep)
})

test('movePiece stays in range; sortByDate puts undated last and keeps ties stable', () => {
  const c = makeCampaign('X', ['a', 'b', 'c'])
  movePiece(c, c.pieces[0].id, -1)
  assert.equal(c.pieces[0].title, 'a')
  movePiece(c, c.pieces[0].id, 1)
  assert.equal(c.pieces[1].title, 'a')
  c.pieces[0].date = ''; c.pieces[1].date = '2026-10-09'; c.pieces[2].date = '2026-10-08'
  sortByDate(c)
  assert.deepEqual(c.pieces.map((piece) => piece.title), ['c', 'a', 'b'])
})

test('setKind keeps the format line in step with the kind and clears production for non-reels', () => {
  const p = emptyPiece('P01', 'reel')
  p.production = 'external'; p.productionNote = 'agency'
  setKind(p, 'static')
  assert.equal(p.kind, 'static')
  assert.match(p.plan.format, /Ảnh/)
  assert.equal(p.production, 'internal')
  assert.equal(p.productionNote, '')
})

test('addPiece inserts after a given piece', () => {
  const c = makeCampaign('X', ['a', 'b'])
  addPiece(c, emptyPiece('P09'), c.pieces[0].id)
  assert.equal(c.pieces[1].code, 'P09')
})

// ---------- Excel import ----------
const grid = (rows: string[][]) => rows
const sheets = (extra: Record<string, string[][]> = {}) => ({
  '01_Strategy': grid([['Plan thử']]),
  '02_Calendar': grid([['ID', 'Title / Hook', 'Format', 'Funnel', 'Giờ'], ['P01', 'Bài A', 'Carousel 6 slides', 'TOFU', '20:30'], ['P02', 'Bài B', 'Reel 30s', 'MOFU', '12:00']]),
  '03_Captions': grid([['ID', 'Caption draft', 'Hashtags'], ['P01', 'Caption A từ Sheet', '#a'], ['P02', 'Caption B', '#b']]),
  ...extra,
})

test('parsePlan reads the calendar and captions', () => {
  const plan = parsePlan(sheets())
  assert.equal(plan.pieces.length, 2)
  assert.equal(plan.pieces[0].code, 'P01')
  assert.equal(plan.pieces[0].kind, 'carousel')
  assert.equal(plan.pieces[1].kind, 'reel')
  assert.match(plan.pieces[0].caption, /Caption A/)
})

test('parsePlan without a calendar fails with a message instead of a crash', () => {
  assert.throws(() => parsePlan({ '01_Strategy': [['x']] }), /lịch nội dung/)
})

test('makePiece sanity: fixtures build valid pieces', () => {
  assert.equal(makePiece('P01', 'x').kind, 'carousel')
})

test('a hand-typed carousel gets as many draft slides as its format says; one with a structure keeps it', async () => {
  const { draftSlides } = await import('../src/lib/plan.ts')
  const ws = makeWorkspace('W')
  const hand = emptyPiece('P01', 'carousel')
  hand.plan.format = 'Carousel 5 slides'
  assert.equal(draftSlides(hand, ws.company, []).length, 5)
  hand.plan.structure = 'S1: a; S2: b'
  assert.equal(draftSlides(hand, ws.company, []).length, 2)
  const single = emptyPiece('P02', 'static')
  assert.equal(draftSlides(single, ws.company, []).length, 1)
})
