import { useState } from 'react'
import { emptySheetSync, sheetSyncReady, sheetUrlProblem, takeSheetValue } from '../lib/sheetSync.ts'
import { useSheetSync } from '../lib/sheetSyncState.ts'
import type { Campaign, SheetConflict, SheetSync, Workspace } from '../lib/types.ts'

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
  const settings = campaign.sheetSync ?? emptySheetSync()
  const ready = sheetSyncReady(settings)
  const status = sheet.status[campaign.id]
  const failed = Boolean(status?.message.startsWith('Lỗi'))
  const problem = sheetUrlProblem(settings.url)
  const set = (change: Partial<SheetSync>) => edit((draft) => { draft.sheetSync = { ...emptySheetSync(), ...draft.sheetSync, ...change } })
  const pull = () => { void sheet.pull(workspace.id, campaign.id) }
  const resolve = (conflict: SheetConflict, useSheet: boolean) => edit((draft) => {
    if (useSheet) takeSheetValue(draft, conflict)
    if (draft.sheetSync) draft.sheetSync.conflicts = draft.sheetSync.conflicts.filter((item) => !(item.code === conflict.code && item.field === conflict.field))
  })

  const fields = <div className="stack">
    <label className="field"><span className="field-label">URL ứng dụng web của Sheet (kết thúc bằng /exec)</span><input placeholder="https://script.google.com/macros/s/…/exec" value={settings.url} onChange={(event) => set({ url: event.target.value })} />
      {problem && <small className="error-text" role="alert">{problem}</small>}
    </label>
    <label className="field"><span className="field-label">Mã bí mật (cùng mã bạn đặt trong script)</span><input type="password" autoComplete="off" value={settings.token} onChange={(event) => set({ token: event.target.value })} /></label>
  </div>

  return <section className="card sheet-panel" aria-label="Google Sheet kế hoạch">
    <header className="card-head"><h2>Google Sheet kế hoạch</h2>{ready && <span className={`flag ${failed ? 'warn' : settings.conflicts.length ? 'info' : 'ok'}`}>{status?.busy ? 'Đang đọc' : failed ? 'Lỗi' : settings.conflicts.length ? `${settings.conflicts.length} chỗ cần xem` : settings.pulledAt ? 'Đã khớp' : 'Chưa kéo lần nào'}</span>}</header>

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

    {ready && <>
      <div className="row wrap">
        <button className="btn primary" disabled={status?.busy} onClick={pull}>{status?.busy ? 'Đang đọc…' : 'Cập nhật từ Sheet'}</button>
        <label className="row" title="Mỗi phút app hỏi Sheet có đổi không; nếu có thì tự kéo về và hợp nhất. Chỉ chạy khi app đang mở."><input type="checkbox" checked={settings.auto} onChange={(event) => set({ auto: event.target.checked })} /> Tự kéo khi Sheet thay đổi</label>
        <button className="link" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>Đổi kết nối</button>
      </div>
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
  </section>
}
