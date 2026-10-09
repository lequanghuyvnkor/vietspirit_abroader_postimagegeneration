import { useEffect, useState } from 'react'
import { api, type BackupMeta } from '../lib/api.ts'
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

  useEffect(() => { api.listBackups().then(setBackups).catch((caught: Error) => setError(caught.message)) }, [])

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

  const latestHistory = backups?.find((meta) => meta.kind === 'history')

  return <Modal title="Sao lưu và khôi phục" onClose={onClose} wide>
    <p className="muted">App tự sao lưu đầy đủ mỗi ngày (gồm cả ảnh) và giữ lịch sử thay đổi gần đây. Trước mỗi lần khôi phục, app tự lưu trạng thái hiện tại để bạn quay lại được.</p>
    <div className="row wrap">
      <input aria-label="Ghi chú cho bản sao lưu" placeholder="Ghi chú (không bắt buộc), ví dụ: trước khi sửa P03" value={label} onChange={(event) => setLabel(event.target.value)} />
      <button className="btn primary" disabled={busy} onClick={() => { void create() }}>Tạo bản sao lưu ngay</button>
      {latestHistory && <button className="btn" disabled={busy} title={`Quay về trạng thái lúc ${formatTime(latestHistory.at)}`} onClick={() => setConfirming(latestHistory.id)}>Hoàn tác thay đổi gần nhất</button>}
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
