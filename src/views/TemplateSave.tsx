import { useState } from 'react'
import { buildTemplate } from '../lib/results.ts'
import type { Campaign, CampaignTemplate } from '../lib/types.ts'
import { NameDialog, Section } from './ui.tsx'

type Props = {
  campaign: Campaign
  onSaveTemplate: (template: CampaignTemplate) => void
}

/** Saving the campaign's structure as a template for the next campaign. */
export function TemplateSave({ campaign, onSaveTemplate }: Props) {
  const [naming, setNaming] = useState(false)
  const [saved, setSaved] = useState('')
  return <>
    <Section title="Dùng lại cho chiến dịch sau">
      <p className="muted">Lưu cấu trúc chiến dịch này thành mẫu: nền tảng, trụ cột, điều không được nói, tên biến, màu và font, cùng các bài trong kế hoạch (tiêu đề, loại, phễu, brief, mục kiểm tra, ngày theo mốc từ ngày bắt đầu). Không giữ caption, ảnh hay số liệu. Dùng nút "Tạo từ mẫu" ở trang Workspace.</p>
      <div className="row wrap">
        <button className="btn" disabled={campaign.pieces.length === 0} onClick={() => setNaming(true)}>Lưu chiến dịch này làm mẫu</button>
        {saved && <span className="muted" role="status">Đã lưu mẫu "{saved}".</span>}
      </div>
    </Section>
    {naming && <NameDialog title="Tên mẫu" initial={`Mẫu ${campaign.name}`} confirm="Lưu mẫu" onSubmit={(name) => { onSaveTemplate(buildTemplate(campaign, name)); setSaved(name) }} onClose={() => setNaming(false)} />}
  </>
}
