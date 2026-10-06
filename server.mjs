import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from 'node:fs'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

function loadLocalEnv() {
  try {
    const contents = readFileSync(new URL('.env.local', import.meta.url), 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  } catch { /* .env.local is optional. */ }
}

loadLocalEnv()

const PORT = Number(process.env.API_PORT || 3001)
const DATA_DIR = process.env.DATA_DIR || join(fileURLToPath(new URL('.', import.meta.url)), 'data')
const ASSET_DIR = join(DATA_DIR, 'assets')
const STORE_FILE = join(DATA_DIR, 'store.json')
const AUTH_FILE = join(DATA_DIR, 'auth.json')
mkdirSync(ASSET_DIR, { recursive: true })

const MAX_STORE_BYTES = 8 * 1024 * 1024
const MAX_ASSET_BYTES = 16 * 1024 * 1024
const SESSION_MS = 7 * 24 * 60 * 60 * 1000
const COOKIE = 'cs_session'

const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const FONT_EXT = new Set(['woff2', 'woff', 'ttf', 'otf'])
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }
const ASSET_ID = /^[\w-]{8,64}\.(png|jpg|webp|woff2|woff|ttf|otf)$/

const sessions = new Map()
let failedLogins = 0
let lockedUntil = 0

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers })
  res.end(JSON.stringify(data))
}

function fail(status, message) {
  return Object.assign(new Error(message), { status })
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let over = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) over = true
      else chunks.push(chunk)
    })
    req.on('end', () => over ? reject(fail(413, 'Dữ liệu gửi lên quá lớn.')) : resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJson(req, limit = MAX_STORE_BYTES) {
  const body = await readBody(req, limit)
  try { return JSON.parse(body.toString('utf8') || '{}') }
  catch { throw fail(400, 'Dữ liệu gửi lên không hợp lệ.') }
}

function writeAtomic(file, contents) {
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, contents, { mode: 0o600 })
  renameSync(temp, file)
}

// ---------- Auth ----------
function readAuth() {
  try { return JSON.parse(readFileSync(AUTH_FILE, 'utf8')) } catch { return null }
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function checkPassword(password) {
  const auth = readAuth()
  if (!auth || typeof password !== 'string') return false
  const expected = Buffer.from(auth.hash, 'hex')
  const actual = Buffer.from(hashPassword(password, auth.salt), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function setPassword(password) {
  const salt = randomBytes(16).toString('hex')
  writeAtomic(AUTH_FILE, JSON.stringify({ salt, hash: hashPassword(password, salt) }))
}

function validNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw fail(400, 'Mật khẩu cần từ 8 ký tự.')
}

function cookieToken(req) {
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)`))
  return match?.[1] ?? null
}

function isAuthed(req) {
  const token = cookieToken(req)
  const expires = token ? sessions.get(token) : undefined
  if (!expires) return false
  if (expires < Date.now()) { sessions.delete(token); return false }
  return true
}

function startSession(res, data) {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_MS)
  send(res, 200, data, { 'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}` })
}

function originAllowed(req) {
  const origin = req.headers.origin
  return !origin || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
}

function aiStatus() {
  return {
    ready: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY),
    provider: process.env.AI_PROVIDER === 'gemini' ? 'gemini' : 'openai',
  }
}

// ---------- Assets ----------
function assetPath(id) {
  if (!ASSET_ID.test(id)) throw fail(404, 'Không tìm thấy tệp.')
  return join(ASSET_DIR, id)
}

function saveAsset(buffer, ext) {
  const id = `${randomUUID()}.${ext}`
  writeFileSync(join(ASSET_DIR, id), buffer)
  return id
}

function parseDataUrl(value) {
  const match = typeof value === 'string' ? value.match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/) : null
  if (!match) throw fail(400, 'Tệp không hợp lệ.')
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
}

