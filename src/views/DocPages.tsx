import { useState } from 'react'
import { campaignWindow } from '../lib/foundation.ts'
import { slidesOf } from '../lib/pack.ts'
import { kindLabel, madeInApp } from '../lib/plan.ts'
import { FUNNELS, addPiece, emptyPiece, nextCode, setKind } from '../lib/planEdit.ts'
import { navigate } from '../lib/route.ts'
import { sortedPieces } from '../lib/document.ts'
import { STATUS_LABELS, newId } from '../lib/types.ts'
import type { Campaign, Piece, PieceKind, Workspace } from '../lib/types.ts'
import { LazyInput } from './LazyInput.tsx'
import { LazyArea } from './SheetGrid.tsx'
import { SlideThumb } from './SlideThumb.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  /** The Google Sheet still owns the plan: pages are read-only. */
  locked: boolean
}

const OVERVIEW = 'overview'
const KEY = 'cs_doc_page'
const dm = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const KIND_OPTIONS: { value: PieceKind; label: string }[] = [{ value: 'static', label: 'Ảnh' }, { value: 'carousel', label: 'Carousel' }, { value: 'reel', label: 'Reel' }]

function readPage(campaign: Campaign): string {
  try { const saved = sessionStorage.getItem(`${KEY}:${campaign.id}`); if (saved === OVERVIEW || campaign.pieces.some((piece) => piece.id === saved)) return saved! } catch { /* Not remembered. */ }
  return OVERVIEW
}

/** The campaign document as pages: an overview, then one page per piece (the same tabs as the Google Docs). Every page is editable. */
export function DocPages({ workspace, campaign, edit, locked }: Props) {
  const [page, setPage] = useState(() => readPage(campaign))
  const pieces = sortedPieces(campaign)
  const current = pieces.find((piece) => piece.id === page)
  const choose = (id: string) => { setPage(id); try { sessionStorage.setItem(`${KEY}:${campaign.id}`, id) } catch { /* Ignore. */ } }
  const active = current ? current.id : OVERVIEW

  function addPage() {
    const id = newId()
    edit((draft) => { const piece = emptyPiece(nextCode(draft.pieces)); piece.id = id; addPiece(draft, piece) })
    choose(id)
  }

  return <div className="docs-app">
    <nav className="docs-tabs" aria-label="Các trang của tài liệu">
      <button className={active === OVERVIEW ? 'on' : ''} onClick={() => choose(OVERVIEW)}><span className="docs-ico">☰</span> Tổng quan</button>
      <div className="docs-tabs-label">Các bài ({pieces.length})</div>
      <div className="docs-tabs-list">
        {pieces.map((piece) => <button key={piece.id} className={active === piece.id ? 'on' : ''} onClick={() => choose(piece.id)} title={piece.title}>
          <span className={`dot ${piece.status}`} aria-hidden="true" />
          <span className="docs-tab-text"><b>{piece.code}</b> {piece.title || piece.plan.hook || 'Chưa đặt tên'}</span>
          {piece.date && <small>{dm(piece.date)}</small>}
        </button>)}
      </div>
      <button className="docs-add" disabled={locked} onClick={addPage}>+ Trang bài mới</button>
    </nav>
    <div className="docs-canvas">
      <article className="docs-paper">
        {current ? <PiecePage key={current.id} workspace={workspace} campaign={campaign} piece={current} edit={edit} locked={locked} /> : <OverviewPage workspace={workspace} campaign={campaign} pieces={pieces} onOpen={choose} />}
      </article>
    </div>
  </div>
}

function OverviewPage({ workspace, campaign, pieces, onOpen }: { workspace: Workspace; campaign: Campaign; pieces: Piece[]; onOpen: (id: string) => void }) {
  const f = campaign.foundation
  const window = campaignWindow(campaign)
  const facts: [string, string][] = ([
    ['Thương hiệu', workspace.company.name], ['Thời gian', window ? `${dm(window.start)} – ${dm(window.end)}/${window.end.slice(0, 4)}` : ''],
    ['Mục tiêu', f.objective], ['Ý tưởng lớn', f.bigIdea], ['Thông điệp chính', f.keyMessage], ['Giọng điệu', f.tone],
  ] as [string, string][]).filter(([, value]) => value.trim())
  return <>
    <h1 className="docs-title">{campaign.name}</h1>
    <p className="docs-sub">Tài liệu kế hoạch nội dung · {pieces.length} bài</p>
    {facts.length > 0 && <table className="docs-table"><tbody>{facts.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table>}
    {f.pillars.length > 0 && <><h2>Trụ cột nội dung</h2><table className="docs-table"><thead><tr><th>Trụ cột</th><th>Thông điệp</th></tr></thead><tbody>{f.pillars.map((pillar) => <tr key={pillar.id}><td>{pillar.name}</td><td>{pillar.message}</td></tr>)}</tbody></table></>}
    <h2>Lịch đăng</h2>
    {pieces.length === 0 ? <p className="muted">Chưa có bài nào. Bấm "+ Trang bài mới" bên trái.</p> : <table className="docs-table clickable"><thead><tr><th>Ngày</th><th>Giờ</th><th>Bài</th><th>Loại</th><th>Funnel</th><th>Trạng thái</th></tr></thead>
      <tbody>{pieces.map((piece) => <tr key={piece.id} tabIndex={0} onClick={() => onOpen(piece.id)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(piece.id) }}>
        <td>{dm(piece.date)}</td><td>{piece.plan.time}</td><td><b>{piece.code}</b> {piece.title || piece.plan.hook}</td><td>{kindLabel(piece)}</td><td>{piece.plan.funnel}</td><td>{STATUS_LABELS[piece.status]}{piece.published ? ' · đã đăng' : ''}</td>
      </tr>)}</tbody></table>}
    <p className="muted">Chiến lược chi tiết sửa ở Kế hoạch › 01 Chiến lược (hoặc tab ① Nền tảng).</p>
  </>
}

