import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { checkSheet, describeReport, mergePlan, readSheet, sheetSyncReady, type MergeReport } from '../lib/sheetSync.ts'
import { linkBlocked } from '../lib/integrity.ts'
import { SheetSyncContext, type PullPreview, type SheetStatus } from '../lib/sheetSyncState.ts'
import { now, type Store } from '../lib/types.ts'

type Props = {
  store: Store
  update: (change: (draft: Store) => void) => void
  children: ReactNode
}

const POLL_MS = 60_000

/**
 * Keeps each campaign's plan in step with its private Google Sheet. A light "did it change?" check runs every minute
 * while the app is open; the plan is only downloaded and merged when the Sheet's fingerprint moved.
 */
export function SheetSyncProvider({ store, update, children }: Props) {
  const [status, setStatus] = useState<Record<string, SheetStatus>>({})
  const storeRef = useRef(store)
  const running = useRef(new Set<string>())
  useEffect(() => { storeRef.current = store }, [store])

  const say = useCallback((campaignId: string, busy: boolean, message: string) => setStatus((current) => ({ ...current, [campaignId]: { busy, message } })), [])

  const preview = useCallback(async (workspaceId: string, campaignId: string): Promise<PullPreview> => {
    const workspace = storeRef.current.workspaces.find((item) => item.id === workspaceId)
    const campaign = workspace?.campaigns.find((item) => item.id === campaignId)
    if (!workspace || !campaign?.sheetSync) throw new Error('Chiến dịch chưa nối Google Sheet.')
    const { plan } = await readSheet(campaign.sheetSync)
    const copy = structuredClone(campaign)
    const report = mergePlan(copy, plan, workspace.company, { makeSlides: false })
    return { report, pieces: plan.pieces.length, strategyChars: plan.strategy.length, replacesStrategy: campaign.strategy.trim() !== '' && campaign.strategy !== plan.strategy, existingPieces: campaign.pieces.length }
  }, [])

  const pull = useCallback(async (workspaceId: string, campaignId: string, confirmed = false) => {
    if (running.current.has(campaignId)) return
    const workspace = storeRef.current.workspaces.find((item) => item.id === workspaceId)
    const target = workspace?.campaigns.find((item) => item.id === campaignId)
    const settings = target?.sheetSync
    if (!workspace || !target || !settings || settings.frozen) return
    const owner = linkBlocked(storeRef.current, target, 'sheet')
    if (owner) { say(campaignId, false, `Lỗi: Sheet này đang nối với "${owner.campaign.name}" (${owner.workspace.name}). Mỗi chiến dịch cần một Sheet riêng.`); return }
    if (!settings.pulledAt && !confirmed) { say(campaignId, false, 'Lần kéo đầu tiên cần xem trước những gì sẽ thay đổi: bấm "Cập nhật từ Sheet".'); return }
    running.current.add(campaignId)
    say(campaignId, true, 'Đang đọc Google Sheet…')
    try {
      const { hash, plan } = await readSheet(settings)
      let report: MergeReport = { added: [], updated: [], missing: [], conflicts: [] }
      update((draft) => {
        const target = draft.workspaces.find((item) => item.id === workspaceId)
        const campaign = target?.campaigns.find((item) => item.id === campaignId)
        if (!target || !campaign?.sheetSync) return
        report = mergePlan(campaign, plan, target.company, { makeSlides: true })
        const previous = campaign.sheetSync.conflicts.filter((old) => !report.conflicts.some((fresh) => fresh.code === old.code && fresh.field === old.field))
        campaign.sheetSync = { ...campaign.sheetSync, hash, pulledAt: now(), conflicts: [...previous, ...report.conflicts] }
      })
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      say(campaignId, false, `${time}: ${describeReport(report)}`)
    } catch (error) {
      say(campaignId, false, `Lỗi: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      running.current.delete(campaignId)
    }
  }, [update, say])

  useEffect(() => {
    const tick = async () => {
      for (const workspace of storeRef.current.workspaces) {
        for (const campaign of workspace.campaigns) {
          const settings = campaign.sheetSync
          if (!settings?.auto || settings.frozen || !settings.pulledAt || !sheetSyncReady(settings) || running.current.has(campaign.id) || linkBlocked(storeRef.current, campaign, 'sheet')) continue
          try {
            const hash = await checkSheet(settings)
            if (hash && hash !== settings.hash) await pull(workspace.id, campaign.id)
          } catch (error) {
            say(campaign.id, false, `Lỗi: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    }
    const timer = window.setInterval(() => { void tick() }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [pull, say])

  const conflicts = useMemo(() => {
    const out: Record<string, { campaign: string; workspace: string }> = {}
    for (const workspace of store.workspaces) for (const campaign of workspace.campaigns) {
      const owner = linkBlocked(store, campaign, 'sheet')
      if (owner) out[campaign.id] = { campaign: owner.campaign.name, workspace: owner.workspace.name }
    }
    return out
  }, [store])
  const api = useMemo(() => ({ status, conflicts, pull, preview }), [status, conflicts, pull, preview])
  return <SheetSyncContext.Provider value={api}>{children}</SheetSyncContext.Provider>
}
