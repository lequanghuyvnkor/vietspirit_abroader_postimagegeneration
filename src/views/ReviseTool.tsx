import { useState } from 'react'
import { api, type ApiKey } from '../lib/api.ts'
import { applyRevise, buildBackgroundEditPrompt, buildReviseRequest, parseRevise, type Region } from '../lib/revise.ts'
import { drawCover, loadImage, renderPost } from '../lib/render.ts'
import { formatOf, newId } from '../lib/types.ts'
import type { Campaign, Post, Workspace } from '../lib/types.ts'

type Props = {
  workspace: Workspace
  campaign: Campaign
  post: Post
  region: Region | null
  keys: ApiKey[]
  onManageKeys: () => void
  /** Changes the campaign and this post in one saved step. */
  commit: (change: (campaign: Campaign, post: Post) => void) => void
  onClear: () => void
}

type Step = { id: string; summary: string; before: Post; note: string }

const CHIPS = [
  'Chữ khó đọc ở vùng này, làm nền sau chữ tối và sạch hơn',
  'Bỏ các vật thể/thẻ/đường trong vùng này khỏi ảnh nền',
  'Làm vùng này tối và gọn hơn, ít chi tiết hơn',
  'Đẩy khối chữ xuống thấp hơn, tránh đè lên hình',
  'Thu nhỏ chữ một chút',
]

function drawRegion(ctx: CanvasRenderingContext2D, region: Region, width: number, height: number): void {
  ctx.save()
  ctx.strokeStyle = '#ff2d2d'
  ctx.lineWidth = Math.max(4, width / 160)
  ctx.strokeRect(region.x * width, region.y * height, region.w * width, region.h * height)
  ctx.restore()
}

/** The slide as drawn, downsized, with the chosen region outlined in red: what the AI looks at. */
function markedSlide(full: HTMLCanvasElement, region: Region): string {
  const ratio = Math.min(1, 900 / Math.max(full.width, full.height))
  const out = document.createElement('canvas')
  out.width = Math.round(full.width * ratio)
  out.height = Math.round(full.height * ratio)
  const ctx = out.getContext('2d')!
  ctx.drawImage(full, 0, 0, out.width, out.height)
  drawRegion(ctx, region, out.width, out.height)
  return out.toDataURL('image/jpeg', 0.85)
}

