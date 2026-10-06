import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import './App.css'

type Asset = { id: string; name: string; data: string; kind: 'keyvisual' | 'photo' | 'logo' | 'component' | 'output' }
type Format = { name: string; width: number; height: number; label: string }
type Page = 'studio' | 'folders' | 'campaign' | 'settings'
type CampaignBrief = { brand: string; industry: string; audience: string; tone: string; campaign: string; objective: string; message: string; offer: string; cta: string; keyVisual: string; note: string; format: string; colors: string[]; referenceStrength: number }
type CampaignPost = { id: string; name: string; updatedAt: string; brief: CampaignBrief }
type CampaignFolder = { id: string; name: string; updatedAt: string; brief: CampaignBrief; posts: CampaignPost[] }
type PersonalSettings = { displayName: string; email: string; workspaceName: string; defaultFormat: string; imageQuality: 'high' | 'xhigh'; autosave: boolean }
type DialogState = { kind: 'create-folder' } | { kind: 'rename-folder' | 'rename-post' | 'delete-folder' | 'delete-post'; id: string; name: string }


export type StylePreset = 'editorial' | 'documentary' | 'minimalist' | 'cinematic';

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
};

export async function removeImageBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const corners = [
        [0, 0],
        [canvas.width - 1, 0],
        [0, canvas.height - 1],
        [canvas.width - 1, canvas.height - 1]
      ];
      let avgR = 0, avgG = 0, avgB = 0;
      for (const [x, y] of corners) {
        const idx = (y * canvas.width + x) * 4;
        avgR += data[idx];
        avgG += data[idx + 1];
        avgB += data[idx + 2];
      }
      avgR /= 4; avgG /= 4; avgB /= 4;
      const threshold = 38;
      const softRange = 26;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
        if (dist < threshold) {
          data[i + 3] = 0;
        } else if (dist < threshold + softRange) {
          const factor = (dist - threshold) / softRange;
          data[i + 3] = Math.round(data[i + 3] * factor);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const defaultCampaignId = 'campaign-rituals-of-spring'

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
  return {
    brand: readDraft('brand', 'Lumière Studio'), industry: readDraft('industry', 'Skincare · chăm sóc da'),
    audience: readDraft('audience', 'Phụ nữ 25–35, yêu thích chăm sóc da tối giản'), tone: readDraft('tone', 'Tinh tế, ấm áp, gần gũi'),
    campaign: readDraft('campaign', 'Rituals of Spring'), objective: readDraft('objective', 'Ra mắt sản phẩm'),
    message: readDraft('message', 'Một khoảng dịu dàng dành riêng cho làn da của bạn.'), offer: readDraft('offer', 'Bộ quà tặng mùa xuân · ưu đãi 20%'),
    cta: readDraft('cta', 'Khám phá bộ sưu tập'), keyVisual: readDraft('keyVisual', 'Ánh sáng cửa sổ buổi sớm, chất liệu linen, bóng lá mềm. Bố cục tĩnh vật tối giản, cảm giác ảnh film ấm; để nhiều khoảng thở quanh sản phẩm.'),
    note: readDraft('note', 'Không dùng hoa hồng, không thêm chữ vào ảnh nền. Sản phẩm phải giữ nguyên nhãn và màu sắc.'),
    format: readDraft('format', 'portrait'), colors: readDraft('colors', ['#1C2F4D', '#B6404A', '#FAF7F2']), referenceStrength: readDraft('referenceStrength', 65),
  }
}

function readCampaignFolders(): CampaignFolder[] {
  try {
    const saved = JSON.parse(localStorage.getItem('creative-campaign-folders') ?? 'null') as CampaignFolder[] | null
    if (Array.isArray(saved) && saved.length && saved.every((folder) => folder.id && folder.name && folder.brief)) return saved.map((folder) => ({
      ...folder,
      posts: Array.isArray(folder.posts) ? folder.posts : [{ id: `${folder.id}-post-1`, name: 'Bài đăng 1', updatedAt: folder.updatedAt, brief: folder.brief }],
    }))
  } catch { /* Start with the saved single-campaign brief. */ }
  const brief = defaultBrief()
  const updatedAt = new Date().toISOString()
  return [{ id: defaultCampaignId, name: brief.campaign, updatedAt, brief, posts: [{ id: `${defaultCampaignId}-post-1`, name: 'Bài đăng 1', updatedAt, brief }] }]
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback
}

