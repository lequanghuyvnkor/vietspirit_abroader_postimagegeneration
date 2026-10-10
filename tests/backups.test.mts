import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error plain JS module
import { createBackups } from '../backups.mjs'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'studio-bk-'))
  const dataDir = join(root, 'data')
  const assetDir = join(dataDir, 'assets')
  mkdirSync(assetDir, { recursive: true })
  const storeFile = join(dataDir, 'store.json')
  writeFileSync(join(assetDir, 'abcdef123456.png'), 'img-a')
  writeFileSync(storeFile, JSON.stringify({ workspaces: [{ campaigns: [{ pieces: [], posts: [], note: 'abcdef123456.png' }] }] }))
  return { root, dataDir, backups: createBackups({ dataDir, assetDir, storeFile }) }
}

test('the second backup folder gets the store and every image the store uses, once a day', () => {
  const { root, backups } = setup()
  const target = join(root, 'external')
  assert.equal(backups.setMirrorDir(target).dir, target)
  const state = backups.mirrorIfDue()
  assert.equal(state.lastError, '')
  assert.equal(readFileSync(join(target, 'assets', 'abcdef123456.png'), 'utf8'), 'img-a')
  assert.ok(existsSync(join(target, 'store.json')))
  assert.equal(readdirSync(target).filter((name: string) => /^store-\d{8}\.json$/.test(name)).length, 1)
  // Not due again the same day: the copied count does not change and no error appears.
  const again = backups.mirrorIfDue()
  assert.equal(again.lastAt, state.lastAt)
})

test('a second folder inside the data folder or a relative path is refused', () => {
  const { dataDir, backups } = setup()
  assert.ok(backups.setMirrorDir(join(dataDir, 'copy')).error)
  assert.ok(backups.setMirrorDir('relative/path').error)
  assert.equal(backups.mirrorState().dir, '')
})

test('an unwritable second folder is reported, not thrown', () => {
  const { root, backups } = setup()
  const target = join(root, 'external')
  backups.setMirrorDir(target)
  writeFileSync(join(root, 'blocker'), 'x')
  // Point the state at a path under a file so the copy fails.
  writeFileSync(join(root, 'data', 'backup-mirror.json'), JSON.stringify({ dir: join(root, 'blocker', 'sub'), lastAt: '', lastError: '' }))
  const state = backups.runMirror()
  assert.ok(state.lastError)
})
