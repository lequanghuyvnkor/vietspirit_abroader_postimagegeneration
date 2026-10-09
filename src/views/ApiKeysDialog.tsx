import { useState } from 'react'
import { api, type ApiKey, type Provider } from '../lib/api.ts'
import { Field, Modal } from './ui.tsx'

const DEFAULT_MODEL: Record<Provider, string> = { openai: 'gpt-image-2.5-sunburst', gemini: 'gemini-3.1-flash-image' }
const DEFAULT_TEXT_MODEL: Record<Provider, string> = { openai: 'gpt-4.1-mini', gemini: 'gemini-3.8-flash' }
const PROVIDER_NAME: Record<Provider, string> = { openai: 'OpenAI', gemini: 'Google Gemini' }

type Props = { keys: ApiKey[]; onChange: (keys: ApiKey[]) => void; onClose: () => void }

export function ApiKeysDialog({ keys, onChange, onClose }: Props) {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [label, setLabel] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL.gemini)
  const [textModel, setTextModel] = useState(DEFAULT_TEXT_MODEL.gemini)
  const [apiKey, setApiKey] = useState('')
  const [replacing, setReplacing] = useState<{ id: string; value: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; model: string; textModel: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<ApiKey[]>, done?: () => void) {
    setBusy(true)
    setError('')
    try { onChange(await action()); done?.() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Có lỗi xảy ra.') }
    finally { setBusy(false) }
  }

  const add = () => run(() => api.addKey({ provider, label, model, textModel, apiKey }), () => { setApiKey(''); setLabel('') })

  return <Modal title="API tạo ảnh" onClose={onClose} wide>
    <p className="muted">Key được lưu trên máy này và không bao giờ gửi lại về trình duyệt; chỉ hiện 4 ký tự cuối. Bạn có thể thêm nhiều key của nhiều nhà cung cấp rồi chọn key khi tạo nền.</p>
    <div className="list">
      {keys.length === 0 && <p className="notice">Chưa có API key nào.</p>}
      {keys.map((entry) => <div className="key-row" key={entry.id}>
        <div className="list-main">
          <strong>{entry.label} {entry.isDefault && <span className="badge">Mặc định</span>}</strong>
          <small>{PROVIDER_NAME[entry.provider]} · ảnh: {entry.model} · văn bản: {entry.textModel} · <code>••••••••{entry.last4}</code>{entry.fromEnv && ' · từ .env.local'}</small>
          {editing?.id === entry.id && <div className="row wrap">
            <input aria-label="Model tạo ảnh" value={editing.model} onChange={(event) => setEditing({ ...editing, model: event.target.value })} />
            <input aria-label="Model văn bản" value={editing.textModel} onChange={(event) => setEditing({ ...editing, textModel: event.target.value })} />
            <button className="btn small primary" disabled={busy} onClick={() => { void run(() => api.updateKey(entry.id, { model: editing.model, textModel: editing.textModel }), () => setEditing(null)) }}>Lưu</button>
            <button className="btn small ghost" onClick={() => setEditing(null)}>Hủy</button>
          </div>}
          {replacing?.id === entry.id && <div className="row">
            <input type="text" className="secret" name="api-key-replace" data-lpignore="true" data-1p-ignore="true" autoComplete="off" autoFocus placeholder="Dán key mới" value={replacing.value} onChange={(event) => setReplacing({ id: entry.id, value: event.target.value })} />
            <button className="btn small primary" disabled={busy || !replacing.value} onClick={() => { void run(() => api.updateKey(entry.id, { apiKey: replacing.value }), () => setReplacing(null)) }}>Lưu</button>
            <button className="btn small ghost" onClick={() => setReplacing(null)}>Hủy</button>
          </div>}
        </div>
        {!entry.fromEnv && <div className="row">
          {!entry.isDefault && <button className="btn small" disabled={busy} onClick={() => { void run(() => api.updateKey(entry.id, { isDefault: true })) }}>Đặt mặc định</button>}
          <button className="btn small" disabled={busy} onClick={() => setEditing({ id: entry.id, model: entry.model, textModel: entry.textModel })}>Đổi model</button>
          <button className="btn small" disabled={busy} onClick={() => setReplacing({ id: entry.id, value: '' })}>Đổi key</button>
          <button className="btn small ghost" disabled={busy} onClick={() => { void run(() => api.removeKey(entry.id)) }}>Xóa</button>
        </div>}
      </div>)}
    </div>

    <form className="stack key-form" autoComplete="off" onSubmit={(event) => { event.preventDefault(); void add() }}>
      <h3>Thêm key</h3>
      <div className="row wrap">
        <Field label="Nhà cung cấp">
          <select value={provider} onChange={(event) => { const next = event.target.value as Provider; setProvider(next); setModel(DEFAULT_MODEL[next]); setTextModel(DEFAULT_TEXT_MODEL[next]) }}>
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </Field>
        <Field label="Tên gọi (không bắt buộc)"><input value={label} placeholder="Ví dụ: Gemini công ty" onChange={(event) => setLabel(event.target.value)} /></Field>
        <Field label="Model tạo ảnh"><input value={model} onChange={(event) => setModel(event.target.value)} /></Field>
        <Field label="Model văn bản (soạn nháp)"><input value={textModel} onChange={(event) => setTextModel(event.target.value)} /></Field>
      </div>
      <Field label="API key"><input type="text" className="secret" name="api-key-new" data-lpignore="true" data-1p-ignore="true" autoComplete="off" value={apiKey} placeholder="Dán key tại đây" onChange={(event) => setApiKey(event.target.value)} /></Field>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="btn ghost" onClick={onClose}>Đóng</button><button className="btn primary" disabled={busy || !apiKey}>{busy ? 'Đang lưu…' : 'Thêm key'}</button></div>
    </form>
  </Modal>
}