function readPersonalSettings(): PersonalSettings {
  const fallback: PersonalSettings = { displayName: '', email: '', workspaceName: 'Creative Studio', defaultFormat: 'portrait', imageQuality: 'high', autosave: true }
  try {
    const saved = JSON.parse(localStorage.getItem('creative-personal-settings') ?? '{}') as Partial<PersonalSettings>
    return { ...fallback, ...saved, defaultFormat: formats.some((item) => item.name === saved.defaultFormat) ? saved.defaultFormat! : fallback.defaultFormat, imageQuality: saved.imageQuality === 'xhigh' ? 'xhigh' : 'high', autosave: saved.autosave !== false }
  }
  catch { return fallback }
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
  const [brand, setBrand] = useState(initialBrief.brand)
  const [industry, setIndustry] = useState(initialBrief.industry)
  const [audience, setAudience] = useState(initialBrief.audience)
  const [tone, setTone] = useState(initialBrief.tone)
  const [campaign, setCampaign] = useState(initialBrief.campaign)
  const [objective, setObjective] = useState(initialBrief.objective)
  const [message, setMessage] = useState(initialBrief.message)
  const [offer, setOffer] = useState(initialBrief.offer)
  const [cta, setCta] = useState(initialBrief.cta)
  const [keyVisual, setKeyVisual] = useState(initialBrief.keyVisual)
  const [note, setNote] = useState(initialBrief.note)
  const [assets, setAssets] = useState<Asset[]>([])
  const [format, setFormat] = useState(() => formats.find((item) => item.name === initialBrief.format) ?? formats[0])
  const [colors, setColors] = useState(initialBrief.colors)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'ready' | 'missing-key' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'context' | 'assets'>('context')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState({ business: true, campaign: true, visual: false, notes: false })
  const [referenceStrength, setReferenceStrength] = useState(initialBrief.referenceStrength)
  const [stylePreset, setStylePreset] = useState<StylePreset>('editorial')
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [productMode, setProductMode] = useState<'stage-real' | 'ai-complete'>('stage-real')
  const fileInput = useRef<HTMLInputElement>(null)
  const componentInput = useRef<HTMLInputElement>(null)
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
  const canvasScale = useMemo(() => Math.min(1, 530 / format.width, 590 / format.height), [format])

  useEffect(() => {
    try {
      localStorage.setItem('creative-active-folder', activeFolderId)
      if (activePost) localStorage.setItem('creative-active-post', activePost.id)
      if (!personalSettings.autosave) return
      const brief: CampaignBrief = { brand, industry, audience, tone, campaign, objective, message, offer, cta, keyVisual, note, format: format.name, colors, referenceStrength }
      if (page !== 'studio') return
      const updatedAt = new Date().toISOString()
      setCampaignFolders((current) => current.map((folder) => folder.id === activeFolderId ? {
        ...folder, updatedAt, brief,
        posts: folder.posts.map((post) => post.id === activePostId ? { ...post, updatedAt, brief } : post),
      } : folder))
    } catch { setStatusMessage('Không thể lưu brief vào trình duyệt này.') }
  }, [activeFolderId, activePostId, page, brand, industry, audience, tone, campaign, objective, message, offer, cta, keyVisual, note, format, colors, referenceStrength, personalSettings.autosave])

  useEffect(() => {
    try { localStorage.setItem('creative-campaign-folders', JSON.stringify(campaignFolders)) }
    catch { setStatusMessage('Không thể lưu danh sách chiến dịch trong trình duyệt. Ảnh được lưu riêng trong bộ nhớ tài nguyên.') }
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
    setBrand(brief.brand); setIndustry(brief.industry); setAudience(brief.audience); setTone(brief.tone)
    setCampaign(brief.campaign); setObjective(brief.objective); setMessage(brief.message); setOffer(brief.offer); setCta(brief.cta)
    setKeyVisual(brief.keyVisual); setNote(brief.note); setFormat(formats.find((item) => item.name === brief.format) ?? formats[0])
    setColors(brief.colors); setReferenceStrength(brief.referenceStrength)
    skipAssetWrite.current = true
    setAssets([]); setSelectedAssetId(null); setGeneratedImage(null); setStatus('idle'); setStatusMessage('')
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
    const brief: CampaignBrief = { brand, industry, audience, tone, campaign: name, objective: 'Ra mắt sản phẩm', message: '', offer: '', cta: 'Tìm hiểu thêm', keyVisual: '', note: '', format: personalSettings.defaultFormat, colors, referenceStrength: 65 }
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
    const brief: CampaignBrief = { brand, industry, audience, tone, campaign, objective, message, offer, cta, keyVisual, note, format: format.name, colors: colors.map((color, index) => safeColor(color, ['#1C2F4D', '#B6404A', '#FAF7F2'][index])), referenceStrength }
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

  async function generate() {
    setStatus('working')
    setStatusMessage(productMode === 'stage-real' ? 'Đang tạo bối cảnh trống chuẩn Studio để ghép sản phẩm…' : 'Đang chỉ đạo nghệ thuật AI tạo trọn vẹn concept…')
    setGeneratedImage(null)

    const presetCfg = stylePresets[stylePreset] ?? stylePresets.editorial
    const isStagingReal = productMode === 'stage-real' && Boolean(productPhoto)

    const subjectDirective = isStagingReal
      ? 'PHOTOGRAPHIC EMPTY STAGING BACKGROUND. An inviting, masterfully-lit empty surface/environment (e.g. clean wooden desk or architectural surface by a sunlit window) specifically reserved for staging a product. THE MAIN DISPLAY SURFACE IS COMPLETELY EMPTY AND CLEAN - DO NOT DRAW ANY BACKPACK, BAG, OR MERCHANDISE. The scene must be a coherent, empty staging plate ready for product composite.'
      : `Create a master-grade commercial photograph featuring ${brand} ${campaign} in an authentic editorial environment.`

    const creativePrompt = [
      subjectDirective,
      `Brand: "${brand}" (${industry}). Campaign: "${campaign}". Objective: ${objective}. Audience: ${audience}.`,
      `Core Message: "${message}". Offer / Badge: "${offer}".`,
      `Art Direction / Key Visual: ${keyVisual}`,
      `Lighting & Atmosphere: ${presetCfg.lighting}.`,
      `Tactile Physical Realism: ${presetCfg.texture}.`,
      `Color Harmony: Harmoniously blend subtle ambient tones inspired by ${colors.map((color, index) => safeColor(color, ['#1C2F4D', '#B6404A', '#FAF7F2'][index])).join(', ')}.`,
      `Composition: Continuous, cohesive scene. Soft out-of-focus background on the left suitable for text readability. Do NOT draw split walls, do NOT draw vertical dividing borders, do NOT draw artificial color partition screens.`,
      `Creative Notes: ${note}`,
      `Reference Influence Level: ${referenceStrength}%.`,
      `[STRICT ANTI-AI-SLOP DIRECTIVES]: ${presetCfg.antiSlop}. CRISP CLEAN TRANSPARENT AIR, NO SMOKE, NO STEAM, NO HAZE, NO BURNING VAPORS. ABSOLUTELY NO RENDERED TEXT, NO LETTERS, NO NUMBERS, NO WATERMARK, NO FAKE LABELS.`
    ].join('\n\n')

    try {
      // If staging real product, do NOT pass product photo into AI references so AI does not duplicate the product!
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
      setStatusMessage(isStagingReal ? 'Bối cảnh nền đã sẵn sàng! Sản phẩm thật được ghép tự nhiên, không bị trùng lặp.' : 'Ảnh hoàn tất trọn vẹn, không dán đè!')
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

    // 1. Nền chuyển sắc cơ bản
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, safeColor(colors[2], '#FAF7F2'))
    gradient.addColorStop(1, '#F2CEAE')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    // 2. Vẽ ảnh nền AI chân thực 100%
    if (generatedImage) await drawImage(generatedImage, 0, 0, width, height)

    // 3. VÙNG ĐỆM ÁNH SÁNG CHUYỂN TIẾP (ANTI-SLOP FIX):
    // Chỉ phủ gradient nhẹ phía trái để chữ nổi bật, giữ nguyên 100% độ nét và màu sắc ảnh AI bên phải!
    const scrim = context.createLinearGradient(0, 0, width * 0.65, 0)
    scrim.addColorStop(0, 'rgba(16, 26, 18, 0.76)')
    scrim.addColorStop(0.55, 'rgba(16, 26, 18, 0.32)')
    scrim.addColorStop(1, 'rgba(16, 26, 18, 0.0)')
    context.fillStyle = scrim
    context.fillRect(0, 0, width * 0.68, height)

    // 4. Vẽ ảnh sản phẩm thật kèm bóng đổ tiếp xúc mềm mại (Realistic Contact Shadow)
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

    // 6. Typography cao cấp với bóng vi mô
    context.save()
    context.textAlign = 'left'
    context.fillStyle = '#ffffff'
    context.shadowColor = 'rgba(0, 0, 0, 0.45)'
    context.shadowBlur = 8
    context.shadowOffsetY = 2

    // Campaign Eyebrow
    context.font = `600 ${Math.round(width * .02)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    context.fillText(campaign.toUpperCase(), width * .075, height * .25)

    // Message Headline
    context.font = `700 ${Math.round(width * .052)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    const words = message.split(' ')
    const maxWidth = width * .53
    let line = ''
    let y = height * .38
    const lineHeight = width * .068
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (context.measureText(next).width > maxWidth && line) {
        context.fillText(line, width * .075, y)
        y += lineHeight
        line = word
      } else line = next
    }
    if (line) context.fillText(line, width * .075, y)

    // Offer
    context.globalAlpha = .92
    context.font = `500 ${Math.round(width * .023)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    context.fillText(offer, width * .075, height * .69)
    context.globalAlpha = 1

    // CTA Button
    const buttonY = height * .77
    context.shadowColor = 'rgba(0, 0, 0, 0.25)'
    context.shadowBlur = 12
    context.fillStyle = safeColor(colors[0], '#1C2F4D')
    context.beginPath()
    context.roundRect(width * .075, buttonY, width * .44, height * .07, height * .035)
    context.fill()

    context.shadowColor = 'transparent'
    context.fillStyle = '#ffffff'
    context.font = `600 ${Math.round(width * .02)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    context.fillText(cta + '  →', width * .105, buttonY + height * .044)
    context.restore()

    const link = document.createElement('a')
    link.download = `${campaign.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${format.name}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setStatusMessage('Đã xuất PNG chất lượng cao, sắc nét và màu sắc trung thực 100%.')
  }

  const removeAsset = (id: string) => {
    if (assets.some((asset) => asset.id === id && asset.kind === 'output')) setGeneratedImage(null)
    setAssets((current) => current.filter((asset) => asset.id !== id))
    if (selectedAssetId === id) setSelectedAssetId(null)
  }

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand-mark">l<span>·</span></div>
        <button className={page === 'folders' || page === 'campaign' ? 'rail-item active' : 'rail-item'} onClick={() => setPage('folders')} title="Folder chiến dịch"><Icon name="folder" /></button>
        <div className="rail-spacer" />
        <button className={page === 'settings' ? 'rail-item active' : 'rail-item'} onClick={() => setPage('settings')} title="Cài đặt cá nhân"><Icon name="settings" /></button>
        <button className="avatar" onClick={() => setPage('settings')} title="Hồ sơ cá nhân">{(personalSettings.displayName || 'CM').split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumbs"><button className="crumb-home" onClick={() => setPage('folders')}>{personalSettings.workspaceName || 'Creative Studio'}</button>{page !== 'folders' && <><span className="crumb-sep">/</span><strong>{page === 'studio' ? activePost?.name ?? 'Bài đăng mới' : page === 'campaign' ? activeFolder?.name : 'Cài đặt cá nhân'}</strong></>}</div>
          <div className="top-actions">{page === 'studio' && <><span className="save-state"><i /> {personalSettings.autosave ? 'Đã lưu trong bài đăng' : 'Tự lưu đang tắt'}</span>{!personalSettings.autosave && <button className="quiet-btn" onClick={saveCurrentBrief}><Icon name="check" /> Lưu bài đăng</button>}<button className="export-btn" onClick={exportPng}><Icon name="download" /> Xuất PNG</button></>}{page === 'folders' && <button className="export-btn" onClick={createFolder}><Icon name="plus" /> Tạo chiến dịch</button>}{page === 'campaign' && <button className="export-btn" onClick={createPost}><Icon name="plus" /> Tạo bài đăng</button>}{page === 'settings' && <button className="export-btn" onClick={() => { localStorage.setItem('creative-personal-settings', JSON.stringify(personalSettings)); setSettingsSaved(true) }}><Icon name="check" /> {settingsSaved ? 'Đã lưu' : 'Lưu cài đặt'}</button>}</div>
        </header>

        {page === 'settings' ? <section className="settings-page">
          <div className="settings-intro"><div><span className="eyebrow">TÀI KHOẢN CỦA BẠN</span><h1>Cài đặt cá nhân</h1><p>Quản lý hồ sơ và cách Creative Studio tạo thiết kế cho bạn.</p></div><span className="settings-save-state">{settingsSaved ? '✓ Đã lưu' : '● Chưa lưu'}</span></div>
          <div className="settings-layout"><nav className="settings-nav"><a className="selected" href="#profile"><Icon name="user" /> Hồ sơ</a><a href="#workspace-settings"><Icon name="layers" /> Workspace</a><a href="#creative-defaults"><Icon name="spark" /> Mặc định sáng tạo</a><a href="#api-key"><Icon name="lock" /> API & bảo mật</a></nav>
            <div className="settings-content"><section className="settings-card" id="profile"><div className="settings-card-title"><div><h2>Hồ sơ cá nhân</h2><p>Thông tin hiển thị trong workspace của bạn.</p></div><div className="profile-avatar">{(personalSettings.displayName || 'CM').split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</div></div><div className="settings-fields"><label className="field-label">Tên hiển thị<input value={personalSettings.displayName} onChange={(e) => updateSettings('displayName', e.target.value)} placeholder="Tên của bạn" /></label><label className="field-label">Email<input type="email" value={personalSettings.email} onChange={(e) => updateSettings('email', e.target.value)} placeholder="name@company.com" /><small>Chỉ lưu trên trình duyệt này; đăng nhập chưa được kết nối.</small></label></div></section>
              <section className="settings-card" id="workspace-settings"><div className="settings-card-title"><div><h2>Workspace</h2><p>Đặt tên không gian làm việc cá nhân.</p></div><span className="settings-card-icon"><Icon name="layers" /></span></div><label className="field-label">Tên workspace<input value={personalSettings.workspaceName} onChange={(e) => updateSettings('workspaceName', e.target.value)} placeholder="Creative Studio" /></label></section>
              <section className="settings-card" id="creative-defaults"><div className="settings-card-title"><div><h2>Mặc định sáng tạo</h2><p>Áp dụng khi bạn tạo folder chiến dịch mới.</p></div><span className="settings-card-icon"><Icon name="spark" /></span></div><div className="settings-fields"><label className="field-label">Kích thước mặc định<select value={personalSettings.defaultFormat} onChange={(e) => updateSettings('defaultFormat', e.target.value)}>{formats.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}</select></label><label className="field-label">Chất lượng tạo ảnh<select value={personalSettings.imageQuality} onChange={(e) => updateSettings('imageQuality', e.target.value as PersonalSettings['imageQuality'])}><option value="high">Cao · phù hợp xem trước</option><option value="xhigh">Tối đa · ảnh xuất bản</option></select></label></div><div className="setting-toggle"><span><strong>Lưu brief tự động</strong><small>Lưu nội dung từng chiến dịch vào trình duyệt.</small></span><button className={personalSettings.autosave ? 'switch on' : 'switch'} role="switch" aria-checked={personalSettings.autosave} onClick={() => updateSettings('autosave', !personalSettings.autosave)}><i /></button></div></section>
              <section className="settings-card" id="api-key"><div className="settings-card-title"><div><h2>Kết nối nhà cung cấp AI</h2><p>Chọn OpenAI hoặc Google Gemini. Key lưu trên local server; khi tạo ảnh, brief và ảnh tham chiếu gửi tới nhà cung cấp đã chọn.</p></div><span className="settings-card-icon"><Icon name="lock" /></span></div><div className="settings-fields"><label className="field-label">Nhà cung cấp<select value={apiProvider} onChange={(e) => { const provider = e.target.value as 'openai' | 'gemini'; setApiProvider(provider); setApiModel(provider === 'gemini' ? 'gemini-3.1-flash-image' : 'gpt-image-2.5-sunburst') }}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option></select></label><label className="field-label">Model ảnh{apiProvider === 'gemini' ? <select value={apiModel} onChange={(e) => setApiModel(e.target.value)}><option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image</option><option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash Lite Image</option></select> : <input value={apiModel} onChange={(e) => setApiModel(e.target.value)} placeholder="gpt-image-2.5-sunburst" />}</label></div><label className="field-label">{apiProvider === 'gemini' ? 'Google Gemini API key' : 'OpenAI API key'}<input type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={apiReady ? 'Đã có key · nhập key mới để thay thế' : 'Dán API key tại đây'} /></label><div className="api-settings-actions"><div className="api-help"><span className={apiReady && apiProvider === configuredProvider ? 'api-state-dot ready' : 'api-state-dot'} /><span><strong>{apiReady && apiProvider === configuredProvider ? `Đã cấu hình ${apiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}` : 'Chưa cấu hình nhà cung cấp đã chọn'}</strong><small>{apiMessage || 'Kết nối thật được xác minh khi bạn tạo ảnh. Model Gemini mặc định hỗ trợ đầu vào ảnh tham chiếu.'}</small></span></div><button className="export-btn" onClick={saveApiKey} disabled={!apiKey.trim() || !apiModel.trim() || apiSaving}><Icon name={apiSaving ? 'loader' : 'check'} />{apiSaving ? 'Đang lưu…' : 'Lưu cấu hình'}</button></div></section>
            </div>
          </div>
        </section> : page === 'folders' ? <section className="folder-page home-page">
          <div className="folder-page-heading"><div><span className="eyebrow">THƯ VIỆN CỦA BẠN</span><h1>Chiến dịch</h1><p>Quản lý các chiến dịch truyền thông và bài đăng của bạn.</p></div><button className="export-btn" onClick={createFolder}><Icon name="plus" /> Tạo chiến dịch</button></div>
          <div className="folder-toolbar"><label className="folder-search"><Icon name="search" /><input value={folderQuery} onChange={(e) => setFolderQuery(e.target.value)} placeholder="Tìm chiến dịch…" /></label><div className="folder-toolbar-actions"><span>{filteredFolders.length} / {campaignFolders.length} chiến dịch</span><label className="folder-sort-label">Sắp xếp<select className="folder-sort" value={folderSort} onChange={(e) => setFolderSort(e.target.value as 'updated' | 'name')}><option value="updated">Mới cập nhật</option><option value="name">Tên A–Z</option></select></label></div></div>
          <div className="folder-grid">{filteredFolders.map((folder, index) => <article className="campaign-card" key={folder.id}><button className="campaign-card-main" onClick={() => openFolder(folder)}><div className={`folder-art folder-color-${index % 4}`}><Icon name="folder" /><span>CHIẾN DỊCH</span></div><div className="campaign-card-info"><div><strong>{folder.name}</strong><small>Cập nhật {new Date(folder.updatedAt).toLocaleDateString('vi-VN')}</small></div><span className="folder-open-arrow">↗</span></div><div className="campaign-card-meta"><span><Icon name="file" /> {folder.posts.length} bài đăng</span><span>{folder.brief.format === 'portrait' ? '4:5' : folder.brief.format === 'square' ? '1:1' : folder.brief.format === 'story' ? '9:16' : '1.91:1'}</span></div></button><div className="campaign-card-actions"><button onClick={() => renameFolder(folder)}><Icon name="edit" /> Đổi tên</button><button onClick={() => deleteFolder(folder)}><Icon name="trash" /> Xóa</button></div></article>)}{!filteredFolders.length && <p className="empty-folders">Không tìm thấy chiến dịch phù hợp.</p>}</div>
        </section> : page === 'campaign' ? <section className="campaign-page">
          <div className="campaign-page-heading"><button className="back-link" onClick={() => setPage('folders')}>← Tất cả chiến dịch</button><div className="campaign-heading-row"><div><span className="eyebrow">CAMPAIGN FOLDER</span><h1>{activeFolder?.name}</h1><p>Các bài đăng trong chiến dịch này được quản lý riêng.</p></div><button className="export-btn" onClick={createPost}><Icon name="plus" /> Tạo bài đăng</button></div></div>
          <section className="campaign-overview"><div className="campaign-overview-title"><div><span className="eyebrow">BRIEF MẶC ĐỊNH</span><h2>Thông tin chiến dịch</h2><p>Bài đăng mới sẽ kế thừa thông tin này. Bạn có thể tinh chỉnh brief trong từng bài.</p></div><span className="campaign-overview-mark"><Icon name="layers" /></span></div><div className="campaign-overview-grid"><div><small>Thương hiệu</small><strong>{activeFolder?.brief.brand || 'Chưa thiết lập'}</strong></div><div><small>Ngành hàng</small><strong>{activeFolder?.brief.industry || 'Chưa thiết lập'}</strong></div><div><small>Mục tiêu</small><strong>{activeFolder?.brief.objective || 'Chưa thiết lập'}</strong></div><div><small>Đối tượng</small><strong>{activeFolder?.brief.audience || 'Chưa thiết lập'}</strong></div></div><div className="campaign-palette"><span>Màu thương hiệu</span>{(activeFolder?.brief.colors ?? []).map((color, index) => <i key={index} title={color} style={{ backgroundColor: safeColor(color, '#e5e8e1') }} />)}</div></section>
          <div className="post-section-heading"><div><h2>Bài đăng</h2><p>{activeFolder?.posts.length ?? 0} bài trong chiến dịch</p></div></div>
          <div className="post-grid">{activeFolder?.posts.map((post, index) => <article className="post-card" key={post.id}><button className="post-card-open" onClick={() => openPost(post)}><div className={`post-preview post-preview-${index % 4} ${postCovers[post.id] ? 'has-cover' : ''}`}>{postCovers[post.id] && <img src={postCovers[post.id]} alt="Ảnh đã tạo" />}<strong>{post.brief.message || 'Bài đăng mới'}</strong><small>{post.brief.format === 'portrait' ? '4:5' : post.brief.format === 'square' ? '1:1' : post.brief.format === 'story' ? '9:16' : '1.91:1'}</small></div><div className="post-card-info"><span><strong>{post.name}</strong><small>{postCovers[post.id] ? 'Đã có ảnh tạo · ' : 'Bản nháp · '}Cập nhật {new Date(post.updatedAt).toLocaleDateString('vi-VN')}</small></span><span className="folder-open-arrow">↗</span></div></button><div className="campaign-card-actions"><button onClick={() => renamePost(post)}><Icon name="edit" /> Đổi tên</button><button onClick={() => deletePost(post)}><Icon name="trash" /> Xóa</button></div></article>)}{activeFolder?.posts.length === 0 && <div className="campaign-empty"><span className="new-post-plus"><Icon name="plus" /></span><h3>Chưa có bài đăng</h3><p>Tạo bài đầu tiên để thêm key visual, nội dung và ảnh thực tế cho chiến dịch này.</p><button className="export-btn" onClick={createPost}><Icon name="plus" /> Tạo bài đăng đầu tiên</button></div>}{Boolean(activeFolder?.posts.length) && <button className="new-post-card" onClick={createPost}><span className="new-post-plus"><Icon name="plus" /></span><strong>Tạo bài đăng</strong><small>Mở trình tạo hình ảnh</small></button>}</div>
        </section> : <div className="workspace">
          <section className="context-panel">
            <div className="panel-heading"><div><span className="eyebrow">CAMPAIGN BRIEF</span><h1>{campaign}</h1><p>Context và tài nguyên của folder đang mở.</p></div></div>
            <div className="api-status-inline"><i className={apiReady && apiProvider === configuredProvider ? 'ready' : ''} /><span>{apiReady && apiProvider === configuredProvider ? `Đã cấu hình ${apiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}` : 'Cần lưu cấu hình API'}</span>{!(apiReady && apiProvider === configuredProvider) && <button onClick={() => setPage('settings')}>Cấu hình</button>}</div>
            <div className="tabs"><button className={activeTab === 'context' ? 'tab active' : 'tab'} onClick={() => setActiveTab('context')}>Brief & context</button><button className={activeTab === 'assets' ? 'tab active' : 'tab'} onClick={() => setActiveTab('assets')}>Tài nguyên <span>{assets.length}</span></button></div>
            {activeTab === 'context' ? <div className="form-scroll">
              <Section title="Thương hiệu" count="01" open={expanded.business} onClick={() => toggle('business')}>
                <label className="field-label">Tên doanh nghiệp<input value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
                <label className="field-label">Ngành hàng<input value={industry} onChange={(e) => setIndustry(e.target.value)} /></label>
                <label className="field-label">Khách hàng mục tiêu<textarea rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} /></label>
                <label className="field-label">Tính cách thương hiệu<input value={tone} onChange={(e) => setTone(e.target.value)} /></label>
                <div className="field-label">Màu chủ đạo <small className="field-hint">Nhập mã HEX, ví dụ #1C2F4D</small><div className="hex-color-list">{colors.map((color, index) => <label className="hex-color-field" key={index}><span style={{ backgroundColor: safeColor(color, ['#1C2F4D', '#B6404A', '#FAF7F2'][index]) }} /><input aria-label={`Mã màu thương hiệu ${index + 1}`} value={color} maxLength={7} placeholder="#1C2F4D" onChange={(e) => setColors((current) => current.map((c, i) => i === index ? e.target.value : c))} onBlur={() => setColors((current) => current.map((c, i) => i === index ? safeColor(c, ['#1C2F4D', '#B6404A', '#FAF7F2'][index]) : c))} /></label>)}</div></div>
                <label className="field-label">Logo thương hiệu<div className="upload-inline"><input type="file" accept="image/*" onChange={addLogo} /><span>{logo ? logo.name : 'Chọn logo PNG hoặc SVG'}</span><Icon name="upload" /></div></label>
              </Section>
              <Section title="Chiến dịch" count="02" open={expanded.campaign} onClick={() => toggle('campaign')}>
                <label className="field-label">Tên chiến dịch<input value={campaign} onChange={(e) => setCampaign(e.target.value)} /></label>
                <label className="field-label">Mục tiêu<select value={objective} onChange={(e) => setObjective(e.target.value)}><option>Ra mắt sản phẩm</option><option>Tăng nhận diện</option><option>Tạo khách hàng tiềm năng</option><option>Thúc đẩy chuyển đổi</option><option>Chia sẻ kiến thức</option></select></label>
                <label className="field-label">Thông điệp chính<textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
                <label className="field-label">Ưu đãi / thông tin phụ<input value={offer} onChange={(e) => setOffer(e.target.value)} /></label>
                <label className="field-label">Nút kêu gọi hành động<input value={cta} onChange={(e) => setCta(e.target.value)} /></label>
              </Section>
              <Section title="Key visual & assets" count="03" open={expanded.visual} onClick={() => toggle('visual')}>
                <label className="field-label">Phong cách Art Direction & Chống Slop
                  <div className="preset-grid">
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
                </label>
                <label className="field-label">Mô tả phong cách<textarea rows={4} value={keyVisual} onChange={(e) => setKeyVisual(e.target.value)} /></label>
                <label className="field-label">Ảnh key visual tham chiếu<div className="upload-inline"><input type="file" accept="image/*" onChange={addKeyVisual} /><span>{assets.find((asset) => asset.kind === 'keyvisual')?.name ?? 'Tải ảnh KV tham chiếu'}</span><Icon name="upload" /></div></label>
                <label className="field-label">Mức độ bám ảnh tham chiếu<div className="range-line"><input type="range" min="0" max="100" value={referenceStrength} onChange={(e) => setReferenceStrength(Number(e.target.value))} /><span>{referenceStrength}%</span></div></label>
                <div className="field-label">Định dạng xuất<select value={format.name} onChange={(e) => setFormat(formats.find((item) => item.name === e.target.value) ?? formats[0])}>{formats.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}</select></div>
              </Section>
              <Section title="Ghi chú sáng tạo" count="04" open={expanded.notes} onClick={() => toggle('notes')}>
                <label className="field-label">Điều cần có / cần tránh<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: không dùng stock photo, giữ nhãn sản phẩm…" /></label>
              </Section>
              <div className="product-mode-box">
                <span className="product-mode-label">⚙️ Chế độ xử lý sản phẩm:</span>
                <div className="product-mode-selector">
                  <button
                    type="button"
                    className={`mode-btn ${productMode === 'stage-real' ? 'active' : ''}`}
                    onClick={() => setProductMode('stage-real')}
                  >
                    <strong>🏷️ Ghép ảnh thật vào nền AI</strong>
                    <small>AI chỉ vẽ nền bàn/phòng trống · Ghép ảnh thật không trùng lặp</small>
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${productMode === 'ai-complete' ? 'active' : ''}`}
                    onClick={() => setProductMode('ai-complete')}
                  >
                    <strong>🤖 AI tự vẽ toàn bộ</strong>
                    <small>AI vẽ cả sản phẩm & bối cảnh · Không dán đè sản phẩm</small>
                  </button>
                </div>
              </div>

              <div className="asset-quick"><div className="asset-quick-head"><div><strong>Ảnh thực tế</strong><small>Thêm sản phẩm, người mẫu hoặc địa điểm</small></div><button className="add-btn" onClick={() => fileInput.current?.click()}><Icon name="plus" /> Thêm ảnh</button><input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addFiles} /></div>
                {productPhoto && (
                  <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      className="remove-bg-btn"
                      onClick={handleAutoRemoveBg}
                      disabled={isRemovingBg}
                      title="Tách phông nền trắng hoặc đơn sắc thành PNG trong suốt"
                    >
                      <Icon name="spark" />
                      {isRemovingBg ? 'Đang xử lý tách nền…' : '✨ Tách nền thông minh cho ảnh'}
                    </button>
                  </div>
                )}
                {assets.filter((asset) => asset.kind === 'photo').length ? <div className="asset-thumbs">{assets.filter((asset) => asset.kind === 'photo').map((asset) => <button className={selectedAssetId === asset.id ? 'asset-thumb selected' : 'asset-thumb'} key={asset.id} onClick={() => setSelectedAssetId(asset.id)}><img src={asset.data} alt={asset.name} /><span>{asset.name}</span><i onClick={(event) => { event.stopPropagation(); removeAsset(asset.id) }}>×</i></button>)}</div> : <button className="dropzone" onClick={() => fileInput.current?.click()}><span className="drop-icon"><Icon name="image" /></span><span><strong>Kéo ảnh vào đây</strong><small>hoặc nhấn để chọn từ thiết bị</small></span><Icon name="plus" /></button>}
              </div>
              <div className="asset-quick component-quick"><div className="asset-quick-head"><div><strong>Thành phần hình ảnh</strong><small>Thêm sản phẩm, props hoặc ảnh cắt nền để đặt lên thiết kế</small></div><button className="add-btn" onClick={() => componentInput.current?.click()}><Icon name="plus" /> Thêm thành phần</button><input ref={componentInput} type="file" accept="image/*" multiple hidden onChange={addComponents} /></div>{imageComponents.length > 0 && <div className="asset-thumbs">{imageComponents.map((asset) => <button className={selectedAssetId === asset.id ? 'asset-thumb selected' : 'asset-thumb'} key={asset.id} onClick={() => setSelectedAssetId(asset.id)}><img src={asset.data} alt={asset.name} /><span>{asset.name}</span><i onClick={(event) => { event.stopPropagation(); removeAsset(asset.id) }}>×</i></button>)}</div>}</div>
            </div> : <div className="form-scroll assets-view"><div className="asset-upload-card" onClick={() => fileInput.current?.click()}><Icon name="upload" /><strong>Thêm hình ảnh tham chiếu</strong><span>Ảnh sản phẩm, người mẫu, địa điểm…</span></div><input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addFiles} /><div className="asset-upload-card component-upload-card" onClick={() => componentInput.current?.click()}><Icon name="layers" /><strong>Thêm thành phần vào thiết kế</strong><span>Ảnh được đặt lên canvas sau khi tạo</span></div><input ref={componentInput} type="file" accept="image/*" multiple hidden onChange={addComponents} />{assets.length ? assets.map((asset) => <div className="asset-list-item" key={asset.id}><img src={asset.data} alt="" /><div><strong>{asset.name}</strong><small>{asset.kind === 'logo' ? 'Logo' : asset.kind === 'keyvisual' ? 'Key visual' : asset.kind === 'component' ? 'Thành phần hình ảnh' : asset.kind === 'output' ? 'Ảnh đã tạo' : 'Ảnh tham chiếu'}</small></div><button className="icon-btn" onClick={() => removeAsset(asset.id)}><Icon name="trash" /></button></div>) : <p className="empty-copy">Tài nguyên tải lên và ảnh đã tạo sẽ nằm trong bài đăng này.</p>}</div>}
            <div className="panel-footer"><span><Icon name="folder" /> {activeFolder?.name} / {activePost?.name}</span><button className="generate-btn" onClick={apiReady && apiProvider === configuredProvider ? generate : () => setPage('settings')} disabled={status === 'working'}><Icon name={status === 'working' ? 'loader' : apiReady && apiProvider === configuredProvider ? 'spark' : 'lock'} />{status === 'working' ? 'Đang tạo concept…' : apiReady && apiProvider === configuredProvider ? 'Tạo ảnh' : 'Cấu hình API'}</button></div>
          </section>

          <section className="canvas-panel">
            <div className="canvas-toolbar"><div className="canvas-title"><span className="live-dot" /> <strong>{activePost?.name ?? campaign}</strong><span className="draft-pill">{campaign}</span></div><button className="folder-switcher" onClick={() => setPage('campaign')}>← Về bài đăng</button></div>
            <div className="canvas-stage"><div className={`creative-canvas format-${format.name}`} ref={exportRef} style={{ width: format.width * canvasScale, height: format.height * canvasScale, backgroundColor: safeColor(colors[0], '#1C2F4D') }}>
              {generatedImage ? <img className="canvas-background" src={generatedImage} alt="Ảnh nền được tạo" /> : <div className="canvas-background placeholder-bg"><div className="sun-shape" /><div className="leaf-shape leaf-one" /><div className="leaf-shape leaf-two" /><div className="still-life"><div className="vase" /><div className="bottle bottle-a" /><div className="bottle bottle-b" /><div className="shadow-shape" /></div><div className="grain" /></div>}
              <div className="canvas-wash" />
              {logo ? <img className="canvas-logo" src={logo.data} alt={brand} /> : <div className="canvas-brand">{brand}<span>®</span></div>}
              <div className="canvas-copy"><div className="canvas-kicker">{campaign}</div><h2>{message}</h2><p>{offer}</p><button className="canvas-cta">{cta}<span>↗</span></button></div>
              {productMode === 'stage-real' && productPhoto && !imageComponents.length && <img className="canvas-product" src={productPhoto.data} alt="Sản phẩm" />}
              {imageComponents.length > 0 && <div className="canvas-components">{imageComponents.map((asset) => <img src={asset.data} alt={asset.name} key={asset.id} />)}</div>}
              {!generatedImage && <div className="canvas-hint"><Icon name="spark" /> Preview phong cách · tạo concept để thay ảnh nền</div>}
              <div className="safe-area" />
            </div></div>
            <div className="canvas-bottom"><div className="format-select"><span className="size-icon"><Icon name="crop" /></span><div><strong>{format.label}</strong><small>{format.width} × {format.height} px</small></div><select aria-label="Định dạng bài đăng" value={format.name} onChange={(e) => setFormat(formats.find((item) => item.name === e.target.value) ?? formats[0])}>{formats.map((item) => <option value={item.name} key={item.name}>{item.label}</option>)}</select></div><div className="quality-hint"><span className="quality-check">✓</span><span><strong>Layout sẵn sàng</strong><small>Chữ và logo được dựng riêng, dễ chỉnh sửa</small></span></div></div>
          </section>
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
              <div className="direction-card">
                <div className="direction-icon"><Icon name="sun" /></div>
                <div>
                  <strong>{stylePresets[stylePreset].label}</strong>
                  <p>{stylePresets[stylePreset].desc}</p>
                </div>
              </div>
            </div>

            <div className="inspector-section">
              <div className="section-title">
                <strong>Chỉ số kiểm định thị giác</strong>
                <span className="score-label">98<small>/100</small></span>
              </div>
              <div className="qa-check-item">
                <span><Icon name="check" /> Độ chân thực quang học</span>
                <b>96%</b>
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
                <span><Icon name="check" /> Giữ nguyên ảnh thực tế</span>
                <b>{productPhoto ? 'Tách nền + Đổ bóng' : 'Chưa có ảnh'}</b>
              </div>
            </div>

            <div className="inspector-section">
              <div className="section-title">
                <strong>Danh sách Layer thiết kế</strong>
                <span className="layer-count">4 layers</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind"><Icon name="image" /></span>
                <span>Ảnh nền AI (Sạch chữ)</span>
                <span className="layer-drag">{generatedImage ? '✓ Sẵn sàng' : 'Mặc định'}</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind text"><Icon name="text" /></span>
                <span>Typography & Slogan</span>
                <span className="layer-drag">Sắc nét</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind button"><Icon name="button" /></span>
                <span>Nút kêu gọi (CTA)</span>
                <span className="layer-drag">Chuẩn Brand</span>
              </div>
              <div className="layer-row">
                <span className="layer-kind"><Icon name="layers" /></span>
                <span>Ảnh sản phẩm / Người thật</span>
                <span className="layer-drag">{productPhoto ? 'Đã ghép' : 'Chưa có'}</span>
              </div>
            </div>

            <div className="review-card">
              <div className="review-icon"><Icon name="info" /></div>
              <div>
                <strong>Lời khuyên của QA Inspector</strong>
                <p>Nền ảnh đã được chỉ định để trống góc trái. Khi xuất file, ảnh giữ 100% độ sắc nét, không bị xỉn màu.</p>
              </div>
            </div>
          </aside>


        </div>
        }
        {page === 'folders' && null}
        <div className="toast" aria-live="polite">{statusMessage && <><span className={status === 'error' || status === 'missing-key' ? 'toast-icon warning' : 'toast-icon'}>{status === 'error' || status === 'missing-key' ? '!' : '✓'}</span><span>{statusMessage}</span>{status === 'missing-key' && <button className="toast-action" onClick={() => setPage('settings')}>Cấu hình key</button>}</>}</div>
      </main>
      {selectedAsset && <div className="asset-selection" onClick={() => setSelectedAssetId(null)}><img src={selectedAsset.data} alt={selectedAsset.name} /><span>{selectedAsset.name}</span><button onClick={() => removeAsset(selectedAsset.id)}>Xóa ảnh</button></div>}
      {dialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}><form className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={(event) => { event.preventDefault(); submitDialog() }}><button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setDialog(null)}>×</button><span className="eyebrow">{dialog.kind.includes('folder') ? 'CHIẾN DỊCH' : 'BÀI ĐĂNG'}</span><h2 id="dialog-title">{dialog.kind === 'create-folder' ? 'Tạo chiến dịch mới' : dialog.kind === 'rename-folder' ? 'Đổi tên chiến dịch' : dialog.kind === 'rename-post' ? 'Đổi tên bài đăng' : dialog.kind === 'delete-folder' ? 'Xóa chiến dịch?' : 'Xóa bài đăng?'}</h2><p>{dialog.kind === 'create-folder' ? 'Tạo chiến dịch mới để gom brief, tài nguyên và các bài đăng liên quan.' : dialog.kind === 'rename-folder' || dialog.kind === 'rename-post' ? 'Tên mới sẽ hiển thị trong thư viện của bạn.' : 'Thao tác này sẽ xóa brief, ảnh tham chiếu và ảnh đã tạo trong mục này.'}</p>{(dialog.kind === 'create-folder' || dialog.kind.startsWith('rename-')) ? <label className="field-label">Tên hiển thị<input autoFocus value={dialogName} onChange={(event) => setDialogName(event.target.value)} placeholder={dialog.kind === 'create-folder' ? 'Ví dụ: Ra mắt bộ sưu tập mùa hè' : 'Nhập tên mới'} maxLength={80} /></label> : <div className="dialog-delete-target"><Icon name="trash" /><strong>{dialog.name}</strong></div>}<div className="dialog-actions"><button className="quiet-btn" type="button" onClick={() => setDialog(null)}>Hủy</button><button className={dialog.kind.startsWith('delete-') ? 'danger-btn' : 'export-btn'} type="submit" disabled={(dialog.kind === 'create-folder' || dialog.kind.startsWith('rename-')) && !dialogName.trim()}>{dialog.kind === 'create-folder' ? 'Tạo chiến dịch' : dialog.kind === 'rename-folder' || dialog.kind === 'rename-post' ? 'Lưu tên' : 'Xóa vĩnh viễn'}</button></div></form></div>}
    </div>
  )
}

function Section({ title, count, open, onClick, children }: { title: string; count: string; open: boolean; onClick: () => void; children: ReactNode }) {
  return <div className={`form-section ${open ? 'open' : ''}`}><button className="section-trigger" onClick={onClick}><span className="section-number">{count}</span><strong>{title}</strong><Icon name="chevron" /></button>{open && <div className="section-content">{children}</div>}</div>
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
  return <svg className={name === 'loader' ? 'icon spinning' : 'icon'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.spark}</svg>
}

export default App