export function ReviseTool({ workspace, campaign, post, region, keys, onManageKeys, commit, onClear }: Props) {
  const [comment, setComment] = useState('')
  const [keyId, setKeyId] = useState('')
  const [allowBackground, setAllowBackground] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const activeKey = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]
  const hasBackground = Boolean(campaign.backgrounds.find((item) => item.id === post.backgroundId))

  /** Clean background plate at the post's size, plus a copy with the region outlined, for the image model. */
  async function editBackground(instruction: string, area: Region): Promise<string> {
    const background = campaign.backgrounds.find((item) => item.id === post.backgroundId)
    const image = await loadImage(background?.assetId ?? null)
    if (!image) throw new Error('Slide này chưa có ảnh nền để sửa.')
    const [width, height] = formatOf(post.format).generate
    const plate = document.createElement('canvas')
    plate.width = width
    plate.height = height
    drawCover(plate.getContext('2d')!, image, width, height)
    const marked = document.createElement('canvas')
    marked.width = width
    marked.height = height
    const mctx = marked.getContext('2d')!
    mctx.drawImage(plate, 0, 0)
    drawRegion(mctx, area, width, height)
    const [plateId, markedId] = await Promise.all([api.uploadAsset('plate.jpg', plate.toDataURL('image/jpeg', 0.92)), api.uploadAsset('marked.jpg', marked.toDataURL('image/jpeg', 0.92))])
    try {
      return await api.generate({ prompt: buildBackgroundEditPrompt(instruction, area, campaign.keyVisual.palette), width, height, quality: 'high', referenceIds: [plateId, markedId], keyId: activeKey?.id })
    } finally {
      void api.deleteAsset(plateId)
      void api.deleteAsset(markedId)
    }
  }

  async function apply() {
    if (!region || !comment.trim()) return
    setError('')
    const before = structuredClone(post)
    try {
      setBusy('AI đang đọc ghi chú và nhìn vùng bạn khoanh…')
      const full = document.createElement('canvas')
      await renderPost(full, post, campaign, workspace)
      const { system, prompt } = buildReviseRequest(post, region, comment.trim(), allowBackground && hasBackground)
      const { text } = await api.generateText({ system, prompt, json: true, keyId: activeKey?.id, images: [markedSlide(full, region)] })
      const plan = parseRevise(text)
      if (!allowBackground || !hasBackground) plan.background = null

      const next = applyRevise(post, plan)
      commit((_, target) => { Object.assign(target, { ...next, id: target.id }) })
      let note = ''

      if (plan.background) {
        setBusy('Đang sửa ảnh nền trong vùng đã khoanh (1–2 phút)…')
        try {
          const assetId = await editBackground(plan.background.instruction, region)
          commit((c, target) => {
            const old = c.backgrounds.find((item) => item.id === before.backgroundId)
            const id = newId()
            c.backgrounds.push({ id, assetId, format: target.format, label: `${old?.label ?? 'Nền'} · chỉnh` })
            target.backgroundId = id
          })
          note = 'Đã tạo phiên bản nền mới (nền cũ vẫn còn trong thư viện).'
        } catch (caught) {
          note = `Chưa sửa được ảnh nền: ${caught instanceof Error ? caught.message : 'lỗi'}. Các chỉnh sửa khác vẫn được áp dụng.`
        }
      }
      setSteps((list) => [{ id: newId(), summary: plan.summary, before, note }, ...list].slice(0, 6))
      setComment('')
      onClear()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không áp dụng được ghi chú.')
    } finally { setBusy('') }
  }

  function undo(step: Step) {
    // Optional fields that the revision added (anchor, scale, shades) are absent from `before`, so drop them explicitly.
    commit((_, target) => {
      for (const key of Object.keys(target)) if (!(key in step.before)) delete (target as unknown as Record<string, unknown>)[key]
      Object.assign(target, { ...step.before, id: target.id })
    })
    setSteps((list) => list.filter((item) => item.id !== step.id))
  }

  return <div className="revise">
    <h3>Chỉnh bằng ghi chú</h3>
    {keys.length === 0 && <p className="notice">Cần API key để AI hiểu ghi chú. <button className="link" onClick={onManageKeys}>Thêm API key</button></p>}
    {!region && <p className="muted">Kéo chuột trên ảnh để khoanh vùng cần chỉnh, rồi ghi chú bên dưới.</p>}
    {region && <>
      <p className="muted">Vùng đã chọn: {Math.round(region.w * 100)}% × {Math.round(region.h * 100)}% khung ảnh.</p>
      <textarea rows={3} aria-label="Ghi chú cho vùng đã khoanh" value={comment} placeholder="Ví dụ: bỏ các thẻ vé ở đây, nền tối hơn" onChange={(event) => setComment(event.target.value)} />
      <div className="chips-row">{CHIPS.map((chip) => <button key={chip} className="chip" onClick={() => setComment(chip)}>{chip}</button>)}</div>
      <div className="row wrap">
        {keys.length > 1 && <select aria-label="API dùng để chỉnh" value={activeKey?.id ?? ''} onChange={(event) => setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>}
        <label className="check"><input type="checkbox" checked={allowBackground} disabled={!hasBackground} onChange={(event) => setAllowBackground(event.target.checked)} /> Cho phép AI sửa ảnh nền (tính phí 1 ảnh)</label>
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy !== '' || !comment.trim() || keys.length === 0} onClick={() => { void apply() }}>{busy ? 'Đang chỉnh…' : 'Áp dụng chỉnh sửa'}</button>
        <button className="btn ghost" disabled={busy !== ''} onClick={onClear}>Bỏ vùng</button>
      </div>
    </>}
    {busy && <p className="notice" role="status">{busy}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {steps.length > 0 && <div className="steps">
      <strong>Đã chỉnh</strong>
      {steps.map((step) => <div className="step" key={step.id}>
        <span>{step.summary}{step.note && <small className="muted block">{step.note}</small>}</span>
        <button className="btn small ghost" disabled={busy !== ''} onClick={() => undo(step)}>Hoàn tác</button>
      </div>)}
    </div>}
  </div>
}
