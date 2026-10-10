import type { Store } from './types.ts'

export type Session = { configured: boolean; authed: boolean; ai?: { ready: boolean } }

export type BackupMeta = { id: string; kind: 'auto' | 'manual' | 'history' | 'pre'; label: string; at: string; assets: number; campaigns: number; pieces: number; posts: number; bytes: number }
export type MirrorState = { dir: string; lastAt: string; lastError: string; lastCopied?: number }
export type RestoreResult = { safety: string | null; restored: number; missing: number; backups: BackupMeta[] }

export type Provider = 'openai' | 'gemini'
export type ApiKey = { id: string; provider: Provider; label: string; model: string; textModel: string; last4: string; isDefault: boolean; fromEnv: boolean }
export type KeyInput = { provider?: Provider; label?: string; model?: string; textModel?: string; apiKey?: string; isDefault?: boolean }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Revision of the store this window last read or wrote; sent with every save so a stale window is refused. */
let storeRev = ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  } catch {
    throw new ApiError('Không kết nối được máy chủ local. Hãy chạy lại npm run dev.', 0)
  }
  const body = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new ApiError(body.message ?? `Lỗi ${response.status}`, response.status)
  return body
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  session: () => request<Session>('/api/session'),
  setup: (password: string) => post('/api/auth/setup', { password }),
  login: (password: string) => post('/api/auth/login', { password }),
  logout: () => post('/api/auth/logout', {}),
  changePassword: (current: string, next: string) => post('/api/auth/password', { current, next }),
  loadStore: async () => {
    const response = await fetch('/api/store').catch(() => { throw new ApiError('Không kết nối được máy chủ local. Hãy chạy lại npm run dev.', 0) })
    if (!response.ok) throw new ApiError(((await response.json().catch(() => ({}))) as { message?: string }).message ?? `Lỗi ${response.status}`, response.status)
    storeRev = response.headers.get('x-store-rev') ?? ''
    return (await response.json()) as Store
  },
  saveStore: async (store: Store) => {
    const result = await request<{ rev?: string }>('/api/store', { method: 'PUT', headers: storeRev ? { 'if-match': storeRev } : {}, body: JSON.stringify(store) })
    if (result.rev) storeRev = result.rev
  },
  uploadAsset: (name: string, dataUrl: string) => post<{ id: string }>('/api/assets', { name, dataUrl }).then((result) => result.id),
  deleteAsset: (id: string) => request(`/api/assets/${id}`, { method: 'DELETE' }),
  listBackups: () => request<{ backups: BackupMeta[] }>('/api/backups').then((result) => result.backups),
  createBackup: (label: string) => post<{ backups: BackupMeta[] }>('/api/backups', { label }).then((result) => result.backups),
  getMirror: () => request<{ mirror: MirrorState }>('/api/backups/mirror').then((result) => result.mirror),
  setMirror: (dir: string) => request<{ mirror: MirrorState }>('/api/backups/mirror', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dir }) }).then((result) => result.mirror),
  runMirror: () => post<{ mirror: MirrorState }>('/api/backups/mirror', {}).then((result) => result.mirror),
  restoreBackup: (id: string) => post<RestoreResult>(`/api/backups/${id}/restore`, {}),
  deleteBackup: (id: string) => request<{ backups: BackupMeta[] }>(`/api/backups/${id}`, { method: 'DELETE' }).then((result) => result.backups),
  listKeys: () => request<{ keys: ApiKey[] }>('/api/keys').then((result) => result.keys),
  addKey: (input: KeyInput) => post<{ keys: ApiKey[] }>('/api/keys', input).then((result) => result.keys),
  updateKey: (id: string, input: KeyInput) => request<{ keys: ApiKey[] }>(`/api/keys/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then((result) => result.keys),
  removeKey: (id: string) => request<{ keys: ApiKey[] }>(`/api/keys/${id}`, { method: 'DELETE' }).then((result) => result.keys),
  generateText: (input: { system?: string; prompt: string; json?: boolean; keyId?: string; images?: string[] }) => post<{ text: string; provider: Provider; model: string }>('/api/text', input),
  generate: (input: { prompt: string; width: number; height: number; quality: 'high' | 'xhigh'; referenceIds: string[]; keyId?: string }) =>
    post<{ assetId: string }>('/api/generate', input).then((result) => result.assetId),
}

export const assetUrl = (id: string) => `/api/assets/${id}`

/** Reads an image file, downsizes it and returns a WebP data URL. */
export function readImage(file: File, maxEdge = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Không đọc được ảnh ${file.name}.`)) }
    image.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/webp', 0.9))
    }
    image.src = url
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Không đọc được ${file.name}.`))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export async function uploadImage(file: File, maxEdge?: number): Promise<string> {
  return api.uploadAsset(file.name, await readImage(file, maxEdge))
}
