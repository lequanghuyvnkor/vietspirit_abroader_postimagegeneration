import { buildCards } from './docsExport.ts'
import type { Campaign } from './types.ts'

const KEY = 'docs-sync'
export type DocsSyncSettings = { url: string; doc: string; auto: boolean }

export function loadDocsSync(): DocsSyncSettings {
  try { return { url: '', doc: '', auto: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { url: '', doc: '', auto: false } }
}

export function saveDocsSync(settings: DocsSyncSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* private mode: keep working without saving */ }
}

/** Accepts a full docs.google.com link or a bare id. */
export function docIdOf(input: string): string {
  return input.match(/\/document\/d\/([\w-]+)/)?.[1] ?? input.trim()
}

type SyncResult = { ok?: boolean; created?: number; updated?: number; error?: string }

/** Sends one card per piece to the Apps Script web app, which writes one tab per piece. */
export async function pushToDocs(settings: DocsSyncSettings, campaign: Campaign): Promise<SyncResult> {
  // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer.
  const response = await fetch(settings.url.trim(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ doc: docIdOf(settings.doc), campaign: campaign.name, cards: buildCards(campaign) }) })
  if (!response.ok) throw new Error(`Máy chủ Apps Script trả về ${response.status}`)
  const result = (await response.json()) as SyncResult
  if (result.error) throw new Error(result.error)
  return result
}
