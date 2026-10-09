import assert from 'node:assert/strict'
import { test } from 'node:test'
import { unzipSync, strFromU8 } from 'fflate'
import { buildDocument, documentPieces } from '../src/lib/document.ts'
import { toDocx, toHtml } from '../src/lib/docExport.ts'
import { funnelMix, parseIdeas } from '../src/lib/planAi.ts'
import { autoChecks, bannedPhrases, blockersOf, diffSummary, recordVersion, restoreVersion } from '../src/lib/review.ts'
import { buildTemplate, campaignFromTemplate, engagementRate, groupTotals, reminders, topPieces, totalsOf } from '../src/lib/results.ts'
import { addDays, coverage, daysBetween, milestonesOf, openTasks, pillarsOf, todayIso, weeksOf } from '../src/lib/schedule.ts'
import { fold, searchStore } from '../src/lib/search.ts'
import { makeCampaign, makeStore, makeWorkspace, withSlides } from './fixtures.mts'

function scene() {
  const ws = makeWorkspace('VietSpirit')
  const c = makeCampaign('KAIST', ['Mở đơn hồ sơ gấp', 'Giới thiệu mentor', 'KAIST phù hợp với ai?'])
  c.variables = { 'SỐ SUẤT': '10 suất' }
  ws.campaigns.push(c)
  withSlides(ws, c)
  return { ws, c }
}

// ---------- review ----------
test('auto check blocks unresolved variables, banned phrases and an empty caption', () => {
  const { c } = scene()
  const p = c.pieces[0]
  p.caption = 'Giảm ngay [GIÁ ƯU ĐÃI] cho bạn. Cam kết đậu 100%.'
  c.guardrailNotes = ['Không dùng cụm "cam kết đậu"']
  const blockers = blockersOf(autoChecks(c, p))
  assert.ok(blockers.some((check) => /biến chưa điền/.test(check.text)))
  assert.ok(autoChecks(c, p).some((check) => check.level === 'warn' && /Không được nói/.test(check.text) && /cam kết đậu/.test(check.text)))
  p.caption = ''
  assert.ok(blockersOf(autoChecks(c, p)).some((check) => /caption/i.test(check.text)))
})

test('auto check warns on dates after the campaign and on figures nobody provided, not on slide counters', () => {
  const { c } = scene()
  const p = c.pieces[0]
  p.caption = 'Hạn chót 25/10, giảm 30% học phí. Slide 01 và 02.'
  const texts = autoChecks(c, p).map((check) => check.text).join('\n')
  assert.match(texts, /25\/10/)
  assert.match(texts, /30/)
  assert.doesNotMatch(texts, /Số liệu[^\n]*\b0[12]\b/)
})

test('a figure that appears in the plan or the confirmed variables is accepted', () => {
  const { c } = scene()
  const p = c.pieces[0]
  c.variables['HỌC BỔNG'] = '50% học phí'
  p.caption = 'Học bổng 50% học phí cho 10 suất.'
  assert.ok(!autoChecks(c, p).some((check) => /Số liệu/.test(check.text)))
})

test('history is capped and identical consecutive entries are not duplicated', () => {
  const { c } = scene()
  const p = c.pieces[0]
  recordVersion(c, p, 'manual'); recordVersion(c, p, 'manual')
  assert.equal(p.history!.length, 1)
  for (let i = 0; i < 40; i++) { p.caption = `v${i}`; recordVersion(c, p, 'manual', String(i)) }
  assert.equal(p.history!.length, 20)
})

test('restoreVersion brings text and slides back and keeps the current state in history', () => {
  const { c } = scene()
  const p = c.pieces[0]
  const slides = c.posts.filter((post) => post.pieceId === p.id).length
  p.caption = 'bản tốt'; recordVersion(c, p, 'manual')
  const id = p.history!.at(-1)!.id
  p.caption = 'bản hỏng'; c.posts = c.posts.filter((post) => post.pieceId !== p.id)
  assert.ok(restoreVersion(c, p, id))
  assert.equal(p.caption, 'bản tốt')
  assert.equal(c.posts.filter((post) => post.pieceId === p.id).length, slides)
  assert.equal(p.status, 'copy')
  assert.equal(p.history!.at(-1)!.event, 'restore')
  assert.equal(restoreVersion(c, p, 'missing'), false)
})

test('diffSummary names what changed', () => {
  const { c } = scene()
  const p = c.pieces[0]
  recordVersion(c, p, 'manual')
  const snap = p.history!.at(-1)!.snapshot
  assert.deepEqual(diffSummary(c, p, snap), [])
  p.caption = 'khác'; p.plan.cta = 'CTA mới'
  const parts = diffSummary(c, p, snap)
  assert.ok(parts.includes('caption') && parts.includes('kế hoạch/brief'))
})

