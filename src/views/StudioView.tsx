import { useEffect, useRef, useState } from 'react'
import { FORMATS, formatOf, now } from '../lib/types.ts'
import type { Campaign, FormatKey, Post, Store, Workspace } from '../lib/types.ts'
import { assetUrl } from '../lib/api.ts'
import { exportPost, renderPost } from '../lib/render.ts'
import { navigate } from '../lib/route.ts'
import { Field, Section } from './ui.tsx'

type Props = {
  update: (change: (draft: Store) => void) => void
  workspace: Workspace
  campaign: Campaign
  post: Post
  onError: (message: string) => void
}

export function StudioView({ update, workspace, campaign, post, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [exporting, setExporting] = useState(false)
  const format = formatOf(post.format)

  function edit(change: (draft: Post) => void) {
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)
      const found = item?.campaigns.find((entry) => entry.id === campaign.id)
      const target = found?.posts.find((entry) => entry.id === post.id)
      if (item && found && target) { change(target); target.updatedAt = now(); found.updatedAt = target.updatedAt; item.updatedAt = target.updatedAt }
    })
  }
  const set = <K extends keyof Post>(key: K, value: Post[K]) => edit((draft) => { draft[key] = value })

  function setFormat(key: FormatKey) {
    edit((draft) => {
      draft.format = key
      const current = campaign.backgrounds.find((item) => item.id === draft.backgroundId)
      if (current?.format !== key) draft.backgroundId = campaign.backgrounds.find((item) => item.format === key)?.id ?? draft.backgroundId
    })
  }

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (canvas.current && !cancelled) renderPost(canvas.current, post, campaign, workspace).catch(() => onError('Không vẽ được bản xem trước.'))
    }, 120)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [post, campaign, workspace, onError])

  async function download() {
    setExporting(true)
    try { await exportPost(post, campaign, workspace) }
    catch (error) { onError(error instanceof Error ? error.message : 'Không xuất được ảnh.') }
    finally { setExporting(false) }
  }

  const backgrounds = [...campaign.backgrounds].sort((a, b) => Number(b.format === post.format) - Number(a.format === post.format))
  const maxPreviewHeight = 'min(72vh, 760px)'

  return <div className="page">
    <div className="page-head">
      <div>
        <button className="link" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id })}>← {campaign.name}</button>
        <h1>{post.name}</h1>
      </div>
      <button className="btn primary" disabled={exporting} onClick={() => { void download() }}>{exporting ? 'Đang xuất…' : `Xuất PNG ${format.width}×${format.height}`}</button>
    </div>
    <div className="studio">
      <div className="stack">
        <Section title="Nội dung bài đăng">
          <Field label="Tên bài (nội bộ)"><input value={post.name} onChange={(event) => set('name', event.target.value)} /></Field>
          <Field label="Khổ ảnh">
            <select value={post.format} onChange={(event) => setFormat(event.target.value as FormatKey)}>{FORMATS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          </Field>
          <Field label="Nhãn nhỏ phía trên"><input value={post.eyebrow} onChange={(event) => set('eyebrow', event.target.value)} /></Field>
          <Field label="Tiêu đề"><textarea rows={2} value={post.headline} onChange={(event) => set('headline', event.target.value)} /></Field>
          <Field label="Dòng nhấn (màu nhấn)" hint="Hiện ngay dưới tiêu đề, bằng màu nhấn của chiến dịch."><input value={post.accent} onChange={(event) => set('accent', event.target.value)} /></Field>
          <Field label="Câu dẫn"><textarea rows={3} value={post.subtitle} onChange={(event) => set('subtitle', event.target.value)} /></Field>
          <Field label="Nút kêu gọi (CTA)"><input value={post.cta} onChange={(event) => set('cta', event.target.value)} /></Field>
          <Field label="Dòng chân bài"><input value={post.footer} onChange={(event) => set('footer', event.target.value)} /></Field>
          <label className="check"><input type="checkbox" checked={post.scrim} onChange={(event) => set('scrim', event.target.checked)} /> Làm tối/sáng nhẹ mép trên và dưới để chữ dễ đọc</label>
        </Section>
        <Section title="Chọn nền">
          {backgrounds.length === 0
            ? <p className="notice">Chiến dịch chưa có nền. Quay lại chiến dịch để tạo hoặc tải nền; hiện dùng dải màu từ bảng màu.</p>
            : <div className="bg-pick">
              <button className={post.backgroundId === null ? 'selected' : ''} onClick={() => set('backgroundId', null)}><span className="none">Dải màu</span></button>
              {backgrounds.map((background) => <button key={background.id} className={post.backgroundId === background.id ? 'selected' : ''} onClick={() => set('backgroundId', background.id)} title={`${background.label} · ${formatOf(background.format).label}`}>
                <img src={assetUrl(background.assetId)} alt={background.label} />
                {background.format !== post.format && <small>{formatOf(background.format).label}</small>}
              </button>)}
            </div>}
        </Section>
      </div>
      <div className="preview">
        <canvas ref={canvas} style={{ aspectRatio: `${format.width} / ${format.height}`, maxHeight: maxPreviewHeight, maxWidth: '100%' }} aria-label="Xem trước bài đăng" />
        <small className="muted">Xem trước đúng bố cục khi xuất. Nền khác khổ ảnh sẽ được cắt vừa khung.</small>
      </div>
    </div>
  </div>
}
