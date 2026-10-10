import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, rmSync, linkSync, copyFileSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

// Backups live in data/backups/<id>/ {store.json, meta.json, assets/}. Assets never change once saved (uuid names), so a
// backup hard-links them: it costs almost no disk and survives the app deleting the original. Deleted assets also go
// to data/trash for 30 days so a restore can bring back an image the app removed.
const KINDS = { auto: 14, history: 40, manual: 30, pre: 5 }
const ID_PATTERN = /^\d{8}-\d{6}-(auto|manual|history|pre)(-\d+)?$/
const ASSET_REF = /[\w-]{8,64}\.(?:png|jpg|webp|woff2|woff|ttf|otf)/g
const TRASH_DAYS = 30
const HISTORY_GAP_MS = 5 * 60 * 1000
const MIRROR_KEEP = 14

export function createBackups({ dataDir, assetDir, storeFile }) {
  const root = join(dataDir, 'backups')
  const trash = join(dataDir, 'trash')
  let lastHistoryAt = 0

  const pad = (value) => String(value).padStart(2, '0')
  const stamp = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
  const bridge = (from, to) => { try { linkSync(from, to) } catch { copyFileSync(from, to) } }

  function summarize(raw) {
    const store = (() => { try { return JSON.parse(raw) } catch { return null } })()
    const workspaces = store?.workspaces ?? []
    const campaigns = workspaces.flatMap((workspace) => workspace.campaigns ?? [])
    return {
      campaigns: campaigns.length,
      pieces: campaigns.reduce((sum, campaign) => sum + (campaign.pieces?.length ?? 0), 0),
      posts: campaigns.reduce((sum, campaign) => sum + (campaign.posts?.length ?? 0), 0),
      bytes: Buffer.byteLength(raw),
    }
  }

  function uniqueId(kind) {
    const base = `${stamp(new Date())}-${kind}`
    let id = base
    for (let n = 2; existsSync(join(root, id)); n += 1) id = `${base}-${n}`
    return id
  }

  /** kind: auto | manual | history | pre. `raw` is the store JSON to keep; history snapshots keep the store only. */
  function snapshot(kind, raw, label = '') {
    mkdirSync(root, { recursive: true })
    const id = uniqueId(kind)
    const dir = join(root, `.${id}.tmp`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'store.json'), raw)
    let assets = 0
    if (kind !== 'history' && existsSync(assetDir)) {
      mkdirSync(join(dir, 'assets'))
      for (const name of readdirSync(assetDir)) {
        try { bridge(join(assetDir, name), join(dir, 'assets', name)); assets += 1 } catch { /* Skip a file that vanished. */ }
      }
    }
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id, kind, label, at: new Date().toISOString(), assets, ...summarize(raw) }))
    renameSync(dir, join(root, id))
    prune()
    return id
  }

  function list() {
    if (!existsSync(root)) return []
    return readdirSync(root).filter((name) => ID_PATTERN.test(name)).map((name) => readJson(join(root, name, 'meta.json'))).filter(Boolean).sort((a, b) => b.at.localeCompare(a.at))
  }

  function prune() {
    const all = list()
    for (const kind of Object.keys(KINDS)) {
      for (const meta of all.filter((item) => item.kind === kind).slice(KINDS[kind])) rmSync(join(root, meta.id), { recursive: true, force: true })
    }
    if (existsSync(trash)) {
      const cutoff = Date.now() - TRASH_DAYS * 86400000
      for (const name of readdirSync(trash)) {
        try { if (statSync(join(trash, name)).mtimeMs < cutoff) rmSync(join(trash, name), { force: true }) } catch { /* Ignore. */ }
      }
    }
  }

  const readStore = () => existsSync(storeFile) ? readFileSync(storeFile, 'utf8') : null

  /** One full backup per calendar day, made on start-up and re-checked while the server runs. */
  function ensureDaily() {
    const raw = readStore()
    if (!raw) return null
    const today = stamp(new Date()).slice(0, 8)
    if (list().some((meta) => meta.kind === 'auto' && meta.id.startsWith(today))) return null
    return snapshot('auto', raw)
  }

  /** Called before the store file is overwritten: keeps a rolling history and guards against a sudden big shrink. */
  function beforeSave(nextRaw) {
    const current = readStore()
    if (!current || current === nextRaw) return
    const shrank = current.length > 20000 && nextRaw.length < current.length * 0.7
    if (!lastHistoryAt) lastHistoryAt = new Date(list().find((meta) => meta.kind === 'history')?.at ?? 0).getTime()
    if (!shrank && Date.now() - lastHistoryAt < HISTORY_GAP_MS) return
    lastHistoryAt = Date.now()
    snapshot('history', current, shrank ? 'Trước khi dữ liệu giảm mạnh' : '')
  }

  function discardAsset(name) {
    const file = join(assetDir, name)
    if (!existsSync(file)) return
    mkdirSync(trash, { recursive: true })
    try { renameSync(file, join(trash, name)) } catch { rmSync(file, { force: true }) }
  }

  function findAsset(name, dir) {
    const candidates = [join(dir, 'assets', name), join(trash, name), ...list().map((meta) => join(root, meta.id, 'assets', name))]
    return candidates.find((file) => existsSync(file)) ?? null
  }

  /** Puts a backup's store back (after saving the current state as a "pre" backup) and returns the missing images. */
  function restore(id) {
    if (!ID_PATTERN.test(id)) return { error: 'Mã bản sao lưu không hợp lệ.' }
    const dir = join(root, id)
    const raw = existsSync(join(dir, 'store.json')) ? readFileSync(join(dir, 'store.json'), 'utf8') : null
    if (!raw) return { error: 'Không tìm thấy bản sao lưu này.' }
    const current = readStore()
    const safety = current ? snapshot('pre', current, `Trước khi khôi phục ${id}`) : null
    mkdirSync(assetDir, { recursive: true })
    let restored = 0
    const missing = []
    for (const name of new Set(raw.match(ASSET_REF) ?? [])) {
      if (existsSync(join(assetDir, name))) continue
      const source = findAsset(name, dir)
      if (source) { bridge(source, join(assetDir, name)); restored += 1 } else missing.push(name)
    }
    const temp = `${storeFile}.${process.pid}.tmp`
    writeFileSync(temp, raw, { mode: 0o600 })
    renameSync(temp, storeFile)
    lastHistoryAt = Date.now()
    return { safety, restored, missing: missing.length }
  }

  function remove(id) {
    if (ID_PATTERN.test(id)) rmSync(join(root, id), { recursive: true, force: true })
  }

  // ---- Second folder ----
  // A backup on the same disk does not survive the disk. The user can name another folder (an external drive, a synced
  // Drive folder); the store and every image it uses are copied there once a day and on demand. Images are copied only once.
  const mirrorFile = join(dataDir, 'backup-mirror.json')
  const mirrorState = () => readJson(mirrorFile) ?? { dir: '', lastAt: '', lastError: '' }
  const saveMirror = (state) => writeFileSync(mirrorFile, JSON.stringify(state))

  function setMirrorDir(dir) {
    const value = String(dir ?? '').trim()
    if (!value) { saveMirror({ dir: '', lastAt: '', lastError: '' }); return mirrorState() }
    if (!isAbsolute(value)) return { error: 'Cần đường dẫn đầy đủ, ví dụ D:\\SaoLuuStudio hoặc C:\\Users\\Ban\\Drive\\SaoLuu.' }
    const insideData = join(value, 'x').startsWith(join(dataDir, 'x').slice(0, -1))
    if (insideData) return { error: 'Thư mục này nằm trong thư mục dữ liệu của app, không bảo vệ được khi hỏng ổ cứng. Chọn một ổ hoặc nơi khác.' }
    try {
      mkdirSync(join(value, 'assets'), { recursive: true })
      const probe = join(value, '.probe')
      writeFileSync(probe, 'ok')
      rmSync(probe, { force: true })
    } catch { return { error: 'App không ghi được vào thư mục này. Kiểm tra đường dẫn và quyền ghi.' } }
    saveMirror({ dir: value, lastAt: '', lastError: '' })
    return mirrorState()
  }

  /** Copies the current store and the images it uses into the second folder. Never throws: the outcome is kept in the state file. */
  function runMirror() {
    const state = mirrorState()
    if (!state.dir) return state
    try {
      const raw = readStore()
      if (!raw) return state
      mkdirSync(join(state.dir, 'assets'), { recursive: true })
      let copied = 0
      for (const name of new Set(raw.match(ASSET_REF) ?? [])) {
        const target = join(state.dir, 'assets', name)
        if (existsSync(target)) continue
        const source = [join(assetDir, name), join(trash, name)].find((file) => existsSync(file))
        if (source) { copyFileSync(source, target); copied += 1 }
      }
      const day = stamp(new Date()).slice(0, 8)
      const temp = join(state.dir, '.store.tmp')
      writeFileSync(temp, raw)
      renameSync(temp, join(state.dir, 'store.json'))
      writeFileSync(join(state.dir, `store-${day}.json`), raw)
      const dated = readdirSync(state.dir).filter((name) => /^store-\d{8}\.json$/.test(name)).sort().reverse()
      for (const name of dated.slice(MIRROR_KEEP)) rmSync(join(state.dir, name), { force: true })
      const next = { ...state, lastAt: new Date().toISOString(), lastError: '', lastCopied: copied }
      saveMirror(next)
      return next
    } catch (error) {
      const next = { ...state, lastError: error instanceof Error ? error.message : 'Không chép được sang thư mục thứ hai.' }
      try { saveMirror(next) } catch { /* Nothing more to do. */ }
      return next
    }
  }

  /** Once per calendar day. */
  function mirrorIfDue() {
    const state = mirrorState()
    if (!state.dir) return state
    if (state.lastAt && !state.lastError && stamp(new Date(state.lastAt)).slice(0, 8) === stamp(new Date()).slice(0, 8)) return state
    return runMirror()
  }

  return { list, snapshot, readStore, ensureDaily, beforeSave, discardAsset, restore, remove, mirrorState, setMirrorDir, runMirror, mirrorIfDue }
}