// ---------- schedule ----------
test('date helpers are timezone-safe across month ends and daylight changes', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(daysBetween('2026-10-07', '2026-10-21'), 14)
  assert.equal(todayIso(new Date(2026, 9, 10, 23, 59)), '2026-10-10')
})

test('weeksOf lays October 2026 out Monday first with full weeks', () => {
  const weeks = weeksOf(2026, 9)
  assert.equal(weeks[0][0], '2026-09-28')
  assert.equal(weeks[0][3], '2026-10-01')
  assert.ok(weeks.every((week) => week.length === 7))
  assert.equal(weeks.at(-1)!.at(-1), '2026-11-01')
})

test('backward schedule: deadlines from the publish date and what counts as done', () => {
  const { c } = scene()
  const p = c.pieces[0]
  p.date = '2026-10-20'; p.status = 'copy'
  const [copy, visual, review] = milestonesOf(p, { copy: 5, visual: 3, review: 1 })
  assert.equal(copy.due, '2026-10-15'); assert.equal(visual.due, '2026-10-17'); assert.equal(review.due, '2026-10-19')
  assert.deepEqual([copy.done, visual.done, review.done], [true, false, false])
  assert.deepEqual(milestonesOf({ ...p, date: '' }, { copy: 5, visual: 3, review: 1 }), [])
})

test('openTasks puts the most overdue first and skips finished work', () => {
  const { c } = scene()
  c.pieces[0].date = '2026-10-12'; c.pieces[1].date = '2026-10-30'; c.pieces[2].date = ''
  const tasks = openTasks(c, '2026-10-10')
  assert.equal(tasks[0].piece.code, 'P01')
  assert.ok(tasks[0].days <= tasks.at(-1)!.days)
  assert.ok(!tasks.some((task) => task.piece.code === 'P03'))
})

test('pillarsOf matches by name or by P<n> and never throws on empty text', () => {
  const { c } = scene()
  c.pieces[0].plan.pillar = 'P2 · Minh bạch'
  c.pieces[1].plan.pillar = 'Đồng hành chuyên môn'
  c.pieces[2].plan.pillar = ''
  assert.deepEqual(pillarsOf(c, c.pieces[0]), [1])
  assert.deepEqual(pillarsOf(c, c.pieces[1]), [0])
  assert.deepEqual(pillarsOf(c, c.pieces[2]), [])
})

test('coverage reports missing funnel stages and pillars without false alarms on tiny plans', () => {
  const { c } = scene()
  c.pieces.forEach((piece) => { piece.plan.funnel = 'TOFU'; piece.plan.pillar = 'P1' })
  c.pieces[0].date = '2026-10-07'; c.pieces[1].date = '2026-10-10'; c.pieces[2].date = '2026-10-12'
  const gaps = coverage(c).gaps.join('\n')
  assert.match(gaps, /Chưa có bài MOFU/); assert.match(gaps, /BOFU/); assert.match(gaps, /Trụ cột/)
  const small = makeCampaign('tiny', ['a', 'b'])
  assert.ok(!coverage(small).gaps.some((gap) => /Chưa có bài/.test(gap)))
})

test('funnelMix always sums to the count and keeps each stage when it fits', () => {
  for (let n = 1; n <= 30; n++) {
    const mix = funnelMix(n)
    assert.equal(mix.TOFU + mix.MOFU + mix.BOFU, n, `n=${n}`)
    assert.ok(mix.TOFU >= 0)
    if (n >= 3) assert.ok(mix.MOFU >= 1 && mix.BOFU >= 1)
  }
})

test('parseIdeas copes with code fences, a bare array, unknown kinds and nonsense', () => {
  const json = JSON.stringify({ ideas: [{ title: 'A', kind: 'reel', funnel: 'bofu', time: '20:30' }, { title: 'B', kind: 'weird' }, {}] })
  const ideas = parseIdeas('```json\n' + json + '\n```')
  assert.equal(ideas.length, 2)
  assert.equal(ideas[0].funnel, 'BOFU'); assert.equal(ideas[1].kind, 'static'); assert.equal(ideas[1].funnel, '')
  assert.equal(parseIdeas(JSON.stringify([{ title: 'X' }])).length, 1)
  assert.throws(() => parseIdeas('không phải JSON'))
  assert.deepEqual(parseIdeas('{"ideas":"sai"}'), [])
})

// ---------- results ----------
function published(c: ReturnType<typeof scene>['c']) {
  const [a, b, d] = c.pieces
  a.published = { at: '2026-10-08T13:30:00.000Z', url: 'https://x', note: '' }; a.metrics = { reach: 1000, engagement: 80, clicks: 20, leads: 5, updatedAt: '' }
  b.published = { at: '2026-10-09T13:30:00.000Z', url: '', note: '' }; b.metrics = { reach: 2000, engagement: 100, clicks: null, leads: 2, updatedAt: '' }
  d.published = { at: '2026-10-10T13:30:00.000Z', url: '', note: '' }; d.metrics = { reach: 500, engagement: null, clicks: null, leads: null, updatedAt: '' }
}

