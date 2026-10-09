import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

const PORT = 3900 + Math.floor(Math.random() * 90)
const BASE = `http://127.0.0.1:${PORT}`
let dir = ''
let child: ChildProcess
let cookie = ''

async function call(path: string, init: RequestInit & { json?: unknown; origin?: string } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (cookie) headers.cookie = cookie
  if (init.json !== undefined) headers['content-type'] = 'application/json'
  if (init.origin) headers.origin = init.origin
  const response = await fetch(`${BASE}${path}`, { method: init.method, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body })
  const text = await response.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* Not JSON. */ }
  return { status: response.status, body: body as Record<string, any>, headers: response.headers, text }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'studio-test-'))
  child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, API_PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/api/session`); return } catch { await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
  throw new Error('server did not start')
})

after(() => { child.kill(); try { rmSync(dir, { recursive: true, force: true }) } catch { /* Windows may hold files briefly. */ } })

const bigStore = () => ({ workspaces: [{ id: 'w', name: 'W', company: {}, updatedAt: '', campaigns: [{ id: 'c', name: 'C', pieces: Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, code: `P${i}`, title: 'x'.repeat(400) })), posts: [] }] }] })

test('before setup: session says not configured and the store is locked', async () => {
  const session = await call('/api/session')
  assert.equal(session.body.configured, false); assert.equal(session.body.authed, false)
  assert.equal((await call('/api/store')).status, 401)
  assert.equal((await call('/api/backups')).status, 401)
})

test('password rules, login, wrong password, logout', async () => {
  assert.equal((await call('/api/auth/setup', { method: 'POST', json: { password: 'short' } })).status, 400)
  const setup = await call('/api/auth/setup', { method: 'POST', json: { password: 'longenough1' } })
  assert.equal(setup.status, 200)
  cookie = (setup.headers.get('set-cookie') ?? '').split(';')[0]
  assert.match(cookie, /^cs_session=/)
  assert.equal((await call('/api/auth/setup', { method: 'POST', json: { password: 'another-one' } })).status, 409, 'cannot set up twice')
  const saved = cookie; cookie = ''
  assert.equal((await call('/api/auth/login', { method: 'POST', json: { password: 'wrong-password' } })).status, 401)
  cookie = saved
  assert.equal((await call('/api/session')).body.authed, true)
})

test('writes from another origin are refused', async () => {
  assert.equal((await call('/api/store', { method: 'PUT', json: { workspaces: [] }, origin: 'https://evil.example' })).status, 403)
  assert.equal((await call('/api/store', { method: 'PUT', json: { workspaces: [] }, origin: 'http://localhost:5190' })).status, 200)
})

test('store round-trips and rejects malformed data', async () => {
  assert.equal((await call('/api/store', { method: 'PUT', json: { nope: 1 } })).status, 400)
  assert.equal((await call('/api/store', { method: 'PUT', body: '{not json' })).status, 400)
  const store = bigStore()
  assert.equal((await call('/api/store', { method: 'PUT', json: store })).status, 200)
  assert.deepEqual((await call('/api/store')).body, store)
})

test('a sudden large shrink keeps the old data in history and it can be restored', async () => {
  const before = (await call('/api/backups')).body.backups.length
  assert.equal((await call('/api/store', { method: 'PUT', json: { workspaces: [] } })).status, 200)
  const list = (await call('/api/backups')).body.backups as { id: string; kind: string }[]
  assert.ok(list.length > before)
  const history = list.find((entry) => entry.kind === 'history')
  assert.ok(history, 'a history snapshot exists')
  const restored = await call(`/api/backups/${history!.id}/restore`, { method: 'POST', json: {} })
  assert.equal(restored.status, 200)
  assert.equal((await call('/api/store')).body.workspaces.length, 1)
  assert.ok((restored.body.backups as { kind: string }[]).some((entry) => entry.kind === 'pre'), 'the state before restoring is kept too')
})

test('backup ids are validated (no path tricks) and unknown ids are 404', async () => {
  for (const id of ['..%2F..%2Fstore.json', 'nope', '20261010-000000-auto', '..']) {
    const response = await call(`/api/backups/${id}/restore`, { method: 'POST', json: {} })
    assert.ok([400, 404].includes(response.status), `${id} -> ${response.status}`)
  }
  assert.equal((await call('/api/backups/..%2F..', { method: 'DELETE' })).status, 200, 'delete of an invalid id is a no-op')
  assert.ok(existsSync(join(dir, 'store.json')), 'the data was not touched')
})

test('manual backup, list, delete', async () => {
  const made = await call('/api/backups', { method: 'POST', json: { label: 'thử' } })
  assert.equal(made.status, 200)
  const manual = (made.body.backups as { id: string; kind: string; label: string }[]).find((entry) => entry.kind === 'manual')!
  assert.equal(manual.label, 'thử')
  const removed = await call(`/api/backups/${manual.id}`, { method: 'DELETE' })
  assert.ok(!(removed.body.backups as { id: string }[]).some((entry) => entry.id === manual.id))
})

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test('assets: upload, serve with the right type, reject junk, and deleted images are recoverable', async () => {
  const bad = await call('/api/assets', { method: 'POST', json: { name: 'x.exe', dataUrl: 'data:application/octet-stream;base64,AAAA' } })
  assert.equal(bad.status, 400)
  assert.equal((await call('/api/assets', { method: 'POST', json: { name: 'x.png', dataUrl: 'not a data url' } })).status, 400)
  const up = await call('/api/assets', { method: 'POST', json: { name: 'a.png', dataUrl: PNG } })
  assert.equal(up.status, 200)
  const id = up.body.id as string
  const got = await fetch(`${BASE}/api/assets/${id}`, { headers: { cookie } })
  assert.equal(got.headers.get('content-type'), 'image/png')
  assert.equal(got.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await call('/api/assets/..%2Fstore.json')).status, 404)
  // reference it from the store, back up, delete the file, restore
  await call('/api/store', { method: 'PUT', json: { workspaces: [{ id: 'w', name: 'W', note: id, campaigns: [] }] } })
  await call('/api/backups', { method: 'POST', json: { label: 'with image' } })
  assert.equal((await call(`/api/assets/${id}`, { method: 'DELETE' })).status, 200)
  assert.equal((await fetch(`${BASE}/api/assets/${id}`, { headers: { cookie } })).status, 404)
  assert.ok(existsSync(join(dir, 'trash', id)), 'deleted images wait in the trash')
  const list = (await call('/api/backups')).body.backups as { id: string; kind: string; label: string }[]
  const backup = list.find((entry) => entry.label === 'with image')!
  const restored = await call(`/api/backups/${backup.id}/restore`, { method: 'POST', json: {} })
  assert.equal(restored.body.missing, 0)
  assert.equal((await fetch(`${BASE}/api/assets/${id}`, { headers: { cookie } })).status, 200, 'the image is back')
})

test('API keys never come back in full', async () => {
  const added = await call('/api/keys', { method: 'POST', json: { provider: 'gemini', label: 't', apiKey: 'sk-secret-VALUE-1234567890' } })
  assert.equal(added.status, 200)
  assert.ok(!added.text.includes('secret-VALUE'))
  assert.equal(added.body.keys[0].last4, '7890')
  assert.ok(!JSON.stringify((await call('/api/keys')).body).includes('secret-VALUE'))
  assert.ok(!readdirSync(dir).some((name) => name.endsWith('.tmp')), 'no temp files left behind')
  assert.ok(readFileSync(join(dir, 'keys.json'), 'utf8').includes('secret-VALUE'), 'stored on this machine only')
})

test('image and text generation refuse bad input before any network call', async () => {
  assert.equal((await call('/api/generate', { method: 'POST', json: { prompt: 'short', width: 1080, height: 1350 } })).status, 400)
  assert.equal((await call('/api/generate', { method: 'POST', json: { prompt: 'a long enough prompt for generation', width: 10, height: 10 } })).status, 400)
  assert.equal((await call('/api/text', { method: 'POST', json: { prompt: '' } })).status, 400)
  assert.equal((await call('/api/nope')).status, 404)
})

test('a window that is behind cannot overwrite newer data (revision check)', async () => {
  const read = await fetch(`${BASE}/api/store`, { headers: { cookie } })
  const rev = read.headers.get('x-store-rev')!
  assert.match(rev, /^[0-9a-f]{16}$/)
  const mine = { workspaces: [{ id: 'mine', name: 'Của cửa sổ A', campaigns: [] }] }
  const first = await call('/api/store', { method: 'PUT', json: mine, headers: { 'if-match': rev } })
  assert.equal(first.status, 200)
  assert.notEqual(first.body.rev, rev)
  // a second window still holding the old revision tries to save
  const stale = await call('/api/store', { method: 'PUT', json: { workspaces: [{ id: 'old', name: 'Bản cũ', campaigns: [] }] }, headers: { 'if-match': rev } })
  assert.equal(stale.status, 409)
  assert.match(String(stale.body.message), /cửa sổ|tab/)
  assert.equal((await call('/api/store')).body.workspaces[0].id, 'mine', 'the newer data is intact')
  // saving again with the latest revision works
  const ok = await call('/api/store', { method: 'PUT', json: mine, headers: { 'if-match': first.body.rev as string } })
  assert.equal(ok.status, 200)
})
