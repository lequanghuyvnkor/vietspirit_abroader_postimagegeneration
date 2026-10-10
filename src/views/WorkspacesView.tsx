import { useState } from 'react'
import { emptyCompany, newId, now } from '../lib/types.ts'
import type { Store } from '../lib/types.ts'
import { navigate } from '../lib/route.ts'
import { ConfirmDialog, NameDialog } from './ui.tsx'
import { api } from '../lib/api.ts'

type Props = { store: Store; update: (change: (draft: Store) => void) => void }

export function WorkspacesView({ store, update }: Props) {
  const [dialog, setDialog] = useState<'create' | { delete: string } | null>(null)
  const target = typeof dialog === 'object' && dialog ? store.workspaces.find((item) => item.id === dialog.delete) : undefined

  function create(name: string) {
    const id = newId()
    update((draft) => { draft.workspaces.push({ id, name, company: emptyCompany(name), campaigns: [], updatedAt: now() }) })
    navigate({ workspace: id })
  }

  function remove(id: string) {
    const workspace = store.workspaces.find((item) => item.id === id)
    if (workspace) {
      const assets = [workspace.company.logoId, workspace.company.logoDarkId, ...workspace.campaigns.flatMap((campaign) => [campaign.keyVisual.displayFontAssetId, ...campaign.keyVisual.referenceIds, ...(campaign.keyVisual.sampleIds ?? []), ...campaign.backgrounds.map((item) => item.assetId), ...campaign.sources.map((item) => item.assetId), ...campaign.components.map((item) => item.assetId)])]
      assets.forEach((asset) => { if (asset) void api.deleteAsset(asset) })
    }
    update((draft) => { draft.workspaces = draft.workspaces.filter((item) => item.id !== id) })
  }

  return <div className="page">
    <div className="page-head">
      <div><span className="eyebrow">Workspace</span><h1>Doanh nghiệp</h1><p>Mỗi workspace là một doanh nghiệp, với thông tin, chiến dịch và bài đăng riêng.</p></div>
      <button className="btn primary" onClick={() => setDialog('create')}>+ Tạo workspace</button>
    </div>
    {store.workspaces.length === 0
      ? <div className="empty"><h3>Chưa có workspace nào</h3><p>Tạo workspace đầu tiên để bắt đầu.</p><button className="btn primary" onClick={() => setDialog('create')}>+ Tạo workspace</button></div>
      : <div className="grid">
        {store.workspaces.map((workspace) => <article className="tile" key={workspace.id}>
          <button className="tile-main" onClick={() => navigate({ workspace: workspace.id })}>
            <strong>{workspace.name}</strong>
            <small>{workspace.campaigns.length} chiến dịch · {workspace.campaigns.reduce((sum, campaign) => sum + campaign.posts.length, 0)} bài đăng</small>
            <small>Cập nhật {new Date(workspace.updatedAt).toLocaleDateString('vi-VN')}</small>
          </button>
          <div className="tile-actions"><button className="btn small ghost" onClick={() => setDialog({ delete: workspace.id })}>Xóa</button></div>
        </article>)}
      </div>}
    {dialog === 'create' && <NameDialog title="Tạo workspace" confirm="Tạo" onSubmit={create} onClose={() => setDialog(null)} />}
    {target && <ConfirmDialog title="Xóa workspace" message={`Xóa "${target.name}" cùng toàn bộ chiến dịch, bài đăng và ảnh? Không thể hoàn tác.`} confirm="Xóa" onConfirm={() => remove(target.id)} onClose={() => setDialog(null)} />}
  </div>
}
