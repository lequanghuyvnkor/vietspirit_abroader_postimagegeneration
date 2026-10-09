import { useRef, useState, type ChangeEvent } from 'react'
import { api } from '../lib/api.ts'
import { analyzePdf, downscaleDataUrl, type FoundComponent, type PdfAnalysis } from '../lib/pdf.ts'
import { safeColor } from '../lib/render.ts'
import { FORMATS, emptyKeyVisual, formatOf } from '../lib/types.ts'
import type { Component, KeyVisual, Source } from '../lib/types.ts'
import { Field, Modal } from './ui.tsx'

export type ImportResult = { name: string; keyVisual: KeyVisual; sources: Source[]; components: Component[]; logos: { light: string | null; dark: string | null } }

type Props = {
  /** Existing key visual to fill gaps from and to keep untouched fields (update mode). */
  base?: KeyVisual
  confirmLabel: string
  /** Names of components the campaign already has (a re-import skips pieces with the same name). */
  componentNames?: string[]
  onApply: (result: ImportResult) => void
  onClose: () => void
}

const MAX_REFERENCES = 4

export function ImportPdf({ base, confirmLabel, componentNames = [], onApply, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null)
  const [name, setName] = useState('')
  const [kv, setKv] = useState<KeyVisual>(base ?? emptyKeyVisual())
  const [paletteText, setPaletteText] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [found, setFound] = useState<FoundComponent[]>([])
  const [heroes, setHeroes] = useState<Set<string>>(new Set())
  const [roles, setRoles] = useState<Record<string, 'light' | 'dark' | ''>>({})
  // Re-importing into an existing campaign must not silently replace work done since: every part is an explicit choice.
  const updating = Boolean(base)
  const [applyLook, setApplyLook] = useState(true)
  const [replaceRefs, setReplaceRefs] = useState(!updating)
  const [addComponents, setAddComponents] = useState(true)
  const [setLogos, setSetLogos] = useState(!updating)

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
      const all = result.pages.flatMap((page) => page.components)
      setFound(all)
      setHeroes(new Set(all.filter((entry) => entry.hero).map((entry) => entry.id)))
      // Logo lockups found in the LOGO section: a light card is the light-background logo, a dark card the dark one.
      const guess: Record<string, 'light' | 'dark' | ''> = {}
      for (const item of all.filter((entry) => entry.logo)) guess[item.id] = ''
      setRoles(guess)
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
      const keepRefs = updating && !replaceRefs
      const ids = keepRefs ? [] : await Promise.all(chosen.map(async (page) => api.uploadAsset(`page-${page.index}.webp`, await downscaleDataUrl(page.dataUrl, 1800))))
      // Every page is kept at full resolution so components can be cut from it later.
      const existingNames = new Set(componentNames.map((item) => item.trim().toLowerCase()))
      const chosenComponents = !addComponents ? [] : found.filter((item) => item.checked && !roles[item.id] && !(updating && existingNames.has(item.name.trim().toLowerCase())))
      const heroIds = await Promise.all(found.filter((item) => addComponents && item.checked && heroes.has(item.id) && !roles[item.id]).map((item) => api.uploadAsset(`${item.name}-hero.png`, item.preview)))
      const logoUploads = await Promise.all(found.filter((item) => item.checked && roles[item.id]).map(async (item) => ({ role: roles[item.id], assetId: await api.uploadAsset(`${item.name}.png`, item.preview) })))
      const logos = setLogos ? { light: logoUploads.find((entry) => entry.role === 'light')?.assetId ?? null, dark: logoUploads.find((entry) => entry.role === 'dark')?.assetId ?? null } : { light: null, dark: null }
      const components = await Promise.all(chosenComponents.map(async (item): Promise<Component> => ({ id: crypto.randomUUID(), name: item.name.trim() || 'Thành phần', assetId: await api.uploadAsset(`${item.name}.png`, item.preview), width: item.width, height: item.height })))
      const sources = await Promise.all(analysis.pages.map(async (page): Promise<Source> => ({ id: crypto.randomUUID(), assetId: await api.uploadAsset(`source-${page.index}.webp`, page.dataUrl), label: `Trang ${page.index}` })))
      const palette = paletteText.split(/[,\s]+/).map((value) => value.trim().toUpperCase()).filter((value) => /^#[0-9A-F]{6}$/.test(value))
      if (!keepRefs) base?.referenceIds.forEach((id) => { void api.deleteAsset(id) })
      const look = updating && !applyLook ? base! : kv
      onApply({ name: updating ? '' : name.trim() || analysis.title || 'Chiến dịch mới', keyVisual: { ...look, palette: updating && !applyLook ? look.palette : palette.length ? palette : look.palette, referenceIds: keepRefs ? base!.referenceIds : ids, subjectIds: [...(look.subjectIds ?? []), ...heroIds] }, sources, components, logos })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được ảnh từ PDF.')
      setBusy(false)
    }
  }

  return <Modal title="Nhập Key Visual từ PDF" onClose={onClose} wide>
    <input ref={input} type="file" accept="application/pdf" hidden onChange={open} />
    {!analysis && <div className="import-start">
      <p>Chọn file PDF key visual (guideline và các bài mẫu). App tự đọc màu, font, concept, tự cắt các thành phần đồ họa (sao, đường bay, thẻ, logo…) ra khỏi nền, và lấy các trang bài mẫu làm ảnh tham chiếu để tạo nền.</p>
      <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Đang đọc PDF…' : 'Chọn file PDF'}</button>
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {analysis && <div className="import-review">
      <p className="muted">Đã đọc {analysis.pages.length} trang. Kiểm tra và sửa thông tin trước khi áp dụng.</p>
      <p className="notice">Key visual chỉ cập nhật <b>Moodboard</b> (màu, font, mô tả không khí, ảnh tham chiếu, thành phần đồ họa). Không đổi <b>Nền tảng</b> (mục tiêu, thông điệp, trụ cột) và không đổi <b>Kế hoạch</b> (các bài).</p>
      {!updating && <Field label="Tên chiến dịch"><input value={name} onChange={(event) => setName(event.target.value)} /></Field>}
      {updating && <div className="field">
        <span className="field-label">Áp dụng những phần nào vào chiến dịch này</span>
        <label className="check"><input type="checkbox" checked={applyLook} onChange={(event) => setApplyLook(event.target.checked)} /> Màu, font, mô tả không khí, điều cần tránh (thay giá trị hiện có ở tab Moodboard)</label>
        <label className="check"><input type="checkbox" checked={addComponents} onChange={(event) => setAddComponents(event.target.checked)} /> Thêm thành phần đồ họa đã tích (bỏ qua mảnh trùng tên với thành phần đang có)</label>
        <label className="check"><input type="checkbox" checked={replaceRefs} onChange={(event) => setReplaceRefs(event.target.checked)} /> Thay các ảnh moodboard đang có bằng trang PDF đã chọn bên dưới</label>
        <label className="check"><input type="checkbox" checked={setLogos} onChange={(event) => setSetLogos(event.target.checked)} /> Đổi logo của cả Workspace (ảnh hưởng mọi chiến dịch, chỉ khi bạn đã chọn logo bên dưới)</label>
      </div>}
      <Field label="Mô tả không khí (AI dùng để vẽ nền; không phải ý tưởng truyền thông)"><textarea rows={4} value={kv.concept} onChange={(event) => set('concept', event.target.value)} /></Field>
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
      <Field label="Không được có trong nền"><textarea rows={2} value={kv.avoid} onChange={(event) => set('avoid', event.target.value)} /></Field>

      {found.length > 0 && <div className="field">
        <span className="field-label">Thành phần đồ họa tìm thấy ({found.filter((item) => item.checked).length}/{found.length} được giữ)</span>
        <div className="candidates">
          {found.map((item) => <div className={item.checked ? 'candidate on' : 'candidate'} key={item.id}>
            <label className="check"><input type="checkbox" checked={item.checked} onChange={(event) => setFound((list) => list.map((entry) => entry.id === item.id ? { ...entry, checked: event.target.checked } : entry))} /> {item.width}×{item.height}</label>
            <div className="checker candidate-preview"><img src={item.preview} alt={item.name} /></div>
            <input value={item.name} aria-label="Tên thành phần" onChange={(event) => setFound((list) => list.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} />
            {!item.logo && <label className="check small"><input type="checkbox" checked={heroes.has(item.id)} onChange={(event) => setHeroes((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next })} /> Hình chính</label>}
            {item.logo && <select aria-label="Dùng làm logo" value={roles[item.id] ?? ''} onChange={(event) => setRoles((current) => ({ ...current, [item.id]: event.target.value as 'light' | 'dark' | '' }))}><option value="">Chỉ là thành phần</option><option value="light">Logo nền sáng</option><option value="dark">Logo nền tối</option></select>}
          </div>)}
        </div>
        <small className="muted">Bỏ tích những mảnh không cần (chữ, họa tiết thừa). Mục "Hình chính" là hình chủ đạo của key visual: AI dùng nó làm tham chiếu khi tạo nền. Có thể cắt thêm hoặc cắt lại bằng tay sau trong chiến dịch.</small>
      </div>}

      <div className="field">
        <span className="field-label">Trang làm ảnh moodboard (tối đa {MAX_REFERENCES}){updating && !replaceRefs ? ' · đang giữ ảnh hiện có, không dùng' : ''}</span>
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
