import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { FORMATS, formatOf, newId, now } from '../lib/types.ts'
import type { Campaign, FormatKey, Layer, PieceAsset, Post, Store, Workspace } from '../lib/types.ts'
import { assetUrl, type ApiKey } from '../lib/api.ts'
import type { Annotation, Region } from '../lib/revise.ts'
import { componentFor, imageSize } from '../lib/assets.ts'
import { chooseVersion } from '../lib/variants.ts'
import { exportPost, renderPost } from '../lib/render.ts'
import { navigate } from '../lib/route.ts'
import { unresolvedIn } from '../lib/text.ts'
import { Field, Lightbox, Section } from './ui.tsx'
import { ReviseTool } from './ReviseTool.tsx'
import { LogoPanel } from './LogoPanel.tsx'
import { HeroPanel } from './HeroPanel.tsx'

type Props = {
  update: (change: (draft: Store) => void) => void
  workspace: Workspace
  campaign: Campaign
  post: Post
  keys: ApiKey[]
  onManageKeys: () => void
  onError: (message: string) => void
}

export function StudioView({ update, workspace, campaign, post, keys, onManageKeys, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [exporting, setExporting] = useState(false)
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragging = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [annotate, setAnnotate] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [draftRegion, setDraftRegion] = useState<Region | null>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const draftRef = useRef<Region | null>(null)
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

  function applyLogoToAll(logo: NonNullable<Post['logo']>) {
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)
      const found = item?.campaigns.find((entry) => entry.id === campaign.id)
      if (!item || !found) return
      for (const target of found.posts) target.logo = { ...logo }
      found.updatedAt = now()
      item.updatedAt = found.updatedAt
    })
  }

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

  /** Applies a change to the campaign and this post together (used by the comment tool, which can add a background). */
  function commit(change: (draftCampaign: Campaign, target: Post) => void) {
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)
      const found = item?.campaigns.find((entry) => entry.id === campaign.id)
      const target = found?.posts.find((entry) => entry.id === post.id)
      if (item && found && target) { change(found, target); target.updatedAt = now(); found.updatedAt = target.updatedAt; item.updatedAt = target.updatedAt }
    })
  }

  const overlayPoint = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) }
  }
  function startRegion(event: PointerEvent<HTMLDivElement>) {
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already released */ }
    drawing.current = overlayPoint(event)
    draftRef.current = null
    setDraftRegion(null)
  }
  function moveRegion(event: PointerEvent<HTMLDivElement>) {
    const start = drawing.current
    if (!start) return
    const p = overlayPoint(event)
    const next = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
    draftRef.current = next
    setDraftRegion(next)
  }
  function endRegion() {
    drawing.current = null
    const region = draftRef.current
    draftRef.current = null
    setDraftRegion(null)
    if (region && region.w >= 0.03 && region.h >= 0.03) setAnnotations((list) => [...list, { id: newId(), region, comment: '' }])
  }

  /** Campaign-wide change in one saved step (the comment tool can touch several slides and add backgrounds). */
  function mutate(change: (draftCampaign: Campaign) => void) {
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)
      const found = item?.campaigns.find((entry) => entry.id === campaign.id)
      if (item && found) { change(found); found.updatedAt = now(); item.updatedAt = found.updatedAt }
    })
  }

  const piece = campaign.pieces.find((item) => item.id === post.pieceId)
  const pieceAssets = (piece?.assets ?? []).filter((asset) => asset.assetId)
  async function addAssetLayer(asset: PieceAsset) {
    try {
      const size = await imageSize(asset.assetId!)
      const layerId = newId()
      commit((c, target) => { const component = componentFor(c, asset.assetId!, asset.label, size); target.layers.push({ id: layerId, componentId: component.id, x: 0.5, y: 0.58, w: 0.45, opacity: 1, rotation: 0 }) })
      setSelectedId(layerId)
    } catch (error) { onError(error instanceof Error ? error.message : 'Không thêm được ảnh.') }
  }

  // Moving or editing a graphic makes it the user's: the app will not replace it when it places graphics again.
  const patchLayer = (id: string, change: Partial<Layer>) => edit((draft) => { const layer = draft.layers.find((item) => item.id === id); if (layer) { Object.assign(layer, change); delete layer.auto } })

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
  const maxPreviewHeight = 'max(320px, min(72vh, 760px))'
  const unresolved = [...new Set([post.eyebrow, post.headline, post.accent, post.subtitle, post.cta, post.footer].flatMap((text) => unresolvedIn(text, campaign.variables)))]

  return <div className="page">
    <div className="page-head">
      <div>
        <button className="link" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: post.pieceId })}>← {post.pieceId ? (campaign.pieces.find((item) => item.id === post.pieceId)?.code ?? campaign.name) : campaign.name}</button>
        <h1>{post.name}</h1>
        {post.variantOf && <p className="row wrap"><span className="flag info">Bản chỉnh · {post.excluded ? 'chưa được dùng khi xuất' : 'đang được dùng khi xuất'}</span>{post.excluded && <button className="btn small" onClick={() => mutate((c) => chooseVersion(c, post.id))}>Dùng bản này</button>}</p>}
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
          {piece?.kind === 'reel' && <Field label="Thời lượng cảnh (giây)" hint="Tổng thời lượng Reel là tổng các cảnh."><input type="number" min={1} max={30} step={0.5} value={post.duration ?? 3} onChange={(event) => set('duration', Math.min(30, Math.max(1, Number(event.target.value) || 3)))} /></Field>}
          <Field label="Nhãn nhỏ phía trên"><input value={post.eyebrow} onChange={(event) => set('eyebrow', event.target.value)} /></Field>
          <Field label="Tiêu đề"><textarea rows={2} value={post.headline} onChange={(event) => set('headline', event.target.value)} /></Field>
          <Field label="Dòng nhấn (màu nhấn)" hint="Hiện ngay dưới tiêu đề, bằng màu nhấn của chiến dịch."><input value={post.accent} onChange={(event) => set('accent', event.target.value)} /></Field>
          <Field label="Câu dẫn"><textarea rows={3} value={post.subtitle} onChange={(event) => set('subtitle', event.target.value)} /></Field>
          <Field label="Nút kêu gọi (CTA)"><input value={post.cta} onChange={(event) => set('cta', event.target.value)} /></Field>
          <Field label="Chân bài" hint="Nhiều dòng được (Enter để xuống dòng)."><textarea rows={2} value={post.footer} onChange={(event) => set('footer', event.target.value)} /></Field>
          {post.pieceId && <HeroPanel campaign={campaign} post={post} edit={edit} />}
          <LogoPanel workspace={workspace} campaign={campaign} post={post} keys={keys} edit={edit} onError={onError} applyToAll={applyLogoToAll} />
          <label className="check"><input type="checkbox" checked={post.scrim} onChange={(event) => set('scrim', event.target.checked)} /> Làm tối/sáng nhẹ mép trên và dưới để chữ dễ đọc</label>
          <label className="check"><input type="checkbox" checked={post.panel === true} onChange={(event) => set('panel', event.target.checked)} /> Tấm kính mờ sau chữ (dùng khi nền không có chỗ êm cho chữ)</label>
          <label className="check"><input type="checkbox" checked={post.chrome !== false} onChange={(event) => set('chrome', event.target.checked)} /> Chấm trang và mũi tên vuốt (chỉ hiện với bài nhiều slide)</label>
        </Section>
        <Section title="Thành phần đồ họa">
          {pieceAssets.length > 0 && <div className="field">
            <span className="field-label">Ảnh thật của bài (từ mục Tài nguyên)</span>
            <div className="components small">{pieceAssets.map((asset) => <button key={asset.id} className="comp-add" title={`Thêm ${asset.label}`} onClick={() => { void addAssetLayer(asset) }}><div className="checker"><img src={assetUrl(asset.assetId!)} alt={asset.label} /></div></button>)}</div>
          </div>}
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
              {backgrounds.map((background) => <div className="bg-pick-item" key={background.id}>
                <button className={post.backgroundId === background.id ? 'selected' : ''} onClick={() => set('backgroundId', background.id)} title={`${background.label} · ${formatOf(background.format).label}`}>
                  <img src={assetUrl(background.assetId)} alt={background.label} />
                  {background.format !== post.format && <small>{formatOf(background.format).label}</small>}
                </button>
                <button className="zoom-btn" aria-label={`Xem lớn ${background.label}`} onClick={() => setViewer({ src: assetUrl(background.assetId), title: `${background.label} · ${formatOf(background.format).label}` })}>⤢</button>
              </div>)}
            </div>}
        </Section>
      </div>
      {viewer && <Lightbox src={viewer.src} title={viewer.title} onClose={() => setViewer(null)} />}
      <div className="preview">
        {/* The wrapper gets an explicit width (fit the height cap, never wider than the column) so it cannot collapse. */}
        <div className="canvas-wrap" style={{ width: `min(100%, calc(${maxPreviewHeight} * ${format.width / format.height}))` }}>
          <canvas ref={canvas} onPointerDown={pickLayer} onPointerMove={dragLayer} onPointerUp={() => { dragging.current = null }} onPointerCancel={() => { dragging.current = null }} style={{ aspectRatio: `${format.width} / ${format.height}`, width: '100%', height: 'auto' }} aria-label="Xem trước bài đăng" />
          {annotate && <div className="region-overlay" onPointerDown={startRegion} onPointerMove={moveRegion} onPointerUp={endRegion} onPointerCancel={endRegion} aria-label="Kéo để khoanh vùng cần chỉnh">
            {annotations.map((item, index) => <div className="region-box" key={item.id} style={{ left: `${item.region.x * 100}%`, top: `${item.region.y * 100}%`, width: `${item.region.w * 100}%`, height: `${item.region.h * 100}%` }}><span>{index + 1}</span></div>)}
            {draftRegion && <div className="region-box draft" style={{ left: `${draftRegion.x * 100}%`, top: `${draftRegion.y * 100}%`, width: `${draftRegion.w * 100}%`, height: `${draftRegion.h * 100}%` }} />}
          </div>}
        </div>
        <button className={annotate ? 'btn primary' : 'btn'} aria-pressed={annotate} onClick={() => { setAnnotate((on) => !on); setAnnotations([]); setDraftRegion(null) }}>{annotate ? 'Tắt ghi chú vùng' : 'Khoanh vùng + ghi chú để chỉnh'}</button>
        {annotate && <ReviseTool workspace={workspace} campaign={campaign} post={post} annotations={annotations} setAnnotations={setAnnotations} keys={keys} onManageKeys={onManageKeys} mutate={mutate} />}
        {unresolved.length > 0 && <small className="notice">Chưa điền biến: {unresolved.map((key) => `[${key}]`).join(', ')}. Điền ở mục "Biến chiến dịch" của chiến dịch; ảnh xuất sẽ còn nguyên dấu [ ].</small>}
        <small className="muted">Xem trước đúng bố cục khi xuất. Nền khác khổ ảnh sẽ được cắt vừa khung.</small>
      </div>
    </div>
  </div>
}
