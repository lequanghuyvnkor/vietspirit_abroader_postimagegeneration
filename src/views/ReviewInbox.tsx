import { useState } from 'react'
import { navigate } from '../lib/route.ts'
import { slidesOf } from '../lib/pack.ts'
import { approvePiece, autoChecks, blockersOf, requestChanges, reviewQueue, type ReviewEntry } from '../lib/review.ts'
import { applyVars } from '../lib/text.ts'
import { now } from '../lib/types.ts'
import type { Campaign, Piece, Store } from '../lib/types.ts'
import { Modal } from './ui.tsx'
import { SlideThumb } from './SlideThumb.tsx'

type Props = { store: Store; update: (change: (draft: Store) => void) => void }

const ICON = { block: '✖', warn: '⚠', info: 'ℹ', ok: '✔' } as const

function ReviewCard({ entry, update }: { entry: ReviewEntry; update: Props['update'] }) {
  const { workspace, campaign, piece } = entry
  const [full, setFull] = useState(false)
  const [asking, setAsking] = useState(false)
  const [approving, setApproving] = useState(false)
  const [note, setNote] = useState('')
  const checks = autoChecks(campaign, piece)
  const blockers = blockersOf(checks)
  const open = piece.checks.filter((check) => !check.done).length
  const slides = slidesOf(campaign, piece)
  const caption = applyVars(piece.caption, campaign.variables)

  const change = (fn: (campaign: Campaign, piece: Piece) => void) => update((draft) => {
    const target = draft.workspaces.find((item) => item.id === workspace.id)?.campaigns.find((item) => item.id === campaign.id)
    const item = target?.pieces.find((entryPiece) => entryPiece.id === piece.id)
    if (target && item) { fn(target, item); target.updatedAt = now() }
  })

  return <article className="card review-card">
    <header>
      <small className="muted">{workspace.name} · {campaign.name}</small>
      <h2><button className="link plain" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>{piece.code} · {piece.title || piece.plan.hook}</button></h2>
      <small className="muted">{piece.date ? `${piece.date.slice(8, 10)}/${piece.date.slice(5, 7)}` : 'chưa có ngày'} {piece.plan.time} · {piece.plan.funnel}</small>
    </header>
    {slides.length > 0 && <div className="swipe">{slides.map((post) => <SlideThumb key={post.id} post={post} campaign={campaign} workspace={workspace} width={200} />)}</div>}
    <p className={full ? 'caption-full' : 'caption-clip'}>{caption || <span className="muted">Chưa có caption.</span>}</p>
    {caption.length > 160 && <button className="link" onClick={() => setFull((value) => !value)}>{full ? 'Thu gọn' : 'Xem hết caption'}</button>}
    <ul className="auto-checks">{checks.slice(0, full ? 20 : 4).map((check) => <li key={check.text} className={`auto-${check.level}`}><span aria-hidden="true">{ICON[check.level]}</span> {check.text}</li>)}</ul>
    {piece.checks.length > 0 && <div className="list">{piece.checks.map((check) => <label className="check-row" key={check.id}>
      <input type="checkbox" checked={check.done} onChange={(event) => change((_, item) => { const target = item.checks.find((entryCheck) => entryCheck.id === check.id); if (target) target.done = event.target.checked })} />
      <span className={check.done ? 'done' : ''}>{check.text}<small className="muted"> · {check.owner}</small></span>
    </label>)}</div>}
    <div className="row wrap review-actions">
      <button className="btn primary" disabled={blockers.length > 0 || open > 0} onClick={() => setApproving(true)}>Duyệt</button>
      <button className="btn" onClick={() => setAsking(true)}>Yêu cầu sửa</button>
      {(blockers.length > 0 || open > 0) && <small className="muted">Cần {[blockers.length ? `sửa ${blockers.length} mục ✖` : '', open ? `tick ${open} mục duyệt` : ''].filter(Boolean).join(' và ')} trước khi duyệt.</small>}
    </div>
    {approving && <Modal title={`Duyệt ${piece.code}`} onClose={() => setApproving(false)}>
      <label className="field"><span className="field-label">Ghi chú (không bắt buộc)</span><input autoFocus value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="modal-actions"><button className="btn ghost" onClick={() => setApproving(false)}>Hủy</button><button className="btn primary" onClick={() => { change((c, item) => approvePiece(c, item, note.trim())); setApproving(false); setNote('') }}>Duyệt</button></div>
    </Modal>}
    {asking && <Modal title={`Yêu cầu sửa ${piece.code}`} onClose={() => setAsking(false)}>
      <label className="field"><span className="field-label">Cần sửa gì?</span><textarea autoFocus rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="modal-actions"><button className="btn ghost" onClick={() => setAsking(false)}>Hủy</button><button className="btn primary" disabled={!note.trim()} onClick={() => { change((c, item) => requestChanges(c, item, note.trim())); setAsking(false); setNote('') }}>Gửi</button></div>
    </Modal>}
  </article>
}

/** Every piece waiting for brand approval, across campaigns, as cards that read well on a phone. */
export function ReviewInbox({ store, update }: Props) {
  const queue = reviewQueue(store)
  return <div className="page review-inbox">
    <div className="page-head"><div><span className="eyebrow">Duyệt nhanh</span><h1>{queue.length ? `${queue.length} bài chờ duyệt` : 'Không có bài nào chờ duyệt'}</h1></div></div>
    {queue.length === 0 && <p className="muted">Khi một bài được "Gửi duyệt" ở trang bài, nó hiện ở đây để bạn xem ảnh, caption, kết quả tự soát và duyệt ngay.</p>}
    <div className="review-list">{queue.map((entry) => <ReviewCard key={entry.piece.id} entry={entry} update={update} />)}</div>
  </div>
}
