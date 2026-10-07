import { useState } from 'react'
import type { ApiKey } from '../lib/api.ts'
import { applyDraft, attachBackground, fetchDraft, generatePieceBackground } from '../lib/draft.ts'
import { draftSlides, pieceTexts } from '../lib/plan.ts'
import { allSlidesOf, baseSlidesOf, buildPack, downloadBlob, slidesOf } from '../lib/pack.ts'
import { removeFamily, removeVariant, chooseVersion } from '../lib/variants.ts'
import { navigate } from '../lib/route.ts'
import { applyVars, lintText, unresolvedIn } from '../lib/text.ts'
import { STATUS_LABELS, newId, now } from '../lib/types.ts'
import type { Campaign, Piece, PieceStatus, Store, Workspace } from '../lib/types.ts'
import { ConfirmDialog, Field, Section } from './ui.tsx'
import { SlideThumb } from './SlideThumb.tsx'
import { PieceAssets } from './PieceAssets.tsx'

type Props = {
  update: (change: (draft: Store) => void) => void
  workspace: Workspace
  campaign: Campaign
  piece: Piece
  keys: ApiKey[]
  onManageKeys: () => void
  onError: (message: string) => void
}

const KIND_LABEL = { static: 'Ảnh', carousel: 'Carousel', reel: 'Reel' }

