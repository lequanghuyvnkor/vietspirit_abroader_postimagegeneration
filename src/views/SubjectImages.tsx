import { useRef, useState, type ChangeEvent } from 'react'
import { api, assetUrl, uploadImage } from '../lib/api.ts'
import type { Component, KeyVisual } from '../lib/types.ts'
import { Field, Modal } from './ui.tsx'

type Props = {
  keyVisual: KeyVisual
  components: Component[]
  onChange: (change: Partial<Pick<KeyVisual, 'subject' | 'subjectIds'>>) => void
  onError: (message: string) => void
}

/** The campaign's main visual element: images extracted from the key visual or added by hand, plus a short description. */
export function SubjectImages({ keyVisual, components, onChange, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [picking, setPicking] = useState(false)
  const ids = keyVisual.subjectIds ?? []

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    try {
      const added = await Promise.all(files.map((file) => uploadImage(file, 1800)))
      onChange({ subjectIds: [...ids, ...added] })
    } catch (error) { onError(error instanceof Error ? error.message : 'Không tải được ảnh.') }
  }

  function remove(id: string) {
    if (!components.some((item) => item.assetId === id)) void api.deleteAsset(id)
    onChange({ subjectIds: ids.filter((item) => item !== id) })
  }

  return <div className="field">
    <span className="field-label">Hình ảnh/biểu tượng chính</span>
    <div className="refs">
      {ids.map((id) => <div className="ref checker" key={id}><img src={assetUrl(id)} alt="Hình chính" /><button aria-label="Xóa hình chính" onClick={() => remove(id)}>×</button></div>)}
      <button className="ref add" aria-label="Thêm hình chính" onClick={() => input.current?.click()}>+</button>
    </div>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { void upload(event) }} />
    <div className="row wrap">
      <button className="btn small" onClick={() => input.current?.click()}>Tải ảnh lên</button>
      {components.length > 0 && <button className="btn small" onClick={() => setPicking(true)}>Chọn từ thành phần đã cắt</button>}
    </div>
    <Field label="Mô tả ngắn (không bắt buộc)"><input value={keyVisual.subject} placeholder="Ví dụ: ngôi sao đỏ mọc trên đường chân trời cong" onChange={(event) => onChange({ subject: event.target.value })} /></Field>
    <small>Ảnh ở đây được lấy tự động từ key visual khi nhập PDF (bỏ hoặc thêm tùy ý). AI dùng chúng làm hình tham chiếu khi tạo nền, để hình chủ đạo luôn nhận ra được.</small>
    {picking && <Modal title="Chọn hình chính từ thành phần" onClose={() => setPicking(false)} wide>
      <div className="components">
        {components.map((item) => <button key={item.id} className="comp-add" title={item.name} onClick={() => { if (!ids.includes(item.assetId)) onChange({ subjectIds: [...ids, item.assetId] }); setPicking(false) }}><div className="checker"><img src={assetUrl(item.assetId)} alt={item.name} /></div><small>{item.name}</small></button>)}
      </div>
    </Modal>}
  </div>
}
