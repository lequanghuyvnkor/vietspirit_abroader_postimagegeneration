import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detachSheetData, findIssues, linkBlocked, otherOwner, sheetKey } from '../src/lib/integrity.ts'
import { addPiece, codeIsTaken, duplicatePiece, emptyPiece, movePiece, nextCode, removePiece, setKind, sortByDate } from '../src/lib/planEdit.ts'
import { mergePlan } from '../src/lib/sheetSync.ts'
import { parsePlan } from '../src/lib/plan.ts'
import { SHEET_URL_A, SHEET_URL_B, makeCampaign, makePiece, makeStore, makeWorkspace, sheetOf, withSlides } from './fixtures.mts'

// ---------- integrity: the "VinaSciTech got VietSpirit's plan" class of bugs ----------
test('sheetKey reads the Apps Script id and ignores a trailing slash', () => {
  assert.equal(sheetKey(SHEET_URL_A), 'AKfycbAAAAAAAAAAAAAAAAAA')
  assert.equal(sheetKey(`${SHEET_URL_A}/`), 'AKfycbAAAAAAAAAAAAAAAAAA')
  assert.equal(sheetKey('not a url'), '')
})

test('two campaigns on one Sheet are flagged, a campaign on its own Sheet is not', () => {
  const a = makeCampaign('KAIST', ['A', 'B']); a.sheetSync = sheetOf(SHEET_URL_A)
  const b = makeCampaign('Pilot', []); b.sheetSync = sheetOf(SHEET_URL_A)
  const store = makeStore(makeWorkspace('VietSpirit', [a]), makeWorkspace('VinaSciTech', [b]))
  const issues = findIssues(store)
  assert.equal(issues.filter((issue) => issue.id.startsWith('sheet-')).length, 2)
  assert.ok(issues.every((issue) => issue.level === 'warn'))
  assert.ok(linkBlocked(store, b, 'sheet'))
  b.sheetSync = sheetOf(SHEET_URL_B)
  assert.equal(findIssues(store).filter((issue) => issue.id.startsWith('sheet-')).length, 0)
  assert.equal(otherOwner(store, b.id, 'sheet', SHEET_URL_A)?.campaign.id, a.id)
})

test('"cố ý dùng chung" silences the Sheet warning for that campaign only', () => {
  const a = makeCampaign('A', []); a.sheetSync = sheetOf(SHEET_URL_A)
  const b = makeCampaign('B', []); b.sheetSync = { ...sheetOf(SHEET_URL_A), allowShared: true }
  const store = makeStore(makeWorkspace('W1', [a]), makeWorkspace('W2', [b]))
  const ids = findIssues(store).map((issue) => issue.campaignId)
  assert.deepEqual(ids, [a.id])
})

test('Docs shared by two campaigns are flagged', () => {
  const a = makeCampaign('A', []); a.docsSync = { url: SHEET_URL_A, doc: 'https://docs.google.com/document/d/1abcDEFghiJKLmnoPQRstuVWXyz/edit', auto: true, sent: {} }
  const b = makeCampaign('B', []); b.docsSync = { ...a.docsSync, sent: {} }
  const issues = findIssues(makeStore(makeWorkspace('W1', [a]), makeWorkspace('W2', [b])))
  assert.equal(issues.filter((issue) => issue.id.startsWith('docs-')).length, 2)
})

test('look-alike plans across workspaces are reported once and can be ignored', () => {
  const a = makeCampaign('KAIST', ['Mở đơn', 'Giới thiệu mentor', 'KAIST phù hợp với ai?', 'Giải mã'])
  const b = makeCampaign('Pilot', ['Mở đơn', 'Giới thiệu mentor', 'KAIST phù hợp với ai?', 'Khác hẳn'])
  const store = makeStore(makeWorkspace('VietSpirit', [a]), makeWorkspace('VinaSciTech', [b]))
  const plan = findIssues(store).filter((issue) => issue.id.startsWith('plan-'))
  assert.equal(plan.length, 1)
  assert.equal(plan[0].campaignId, b.id)
  b.ignoredIssues = [plan[0].id]
  assert.equal(findIssues(store).filter((issue) => issue.id.startsWith('plan-')).length, 0)
})

test('plans inside one workspace never count as look-alikes', () => {
  const a = makeCampaign('A', ['x1', 'x2', 'x3', 'x4']); const b = makeCampaign('B', ['x1', 'x2', 'x3', 'x4'])
  assert.equal(findIssues(makeStore(makeWorkspace('Same', [a, b]))).length, 0)
})

test('detachSheetData removes only Sheet-pulled pieces, their slides, the strategy and the link', () => {
  const ws = makeWorkspace('VinaSciTech')
  const c = makeCampaign('Pilot', ['pulled 1', 'pulled 2', 'own'])
  ws.campaigns.push(c)
  for (const piece of c.pieces.slice(0, 2)) piece.sheetBase = { caption: '', hashtags: '', date: '', time: '', linked: true }
  withSlides(ws, c)
  c.sheetSync = { ...sheetOf(SHEET_URL_A), pulledAt: new Date().toISOString() }
  c.strategy = 'Chiến lược từ Sheet'; c.guardrailNotes = ['không nói X']; c.foundation.objective = 'Mục tiêu của tôi'
  const ownSlides = c.posts.filter((post) => post.pieceId === c.pieces[2].id).length
  const removed = detachSheetData(c)
  assert.equal(removed.pieces, 2)
  assert.equal(c.pieces.length, 1)
  assert.equal(c.pieces[0].title, 'own')
  assert.equal(c.posts.length, ownSlides)
  assert.equal(c.sheetSync, undefined)
  assert.equal(c.strategy, '')
  assert.equal(c.foundation.objective, 'Mục tiêu của tôi')
})

