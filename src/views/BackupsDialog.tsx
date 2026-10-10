import { useEffect, useState } from 'react'
import { api, type BackupMeta, type MirrorState } from '../lib/api.ts'
import { Modal } from './ui.tsx'

const KIND_LABEL: Record<BackupMeta['kind'], string> = { auto: 'Tự động hằng ngày', manual: 'Bạn tạo', history: 'Lịch sử thay đổi', pre: 'Trước khi khôi phục' }

const formatTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type Props = { freeze: () => Promise<void>; onClose: () => void }

export function BackupsDialog({ freeze, onClose }: Props) {
  const [backups, setBackups] = useState<BackupMeta[] | null>(null)
  const [label, setLabel] = useState('')
  const [confirming, setConfirming] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mirror, setMirror] = useState<MirrorState | null>(null)
  const [mirrorDir, setMirrorDir] = useState('')

  useEffect(() => {
    api.listBackups().then(setBackups).catch((caught: Error) => setError(caught.message))
    api.getMirror().then((state) => { setMirror(state); setMirrorDir(state.dir) }).catch(() => undefined)
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await action() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Có lỗi xảy ra.') }
    finally { setBusy(false) }
  }

  const create = () => run(async () => {
    setBackups(await api.createBackup(label.trim()))
    setLabel('')
    setMessage('Đã tạo bản sao lưu đầy đủ (gồm cả ảnh).')
  })

  const restore = (id: string) => run(async () => {
    await freeze()
    const result = await api.restoreBackup(id)
    setConfirming('')
    setMessage(`Đã khôi phục${result.restored ? `, lấy lại ${result.restored} ảnh` : ''}${result.missing ? `, ${result.missing} ảnh không còn trong bản nào` : ''}. Đang tải lại…`)
    window.setTimeout(() => window.location.reload(), 900)
  })

  const saveMirrorDir = () => run(async () => {
    const state = await api.setMirror(mirrorDir.trim())
    setMirror(state)
    setMirrorDir(state.dir)
    setMessage(state.dir ? 'Đã lưu thư mục thứ hai và chép dữ liệu sang đó.' : 'Đã tắt sao lưu sang thư mục thứ hai.')
  })

  const mirrorNow = () => run(async () => {
    const state = await api.runMirror()
    setMirror(state)
    if (!state.lastError) setMessage('Đã chép dữ liệu và ảnh sang thư mục thứ hai.')
  })

  const latestHistory = backups?.find((meta) => meta.kind === 'history')

  return <Modal title="Sao lưu và khôi phục" onClose={onClose} wide>
    <p className="muted">App tự sao lưu đầy đủ mỗi ngày (gồm cả ảnh) và giữ lịch sử thay đổi gần đây. Trước mỗi lần khôi phục, app tự lưu trạng thái hiện tại để bạn quay lại được.</p>
    <div className="row wrap">
      <input aria-label="Ghi chú cho bản sao lưu" placeholder="Ghi chú (không bắt buộc), ví dụ: trước khi sửa P03" value={label} onChange={(event) => setLabel(event.target.value)} />
      <button className="btn primary" disabled={busy} onClick={() => { void create() }}>Tạo bản sao lưu ngay</button>
      {latestHistory && <button className="btn" disabled={busy} title={`Quay về trạng thái lúc ${formatTime(latestHistory.at)}`} onClick={() => setConfirming(latestHistory.id)}>Hoàn tác thay đổi gần nhất</button>}
    </div>
    <div className="field">
      <span className="field-label">Thư mục sao lưu thứ hai (khuyên dùng)</span>
      <div className="row wrap">
        <input aria-label="Thư mục sao lưu thứ hai" placeholder="Ví dụ: D:\SaoLuuStudio (ổ khác, ổ ngoài hoặc thư mục Drive)" value={mirrorDir} onChange={(event) => setMirrorDir(event.target.value)} />
        <button className="btn" disabled={busy || mirrorDir.trim() === (mirror?.dir ?? '')} onClick={() => { void saveMirrorDir() }}>Lưu thư mục</button>
        {mirror?.dir && <button className="btn" disabled={busy} onClick={() => { void mirrorNow() }}>Chép ngay</button>}
      </div>
      <small className="muted">Bản sao lưu ở trên nằm cùng ổ với dữ liệu nên không cứu được khi hỏng ổ cứng. Điền một thư mục ở nơi khác: mỗi ngày app tự chép dữ liệu và toàn bộ ảnh sang đó (giữ 14 ngày gần nhất). {mirror?.dir ? (mirror.lastError ? '' : mirror.lastAt ? `Lần chép gần nhất: ${formatTime(mirror.lastAt)}.` : 'Chưa chép lần nào.') : 'Chưa bật.'}</small>
      {mirror?.lastError && <p className="notice error" role="alert">Lần chép gần nhất lỗi: {mirror.lastError}</p>}
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="list">
      {backups === null && !error && <p className="muted">Đang tải…</p>}
      {backups?.length === 0 && <p className="notice">Chưa có bản sao lưu nào.</p>}
      {backups?.map((meta) => <div className="key-row" key={meta.id}>
        <div className="list-main">
          <strong>{formatTime(meta.at)} <span className="badge">{KIND_LABEL[meta.kind]}</span></strong>
          <small>{meta.campaigns} chiến dịch · {meta.pieces} bài · {meta.posts} ảnh/post{meta.kind !== 'history' ? ` · ${meta.assets} tệp ảnh` : ''}{meta.label ? ` · ${meta.label}` : ''}</small>
        </div>
        <div className="row">
          {confirming === meta.id
            ? <>
              <span className="muted">Thay dữ liệu hiện tại bằng bản này?</span>
              <button className="btn small primary" disabled={busy} onClick={() => { void restore(meta.id) }}>Khôi phục</button>
              <button className="btn small ghost" disabled={busy} onClick={() => setConfirming('')}>Hủy</button>
            </>
            : <>
              <button className="btn small" disabled={busy} onClick={() => setConfirming(meta.id)}>Khôi phục</button>
              <button className="btn small ghost" disabled={busy} onClick={() => { void run(async () => setBackups(await api.deleteBackup(meta.id))) }}>Xóa</button>
            </>}
        </div>
      </div>)}
    </div>
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
  </Modal>
}