function PiecePage({ workspace, campaign, piece, edit, locked }: { workspace: Workspace; campaign: Campaign; piece: Piece; edit: Props['edit']; locked: boolean }) {
  const set = (change: (piece: Piece, value: string) => void) => (value: string) => edit((draft) => { const target = draft.pieces.find((item) => item.id === piece.id); if (target) change(target, value) })
  const slides = slidesOf(campaign, piece)
  const area = (label: string, value: string, apply: (piece: Piece, value: string) => void, rows = 3, placeholder = '') => <section className="docs-section">
    <h2>{label}</h2>
    <LazyArea className="docs-area" rows={Math.max(rows, Math.min(14, value.split('\n').length + 1))} disabled={locked} placeholder={placeholder || `Viết ${label.toLowerCase()}…`} value={value} onCommit={set(apply)} aria-label={label} />
  </section>
  return <>
    <div className="docs-code">{piece.code}{piece.approval && piece.status === 'ready' ? ' · 🔒 Đã duyệt' : ` · ${STATUS_LABELS[piece.status]}`}{piece.published ? ' · đã đăng' : ''}</div>
    <LazyInput className="docs-title-input" disabled={locked} placeholder="Tên bài" aria-label="Tên bài" value={piece.title} onCommit={set((p, v) => { p.title = v })} />
    <table className="docs-table props"><tbody>
      <tr><th>Ngày đăng</th><td><input type="date" disabled={locked} value={piece.date} onChange={(event) => set((p, v) => { p.date = v })(event.target.value)} /></td><th>Giờ</th><td><LazyInput disabled={locked} value={piece.plan.time} placeholder="20:30" onCommit={set((p, v) => { p.plan.time = v })} /></td></tr>
      <tr><th>Loại</th><td><select disabled={locked} value={piece.kind} onChange={(event) => set((p, v) => setKind(p, v as PieceKind))(event.target.value)}>{KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
        <th>Funnel</th><td><select disabled={locked} value={piece.plan.funnel} onChange={(event) => set((p, v) => { p.plan.funnel = v })(event.target.value)}><option value="">—</option>{FUNNELS.map((funnel) => <option key={funnel} value={funnel}>{funnel}</option>)}</select></td></tr>
      <tr><th>Trụ cột</th><td colSpan={3}><LazyInput disabled={locked} value={piece.plan.pillar} placeholder="Trụ cột" onCommit={set((p, v) => { p.plan.pillar = v })} /></td></tr>
    </tbody></table>
    {area('Hook', piece.plan.hook, (p, v) => { p.plan.hook = v }, 2)}
    {area('Mục tiêu', piece.plan.goal, (p, v) => { p.plan.goal = v }, 2)}
    {area('Cấu trúc nội dung', piece.plan.structure, (p, v) => { p.plan.structure = v }, 3, 'S1: …; S2: … (carousel) hoặc 0-3s: … (reel)')}
    <section className="docs-section"><h2>CTA</h2><LazyInput className="docs-line" disabled={locked} value={piece.plan.cta} placeholder="Lời kêu gọi" onCommit={set((p, v) => { p.plan.cta = v })} /></section>
    {area('Caption', piece.caption, (p, v) => { p.caption = v }, 6, 'Caption (giữ nguyên [TÊN BIẾN])')}
    <section className="docs-section"><h2>Hashtag</h2><LazyInput className="docs-line" disabled={locked} value={piece.hashtags} placeholder="#hashtag" onCommit={set((p, v) => { p.hashtags = v })} /></section>
    <section className="docs-section">
      <h2>{piece.kind === 'reel' ? 'Cảnh' : 'Hình ảnh'} ({slides.length})</h2>
      {!madeInApp(piece) ? <p className="muted">Reel có người thật do bên khác quay: app chỉ theo dõi caption, mục duyệt và tài nguyên.</p>
        : slides.length === 0 ? <p className="muted">Chưa có slide. Mở trang bài để tạo slide và ảnh.</p>
          : <div className="docs-slides">{slides.map((post) => <figure key={post.id}><SlideThumb post={post} campaign={campaign} workspace={workspace} width={150} /><figcaption>{post.headline || post.name}</figcaption></figure>)}</div>}
    </section>
    {piece.checks.length > 0 && <section className="docs-section"><h2>Mục cần duyệt</h2><ul className="docs-checks">{piece.checks.map((check) => <li key={check.id}>
      <label><input type="checkbox" disabled={locked} checked={check.done} onChange={(event) => edit((draft) => { const target = draft.pieces.find((item) => item.id === piece.id)?.checks.find((entry) => entry.id === check.id); if (target) target.done = event.target.checked })} /> <span className={check.done ? 'done' : ''}>{check.text}</span> <small className="muted">· {check.owner}</small></label>
    </li>)}</ul></section>}
    <div className="docs-foot"><button className="btn" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>Mở trang bài: tạo ảnh, duyệt, xuất</button></div>
  </>
}
