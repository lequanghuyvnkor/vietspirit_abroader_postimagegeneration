import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type ApiKey, type Session } from './lib/api.ts'
import { useStore } from './lib/store.ts'
import { navigate, parseRoute, type Route } from './lib/route.ts'
import { LoginView } from './views/LoginView.tsx'
import { WorkspacesView } from './views/WorkspacesView.tsx'
import { WorkspaceView } from './views/WorkspaceView.tsx'
import { CampaignView } from './views/CampaignView.tsx'
import { StudioView } from './views/StudioView.tsx'
import { PieceView } from './views/PieceView.tsx'
import { Modal } from './views/ui.tsx'
import { ApiKeysDialog } from './views/ApiKeysDialog.tsx'
import './App.css'

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { await api.changePassword(current, next); setDone(true); setMessage('Đã đổi mật khẩu.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không đổi được mật khẩu.') }
  }
  return <Modal title="Đổi mật khẩu" onClose={onClose}>
    <form onSubmit={submit} className="stack">
      <label className="field"><span className="field-label">Mật khẩu hiện tại</span><input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} /></label>
      <label className="field"><span className="field-label">Mật khẩu mới (từ 8 ký tự)</span><input type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} /></label>
      {message && <p className={done ? 'notice' : 'notice error'} role="status">{message}</p>}
      <div className="modal-actions"><button type="button" className="btn ghost" onClick={onClose}>Đóng</button><button className="btn primary" disabled={done || !current || next.length < 8}>Đổi mật khẩu</button></div>
    </form>
  </Modal>
}

function Studio({ onLogout }: { onLogout: () => void }) {
  const { store, update, saveState, loadError } = useStore()
  const route = useRoute()
  const [error, setError] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const [keys, setKeys] = useState<ApiKey[]>([])
  useEffect(() => { api.listKeys().then(setKeys).catch(() => setKeys([])) }, [])
  const reportError = useCallback((message: string) => setError(message), [])

  if (loadError) return <main className="auth-page"><p className="notice error">{loadError}</p></main>
  if (!store) return <main className="auth-page"><p className="muted">Đang tải…</p></main>

  const workspace = store.workspaces.find((item) => item.id === route.workspace)
  const campaign = workspace?.campaigns.find((item) => item.id === route.campaign)
  const post = campaign?.posts.find((item) => item.id === route.post)
  const piece = campaign?.pieces.find((item) => item.id === route.piece)

  let view
  if (workspace && campaign && piece && !post) view = <PieceView key={piece.id} update={update} workspace={workspace} campaign={campaign} piece={piece} keys={keys} onManageKeys={() => setKeysOpen(true)} onError={reportError} />
  else if (workspace && campaign && post) view = <StudioView key={post.id} update={update} workspace={workspace} campaign={campaign} post={post} keys={keys} onManageKeys={() => setKeysOpen(true)} onError={reportError} />
  else if (workspace && campaign) view = <CampaignView key={campaign.id} tab={route.tab} update={update} workspace={workspace} campaign={campaign} keys={keys} onManageKeys={() => setKeysOpen(true)} onError={reportError} />
  else if (workspace) view = <WorkspaceView key={workspace.id} store={store} update={update} workspace={workspace} onError={reportError} />
  else view = <WorkspacesView store={store} update={update} />

  const crumbs = [
    { label: 'Workspace', route: {} as Route },
    ...(workspace ? [{ label: workspace.name, route: { workspace: workspace.id } }] : []),
    ...(workspace && campaign ? [{ label: campaign.name, route: { workspace: workspace.id, campaign: campaign.id } }] : []),
    ...(workspace && campaign && piece ? [{ label: piece.code, route: { workspace: workspace.id, campaign: campaign.id, piece: piece.id } }] : []),
  ]

  return <div className="shell">
    <header className="topbar">
      <nav aria-label="Vị trí hiện tại" className="crumbs">
        {crumbs.map((crumb, index) => <span key={index}>{index > 0 && <i>/</i>}{index === crumbs.length - 1 && !post
          ? <strong>{crumb.label}</strong>
          : <button className="link" onClick={() => navigate(crumb.route)}>{crumb.label}</button>}</span>)}
      </nav>
      <div className="topbar-actions">
        <span className={`save ${saveState}`} role="status">{saveState === 'saving' ? 'Đang lưu…' : saveState === 'error' ? 'Lưu lỗi, thử lại' : 'Đã lưu'}</span>
        <button className="btn small" onClick={() => setKeysOpen(true)}>API{keys.length === 0 ? ' (chưa có key)' : ` (${keys.length})`}</button>
        <button className="btn small ghost" onClick={() => setPasswordOpen(true)}>Đổi mật khẩu</button>
        <button className="btn small ghost" onClick={onLogout}>Đăng xuất</button>
      </div>
    </header>
    {error && <div className="toast" role="alert"><span>{error}</span><button aria-label="Đóng thông báo" onClick={() => setError('')}>×</button></div>}
    <main>{view}</main>
    {keysOpen && <ApiKeysDialog keys={keys} onChange={setKeys} onClose={() => setKeysOpen(false)} />}
    {passwordOpen && <PasswordDialog onClose={() => setPasswordOpen(false)} />}
  </div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [fatal, setFatal] = useState('')
  const refresh = useCallback(() => { api.session().then(setSession).catch((error: Error) => setFatal(error.message)) }, [])
  useEffect(refresh, [refresh])

  if (fatal) return <main className="auth-page"><p className="notice error">{fatal}</p></main>
  if (!session) return <main className="auth-page"><p className="muted">Đang tải…</p></main>
  if (!session.authed) return <LoginView configured={session.configured} onDone={refresh} />
  return <Studio onLogout={() => { void api.logout().then(refresh) }} />
}