export function PieceView({ update, workspace, campaign, piece, keys, onManageKeys, onError }: Props) {
  const [keyId, setKeyId] = useState('')
  const [busy, setBusy] = useState<'' | 'ai' | 'bg' | 'zip'>('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const slides = slidesOf(campaign, piece)
  const everySlide = allSlidesOf(campaign, piece)
  const baseSlides = baseSlidesOf(campaign, piece)
  const activeKey = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]
  const parked = piece.kind === 'reel'

  const missing = [...new Set(pieceTexts(campaign, piece).flatMap((text) => unresolvedIn(text, campaign.variables)))]
  const openChecks = piece.checks.filter((check) => !check.done).length
  const lint = lintText(applyVars(piece.caption, campaign.variables) + '\n' + slides.map((post) => [post.headline, post.accent, post.subtitle].join(' ')).join('\n'), campaign.guardrails)
  const blockers = [...(missing.length ? [`${missing.length} biến chưa điền`] : []), ...(openChecks ? [`${openChecks} mục duyệt chưa xong`] : [])]

  function edit(change: (draft: Campaign, item: Piece) => void) {
    update((draft) => {
      const owner = draft.workspaces.find((entry) => entry.id === workspace.id)
      const found = owner?.campaigns.find((entry) => entry.id === campaign.id)
      const target = found?.pieces.find((entry) => entry.id === piece.id)
      if (owner && found && target) { change(found, target); found.updatedAt = now(); owner.updatedAt = found.updatedAt }
    })
  }
  const guard = async (kind: 'ai' | 'bg' | 'zip', action: () => Promise<void>) => {
    setBusy(kind)
    try { await action() } catch (error) { onError(error instanceof Error ? error.message : 'Có lỗi xảy ra.') } finally { setBusy('') }
  }

  function createSlides() {
    edit((draft, item) => {
      draft.posts = draft.posts.filter((post) => post.pieceId !== item.id)
      draft.posts.push(...draftSlides(item, workspace.company, draft.backgrounds))
    })
  }

  function addSlide() {
    edit((draft, item) => {
      const last = draft.posts.filter((post) => post.pieceId === item.id && !post.variantOf).at(-1)
      draft.posts.push({ ...(last ?? draftSlides({ ...item, kind: 'static' }, workspace.company, draft.backgrounds)[0]), id: newId(), name: `${item.code} · Slide ${draft.posts.filter((post) => post.pieceId === item.id && !post.variantOf).length + 1}`, headline: '', accent: '', subtitle: '', cta: '', layers: [], updatedAt: now() })
    })
  }

  function removeSlide(id: string) {
    edit((draft) => {
      const target = draft.posts.find((post) => post.id === id)
      if (target?.variantOf) removeVariant(draft, id)
      else removeFamily(draft, id)
    })
  }

  async function aiDraft() {
    const draft = await fetchDraft(workspace, campaign, piece, activeKey?.id)
    edit((c, item) => applyDraft(c, item.id, draft, workspace.company))
  }

  async function makeBackground() {
    const result = await generatePieceBackground(workspace, campaign, piece, activeKey?.id)
    edit((c, item) => attachBackground(c, item.id, result))
  }

  async function exportPack() {
    if ((missing.length || openChecks) && !window.confirm(`Bài này còn ${blockers.join(' và ')}. Vẫn xuất gói?`)) return
    downloadBlob(await buildPack(workspace, campaign, [piece], false), `${piece.code}.zip`)
  }

  const setStatus = (status: PieceStatus) => edit((_, item) => { item.status = status })
  const aiButton = <div className="row wrap">
    {keys.length > 0 && <select aria-label="API dùng để soạn" value={activeKey?.id ?? ''} onChange={(event) => setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {entry.textModel}</option>)}</select>}
    <button className="btn primary" disabled={busy !== '' || keys.length === 0} onClick={() => { void guard('ai', aiDraft) }}>{busy === 'ai' ? 'AI đang soạn…' : 'Soạn nháp bằng AI'}</button>
    {keys.length === 0 && <button className="link" onClick={onManageKeys}>Thêm API key</button>}
  </div>

  return <div className="page">
    <div className="page-head">
      <div>
        <button className="link" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id })}>← {campaign.name}</button>
        <h1>{piece.code} · {piece.title}</h1>
        <p>{KIND_LABEL[piece.kind]} · {piece.plan.format} · {piece.plan.funnel} · {piece.plan.pillar}</p>
      </div>
      <div className="row wrap">
        <label className="field"><span className="field-label">Ngày đăng</span><input type="date" value={piece.date} onChange={(event) => edit((_, item) => { item.date = event.target.value })} /></label>
        <label className="field"><span className="field-label">Trạng thái</span>
          <select value={piece.status} onChange={(event) => setStatus(event.target.value as PieceStatus)}>
            {(Object.keys(STATUS_LABELS) as PieceStatus[]).map((status) => <option key={status} value={status} disabled={status === 'ready' && blockers.length > 0}>{STATUS_LABELS[status]}{status === 'ready' && blockers.length ? ` (còn ${blockers.join(', ')})` : ''}</option>)}
          </select>
        </label>
        {!parked && <button className="btn" disabled={busy !== '' || slides.length === 0} onClick={() => { void guard('zip', exportPack) }}>{busy === 'zip' ? 'Đang xuất…' : 'Xuất gói (ảnh + caption)'}</button>}
      </div>
    </div>
    {parked && <p className="notice">Reel đang được treo: chưa làm hình trong app. Caption, checklist và visual brief vẫn theo dõi ở đây.</p>}

    <div className="two-col">
      <div className="stack">
        <Section title="Caption">
          <Field label="Nội dung caption"><textarea rows={12} value={piece.caption} onChange={(event) => edit((_, item) => { item.caption = event.target.value })} /></Field>
          <Field label="Hashtag"><input value={piece.hashtags} onChange={(event) => edit((_, item) => { item.hashtags = event.target.value })} /></Field>
          {missing.length > 0 && <p className="notice">Biến chưa điền: {missing.map((key) => `[${key}]`).join(', ')}. Điền ở mục "Biến chiến dịch" của chiến dịch.</p>}
          {lint.length > 0 && <div className="lint" role="status">
            <strong>Cần xem lại ({lint.length})</strong>
            {lint.map((hit, index) => <p key={index}><b>{hit.rule}</b><br /><span className="muted">…{hit.excerpt}…</span></p>)}
          </div>}
          {piece.compliance && <p className="muted">Ghi chú duyệt: {piece.compliance}</p>}
        </Section>

        <Section title="Điều kiện trước khi đăng" aside={<span className="muted">{piece.checks.filter((check) => check.done).length}/{piece.checks.length}</span>}>
          {piece.checks.length === 0 && <p className="muted">Không có mục nào.</p>}
          <div className="list">
            {piece.checks.map((check) => <label className="check-row" key={check.id}>
              <input type="checkbox" checked={check.done} onChange={(event) => edit((_, item) => { const target = item.checks.find((entry) => entry.id === check.id); if (target) target.done = event.target.checked })} />
              <span><span className={check.done ? 'done' : ''}>{check.text}</span><small className="muted"> · {check.owner}</small></span>
            </label>)}
          </div>
        </Section>

        <Section title="Kế hoạch">
          <dl className="facts">
            {([['Mục tiêu', piece.plan.goal], ['Hook', piece.plan.hook], ['Cấu trúc', piece.plan.structure], ['CTA', piece.plan.cta], ['Đối tượng', piece.plan.audience], ['KPI', piece.plan.kpi], ['Paid', piece.plan.paid], ['Story hỗ trợ', piece.plan.story]] as const).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </Section>
      </div>

      <div className="stack">
        {!parked && <Section title={`Ảnh hoàn chỉnh (${slides.length}${everySlide.length > slides.length ? ` đang xuất / ${everySlide.length} bản` : ''})`} aside={<div className="row"><button className="btn small" onClick={addSlide}>+ Slide</button><button className="btn small" onClick={() => (slides.length ? setConfirmReplace(true) : createSlides())}>Tạo từ kế hoạch</button></div>}>
          {aiButton}
          {baseSlides.length === 0 && <p className="muted">Chưa có slide. Bấm "Tạo từ kế hoạch" hoặc nhờ AI soạn nháp.</p>}
          <p className="muted">Đây là ảnh đúng như khi xuất (nền, thành phần, chữ). Bấm vào ảnh để xem lớn và tải PNG; bấm "Chỉnh" để sửa chữ, nền, thành phần.</p>
          <div className="slide-cards">
            {everySlide.map((post) => <figure className={post.excluded ? 'slide-card muted-card' : 'slide-card'} key={post.id}>
              <SlideThumb post={post} campaign={campaign} workspace={workspace} width={170} />
              <figcaption>
                <strong>{post.name}</strong>
                <small>{post.headline || 'Chưa có tiêu đề'}{post.accent ? ` · ${post.accent}` : ''}</small>
                {(post.variantOf || post.excluded) && <small className="flag info">{post.variantOf ? 'Bản chỉnh' : 'Bản gốc'} · {post.excluded ? 'không xuất' : 'đang xuất'}</small>}
                <span className="row wrap">
                  <button className="btn small" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, post: post.id })}>Chỉnh</button>
                  {post.excluded && <button className="btn small" onClick={() => edit((draft) => chooseVersion(draft, post.id))}>Dùng bản này</button>}
                  <button className="btn small ghost" onClick={() => removeSlide(post.id)}>Xóa</button>
                </span>
              </figcaption>
            </figure>)}
          </div>
        </Section>}

        <PieceAssets workspace={workspace} campaign={campaign} piece={piece} slides={slides} edit={edit} onError={onError} />

        <Section title="Visual brief">
          <dl className="facts">
            {([['Hero visual', piece.visual.hero], ['Bố cục', piece.visual.layout], ['Typography', piece.visual.typography], ['Palette', piece.visual.palette], ['Chữ trên ảnh', piece.visual.onImage], ['Motion', piece.visual.motion], ['Asset cần chuẩn bị', piece.visual.assets], ['Tránh', piece.visual.avoid]] as const).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {!parked && <button className="btn" disabled={busy !== '' || keys.length === 0} onClick={() => { void guard('bg', makeBackground) }}>{busy === 'bg' ? 'Đang tạo nền (1–2 phút)…' : 'Tạo nền theo brief này'}</button>}
        </Section>
      </div>
    </div>
    {confirmReplace && <ConfirmDialog title="Tạo lại slide" message="Các slide hiện có của bài này sẽ bị thay bằng bản nháp từ kế hoạch. Tiếp tục?" confirm="Thay thế" onConfirm={createSlides} onClose={() => setConfirmReplace(false)} />}
  </div>
}
