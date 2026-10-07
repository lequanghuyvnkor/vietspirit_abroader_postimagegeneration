import { useState } from 'react'
import { suggestLogo, POSITION_LABELS } from '../lib/logoAi.ts'
import type { ApiKey } from '../lib/api.ts'
import type { Campaign, LogoPlacement, Post, Workspace } from '../lib/types.ts'

type Props = {
  workspace: Workspace
  campaign: Campaign
  post: Post
  keys: ApiKey[]
  edit: (change: (draft: Post) => void) => void
  /** Copies this post's logo settings to every post of the campaign. */
  applyToAll: (logo: LogoPlacement) => void
  onError: (message: string) => void
}

export function LogoPanel({ workspace, campaign, post, keys, edit, applyToAll, onError }: Props) {
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const logo = post.logo ?? {}
  const key = keys.find((item) => item.isDefault) ?? keys[0]
  const set = (change: Partial<LogoPlacement>) => edit((draft) => { draft.logo = { ...draft.logo, ...change } })
  const hasDark = Boolean(workspace.company.logoDarkId)

  async function ask() {
    setBusy(true)
    setReason('')
    try {
      const { reason: why, ...placement } = await suggestLogo(workspace, campaign, post, key?.id)
      edit((draft) => { draft.logo = { position: placement.position, scale: placement.scale, variant: hasDark ? placement.variant : undefined, hidden: placement.hidden } })
      setReason(why)
    } catch (error) { onError(error instanceof Error ? error.message : 'AI không chọn được vị trí logo.') }
    finally { setBusy(false) }
  }

  return <div className="field">
    <span className="field-label">Logo</span>
    <div className="row wrap">
      <button className="btn small primary" disabled={busy || !key || !workspace.company.logoId} onClick={() => void ask()} title={key ? 'AI nhìn bài và chọn vị trí, cỡ và bản logo' : 'Cần thêm API key'}>{busy ? 'AI đang chọn…' : 'AI chọn vị trí logo'}</button>
      <button className="btn small ghost" onClick={() => edit((draft) => { delete draft.logo })}>Mặc định</button>
      <button className="btn small ghost" onClick={() => applyToAll(logo)}>Dùng cho mọi bài trong chiến dịch</button>
    </div>
    {reason && <small className="muted">AI: {reason}</small>}
    <div className="row wrap">
      <select aria-label="Vị trí logo" value={logo.hidden ? 'hidden' : logo.position ?? 'top-left'} onChange={(event) => event.target.value === 'hidden' ? set({ hidden: true }) : set({ hidden: false, position: event.target.value as LogoPlacement['position'] })}>
        {(Object.keys(POSITION_LABELS) as (keyof typeof POSITION_LABELS)[]).map((position) => <option key={position} value={position}>{POSITION_LABELS[position]}</option>)}
        <option value="hidden">Ẩn logo</option>
      </select>
      {hasDark && <select aria-label="Bản logo" value={logo.variant ?? 'auto'} onChange={(event) => set({ variant: event.target.value === 'auto' ? undefined : event.target.value as 'light' | 'dark' })}>
        <option value="auto">Bản logo: tự theo nền</option>
        <option value="light">Bản cho nền sáng</option>
        <option value="dark">Bản cho nền tối</option>
      </select>}
    </div>
    <label className="field"><span className="field-label">Cỡ logo ×{(logo.scale ?? 1).toFixed(1)}</span><input type="range" min={0.5} max={2} step={0.1} value={logo.scale ?? 1} onChange={(event) => set({ scale: Number(event.target.value) })} /></label>
  </div>
}
