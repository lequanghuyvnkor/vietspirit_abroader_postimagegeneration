import { useState } from 'react'
import { api } from '../lib/api.ts'
import { detachSheetData, findIssues, type Issue } from '../lib/integrity.ts'
import { navigate } from '../lib/route.ts'
import { now } from '../lib/types.ts'
import type { Store } from '../lib/types.ts'
import { Modal } from './ui.tsx'

type Props = {
  store: Store
  update: (change: (draft: Store) => void) => void
  /** Only show the issues of this campaign (the campaign page); omit for all (the home page). */
  campaignId?: string
  /** Only the issues of this workspace's campaigns (the workspace page). */
  workspaceId?: string
}

/** Warns when one project's data leaked into another (shared Sheet/Docs, look-alike plans) and offers a safe repair. */
export function IntegrityPanel({ store, update, campaignId, workspaceId }: Props) {
  const [fixing, setFixing] = useState<Issue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const issues = findIssues(store).filter((issue) => (!campaignId || issue.campaignId === campaignId) && (!workspaceId || issue.workspaceId === workspaceId))
  if (issues.length === 0) return null

  const locate = (issue: Issue) => {
    const workspace = store.workspaces.find((item) => item.id === issue.workspaceId)
    const campaign = workspace?.campaigns.find((item) => item.id === issue.campaignId)
    return { workspace, campaign }
  }

  const change = (issue: Issue, fn: (campaign: NonNullable<ReturnType<typeof locate>['campaign']>) => void) => update((draft) => {
    const owner = draft.workspaces.find((item) => item.id === issue.workspaceId)
    const target = owner?.campaigns.find((item) => item.id === issue.campaignId)
    if (owner && target) { fn(target); target.updatedAt = now(); owner.updatedAt = target.updatedAt }
  })

  async function repair(issue: Issue) {
    setBusy(true)
    setError('')
    try {
      // A full backup first, so the repair can be undone from the Sao lưu dialog.
      await api.createBackup(`Trước khi gỡ liên kết dữ liệu: ${locate(issue).campaign?.name ?? ''}`)
      if (issue.fix === 'detachSheet') change(issue, (campaign) => { detachSheetData(campaign) })
      else if (issue.fix === 'detachDocs') change(issue, (campaign) => { delete campaign.docsSync })
      setFixing(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không sửa được.') }
    finally { setBusy(false) }
  }

  const linkedPieces = fixing ? locate(fixing).campaign?.pieces.filter((piece) => piece.sheetBase?.linked) ?? [] : []
  const ownPieces = fixing ? (locate(fixing).campaign?.pieces.length ?? 0) - linkedPieces.length : 0

  return <section className="card integrity" aria-label="Kiểm tra dữ liệu">
    <header className="card-head"><h2>Kiểm tra dữ liệu: có thể đang bị lẫn</h2></header>
    {issues.map((issue) => <div className={`notice integrity-item${issue.level === 'warn' ? ' late-alert' : ''}`} key={issue.id}>
      <p>{issue.text}</p>
      <div className="row wrap">
        {!campaignId && <button className="btn small" onClick={() => navigate({ workspace: issue.workspaceId, campaign: issue.campaignId, tab: 'plan' })}>Mở chiến dịch</button>}
        {issue.fix && <button className="btn small primary" onClick={() => { setError(''); setFixing(issue) }}>{issue.fixLabel}</button>}
        {issue.level === 'info' && <button className="btn small ghost" title="Không nhắc lại cảnh báo này" onClick={() => change(issue, (campaign) => { campaign.ignoredIssues = [...(campaign.ignoredIssues ?? []), issue.id] })}>Bỏ qua, không nhắc lại</button>}
        {issue.allow && <button className="btn small ghost" title="Chỉ chọn khi hai chiến dịch cố ý dùng chung" onClick={() => change(issue, (campaign) => { const settings = issue.allow === 'sheet' ? campaign.sheetSync : campaign.docsSync; if (settings) settings.allowShared = true })}>Tôi biết, cố ý dùng chung</button>}
      </div>
    </div>)}
    {fixing && <Modal title={fixing.fixLabel ?? 'Sửa'} onClose={() => !busy && setFixing(null)}>
      {fixing.fix === 'detachSheet' ? <>
        <p>Trong chiến dịch <b>"{locate(fixing).campaign?.name}"</b> (workspace <b>{locate(fixing).workspace?.name}</b>) app sẽ:</p>
        <p className="notice">Chỉ bấm nếu các bài bên dưới KHÔNG thuộc doanh nghiệp này.</p>
        <ul>
          <li>Xóa <b>{linkedPieces.length} bài</b> được kéo từ Sheet và các slide của chúng: {linkedPieces.slice(0, 4).map((piece) => `${piece.code} ${piece.title}`).join('; ')}{linkedPieces.length > 4 ? '…' : ''}.</li>
          <li>Xóa phần chiến lược và "điều không được nói" do Sheet ghi vào (không còn bản gốc để trả lại).</li>
          <li>Ngắt kết nối Sheet.</li>
          <li><b>Giữ nguyên</b> {ownPieces} bài bạn tự tạo trong app, phần Nền tảng, Moodboard và mọi thứ khác.</li>
        </ul>
        <p className="muted">Trước khi xóa app tự tạo một bản sao lưu đầy đủ; có thể quay lại bằng nút Sao lưu ở thanh trên.</p>
      </> : <p>Ngắt kết nối Google Docs của chiến dịch này. Nội dung trên Google Docs không bị xóa.</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="btn ghost" disabled={busy} onClick={() => setFixing(null)}>Hủy</button><button className="btn danger" disabled={busy} onClick={() => { void repair(fixing) }}>{busy ? 'Đang sao lưu và sửa…' : 'Sao lưu rồi sửa'}</button></div>
    </Modal>}
  </section>
}
