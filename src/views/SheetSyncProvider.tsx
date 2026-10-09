import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { checkSheet, describeReport, mergePlan, readSheet, sheetSyncReady, type MergeReport } from '../lib/sheetSync.ts'
import { SheetSyncContext, type SheetStatus } from '../lib/sheetSyncState.ts'
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

  const pull = useCallback(async (workspaceId: string, campaignId: string) => {
    if (running.current.has(campaignId)) return
    const workspace = storeRef.current.workspaces.find((item) => item.id === workspaceId)
    const settings = workspace?.campaigns.find((item) => item.id === campaignId)?.sheetSync
    if (!workspace || !settings) return
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
          if (!settings?.auto || !sheetSyncReady(settings) || running.current.has(campaign.id)) continue
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

  const api = useMemo(() => ({ status, pull }), [status, pull])
  return <SheetSyncContext.Provider value={api}>{children}</SheetSyncContext.Provider>
}