test('totals: reach counts every measured piece, engagement rate only pieces that have both', () => {
  const { c } = scene(); published(c)
  const totals = totalsOf(c.pieces)
  assert.equal(totals.published, 3); assert.equal(totals.reach, 3500); assert.equal(totals.leads, 7); assert.equal(totals.clicks, 20)
  assert.ok(Math.abs((totals.er ?? 0) - 0.06) < 1e-9)
  assert.equal(engagementRate(undefined), null)
  assert.equal(engagementRate({ reach: 0, engagement: 5, clicks: 0, leads: 0, updatedAt: '' }), null)
})

test('an unpublished piece never counts, even if it has numbers', () => {
  const { c } = scene()
  c.pieces[0].metrics = { reach: 999, engagement: 9, clicks: 1, leads: 1, updatedAt: '' }
  assert.equal(totalsOf(c.pieces).reach, 0)
})

test('groupTotals splits by funnel in order and counts a two-pillar piece in both', () => {
  const { c } = scene(); published(c)
  c.pieces[0].plan.funnel = 'BOFU'; c.pieces[1].plan.funnel = 'TOFU'; c.pieces[2].plan.funnel = 'MOFU'
  assert.deepEqual(groupTotals(c, 'funnel').map((row) => row.label), ['TOFU', 'MOFU', 'BOFU'])
  c.pieces[0].plan.pillar = 'P1/P2'
  const pillars = groupTotals(c, 'pillar')
  assert.equal(pillars.reduce((sum, row) => sum + row.planned, 0), 4)
})

test('topPieces ranks by the chosen result and skips zeros', () => {
  const { c } = scene(); published(c)
  assert.equal(topPieces(c, 'leads')[0].code, 'P01')
  assert.ok(!topPieces(c, 'leads').some((piece) => piece.code === 'P03'))
})

test('reminders: overdue by date, due today, and within the hour', () => {
  const { c } = scene()
  c.pieces[0].date = '2026-10-09'
  c.pieces[1].date = '2026-10-10'; c.pieces[1].plan.time = '20:30 VN'
  c.pieces[2].date = '2026-10-10'; c.pieces[2].plan.time = '09:30'
  const at = (minutes: number) => Object.fromEntries(reminders(c, '2026-10-10', minutes).map((entry) => [entry.piece.code, entry.kind]))
  assert.deepEqual(at(9 * 60), { P01: 'late', P02: 'due', P03: 'soon' })
  assert.deepEqual(at(10 * 60), { P01: 'late', P02: 'due', P03: 'late' })
  c.pieces[0].published = { at: '', url: '', note: '' }
  assert.ok(!('P01' in at(0)))
})

test('templates keep the plan but none of the work', () => {
  const { c } = scene(); published(c)
  c.pieces[0].date = '2026-10-07'; c.pieces[1].date = '2026-10-10'; c.pieces[2].date = ''
  c.pieces[0].approval = { at: 'x', fingerprint: 'y', note: '' }
  const template = buildTemplate(c, 'Mẫu')
  assert.deepEqual(template.pieces.map((piece) => piece.dayOffset), [0, 3, null])
  assert.ok(!JSON.stringify(template).includes('Caption của'))
  assert.deepEqual(template.variableKeys, ['SỐ SUẤT'])
  assert.ok(!('guardrails' in template))
  const next = campaignFromTemplate(template, 'Mới', '2026-11-02')
  assert.deepEqual(next.pieces.map((piece) => piece.date), ['2026-11-02', '2026-11-05', ''])
  assert.deepEqual(next.pieces.map((piece) => piece.code), ['P01', 'P02', 'P03'])
  assert.ok(next.pieces.every((piece) => piece.caption === '' && piece.status === 'brief' && !piece.published))
  assert.equal(next.variables['SỐ SUẤT'], '')
  assert.equal(next.posts.length, 0)
  assert.equal(next.foundation.start, '2026-11-02')
  assert.notEqual(next.id, c.id)
})

// ---------- search ----------
test('fold removes Vietnamese accents one character for one character', () => {
  assert.equal(fold('Đồng hành ĐẠI HỌC'), 'dong hanh dai hoc')
  assert.equal(fold('KAIST phù hợp').length, 'KAIST phù hợp'.length)
})

