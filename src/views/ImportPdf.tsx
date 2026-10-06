import { useRef, useState, type ChangeEvent } from 'react'
import { api } from '../lib/api.ts'
import { analyzePdf, downscaleDataUrl, type PdfAnalysis } from '../lib/pdf.ts'
import { safeColor } from '../lib/render.ts'
import { FORMATS, emptyKeyVisual, formatOf } from '../lib/types.ts'
import type { KeyVisual, Source } from '../lib/types.ts'
import { Field, Modal } from './ui.tsx'

export type ImportResult = { name: string; keyVisual: KeyVisual; sources: Source[] }

type Props = {
  /** Existing key visual to fill gaps from and to keep untouched fields (update mode). */
  base?: KeyVisual
  confirmLabel: string
  onApply: (result: ImportResult) => void
  onClose: () => void
}

const MAX_REFERENCES = 4

export function ImportPdf({ base, confirmLabel, onApply, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null)
  const [name, setName] = useState('')
  const [kv, setKv] = useState<KeyVisual>(base ?? emptyKeyVisual())
  const [paletteText, setPaletteText] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())

  async function open(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const result = await analyzePdf(file)
      const found = result.extracted
      const palette = found.palette.length >= 2 ? found.palette : result.sampledColors
      const samples = result.pages.filter((page) => page.format)
      const dark = found.textToneHint ?? (samples.length && samples.reduce((sum, page) => sum + page.luminance, 0) / samples.length < 0.5 ? 'light' : 'dark')
      setAnalysis(result)
      setName(result.title)
      setPaletteText(palette.join(', '))
      setPicked(new Set(samples.slice(0, MAX_REFERENCES).map((page) => page.index)))
      setKv((current) => ({
        ...current,
        concept: found.concept || current.concept,
        palette: palette.length ? palette : current.palette,
        accentColor: found.accentColor,
        textTone: dark,
        displayFont: found.displayFont || current.displayFont,
        displayFontAssetId: found.displayFont ? null : current.displayFontAssetId,
        bodyFont: found.bodyFont || current.bodyFont,
        avoid: found.avoid || current.avoid,
        guideline: found.guideline || current.guideline,
      }))
    } catch (caught) {
      setError(caught instanceof Error ? `Không đọc được PDF: ${caught.message}` : 'Không đọc được PDF.')
    } finally { setBusy(false) }
  }

  const set = <K extends keyof KeyVisual>(key: K, value: KeyVisual[K]) => setKv((current) => ({ ...current, [key]: value }))

  function toggle(index: number) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else if (next.size < MAX_REFERENCES) next.add(index)
      return next
    })
  }

  async function apply() {
    if (!analysis) return
    setBusy(true)
    setError('')
    try {
      const chosen = analysis.pages.filter((page) => picked.has(page.index))
      const ids = await Promise.all(chosen.map(async (page) => api.uploadAsset(`page-${page.index}.webp`, await downscaleDataUrl(page.dataUrl, 1800))))
      // Every page is kept at full resolution so components can be cut from it later.
      const sources = await Promise.all(analysis.pages.map(async (page): Promise<Source> => ({ id: crypto.randomUUID(), assetId: await api.uploadAsset(`source-${page.index}.webp`, page.dataUrl), label: `Trang ${page.index}` })))
      const palette = paletteText.split(/[,\s]+/).map((value) => value.trim().toUpperCase()).filter((value) => /^#[0-9A-F]{6}$/.test(value))
      base?.referenceIds.forEach((id) => { void api.deleteAsset(id) })
      onApply({ name: name.trim() || analysis.title || 'Chiến dịch mới', keyVisual: { ...kv, palette: palette.length ? palette : kv.palette, referenceIds: ids }, sources })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được ảnh từ PDF.')
      setBusy(false)
    }
  }

  return <Modal title="Nhập Key Visual từ PDF" onClose={onClose} wide>
    <input ref={input} type="file" accept="application/pdf" hidden onChange={open} />
    {!analysis && <div className="import-start">
      <p>Chọn file PDF key visual (guideline và các bài mẫu). App sẽ đọc màu, font, concept, mood và lấy các trang bài mẫu làm ảnh tham chiếu để tạo nền.</p>
      <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Đang đọc PDF…' : 'Chọn file PDF'}</button>
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {analysis && <div className="import-review">
      <p className="muted">Đã đọc {analysis.pages.length} trang. Kiểm tra và sửa thông tin trước khi áp dụng.</p>
      <Field label="Tên chiến dịch"><input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Ý tưởng chủ đạo"><textarea rows={4} value={kv.concept} onChange={(event) => set('concept', event.target.value)} /></Field>
      <div className="row wrap">
        <Field label="Bảng màu (HEX, cách nhau bằng dấu phẩy)">
          <input value={paletteText} onChange={(event) => setPaletteText(event.target.value)} />
          <div className="chips">{paletteText.split(/[,\s]+/).filter((value) => /^#[0-9a-f]{6}$/i.test(value)).map((hex) => <i key={hex} style={{ background: hex }} title={hex} />)}</div>
        </Field>
        <Field label="Màu nhấn"><div className="swatch"><input type="color" value={safeColor(kv.accentColor, '#FF4D5E')} onChange={(event) => set('accentColor', event.target.value)} /><input value={kv.accentColor} maxLength={7} onChange={(event) => set('accentColor', event.target.value)} /></div></Field>
      </div>
      <div className="row wrap">
        <Field label="Font tiêu đề"><input value={kv.displayFont} onChange={(event) => set('displayFont', event.target.value)} /></Field>
        <Field label="Font nội dung"><input value={kv.bodyFont} onChange={(event) => set('bodyFont', event.target.value)} /></Field>
        <Field label="Chữ trên nền">
          <select value={kv.textTone} onChange={(event) => set('textTone', event.target.value as KeyVisual['textTone'])}><option value="light">Chữ sáng (nền tối)</option><option value="dark">Chữ tối (nền sáng)</option></select>
        </Field>
      </div>
      <Field label="Điều cần tránh"><textarea rows={2} value={kv.avoid} onChange={(event) => set('avoid', event.target.value)} /></Field>
      <Field label="Guideline (đồ họa, bố cục, mood) dùng khi tạo nền"><textarea rows={5} value={kv.guideline} onChange={(event) => set('guideline', event.target.value)} /></Field>

      <div className="field">
        <span className="field-label">Trang làm ảnh tham chiếu (tối đa {MAX_REFERENCES})</span>
        <div className="pdf-pages">
          {analysis.pages.map((page) => <button key={page.index} className={picked.has(page.index) ? 'pdf-page selected' : 'pdf-page'} onClick={() => toggle(page.index)} aria-pressed={picked.has(page.index)} title={page.format ? 'Bài mẫu' : 'Trang guideline'}>
            <img src={page.thumb} alt={`Trang ${page.index}`} />
            <small>Trang {page.index} · {page.format ? formatOf(page.format).label : 'Guideline'}</small>
          </button>)}
        </div>
        <small className="muted">Bài mẫu có chữ in sẵn nên không dùng trực tiếp làm nền; AI dùng chúng để học phong cách rồi tạo nền sạch chữ ({FORMATS.map((format) => format.label.split(' ')[0]).join(', ')}).</small>
      </div>
    </div>}
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      {analysis && <><button className="btn" disabled={busy} onClick={() => input.current?.click()}>Chọn PDF khác</button>
        <button className="btn primary" disabled={busy} onClick={() => { void apply() }}>{busy ? 'Đang lưu…' : confirmLabel}</button></>}
    </div>
  </Modal>
}