test('detachSheetData on a never-pulled campaign keeps the strategy the user typed', () => {
  const c = makeCampaign('X', []); c.sheetSync = sheetOf(SHEET_URL_A); c.strategy = 'viết tay'
  detachSheetData(c)
  assert.equal(c.strategy, 'viết tay')
})

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

test('duplicatePiece starts clean: no date, approval, history, results, Sheet link or photos', () => {
  const c = makeCampaign('X', ['gốc'])
  const p = c.pieces[0]
  Object.assign(p, { date: '2026-10-10', status: 'ready', approval: { at: 'x', fingerprint: 'y', note: '' }, history: [{ id: '1', at: 'x', event: 'manual', note: '', snapshot: {} as never }], published: { at: 'x', url: '', note: '' }, metrics: { reach: 5, engagement: 1, clicks: 0, leads: 1, updatedAt: 'x' }, sheetBase: { caption: '', hashtags: '', date: '', time: '', linked: true } })
  p.checks = [{ id: 'c1', text: 'ok', owner: 'me', done: true }]
  p.assets = [{ id: 'a1', label: 'ảnh', assetId: 'file.png', done: true, note: '' }]
  const copy = duplicatePiece(c, p.id)!
  assert.equal(c.pieces[1].id, copy.id)
  assert.notEqual(copy.code, p.code)
  assert.equal(copy.date, '')
  assert.equal(copy.status, 'brief')
  for (const key of ['approval', 'history', 'published', 'metrics', 'sheetBase'] as const) assert.equal(copy[key], undefined, key)
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

// ---------- Sheet merge: the Sheet owns the plan, the app owns the work ----------
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

test('mergePlan adds new pieces, keeps app status and slides, and reports a real conflict', () => {
  const ws = makeWorkspace('W'); const c = makeCampaign('X', [])
  ws.campaigns.push(c)
  const first = mergePlan(c, parsePlan(sheets()), ws.company, { makeSlides: true })
  assert.deepEqual(first.added, ['P01', 'P02'])
  assert.ok(c.posts.length > 0)
  const a = c.pieces.find((piece) => piece.code === 'P01')!
  a.status = 'visual'
  a.caption = 'Caption đã sửa trong app'
  const slidesBefore = c.posts.length
  const second = mergePlan(c, parsePlan(sheets({ '03_Captions': grid([['ID', 'Caption draft', 'Hashtags'], ['P01', 'Sheet đổi caption', '#a'], ['P02', 'Caption B', '#b']]) })), ws.company, { makeSlides: true })
  assert.equal(a.status, 'visual', 'status belongs to the app')
  assert.equal(a.caption, 'Caption đã sửa trong app', 'the app edit wins')
  assert.equal(second.conflicts.some((conflict) => conflict.code === 'P01' && conflict.field === 'caption'), true)
  assert.equal(c.posts.length, slidesBefore, 'a second pull makes no new slides')
})

test('mergePlan follows the Sheet when only the Sheet changed a field', () => {
  const ws = makeWorkspace('W'); const c = makeCampaign('X', [])
  mergePlan(c, parsePlan(sheets()), ws.company, { makeSlides: false })
  const report = mergePlan(c, parsePlan(sheets({ '03_Captions': grid([['ID', 'Caption draft', 'Hashtags'], ['P01', 'Mới từ Sheet', '#a'], ['P02', 'Caption B', '#b']]) })), ws.company, { makeSlides: false })
  assert.equal(c.pieces.find((piece) => piece.code === 'P01')!.caption, 'Mới từ Sheet')
  assert.equal(report.conflicts.length, 0)
})

test('mergePlan keeps pieces that are not in the Sheet and lists them as missing', () => {
  const ws = makeWorkspace('W'); const c = makeCampaign('X', ['Chỉ trong app'])
  c.pieces[0].code = 'P99'
  const report = mergePlan(c, parsePlan(sheets()), ws.company, { makeSlides: false })
  assert.deepEqual(report.missing, ['P99'])
  assert.ok(c.pieces.some((piece) => piece.title === 'Chỉ trong app'))
})

test('mergePlan tolerates a piece made by hand with the same code as a Sheet row', () => {
  const ws = makeWorkspace('W'); const c = makeCampaign('X', ['Bài viết tay'])
  c.pieces[0].caption = 'Viết tay'
  const report = mergePlan(c, parsePlan(sheets()), ws.company, { makeSlides: false })
  assert.equal(c.pieces.find((piece) => piece.code === 'P01')!.caption, 'Viết tay')
  assert.ok(report.conflicts.length >= 1, 'a hand-written caption is not silently replaced')
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