async function uploadAsset(req, res) {
  const input = await readJson(req, MAX_ASSET_BYTES)
  const { mime, buffer } = parseDataUrl(input.dataUrl)
  const nameExt = String(input.name ?? '').split('.').pop()?.toLowerCase() ?? ''
  const ext = IMAGE_EXT[mime] ?? (FONT_EXT.has(nameExt) ? nameExt : null)
  if (!ext) throw fail(400, 'Chỉ nhận ảnh PNG/JPG/WebP hoặc font WOFF2/WOFF/TTF/OTF.')
  send(res, 200, { id: saveAsset(buffer, ext) })
}

function serveAsset(res, id) {
  const file = assetPath(id)
  if (!existsSync(file)) throw fail(404, 'Không tìm thấy tệp.')
  res.writeHead(200, { 'content-type': MIME_BY_EXT[id.split('.').pop()], 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' })
  res.end(readFileSync(file))
}

function assetDataUrl(id) {
  const file = assetPath(id)
  if (!existsSync(file)) return null
  return `data:${MIME_BY_EXT[id.split('.').pop()]};base64,${readFileSync(file).toString('base64')}`
}

// ---------- Image generation ----------
async function generate(req, res) {
  const provider = process.env.AI_PROVIDER === 'gemini' ? 'gemini' : 'openai'
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) throw fail(503, 'Chưa cấu hình API key. Thêm AI_API_KEY vào .env.local rồi chạy lại.')
  const input = await readJson(req)
  if (typeof input.prompt !== 'string' || input.prompt.length < 10 || input.prompt.length > 12000) throw fail(400, 'Brief ảnh cần từ 10 đến 12.000 ký tự.')
  const width = Number(input.width)
  const height = Number(input.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 600 || height < 600 || width > 2160 || height > 3840 || width % 16 !== 0 || height % 16 !== 0 || width / height > 3 || height / width > 3 || width * height < 655360 || width * height > 8294400) {
    throw fail(400, 'Kích thước ảnh chưa được hỗ trợ.')
  }
  const quality = ['high', 'xhigh'].includes(input.quality) ? input.quality : 'high'
  const references = (Array.isArray(input.referenceIds) ? input.referenceIds : []).slice(0, 4).map((id) => typeof id === 'string' && ASSET_ID.test(id) ? assetDataUrl(id) : null).filter((url) => url?.startsWith('data:image/'))

  const isGemini = provider === 'gemini'
  const geminiModel = process.env.AI_MODEL || 'gemini-3.1-flash-image'
  const ratio = width / height
  const aspectRatio = ratio > 2.2 ? '21:9' : ratio > 1.6 ? '16:9' : ratio < 0.7 ? '9:16' : ratio > 0.9 && ratio < 1.1 ? '1:1' : '4:5'
  const body = isGemini ? {
    model: geminiModel,
    input: [{ type: 'text', text: input.prompt }, ...references.map((url) => {
      const match = url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/)
      return { type: 'image', mime_type: match[1], data: match[2] }
    })],
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspectRatio, image_size: quality === 'xhigh' && geminiModel !== 'gemini-3.1-flash-lite-image' ? '2K' : '1K' },
  } : {
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-6-astra',
    input: [{ role: 'user', content: [{ type: 'input_text', text: input.prompt }, ...references.map((url) => ({ type: 'input_image', image_url: url, detail: 'high' }))] }],
    tools: [{ type: 'image_generation', model: process.env.AI_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst', action: 'generate', size: `${width}x${height}`, quality }],
  }

  let response, result
  try {
    response = await fetch(isGemini ? 'https://generativelanguage.googleapis.com/v1beta/interactions' : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: isGemini ? { 'x-goog-api-key': apiKey, 'content-type': 'application/json' } : { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })
    result = await response.json()
  } catch (error) {
    throw fail(502, error?.name === 'TimeoutError' ? 'Tạo ảnh quá thời gian chờ. Hãy thử lại.' : 'Không thể kết nối image generation API.')
  }
  if (!response.ok) throw fail(response.status === 429 ? 429 : 502, result?.error?.message || result?.error?.status || `Image API trả về HTTP ${response.status}.`)

  if (isGemini) {
    const blocks = result.steps?.flatMap((step) => step.content ?? []) ?? []
    const image = blocks.find((block) => block.type === 'image' && typeof block.data === 'string') ?? result.output_image
    if (!image?.data) throw fail(502, 'Gemini phản hồi nhưng không có ảnh. Kiểm tra model, quyền API và hạn mức của key.')
    const mime = image.mime_type || image.mimeType || 'image/jpeg'
    return send(res, 200, { assetId: saveAsset(Buffer.from(image.data, 'base64'), IMAGE_EXT[mime] ?? 'jpg') })
  }
  const call = result.output?.find((item) => item.type === 'image_generation_call')
  if (!call?.result) throw fail(502, 'API chưa trả về ảnh. Hãy thử tạo lại.')
  return send(res, 200, { assetId: saveAsset(Buffer.from(call.result, 'base64'), 'png') })
}

// ---------- Routing ----------
async function route(req, res) {
  const { pathname } = new URL(req.url, 'http://127.0.0.1')
  const method = req.method

  if (method !== 'GET' && !originAllowed(req)) throw fail(403, 'Nguồn truy cập không được phép.')

  if (method === 'GET' && pathname === '/api/session') {
    const authed = isAuthed(req)
    return send(res, 200, { configured: Boolean(readAuth()), authed, ...(authed ? { ai: aiStatus() } : {}) })
  }
  if (method === 'POST' && pathname === '/api/auth/setup') {
    if (readAuth()) throw fail(409, 'Mật khẩu đã được thiết lập.')
    const { password } = await readJson(req, 4096)
    validNewPassword(password)
    setPassword(password)
    return startSession(res, { ok: true })
  }
  if (method === 'POST' && pathname === '/api/auth/login') {
    if (Date.now() < lockedUntil) throw fail(429, 'Nhập sai quá nhiều lần. Thử lại sau ít phút.')
    const { password } = await readJson(req, 4096)
    if (!checkPassword(password)) {
      failedLogins += 1
      if (failedLogins >= 5) { lockedUntil = Date.now() + 60_000; failedLogins = 0 }
      await new Promise((resolve) => setTimeout(resolve, 600))
      throw fail(401, 'Sai mật khẩu.')
    }
    failedLogins = 0
    return startSession(res, { ok: true })
  }
  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = cookieToken(req)
    if (token) sessions.delete(token)
    return send(res, 200, { ok: true }, { 'set-cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` })
  }

  if (!isAuthed(req)) throw fail(401, 'Cần đăng nhập.')

  if (method === 'POST' && pathname === '/api/auth/password') {
    const { current, next } = await readJson(req, 4096)
    if (!checkPassword(current)) throw fail(401, 'Mật khẩu hiện tại không đúng.')
    validNewPassword(next)
    setPassword(next)
    return send(res, 200, { ok: true })
  }
  if (method === 'GET' && pathname === '/api/store') {
    const contents = existsSync(STORE_FILE) ? readFileSync(STORE_FILE, 'utf8') : '{"workspaces":[]}'
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    return void res.end(contents)
  }
  if (method === 'PUT' && pathname === '/api/store') {
    const store = await readJson(req, MAX_STORE_BYTES)
    if (!Array.isArray(store.workspaces)) throw fail(400, 'Dữ liệu workspace không hợp lệ.')
    writeAtomic(STORE_FILE, JSON.stringify(store))
    return send(res, 200, { ok: true })
  }
  if (method === 'POST' && pathname === '/api/assets') return uploadAsset(req, res)
  if (pathname.startsWith('/api/assets/')) {
    const id = decodeURIComponent(pathname.slice('/api/assets/'.length))
    if (method === 'GET') return serveAsset(res, id)
    if (method === 'DELETE') {
      try { unlinkSync(assetPath(id)) } catch { /* Already gone. */ }
      return send(res, 200, { ok: true })
    }
  }
  if (method === 'POST' && pathname === '/api/generate') return generate(req, res)
  throw fail(404, 'Không tìm thấy API này.')
}

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    if (res.headersSent) return res.end()
    send(res, error.status || 500, { message: error.status ? error.message : 'Lỗi máy chủ.' })
    if (!error.status) console.error(error)
  })
})

server.listen(PORT, '127.0.0.1', () => console.log(`Creative API listening on http://127.0.0.1:${PORT} · data: ${DATA_DIR}`))
