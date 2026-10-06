import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'

function loadLocalEnv() {
  try {
    const contents = readFileSync(new URL('.env.local', import.meta.url), 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  } catch { /* Local key file is optional. */ }
}

loadLocalEnv()

const PORT = Number(process.env.API_PORT || 3001)
const MAX_BODY_BYTES = 24 * 1024 * 1024

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        tooLarge = true
        return
      }
      if (!tooLarge) chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('Ảnh tải lên vượt giới hạn 24 MB. Ứng dụng đã tự giảm dung lượng ảnh; hãy thử giảm số ảnh tham chiếu.'), { status: 413 }))
        return
      }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(Object.assign(new Error('Dữ liệu gửi lên không hợp lệ.'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

async function generate(req, res) {
  const provider = process.env.AI_PROVIDER === 'gemini' ? 'gemini' : 'openai'
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return send(res, 503, { error: 'AI_NOT_CONFIGURED', message: 'Mở Cài đặt → API, chọn nhà cung cấp, rồi nhập API key.' })
  }
  let input
  try { input = await readJson(req) }
  catch (error) { return send(res, error.status || 400, { error: 'INVALID_REQUEST', message: error.message }) }
  if (typeof input.prompt !== 'string' || input.prompt.length < 10 || input.prompt.length > 12000) {
    return send(res, 400, { error: 'INVALID_PROMPT', message: 'Brief ảnh cần từ 10 đến 12.000 ký tự.' })
  }
  const width = Number(input.width)
  const height = Number(input.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 600 || height < 600 || width > 2160 || height > 3840 || width % 16 !== 0 || height % 16 !== 0 || width / height > 3 || height / width > 3 || width * height < 655360 || width * height > 8294400) {
    return send(res, 400, { error: 'INVALID_SIZE', message: 'Kích thước ảnh chưa được hỗ trợ.' })
  }
  const quality = ['high', 'xhigh'].includes(input.quality) ? input.quality : 'high'
  const references = Array.isArray(input.references) ? input.references.slice(0, 4) : []
    // Multi-Agent Anti-AI-Slop Quality Enhancer
    // Multi-Agent Anti-AI-Slop Quality & Brand Guardrails Enhancer
  const antiSlopBooster = `

[MULTI-AGENT ART DIRECTOR & ANTI-AI-SLOP DIRECTIVES]
- PHOTOGRAPHIC AUTHENTICITY: Shot on Hasselblad H6D-100c or Leica M11, authentic 35mm film grain (Kodak Portra 400), physical surface textures (matte ceramics, raw linen, natural paper).
- ATMOSPHERIC LIGHTING: Directional natural morning daylight or soft diffused window ambient with organic shadow falloff. NO harsh studio flash, NO artificial neon glow halos.
- PROHIBITED AI ARTIFACTS: ABSOLUTELY NO waxy/plastic skin, NO 3D render CGI cartoon aesthetic, NO oversaturated fantasy neon, NO glowing outlines, NO uncanny valley, NO deformed hands.
- ZERO TEXT RULE: ABSOLUTELY NO rendered letters, NO words, NO numbers, NO fake gibberish labels, NO logos or watermarks. Must be a completely clean background plate for high-precision typographic overlay.
- NEGATIVE SPACE INTEGRITY: Keep designated layout areas (top/left) uncluttered and clean for high WCAG AAA contrast readability.`;
  
  const finalPrompt = input.prompt.includes('STRICT VISUAL QUALITY') ? input.prompt : (input.prompt + antiSlopBooster);
  const content = [{ type: 'input_text', text: finalPrompt }]
  for (const reference of references) {
    if (typeof reference?.image !== 'string' || !reference.image.startsWith('data:image/')) continue
    content.push({ type: 'input_image', image_url: reference.image, detail: 'high' })
  }
  try {
    const isGemini = provider === 'gemini'
    const geminiModel = process.env.AI_MODEL || 'gemini-3.1-flash-image'
    const geminiParts = [{ type: 'text', text: finalPrompt }]
    for (const reference of references) {
      if (typeof reference?.image !== 'string') continue
      const match = reference.image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/)
      if (match) geminiParts.push({ type: 'image', mime_type: match[1], data: match[2] })
    }
    const aspectRatio = width / height > 1.6 ? '16:9' : width / height < 0.7 ? '9:16' : width / height > 0.9 && width / height < 1.1 ? '1:1' : '4:5'
    const response = await fetch(isGemini ? 'https://generativelanguage.googleapis.com/v1beta/interactions' : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: isGemini ? { 'x-goog-api-key': apiKey, 'content-type': 'application/json' } : { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(isGemini ? {
        model: geminiModel,
        input: geminiParts,
        response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspectRatio, image_size: quality === 'xhigh' && geminiModel !== 'gemini-3.1-flash-lite-image' ? '2K' : '1K' },
      } : {
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-6-astra',
        input: [{ role: 'user', content }],
        tools: [{ type: 'image_generation', model: process.env.AI_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst', action: 'generate', size: `${width}x${height}`, quality }],
      }),
      signal: AbortSignal.timeout(180000),
    })
    const result = await response.json()
    if (!response.ok) {
      const message = result?.error?.message || result?.error?.status || `Image API trả về HTTP ${response.status}.`
      return send(res, response.status === 429 ? 429 : 502, { error: 'IMAGE_PROVIDER_ERROR', message })
    }
    if (isGemini) {
      const blocks = result.steps?.flatMap((step) => step.content ?? []) ?? []
      const imageData = blocks.find((block) => block.type === 'image' && typeof block.data === 'string') ?? result.output_image
      if (!imageData?.data) {
        const outputText = blocks.filter((block) => block.type === 'text').map((block) => block.text).filter(Boolean).join(' ').slice(0, 500)
        const status = result.status ? ` (status: ${result.status})` : ''
        return send(res, 502, { error: 'IMAGE_MISSING', message: `Gemini đã phản hồi nhưng không có block ảnh${status}.${outputText ? ` Model trả lời: ${outputText}` : ' Kiểm tra model, quyền API và hạn mức của project gắn với key.'}` })
      }
      return send(res, 200, { image: `data:${imageData.mime_type || imageData.mimeType || 'image/jpeg'};base64,${imageData.data}` })
    }
    const imageCall = result.output?.find((item) => item.type === 'image_generation_call')
    if (!imageCall?.result) return send(res, 502, { error: 'IMAGE_MISSING', message: 'API chưa trả về ảnh. Hãy thử tạo lại.' })
    return send(res, 200, { image: `data:image/png;base64,${imageCall.result}`, responseId: result.id })
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'Tạo ảnh quá thời gian chờ. Hãy thử lại.' : 'Không thể kết nối image generation API.'
    return send(res, 502, { error: 'IMAGE_PROVIDER_UNAVAILABLE', message })
  }
}

async function saveApiKey(req, res) {
  const origin = req.headers.origin
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
    return send(res, 403, { error: 'ORIGIN_NOT_ALLOWED', message: 'Chỉ cho phép lưu key từ Creative Studio local.' })
  }
  let input
  try { input = await readJson(req) }
  catch (error) { return send(res, error.status || 400, { error: 'INVALID_REQUEST', message: error.message }) }
  const apiKey = input.apiKey
  const provider = input.provider
  const model = input.model
  if (!['openai', 'gemini'].includes(provider)) return send(res, 400, { error: 'INVALID_PROVIDER', message: 'Chọn OpenAI hoặc Gemini.' })
  if (typeof apiKey !== 'string' || !/^[^\s\r\n]{8,1000}$/.test(apiKey)) {
    return send(res, 400, { error: 'INVALID_API_KEY', message: 'Nhập API key hợp lệ, không chứa khoảng trắng.' })
  }
  if (provider === 'gemini' && !['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'].includes(model)) return send(res, 400, { error: 'INVALID_MODEL', message: 'Chọn một model tạo ảnh Gemini được hỗ trợ.' })
  if (provider === 'openai' && (typeof model !== 'string' || !/^[\w.-]{1,120}$/.test(model))) return send(res, 400, { error: 'INVALID_MODEL', message: 'Mã model OpenAI không hợp lệ.' })
  try {
    const envUrl = new URL('.env.local', import.meta.url)
    let contents = ''
    try { contents = readFileSync(envUrl, 'utf8') } catch { /* Create a local-only key file on first setup. */ }
    const values = { AI_PROVIDER: provider, AI_API_KEY: apiKey, AI_MODEL: model }
    for (const [key, value] of Object.entries(values)) {
      const keyLine = `${key}=${value}`
      contents = new RegExp(`^\\s*${key}\\s*=.*$`, 'm').test(contents)
        ? contents.replace(new RegExp(`^\\s*${key}\\s*=.*$`, 'm'), keyLine)
        : `${contents.trimEnd()}${contents.trim() ? '\n' : ''}${keyLine}\n`
      process.env[key] = value
    }
    writeFileSync(envUrl, contents, { encoding: 'utf8', mode: 0o600 })
    return send(res, 200, { ready: true })
  } catch {
    return send(res, 500, { error: 'KEY_SAVE_FAILED', message: 'Không thể lưu key local. Kiểm tra quyền ghi trong thư mục ứng dụng.' })
  }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/status') {
    return send(res, 200, { ready: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY), provider: process.env.AI_PROVIDER || 'openai', model: process.env.AI_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst' })
  }
  if (req.method === 'POST' && req.url === '/api/settings/provider') return void saveApiKey(req, res)
  if (req.method === 'POST' && req.url === '/api/generate') return void generate(req, res)
  return send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy API này.' })
})

server.listen(PORT, '127.0.0.1', () => console.log(`Creative API listening on http://127.0.0.1:${PORT}`))
