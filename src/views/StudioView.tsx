import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { FORMATS, formatOf, newId, now } from '../lib/types.ts'
import type { Campaign, FormatKey, Layer, Post, Store, Workspace } from '../lib/types.ts'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragging = useRef<{ id: string; dx: number; dy: number } | null>(null)
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
      if (canvas.current && !cancelled) renderPost(canvas.current, post, campaign, workspace, { selectedLayerId: selectedId }).catch(() => onError('Không vẽ được bản xem trước.'))
    }, 120)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [post, campaign, workspace, selectedId, onError])

  const patchLayer = (id: string, change: Partial<Layer>) => edit((draft) => { const layer = draft.layers.find((item) => item.id === id); if (layer) Object.assign(layer, change) })

  function addLayer(componentId: string) {
    const layer: Layer = { id: newId(), componentId, x: 0.5, y: 0.5, w: 0.3, opacity: 1, rotation: 0 }
    edit((draft) => { draft.layers.push(layer) })
    setSelectedId(layer.id)
  }

  function removeLayer(id: string) {
    edit((draft) => { draft.layers = draft.layers.filter((item) => item.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }

  function pickLayer(event: PointerEvent<HTMLCanvasElement>) {
    const p = canvasPoint(event)
    const aspect = format.width / format.height
    for (let index = post.layers.length - 1; index >= 0; index--) {
      const layer = post.layers[index]
      const component = campaign.components.find((item) => item.id === layer.componentId)
      if (!component) continue
      const halfW = layer.w / 2
      const halfH = (layer.w * (component.height / component.width) * aspect) / 2
      if (Math.abs(p.x - layer.x) <= halfW && Math.abs(p.y - layer.y) <= halfH) {
        setSelectedId(layer.id)
        dragging.current = { id: layer.id, dx: layer.x - p.x, dy: layer.y - p.y }
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }
    }
    setSelectedId(null)
  }

  function dragLayer(event: PointerEvent<HTMLCanvasElement>) {
    const active = dragging.current
    if (!active) return
    const p = canvasPoint(event)
    patchLayer(active.id, { x: Math.min(1.2, Math.max(-0.2, p.x + active.dx)), y: Math.min(1.2, Math.max(-0.2, p.y + active.dy)) })
  }

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
        <Section title="Thành phần đồ họa">
          {campaign.components.length === 0
            ? <p className="notice">Chiến dịch chưa có thành phần. Vào chiến dịch, bấm "Cắt từ ảnh/PDF" để tạo.</p>
            : <>
              <div className="components small">
                {campaign.components.map((item) => <button key={item.id} className="comp-add" title={`Thêm ${item.name}`} onClick={() => addLayer(item.id)}><div className="checker"><img src={assetUrl(item.assetId)} alt={item.name} /></div></button>)}
              </div>
              {post.layers.length === 0 && <p className="muted">Bấm một thành phần để đặt lên bài, rồi kéo trên bản xem trước để di chuyển.</p>}
              <div className="list">
                {post.layers.map((layer) => {
                  const component = campaign.components.find((item) => item.id === layer.componentId)
                  return <div className={layer.id === selectedId ? 'layer selected' : 'layer'} key={layer.id}>
                    <div className="row">
                      <button className="list-main" onClick={() => setSelectedId(layer.id)}><strong>{component?.name ?? 'Đã xóa'}</strong></button>
                      <button className="btn small ghost" onClick={() => removeLayer(layer.id)}>Xóa</button>
                    </div>
                    {layer.id === selectedId && <div className="layer-controls">
                      <label className="field"><span className="field-label">Kích thước {Math.round(layer.w * 100)}%</span><input type="range" min={3} max={150} value={Math.round(layer.w * 100)} onChange={(event) => patchLayer(layer.id, { w: Number(event.target.value) / 100 })} /></label>
                      <label className="field"><span className="field-label">Độ đậm {Math.round(layer.opacity * 100)}%</span><input type="range" min={5} max={100} value={Math.round(layer.opacity * 100)} onChange={(event) => patchLayer(layer.id, { opacity: Number(event.target.value) / 100 })} /></label>
                      <label className="field"><span className="field-label">Xoay {layer.rotation}°</span><input type="range" min={-180} max={180} value={layer.rotation} onChange={(event) => patchLayer(layer.id, { rotation: Number(event.target.value) })} /></label>
                    </div>}
                  </div>
                })}
              </div>
            </>}
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
        <canvas ref={canvas} onPointerDown={pickLayer} onPointerMove={dragLayer} onPointerUp={() => { dragging.current = null }} onPointerCancel={() => { dragging.current = null }} style={{ aspectRatio: `${format.width} / ${format.height}`, maxHeight: maxPreviewHeight, maxWidth: '100%' }} aria-label="Xem trước bài đăng" />
        <small className="muted">Xem trước đúng bố cục khi xuất. Nền khác khổ ảnh sẽ được cắt vừa khung.</small>
      </div>
    </div>
  </div>
}
