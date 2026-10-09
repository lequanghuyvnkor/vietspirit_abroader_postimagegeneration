import { useRef, useState, type ChangeEvent } from 'react'
import { formatOf, newId, newPost, now } from '../lib/types.ts'
import type { Campaign, FormatKey, KeyVisual, Store, Workspace } from '../lib/types.ts'
import { api, assetUrl, readFileAsDataUrl, uploadImage, type ApiKey } from '../lib/api.ts'
import { navigate, type CampaignTab } from '../lib/route.ts'
import { safeColor } from '../lib/render.ts'
import { ConfirmDialog, Field, Lightbox, NameDialog, Section } from './ui.tsx'
import { ImportPdf, type ImportResult } from './ImportPdf.tsx'
import { ComponentCutter } from './ComponentCutter.tsx'
import { PlanTab, ProductionTab, ScheduleTab } from './CampaignTabs.tsx'
import { useBatch } from '../lib/batch.ts'
import { Moodboard } from './Moodboard.tsx'
import { FoundationTab } from './FoundationTab.tsx'
import { hasFoundation } from '../lib/foundation.ts'

type Props = {
  update: (change: (draft: Store) => void) => void
  workspace: Workspace
  campaign: Campaign
  keys: ApiKey[]
  onManageKeys: () => void
  onError: (message: string) => void
  tab?: CampaignTab
}

