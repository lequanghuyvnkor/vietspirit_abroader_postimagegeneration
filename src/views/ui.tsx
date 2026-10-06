import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { assetUrl, api, uploadImage } from '../lib/api.ts'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return <section className="card"><header className="card-head"><h2>{title}</h2>{aside}</header>{children}</section>
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <h2>{title}</h2>
      {children}
    </div>
  </div>
}

export function NameDialog({ title, initial = '', confirm, onSubmit, onClose }: { title: string; initial?: string; confirm: string; onSubmit: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial)
  const submit = () => { if (name.trim()) { onSubmit(name.trim()); onClose() } }
  return <Modal title={title} onClose={onClose}>
    <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} />
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn primary" disabled={!name.trim()} onClick={submit}>{confirm}</button></div>
  </Modal>
}

export function ConfirmDialog({ title, message, confirm, onConfirm, onClose }: { title: string; message: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}>
    <p>{message}</p>
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn danger" onClick={() => { onConfirm(); onClose() }}>{confirm}</button></div>
  </Modal>
}

/** Single-image picker (logo etc.). Stores the uploaded asset id. */
export function ImageSlot({ label, value, onChange, onError, maxEdge = 1200 }: { label: string; value: string | null; onChange: (id: string | null) => void; onError: (message: string) => void; maxEdge?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const id = await uploadImage(file, maxEdge)
      if (value) void api.deleteAsset(value)
      onChange(id)
    } catch (error) { onError(error instanceof Error ? error.message : 'Không tải được ảnh.') }
    finally { setBusy(false) }
  }
  return <div className="image-slot">
    <div className="image-slot-preview checker">{value ? <img src={assetUrl(value)} alt={label} /> : <span>Chưa có</span>}</div>
    <div className="image-slot-body">
      <strong>{label}</strong>
      <div className="row">
        <button className="btn small" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Đang tải…' : value ? 'Thay' : 'Tải lên'}</button>
        {value && <button className="btn small ghost" onClick={() => { void api.deleteAsset(value); onChange(null) }}>Xóa</button>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
    </div>
  </div>
}
