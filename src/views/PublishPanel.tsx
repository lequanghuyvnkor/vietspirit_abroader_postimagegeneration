import { useEffect, useRef, useState } from 'react'
import { navigate } from '../lib/route.ts'
import { reminders } from '../lib/results.ts'
import { todayIso } from '../lib/schedule.ts'
import { STATUS_LABELS, now } from '../lib/types.ts'
import type { Campaign, Piece, Workspace } from '../lib/types.ts'
import { ConfirmDialog, Modal, Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

const NOTIFY_KEY = 'cs_notify'
const KIND_TEXT = { late: 'đã quá giờ đăng', soon: 'sắp đến giờ đăng', due: 'đăng hôm nay' } as const

const localInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const stamp = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function readNotify(): boolean {
  try { return localStorage.getItem(NOTIFY_KEY) === '1' && 'Notification' in window && Notification.permission === 'granted' } catch { return false }
}

/** What to publish next, with reminders (the app never posts by itself), and the record of what went out and where. */
export function PublishPanel({ workspace, campaign, edit }: Props) {
  const [clock, setClock] = useState(() => new Date())
  const [notify, setNotify] = useState(readNotify)
  const [marking, setMarking] = useState<Piece | null>(null)
  const [undoing, setUndoing] = useState<Piece | null>(null)
  const [url, setUrl] = useState('')
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const told = useRef(new Set<string>())

  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 60_000); return () => window.clearInterval(timer) }, [])

  const today = todayIso(clock)
  const due = reminders(campaign, today, clock.getHours() * 60 + clock.getMinutes())
  const pending = [...campaign.pieces].filter((piece) => !piece.published).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.plan.time.localeCompare(b.plan.time))
  const published = [...campaign.pieces].filter((piece) => piece.published).sort((a, b) => b.published!.at.localeCompare(a.published!.at))

  useEffect(() => {
    if (!notify) return
    for (const entry of due) {
      const key = `${entry.piece.id}:${entry.kind}`
      if (entry.kind === 'due' || told.current.has(key)) continue
      told.current.add(key)
      try { new Notification(`${entry.piece.code} ${KIND_TEXT[entry.kind]}`, { body: `${entry.piece.title || entry.piece.plan.hook} · ${entry.piece.plan.time}` }) } catch { /* Notifications are optional. */ }
    }
  }, [due, notify])

  async function toggleNotify(on: boolean) {
    if (!on) { setNotify(false); try { localStorage.setItem(NOTIFY_KEY, '0') } catch { /* Ignore. */ } return }
    if (!('Notification' in window)) return
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    const granted = permission === 'granted'
    setNotify(granted)
    try { localStorage.setItem(NOTIFY_KEY, granted ? '1' : '0') } catch { /* Ignore. */ }
  }

  function start(piece: Piece) {
    setMarking(piece)
    setUrl(piece.published?.url ?? '')
    setNote(piece.published?.note ?? '')
    setWhen(localInput(piece.published ? new Date(piece.published.at) : new Date()))
  }

  const urlOk = !url.trim() || /^https?:\/\/\S+$/i.test(url.trim())

  function save() {
    if (!marking) return
    const id = marking.id
    const at = when ? new Date(when).toISOString() : now()
    edit((draft) => { const piece = draft.pieces.find((item) => item.id === id); if (piece) piece.published = { at, url: url.trim(), note: note.trim() } })
    setMarking(null)
  }

  const open = (piece: Piece) => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })

  return <Section title="Đăng bài" aside={<label className="row" title="Báo bằng thông báo của trình duyệt khi sắp hoặc đã quá giờ đăng. Chỉ chạy khi app đang mở."><input type="checkbox" checked={notify} onChange={(event) => { void toggleNotify(event.target.checked) }} /> Nhắc bằng thông báo</label>}>
    <p className="muted">App lên lịch và nhắc, không tự đăng lên Facebook/Instagram. Đăng xong bấm "Đã đăng" để ghi giờ thật và link bài.</p>
    {due.length > 0 && <div className={`notice${due.some((entry) => entry.kind === 'late') ? ' late-alert' : ''}`} role="status">
      <strong>{due.filter((entry) => entry.kind === 'late').length > 0 ? 'Cần đăng ngay' : 'Việc đăng hôm nay'}</strong>
      <div className="row wrap">{due.slice(0, 8).map((entry) => <button className="link" key={entry.piece.id} onClick={() => open(entry.piece)}>{entry.piece.code} · {entry.piece.plan.time || 'chưa có giờ'} ({KIND_TEXT[entry.kind]}{entry.kind === 'late' && entry.piece.date < today ? `, hạn ${entry.piece.date.slice(8, 10)}/${entry.piece.date.slice(5, 7)}` : ''})</button>)}</div>
    </div>}

    <h3>Chờ đăng ({pending.length})</h3>
    {pending.length === 0 ? <p className="muted">Tất cả bài đã đăng.</p> : <div className="list">
      {pending.map((piece) => <div className="list-row" key={piece.id}>
        <button className="list-main" onClick={() => open(piece)}>
          <strong>{piece.code} · {piece.title || piece.plan.hook}</strong>
          <small>{piece.date ? `${piece.date.slice(8, 10)}/${piece.date.slice(5, 7)}` : 'chưa có ngày'} {piece.plan.time} · {STATUS_LABELS[piece.status]}{piece.status !== 'ready' ? ' (chưa duyệt)' : ''}</small>
        </button>
        <button className="btn small" onClick={() => start(piece)}>Đã đăng…</button>
      </div>)}
    </div>}

    <h3>Đã đăng ({published.length})</h3>
    {published.length === 0 ? <p className="muted">Chưa có bài nào được ghi nhận là đã đăng.</p> : <div className="list">
      {published.map((piece) => <div className="list-row" key={piece.id}>
        <button className="list-main" onClick={() => open(piece)}>
          <strong>{piece.code} · {piece.title || piece.plan.hook}</strong>
          <small>Đăng {stamp(piece.published!.at)}{piece.date && piece.published!.at.slice(0, 10) !== piece.date ? ` (kế hoạch ${piece.date.slice(8, 10)}/${piece.date.slice(5, 7)})` : ''}{piece.published!.note ? ` · ${piece.published!.note}` : ''}</small>
        </button>
        {piece.published!.url && <a className="btn small ghost" href={piece.published!.url} target="_blank" rel="noreferrer noopener">Mở bài</a>}
        <button className="btn small ghost" onClick={() => start(piece)}>Sửa</button>
        <button className="btn small ghost" onClick={() => setUndoing(piece)}>Bỏ đánh dấu</button>
      </div>)}
    </div>}

    {marking && <Modal title={`Ghi nhận đã đăng ${marking.code}`} onClose={() => setMarking(null)}>
      {marking.status !== 'ready' && !marking.published && <p className="notice">Bài này chưa qua bước duyệt (đang "{STATUS_LABELS[marking.status]}"). Vẫn ghi nhận nếu bạn đã đăng rồi.</p>}
      <label className="field"><span className="field-label">Giờ đăng thật</span><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></label>
      <label className="field"><span className="field-label">Link bài đăng (không bắt buộc)</span><input placeholder="https://www.facebook.com/…" value={url} onChange={(event) => setUrl(event.target.value)} />{!urlOk && <small className="error-text" role="alert">Link cần bắt đầu bằng http:// hoặc https://</small>}</label>
      <label className="field"><span className="field-label">Ghi chú (không bắt buộc)</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="modal-actions"><button className="btn ghost" onClick={() => setMarking(null)}>Hủy</button><button className="btn primary" disabled={!urlOk || !when} onClick={save}>Lưu</button></div>
    </Modal>}
    {undoing && <ConfirmDialog title={`Bỏ đánh dấu ${undoing.code}`} message="Bài quay về danh sách chờ đăng. Số liệu đã nhập vẫn được giữ." confirm="Bỏ đánh dấu" onConfirm={() => { const id = undoing.id; edit((draft) => { const piece = draft.pieces.find((item) => item.id === id); if (piece) delete piece.published }) }} onClose={() => setUndoing(null)} />}
  </Section>
}
