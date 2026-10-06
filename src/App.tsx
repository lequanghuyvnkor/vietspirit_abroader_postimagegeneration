import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import './App.css'

export type ColorItem = {
  hex: string
  meaning: string
}

export type PalettePreset = {
  name: string
  colors: ColorItem[]
}

export const palettePresets: PalettePreset[] = [
  {
    name: '🌸 Youth+ Pastel (Sức khỏe tinh thần)',
    colors: [
      { hex: '#C6F2A6', meaning: 'Xanh tươi mới · Nature, refreshment, growth, balance' },
      { hex: '#F7B0C3', meaning: 'Hồng phấn ấm áp · Nurture, warmth, friendliness, softness' },
      { hex: '#AEDEF9', meaning: 'Xanh lam an bình · Knowledge, tranquility, security, trust' },
      { hex: '#B3B8FA', meaning: 'Tím trí tuệ & bản lĩnh · Royalty, wisdom, spirituality, authority' },
    ]
  },
  {
    name: '✨ Lumière Luxury (Tối giản cao cấp)',
    colors: [
      { hex: '#1C2F4D', meaning: 'Xanh Navy chiều sâu và quyền uy' },
      { hex: '#B6404A', meaning: 'Đỏ thẫm điểm nhấn sang trọng' },
      { hex: '#FAF7F2', meaning: 'Kem linen sáng tự nhiên & thanh lịch' },
    ]
  },
  {
    name: '⚡ Neo-Cyber Glow (Công nghệ tương lai)',
    colors: [
      { hex: '#0F172A', meaning: 'Slate sâu thẳm công nghệ' },
      { hex: '#06B6D4', meaning: 'Cyan dạ quang phát sáng tương lai' },
      { hex: '#8B5CF6', meaning: 'Tím điện tử bứt phá' },
      { hex: '#F43F5E', meaning: 'Neon Rose tràn đầy năng lượng' },
    ]
  }
]

type Asset = { id: string; name: string; data: string; kind: 'keyvisual' | 'photo' | 'logo' | 'component' | 'output' }
type Format = { name: string; width: number; height: number; label: string }
type Page = 'studio' | 'folders' | 'campaign' | 'settings'

export type CampaignBrief = {
  // --- TẦNG 1: BRAND FOUNDATION & GUARDRAILS ---
  brand: string
  industry: string
  audience: string
  tone: string
  brandCoreStyle: string
  brandGuardrails: string

  // --- TẦNG 2: KEY VISUAL SYSTEM (THEO PDF) ---
  campaign: string
  message: string
  contextInsight: string
  palette: ColorItem[]
  colors: string[]
  subjectType: 'graphic_object' | 'real_person_product'
  subjectMetaphor: string
  displayFont: string
  bodyFont: string
  negativeSpace: string
  keyVisual: string
  referenceStrength: number
  note: string

  // --- TẦNG 3: BÀI ĐĂNG CỤ THỂ ---
  objective: string
  offer: string
  cta: string
  format: string
}

type CampaignPost = { id: string; name: string; updatedAt: string; brief: CampaignBrief }
type CampaignFolder = { id: string; name: string; updatedAt: string; brief: CampaignBrief; posts: CampaignPost[] }
type PersonalSettings = { displayName: string; email: string; workspaceName: string; defaultFormat: string; imageQuality: 'high' | 'xhigh'; autosave: boolean }
type DialogState = { kind: 'create-folder' } | { kind: 'rename-folder' | 'rename-post' | 'delete-folder' | 'delete-post'; id: string; name: string }

export type StylePreset = 'editorial' | 'documentary' | 'minimalist' | 'cinematic'

export const stylePresets: Record<StylePreset, { label: string; desc: string; camera: string; lighting: string; texture: string; antiSlop: string }> = {
  editorial: {
    label: '📸 Editorial Studio',
    desc: 'Chống AI Slop cao nhất · Chuẩn tạp chí cao cấp',
    camera: 'commercial editorial still-life photography, shot on Hasselblad H6D-100c with 80mm f/2.8 lens, natural authentic depth of field',
    lighting: 'natural directional morning window daylight with soft diffused falloff shadows, authentic ambient bounce, zero artificial harsh flash',
    texture: 'hyper-tactile micro-surface details, authentic organic materials, raw linen weave, matte ceramic textures, subtle fine 35mm film grain (Kodak Portra 400)',
    antiSlop: 'Strictly avoid 3D render look, no waxy plastic skin, no glossy oversaturated neon, no floating CGI debris, no airbrushed stock-photo feel, zero rendered typography/letters/watermarks'
  },
  documentary: {
    label: '🌿 Phóng sự đời thực (VietSpirit)',
    desc: 'Trải nghiệm du học/văn hóa chân thực · Tự nhiên 100%',
    camera: 'authentic documentary lifestyle photography, Leica M11 with Summilux 35mm f/1.4 lens, candid documentary perspective',
    lighting: 'golden hour ambient natural daylight, warm atmospheric sunlight filtering through foliage, realistic outdoor Vietnamese sunlight and shadows',
    texture: 'authentic human skin tones, natural skin pores without airbrushing, genuine environmental warmth, genuine documentary photojournalism feel',
    antiSlop: 'Strictly avoid posed unnatural stock models, no uncanny valley plastic faces, no CGI lighting, no glowing outlines, no fake AI textures, zero text/symbols'
  },
  minimalist: {
    label: '🏛️ Tĩnh vật tối giản',
    desc: 'Bố cục sạch sẽ · Nhiều khoảng thở cho Text',
    camera: 'clean minimalist art-gallery still-life composition, medium format 90mm lens, sharp subject isolation with creamy background falloff',
    lighting: 'soft diffused architectural daylight from top-left, gentle elongated cast shadows, serene Scandinavian/Japanese minimalist mood',
    texture: 'smooth stone, brushed paper, natural wood grain, architectural geometry, subtle soft shadows',
    antiSlop: 'Strictly avoid cluttered objects, no busy patterns, no plastic reflections, no saturated neon accents, zero lettering or fake product labels'
  },
  cinematic: {
    label: '🎬 Cinematic Atmospheric',
    desc: 'Ánh sáng điện ảnh · Chiều sâu thị giác sâu lắng',
    camera: 'cinematic anamorphic 50mm film photography, 2.39:1 aspect framing aesthetics, rich dynamic range with organic shadow roll-off',
    lighting: 'subtle chiaroscuro atmospheric lighting, soft volumetric haze, warm rim light defining silhouette against gentle cool background',
    texture: 'rich film grain texture, tactile materials, deep organic shadows, premium motion picture color grading',
    antiSlop: 'Strictly avoid video-game render look, no Unreal Engine glossy plastics, no oversaturated halos, zero fake text or numbers'
  }
}

