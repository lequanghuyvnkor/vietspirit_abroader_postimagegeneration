import { useState } from 'react'
import { emptySheetSync, sheetSyncReady, sheetUrlProblem, takeSheetValue, tokenIsShort } from '../lib/sheetSync.ts'
import { useSheetSync } from '../lib/sheetSyncState.ts'
import type { PullPreview } from '../lib/sheetSyncState.ts'
import type { Campaign, SheetConflict, SheetSync, Workspace } from '../lib/types.ts'
import { Modal } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

const FIELD_LABELS: Record<SheetConflict['field'], string> = { caption: 'Caption', hashtags: 'Hashtag', date: 'Ngày đăng', time: 'Giờ đăng' }

/** Connects the campaign to its private content-plan Google Sheet: the plan is read from there, then made into posts here. */
export function SheetPanel({ workspace, campaign, edit }: Props) {
  const sheet = useSheetSync()
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState<PullPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const settings = campaign.sheetSync ?? emptySheetSync()
  const ready = sheetSyncReady(settings)
  const status = sheet.status[campaign.id]
  const failed = Boolean(status?.message.startsWith('Lỗi'))
  const problem = sheetUrlProblem(settings.url)
  const set = (change: Partial<SheetSync>) => edit((draft) => { draft.sheetSync = { ...emptySheetSync(), ...draft.sheetSync, ...change } })
  const conflict = settings.allowShared ? undefined : sheet.conflicts[campaign.id]
  // The first pull of a campaign shows what it would add and replace before touching anything.
  async function pull() {
    if (settings.pulledAt) { void sheet.pull(workspace.id, campaign.id); return }
    setPreviewing(true)
    setPreviewError('')
    try { setPreview(await sheet.preview(workspace.id, campaign.id)) }
    catch (error) { setPreviewError(error instanceof Error ? error.message : 'Không đọc được Sheet.') }
    finally { setPreviewing(false) }
  }
  const resolve = (conflict: SheetConflict, useSheet: boolean) => edit((draft) => {
    if (useSheet) takeSheetValue(draft, conflict)
    if (draft.sheetSync) draft.sheetSync.conflicts = draft.sheetSync.conflicts.filter((item) => !(item.code === conflict.code && item.field === conflict.field))
  })

  const fields = <div className="stack">
    <label className="field"><span className="field-label">URL ứng dụng web của Sheet (kết thúc bằng /exec)</span><input placeholder="https://script.google.com/macros/s/…/exec" value={settings.url} onChange={(event) => set({ url: event.target.value })} />
      {problem && <small className="error-text" role="alert">{problem}</small>}
    </label>
    <label className="field"><span className="field-label">Mã bí mật (đúng mã bạn đặt ở dòng TOKEN trong script)</span><input type="password" autoComplete="off" value={settings.token} onChange={(event) => set({ token: event.target.value })} />
      {tokenIsShort(settings.token) && <small className="muted">Mã ngắn thì người biết URL có thể đoán ra. Nên đổi sang mã dài hơn ở cả script (rồi triển khai lại) và ở đây.</small>}
      {!settings.token.trim() && settings.url.trim() !== '' && !problem && <small className="muted">Nhập mã bí mật để kết nối.</small>}
    </label>
  </div>

  return <section className="card sheet-panel" aria-label="Google Sheet kế hoạch">
    <header className="card-head"><h2>Google Sheet kế hoạch</h2>{ready && settings.frozen && <span className="flag info">Đã đóng băng</span>}{ready && !settings.frozen && <span className={`flag ${failed ? 'warn' : settings.conflicts.length ? 'info' : 'ok'}`}>{status?.busy ? 'Đang đọc' : failed ? 'Lỗi' : settings.conflicts.length ? `${settings.conflicts.length} chỗ cần xem` : settings.pulledAt ? 'Đã khớp' : 'Chưa kéo lần nào'}</span>}</header>

    {!ready && <>
      <p className="muted">Lập kế hoạch trong Google Sheet riêng tư (5 tab: Strategy, Calendar, Captions, Visual Brief, Sources). App đọc về, tạo bài và slide, rồi đẩy kết quả sang Google Docs. Việc bạn làm trong app (trạng thái, slide, ảnh đã tải, caption đã sửa) được giữ nguyên khi Sheet đổi.</p>
      {fields}
      <details>
        <summary className="muted">Cách kết nối (3 bước, làm một lần)</summary>
        <ol className="steps-list">
          <li>Mở Sheet kế hoạch → <b>Tiện ích mở rộng → Apps Script</b>. Dán nội dung file <code>docs/apps-script-sheet-read.gs</code>, đổi dòng <code>TOKEN</code> thành một mã bí mật dài của riêng bạn, bấm Lưu.</li>
          <li><b>Triển khai → Tùy chọn triển khai mới → Ứng dụng web</b> (Thực thi với tư cách: Tôi; Ai có quyền truy cập: Bất kỳ ai). Cho phép quyền, rồi sao chép URL kết thúc bằng <code>/exec</code>.</li>
          <li>Dán URL và đúng mã bí mật vào hai ô trên. Không có mã thì URL chỉ trả về "forbidden", nên kế hoạch vẫn riêng tư.</li>
        </ol>
      </details>
    </>}

    {ready && settings.frozen && <>
      <p className="muted">Kế hoạch đang được soạn ngay trong app; app không đọc Sheet nữa nên hai nơi không thể lệch nhau. Sheet cũ chỉ còn là bản lưu. Mở lại kết nối nếu cần kéo thêm từ Sheet (bài đã sửa trong app vẫn được giữ, chỗ khác nhau sẽ hỏi bạn).</p>
      <div className="row wrap"><button className="btn small" onClick={() => set({ frozen: false })}>Mở lại kết nối Sheet</button></div>
    </>}

    {ready && !settings.frozen && <>
      <div className="row wrap">
        <button className="btn primary" disabled={status?.busy || previewing || Boolean(conflict)} onClick={() => { void pull() }}>{status?.busy || previewing ? 'Đang đọc…' : settings.pulledAt ? 'Cập nhật từ Sheet' : 'Xem trước và kéo từ Sheet'}</button>
        <label className="row" title="Mỗi phút app hỏi Sheet có đổi không; nếu có thì tự kéo về và hợp nhất. Chỉ chạy khi app đang mở."><input type="checkbox" checked={settings.auto} onChange={(event) => set({ auto: event.target.checked })} /> Tự kéo khi Sheet thay đổi</label>
        <button className="link" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>Đổi kết nối</button>
        <button className="btn small ghost" title="Soạn kế hoạch ngay trong app và ngừng đọc Sheet" onClick={() => set({ frozen: true })}>Đóng băng Sheet</button>
      </div>
      {conflict && <div className="notice late-alert" role="alert">
        <p><b>Sheet này đang nối với chiến dịch "{conflict.campaign}" ({conflict.workspace}).</b> Nếu kéo, bài của chiến dịch kia sẽ lẫn vào đây. Mỗi chiến dịch cần một Sheet riêng. App đã tạm dừng việc kéo.</p>
        <div className="row wrap">
          <button className="btn small primary" onClick={() => edit((draft) => { delete draft.sheetSync })}>Gỡ kết nối Sheet khỏi chiến dịch này</button>
          <button className="btn small ghost" onClick={() => set({ allowShared: true })}>Tôi biết, cố ý dùng chung</button>
        </div>
      </div>}
      {!settings.pulledAt && !conflict && <p className="muted">Chưa kéo lần nào. Bấm nút trên để xem trước những gì sẽ được thêm vào chiến dịch này; chưa có gì thay đổi cho tới khi bạn đồng ý. Tự kéo chỉ bật sau lần kéo đầu tiên.</p>}
      {previewError && <p className="notice error" role="alert">{previewError}</p>}
      {status?.message && <p className={failed ? 'notice error' : 'muted'} role="status">{status.message}</p>}
      {settings.pulledAt && !status?.message && <p className="muted">Kéo lần cuối: {new Date(settings.pulledAt).toLocaleString('vi-VN')}</p>}
      {editing && fields}
      {settings.conflicts.length > 0 && <div className="field">
        <span className="field-label">Sheet và app khác nhau ở {settings.conflicts.length} chỗ (đang giữ bản trong app)</span>
        <div className="list">
          {settings.conflicts.map((conflict) => <div className="list-row" key={`${conflict.code}-${conflict.field}`}>
            <div className="list-main"><strong>{conflict.code} · {FIELD_LABELS[conflict.field]}</strong><small className="muted">Sheet: {conflict.sheetValue.replace(/\s+/g, ' ').slice(0, 140) || '(trống)'}</small></div>
            <button className="btn small" onClick={() => resolve(conflict, true)}>Dùng bản Sheet</button>
            <button className="btn small ghost" onClick={() => resolve(conflict, false)}>Giữ bản app</button>
          </div>)}
        </div>
      </div>}
    </>}
    {preview && <Modal title="Xem trước lần kéo đầu tiên" onClose={() => setPreview(null)}>
      <p>Chiến dịch <b>"{campaign.name}"</b> thuộc workspace <b>"{workspace.name}"</b>. Sheet có <b>{preview.pieces} bài</b>.</p>
      <ul>
        <li>Sẽ thêm {preview.report.added.length} bài{preview.report.added.length ? `: ${preview.report.added.slice(0, 12).join(', ')}${preview.report.added.length > 12 ? '…' : ''}` : ''}.</li>
        {preview.existingPieces > 0 && <li>Chiến dịch đã có {preview.existingPieces} bài; {preview.report.updated.length} bài trùng mã sẽ được cập nhật theo Sheet.</li>}
        <li>Chiến lược ({preview.strategyChars.toLocaleString('vi-VN')} ký tự) và các điều "không được nói" của Sheet sẽ được ghi vào chiến dịch{preview.replacesStrategy ? ', thay chiến lược hiện có' : ''}.</li>
      </ul>
      <p className="notice">Kiểm tra: đây có đúng là kế hoạch của <b>{workspace.name}</b> không? Nếu là kế hoạch của doanh nghiệp khác, bấm Hủy.</p>
      <div className="modal-actions"><button className="btn ghost" onClick={() => setPreview(null)}>Hủy</button><button className="btn primary" onClick={() => { setPreview(null); void sheet.pull(workspace.id, campaign.id, true) }}>Đúng, kéo về</button></div>
    </Modal>}
  </section>
}
