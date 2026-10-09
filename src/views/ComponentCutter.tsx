import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { api, assetUrl, uploadImage } from '../lib/api.ts'
import { contentBox, findComponents, removeBackground, type Box } from '../lib/cutout.ts'
import { loadImage } from '../lib/render.ts'
import type { Component, Source } from '../lib/types.ts'
import { Modal } from './ui.tsx'

type Props = {
  sources: Source[]
  onAddSource: (source: Source) => void
  onSave: (components: Component[]) => void
  onClose: () => void
}

type Candidate = { id: string; name: string; preview: string; width: number; height: number; checked: boolean }

const MAX_CANDIDATES = 40

function toCanvas(pixels: { data: Uint8ClampedArray; width: number; height: number }, box: Box): HTMLCanvasElement {
  const full = document.createElement('canvas')
  full.width = pixels.width
  full.height = pixels.height
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(box.w))
  out.height = Math.max(1, Math.round(box.h))
  out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height)
  return out
}

export function ComponentCutter({ sources, onAddSource, onSave, onClose }: Props) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '')
  const source = sources.find((item) => item.id === sourceId)
  const [loaded, setLoaded] = useState<{ id: string; w: number; h: number } | null>(null)
  const size = loaded && loaded.id === sourceId ? loaded : null
  const [rect, setRect] = useState<Box | null>(null)
  const [mode, setMode] = useState<'cut' | 'keep'>('cut')
  const [threshold, setThreshold] = useState(34)
  const [softness, setSoftness] = useState(40)
  const [gap, setGap] = useState(14)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const upload = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!source) return
    let alive = true
    void loadImage(source.assetId).then((image) => { if (alive && image) setLoaded({ id: source.id, w: image.naturalWidth, h: image.naturalHeight }) })
    return () => { alive = false }
  }, [source])

  function selectSource(id: string) {
    setSourceId(id)
    setRect(null)
    setCandidates([])
  }

  const point = (event: PointerEvent): { x: number; y: number } => {
    const box = stage.current!.getBoundingClientRect()
    return { x: Math.min(size!.w, Math.max(0, ((event.clientX - box.left) / box.width) * size!.w)), y: Math.min(size!.h, Math.max(0, ((event.clientY - box.top) / box.height) * size!.h)) }
  }
  const down = (event: PointerEvent) => { if (!size) return; try { stage.current!.setPointerCapture(event.pointerId) } catch { /* pointer already released */ }; drag.current = point(event); setRect(null); setCandidates([]) }
  const move = (event: PointerEvent) => {
    if (!drag.current) return
    const p = point(event)
    setRect({ x: Math.min(p.x, drag.current.x), y: Math.min(p.y, drag.current.y), w: Math.abs(p.x - drag.current.x), h: Math.abs(p.y - drag.current.y) })
  }
  const up = () => { drag.current = null; setRect((current) => (current && (current.w < 12 || current.h < 12) ? null : current)) }

  async function analyze(multiple: boolean) {
    if (!rect || !source) return
    setBusy(true)
    setError('')
    try {
      const image = await loadImage(source.assetId)
      if (!image) throw new Error('Không mở được ảnh nguồn.')
      const crop = document.createElement('canvas')
      crop.width = Math.round(rect.w)
      crop.height = Math.round(rect.h)
      const ctx = crop.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(image, Math.round(rect.x), Math.round(rect.y), crop.width, crop.height, 0, 0, crop.width, crop.height)
      const original = ctx.getImageData(0, 0, crop.width, crop.height)
      const cut = removeBackground(original, { threshold, softness })
      const boxes: Box[] = multiple
        ? findComponents(cut, gap, 20).slice(0, MAX_CANDIDATES)
        : (mode === 'cut' ? [contentBox(cut) ?? { x: 0, y: 0, w: crop.width, h: crop.height }] : [{ x: 0, y: 0, w: crop.width, h: crop.height }])
      const result = boxes.map((box, index): Candidate => {
        const canvas = toCanvas(mode === 'cut' ? cut : original, box)
        return { id: crypto.randomUUID(), name: `Thành phần ${index + 1}`, preview: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, checked: true }
      })
      if (!result.length) setError('Không tìm thấy thành phần nào. Thử giảm "Độ nhạy" hoặc khoanh vùng khác.')
      setCandidates(result)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không cắt được.') }
    finally { setBusy(false) }
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const chosen = candidates.filter((item) => item.checked)
      const saved = await Promise.all(chosen.map(async (item): Promise<Component> => ({ id: crypto.randomUUID(), name: item.name.trim() || 'Thành phần', assetId: await api.uploadAsset(`${item.name}.png`, item.preview), width: item.width, height: item.height })))
      onSave(saved)
      onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không lưu được.'); setBusy(false) }
  }

  async function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const next: Source = { id: crypto.randomUUID(), assetId: await uploadImage(file, 3000), label: file.name }
      onAddSource(next)
      selectSource(next.id)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không tải được ảnh.') }
  }

  const selection = rect && size ? { left: `${(rect.x / size.w) * 100}%`, top: `${(rect.y / size.h) * 100}%`, width: `${(rect.w / size.w) * 100}%`, height: `${(rect.h / size.h) * 100}%` } : null
  const chosenCount = candidates.filter((item) => item.checked).length

  return <Modal title="Cắt thành phần đồ họa" onClose={onClose} wide>
    <p className="muted">Chọn một trang, kéo chuột khoanh vùng quanh phần tử (viền khoanh nên chỉ chứa nền), rồi cắt. Viền nền được xóa để giữ lại riêng thành phần.</p>
    <div className="row wrap">
      {sources.map((item) => <button key={item.id} className={item.id === sourceId ? 'btn small primary' : 'btn small'} onClick={() => selectSource(item.id)}>{item.label}</button>)}
      <button className="btn small ghost" onClick={() => upload.current?.click()}>+ Tải ảnh khác</button>
      <input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={addImage} />
    </div>
    {!source && <p className="notice">Chưa có ảnh nguồn. Nhập moodboard từ PDF hoặc tải một ảnh lên.</p>}
    {source && <div className="cutter">
      <div className="cutter-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img src={assetUrl(source.assetId)} alt={source.label} draggable={false} />
        {selection && <div className="cutter-sel" style={selection} />}
      </div>
      <div className="cutter-tools">
        <div className="row wrap">
          <label className="check"><input type="radio" name="mode" checked={mode === 'cut'} onChange={() => setMode('cut')} /> Cắt nền</label>
          <label className="check"><input type="radio" name="mode" checked={mode === 'keep'} onChange={() => setMode('keep')} /> Giữ nguyên nền (thẻ, khung)</label>
        </div>
        <label className="field"><span className="field-label">Độ nhạy cắt nền: {threshold}</span><input type="range" min={5} max={90} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
        <label className="field"><span className="field-label">Độ mềm viền: {softness}</span><input type="range" min={5} max={120} value={softness} onChange={(event) => setSoftness(Number(event.target.value))} /></label>
        <label className="field"><span className="field-label">Độ gộp khi tự tách: {gap}px</span><input type="range" min={0} max={80} value={gap} onChange={(event) => setGap(Number(event.target.value))} /></label>
        <div className="row wrap">
          <button className="btn" disabled={!rect || busy} onClick={() => { void analyze(false) }}>Cắt vùng này thành 1 thành phần</button>
          <button className="btn primary" disabled={!rect || busy} onClick={() => { void analyze(true) }}>Tự tách nhiều thành phần</button>
        </div>
        {!rect && <p className="muted">Kéo chuột trên ảnh để khoanh vùng.</p>}
      </div>
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {candidates.length > 0 && <div className="field">
      <span className="field-label">Kết quả ({chosenCount}/{candidates.length} được chọn)</span>
      <div className="candidates">
        {candidates.map((item) => <div className={item.checked ? 'candidate on' : 'candidate'} key={item.id}>
          <label className="check"><input type="checkbox" checked={item.checked} onChange={(event) => setCandidates((list) => list.map((entry) => entry.id === item.id ? { ...entry, checked: event.target.checked } : entry))} /> {item.width}×{item.height}</label>
          <div className="checker candidate-preview"><img src={item.preview} alt={item.name} /></div>
          <input value={item.name} aria-label="Tên thành phần" onChange={(event) => setCandidates((list) => list.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} />
        </div>)}
      </div>
    </div>}
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Đóng</button>
      <button className="btn primary" disabled={busy || chosenCount === 0} onClick={() => { void save() }}>{busy ? 'Đang xử lý…' : `Lưu ${chosenCount} thành phần`}</button>
    </div>
  </Modal>
}
