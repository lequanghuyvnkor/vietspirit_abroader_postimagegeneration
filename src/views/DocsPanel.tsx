import { useState } from 'react'
import { copyDocsHtml } from '../lib/docsExport.ts'
import { docsSyncReady, emptyDocsSync, loadDocsSync } from '../lib/docsSync.ts'
import { useDocsSync } from '../lib/docsSyncState.ts'
import type { Campaign, DocsSync, Workspace } from '../lib/types.ts'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

const URL_SHAPE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/

/** What is wrong with the URL the user pasted, in words they can act on. */
function urlProblem(url: string): string {
  const value = url.trim()
  if (!value || URL_SHAPE.test(value)) return ''
  if (/script\.google\.com\/.*\/(edit|projects|home)/.test(value)) return 'Đây là link trang soạn code. Cần URL ứng dụng web: Apps Script → Triển khai → Quản lý bản triển khai → Ứng dụng web → URL (kết thúc bằng /exec).'
  return 'URL cần có dạng https://script.google.com/macros/s/…/exec'
}

/** The one place to connect and run the Google Docs sync: one button, one switch, one status line. */
export function DocsPanel({ workspace, campaign, edit }: Props) {
  const docs = useDocsSync()
  const [prefill] = useState(loadDocsSync)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const sync = campaign.docsSync ?? emptyDocsSync(prefill)
  const ready = docsSyncReady(sync)
  const status = docs.status[campaign.id]
  const pending = docs.pending[campaign.id] ?? campaign.pieces.length
  const failed = Boolean(status?.message.startsWith('Lỗi'))
  const setSync = (change: Partial<DocsSync>) => edit((draft) => { draft.docsSync = { ...emptyDocsSync(prefill), ...draft.docsSync, ...change } })
  const run = (force: boolean) => { void docs.pushNow(workspace.id, campaign.id, force) }

  async function copyByHand() {
    try { await copyDocsHtml(campaign); setCopied('ok') } catch { setCopied('fail') }
    setTimeout(() => setCopied(null), 4000)
  }

  const fields = <div className="stack">
    <label className="field"><span className="field-label">Link Google Docs</span><input name={`docs-link-${campaign.id}`} autoComplete="off" spellCheck={false} placeholder="https://docs.google.com/document/d/…" value={sync.doc} onChange={(event) => setSync({ doc: event.target.value })} /></label>
    <label className="field"><span className="field-label">URL ứng dụng web Apps Script</span><input name={`docs-url-${campaign.id}`} autoComplete="off" spellCheck={false} placeholder="https://script.google.com/macros/s/…/exec" value={sync.url} onChange={(event) => setSync({ url: event.target.value })} />
      {urlProblem(sync.url) && <small className="error-text" role="alert">{urlProblem(sync.url)}</small>}
    </label>
  </div>

  return <section className="card docs-panel" aria-label="Google Docs">
    <header className="card-head"><h2>Google Docs</h2>{ready && <span className={`flag ${failed ? 'warn' : pending > 0 ? 'info' : 'ok'}`}>{status?.busy ? 'Đang đẩy' : failed ? 'Lỗi' : pending > 0 ? `${pending} bài chưa đẩy` : 'Đã khớp'}</span>}</header>

    {!ready && <>
      <p className="muted">Mỗi bài thành một tab trong Google Docs của bạn, có bảng thông tin và ảnh. Điền hai ô dưới đây một lần; từ đó app tự cập nhật khi bài đổi.</p>
      {fields}
    </>}

    {ready && <>
      <div className="row wrap">
        <button className="btn primary" disabled={status?.busy} onClick={() => run(false)}>{status?.busy ? 'Đang đẩy…' : pending > 0 ? `Đồng bộ ngay (${pending} bài)` : 'Đồng bộ ngay'}</button>
        <label className="row" title="Khi nội dung hoặc hình ảnh của một bài đổi, ở bất kỳ trang nào của app, Google Docs tự cập nhật bài đó sau vài giây. Chỉ chạy khi app đang mở trên trình duyệt."><input type="checkbox" checked={sync.auto} onChange={(event) => { setSync({ auto: event.target.checked }); if (event.target.checked) run(false) }} /> Tự động cập nhật khi bài thay đổi</label>
        <button className="link" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>Đổi kết nối</button>
      </div>
      {status?.message && <p className={failed ? 'notice error' : 'muted'} role="status">{status.message}</p>}
      {editing && fields}
    </>}

    <details className="docs-advanced">
      <summary className="muted">Nâng cao</summary>
      <div className="row wrap">
        {ready && <button className="btn small" disabled={status?.busy} onClick={() => run(true)} title="Dựng lại tab của tất cả bài, kể cả bài không đổi">Dựng lại tất cả {campaign.pieces.length} tab</button>}
        <button className="btn small ghost" onClick={() => { void copyByHand() }} title="Không cần kết nối: sao chép bảng thông tin rồi dán vào Google Docs bằng Ctrl+V (không có ảnh)">{copied === 'ok' ? 'Đã sao chép, hãy dán vào Docs' : copied === 'fail' ? 'Không sao chép được' : 'Sao chép để dán tay (không ảnh)'}</button>
      </div>
      <small className="muted">Chữ bạn gõ tay trong tab của một bài sẽ bị thay khi bài đó được đẩy lại. Muốn ghi chú riêng thì viết ở tab khác.</small>
    </details>
  </section>
}
