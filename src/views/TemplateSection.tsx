import { useState } from 'react'
import { campaignFromTemplate } from '../lib/results.ts'
import { todayIso } from '../lib/schedule.ts'
import { navigate } from '../lib/route.ts'
import type { CampaignTemplate, Workspace } from '../lib/types.ts'
import { ConfirmDialog, Modal, Section } from './ui.tsx'
import { ThemePicker, type ThemeValue } from './ThemePicker.tsx'

type Props = {
  workspace: Workspace
  /** Adds the campaign to the workspace (and keeps the template list as it is). */
  onCreate: (campaign: ReturnType<typeof campaignFromTemplate>) => void
  onRemove: (templateId: string) => void
}

const dmy = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')

/** Templates saved from finished campaigns, and the dialog that starts a new campaign from one. */
export function TemplateSection({ workspace, onCreate, onRemove }: Props) {
  const templates = workspace.templates ?? []
  const [using, setUsing] = useState<CampaignTemplate | null>(null)
  const [removing, setRemoving] = useState<CampaignTemplate | null>(null)
  const [name, setName] = useState('')
  const [start, setStart] = useState(() => todayIso())
  const [theme, setTheme] = useState<ThemeValue>({ color: undefined, tint: undefined })

  if (templates.length === 0) return null

  function create() {
    if (!using) return
    const campaign = campaignFromTemplate(using, name.trim(), start)
    if (theme.color) { campaign.themeColor = theme.color; if (theme.tint !== undefined) campaign.themeTint = theme.tint }
    onCreate(campaign)
    setUsing(null)
    navigate({ workspace: workspace.id, campaign: campaign.id, tab: 'plan' })
  }

  return <>
    <Section title={`Mẫu chiến dịch (${templates.length})`}>
      <p className="muted">Mẫu giữ cấu trúc và kế hoạch của một chiến dịch cũ để bắt đầu chiến dịch mới nhanh hơn. Không giữ caption, ảnh hay số liệu.</p>
      <div className="list">
        {templates.map((template) => <div className="list-row" key={template.id}>
          <div className="list-main"><strong>{template.name}</strong><small>{template.pieces.length} bài · lưu {dmy(template.at)}</small></div>
          <button className="btn small primary" onClick={() => { setUsing(template); setName(`${template.name.replace(/^Mẫu\s+/i, '')} (mới)`) }}>Tạo từ mẫu</button>
          <button className="btn small ghost" onClick={() => setRemoving(template)}>Xóa</button>
        </div>)}
      </div>
    </Section>
    {using && <Modal title={`Tạo chiến dịch từ "${using.name}"`} onClose={() => setUsing(null)}>
      <label className="field"><span className="field-label">Tên chiến dịch mới</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field"><span className="field-label">Ngày bắt đầu</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /><small>Ngày đăng của từng bài tính theo mốc từ ngày này.</small></label>
      <div className="field"><span className="field-label">Màu giao diện</span><ThemePicker value={theme} onChange={setTheme} /></div>
      <div className="modal-actions"><button className="btn ghost" onClick={() => setUsing(null)}>Hủy</button><button className="btn primary" disabled={!name.trim() || !start} onClick={create}>Tạo chiến dịch</button></div>
    </Modal>}
    {removing && <ConfirmDialog title="Xóa mẫu" message={`Xóa mẫu "${removing.name}"? Các chiến dịch đã tạo từ mẫu không bị ảnh hưởng.`} confirm="Xóa mẫu" onConfirm={() => onRemove(removing.id)} onClose={() => setRemoving(null)} />}
  </>
}