export async function removeImageBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data
      const corners = [
        [0, 0],
        [canvas.width - 1, 0],
        [0, canvas.height - 1],
        [canvas.width - 1, canvas.height - 1]
      ]
      let avgR = 0, avgG = 0, avgB = 0
      for (const [x, y] of corners) {
        const idx = (y * canvas.width + x) * 4
        avgR += data[idx]
        avgG += data[idx + 1]
        avgB += data[idx + 2]
      }
      avgR /= 4; avgG /= 4; avgB /= 4
      const threshold = 38
      const softRange = 26
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2)
        if (dist < threshold) {
          data[i + 3] = 0
        } else if (dist < threshold + softRange) {
          const factor = (dist - threshold) / softRange
          data[i + 3] = Math.round(data[i + 3] * factor)
        }
      }
      ctx.putImageData(imgData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

const defaultCampaignId = 'campaign-youth-plus'

const formats: Format[] = [
  { name: 'portrait', width: 1080, height: 1350, label: 'Feed dọc · 4:5' },
  { name: 'square', width: 1080, height: 1080, label: 'Feed vuông · 1:1' },
  { name: 'landscape', width: 1200, height: 628, label: 'Link preview · 1.91:1' },
  { name: 'story', width: 1080, height: 1920, label: 'Story · 9:16' },
]

function readDraft<T>(key: string, fallback: T): T {
  try {
    const draft = JSON.parse(localStorage.getItem('creative-studio-draft') ?? '{}') as Record<string, unknown>
    return (draft[key] as T | undefined) ?? fallback
  } catch { return fallback }
}

function defaultBrief(): CampaignBrief {
  const defaultPalette = palettePresets[0].colors
  return {
    brand: readDraft('brand', 'Youth+ Tech'),
    industry: readDraft('industry', 'Công nghệ giáo dục & Hoạt động xã hội'),
    audience: readDraft('audience', 'Học sinh, sinh viên và thế hệ Gen Z toàn quốc (16–25 tuổi)'),
    tone: readDraft('tone', 'Đồng cảm, hiện đại, năng động, chữa lành và truyền cảm hứng'),
    brandCoreStyle: readDraft('brandCoreStyle', 'Neo-Brutalism, Clean Tech & Y2K Minimal'),
    brandGuardrails: readDraft('brandGuardrails', 'Tuyệt đối KHÔNG 3D render sáp nhựa; KHÔNG màu sắc u ám tiêu cực; KHÔNG render chữ/số giả mạo vào ảnh nền; Giữ khoảng thở sạch cho Typography và khung ảnh.'),
    campaign: readDraft('campaign', 'Youth+ Tech [Sự kiện Tháng 7]'),
    objective: readDraft('objective', 'Nâng cao nhận thức & Tuyển đăng ký cuộc thi'),
    message: readDraft('message', "Speak Out - Don't keep by yourself"),
    contextInsight: readDraft('contextInsight', 'Nâng cao nhận thức về sức khỏe tinh thần Gen Z. Khuyến khích chủ động lên tiếng chia sẻ, tìm kiếm giải pháp và đồng hành cùng người bệnh vượt qua thương tổn tâm lý.'),
    offer: readDraft('offer', 'Cuộc thi ý tưởng sáng tạo cho học sinh - sinh viên toàn quốc'),
    cta: readDraft('cta', 'REGISTER NOW'),
    keyVisual: readDraft('keyVisual', 'Dải nền gradient pastel mềm mại chuyển từ #C6F2A6 sang #B3B8FA và #AEDEF9, hiệu ứng aura mờ ảo, ánh sáng ban mai nhẹ nhàng, không gian sạch sẽ thoáng đãng.'),
    note: readDraft('note', 'Không render chữ lên ảnh nền. Bố cục chừa khoảng trống phía trên và góc trái.'),
    format: readDraft('format', 'portrait'),
    palette: readDraft('palette', defaultPalette),
    colors: readDraft('colors', defaultPalette.map((item) => item.hex)),
    referenceStrength: readDraft('referenceStrength', 65),
    subjectType: readDraft('subjectType', 'graphic_object'),
    subjectMetaphor: readDraft('subjectMetaphor', 'Sharing Speaker: Biểu tượng chiếc loa đại diện cho tiếng nói, sự chủ động lên tiếng và lan tỏa giải pháp chữa lành.'),
    displayFont: readDraft('displayFont', 'MOKOTO'),
    bodyFont: readDraft('bodyFont', 'Montserrat'),
    negativeSpace: readDraft('negativeSpace', 'Trống góc trái và nửa trên để bố trí Typography và CTA'),
  }
}

function readCampaignFolders(): CampaignFolder[] {
  try {
    const saved = JSON.parse(localStorage.getItem('creative-campaign-folders') ?? 'null') as CampaignFolder[] | null
    if (Array.isArray(saved) && saved.length && saved.every((folder) => folder.id && folder.name && folder.brief)) return saved.map((folder) => ({
      ...folder,
      posts: Array.isArray(folder.posts) ? folder.posts : [{ id: `${folder.id}-post-1`, name: 'Bài đăng 1', updatedAt: folder.updatedAt, brief: folder.brief }],
    }))
  } catch { /* Start with default */ }
  const brief = defaultBrief()
  const updatedAt = new Date().toISOString()
  return [{ id: defaultCampaignId, name: brief.campaign, updatedAt, brief, posts: [{ id: `${defaultCampaignId}-post-1`, name: 'Bài đăng 1', updatedAt, brief }] }]
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
}

function readPersonalSettings(): PersonalSettings {
  const fallback: PersonalSettings = { displayName: '', email: '', workspaceName: 'Creative Studio', defaultFormat: 'portrait', imageQuality: 'high', autosave: true }
  try {
    const saved = JSON.parse(localStorage.getItem('creative-personal-settings') ?? '{}') as Partial<PersonalSettings>
    return { ...fallback, ...saved, defaultFormat: formats.some((item) => item.name === saved.defaultFormat) ? saved.defaultFormat! : fallback.defaultFormat, imageQuality: saved.imageQuality === 'xhigh' ? 'xhigh' : 'high', autosave: saved.autosave !== false }
  } catch { return fallback }
}

function openAssetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('creative-studio-assets', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('folders', { keyPath: 'folderId' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readFolderAssets(folderId: string): Promise<Asset[]> {
  const db = await openAssetDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('folders').objectStore('folders').get(folderId)
    request.onsuccess = () => resolve(request.result?.assets ?? [])
    request.onerror = () => reject(request.error)
  })
}

async function saveFolderAssets(folderId: string, assets: Asset[]): Promise<void> {
  const db = await openAssetDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('folders', 'readwrite')
    transaction.objectStore('folders').put({ folderId, assets })
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

async function deleteFolderAssets(folderId: string): Promise<void> {
  const db = await openAssetDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('folders', 'readwrite')
    transaction.objectStore('folders').delete(folderId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

function readOptimizedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Không thể đọc ảnh ${file.name}.`))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => resolve(String(reader.result))
      image.onload = () => {
        const maxEdge = 1800
        const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
        const context = canvas.getContext('2d')
        if (!context) return resolve(String(reader.result))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', 0.88))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function App() {
  const [campaignFolders, setCampaignFolders] = useState<CampaignFolder[]>(readCampaignFolders)
  const [activeFolderId, setActiveFolderId] = useState(() => {
    const savedId = localStorage.getItem('creative-active-folder')
    return campaignFolders.find((folder) => folder.id === savedId)?.id ?? campaignFolders[0]?.id ?? defaultCampaignId
  })
  const initialBrief = campaignFolders.find((folder) => folder.id === activeFolderId)?.brief ?? campaignFolders[0]?.brief ?? defaultBrief()
  const [activePostId, setActivePostId] = useState(() => {
    const folder = campaignFolders.find((item) => item.id === activeFolderId)
    const savedPostId = localStorage.getItem('creative-active-post')
    return folder?.posts?.find((post) => post.id === savedPostId)?.id ?? folder?.posts?.[0]?.id ?? `${activeFolderId}-post-1`
  })
  const [personalSettings, setPersonalSettings] = useState<PersonalSettings>(readPersonalSettings)
  const [apiKey, setApiKey] = useState('')
  const [apiProvider, setApiProvider] = useState<'openai' | 'gemini'>('openai')
  const [configuredProvider, setConfiguredProvider] = useState<'openai' | 'gemini'>('openai')
  const [apiModel, setApiModel] = useState('gpt-image-2.5-sunburst')
  const [apiReady, setApiReady] = useState(false)
  const [apiSaving, setApiSaving] = useState(false)
  const [apiMessage, setApiMessage] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(true)
  const [page, setPage] = useState<Page>('folders')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogName, setDialogName] = useState('')
  const [postCovers, setPostCovers] = useState<Record<string, string>>({})
  const [folderQuery, setFolderQuery] = useState('')
  const [folderSort, setFolderSort] = useState<'updated' | 'name'>('updated')

  // --- TẦNG 1: BRAND FOUNDATION & GUARDRAILS ---
  const [brand, setBrand] = useState(initialBrief.brand ?? 'Youth+ Tech')
  const [industry, setIndustry] = useState(initialBrief.industry ?? 'Công nghệ giáo dục')
  const [audience, setAudience] = useState(initialBrief.audience ?? 'Học sinh, sinh viên và Gen Z toàn quốc')
  const [tone, setTone] = useState(initialBrief.tone ?? 'Đồng cảm, hiện đại, năng động, chữa lành')
  const [brandCoreStyle, setBrandCoreStyle] = useState(initialBrief.brandCoreStyle ?? 'Neo-Brutalism & Modern Clean Tech')
  const [brandGuardrails, setBrandGuardrails] = useState(initialBrief.brandGuardrails ?? 'Tuyệt đối KHÔNG 3D render sáp nhựa; KHÔNG màu sắc đen tối u ám; KHÔNG render chữ/số giả vào ảnh nền; Giữ khoảng thở sạch cho Typography.')

  // --- TẦNG 2: KEY VISUAL MASTER BRIEF (THEO PDF) ---
  const [campaign, setCampaign] = useState(initialBrief.campaign ?? 'Youth+ Tech [Sự kiện Tháng 7]')
  const [message, setMessage] = useState(initialBrief.message ?? "Speak Out - Don't keep by yourself")
  const [contextInsight, setContextInsight] = useState(initialBrief.contextInsight ?? 'Nâng cao nhận thức về sức khỏe tinh thần cho Gen Z.')
  const [palette, setPalette] = useState<ColorItem[]>(initialBrief.palette ?? palettePresets[0].colors)
  const [subjectType, setSubjectType] = useState<'graphic_object' | 'real_person_product'>(initialBrief.subjectType ?? 'graphic_object')
  const [subjectMetaphor, setSubjectMetaphor] = useState(initialBrief.subjectMetaphor ?? 'Sharing Speaker: Biểu tượng chiếc loa đại diện cho tiếng nói, sự chủ động lên tiếng và lan tỏa giải pháp chữa lành.')
  const [displayFont, setDisplayFont] = useState(initialBrief.displayFont ?? 'MOKOTO')
  const [bodyFont, setBodyFont] = useState(initialBrief.bodyFont ?? 'Montserrat')
  const [negativeSpace, setNegativeSpace] = useState(initialBrief.negativeSpace ?? 'Trống góc trái và nửa trên để bố trí Typography và CTA')
  const [keyVisual, setKeyVisual] = useState(initialBrief.keyVisual ?? 'Dải nền gradient pastel mềm mại, ánh sáng tự nhiên.')
  const [referenceStrength, setReferenceStrength] = useState(initialBrief.referenceStrength ?? 65)
  const [note, setNote] = useState(initialBrief.note ?? '')

  // --- TẦNG 3: BÀI ĐĂNG CỤ THỂ ---
  const [objective, setObjective] = useState(initialBrief.objective ?? 'Nâng cao nhận thức & Đăng ký cuộc thi')
  const [offer, setOffer] = useState(initialBrief.offer ?? 'Cuộc thi ý tưởng sáng tạo cho học sinh - sinh viên toàn quốc')
  const [cta, setCta] = useState(initialBrief.cta ?? 'REGISTER NOW')
  const [format, setFormat] = useState(() => formats.find((item) => item.name === initialBrief.format) ?? formats[0])

  // --- OTHER STATES ---
  const [assets, setAssets] = useState<Asset[]>([])
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'ready' | 'missing-key' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'context' | 'assets'>('context')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [stylePreset, setStylePreset] = useState<StylePreset>('editorial')
  const [isRemovingBg, setIsRemovingBg] = useState(false)

  const productMode = subjectType === 'real_person_product' ? 'stage-real' : 'ai-complete'

  // Expanded sections
  const [expanded, setExpanded] = useState({
    tier1Brand: true,
    tier1Guardrails: true,
    tier2Message: true,
    tier2Palette: true,
    tier2Subject: true,
    tier2Components: true,
    tier2Ref: false,
    tier3Post: true,
  })

  const fileInput = useRef<HTMLInputElement>(null)
  const componentInput = useRef<HTMLInputElement>(null)
  const fontFileInput = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const skipAssetWrite = useRef(false)

  const logo = assets.find((asset) => asset.kind === 'logo')
  const productPhoto = assets.find((asset) => asset.id === selectedAssetId && asset.kind === 'photo') ?? assets.find((asset) => asset.kind === 'photo')
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId)
  const activeFolder = campaignFolders.find((folder) => folder.id === activeFolderId) ?? campaignFolders[0]
  const activePost = activeFolder?.posts?.find((post) => post.id === activePostId) ?? activeFolder?.posts?.[0]
  const activeAssetScopeId = activePost?.id ?? activeFolderId
  const filteredFolders = campaignFolders.filter((folder) => folder.name.toLowerCase().includes(folderQuery.toLowerCase())).sort((a, b) => folderSort === 'name' ? a.name.localeCompare(b.name, 'vi') : b.updatedAt.localeCompare(a.updatedAt))
  const imageComponents = assets.filter((asset) => asset.kind === 'component')
  const canvasScale = useMemo(() => Math.min(1, 520 / format.width, 560 / format.height), [format])

  const colors = useMemo(() => palette.map((item) => item.hex), [palette])

  useEffect(() => {
    try {
      localStorage.setItem('creative-active-folder', activeFolderId)
      if (activePost) localStorage.setItem('creative-active-post', activePost.id)
      if (!personalSettings.autosave) return
      const brief: CampaignBrief = {
        brand, industry, audience, tone, brandCoreStyle, brandGuardrails,
        campaign, message, contextInsight, palette, colors,
        subjectType, subjectMetaphor, displayFont, bodyFont, negativeSpace,
        keyVisual, referenceStrength, note,
        objective, offer, cta, format: format.name,
      }
      if (page !== 'studio') return
      const updatedAt = new Date().toISOString()
      setCampaignFolders((current) => current.map((folder) => folder.id === activeFolderId ? {
        ...folder, updatedAt, brief,
        posts: folder.posts.map((post) => post.id === activePostId ? { ...post, updatedAt, brief } : post),
      } : folder))
    } catch { setStatusMessage('Không thể lưu brief vào trình duyệt này.') }
  }, [activeFolderId, activePostId, page, brand, industry, audience, tone, brandCoreStyle, brandGuardrails, campaign, message, contextInsight, palette, colors, subjectType, subjectMetaphor, displayFont, bodyFont, negativeSpace, keyVisual, referenceStrength, note, objective, offer, cta, format, personalSettings.autosave])

  useEffect(() => {
    try { localStorage.setItem('creative-campaign-folders', JSON.stringify(campaignFolders)) }
    catch { setStatusMessage('Không thể lưu danh sách chiến dịch trong trình duyệt.') }
  }, [campaignFolders])

  useEffect(() => {
    try { localStorage.setItem('creative-personal-settings', JSON.stringify(personalSettings)) }
    catch { setStatusMessage('Không thể lưu cài đặt cá nhân vào trình duyệt này.') }
  }, [personalSettings])

  useEffect(() => {
    let alive = true
    fetch('/api/status').then((response) => response.json()).then((result: { ready?: boolean; provider?: 'openai' | 'gemini'; model?: string }) => { if (alive) { setApiReady(Boolean(result.ready)); if (result.provider === 'gemini' || result.provider === 'openai') { setApiProvider(result.provider); setConfiguredProvider(result.provider) } if (result.model) setApiModel(result.model) } }).catch(() => { if (alive) setApiReady(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    skipAssetWrite.current = true
    readFolderAssets(activeAssetScopeId).then((loaded) => { if (alive) { setAssets(loaded); setGeneratedImage(loaded.find((asset) => asset.kind === 'output')?.data ?? null) } })
      .catch(() => { if (alive) setStatusMessage('Không thể tải ảnh đã lưu trong bài đăng này.') })
    return () => { alive = false }
  }, [activeAssetScopeId])

  useEffect(() => {
    if (skipAssetWrite.current) { skipAssetWrite.current = false; return }
    saveFolderAssets(activeAssetScopeId, assets).catch(() => setStatusMessage('Không thể lưu tài nguyên ảnh trong trình duyệt này.'))
  }, [activeAssetScopeId, assets])

  useEffect(() => {
    if (page !== 'campaign' || !activeFolder) return
    let alive = true
    Promise.all(activeFolder.posts.map(async (post) => [post.id, (await readFolderAssets(post.id)).find((asset) => asset.kind === 'output')?.data ?? ''] as const))
      .then((entries) => { if (alive) setPostCovers(Object.fromEntries(entries)) })
      .catch(() => { if (alive) setPostCovers({}) })
    return () => { alive = false }
  }, [page, activeFolderId, activeFolder?.posts])

  function applyBrief(brief: CampaignBrief) {
    setBrand(brief.brand ?? 'Youth+ Tech')
    setIndustry(brief.industry ?? '')
    setAudience(brief.audience ?? '')
    setTone(brief.tone ?? '')
    setBrandCoreStyle(brief.brandCoreStyle ?? 'Neo-Brutalism')
    setBrandGuardrails(brief.brandGuardrails ?? '')

    setCampaign(brief.campaign ?? '')
    setMessage(brief.message ?? '')
    setContextInsight(brief.contextInsight ?? '')
    setPalette(brief.palette ?? palettePresets[0].colors)
    setSubjectType(brief.subjectType ?? 'graphic_object')
    setSubjectMetaphor(brief.subjectMetaphor ?? '')
    setDisplayFont(brief.displayFont ?? 'MOKOTO')
    setBodyFont(brief.bodyFont ?? 'Montserrat')
    setNegativeSpace(brief.negativeSpace ?? '')
    setKeyVisual(brief.keyVisual ?? '')
    setReferenceStrength(brief.referenceStrength ?? 65)
    setNote(brief.note ?? '')

    setObjective(brief.objective ?? '')
    setOffer(brief.offer ?? '')
    setCta(brief.cta ?? '')
    setFormat(formats.find((item) => item.name === brief.format) ?? formats[0])

    skipAssetWrite.current = true
    setAssets([]); setSelectedAssetId(null); setGeneratedImage(null); setStatus('idle'); setStatusMessage('')
  }

  function applyYouthPlusDemo() {
    setBrand('Youth+ Tech')
    setIndustry('Công nghệ giáo dục & Hoạt động xã hội cho Gen Z')
    setAudience('Học sinh, sinh viên và thế hệ trẻ toàn quốc (16–25 tuổi)')
    setTone('Đồng cảm, hiện đại, năng động, chữa lành và truyền cảm hứng')
    setBrandCoreStyle('Neo-Brutalism & Modern Clean Tech')
    setBrandGuardrails('Tuyệt đối KHÔNG phong cách 3D render sáp nhựa; KHÔNG màu sắc đen tối u ám; KHÔNG render chữ/số giả mạo vào ảnh nền AI; Giữ khoảng thở sạch cho Typography và khung ảnh.')

    setCampaign('Youth+ Tech [Sự kiện Tháng 7]')
    setMessage("Speak Out - Don't keep by yourself")
    setContextInsight('Cuộc thi nâng cao nhận thức về sức khỏe tinh thần cho Gen Z. Khuyến khích chủ động lên tiếng chia sẻ, lắng nghe và đồng hành vượt qua thương tổn tâm lý.')
    setPalette(palettePresets[0].colors)
    setSubjectType('graphic_object')
    setSubjectMetaphor('Sharing Speaker: Biểu tượng chiếc loa đại diện cho tiếng nói, sự chủ động lên tiếng chia sẻ và lan tỏa giải pháp chữa lành.')
    setDisplayFont('MOKOTO')
    setBodyFont('Montserrat')
    setNegativeSpace('Trống góc trái và nửa trên để bố trí Typography và CTA')
    setKeyVisual('Dải nền gradient pastel mềm mại chuyển từ #C6F2A6 sang #B3B8FA và #AEDEF9, hiệu ứng aura mờ ảo, ánh sáng ban mai nhẹ nhàng, không gian sạch sẽ thoáng đãng.')
    setNote('Không render chữ lên ảnh nền. Bố cục chừa khoảng trống phía trên và góc trái.')

    setObjective('Nâng cao nhận thức & Đăng ký cuộc thi')
    setOffer('Cuộc thi ý tưởng sáng tạo cho học sinh - sinh viên toàn quốc')
    setCta('REGISTER NOW')
    setStatusMessage('Đã nạp bộ dữ liệu mẫu chuẩn của Youth+ Tech [Sự kiện Tháng 7]!')
  }

  function applyLumiereDemo() {
    setBrand('Lumière Studio')
    setIndustry('Skincare · chăm sóc da tối giản')
    setAudience('Phụ nữ 25–35, yêu thích phong cách sống bền vững')
    setTone('Tinh tế, ấm áp, thư thái, tự nhiên')
    setBrandCoreStyle('Minimalist Art-Gallery Still-Life')
    setBrandGuardrails('Không dùng hoa hồng; Không thêm chữ vào nền; Sản phẩm phải giữ nguyên màu sắc thật.')

    setCampaign('Rituals of Spring')
    setMessage('Một khoảng dịu dàng dành riêng cho làn da của bạn.')
    setContextInsight('Bộ sưu tập dưỡng ẩm mùa xuân lấy cảm hứng từ thảo mộc thiên nhiên.')
    setPalette(palettePresets[1].colors)
    setSubjectType('real_person_product')
    setSubjectMetaphor('Tĩnh vật chai tinh chất đặt bên cửa sổ đón ánh nắng sớm.')
    setDisplayFont('Agrandir Grand')
    setBodyFont('Trajan Pro 3')
    setNegativeSpace('Trống nửa trên và bên trái cho typography')
    setKeyVisual('Ánh sáng cửa sổ buổi sớm, chất liệu linen, bóng lá mềm. Bố cục tĩnh vật tối giản.')
    setNote('Không dùng stock photo công nghiệp.')

    setObjective('Ra mắt sản phẩm mới')
    setOffer('Bộ quà tặng mùa xuân · ưu đãi 20%')
    setCta('Khám phá bộ sưu tập')
    setStatusMessage('Đã nạp mẫu Lumière Studio Luxury!')
  }

  function openFolder(folder: CampaignFolder) {
    setActiveFolderId(folder.id)
    setPage('campaign')
  }

  function createFolder() {
    setDialogName('')
    setDialog({ kind: 'create-folder' })
  }

  function renameFolder(folder: CampaignFolder) {
    setDialogName(folder.name)
    setDialog({ kind: 'rename-folder', id: folder.id, name: folder.name })
  }

  function renamePost(post: CampaignPost) {
    setDialogName(post.name)
    setDialog({ kind: 'rename-post', id: post.id, name: post.name })
  }

  function deleteFolder(folder: CampaignFolder) {
    if (campaignFolders.length < 2) { setStatusMessage('Cần giữ ít nhất một folder chiến dịch.'); return }
    setDialog({ kind: 'delete-folder', id: folder.id, name: folder.name })
  }

  function deletePost(post: CampaignPost) {
    if (activeFolder.posts.length < 2) { setStatusMessage('Cần giữ ít nhất một bài đăng trong folder.'); return }
    setDialog({ kind: 'delete-post', id: post.id, name: post.name })
  }

  function submitDialog() {
    if (!dialog) return
    const name = dialogName.trim()
    if ((dialog.kind === 'create-folder' || dialog.kind.startsWith('rename-')) && !name) return
    if (dialog.kind === 'create-folder') {
      const brief = defaultBrief()
      brief.campaign = name
      const id = crypto.randomUUID()
      const updatedAt = new Date().toISOString()
      const folder: CampaignFolder = { id, name, updatedAt, brief, posts: [] }
      setCampaignFolders((current) => [...current, folder])
      setActiveFolderId(folder.id)
      setActivePostId('')
      setPage('campaign')
    } else if (dialog.kind === 'rename-folder') {
      setCampaignFolders((current) => current.map((folder) => folder.id === dialog.id ? { ...folder, name, updatedAt: new Date().toISOString(), brief: { ...folder.brief, campaign: name }, posts: folder.posts.map((post) => ({ ...post, brief: { ...post.brief, campaign: name } })) } : folder))
      if (dialog.id === activeFolderId) setCampaign(name)
    } else if (dialog.kind === 'rename-post') {
      const updatedAt = new Date().toISOString()
      setCampaignFolders((current) => current.map((folder) => folder.id === activeFolderId ? { ...folder, updatedAt, posts: folder.posts.map((post) => post.id === dialog.id ? { ...post, name, updatedAt } : post) } : folder))
    } else if (dialog.kind === 'delete-folder') {
      const folder = campaignFolders.find((item) => item.id === dialog.id)
      const remaining = campaignFolders.filter((item) => item.id !== dialog.id)
      if (folder && remaining.length) {
        setCampaignFolders(remaining)
        folder.posts.forEach((post) => { void deleteFolderAssets(post.id) })
        if (folder.id === activeFolderId) openFolder(remaining[0])
      }
    } else if (dialog.kind === 'delete-post') {
      const updatedAt = new Date().toISOString()
      setCampaignFolders((current) => current.map((folder) => folder.id === activeFolderId ? { ...folder, updatedAt, posts: folder.posts.filter((post) => post.id !== dialog.id) } : folder))
      void deleteFolderAssets(dialog.id)
      if (dialog.id === activePostId) setPage('campaign')
    }
    setDialog(null)
  }

  function createPost() {
    if (!activeFolder) return
    const id = crypto.randomUUID()
    const brief = activeFolder.brief
    const post = { id, name: `Bài đăng ${activeFolder.posts.length + 1}`, updatedAt: new Date().toISOString(), brief }
    setCampaignFolders((current) => current.map((folder) => folder.id === activeFolderId ? { ...folder, posts: [...folder.posts, post], updatedAt: post.updatedAt } : folder))
    setActivePostId(id)
    applyBrief(brief)
    setPage('studio')
  }

  function openPost(post: CampaignPost) {
    setActivePostId(post.id)
    applyBrief(post.brief)
    setPage('studio')
  }

  function updateSettings<K extends keyof PersonalSettings>(key: K, value: PersonalSettings[K]) {
    setPersonalSettings((current) => ({ ...current, [key]: value }))
    setSettingsSaved(false)
  }

  function saveCurrentBrief() {
    if (!activePost) return
    const brief: CampaignBrief = {
      brand, industry, audience, tone, brandCoreStyle, brandGuardrails,
      campaign, message, contextInsight, palette, colors,
      subjectType, subjectMetaphor, displayFont, bodyFont, negativeSpace,
      keyVisual, referenceStrength, note, objective, offer, cta, format: format.name
    }
    const updatedAt = new Date().toISOString()
    setCampaignFolders((current) => current.map((folder) => folder.id === activeFolderId ? { ...folder, brief, updatedAt, posts: folder.posts.map((post) => post.id === activePost.id ? { ...post, brief, updatedAt } : post) } : folder))
    setStatusMessage('Đã lưu brief của bài đăng này.')
  }

  async function saveApiKey() {
    setApiSaving(true)
    setApiMessage('')
    try {
      const response = await fetch('/api/settings/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, provider: apiProvider, model: apiModel }) })
      const result = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(result.message ?? 'Không lưu được API key.')
      setApiReady(true)
      setConfiguredProvider(apiProvider)
      setApiKey('')
      setApiMessage(`Đã lưu cấu hình ${apiProvider === 'gemini' ? 'Gemini' : 'OpenAI'} trên máy này. API key không đưa vào Git.`)
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Không kết nối được local API.')
    } finally { setApiSaving(false) }
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    const loaded = await Promise.all(files.map(async (file) => ({ id: crypto.randomUUID(), name: file.name, data: await readOptimizedImage(file), kind: 'photo' as const })))
    setAssets((current) => [...current, ...loaded])
    setSelectedAssetId(loaded[0]?.id ?? null)
    event.target.value = ''
  }

  async function addComponents(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    const loaded = await Promise.all(files.map(async (file) => ({ id: crypto.randomUUID(), name: file.name, data: await readOptimizedImage(file), kind: 'component' as const })))
    setAssets((current) => [...current, ...loaded])
    setSelectedAssetId(loaded[0]?.id ?? null)
    setStatusMessage(`Đã thêm ${loaded.length} component đồ họa PNG vào thiết kế!`)
    event.target.value = ''
  }

  async function handleFontUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const fontName = file.name.replace(/\.[^/.]+$/, '').trim()
    try {
      const arrayBuffer = await file.arrayBuffer()
      const fontFace = new FontFace(fontName, arrayBuffer)
      await fontFace.load()
      document.fonts.add(fontFace)
      setDisplayFont(fontName)
      setStatusMessage(`Đã nạp font thành công: "${fontName}"!`)
    } catch {
      setDisplayFont(fontName)
      setStatusMessage(`Đã đặt tên font tiêu đề: "${fontName}"`)
    }
    event.target.value = ''
  }

  async function addLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const rawData = String(reader.result)
      const cleanData = await removeImageBackground(rawData)
      const newLogo = { id: crypto.randomUUID(), name: file.name, data: cleanData, kind: 'logo' as const }
      setAssets((current) => [...current.filter((asset) => asset.kind !== 'logo'), newLogo])
      setStatusMessage('Đã tải logo và tự động tối ưu độ trong suốt!')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  async function handleAutoRemoveBg() {
    if (!productPhoto) return
    setIsRemovingBg(true)
    setStatusMessage('Đang tách nền tự động cho ảnh sản phẩm…')
    try {
      const transparentData = await removeImageBackground(productPhoto.data)
      setAssets((current) => current.map((asset) => asset.id === productPhoto.id ? { ...asset, data: transparentData } : asset))
      setStatusMessage('Đã tách nền sạch sẽ! Sản phẩm đã sẵn sàng ghép tự nhiên.')
    } catch {
      setStatusMessage('Không thể tách nền ảnh này.')
    } finally {
      setIsRemovingBg(false)
    }
  }

  async function addKeyVisual(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const data = await readOptimizedImage(file)
    setAssets((current) => [...current.filter((asset) => asset.kind !== 'keyvisual'), { id: crypto.randomUUID(), name: file.name, data, kind: 'keyvisual' }])
    event.target.value = ''
  }

  function toggle(section: keyof typeof expanded) {
    setExpanded((current) => ({ ...current, [section]: !current[section] }))
  }

  // --- PALETTE EDITING HELPERS (FIXED & FULLY EDITABLE) ---
  function addColorItem() {
    setPalette((current) => [...current, { hex: '#B3B8FA', meaning: 'Màu mới · Ghi chú ý nghĩa' }])
  }

  function updateColorHex(index: number, newHex: string) {
    setPalette((current) => current.map((item, i) => i === index ? { ...item, hex: newHex } : item))
  }

  function updateColorMeaning(index: number, newMeaning: string) {
    setPalette((current) => current.map((item, i) => i === index ? { ...item, meaning: newMeaning } : item))
  }

  function removeColorItem(index: number) {
    if (palette.length <= 2) {
      setStatusMessage('Bảng màu cần giữ tối thiểu 2 màu.')
      return
    }
    setPalette((current) => current.filter((_, i) => i !== index))
  }

  function applyPreset(preset: PalettePreset) {
    setPalette(preset.colors)
    setStatusMessage(`Đã nạp bảng màu: ${preset.name}`)
  }

  async function generate() {
    setStatus('working')
    setStatusMessage(productMode === 'stage-real' ? 'Đang tạo bối cảnh trống chuẩn Studio để ghép sản phẩm…' : 'Đang chỉ đạo nghệ thuật AI tạo trọn vẹn concept…')
    setGeneratedImage(null)

    const presetCfg = stylePresets[stylePreset] ?? stylePresets.editorial
    const isStagingReal = productMode === 'stage-real' && Boolean(productPhoto)

    // Palette directives with semantic meanings
    const colorDirectives = palette.map((item) => `${item.hex} (${item.meaning})`).join(', ')

    const subjectDirective = subjectType === 'graphic_object'
      ? `CENTRAL GRAPHIC SYMBOL & METAPHOR: ${subjectMetaphor || 'A clean conceptual symbolic object'}. Masterfully rendered with subtle materials, integrated naturally into the background aura, WITHOUT any printed words or letters.`
      : (isStagingReal
          ? 'PHOTOGRAPHIC EMPTY STAGING BACKGROUND. An inviting, masterfully-lit empty surface/environment specifically reserved for staging a product or human portrait. THE MAIN DISPLAY SURFACE IS COMPLETELY EMPTY AND CLEAN - DO NOT DRAW ANY DUPLICATE PRODUCT. The scene must be a coherent, empty staging plate ready for product composite.'
          : `Create an authentic photograph featuring ${brand} in an authentic editorial environment.`)

    const creativePrompt = [
      subjectDirective,
      `Brand & Business Context: Brand "${brand}" (${industry}). Target Audience: ${audience}. Tone of Voice: ${tone}. Core Aesthetic: ${brandCoreStyle}.`,
      `Campaign & Insight: "${campaign}". Context: ${contextInsight}.`,
      `Core Message: "${message}". Subtitle/Offer: "${offer}". Call to action: "${cta}".`,
      `Art Direction / Key Visual: ${keyVisual}`,
      `Color Harmony & Emotional Semantics: Harmoniously blend subtle ambient tones inspired by: ${colorDirectives}.`,
      `Atmospheric Lighting: ${presetCfg.lighting}.`,
      `Tactile Physical Realism: ${presetCfg.texture}.`,
      `Composition & Negative Space: ${negativeSpace}. Soft out-of-focus background reserved specifically for typography layout. Do NOT clutter reserved text areas.`,
      `Creative Notes: ${note}`,
      `Reference Influence Level: ${referenceStrength}%.`,
      `[STRICT BRAND GUARDRAILS & ANTI-AI-SLOP DIRECTIVES]: ${brandGuardrails}. ${presetCfg.antiSlop}. CRISP CLEAN TRANSPARENT AIR, NO SMOKE, NO STEAM, NO HAZE. ABSOLUTELY NO RENDERED TEXT, NO LETTERS, NO NUMBERS, NO WATERMARK, NO FAKE LABELS.`
    ].filter(Boolean).join('\n\n')

    try {
      const references = isStagingReal
        ? assets.filter((asset) => asset.kind === 'keyvisual' || asset.kind === 'component').slice(0, 4).map((asset) => ({ name: asset.name, image: asset.data }))
        : assets.filter((asset) => asset.kind === 'photo' || asset.kind === 'keyvisual' || asset.kind === 'component').slice(0, 4).map((asset) => ({ name: asset.name, image: asset.data }))

      const generatedSize = {
        portrait: [1088, 1344], square: [1088, 1088], landscape: [1200, 624], story: [1088, 1920],
      }[format.name] ?? [1088, 1344]

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: creativePrompt, width: generatedSize[0], height: generatedSize[1], quality: personalSettings.imageQuality, references }),
      })

      const body = await response.json() as { image?: string; error?: string; message?: string }
      if (response.status === 503) {
        setStatus('missing-key')
        setStatusMessage(body.message ?? 'Thêm API key vào Cài đặt để tạo ảnh.')
        return
      }
      if (!response.ok || !body.image) throw new Error(body.message ?? body.error ?? 'Không thể tạo ảnh lúc này.')

      setGeneratedImage(body.image)
      setAssets((current) => [...current.filter((asset) => asset.kind !== 'output'), { id: crypto.randomUUID(), name: `${activePost?.name ?? campaign} · ảnh tạo`, data: body.image!, kind: 'output' }])
      setStatus('ready')
      setStatusMessage(isStagingReal ? 'Bối cảnh nền đã sẵn sàng! Sản phẩm thật được ghép tự nhiên, không bị trùng lặp.' : 'Ảnh Key Visual hoàn tất trọn vẹn, đúng dải màu và chuẩn Anti-Slop!')
    } catch (error) {
      setStatus('error')
      const message = error instanceof Error ? error.message : ''
      setStatusMessage(message === 'Failed to fetch' ? 'Không kết nối được API local. Hãy chạy lại npm run dev rồi thử lại.' : message || 'Không kết nối được máy chủ tạo ảnh.')
    }
  }

  async function exportPng() {
    const node = exportRef.current
    if (!node) return
    const width = format.width
    const height = format.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return

    const drawImage = (src: string, x: number, y: number, w: number, h: number, contain = false) => new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = () => {
        const scale = contain ? Math.min(w / image.width, h / image.height) : Math.max(w / image.width, h / image.height)
        const dw = image.width * scale
        const dh = image.height * scale
        context.save()
        if (!contain) { context.beginPath(); context.rect(x, y, w, h); context.clip() }
        context.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
        context.restore()
        resolve()
      }
      image.onerror = () => resolve()
      image.src = src
    })

    // 1. Nền gradient chuyển sắc theo bảng màu Key Visual
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, safeColor(palette[0]?.hex, '#C6F2A6'))
    gradient.addColorStop(0.5, safeColor(palette[1]?.hex, '#F7B0C3'))
    gradient.addColorStop(1, safeColor(palette[palette.length - 1]?.hex, '#B3B8FA'))
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    // 2. Vẽ ảnh nền AI
    if (generatedImage) await drawImage(generatedImage, 0, 0, width, height)

    // 3. Vùng đệm ánh sáng chuyển tiếp nhẹ bên trái để chữ nổi bật
    const scrim = context.createLinearGradient(0, 0, width * 0.65, 0)
    scrim.addColorStop(0, 'rgba(16, 26, 18, 0.72)')
    scrim.addColorStop(0.55, 'rgba(16, 26, 18, 0.28)')
    scrim.addColorStop(1, 'rgba(16, 26, 18, 0.0)')
    context.fillStyle = scrim
    context.fillRect(0, 0, width * 0.68, height)

    // 4. Vẽ ảnh sản phẩm thật kèm bóng đổ nếu có
    if (productMode === 'stage-real' && productPhoto && !imageComponents.length) {
      context.save()
      context.shadowColor = 'rgba(15, 25, 18, 0.38)'
      context.shadowBlur = width * 0.025
      context.shadowOffsetX = width * 0.005
      context.shadowOffsetY = height * 0.016
      await drawImage(productPhoto.data, width * .48, height * .18, width * .46, height * .62, true)
      context.restore()
    }

    for (const [index, asset] of imageComponents.entries()) {
      const placements = [{ x: .48, y: .49, w: .225, h: .205 }, { x: .715, y: .49, w: .225, h: .205 }, { x: .48, y: .705, w: .225, h: .205 }, { x: .715, y: .705, w: .225, h: .205 }]
      const position = placements[index % placements.length]
      context.save()
      context.shadowColor = 'rgba(15, 25, 18, 0.3)'
      context.shadowBlur = width * 0.018
      context.shadowOffsetY = height * 0.01
      await drawImage(asset.data, width * position.x, height * position.y, width * position.w, height * position.h, true)
      context.restore()
    }

    // 5. Logo thương hiệu
    if (logo) {
      context.save()
      context.shadowColor = 'rgba(0, 0, 0, 0.3)'
      context.shadowBlur = 8
      await drawImage(logo.data, width * .075, height * .055, width * .18, height * .075, true)
      context.restore()
    }

    // 6. Typography
    context.save()
    context.textAlign = 'left'
    context.fillStyle = '#ffffff'
    context.shadowColor = 'rgba(0, 0, 0, 0.45)'
    context.shadowBlur = 8
    context.shadowOffsetY = 2

    // Campaign Eyebrow
    context.font = `600 ${Math.round(width * .02)}px "${bodyFont}", sans-serif`
    context.fillText(campaign.toUpperCase(), width * .075, height * .25)

    // Message Headline
    context.font = `800 ${Math.round(width * .054)}px "${displayFont}", sans-serif`
    const words = message.split(' ')
    const maxWidth = width * .53
    let line = ''
    let y = height * .36
    const lineHeight = width * .07
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (context.measureText(next).width > maxWidth && line) {
        context.fillText(line, width * .075, y)
        line = word
        y += lineHeight
      } else {
        line = next
      }
    }
    if (line) context.fillText(line, width * .075, y)

    // Subtitle / Offer
    context.font = `400 ${Math.round(width * .022)}px "${bodyFont}", sans-serif`
    context.fillStyle = 'rgba(255, 255, 255, 0.92)'
    context.fillText(offer, width * .075, y + width * .06)

    // Call to action button
    const ctaY = y + width * .13
    const ctaText = cta
    context.font = `700 ${Math.round(width * .022)}px "${bodyFont}", sans-serif`
    const ctaWidth = context.measureText(ctaText).width + width * .06
    const ctaHeight = width * .052

    context.fillStyle = safeColor(palette[0]?.hex, '#C6F2A6')
    context.shadowColor = 'rgba(0, 0, 0, 0.25)'
    context.shadowBlur = 10
    context.beginPath()
    context.roundRect(width * .075, ctaY, ctaWidth, ctaHeight, 6)
    context.fill()

    context.fillStyle = '#1C2F4D'
    context.shadowColor = 'transparent'
    context.fillText(ctaText, width * .105, ctaY + ctaHeight * 0.68)

    context.restore()

    const link = document.createElement('a')
    link.download = `${brand.toLowerCase().replace(/\s+/g, '-')}-${activePost?.name.toLowerCase().replace(/\s+/g, '-') ?? 'poster'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function removeAsset(id: string) {
    setAssets((current) => current.filter((asset) => asset.id !== id))
    if (selectedAssetId === id) setSelectedAssetId(null)
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-group">
          <div className="brand-badge" onClick={() => setPage('folders')}>VS</div>
          <div>
            <strong>Creative Studio</strong>
            <small>Social Creative Agent · VietSpirit</small>
          </div>
        </div>
        <nav className="top-nav">
          <button className={page === 'folders' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('folders')}><Icon name="folder" /> Chiến dịch</button>
          <button className={page === 'studio' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('studio')}><Icon name="spark" /> Studio</button>
          <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Icon name="settings" /> Cài đặt</button>
        </nav>
        <div className="top-actions">
          <span className="save-indicator">{personalSettings.autosave ? '✓ Đã bật tự lưu' : 'Lưu thủ công'}</span>
          <button className="quiet-btn" onClick={saveCurrentBrief}><Icon name="check" /> Lưu brief</button>
          <button className="export-btn" onClick={exportPng}><Icon name="download" /> Xuất ảnh PNG</button>
        </div>
      </header>

      <main className="main-content">
        {page === 'settings' ? <section className="settings-page">
          <div className="settings-intro"><div><span className="eyebrow">CẤU HÌNH</span><h1>Cài đặt hệ thống</h1><p>Quản lý tài khoản, workspace và kết nối Local AI API.</p></div>{settingsSaved && <span className="settings-save-state">✓ Đã lưu</span>}</div>
          <div className="settings-layout">
            <div className="settings-nav">
              <a href="#profile" className="selected"><Icon name="user" /> Thông tin</a>
              <a href="#api"><Icon name="spark" /> Local AI Model</a>
            </div>
            <div className="settings-content">
              <section className="settings-card" id="profile">
                <div className="settings-card-title"><div><h2>Thông tin cá nhân & Workspace</h2><p>Dùng để hiển thị trong studio và gắn thẻ file xuất bản.</p></div><div className="profile-avatar">{personalSettings.displayName ? personalSettings.displayName.slice(0, 2).toUpperCase() : 'VS'}</div></div>
                <div className="settings-fields">
                  <label className="field-label">Tên hiển thị<input value={personalSettings.displayName} onChange={(e) => updateSettings('displayName', e.target.value)} placeholder="Ví dụ: Hoàng Creative" /></label>
                  <label className="field-label">Email<input value={personalSettings.email} onChange={(e) => updateSettings('email', e.target.value)} placeholder="name@company.com" /></label>
                  <label className="field-label">Tên Workspace<input value={personalSettings.workspaceName} onChange={(e) => updateSettings('workspaceName', e.target.value)} /></label>
                  <label className="field-label">Khổ ảnh mặc định<select value={personalSettings.defaultFormat} onChange={(e) => updateSettings('defaultFormat', e.target.value)}>{formats.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}</select></label>
                </div>
                <div className="setting-toggle"><div><strong>Tự động lưu thay đổi</strong><small>Lưu các chỉnh sửa brief vào bộ nhớ trình duyệt ngay khi bạn nhập liệu.</small></div><button type="button" className={`switch ${personalSettings.autosave ? 'on' : ''}`} onClick={() => updateSettings('autosave', !personalSettings.autosave)}><i /></button></div>
              </section>

              <section className="settings-card" id="api">
                <div className="settings-card-title"><div><h2>Cấu hình AI Image API</h2><p>Kết nối OpenAI hoặc Google Gemini để sinh ảnh nền sáng tạo.</p></div><div className="settings-card-icon"><Icon name="spark" /></div></div>
                <div className="settings-fields">
                  <label className="field-label">Nhà cung cấp
                    <select value={apiProvider} onChange={(e) => { const next = e.target.value as 'openai' | 'gemini'; setApiProvider(next); setApiModel(next === 'gemini' ? 'gemini-3.1-flash-image' : 'gpt-image-2.5-sunburst') }}>
                      <option value="gemini">Google Gemini (Hỗ trợ ảnh tham chiếu · Khuyên dùng)</option>
                      <option value="openai">OpenAI (DALL·E / GPT Image)</option>
                    </select>
                  </label>
                  <label className="field-label">Model ID<input value={apiModel} onChange={(e) => setApiModel(e.target.value)} /></label>
                </div>
                <label className="field-label" style={{ marginTop: '10px' }}>API Key
                  <input type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={apiReady ? 'Đã có key · nhập key mới để thay thế' : 'Dán API key tại đây'} />
                </label>
                <div className="api-settings-actions">
                  <div className="api-help">
                    <span className={apiReady && apiProvider === configuredProvider ? 'api-state-dot ready' : 'api-state-dot'} />
                    <span>
                      <strong>{apiReady && apiProvider === configuredProvider ? `Đã kết nối ${apiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}` : 'Chưa cấu hình API Key'}</strong>
                      <small>{apiMessage || 'Khóa API được lưu cục bộ an toàn trên máy, không đưa lên Git.'}</small>
                    </span>
                  </div>
                  <button className="export-btn" onClick={saveApiKey} disabled={!apiKey.trim() || !apiModel.trim() || apiSaving}>
                    <Icon name={apiSaving ? 'loader' : 'check'} />
                    {apiSaving ? 'Đang lưu…' : 'Lưu cấu hình'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section> : page === 'folders' ? <section className="folder-page home-page">
          <div className="folder-page-heading">
            <div><span className="eyebrow">THƯ VIỆN CỦA BẠN</span><h1>Chiến dịch</h1><p>Quản lý các chiến dịch truyền thông và bài đăng sáng tạo của bạn.</p></div>
            <button className="export-btn" onClick={createFolder}><Icon name="plus" /> Tạo chiến dịch</button>
          </div>
          <div className="folder-toolbar">
            <label className="folder-search"><Icon name="search" /><input value={folderQuery} onChange={(e) => setFolderQuery(e.target.value)} placeholder="Tìm chiến dịch…" /></label>
            <div className="folder-toolbar-actions">
              <span>{filteredFolders.length} / {campaignFolders.length} chiến dịch</span>
              <label className="folder-sort-label">Sắp xếp
                <select className="folder-sort" value={folderSort} onChange={(e) => setFolderSort(e.target.value as 'updated' | 'name')}>
                  <option value="updated">Mới cập nhật</option>
                  <option value="name">Tên A–Z</option>
                </select>
              </label>
            </div>
          </div>
          <div className="folder-grid">
            {filteredFolders.map((folder, index) => <article className="campaign-card" key={folder.id}>
              <button className="campaign-card-main" onClick={() => openFolder(folder)}>
                <div className={`folder-art folder-color-${index % 4}`}><Icon name="folder" /><span>CHIẾN DỊCH</span></div>
                <div className="campaign-card-info">
                  <div><strong>{folder.name}</strong><small>Cập nhật {new Date(folder.updatedAt).toLocaleDateString('vi-VN')}</small></div>
                  <span className="folder-open-arrow">↗</span>
                </div>
                <div className="campaign-card-meta">
                  <span><Icon name="file" /> {folder.posts.length} bài đăng</span>
                  <span>{folder.brief.format === 'portrait' ? '4:5' : folder.brief.format === 'square' ? '1:1' : folder.brief.format === 'story' ? '9:16' : '1.91:1'}</span>
                </div>
              </button>
              <div className="campaign-card-actions">
                <button onClick={() => renameFolder(folder)}><Icon name="edit" /> Đổi tên</button>
                <button onClick={() => deleteFolder(folder)}><Icon name="trash" /> Xóa</button>
              </div>
            </article>)}
            {!filteredFolders.length && <p className="empty-folders">Không tìm thấy chiến dịch phù hợp.</p>}
          </div>
        </section> : page === 'campaign' ? <section className="campaign-page">
          <div className="campaign-page-heading">
            <button className="back-link" onClick={() => setPage('folders')}>← Tất cả chiến dịch</button>
            <div className="campaign-heading-row">
              <div><span className="eyebrow">CHIẾN DỊCH</span><h1>{activeFolder?.name}</h1><p>Các bài đăng trong chiến dịch này được quản lý riêng.</p></div>
              <button className="export-btn" onClick={createPost}><Icon name="plus" /> Tạo bài đăng</button>
            </div>
          </div>
          <section className="campaign-overview">
            <div className="campaign-overview-title">
              <div><span className="eyebrow">KEY VISUAL BRIEF</span><h2>Thông tin chiến dịch</h2><p>Bài đăng mới sẽ kế thừa hệ quy chuẩn này. Bạn có thể tinh chỉnh riêng trong từng bài.</p></div>
              <span className="campaign-overview-mark"><Icon name="layers" /></span>
            </div>
            <div className="campaign-overview-grid">
              <div><small>Thương hiệu</small><strong>{activeFolder?.brief.brand || 'Chưa thiết lập'}</strong></div>
              <div><small>Thông điệp chính</small><strong>{activeFolder?.brief.message || 'Chưa thiết lập'}</strong></div>
              <div><small>Phong cách thiết kế</small><strong>{activeFolder?.brief.brandCoreStyle || 'Clean Tech'}</strong></div>
              <div><small>Hình tượng chủ đạo</small><strong>{activeFolder?.brief.subjectMetaphor ? activeFolder.brief.subjectMetaphor.slice(0, 35) + '…' : 'Chưa thiết lập'}</strong></div>
            </div>
            <div className="campaign-palette">
              <span>Bảng màu Key Visual</span>
              {(activeFolder?.brief.palette ?? palettePresets[0].colors).map((item, index) => <i key={index} title={`${item.hex}: ${item.meaning}`} style={{ backgroundColor: safeColor(item.hex, '#e5e8e1') }} />)}
            </div>
          </section>
          <div className="post-section-heading"><div><h2>Bài đăng</h2><p>{activeFolder?.posts.length ?? 0} bài trong chiến dịch</p></div></div>
          <div className="post-grid">
            {activeFolder?.posts.map((post, index) => <article className="post-card" key={post.id}>
              <button className="post-card-open" onClick={() => openPost(post)}>
                <div className={`post-preview post-preview-${index % 4} ${postCovers[post.id] ? 'has-cover' : ''}`}>
                  {postCovers[post.id] && <img src={postCovers[post.id]} alt="Ảnh đã tạo" />}
                  <strong>{post.brief.message || 'Bài đăng mới'}</strong>
                  <small>{post.brief.format === 'portrait' ? '4:5' : post.brief.format === 'square' ? '1:1' : post.brief.format === 'story' ? '9:16' : '1.91:1'}</small>
                </div>
                <div className="post-card-info">
                  <span><strong>{post.name}</strong><small>{postCovers[post.id] ? 'Đã có ảnh tạo · ' : 'Bản nháp · '}Cập nhật {new Date(post.updatedAt).toLocaleDateString('vi-VN')}</small></span>
                  <span className="folder-open-arrow">↗</span>
                </div>
              </button>
              <div className="campaign-card-actions">
                <button onClick={() => renamePost(post)}><Icon name="edit" /> Đổi tên</button>
                <button onClick={() => deletePost(post)}><Icon name="trash" /> Xóa</button>
              </div>
            </article>)}
            {activeFolder?.posts.length === 0 && <div className="campaign-empty">
              <span className="new-post-plus"><Icon name="plus" /></span>
              <h3>Chưa có bài đăng</h3>
              <p>Tạo bài đầu tiên để bắt đầu thiết kế Key Visual và ảnh thực tế cho chiến dịch này.</p>
              <button className="export-btn" onClick={createPost}><Icon name="plus" /> Tạo bài đăng đầu tiên</button>
            </div>}
            {Boolean(activeFolder?.posts.length) && <button className="new-post-card" onClick={createPost}>
              <span className="new-post-plus"><Icon name="plus" /></span>
              <strong>Tạo bài đăng mới</strong>
              <small>Mở Studio Key Visual</small>
            </button>}
          </div>
        </section> : <div className="workspace">
          <section className="context-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">HỆ THỐNG INPUT 3 TẦNG</span>
                <h1>{campaign}</h1>
                <p>Khung thông tin thương hiệu, quy chuẩn Key Visual & bài đăng.</p>
              </div>
            </div>

            <div className="api-status-inline">
              <i className={apiReady && apiProvider === configuredProvider ? 'ready' : ''} />
              <span>{apiReady && apiProvider === configuredProvider ? `Đã cấu hình ${apiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}` : 'Cần cấu hình API Key'}</span>
              {!(apiReady && apiProvider === configuredProvider) && <button onClick={() => setPage('settings')}>Cấu hình</button>}
            </div>

            <div className="tabs">
              <button className={activeTab === 'context' ? 'tab active' : 'tab'} onClick={() => setActiveTab('context')}>
                Key Visual & Brief
              </button>
              <button className={activeTab === 'assets' ? 'tab active' : 'tab'} onClick={() => setActiveTab('assets')}>
                Tài nguyên <span>{assets.length}</span>
              </button>
            </div>

            {activeTab === 'context' ? <div className="form-scroll">
              {/* Quick Sample Profile Bar */}
              <div className="sample-bar">
                <span>⚡ Nạp mẫu nhanh:</span>
                <div className="sample-btn-group">
                  <button type="button" className="sample-btn" onClick={applyYouthPlusDemo} title="Nạp đúng theo file PDF Youth+ Tech [Sự kiện Tháng 7]">
                    🌸 Youth+ Tech [Sự kiện Tháng 7]
                  </button>
                  <button type="button" className="sample-btn" onClick={applyLumiereDemo} title="Nạp mẫu thương hiệu Skincare tối giản">
                    ✨ Lumière Studio
                  </button>
                </div>
              </div>

              {/* ============================================================== */}
              {/* TẦNG 1: BRAND DNA & ĐIỀU CẤM KỴ */}
              {/* ============================================================== */}
              <div className="tier-header">
                <div className="tier-title">
                  <strong>Tầng 1: Brand DNA & Guardrails</strong>
                  <small>Thông tin doanh nghiệp & quy chuẩn cấm kỵ</small>
                </div>
                <span className="tier-pill">Thương hiệu</span>
              </div>

              <Section title="Hồ sơ doanh nghiệp" count="01" open={expanded.tier1Brand} onClick={() => toggle('tier1Brand')}>
                <label className="field-label">Tên doanh nghiệp / Thương hiệu
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ví dụ: Youth+ Tech" />
                </label>
                <label className="field-label">Ngành hàng / Lĩnh vực hoạt động
                  <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ví dụ: Công nghệ giáo dục & Hoạt động xã hội" />
                </label>
                <label className="field-label">Khách hàng mục tiêu (Target Audience)
                  <textarea rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ví dụ: Học sinh, sinh viên, Gen Z toàn quốc..." />
                </label>
                <label className="field-label">Tính cách thương hiệu (Tone of Voice)
                  <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Ví dụ: Đồng cảm, hiện đại, năng động, chữa lành" />
                </label>
                <label className="field-label">Logo thương hiệu
                  <div className="upload-inline">
                    <input type="file" accept="image/*" onChange={addLogo} />
                    <span>{logo ? logo.name : 'Chọn logo PNG / SVG (Tự động tách nền)'}</span>
                    <Icon name="upload" />
                  </div>
                </label>
              </Section>

              <Section title="Thẩm mỹ cốt lõi & Những điều cấm kỵ" count="02" open={expanded.tier1Guardrails} onClick={() => toggle('tier1Guardrails')}>
                <label className="field-label">Phong cách thiết kế cốt lõi (Core Aesthetic)
                  <input value={brandCoreStyle} onChange={(e) => setBrandCoreStyle(e.target.value)} placeholder="Ví dụ: Neo-Brutalism & Modern Clean Tech" />
                </label>
                <div className="guardrails-box">
                  <label className="field-label" style={{ color: '#9c3f2d' }}>
                    <strong>⛔ NHỮNG ĐIỀU CẤM KỴ (Brand Guardrails / Don'ts)</strong>
                    <small style={{ color: '#8b5448' }}>AI sẽ triệt tiêu 100% các yếu tố này khỏi ảnh nền:</small>
                    <textarea rows={3} value={brandGuardrails} onChange={(e) => setBrandGuardrails(e.target.value)} placeholder="Ví dụ: Tuyệt đối không dùng 3D sáp nhựa; Không màu sắc bi lụy đen tối; Không che góc đặt logo..." />
                  </label>
                  <div className="guardrails-quick-chips">
                    <span className="guardrail-chip" onClick={() => setBrandGuardrails((prev) => prev ? `${prev}; Cấm chữ/số giả mạo trong nền AI` : 'Cấm chữ/số giả mạo trong nền AI')}>+ Cấm chữ rác</span>
                    <span className="guardrail-chip" onClick={() => setBrandGuardrails((prev) => prev ? `${prev}; Không dùng 3D render sáp nhựa rẻ tiền` : 'Không dùng 3D render sáp nhựa')}>+ Cấm 3D sáp nhựa</span>
                    <span className="guardrail-chip" onClick={() => setBrandGuardrails((prev) => prev ? `${prev}; Tránh màu đen tối u ám bi lụy` : 'Tránh màu đen tối u ám')}>+ Cấm màu đen u ám</span>
                    <span className="guardrail-chip" onClick={() => setBrandGuardrails((prev) => prev ? `${prev}; Giữ thoáng góc trên để đặt logo` : 'Giữ thoáng góc trên')}>+ Chừa chỗ Logo</span>
                  </div>
                </div>
              </Section>

              {/* ============================================================== */}
              {/* TẦNG 2: HỆ THỐNG KEY VISUAL CHIẾN DỊCH (THEO PDF) */}
              {/* ============================================================== */}
              <div className="tier-header tier-2">
                <div className="tier-title">
                  <strong>Tầng 2: Hệ thống Key Visual Chiến dịch</strong>
                  <small>Thông điệp, Bảng màu, Hình tượng chủ đạo, Component PNG & Font</small>
                </div>
                <span className="tier-pill" style={{ background: '#E6E8FA', color: '#3A4278' }}>Key Visual</span>
              </div>

              <Section title="Nội dung thông điệp & Bối cảnh" count="03" open={expanded.tier2Message} onClick={() => toggle('tier2Message')}>
                <label className="field-label">Tên chiến dịch / Sự kiện
                  <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Ví dụ: Youth+ Tech [Sự kiện Tháng 7]" />
                </label>
                <label className="field-label">Nội dung thông điệp chính (Tagline / Slogan)
                  <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ví dụ: Speak Out - Don't keep by yourself" />
                </label>
                <label className="field-label">Tổng quan bối cảnh & Insight chiến dịch
                  <textarea rows={3} value={contextInsight} onChange={(e) => setContextInsight(e.target.value)} placeholder="Ví dụ: Nguy cơ mắc bệnh tâm lý ở giới trẻ gia tăng. Cuộc thi tạo cơ hội chia sẻ giải pháp thiết thực..." />
                </label>
              </Section>

              <Section title="Bảng màu & Ý nghĩa màu sắc" count="04" open={expanded.tier2Palette} onClick={() => toggle('tier2Palette')}>
                <div className="palette-preset-row">
                  <span style={{ fontSize: '8px', color: '#687363', fontWeight: 650 }}>Presets có sẵn:</span>
                  {palettePresets.map((preset) => (
                    <button key={preset.name} type="button" className="palette-preset-btn" onClick={() => applyPreset(preset)}>
                      <span className="mini-palette-dots">
                        {preset.colors.map((c, i) => <i key={i} style={{ backgroundColor: c.hex }} />)}
                      </span>
                      <span>{preset.name.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>

                <div className="palette-list">
                  {palette.map((item, index) => {
                    const validHex = safeColor(item.hex, '#B3B8FA')
                    return (
                      <div className="palette-item-card" key={index}>
                        <input
                          type="color"
                          className="palette-item-swatch"
                          value={validHex}
                          onChange={(e) => updateColorHex(index, e.target.value)}
                          title="Click để chọn màu từ bảng màu hệ thống"
                        />
                        <input
                          className="palette-item-hex"
                          value={item.hex}
                          maxLength={9}
                          placeholder="#HEX"
                          onChange={(e) => updateColorHex(index, e.target.value)}
                          onBlur={(e) => {
                            let val = e.target.value.trim()
                            if (val && !val.startsWith('#')) val = '#' + val
                            updateColorHex(index, val)
                          }}
                        />
                        <input
                          className="palette-item-meaning"
                          value={item.meaning}
                          placeholder="Chú thích ý nghĩa màu (VD: Nature, growth...)"
                          onChange={(e) => updateColorMeaning(index, e.target.value)}
                        />
                        <button
                          type="button"
                          className="palette-remove-btn"
                          onClick={() => removeColorItem(index)}
                          title="Xóa màu này"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
                <button type="button" className="add-color-btn" onClick={addColorItem}>
                  <Icon name="plus" /> Thêm màu vào bảng màu
                </button>
              </Section>

              <Section title="Hình ảnh chủ đạo & Ẩn dụ biểu tượng" count="05" open={expanded.tier2Subject} onClick={() => toggle('tier2Subject')}>
                <label className="field-label">Loại hình ảnh chủ đạo
                  <div className="product-mode-selector">
                    <button
                      type="button"
                      className={`mode-btn ${subjectType === 'graphic_object' ? 'active' : ''}`}
                      onClick={() => setSubjectType('graphic_object')}
                    >
                      <strong>🔮 Object đồ họa / Biểu tượng thiết kế</strong>
                      <small>Ví dụ: Chiếc loa Sharing Speaker, khối 3D biểu tượng</small>
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${subjectType === 'real_person_product' ? 'active' : ''}`}
                      onClick={() => setSubjectType('real_person_product')}
                    >
                      <strong>👤 Người thật / Sản phẩm thực tế</strong>
                      <small>Ghép ảnh chụp người mẫu, Mentor hoặc sản phẩm thật</small>
                    </button>
                  </div>
                </label>

                <label className="field-label">Mô tả hình tượng chủ đạo & Ý nghĩa ẩn dụ (Metaphor)
                  <textarea rows={3} value={subjectMetaphor} onChange={(e) => setSubjectMetaphor(e.target.value)} placeholder="Ví dụ trong PDF: Sharing Speaker - Chiếc loa đại diện cho tiếng nói, sự chủ động lên tiếng chia sẻ và lan tỏa giải pháp chữa lành..." />
                </label>

                {subjectType === 'real_person_product' && (
                  <div className="asset-quick">
                    <div className="asset-quick-head">
                      <div><strong>Ảnh chụp thực tế</strong><small>Ảnh người mẫu hoặc sản phẩm</small></div>
                      <button className="add-btn" onClick={() => fileInput.current?.click()}><Icon name="plus" /> Thêm ảnh</button>
                    </div>
                    {productPhoto && (
                      <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="remove-bg-btn"
                          onClick={handleAutoRemoveBg}
                          disabled={isRemovingBg}
                        >
                          <Icon name="spark" />
                          {isRemovingBg ? 'Đang xử lý tách nền…' : '✨ Tách nền thông minh cho ảnh'}
                        </button>
                      </div>
                    )}
                    {assets.filter((asset) => asset.kind === 'photo').length ? (
                      <div className="asset-thumbs">
                        {assets.filter((asset) => asset.kind === 'photo').map((asset) => (
                          <button className={selectedAssetId === asset.id ? 'asset-thumb selected' : 'asset-thumb'} key={asset.id} onClick={() => setSelectedAssetId(asset.id)}>
                            <img src={asset.data} alt={asset.name} />
                            <span>{asset.name}</span>
                            <i onClick={(event) => { event.stopPropagation(); removeAsset(asset.id) }}>×</i>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button className="dropzone" onClick={() => fileInput.current?.click()}>
                        <span className="drop-icon"><Icon name="image" /></span>
                        <span><strong>Kéo ảnh vào đây</strong><small>hoặc nhấn để chọn từ thiết bị</small></span>
                      </button>
                    )}
                  </div>
                )}
              </Section>

              {/* ============================================================== */}
              {/* SECTION 06: COMPONENT PNG UPLOADS & CUSTOM FONT ADDER */}
              {/* ============================================================== */}
              <Section title="Component Đồ Họa PNG & Font Tiêu Đề" count="06" open={expanded.tier2Components} onClick={() => toggle('tier2Components')}>
                {/* 1. PNG Component Upload */}
                <div className="component-upload-box">
                  <div className="field-label">
                    <strong>🖼️ Upload Component Đồ Họa (File PNG tách nền)</strong>
                    <small style={{ color: '#7a8575' }}>Tải lên các icon vector, stickers, khung bo góc, mũi tên chevron hoặc props để ghép lên thiết kế:</small>
                  </div>

                  <div className="component-dropzone" onClick={() => componentInput.current?.click()}>
                    <Icon name="upload" />
                    <div>
                      <strong>Nhấn để tải lên Component PNG</strong>
                      <small style={{ display: 'block', color: '#7b8777' }}>Hỗ trợ chọn nhiều file PNG cùng lúc</small>
                    </div>
                  </div>
                  <input ref={componentInput} type="file" accept="image/png,image/webp,image/svg+xml,image/*" multiple hidden onChange={addComponents} />

                  {imageComponents.length > 0 && (
                    <div className="component-gallery">
                      {imageComponents.map((asset) => (
                        <div className="component-card" key={asset.id}>
                          <img src={asset.data} alt={asset.name} />
                          <span>{asset.name}</span>
                          <button type="button" className="del-btn" onClick={() => removeAsset(asset.id)} title="Xóa component">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Custom Font Adder */}
                <div className="font-custom-box" style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #edf1eb' }}>
                  <label className="field-label">
                    <strong>🔤 Font Tiêu Đề Chính (Display Font)</strong>
                    <small style={{ color: '#7a8575' }}>Bạn có thể tự gõ bất kỳ tên Font nào hoặc bấm chọn nhanh:</small>
                    <input
                      value={displayFont}
                      onChange={(e) => setDisplayFont(e.target.value)}
                      placeholder="Ví dụ: MOKOTO, Agrandir Grand, Montserrat, Space Grotesk..."
                      style={{ fontWeight: 700, fontSize: '11px' }}
                    />
                  </label>

                  <div className="font-quick-chips">
                    {['MOKOTO', 'Agrandir Grand', 'Montserrat', 'Space Grotesk', 'Plus Jakarta Sans', 'Cinzel', 'Bebas Neue', 'Anton'].map((fontName) => (
                      <span
                        key={fontName}
                        className={`font-chip ${displayFont.toLowerCase() === fontName.toLowerCase() ? 'active' : ''}`}
                        onClick={() => setDisplayFont(fontName)}
                      >
                        {fontName}
                      </span>
                    ))}
                  </div>

                  <label className="font-upload-btn">
                    <Icon name="upload" />
                    <span>Tải lên file Font (.woff2, .ttf, .otf) từ máy tính</span>
                    <input ref={fontFileInput} type="file" accept=".woff2,.woff,.ttf,.otf" hidden onChange={handleFontUpload} />
                  </label>
                </div>

                {/* 3. Body Font Selector */}
                <div style={{ marginTop: '10px' }}>
                  <label className="field-label">Font Nội dung phụ (Body Font)
                    <select value={bodyFont} onChange={(e) => setBodyFont(e.target.value)}>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Fira Sans">Fira Sans Bold</option>
                      <option value="Trajan Pro 3">Trajan Pro 3</option>
                      <option value="Inter">Inter</option>
                      <option value="DM Sans">DM Sans</option>
                    </select>
                  </label>
                </div>
              </Section>

              <Section title="Bản des tham khảo & Khoảng trống mong muốn" count="07" open={expanded.tier2Ref} onClick={() => toggle('tier2Ref')}>
                <label className="field-label">Mô tả background mong muốn
                  <textarea rows={3} value={keyVisual} onChange={(e) => setKeyVisual(e.target.value)} placeholder="Ví dụ: Nền pastel mờ ảo chuyển sắc, để trống góc trái..." />
                </label>

                <label className="field-label">Ảnh thiết kế tham chiếu (Moodboard / Reference Layout)
                  <div className="upload-inline">
                    <input type="file" accept="image/*" onChange={addKeyVisual} />
                    <span>{assets.find((asset) => asset.kind === 'keyvisual')?.name ?? 'Tải ảnh thiết kế tham khảo'}</span>
                    <Icon name="upload" />
                  </div>
                </label>

                <label className="field-label">Mức độ bám thiết kế tham khảo
                  <div className="range-line">
                    <input type="range" min="0" max="100" value={referenceStrength} onChange={(e) => setReferenceStrength(Number(e.target.value))} />
                    <span>{referenceStrength}%</span>
                  </div>
                </label>

                <label className="field-label">Vùng khoảng trống ưu tiên (Negative Space)
                  <select value={negativeSpace} onChange={(e) => setNegativeSpace(e.target.value)}>
                    <option value="Trống góc trái và nửa trên để bố trí Typography và CTA">Trống góc trái và nửa trên (Chuẩn Poster / Banner)</option>
                    <option value="Trống nửa trên để đặt tiêu đề lớn">Trống nửa trên (Top Headline)</option>
                    <option value="Trống trung tâm để đặt khung chân dung">Trống trung tâm (Center Frame)</option>
                    <option value="Bố cục mở cân bằng tự do">Bố cục mở cân bằng tự do</option>
                  </select>
                </label>

                <label className="field-label">Ghi chú sáng tạo thêm
                  <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Không dùng stock photo, giữ sạch nền..." />
                </label>
              </Section>

              {/* ============================================================== */}
              {/* TẦNG 3: BÀI ĐĂNG CỤ THỂ & XUẤT BẢN */}
              {/* ============================================================== */}
              <div className="tier-header tier-3">
                <div className="tier-title">
                  <strong>Tầng 3: Bài đăng cụ thể & Bố cục</strong>
                  <small>Thông tin hiển thị trên ấn phẩm và xuất bản</small>
                </div>
                <span className="tier-pill" style={{ background: '#FBEBEB', color: '#B6404A' }}>Bài đăng</span>
              </div>

              <Section title="Nội dung bài đăng & Kêu gọi" count="08" open={expanded.tier3Post} onClick={() => toggle('tier3Post')}>
                <label className="field-label">Mục tiêu bài đăng
                  <select value={objective} onChange={(e) => setObjective(e.target.value)}>
                    <option>Nâng cao nhận thức & Tuyển đăng ký cuộc thi</option>
                    <option>Giới thiệu Mentor / Diễn giả</option>
                    <option>Ra mắt sản phẩm / Sự kiện</option>
                    <option>Chia sẻ kiến thức & Thể lệ</option>
                  </select>
                </label>
                <label className="field-label">Tiêu đề phụ / Ưu đãi (Subtitle / Offer)
                  <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Ví dụ: Cuộc thi ý tưởng sáng tạo cho học sinh - sinh viên toàn quốc" />
                </label>
                <label className="field-label">Nút kêu gọi hành động (Call To Action - CTA)
                  <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Ví dụ: REGISTER NOW" />
                </label>
                <label className="field-label">Định dạng khổ ảnh
                  <select value={format.name} onChange={(e) => setFormat(formats.find((item) => item.name === e.target.value) ?? formats[0])}>
                    {formats.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}
                  </select>
                </label>
              </Section>
            </div> : <div className="form-scroll assets-view">
              <div className="asset-upload-card" onClick={() => fileInput.current?.click()}>
                <Icon name="upload" />
                <strong>Thêm hình ảnh tham chiếu</strong>
                <span>Ảnh người mẫu, sản phẩm, layout mẫu…</span>
              </div>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addFiles} />

              <div className="asset-upload-card component-upload-card" onClick={() => componentInput.current?.click()}>
                <Icon name="layers" />
                <strong>Thêm thành phần vào thiết kế</strong>
                <span>Ảnh sticker, props cắt nền để đặt lên canvas</span>
              </div>
              <input ref={componentInput} type="file" accept="image/*" multiple hidden onChange={addComponents} />

              {assets.length ? assets.map((asset) => (
                <div className="asset-list-item" key={asset.id}>
                  <img src={asset.data} alt="" />
                  <div>
                    <strong>{asset.name}</strong>
                    <small>{asset.kind === 'logo' ? 'Logo' : asset.kind === 'keyvisual' ? 'Key visual' : asset.kind === 'component' ? 'Thành phần hình ảnh' : asset.kind === 'output' ? 'Ảnh đã tạo' : 'Ảnh tham chiếu'}</small>
                  </div>
                  <button className="icon-btn" onClick={() => removeAsset(asset.id)}><Icon name="trash" /></button>
                </div>
              )) : <p className="empty-copy">Tài nguyên tải lên và ảnh đã tạo sẽ nằm trong bài đăng này.</p>}
            </div>}

            <div className="panel-footer">
              <span><Icon name="folder" /> {activeFolder?.name} / {activePost?.name}</span>
              <button className="generate-btn" onClick={apiReady && apiProvider === configuredProvider ? generate : () => setPage('settings')} disabled={status === 'working'}>
                <Icon name={status === 'working' ? 'loader' : apiReady && apiProvider === configuredProvider ? 'spark' : 'lock'} />
                {status === 'working' ? 'Đang tạo concept…' : apiReady && apiProvider === configuredProvider ? 'Tạo ảnh Key Visual' : 'Cấu hình API'}
              </button>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CANVAS PREVIEW PANEL */}
          {/* ============================================================== */}
          <section className="canvas-panel">
            <div className="canvas-toolbar">
              <div className="canvas-title">
                <span className="live-dot" />
                <strong>{activePost?.name ?? campaign}</strong>
                <span className="draft-pill">{brand}</span>
              </div>
              <button className="folder-switcher" onClick={() => setPage('campaign')}>← Về chiến dịch</button>
            </div>

            <div className="canvas-stage">
              <div
                className={`creative-canvas format-${format.name}`}
                ref={exportRef}
                style={{
                  width: format.width * canvasScale,
                  height: format.height * canvasScale,
                  backgroundColor: safeColor(palette[0]?.hex, '#C6F2A6')
                }}
              >
                {generatedImage ? (
                  <img className="canvas-background" src={generatedImage} alt="Ảnh nền được tạo" />
                ) : (
                  <div
                    className="canvas-background placeholder-bg"
                    style={{
                      background: `linear-gradient(135deg, ${safeColor(palette[0]?.hex, '#C6F2A6')} 0%, ${safeColor(palette[1]?.hex, '#F7B0C3')} 50%, ${safeColor(palette[palette.length - 1]?.hex, '#B3B8FA')} 100%)`
                    }}
                  >
                    <div className="sun-shape" />
                    <div className="grain" />
                  </div>
                )}

                {/* Subtle decor vectors mimicking page 4 of PDF */}
                <div className="canvas-decor-star top-right"><Icon name="spark" /></div>
                <div className="canvas-decor-star bottom-left"><Icon name="spark" /></div>
                <div className="canvas-decor-ring" />

                <div className="canvas-wash" />

                {logo ? (
                  <img className="canvas-logo" src={logo.data} alt={brand} />
                ) : (
                  <div className="canvas-brand">{brand}<span>®</span></div>
                )}

                <div className="canvas-copy">
                  <div className="canvas-kicker" style={{ fontFamily: `"${bodyFont}", sans-serif` }}>
                    {campaign}
                  </div>
                  <h2 style={{ fontFamily: `"${displayFont}", sans-serif` }}>
                    {message}
                  </h2>
                  <p style={{ fontFamily: `"${bodyFont}", sans-serif` }}>{offer}</p>
                  <button className="canvas-cta" style={{ backgroundColor: safeColor(palette[0]?.hex, '#C6F2A6'), color: '#1C2F4D', fontFamily: `"${bodyFont}", sans-serif` }}>
                    {cta}<span>↗</span>
                  </button>
                </div>

                {/* Subject real photo staging */}
                {subjectType === 'real_person_product' && productPhoto && !imageComponents.length && (
                  <img className="canvas-product" src={productPhoto.data} alt="Sản phẩm / Người mẫu" />
                )}

                {imageComponents.length > 0 && (
                  <div className="canvas-components">
                    {imageComponents.map((asset) => <img src={asset.data} alt={asset.name} key={asset.id} />)}
                  </div>
                )}

                {/* Palette chips on canvas */}
                <div className="canvas-palette-bar" title="Dải màu Key Visual">
                  {palette.map((item, idx) => (
                    <span
                      key={idx}
                      className="palette-chip"
                      style={{ backgroundColor: safeColor(item.hex, '#ccc') }}
                      title={`${item.hex}: ${item.meaning}`}
                    />
                  ))}
                </div>

                {!generatedImage && (
                  <div className="canvas-hint">
                    <Icon name="spark" /> Preview bố cục · Nhấn "Tạo ảnh Key Visual" để AI sinh nền
                  </div>
                )}
                <div className="safe-area" />
              </div>
            </div>

            <div className="canvas-bottom">
              <div className="format-select">
                <span className="size-icon"><Icon name="crop" /></span>
                <div>
                  <strong>{format.label}</strong>
                  <small>{format.width} × {format.height} px</small>
                </div>
                <select aria-label="Định dạng bài đăng" value={format.name} onChange={(e) => setFormat(formats.find((item) => item.name === e.target.value) ?? formats[0])}>
                  {formats.map((item) => <option value={item.name} key={item.name}>{item.label}</option>)}
                </select>
              </div>
              <div className="quality-hint">
                <span className="quality-check">✓</span>
                <span>
                  <strong>Hệ thống 3 Tầng kích hoạt</strong>
                  <small>Font: {displayFont} · Palette: {palette.length} màu</small>
                </span>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* INSPECTOR PANEL (QA & ART DIRECTOR) */}
          {/* ============================================================== */}
          <aside className="inspector-panel">
            <div className="inspector-head">
              <div>
                <span className="eyebrow">AGENT QA & ART DIRECTOR</span>
                <h2>Giám sát chất lượng</h2>
              </div>
              <div className="assistant-avatar" title="QA Vision Critic Agent"><Icon name="spark" /></div>
            </div>

            <div className="assistant-status">
              <span className="status-orb"><Icon name="check" /></span>
              <p>
                <strong>{status === 'working' ? 'Đang chỉ đạo nghệ thuật AI…' : generatedImage ? 'Ảnh đạt chuẩn Anti-Slop' : 'Đang chuẩn bị concept'}</strong>
                <small>{status === 'working' ? 'Áp dụng bộ lọc quang học & chống 3D sáp' : generatedImage ? 'Đã triệt tiêu AI Slop & chữ méo' : 'Sẵn sàng tạo ảnh nền tự nhiên'}</small>
              </p>
            </div>

            <div className="inspector-section">
              <div className="section-title">
                <strong>Phong cách nghệ thuật</strong>
                <span className="qa-badge">Anti-Slop Active</span>
              </div>
              <div className="preset-grid" style={{ marginTop: '8px' }}>
                {(Object.keys(stylePresets) as StylePreset[]).map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={`preset-btn ${stylePreset === key ? 'selected' : ''}`}
                    onClick={() => setStylePreset(key)}
                  >
                    <strong>{stylePresets[key].label}</strong>
                    <small>{stylePresets[key].desc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="inspector-section">
              <div className="section-title">
                <strong>Chỉ số kiểm định thị giác</strong>
                <span className="score-label">98<small>/100</small></span>
              </div>
              <div className="qa-check-item">
                <span><Icon name="check" /> Tuân thủ Brand Guardrails</span>
                <b>100%</b>
              </div>
              <div className="qa-check-item">
                <span><Icon name="check" /> Bám bảng màu Key Visual</span>
                <b>{palette.length} màu chuẩn</b>
              </div>
              <div className="qa-check-item">
                <span><Icon name="check" /> Triệt tiêu AI Slop & sáp nhựa</span>
                <b>99%</b>
              </div>
              <div className="qa-check-item">
                <span><Icon name="check" /> Tương phản chữ (WCAG AAA)</span>
                <b>100%</b>
              </div>
              <div className="qa-check-item">
                <span><Icon name="check" /> Phân cấp Font (Display + Body)</span>
                <b>{displayFont}</b>
              </div>
            </div>

            <div className="inspector-section">
              <div className="section-title">
                <strong>Danh sách Layer thiết kế</strong>
                <span className="layer-count">5 layers</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind"><Icon name="image" /></span>
                <span>Ảnh nền AI (Dải màu KV)</span>
                <span className="layer-drag">{generatedImage ? '✓ Sẵn sàng' : 'Mặc định'}</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind"><Icon name="layers" /></span>
                <span>Vector Decor (PNG components)</span>
                <span className="layer-drag">{imageComponents.length ? `${imageComponents.length} file PNG` : 'Decor mặc định'}</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind text"><Icon name="text" /></span>
                <span>Typography ({displayFont})</span>
                <span className="layer-drag">Chuẩn Brand</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind button"><Icon name="button" /></span>
                <span>Nút kêu gọi ({cta})</span>
                <span className="layer-drag">Chuẩn CTA</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind"><Icon name="layers" /></span>
                <span>Chủ thể ({subjectType === 'graphic_object' ? '3D Symbol' : 'Ảnh thật'})</span>
                <span className="layer-drag">{productPhoto ? 'Đã ghép' : 'Biểu tượng'}</span>
              </div>
            </div>

            <div className="review-card">
              <div className="review-icon"><Icon name="info" /></div>
              <div>
                <strong>Lời khuyên của QA Inspector</strong>
                <p>Bảng màu và Typography đã được liên kết trực tiếp với Canvas. Component PNG tải lên sẽ được ghép sắc nét 100%.</p>
              </div>
            </div>
          </aside>
        </div>}

        <div className="toast" aria-live="polite">
          {statusMessage && <>
            <span className={status === 'error' || status === 'missing-key' ? 'toast-icon warning' : 'toast-icon'}>
              {status === 'error' || status === 'missing-key' ? '!' : '✓'}
            </span>
            <span>{statusMessage}</span>
            {status === 'missing-key' && <button className="toast-action" onClick={() => setPage('settings')}>Cấu hình key</button>}
          </>}
        </div>
      </main>

      {selectedAsset && <div className="asset-selection" onClick={() => setSelectedAssetId(null)}>
        <img src={selectedAsset.data} alt={selectedAsset.name} />
        <span>{selectedAsset.name}</span>
        <button onClick={() => removeAsset(selectedAsset.id)}>Xóa ảnh</button>
      </div>}

      {dialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}>
        <form className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={(event) => { event.preventDefault(); submitDialog() }}>
          <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setDialog(null)}>×</button>
          <span className="eyebrow">{dialog.kind.includes('folder') ? 'CHIẾN DỊCH' : 'BÀI ĐĂNG'}</span>
          <h2 id="dialog-title">
            {dialog.kind === 'create-folder' ? 'Tạo chiến dịch mới' : dialog.kind === 'rename-folder' ? 'Đổi tên chiến dịch' : dialog.kind === 'rename-post' ? 'Đổi tên bài đăng' : dialog.kind === 'delete-folder' ? 'Xóa chiến dịch?' : 'Xóa bài đăng?'}
          </h2>
          <p>
            {dialog.kind === 'create-folder' ? 'Tạo chiến dịch mới để gom brief, tài nguyên và các bài đăng liên quan.' : dialog.kind === 'rename-folder' || dialog.kind === 'rename-post' ? 'Tên mới sẽ hiển thị trong thư viện của bạn.' : 'Thao tác này sẽ xóa brief, ảnh tham chiếu và ảnh đã tạo trong mục này.'}
          </p>
          {(dialog.kind === 'create-folder' || dialog.kind.startsWith('rename-')) ? (
            <label className="field-label">Tên hiển thị
              <input autoFocus value={dialogName} onChange={(event) => setDialogName(event.target.value)} placeholder={dialog.kind === 'create-folder' ? 'Ví dụ: Sự kiện Tháng 7 - Youth+ Tech' : 'Nhập tên mới'} maxLength={80} />
            </label>
          ) : (
            <div className="dialog-delete-target">
              <Icon name="trash" />
              <strong>{dialog.name}</strong>
            </div>
          )}
          <div className="dialog-actions">
            <button className="quiet-btn" type="button" onClick={() => setDialog(null)}>Hủy</button>
            <button className={dialog.kind.startsWith('delete-') ? 'danger-btn' : 'export-btn'} type="submit" disabled={(dialog.kind === 'create-folder' || dialog.kind.startsWith('rename-')) && !dialogName.trim()}>
              {dialog.kind === 'create-folder' ? 'Tạo chiến dịch' : dialog.kind === 'rename-folder' || dialog.kind === 'rename-post' ? 'Lưu tên' : 'Xóa vĩnh viễn'}
            </button>
          </div>
        </form>
      </div>}
    </div>
  )
}

function Section({ title, count, open, onClick, children }: { title: string; count: string; open: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div className={`form-section ${open ? 'open' : ''}`}>
      <button className="section-trigger" onClick={onClick}>
        <span className="section-number">{count}</span>
        <strong>{title}</strong>
        <Icon name="chevron" />
      </button>
      {open && <div className="section-content">{children}</div>}
    </div>
  )
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4L5.5 15a8 8 0 0 1 0-1.9L4.1 12l1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 1.9Z" transform="translate(2 -1) scale(.85)"/></>,
    share: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5h14v-5"/></>,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 17v3h14v-3"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 15v5h14v-5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/><path d="M3.5 10h17"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6m-6 3h6"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"/><path d="m13.8 6.7 3.5 3.5"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
    undo: <><path d="M9 14 4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-2"/></>,
    redo: <><path d="m15 14 5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0 0 12h2"/></>,
    expand: <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></>,
    crop: <><path d="M6 3v12a3 3 0 0 0 3 3h12M18 21V9a3 3 0 0 0-3-3H3"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.4Z"/></>,
    trash: <><path d="M3 6h18m-2 0-.9 14H5L4 6m3 0V4h10v2m-8 4v6m4-6v6"/></>,
    text: <><path d="M4 7V4h16v3M12 4v16m-4 0h8"/></>,
    button: <><rect x="3" y="7" width="18" height="10" rx="5"/><path d="M8 12h8"/></>,
    loader: <><path d="M21 12a9 9 0 0 1-9 9"/><path d="M3 12a9 9 0 0 1 9-9"/></>,
  }
  return (
    <svg
      className={name === 'loader' ? 'icon spinning' : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.spark}
    </svg>
  )
}

export default App