test('search finds across workspaces without accents, needs every word, and ranks codes and titles first', () => {
  const { ws, c } = scene()
  const other = makeWorkspace('VinaSciTech', [makeCampaign('Pilot', ['Logify cho kho vận'])])
  const store = makeStore(ws, other)
  assert.equal(searchStore(store, 'kaist phu hop')[0].title.includes('P03'), true)
  assert.equal(searchStore(store, 'logify kho')[0].where.includes('VinaSciTech'), true)
  assert.equal(searchStore(store, 'kaist logify').length, 0)
  assert.equal(searchStore(store, '   ').length, 0)
  assert.equal(searchStore(store, 'p02')[0].kind, 'piece')
  c.posts[0].headline = 'Tiêu đề độc nhất xyz'
  assert.equal(searchStore(store, 'doc nhat xyz')[0].kind, 'slide')
  assert.ok(searchStore(store, 'a', 3).length <= 3)
})

// ---------- document ----------
test('document has strategy, calendar, one section per piece, and results only after publishing', () => {
  const { ws, c } = scene(); c.foundation.objective = 'Tạo lead'; c.foundation.bigIdea = 'Horizon'
  const before = buildDocument(ws, c, { readyOnly: false, images: true })
  const headings = before.blocks.filter((block) => block.t === 'h').map((block) => (block as { text: string }).text)
  assert.ok(headings.some((text) => text.startsWith('1.')) && headings.some((text) => text.startsWith('2.')) && headings.some((text) => text.startsWith('3.')))
  assert.ok(!headings.some((text) => text.startsWith('4.')))
  assert.equal(headings.filter((text) => /^P0\d ·/.test(text)).length, 3)
  published(c)
  assert.ok(buildDocument(ws, c, { readyOnly: false, images: false }).blocks.some((block) => block.t === 'h' && block.text.startsWith('4.')))
  assert.ok(!buildDocument(ws, c, { readyOnly: false, images: false }).blocks.some((block) => block.t === 'images'))
})

test('readyOnly keeps only ready pieces', () => {
  const { c } = scene()
  c.pieces[1].status = 'ready'
  assert.deepEqual(documentPieces(c, { readyOnly: true, images: false }).map((piece) => piece.code), ['P02'])
})

test('html escapes tags, docx is a valid zip of well-formed parts', () => {
  const { ws, c } = scene()
  c.pieces[0].caption = 'a | b <script>alert(1)</script> "q" & co'
  const model = buildDocument(ws, c, { readyOnly: false, images: true })
  const html = toHtml(model, new Map())
  assert.ok(!html.includes('<script>alert') && html.includes('&lt;script&gt;'))
  const jpg = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'))
  const images = new Map<string, { blob: Blob; bytes: Uint8Array; w: number; h: number }>()
  for (const block of model.blocks) if (block.t === 'images') for (const item of block.items) images.set(item.ref, { blob: new Blob(), bytes: jpg, w: item.w, h: item.h })
  const files = unzipSync(toDocx(model, images))
  for (const name of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) assert.ok(files[name], name)
  const document = strFromU8(files['word/document.xml'])
  assert.ok(document.includes('&lt;script&gt;'))
  assert.ok(!/<w:t[^>]*>[^<]*<script>/.test(document))
  assert.equal((document.match(/<w:drawing>/g) ?? []).length, images.size)
  assert.equal(Object.keys(files).filter((name) => name.startsWith('word/media/')).length, images.size)
  assert.ok((document.match(/<w:tbl>/g) ?? []).length === (document.match(/<\/w:tbl>/g) ?? []).length)
})


test('banned phrases come from quotes, or from short "Không được nói" lines, never from long descriptions', () => {
  assert.deepEqual(bannedPhrases(['Đừng nói "đậu chắc chắn" hay "bao đậu"']), ['đậu chắc chắn', 'bao đậu'])
  assert.deepEqual(bannedPhrases(['Lớp thông điệp: cam kết visa']), ['cam kết visa'])
  assert.deepEqual(bannedPhrases(['Không hứa chắc kết quả đậu hay học bổng cho bất kỳ học sinh nào trong chiến dịch này vì còn nhiều yếu tố']), [])
})

test('"Không được nói" phrases are matched without accents and ignore case', () => {
  const { c } = scene()
  c.guardrailNotes = ['Tránh: "BAO ĐẬU"']
  c.pieces[0].caption = 'Chương trình bao dau 100% cho bạn.'
  assert.ok(autoChecks(c, c.pieces[0]).some((check) => /Không được nói/.test(check.text)))
  c.pieces[0].caption = 'Chương trình hỗ trợ hồ sơ.'
  assert.ok(!autoChecks(c, c.pieces[0]).some((check) => /Không được nói/.test(check.text)))
})

test('a piece reaches "ready" only through the status field: restoring a version sends it back to copy', () => {
  const { c } = scene()
  const p = c.pieces[0]
  p.caption = 'bản tốt'; recordVersion(c, p, 'manual')
  p.status = 'ready'; p.caption = 'bản sửa'
  assert.ok(restoreVersion(c, p, p.history![0].id))
  assert.equal(p.status, 'copy'); assert.equal(p.caption, 'bản tốt')
})
