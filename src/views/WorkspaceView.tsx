import { useState } from 'react'
import { emptyKeyVisual, newId, now } from '../lib/types.ts'
import type { Company, Store, Workspace } from '../lib/types.ts'
import { navigate } from '../lib/route.ts'
import { ConfirmDialog, Field, ImageSlot, NameDialog, Section } from './ui.tsx'
import { ImportPdf, type ImportResult } from './ImportPdf.tsx'
import { api } from '../lib/api.ts'

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
    const id = newId()
    edit((draft) => { draft.campaigns.push({ id, name, keyVisual: emptyKeyVisual(), backgrounds: [], posts: [], updatedAt: now() }) })
    navigate({ workspace: workspace.id, campaign: id })
  }

  function importCampaign({ name, keyVisual }: ImportResult) {
    const id = newId()
    edit((draft) => { draft.campaigns.push({ id, name, keyVisual, backgrounds: [], posts: [], updatedAt: now() }) })
    navigate({ workspace: workspace.id, campaign: id })
  }

  function removeCampaign(id: string) {
    const campaign = workspace.campaigns.find((item) => item.id === id)
    if (campaign) [campaign.keyVisual.displayFontAssetId, ...campaign.keyVisual.referenceIds, ...campaign.backgrounds.map((item) => item.assetId)].forEach((asset) => { if (asset) void api.deleteAsset(asset) })
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
        <Field label="Dòng chân bài mặc định" hint="Ví dụ: fb.com/tenpage · Hotline 09xx. Mỗi bài đăng có thể sửa lại.">
          <input value={company.footer} onChange={(event) => setCompany('footer', event.target.value)} />
        </Field>
        <div className="row wrap">
          <ImageSlot label="Logo (nền sáng)" value={company.logoId} onChange={(id) => setCompany('logoId', id)} onError={onError} />
          <ImageSlot label="Logo (nền tối, không bắt buộc)" value={company.logoDarkId} onChange={(id) => setCompany('logoDarkId', id)} onError={onError} />
        </div>
      </Section>
    </div>
    {dialog === 'create' && <NameDialog title="Tạo chiến dịch" confirm="Tạo" onSubmit={createCampaign} onClose={() => setDialog(null)} />}
    {dialog === 'import' && <ImportPdf confirmLabel="Tạo chiến dịch" onApply={importCampaign} onClose={() => setDialog(null)} />}
    {target && <ConfirmDialog title="Xóa chiến dịch" message={`Xóa "${target.name}" cùng toàn bộ bài đăng và ảnh nền?`} confirm="Xóa" onConfirm={() => removeCampaign(target.id)} onClose={() => setDialog(null)} />}
  </div>
}
