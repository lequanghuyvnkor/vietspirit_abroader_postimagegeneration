import { useState } from 'react'
import { autoChecks, blockersOf, diffSummary, recordVersion, restoreVersion } from '../lib/review.ts'
import type { Campaign, Piece, PieceVersionEvent } from '../lib/types.ts'
import { Section } from './ui.tsx'

type Props = {
  campaign: Campaign
  piece: Piece
  parked: boolean
  edit: (change: (draft: Campaign, item: Piece) => void) => void
}

const EVENT_LABEL: Record<PieceVersionEvent, string> = { manual: 'Bạn lưu', restore: 'Trước khi khôi phục' }
const ICON = { block: '✖', warn: '⚠', info: 'ℹ', ok: '✔' } as const
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** The last look before a piece goes out: the app's own check, the checklist, then "Sẵn sàng". Saved versions let you go back. */
export function ReviewPanel({ campaign, piece, parked, edit }: Props) {
  const [confirmRestore, setConfirmRestore] = useState('')
  const checks = autoChecks(campaign, piece)
  const blockers = blockersOf(checks)
  const openChecks = piece.checks.filter((check) => !check.done)
  const ready = piece.status === 'ready'
  const canReady = blockers.length === 0 && openChecks.length === 0
  const history = [...(piece.history ?? [])].reverse()

  return <Section title={`${parked ? '' : '3 · '}Soát và sẵn sàng`} aside={<span className="muted">{piece.checks.filter((check) => check.done).length}/{piece.checks.length} mục</span>}>
    <div className="review-tier">
      <h3>App tự soát</h3>
      <ul className="auto-checks">
        {checks.map((check) => <li key={check.text} className={`auto-${check.level}`}><span aria-hidden="true">{ICON[check.level]}</span> {check.text}</li>)}
      </ul>
      {blockers.length > 0 && <small className="muted">Các mục ✖ phải sửa xong mới đánh dấu Sẵn sàng được.</small>}
    </div>

    <div className="review-tier">
      <h3>Mục cần kiểm tra</h3>
      {piece.checks.length === 0 && <p className="muted">Không có mục nào. Thêm ở "Sửa kế hoạch của bài" hoặc ở sheet 04 Checklist.</p>}
      <div className="list">
        {piece.checks.map((check) => <label className="check-row" key={check.id}>
          <input type="checkbox" checked={check.done} onChange={(event) => edit((_, item) => { const target = item.checks.find((entry) => entry.id === check.id); if (target) target.done = event.target.checked })} />
          <span><span className={check.done ? 'done' : ''}>{check.text}</span><small className="muted"> · {check.owner}</small></span>
        </label>)}
      </div>
      <div className="row wrap">
        {!ready && <button className="btn primary" disabled={!canReady} onClick={() => edit((_, item) => { item.status = 'ready' })}>Đánh dấu sẵn sàng</button>}
        {ready && <button className="btn" onClick={() => edit((_, item) => { item.status = 'copy' })}>Bỏ đánh dấu sẵn sàng</button>}
        {ready && <span className="flag ok">Sẵn sàng đăng</span>}
        {!ready && !canReady && <small className="muted">Cần: {[blockers.length ? `sửa ${blockers.length} mục ✖` : '', openChecks.length ? `tick ${openChecks.length} mục kiểm tra` : ''].filter(Boolean).join(' và ')}.</small>}
      </div>
    </div>

    <details className="review-history">
      <summary><strong>Phiên bản đã lưu ({history.length})</strong> <span className="muted">lưu lại trước khi sửa lớn để quay về được</span></summary>
      <div className="row"><button className="btn small" onClick={() => edit((c, item) => recordVersion(c, item, 'manual'))}>Lưu phiên bản bây giờ</button></div>
      {history.length === 0 && <p className="muted">Chưa có phiên bản nào.</p>}
      <div className="list">
        {history.map((version) => {
          const diff = diffSummary(campaign, piece, version.snapshot)
          return <div className="list-row" key={version.id}>
            <div className="list-main">
              <strong>{EVENT_LABEL[version.event]} · {when(version.at)}</strong>
              <small>{version.note ? `${version.note} · ` : ''}{diff.length ? `Khác bản hiện tại: ${diff.join(', ')}` : 'Giống bản hiện tại'}</small>
            </div>
            {confirmRestore === version.id
              ? <>
                <button className="btn small primary" onClick={() => { edit((c, item) => { restoreVersion(c, item, version.id) }); setConfirmRestore('') }}>Khôi phục</button>
                <button className="btn small ghost" onClick={() => setConfirmRestore('')}>Hủy</button>
              </>
              : <button className="btn small" disabled={diff.length === 0} onClick={() => setConfirmRestore(version.id)}>Khôi phục</button>}
          </div>
        })}
      </div>
      {history.length > 0 && <small className="muted">Khôi phục lưu lại bản hiện tại trước, rồi đưa bài về trạng thái "Copy".</small>}
    </details>
  </Section>
}
