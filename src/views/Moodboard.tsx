import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { api, assetUrl, uploadImage, type ApiKey } from '../lib/api.ts'
import { addImages, moodImages, readMoodboard, removeImage, ROLE_LABELS, setRole, type MoodReading, type MoodRole } from '../lib/moodboard.ts'
import { loadBitmap, cutMotif, readColorPage } from '../lib/motifImage.ts'
import { ROLE_LABELS as MOTIF_LABELS } from '../lib/motifs.ts'
import type { PaletteReading } from '../lib/palette.ts'
import { generationRefs } from '../lib/prompt.ts'
import type { Component, KeyVisual, MotifRole } from '../lib/types.ts'
import { Field, Modal } from './ui.tsx'

type Props = {
  keyVisual: KeyVisual
  components: Component[]
  keys: ApiKey[]
  /** The Foundation's wording (big idea, message, tone) that the AI turns into a visual direction. */
  brief?: string
  onChange: (change: Partial<KeyVisual>) => void
  /** A graphic cut from a motif page: kept on the campaign and placed on the slides by the app. */
  onAddComponent: (component: Component) => void
  onManageKeys: () => void
  onError: (message: string) => void
}

/** Moodboard images with a role each, the AI reading of them, and the written direction the image model follows. */
export function Moodboard({ keyVisual: kv, components, keys, brief = '', onChange, onAddComponent, onManageKeys, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [uploadRole, setUploadRole] = useState<MoodRole>('mood')
  const [reading, setReading] = useState(false)
  const [proposal, setProposal] = useState<MoodReading | null>(null)
  const colorInput = useRef<HTMLInputElement>(null)
  const motifInput = useRef<HTMLInputElement>(null)
  const [palettePreview, setPalettePreview] = useState<PaletteReading | null>(null)
  const [motif, setMotif] = useState<{ bitmap: ImageBitmap; name: string; role: MotifRole; crop: boolean; strength: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const cut = useMemo(() => (motif ? cutMotif(motif.bitmap, { strength: motif.strength, crop: motif.crop }) : null), [motif])
  const images = moodImages(kv)
  const sent = new Set(generationRefs(kv))
  const key = keys.find((item) => item.isDefault) ?? keys[0]

  function pick(role: MoodRole) {
    setUploadRole(role)
    input.current?.click()
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    try { onChange(addImages(kv, await Promise.all(files.map((file) => uploadImage(file, 1800))), uploadRole)) }
    catch (error) { onError(error instanceof Error ? error.message : 'Không tải được ảnh.') }
  }

  async function readColors(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { setPalettePreview(readColorPage(await loadBitmap(file))) }
    catch (error) { onError(error instanceof Error ? error.message : 'Không đọc được màu.') }
  }

  async function openMotif(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const bitmap = await loadBitmap(file)
      const large = bitmap.width >= 500 && bitmap.height >= 500
      setMotif({ bitmap, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Họa tiết', role: large ? 'texture' : 'decor', crop: !large, strength: 8 })
    } catch (error) { onError(error instanceof Error ? error.message : 'Không mở được ảnh.') }
  }

  async function saveMotif() {
    if (!motif || !cut) return
    setSaving(true)
    try {
      const assetId = await api.uploadAsset(`${motif.name || 'hoa-tiet'}.png`, cut.dataUrl)
      onAddComponent({ id: crypto.randomUUID(), name: motif.name.trim() || 'Họa tiết', assetId, width: cut.width, height: cut.height, role: motif.role })
      setMotif(null)
    } catch (error) { onError(error instanceof Error ? error.message : 'Không lưu được họa tiết.') }
    finally { setSaving(false) }
  }

  function remove(assetId: string) {
    if (!components.some((item) => item.assetId === assetId)) void api.deleteAsset(assetId)
    onChange(removeImage(kv, assetId))
  }

  async function read() {
    setReading(true)
    try { setProposal(await readMoodboard(kv, key?.id, brief)) }
    catch (error) { onError(error instanceof Error ? error.message : 'AI không đọc được moodboard.') }
    finally { setReading(false) }
  }

  return <div className="stack">
    <div className="field">
      <span className="field-label">Ảnh moodboard ({images.length})</span>
      <small>Đây là các bài mẫu để AI tham chiếu phong cách. Khi tạo nền, AI nhận tối đa 4 ảnh "Bài mẫu cho AI" (ảnh có viền xanh là ảnh đang được gửi) và chỉ học màu, ánh sáng, chất liệu, không chép chữ hay thẻ vào nền. Ảnh "Chỉ để xem" được giữ lại nhưng không gửi.</small>
      <div className="mood-grid">
        {images.map((image) => <figure key={image.assetId} className={sent.has(image.assetId) ? 'mood-card sent' : 'mood-card'}>
          <div className="checker"><img src={assetUrl(image.assetId)} alt={ROLE_LABELS[image.role].title} /></div>
          <figcaption>
            <select aria-label="Vai trò ảnh" value={image.role} onChange={(event) => onChange(setRole(kv, image.assetId, event.target.value as MoodRole))}>
              {(Object.keys(ROLE_LABELS) as MoodRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role].title}</option>)}
            </select>
            <button className="btn small ghost" aria-label="Xóa ảnh" onClick={() => remove(image.assetId)}>×</button>
          </figcaption>
        </figure>)}
      </div>
      <div className="row wrap">
        <button className="btn small" onClick={() => pick('mood')}>+ Bài mẫu cho AI</button>
        <button className="btn small" onClick={() => pick('sample')}>+ Chỉ để xem</button>
      </div>
      <div className="row wrap">
        <button className="btn small" title="Tải một ảnh trang màu: app tự đọc bảng màu, màu nhấn và màu chữ" onClick={() => colorInput.current?.click()}>+ Trang màu (tự đọc màu)</button>
        <button className="btn small" title="Tải một ảnh họa tiết (đường đồng mức, điểm đánh dấu, đường bay…): app tự xóa nền phẳng để đặt lên mọi ảnh" onClick={() => motifInput.current?.click()}>+ Trang họa tiết (tự tách nền)</button>
      </div>
      <input ref={colorInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void readColors(event) }} />
      <input ref={motifInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void openMotif(event) }} />
      <label className="row">Mức bám bài mẫu <select aria-label="Mức bám bài mẫu" value={kv.refFidelity ?? 'close'} onChange={(event) => onChange({ refFidelity: event.target.value as 'close' | 'style' })}><option value="close">Giống tổng thể (khuyên dùng)</option><option value="style">Chỉ học màu, ánh sáng</option></select></label>
      <label className="row">Nền ảnh <select aria-label="Nền ảnh" value={kv.plateMode ?? 'ai'} onChange={(event) => onChange({ plateMode: event.target.value as 'ai' | 'gradient' })}><option value="ai">AI vẽ (tốn phí)</option><option value="gradient">Gradient màu thương hiệu (miễn phí, khớp họa tiết)</option></select></label>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { void upload(event) }} />
    </div>

    <div className="row wrap">
      <button className="btn primary" disabled={reading || !key || (images.length === 0 && !brief.trim())} onClick={() => { void read() }}>{reading ? 'AI đang đọc moodboard…' : images.length === 0 ? 'AI gợi ý từ Ý tưởng lớn' : 'AI đọc moodboard'}</button>
      {!key && <button className="link" onClick={onManageKeys}>Thêm API key</button>}
      <small className="muted">AI nhìn ảnh và đổi <b>Ý tưởng lớn</b> ở tab Nền tảng thành hình ảnh cụ thể: mô tả không khí, bảng màu, màu nhấn, điều cần tránh. {images.length === 0 && !brief.trim() ? 'Cần ít nhất một ảnh hoặc một Ý tưởng lớn. ' : ''}Bạn xem trước rồi mới áp dụng.</small>
    </div>

    <Field label="Mô tả không khí (AI dùng để vẽ nền)" hint="Bối cảnh, ánh sáng, chất liệu, góc nhìn: phần HÌNH của ý tưởng. Muốn đổi ý tưởng truyền thông thì sửa Ý tưởng lớn ở tab Nền tảng rồi bấm nút AI ở trên. Đây là phần quan trọng nhất của prompt tạo nền."><textarea rows={4} value={kv.concept} onChange={(event) => onChange({ concept: event.target.value })} /></Field>
    <Field label="Không được có trong nền"><textarea rows={2} value={kv.avoid} onChange={(event) => onChange({ avoid: event.target.value })} /></Field>

    {palettePreview && <Modal title="Màu đọc được từ ảnh" onClose={() => setPalettePreview(null)}>
      <dl className="facts">
        <dt>Bảng màu</dt><dd><span className="row wrap">{palettePreview.palette.map((color) => <span key={color} className="chip-color"><i style={{ background: color }} />{color}</span>)}</span></dd>
        <dt>Màu nhấn</dt><dd><span className="chip-color"><i style={{ background: palettePreview.accentColor }} />{palettePreview.accentColor}</span></dd>
        <dt>Màu chữ</dt><dd>{palettePreview.textTone === 'light' ? 'Chữ sáng (nền tối)' : 'Chữ tối (nền sáng)'}</dd>
      </dl>
      <p className="muted">Màu được đếm theo diện tích trong ảnh. Áp dụng xong bạn vẫn sửa được từng màu ở cột Nhận diện.</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => setPalettePreview(null)}>Bỏ qua</button>
        <button className="btn primary" onClick={() => { onChange({ palette: palettePreview.palette, accentColor: palettePreview.accentColor, textTone: palettePreview.textTone }); setPalettePreview(null) }}>Áp dụng màu</button>
      </div>
    </Modal>}

    {motif && <Modal title="Thêm trang họa tiết" onClose={() => setMotif(null)} wide>
      <div className="checker" style={{ maxHeight: 340, overflow: 'auto' }}>
        {cut ? <img src={cut.dataUrl} alt="Họa tiết đã tách nền" style={{ maxWidth: '100%' }} /> : <p className="notice">Không tách được: ảnh gần như chỉ có nền. Hãy kéo "Độ tách nền" xuống thấp hơn.</p>}
      </div>
      <Field label="Tên"><input value={motif.name} onChange={(event) => setMotif({ ...motif, name: event.target.value })} /></Field>
      <Field label="Dùng làm" hint="Phủ nền: cả khung, nằm dưới chữ (đường đồng mức, lưới, vân). Họa tiết lớn: một điểm nhấn trong vùng trống. Đường: vệt dài nối các slide. Họa tiết điểm: hình nhỏ rải rác.">
        <select value={motif.role} onChange={(event) => setMotif({ ...motif, role: event.target.value as MotifRole })}>
          {(['texture', 'hero', 'line', 'decor'] as MotifRole[]).map((role) => <option key={role} value={role}>{MOTIF_LABELS[role]}</option>)}
        </select>
      </Field>
      <label className="row">Độ tách nền <input type="range" min={4} max={60} value={motif.strength} onChange={(event) => setMotif({ ...motif, strength: Number(event.target.value) })} /></label>
      <label className="check"><input type="checkbox" checked={motif.crop} onChange={(event) => setMotif({ ...motif, crop: event.target.checked })} /> Cắt sát hình (bỏ phần trống quanh; bỏ tích nếu là họa tiết phủ nền)</label>
      <small className="muted">App xóa phần nền phẳng (một màu hoặc dải màu mượt) của ảnh, chỉ giữ nét vẽ. Chỉ nên tải mỗi ảnh một phần họa tiết; nền ảnh càng đơn giản thì tách càng sạch.</small>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => setMotif(null)}>Hủy</button>
        <button className="btn primary" disabled={!cut || saving} onClick={() => { void saveMotif() }}>{saving ? 'Đang lưu…' : 'Thêm họa tiết'}</button>
      </div>
    </Modal>}

    {proposal && <Modal title="AI đề xuất từ moodboard" onClose={() => setProposal(null)} wide>
      <dl className="facts">
        <dt>Mô tả không khí</dt><dd>{proposal.concept}</dd>
        <dt>Bảng màu</dt><dd><span className="row wrap">{proposal.palette.map((color) => <span key={color} className="chip-color"><i style={{ background: color }} />{color}</span>)}</span></dd>
        <dt>Màu nhấn</dt><dd><span className="chip-color"><i style={{ background: proposal.accentColor }} />{proposal.accentColor}</span></dd>
        <dt>Màu chữ</dt><dd>{proposal.textTone === 'light' ? 'Chữ sáng (nền tối)' : 'Chữ tối (nền sáng)'}</dd>
        <dt>Không được có</dt><dd>{proposal.avoid || '—'}</dd>
      </dl>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => setProposal(null)}>Bỏ qua</button>
        <button className="btn" onClick={() => { onChange({ concept: proposal.concept, avoid: proposal.avoid }); setProposal(null) }}>Chỉ áp dụng phần chữ</button>
        <button className="btn primary" onClick={() => { onChange(proposal); setProposal(null) }}>Áp dụng tất cả</button>
      </div>
    </Modal>}
  </div>
}
