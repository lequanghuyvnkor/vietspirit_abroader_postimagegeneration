import { useState } from 'react'
import { Modal } from './ui.tsx'
import { ThemePicker, type ThemeValue } from './ThemePicker.tsx'

type Props = { onSubmit: (name: string, theme: ThemeValue) => void; onClose: () => void }

/** New campaign: a name and the interface color it will use (changeable later from the campaign page). */
export function CreateCampaignDialog({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('')
  const [theme, setTheme] = useState<ThemeValue>({ color: undefined, tint: undefined })
  const submit = () => { if (name.trim()) { onSubmit(name.trim(), theme); onClose() } }
  return <Modal title="Tạo chiến dịch" onClose={onClose}>
    <label className="field"><span className="field-label">Tên chiến dịch</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} /></label>
    <div className="field"><span className="field-label">Màu giao diện</span><ThemePicker value={theme} onChange={setTheme} /></div>
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn primary" disabled={!name.trim()} onClick={submit}>Tạo</button></div>
  </Modal>
}
