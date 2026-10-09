import { docsSyncReady } from '../lib/docsSync.ts'
import { useDocsSync } from '../lib/docsSyncState.ts'
import { navigate } from '../lib/route.ts'
import type { Campaign } from '../lib/types.ts'

/** Top-bar status of the campaign's Google Docs: in step, waiting, being sent, or failed. Click to open the sync panel. */
export function DocsChip({ campaign, workspaceId }: { campaign: Campaign; workspaceId: string }) {
  const docs = useDocsSync()
  const settings = campaign.docsSync
  if (!settings || !docsSyncReady(settings)) return null
  const status = docs.status[campaign.id]
  const pending = docs.pending[campaign.id] ?? 0
  const failed = status?.message.startsWith('Lỗi')
  const label = status?.busy ? status.message : failed ? 'Docs: lỗi, bấm để xem' : pending > 0 ? `Docs: ${pending} bài chưa đẩy${settings.auto ? ' (tự động)' : ''}` : 'Docs: đã khớp'
  return <button className={`docs-chip ${failed || pending > 0 ? 'warn' : 'ok'}`} title={status?.message} onClick={() => navigate({ workspace: workspaceId, campaign: campaign.id, tab: 'schedule' })}>{label}</button>
}
