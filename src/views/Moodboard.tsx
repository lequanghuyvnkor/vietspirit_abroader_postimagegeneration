import { useRef, useState, type ChangeEvent } from 'react'
import { api, assetUrl, uploadImage, type ApiKey } from '../lib/api.ts'
import { addImages, moodImages, readMoodboard, removeImage, ROLE_LABELS, setRole, type MoodReading, type MoodRole } from '../lib/moodboard.ts'
import { generationRefs } from '../lib/prompt.ts'
import type { Component, KeyVisual } from '../lib/types.ts'
import { Field, Modal } from './ui.tsx'

type Props = {
  keyVisual: KeyVisual
  components: Component[]
  /** The app places the graphics itself (so the main symbol is not sent to the AI). */
  composite?: boolean
  keys: ApiKey[]
  /** The Foundation's wording (big idea, message, tone) that the AI turns into a visual direction. */
  brief?: string
  onChange: (change: Partial<KeyVisual>) => void
  onManageKeys: () => void
  onError: (message: string) => void
}

/** Moodboard images with a role each, the AI reading of them, and the written direction the image model follows. */
export function Moodboard({ keyVisual: kv, components, composite = false, keys, brief = '', onChange, onManageKeys, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [uploadRole, setUploadRole] = useState<MoodRole>('mood')
  const [picking, setPicking] = useState(false)
  const [reading, setReading] = useState(false)
  const [proposal, setProposal] = useState<MoodReading | null>(null)
  const images = moodImages(kv)
  const sent = new Set(generationRefs(kv, composite))
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
      <small>Mỗi ảnh có một vai trò. Khi tạo nền, AI nhận tối đa 4 ảnh (biểu tượng chính trước, rồi ảnh không khí); ảnh có viền xanh là ảnh đang được gửi. Bài mẫu có chữ, thẻ, huy hiệu nên để vai trò "Bài mẫu" để AI không chép chúng vào nền.</small>
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
        <button className="btn small" onClick={() => pick('mood')}>+ Ảnh không khí / màu</button>
        <button className="btn small" onClick={() => pick('subject')}>+ Biểu tượng chính</button>
        <button className="btn small" onClick={() => pick('sample')}>+ Bài mẫu</button>
        {components.length > 0 && <button className="btn small ghost" onClick={() => setPicking(true)}>Lấy biểu tượng từ thành phần đã cắt</button>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { void upload(event) }} />
    </div>

    <div className="row wrap">
      <button className="btn primary" disabled={reading || !key || (images.length === 0 && !brief.trim())} onClick={() => { void read() }}>{reading ? 'AI đang đọc moodboard…' : images.length === 0 ? 'AI gợi ý từ Ý tưởng lớn' : 'AI đọc moodboard'}</button>
      {!key && <button className="link" onClick={onManageKeys}>Thêm API key</button>}
      <small className="muted">AI nhìn ảnh và đổi <b>Ý tưởng lớn</b> ở tab Nền tảng thành hình ảnh cụ thể: mô tả không khí, bảng màu, màu nhấn, điều cần tránh. {images.length === 0 && !brief.trim() ? 'Cần ít nhất một ảnh hoặc một Ý tưởng lớn. ' : ''}Bạn xem trước rồi mới áp dụng.</small>
    </div>

    <Field label="Mô tả không khí (AI dùng để vẽ nền)" hint="Bối cảnh, ánh sáng, chất liệu, góc nhìn: phần HÌNH của ý tưởng. Muốn đổi ý tưởng truyền thông thì sửa Ý tưởng lớn ở tab Nền tảng rồi bấm nút AI ở trên. Đây là phần quan trọng nhất của prompt tạo nền."><textarea rows={4} value={kv.concept} onChange={(event) => onChange({ concept: event.target.value })} /></Field>
    <Field label="Biểu tượng chính (mô tả ngắn)"><input value={kv.subject} placeholder="Ví dụ: ngôi sao đỏ mọc trên đường chân trời cong" onChange={(event) => onChange({ subject: event.target.value })} /></Field>
    <Field label="Không được có trong nền"><textarea rows={2} value={kv.avoid} onChange={(event) => onChange({ avoid: event.target.value })} /></Field>

    {picking && <Modal title="Lấy biểu tượng từ thành phần đã cắt" onClose={() => setPicking(false)} wide>
      <div className="components">
        {components.map((item) => <button key={item.id} className="comp-add" title={item.name} onClick={() => { onChange(addImages(kv, [item.assetId], 'subject')); setPicking(false) }}><div className="checker"><img src={assetUrl(item.assetId)} alt={item.name} /></div></button>)}
      </div>
    </Modal>}

    {proposal && <Modal title="AI đề xuất từ moodboard" onClose={() => setProposal(null)} wide>
      <dl className="facts">
        <dt>Mô tả không khí</dt><dd>{proposal.concept}</dd>
        <dt>Biểu tượng chính</dt><dd>{proposal.subject || '—'}</dd>
        <dt>Bảng màu</dt><dd><span className="row wrap">{proposal.palette.map((color) => <span key={color} className="chip-color"><i style={{ background: color }} />{color}</span>)}</span></dd>
        <dt>Màu nhấn</dt><dd><span className="chip-color"><i style={{ background: proposal.accentColor }} />{proposal.accentColor}</span></dd>
        <dt>Màu chữ</dt><dd>{proposal.textTone === 'light' ? 'Chữ sáng (nền tối)' : 'Chữ tối (nền sáng)'}</dd>
        <dt>Không được có</dt><dd>{proposal.avoid || '—'}</dd>
      </dl>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => setProposal(null)}>Bỏ qua</button>
        <button className="btn" onClick={() => { onChange({ concept: proposal.concept, subject: proposal.subject, avoid: proposal.avoid }); setProposal(null) }}>Chỉ áp dụng phần chữ</button>
        <button className="btn primary" onClick={() => { onChange(proposal); setProposal(null) }}>Áp dụng tất cả</button>
      </div>
    </Modal>}
  </div>
}
