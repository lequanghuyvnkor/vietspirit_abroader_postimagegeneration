import { useRef, useState, type ChangeEvent } from 'react'
import { FORMATS, formatOf, newId, newPost, now } from '../lib/types.ts'
import type { Campaign, FormatKey, KeyVisual, Store, Workspace } from '../lib/types.ts'
import { api, assetUrl, readFileAsDataUrl, uploadImage, type ApiKey } from '../lib/api.ts'
import { navigate } from '../lib/route.ts'
import { buildBackgroundPrompt } from '../lib/prompt.ts'
import { safeColor } from '../lib/render.ts'
import { ConfirmDialog, Field, Lightbox, NameDialog, Section } from './ui.tsx'
import { ImportPdf, type ImportResult } from './ImportPdf.tsx'
import { ComponentCutter } from './ComponentCutter.tsx'
import { PlanSection } from './PlanSection.tsx'

type Props = {
  update: (change: (draft: Store) => void) => void
  workspace: Workspace
  campaign: Campaign
  keys: ApiKey[]
  onManageKeys: () => void
  onError: (message: string) => void
}

export function CampaignView({ update, workspace, campaign, keys, onManageKeys, onError }: Props) {
  const kv = campaign.keyVisual
  const [dialog, setDialog] = useState<'rename' | 'import' | 'cut' | { delete: string } | null>(null)
  const [genFormat, setGenFormat] = useState<FormatKey>('feed')
  const [variation, setVariation] = useState('')
  const [generating, setGenerating] = useState(false)
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null)
  const [keyId, setKeyId] = useState('')
  const aiReady = keys.length > 0
  const activeKey = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]
  const referenceInput = useRef<HTMLInputElement>(null)
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
  const setKv = <K extends keyof KeyVisual>(key: K, value: KeyVisual[K]) => edit((draft) => { draft.keyVisual[key] = value })
  const guard = async (action: () => Promise<void>) => { try { await action() } catch (error) { onError(error instanceof Error ? error.message : 'Có lỗi xảy ra.') } }

  const setColor = (index: number, value: string) => setKv('palette', kv.palette.map((color, i) => i === index ? value : color))

  function addReferences(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 4 - kv.referenceIds.length))
    event.target.value = ''
    void guard(async () => {
      const ids = await Promise.all(files.map((file) => uploadImage(file)))
      edit((draft) => { draft.keyVisual.referenceIds.push(...ids) })
    })
  }

  function removeReference(id: string) {
    void api.deleteAsset(id)
    setKv('referenceIds', kv.referenceIds.filter((item) => item !== id))
  }

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

  async function generate() {
    setGenerating(true)
    try {
      const [width, height] = formatOf(genFormat).generate
      const assetId = await api.generate({
        prompt: buildBackgroundPrompt(workspace, campaign, genFormat, variation.trim()),
        width, height, quality: 'high', referenceIds: kv.referenceIds, keyId: activeKey?.id,
      })
      addBackground(assetId, genFormat, variation.trim() || `Nền ${campaign.backgrounds.length + 1}`)
      setVariation('')
    } catch (error) { onError(error instanceof Error ? error.message : 'Không tạo được ảnh.') }
    finally { setGenerating(false) }
  }

  function uploadBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void guard(async () => addBackground(await uploadImage(file, 2400), genFormat, file.name))
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
      item.posts.forEach((post) => { post.layers = post.layers.filter((layer) => layer.componentId !== id) })
    })
  }

  function renameCampaign(name: string) {
    update((draft) => {
      const found = draft.workspaces.find((entry) => entry.id === workspace.id)?.campaigns.find((entry) => entry.id === campaign.id)
      if (found) found.name = name
    })
  }

  return <div className="page">
    <div className="page-head">
      <div><span className="eyebrow">Chiến dịch</span><h1>{campaign.name}</h1></div>
      <div className="row"><button className="btn" onClick={() => setDialog('import')}>Nhập lại từ PDF Key Visual</button><button className="btn ghost" onClick={() => setDialog('rename')}>Đổi tên</button></div>
    </div>
    <PlanSection workspace={workspace} campaign={campaign} edit={edit} onError={onError} keys={keys} onManageKeys={onManageKeys} />
    <div className="two-col">
      <div className="stack">
        {showLoose && <Section title="Bài đăng lẻ" aside={<button className="btn primary small" onClick={createPost}>+ Tạo bài đăng</button>}>
          {campaign.posts.filter((post) => !post.pieceId).length === 0
            ? <div className="empty small"><p>Chưa có bài đăng lẻ. Các slide của kế hoạch nằm trong từng bài ở mục Kế hoạch nội dung.</p></div>
            : <div className="list">
              {campaign.posts.filter((post) => !post.pieceId).map((post) => {
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
        </Section>}

        <Section title="Thành phần đồ họa" aside={<button className="btn small primary" onClick={() => setDialog('cut')}>Cắt từ ảnh/PDF</button>}>
          {campaign.components.length === 0
            ? <p className="muted">Chưa có thành phần. Cắt các phần tử đồ họa (sao, đường bay, thẻ kính, logo…) từ key visual để đặt lên bài đăng.</p>
            : <div className="components">
              {campaign.components.map((item) => <figure key={item.id} title={item.name}>
                <div className="checker"><img src={assetUrl(item.assetId)} alt={item.name} /></div>
                <figcaption><span>{item.name}</span><button className="btn small ghost" aria-label={`Xóa ${item.name}`} onClick={() => removeComponent(item.id)}>×</button></figcaption>
              </figure>)}
            </div>}
        </Section>

        <Section title="Nền Key Visual" aside={<span className="muted">{campaign.backgrounds.length} nền</span>}>
          <div className="row wrap end">
            <Field label="Khổ ảnh">
              <select value={genFormat} onChange={(event) => setGenFormat(event.target.value as FormatKey)}>{FORMATS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
            </Field>
            <Field label="Biến thể (không bắt buộc)"><input value={variation} placeholder="Ví dụ: ánh sáng bình minh ấm hơn" onChange={(event) => setVariation(event.target.value)} /></Field>
          </div>
          {aiReady && <Field label="Dùng API"><select value={activeKey?.id ?? ''} onChange={(event) => setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {entry.model}</option>)}</select></Field>}
          <div className="row wrap">
            <button className="btn primary" disabled={generating || !aiReady || !kv.concept.trim()} onClick={() => { void generate() }}>{generating ? 'Đang tạo (có thể mất 1–2 phút)…' : 'Tạo nền bằng AI'}</button>
            <button className="btn" onClick={() => backgroundInput.current?.click()}>Tải nền có sẵn</button>
            <input ref={backgroundInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadBackground} />
          </div>
          {!aiReady && <p className="notice">Chưa có API key. <button className="link" onClick={onManageKeys}>Thêm API key</button> để tạo nền bằng AI, hoặc tải nền có sẵn.</p>}
          {aiReady && !kv.concept.trim() && <p className="notice">Điền "Ý tưởng chủ đạo" bên cạnh để tạo nền.</p>}
          {campaign.backgrounds.length > 0 && <div className="bg-grid">
            {campaign.backgrounds.map((background) => <figure key={background.id}>
              <button className="zoom" onClick={() => setViewer({ src: assetUrl(background.assetId), title: `${background.label} · ${formatOf(background.format).label}` })} aria-label={`Xem lớn ${background.label}`}><img src={assetUrl(background.assetId)} alt={background.label} /></button>
              <figcaption><span>{background.label}<small>{formatOf(background.format).label}</small></span><button className="btn small ghost" onClick={() => removeBackground(background.id)}>Xóa</button></figcaption>
            </figure>)}
          </div>}
        </Section>
      </div>

      <Section title="Key Visual (đầu vào)">
        <Field label="Ý tưởng chủ đạo" hint="Mô tả cảnh/phong cách nền bạn muốn. Đây là phần quan trọng nhất của prompt."><textarea rows={4} value={kv.concept} onChange={(event) => setKv('concept', event.target.value)} /></Field>
        <Field label="Hình ảnh/biểu tượng chính (nếu có)"><input value={kv.subject} onChange={(event) => setKv('subject', event.target.value)} /></Field>
        <Field label="Điều cần tránh"><textarea rows={2} value={kv.avoid} onChange={(event) => setKv('avoid', event.target.value)} /></Field>

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

        <div className="field">
          <span className="field-label">Ảnh tham chiếu (tối đa 4)</span>
          <div className="refs">
            {kv.referenceIds.map((id) => <div className="ref" key={id}><img src={assetUrl(id)} alt="Ảnh tham chiếu" /><button aria-label="Xóa ảnh tham chiếu" onClick={() => removeReference(id)}>×</button></div>)}
            {kv.referenceIds.length < 4 && <button className="ref add" onClick={() => referenceInput.current?.click()}>+</button>}
          </div>
          <input ref={referenceInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={addReferences} />
        </div>
      </Section>
    </div>
    {dialog === 'rename' && <NameDialog title="Đổi tên chiến dịch" initial={campaign.name} confirm="Lưu" onSubmit={renameCampaign} onClose={() => setDialog(null)} />}
    {viewer && <Lightbox src={viewer.src} title={viewer.title} onClose={() => setViewer(null)} />}
    {dialog === 'cut' && <ComponentCutter sources={campaign.sources} onAddSource={(source) => edit((draft) => { draft.sources.push(source) })} onSave={(saved) => edit((draft) => { draft.components.push(...saved) })} onClose={() => setDialog(null)} />}
    {dialog === 'import' && <ImportPdf base={kv} confirmLabel="Cập nhật chiến dịch" onApply={applyImport} onClose={() => setDialog(null)} />}
    {target && <ConfirmDialog title="Xóa bài đăng" message={`Xóa "${target.name}"?`} confirm="Xóa" onConfirm={() => edit((draft) => { draft.posts = draft.posts.filter((item) => item.id !== target.id) })} onClose={() => setDialog(null)} />}
  </div>
}
