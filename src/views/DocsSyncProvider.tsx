import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { docsSyncReady, pieceSignature, pushPiece } from '../lib/docsSync.ts'
import { DocsSyncContext, type SyncStatus } from '../lib/docsSyncState.ts'
import type { Store } from '../lib/types.ts'

type Props = {
  store: Store
  update: (change: (draft: Store) => void) => void
  children: ReactNode
}

const AUTO_DELAY_MS = 5000

/**
 * Keeps each campaign's Google Docs in step with the app. It lives at the top of the app (not on the schedule page),
 * so an edit made on a piece page or in the slide editor is noticed too. Only pieces whose content or images changed are re-sent.
 */
export function DocsSyncProvider({ store, update, children }: Props) {
  const [status, setStatus] = useState<Record<string, SyncStatus>>({})
  const storeRef = useRef(store)
  const running = useRef(new Set<string>())
  /** Campaigns where the last push failed: automatic pushes wait for the user instead of retrying on every edit. */
  const paused = useRef(new Set<string>())
  useEffect(() => { storeRef.current = store }, [store])

  const pending = useMemo(() => {
    const out: Record<string, number> = {}
    for (const workspace of store.workspaces) {
      for (const campaign of workspace.campaigns) {
        const settings = campaign.docsSync
        if (settings) out[campaign.id] = campaign.pieces.filter((piece) => settings.sent[piece.id] !== pieceSignature(workspace, campaign, piece)).length
      }
    }
    return out
  }, [store])

  const say = useCallback((campaignId: string, busy: boolean, message: string) => setStatus((current) => ({ ...current, [campaignId]: { busy, message } })), [])

  const sync = useCallback(async (workspaceId: string, campaignId: string, force: boolean) => {
    if (running.current.has(campaignId)) return
    const find = () => {
      const workspace = storeRef.current.workspaces.find((item) => item.id === workspaceId)
      return { workspace, campaign: workspace?.campaigns.find((item) => item.id === campaignId) }
    }
    const first = find()
    const settings = first.campaign?.docsSync
    if (!first.workspace || !first.campaign || !settings) return
    if (!docsSyncReady(settings)) { say(campaignId, false, 'Cần link Google Docs và URL ứng dụng web đúng dạng.'); return }
    const todo = first.campaign.pieces.filter((piece) => force || settings.sent[piece.id] !== pieceSignature(first.workspace!, first.campaign!, piece))
    if (todo.length === 0) { say(campaignId, false, 'Google Docs đã khớp với app.'); return }

    running.current.add(campaignId)
    paused.current.delete(campaignId)
    const warnings: string[] = []
    let done = 0
    try {
      for (const stale of todo) {
        say(campaignId, true, `Đang đẩy ${stale.code} (${done + 1}/${todo.length})…`)
        // Read the piece again: it may have been edited while earlier pieces were uploading.
        const { workspace, campaign } = find()
        const piece = campaign?.pieces.find((item) => item.id === stale.id)
        if (!workspace || !campaign || !piece) continue
        const signature = pieceSignature(workspace, campaign, piece)
        const result = await pushPiece(settings, workspace, campaign, piece)
        warnings.push(...(result.warnings ?? []))
        update((draft) => {
          const target = draft.workspaces.find((item) => item.id === workspaceId)?.campaigns.find((item) => item.id === campaignId)
          if (target?.docsSync) target.docsSync.sent[piece.id] = signature
        })
        done++
      }
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      say(campaignId, false, `Đã đẩy ${done} bài lúc ${time}.${warnings.length ? ` Ảnh chưa chèn được: ${warnings.join('; ')}` : ''}`)
    } catch (error) {
      paused.current.add(campaignId)
      say(campaignId, false, `Lỗi: ${error instanceof Error ? error.message : String(error)}${done ? ` (đã đẩy ${done} bài trước đó)` : ''}`)
    } finally {
      running.current.delete(campaignId)
    }
  }, [update, say])

  useEffect(() => {
    const timers: number[] = []
    for (const workspace of store.workspaces) {
      for (const campaign of workspace.campaigns) {
        const settings = campaign.docsSync
        if (!settings?.auto || !docsSyncReady(settings) || (pending[campaign.id] ?? 0) === 0 || paused.current.has(campaign.id) || running.current.has(campaign.id)) continue
        timers.push(window.setTimeout(() => { void sync(workspace.id, campaign.id, false) }, AUTO_DELAY_MS))
      }
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [store, pending, sync])

  const api = useMemo(() => ({ status, pending, pushNow: sync }), [status, pending, sync])
  return <DocsSyncContext.Provider value={api}>{children}</DocsSyncContext.Provider>
}
