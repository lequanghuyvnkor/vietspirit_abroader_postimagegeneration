import type { Campaign, CampaignTemplate, Workspace } from '../lib/types.ts'
import { LookBackPanel } from './LookBackPanel.tsx'
import { PublishPanel } from './PublishPanel.tsx'
import { ResultsPanel } from './ResultsPanel.tsx'
import { Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onSaveTemplate: (template: CampaignTemplate) => void
}

/** ⑦ Đăng & đo: what to publish and when, what went out, results by hand, weekly look back, and reuse. */
export function MeasureTab({ workspace, campaign, edit, onSaveTemplate }: Props) {
  if (campaign.pieces.length === 0) return <Section title="Đăng & đo"><p className="muted">Chưa có bài nào. Soạn kế hoạch ở tab Kế hoạch trước.</p></Section>
  return <>
    <PublishPanel workspace={workspace} campaign={campaign} edit={edit} />
    <ResultsPanel workspace={workspace} campaign={campaign} edit={edit} />
    <LookBackPanel workspace={workspace} campaign={campaign} edit={edit} onSaveTemplate={onSaveTemplate} />
  </>
}
