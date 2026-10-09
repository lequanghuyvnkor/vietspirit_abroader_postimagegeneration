import { useState } from 'react'
import { campaignWindow } from '../lib/foundation.ts'
import { slidesOf } from '../lib/pack.ts'
import { kindLabel, madeInApp } from '../lib/plan.ts'
import { navigate } from '../lib/route.ts'
import { sortedPieces } from '../lib/document.ts'
import { applyVars } from '../lib/text.ts'
import { STATUS_LABELS } from '../lib/types.ts'
import type { Campaign, Piece, Workspace } from '../lib/types.ts'
import { SlideThumb } from './SlideThumb.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
}

const OVERVIEW = 'overview'
const KEY = 'cs_doc_page'
const dm = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')

function readPage(campaign: Campaign): string {
  try { const saved = sessionStorage.getItem(`${KEY}:${campaign.id}`); if (saved === OVERVIEW || campaign.pieces.some((piece) => piece.id === saved)) return saved! } catch { /* Not remembered. */ }
  return OVERVIEW
}

/** The campaign document as read-only pages: an overview, then one page per piece (the same tabs as a Google Doc). Editing is done in ③ Kế hoạch and on the piece's page. */
export function DocPages({ workspace, campaign }: Props) {
  const [page, setPage] = useState(() => readPage(campaign))
  const pieces = sortedPieces(campaign)
  const current = pieces.find((piece) => piece.id === page)
  const choose = (id: string) => { setPage(id); try { sessionStorage.setItem(`${KEY}:${campaign.id}`, id) } catch { /* Ignore. */ } }
  const active = current ? current.id : OVERVIEW

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
    </nav>
    <div className="docs-canvas">
      <article className="docs-paper">
        {current ? <PiecePage workspace={workspace} campaign={campaign} piece={current} /> : <OverviewPage workspace={workspace} campaign={campaign} pieces={pieces} onOpen={choose} />}
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
    {pieces.length === 0 ? <p className="muted">Chưa có bài nào. Thêm bài ở tab ③ Kế hoạch.</p> : <table className="docs-table clickable"><thead><tr><th>Ngày</th><th>Giờ</th><th>Bài</th><th>Loại</th><th>Funnel</th><th>Trạng thái</th></tr></thead>
      <tbody>{pieces.map((piece) => <tr key={piece.id} tabIndex={0} onClick={() => onOpen(piece.id)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(piece.id) }}>
        <td>{dm(piece.date)}</td><td>{piece.plan.time}</td><td><b>{piece.code}</b> {piece.title || piece.plan.hook}</td><td>{kindLabel(piece)}</td><td>{piece.plan.funnel}</td><td>{STATUS_LABELS[piece.status]}{piece.published ? ' · đã đăng' : ''}</td>
      </tr>)}</tbody></table>}
  </>
}

function PiecePage({ workspace, campaign, piece }: { workspace: Workspace; campaign: Campaign; piece: Piece }) {
  const slides = slidesOf(campaign, piece)
  const fill = (text: string) => applyVars(text, campaign.variables)
  const rows: [string, string][] = ([
    ['Ngày giờ đăng', `${piece.date ? `${dm(piece.date)}/${piece.date.slice(0, 4)}` : 'Chưa xếp lịch'} ${piece.plan.time}`.trim()], ['Loại', `${kindLabel(piece)}${piece.plan.format ? ` · ${piece.plan.format}` : ''}`],
    ['Funnel · Trụ cột', [piece.plan.funnel, piece.plan.pillar].filter(Boolean).join(' · ')], ['Trạng thái', `${STATUS_LABELS[piece.status]}${piece.published ? ' · đã đăng' : ''}`],
  ] as [string, string][]).filter(([, value]) => value.trim())
  const section = (label: string, text: string) => text.trim() ? <section className="docs-section"><h2>{label}</h2><p className="docs-text">{fill(text)}</p></section> : null
  return <>
    <div className="docs-code">{piece.code}</div>
    <h1 className="docs-title">{piece.title || piece.plan.hook || 'Chưa đặt tên'}</h1>
    <table className="docs-table props"><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table>
    {section('Hook', piece.plan.hook)}
    {section('Mục tiêu', piece.plan.goal)}
    {section('Cấu trúc nội dung', piece.plan.structure)}
    {section('CTA', piece.plan.cta)}
    {section('Caption', piece.caption)}
    {section('Hashtag', piece.hashtags)}
    <section className="docs-section">
      <h2>{piece.kind === 'reel' ? 'Cảnh' : 'Hình ảnh'} ({slides.length})</h2>
      {!madeInApp(piece) ? <p className="muted">Reel có người thật do bên khác quay.</p>
        : slides.length === 0 ? <p className="muted">Chưa có slide. Mở trang bài để tạo slide và ảnh.</p>
          : <div className="docs-slides">{slides.map((post) => <figure key={post.id}><SlideThumb post={post} campaign={campaign} workspace={workspace} width={150} /><figcaption>{post.headline || post.name}</figcaption></figure>)}</div>}
    </section>
    {piece.checks.length > 0 && <section className="docs-section"><h2>Mục cần kiểm tra</h2><ul className="docs-checks">{piece.checks.map((check) => <li key={check.id}><span aria-hidden="true">{check.done ? '☑' : '☐'}</span> <span className={check.done ? 'done' : ''}>{check.text}</span> <small className="muted">· {check.owner}</small></li>)}</ul></section>}
    <div className="docs-foot"><button className="btn" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>Mở trang bài để sửa, tạo ảnh</button></div>
  </>
}
