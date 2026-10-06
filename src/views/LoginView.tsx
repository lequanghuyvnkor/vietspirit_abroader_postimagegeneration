import { useState, type FormEvent } from 'react'
import { api } from '../lib/api.ts'

export function LoginView({ configured, onDone }: { configured: boolean; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!configured && password !== confirm) { setError('Hai mật khẩu chưa khớp.'); return }
    setBusy(true)
    try {
      await (configured ? api.login(password) : api.setup(password))
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đăng nhập được.')
    } finally { setBusy(false) }
  }

  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <span className="eyebrow">Creative Studio</span>
      <h1>{configured ? 'Đăng nhập' : 'Đặt mật khẩu'}</h1>
      <p>{configured ? 'Nhập mật khẩu để mở các workspace.' : 'Lần đầu sử dụng: đặt mật khẩu cho ứng dụng (tối thiểu 8 ký tự). Mật khẩu được mã hóa và lưu trên máy này.'}</p>
      <label className="field"><span className="field-label">Mật khẩu</span>
        <input type="password" autoFocus autoComplete={configured ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {!configured && <label className="field"><span className="field-label">Nhập lại mật khẩu</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </label>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="btn primary" disabled={busy || !password}>{busy ? 'Đang xử lý…' : configured ? 'Đăng nhập' : 'Đặt mật khẩu và vào'}</button>
    </form>
  </main>
}
