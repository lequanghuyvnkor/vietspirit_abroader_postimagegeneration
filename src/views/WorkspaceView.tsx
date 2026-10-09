import { useState } from 'react'
import { newCampaign, now } from '../lib/types.ts'
import type { Company, Store, Workspace } from '../lib/types.ts'
import { navigate } from '../lib/route.ts'
import { ConfirmDialog, Field, ImageSlot, NameDialog, Section } from './ui.tsx'
import { ImportPdf, type ImportResult } from './ImportPdf.tsx'
import { api } from '../lib/api.ts'
import { TemplateSection } from './TemplateSection.tsx'

type Props = { store: Store; update: (change: (draft: Store) => void) => void; workspace: Workspace; onError: (message: string) => void }

export function WorkspaceView({ update, workspace, onError }: Props) {
  const [dialog, setDialog] = useState<'create' | 'import' | { delete: string } | null>(null)
  const target = typeof dialog === 'object' && dialog ? workspace.campaigns.find((item) => item.id === dialog.delete) : undefined

  function edit(change: (draft: Workspace) => void) {
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)
      if (item) { change(item); item.updatedAt = now() }
    })
  }
  const setCompany = <K extends keyof Company>(key: K, value: Company[K]) => edit((draft) => { draft.company[key] = value })

  function createCampaign(name: string) {
    const campaign = newCampaign(name)
    edit((draft) => { draft.campaigns.push(campaign) })
    navigate({ workspace: workspace.id, campaign: campaign.id })
  }

  function importCampaign({ name, keyVisual, sources, components, logos }: ImportResult) {
    const campaign = newCampaign(name, keyVisual, sources)
    campaign.components = components
    edit((draft) => { draft.campaigns.push(campaign); if (logos.light) draft.company.logoId = logos.light; if (logos.dark) draft.company.logoDarkId = logos.dark })
    navigate({ workspace: workspace.id, campaign: campaign.id })
  }

  function applyFooterToAll() {
    const total = workspace.campaigns.reduce((sum, campaign) => sum + campaign.posts.length, 0)
    if (total === 0 || !window.confirm(`Đặt chân bài này cho tất cả ${total} bài đăng của workspace, thay chân bài hiện có của từng bài?`)) return
    edit((draft) => { for (const campaign of draft.campaigns) for (const post of campaign.posts) post.footer = draft.company.footer })
  }

  function removeCampaign(id: string) {
    const campaign = workspace.campaigns.find((item) => item.id === id)
    if (campaign) [campaign.keyVisual.displayFontAssetId, ...campaign.keyVisual.referenceIds, ...(campaign.keyVisual.subjectIds ?? []), ...(campaign.keyVisual.sampleIds ?? []), ...campaign.backgrounds.map((item) => item.assetId), ...campaign.sources.map((item) => item.assetId), ...campaign.components.map((item) => item.assetId)].forEach((asset) => { if (asset) void api.deleteAsset(asset) })
    edit((draft) => { draft.campaigns = draft.campaigns.filter((item) => item.id !== id) })
  }

  const { company } = workspace
  return <div className="page">
    <div className="page-head">
      <div><span className="eyebrow">Workspace</span><h1>{workspace.name}</h1></div>
    </div>
    <div className="two-col">
      <Section title="Chiến dịch" aside={<div className="row"><button className="btn small" onClick={() => setDialog('create')}>+ Chiến dịch trống</button><button className="btn primary small" onClick={() => setDialog('import')}>Nhập từ PDF Key Visual</button></div>}>
        {workspace.campaigns.length === 0
          ? <div className="empty small"><p>Chưa có chiến dịch. Tạo chiến dịch để nhập key visual và bắt đầu tạo bài đăng.</p></div>
          : <div className="list">
            {workspace.campaigns.map((campaign) => <div className="list-row" key={campaign.id}>
              <button className="list-main" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id })}>
                <strong>{campaign.name}</strong>
                <small>{campaign.posts.length} bài đăng · {campaign.backgrounds.length} nền · cập nhật {new Date(campaign.updatedAt).toLocaleDateString('vi-VN')}</small>
              </button>
              <button className="btn small ghost" onClick={() => setDialog({ delete: campaign.id })}>Xóa</button>
            </div>)}
          </div>}
      </Section>

      <Section title="Thông tin doanh nghiệp">
        <Field label="Tên workspace"><input value={workspace.name} onChange={(event) => edit((draft) => { draft.name = event.target.value })} /></Field>
        <Field label="Tên thương hiệu (hiện khi chưa có logo)"><input value={company.name} onChange={(event) => setCompany('name', event.target.value)} /></Field>
        <Field label="Lĩnh vực"><input value={company.industry} onChange={(event) => setCompany('industry', event.target.value)} /></Field>
        <Field label="Khách hàng mục tiêu"><textarea rows={2} value={company.audience} onChange={(event) => setCompany('audience', event.target.value)} /></Field>
        <Field label="Giọng điệu thương hiệu"><input value={company.tone} onChange={(event) => setCompany('tone', event.target.value)} /></Field>
        <Field label="Chân bài mặc định" hint="Nhiều dòng được (Enter để xuống dòng). Ví dụ: fb.com/tenpage · Hotline 09xx. Mỗi bài đăng có thể sửa lại. Bài đã tạo trước đó không tự đổi theo, bấm nút bên dưới để áp lại.">
          <textarea rows={3} value={company.footer} onChange={(event) => setCompany('footer', event.target.value)} />
        </Field>
        <div className="row"><button className="btn small" onClick={applyFooterToAll}>Áp chân bài này cho mọi bài đã tạo</button></div>
        <div className="row wrap">
          <ImageSlot cutout label="Logo (nền sáng)" value={company.logoId} onChange={(id) => setCompany('logoId', id)} onError={onError} />
          <ImageSlot cutout label="Logo (nền tối, không bắt buộc)" value={company.logoDarkId} onChange={(id) => setCompany('logoDarkId', id)} onError={onError} />
        </div>
        <Field label={`Kích thước logo: ${company.logoHeight ?? 64}px`} hint="Chiều cao logo trên bài 1080px. Áp dụng cho mọi bài đăng."><input type="range" min={24} max={200} step={4} value={company.logoHeight ?? 64} onChange={(event) => setCompany('logoHeight', Number(event.target.value))} /></Field>
      </Section>
    </div>
    <TemplateSection workspace={workspace} onCreate={(campaign) => edit((draft) => { draft.campaigns.push(campaign) })} onRemove={(id) => edit((draft) => { draft.templates = (draft.templates ?? []).filter((item) => item.id !== id) })} />
    {dialog === 'create' && <NameDialog title="Tạo chiến dịch" confirm="Tạo" onSubmit={createCampaign} onClose={() => setDialog(null)} />}
    {dialog === 'import' && <ImportPdf confirmLabel="Tạo chiến dịch" onApply={importCampaign} onClose={() => setDialog(null)} />}
    {target && <ConfirmDialog title="Xóa chiến dịch" message={`Xóa "${target.name}" cùng toàn bộ bài đăng và ảnh nền?`} confirm="Xóa" onConfirm={() => removeCampaign(target.id)} onClose={() => setDialog(null)} />}
  </div>
}