export function CampaignView({ update, workspace, campaign, keys, onManageKeys, onError, tab: activeTab }: Props) {
  const kv = campaign.keyVisual
  const [dialog, setDialog] = useState<'rename' | 'import' | 'cut' | { delete: string } | null>(null)
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const fontInput = useRef<HTMLInputElement>(null)
  const loose = campaign.posts.filter((post) => !post.pieceId)
  const hasContent = (post: (typeof loose)[number]) => Boolean(post.eyebrow || post.headline || post.accent || post.subtitle || post.cta || post.layers.length || post.backgroundId)
  const showLoose = campaign.pieces.length === 0 || loose.some(hasContent)
  const target = typeof dialog === 'object' && dialog ? campaign.posts.find((post) => post.id === dialog.delete) : undefined

  function edit(change: (draft: Campaign) => void) {
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)
      const found = item?.campaigns.find((entry) => entry.id === campaign.id)
      if (item && found) { change(found); found.updatedAt = now(); item.updatedAt = found.updatedAt }
    })
  }
  const batch = useBatch(workspace, campaign, edit, keys)
  const setKv = <K extends keyof KeyVisual>(key: K, value: KeyVisual[K]) => edit((draft) => { draft.keyVisual[key] = value })
  const guard = async (action: () => Promise<void>) => { try { await action() } catch (error) { onError(error instanceof Error ? error.message : 'Có lỗi xảy ra.') } }

  const setColor = (index: number, value: string) => setKv('palette', kv.palette.map((color, i) => i === index ? value : color))

  function uploadFont(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void guard(async () => {
      const id = await api.uploadAsset(file.name, await readFileAsDataUrl(file))
      if (kv.displayFontAssetId) void api.deleteAsset(kv.displayFontAssetId)
      edit((draft) => { draft.keyVisual.displayFontAssetId = id; draft.keyVisual.displayFont = file.name.replace(/\.[^.]+$/, '').trim() })
    })
  }

  function addBackground(assetId: string, format: FormatKey, label: string) {
    edit((draft) => { draft.backgrounds.push({ id: newId(), assetId, format, label }) })
  }

  function uploadBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void guard(async () => addBackground(await uploadImage(file, 2400), 'feed', file.name))
  }

  function removeBackground(id: string) {
    const background = campaign.backgrounds.find((item) => item.id === id)
    if (background) void api.deleteAsset(background.assetId)
    update((draft) => {
      const found = draft.workspaces.find((entry) => entry.id === workspace.id)?.campaigns.find((entry) => entry.id === campaign.id)
      if (!found) return
      found.backgrounds = found.backgrounds.filter((item) => item.id !== id)
      found.posts.forEach((post) => { if (post.backgroundId === id) post.backgroundId = null })
    })
  }

  function createPost() {
    const post = newPost(`Bài đăng ${campaign.posts.length + 1}`, workspace.company)
    const last = campaign.posts[campaign.posts.length - 1]
    if (last) post.format = last.format
    post.backgroundId = campaign.backgrounds.find((item) => item.format === post.format)?.id ?? null
    edit((draft) => { draft.posts.push(post) })
    navigate({ workspace: workspace.id, campaign: campaign.id, post: post.id })
  }

  function applyImport({ name, keyVisual, sources, components, logos }: ImportResult) {
    if (logos.light || logos.dark) update((draft) => {
      const owner = draft.workspaces.find((entry) => entry.id === workspace.id)
      if (!owner) return
      if (logos.light) owner.company.logoId = logos.light
      if (logos.dark) owner.company.logoDarkId = logos.dark
    })
    campaign.sources.forEach((item) => { void api.deleteAsset(item.assetId) })
    edit((draft) => { draft.name = name; draft.keyVisual = keyVisual; draft.sources = sources; draft.components.push(...components) })
  }

  function removeComponent(id: string) {
    const found = campaign.components.find((item) => item.id === id)
    if (found) void api.deleteAsset(found.assetId)
    update((draft) => {
      const item = draft.workspaces.find((entry) => entry.id === workspace.id)?.campaigns.find((entry) => entry.id === campaign.id)
      if (!item) return
      item.components = item.components.filter((entry) => entry.id !== id)
      if (found) item.keyVisual.subjectIds = (item.keyVisual.subjectIds ?? []).filter((assetId) => assetId !== found.assetId)
      item.posts.forEach((post) => { post.layers = post.layers.filter((layer) => layer.componentId !== id) })
    })
  }

  function renameCampaign(name: string) {
    update((draft) => {
      const found = draft.workspaces.find((entry) => entry.id === workspace.id)?.campaigns.find((entry) => entry.id === campaign.id)
      if (found) found.name = name
    })
  }

  const tabs: { key: CampaignTab; label: string; hint: string }[] = [
    { key: 'foundation', label: '① Nền tảng', hint: 'Mục tiêu, đối tượng, thông điệp, dữ kiện' },
    { key: 'moodboard', label: '② Moodboard', hint: 'Ảnh, không khí, màu, font, nền' },
    { key: 'plan', label: '③ Kế hoạch', hint: 'Các bài, lịch, kiểm tra' },
    { key: 'production', label: '④ Sản xuất', hint: 'Soạn chữ, tạo hình, duyệt' },
    { key: 'schedule', label: '⑤ Lịch & xuất', hint: 'Lịch đăng, Google Docs, zip' },
  ]
  const tab: CampaignTab = activeTab ?? (campaign.pieces.length ? 'production' : hasFoundation(campaign) ? 'moodboard' : 'foundation')
  const tabProps = { workspace, campaign, edit, onError, keys, onManageKeys, batch }

  const loosePosts = showLoose && <Section title="Bài đăng lẻ (ngoài kế hoạch)" aside={<button className="btn primary small" onClick={createPost}>+ Tạo bài đăng</button>}>
    {loose.length === 0
      ? <div className="empty small"><p>Chưa có bài đăng lẻ. Các slide của kế hoạch nằm trong từng bài ở trên.</p></div>
      : <div className="list">
        {loose.map((post) => {
          const background = campaign.backgrounds.find((item) => item.id === post.backgroundId)
          return <div className="list-row" key={post.id}>
            <div className="thumb">{background && <img src={assetUrl(background.assetId)} alt="" />}</div>
            <button className="list-main" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, post: post.id })}>
              <strong>{post.name}</strong>
              <small>{post.headline || 'Chưa có tiêu đề'} · {formatOf(post.format).label}</small>
            </button>
            <button className="btn small ghost" onClick={() => setDialog({ delete: post.id })}>Xóa</button>
          </div>
        })}
      </div>}
  </Section>

  const identity = <Section title="Nhận diện">
    <div className="field">
      <span className="field-label">Bảng màu</span>
      <div className="palette">
        {kv.palette.map((color, index) => <div className="swatch" key={index}>
          <input type="color" aria-label={`Màu ${index + 1}`} value={safeColor(color, '#888888')} onChange={(event) => setColor(index, event.target.value)} />
          <input value={color} maxLength={7} aria-label={`Mã HEX ${index + 1}`} onChange={(event) => setColor(index, event.target.value)} />
          {kv.palette.length > 1 && <button className="btn small ghost" aria-label="Xóa màu" onClick={() => setKv('palette', kv.palette.filter((_, i) => i !== index))}>×</button>}
        </div>)}
        {kv.palette.length < 6 && <button className="btn small" onClick={() => setKv('palette', [...kv.palette, '#FFFFFF'])}>+ Thêm màu</button>}
      </div>
    </div>
    <div className="row wrap">
      <Field label="Màu nhấn (nút, dòng nhấn)">
        <div className="swatch"><input type="color" value={safeColor(kv.accentColor, '#FF4D5E')} onChange={(event) => setKv('accentColor', event.target.value)} /><input value={kv.accentColor} maxLength={7} onChange={(event) => setKv('accentColor', event.target.value)} /></div>
      </Field>
      <Field label="Màu chữ trên nền">
        <select value={kv.textTone} onChange={(event) => setKv('textTone', event.target.value as KeyVisual['textTone'])}>
          <option value="light">Chữ sáng (nền tối)</option>
          <option value="dark">Chữ tối (nền sáng)</option>
        </select>
      </Field>
    </div>
    <div className="row wrap">
      <Field label="Font tiêu đề" hint="Tên font Google Fonts, hoặc tải file font riêng.">
        <input value={kv.displayFont} onChange={(event) => edit((draft) => { draft.keyVisual.displayFont = event.target.value; draft.keyVisual.displayFontAssetId = null })} />
      </Field>
      <Field label="Font nội dung" hint="Tên font Google Fonts."><input value={kv.bodyFont} onChange={(event) => setKv('bodyFont', event.target.value)} /></Field>
    </div>
    <div className="row">
      <button className="btn small" onClick={() => fontInput.current?.click()}>Tải font tiêu đề (.woff2/.ttf/.otf)</button>
      {kv.displayFontAssetId && <span className="muted">Đang dùng font đã tải lên</span>}
      <input ref={fontInput} type="file" accept=".woff2,.woff,.ttf,.otf" hidden onChange={uploadFont} />
    </div>
    <p className="muted">Logo, chân bài và kích thước logo nằm ở trang workspace.</p>
  </Section>

  const backgrounds = <details className="card collapsible">
    <summary><h2>Nền đã có ({campaign.backgrounds.length})</h2><span className="muted">Nền được tạo ở bước "Hình" của từng bài. Ở đây chỉ để xem, tải nền có sẵn hoặc xóa.</span></summary>
    <div className="row wrap">
      <button className="btn small" onClick={() => backgroundInput.current?.click()}>Tải nền có sẵn</button>
      <input ref={backgroundInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadBackground} />
    </div>
    {campaign.backgrounds.length > 0 && <div className="bg-grid">
      {campaign.backgrounds.map((background) => <figure key={background.id}>
        <button className="zoom" onClick={() => setViewer({ src: assetUrl(background.assetId), title: `${background.label} · ${formatOf(background.format).label}` })} aria-label={`Xem lớn ${background.label}`}><img src={assetUrl(background.assetId)} alt={background.label} /></button>
        <figcaption><span>{background.label}<small>{formatOf(background.format).label}</small></span><button className="btn small ghost" onClick={() => removeBackground(background.id)}>Xóa</button></figcaption>
      </figure>)}
    </div>}
  </details>

  const components = <details className="card collapsible">
    <summary><h2>Thành phần đồ họa ({campaign.components.length})</h2><span className="muted">Sao, đường bay, thẻ kính… cắt từ PDF để đặt lên bài</span></summary>
    <div className="row"><button className="btn small primary" onClick={() => setDialog('cut')}>Cắt từ ảnh/PDF</button></div>
    {campaign.components.length === 0
      ? <p className="muted">Chưa có thành phần.</p>
      : <div className="components">
        {campaign.components.map((item) => <figure key={item.id} title={item.name}>
          <div className="checker"><img src={assetUrl(item.assetId)} alt={item.name} /></div>
          <figcaption><span>{item.name}</span><button className="btn small ghost" aria-label={`Xóa ${item.name}`} onClick={() => removeComponent(item.id)}>×</button></figcaption>
        </figure>)}
      </div>}
  </details>

  return <div className="page">
    <div className="page-head">
      <div><span className="eyebrow">Chiến dịch</span><h1>{campaign.name}</h1></div>
      <div className="row"><button className="btn" onClick={() => setDialog('import')}>Nhập lại từ PDF Key Visual</button><button className="btn ghost" onClick={() => setDialog('rename')}>Đổi tên</button></div>
    </div>
    <nav className="steps" aria-label="Các bước của chiến dịch">
      {tabs.map((item) => <button key={item.key} className={item.key === tab ? 'on' : ''} aria-current={item.key === tab ? 'page' : undefined} onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, tab: item.key })}>
        <strong>{item.label}</strong><small>{item.hint}</small>
      </button>)}
    </nav>

    {tab === 'foundation' && <FoundationTab {...tabProps} />}
    {tab === 'moodboard' && <div className="two-col">
      <Section title="Moodboard">
        <Moodboard keyVisual={kv} components={campaign.components} keys={keys} onChange={(change) => edit((draft) => { Object.assign(draft.keyVisual, change) })} onManageKeys={onManageKeys} onError={onError} />
      </Section>
      <div className="stack">{identity}{backgrounds}{components}</div>
    </div>}
    {tab === 'plan' && <PlanTab {...tabProps} />}
    {tab === 'production' && <><ProductionTab {...tabProps} />{loosePosts}</>}
    {tab === 'schedule' && <ScheduleTab {...tabProps} />}
    {dialog === 'rename' && <NameDialog title="Đổi tên chiến dịch" initial={campaign.name} confirm="Lưu" onSubmit={renameCampaign} onClose={() => setDialog(null)} />}
    {viewer && <Lightbox src={viewer.src} title={viewer.title} onClose={() => setViewer(null)} />}
    {dialog === 'cut' && <ComponentCutter sources={campaign.sources} onAddSource={(source) => edit((draft) => { draft.sources.push(source) })} onSave={(saved) => edit((draft) => { draft.components.push(...saved) })} onClose={() => setDialog(null)} />}
    {dialog === 'import' && <ImportPdf base={kv} confirmLabel="Cập nhật chiến dịch" onApply={applyImport} onClose={() => setDialog(null)} />}
    {target && <ConfirmDialog title="Xóa bài đăng" message={`Xóa "${target.name}"?`} confirm="Xóa" onConfirm={() => edit((draft) => { draft.posts = draft.posts.filter((item) => item.id !== target.id) })} onClose={() => setDialog(null)} />}
  </div>
}
