import { useState } from 'react'
import { applyVars } from '../lib/text.ts'
import { autoChecks, blockersOf, approvePiece, diffSummary, recordVersion, reopenPiece, requestChanges, restoreVersion, submitForReview } from '../lib/review.ts'
import type { Campaign, Piece, PieceVersionEvent } from '../lib/types.ts'
import { Modal, Section } from './ui.tsx'

type Props = {
  campaign: Campaign
  piece: Piece
  parked: boolean
  edit: (change: (draft: Campaign, item: Piece) => void) => void
}

const EVENT_LABEL: Record<PieceVersionEvent, string> = {
  submitted: 'Gửi duyệt', approved: 'Đã duyệt', changes: 'Yêu cầu sửa', edited: 'Sửa sau khi duyệt', reopened: 'Mở lại để sửa', manual: 'Bạn lưu', restore: 'Trước khi khôi phục',
}
const ICON = { block: '✖', warn: '⚠', info: 'ℹ', ok: '✔' } as const
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Two-tier review: the app checks facts and style by itself, then the user approves the brand side; approved pieces are locked by content. */
export function ReviewPanel({ campaign, piece, parked, edit }: Props) {
  const [dialog, setDialog] = useState<'approve' | 'changes' | null>(null)
  const [note, setNote] = useState('')
  const [confirmRestore, setConfirmRestore] = useState('')
  const checks = autoChecks(campaign, piece)
  const blockers = blockersOf(checks)
  const openChecks = piece.checks.filter((check) => !check.done)
  const approved = piece.status === 'ready' && Boolean(piece.approval)
  const inReview = piece.status === 'review'
  const canApprove = blockers.length === 0 && openChecks.length === 0
  const history = [...(piece.history ?? [])].reverse()
  const closeDialog = () => { setDialog(null); setNote('') }

  return <Section title={`${parked ? '' : '3 · '}Duyệt`} aside={<span className="muted">{piece.checks.filter((check) => check.done).length}/{piece.checks.length} mục</span>}>
    <div className="review-tier">
      <h3>Tầng 1 · App tự soát</h3>
      <ul className="auto-checks">
        {checks.map((check) => <li key={check.text} className={`auto-${check.level}`}><span aria-hidden="true">{ICON[check.level]}</span> {check.text}</li>)}
      </ul>
      {blockers.length > 0 && <small className="muted">Các mục ✖ phải sửa xong mới gửi duyệt hoặc duyệt được.</small>}
    </div>

    <div className="review-tier">
      <h3>Tầng 2 · Duyệt thương hiệu (bạn)</h3>
      {piece.reviewNote && <p className="notice">{piece.reviewNote}</p>}
      {piece.checks.length === 0 && <p className="muted">Không có mục duyệt nào.</p>}
      <div className="list">
        {piece.checks.map((check) => <label className="check-row" key={check.id}>
          <input type="checkbox" checked={check.done} onChange={(event) => edit((_, item) => { const target = item.checks.find((entry) => entry.id === check.id); if (target) target.done = event.target.checked })} />
          <span><span className={check.done ? 'done' : ''}>{check.text}</span><small className="muted"> · {check.owner}</small></span>
        </label>)}
      </div>
      {piece.compliance && <p className="muted">Ghi chú duyệt: {applyVars(piece.compliance, campaign.variables)}</p>}

      {approved && <div className="notice approved" role="status">
        <strong>🔒 Đã duyệt lúc {when(piece.approval!.at)}</strong>{piece.approval!.note ? ` · ${piece.approval!.note}` : ''}
        <p className="muted">Sửa bất cứ chữ, ảnh hay lịch nào của bài này thì bài tự quay về "Chờ duyệt".</p>
      </div>}

      <div className="row wrap">
        {!inReview && !approved && <button className="btn" disabled={blockers.length > 0} onClick={() => edit((c, item) => submitForReview(c, item))}>Gửi duyệt</button>}
        {inReview && <>
          <button className="btn primary" disabled={!canApprove} onClick={() => setDialog('approve')}>Duyệt thương hiệu</button>
          <button className="btn" onClick={() => setDialog('changes')}>Yêu cầu sửa</button>
        </>}
        {approved && <button className="btn" onClick={() => edit((c, item) => reopenPiece(c, item))}>Mở lại để sửa</button>}
        {piece.status === 'ready' && !piece.approval && <button className="btn primary" disabled={!canApprove} title="Bài này được đặt Sẵn sàng trước khi có bước duyệt; ghi nhận duyệt để khóa nội dung" onClick={() => setDialog('approve')}>Ghi nhận duyệt</button>}
        {!canApprove && (inReview || (piece.status === 'ready' && !piece.approval)) && <small className="muted">Cần: {[blockers.length ? `sửa ${blockers.length} mục ✖` : '', openChecks.length ? `tick ${openChecks.length} mục duyệt` : ''].filter(Boolean).join(' và ')}.</small>}
      </div>
    </div>

    <details className="review-history">
      <summary><strong>Lịch sử phiên bản ({history.length})</strong> <span className="muted">mỗi lần gửi duyệt, duyệt, yêu cầu sửa đều được lưu</span></summary>
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
      {history.length > 0 && <small className="muted">Khôi phục lưu lại bản hiện tại trước, rồi đưa bài về trạng thái "Copy" để duyệt lại.</small>}
    </details>

    {dialog === 'approve' && <Modal title={`Duyệt ${piece.code}`} onClose={closeDialog}>
      <p>Xác nhận bài này đạt về thương hiệu và dữ kiện. Bài được khóa theo nội dung hiện tại.</p>
      <label className="field"><span className="field-label">Ghi chú duyệt (không bắt buộc)</span><input autoFocus value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="modal-actions"><button className="btn ghost" onClick={closeDialog}>Hủy</button><button className="btn primary" onClick={() => { edit((c, item) => approvePiece(c, item, note.trim())); closeDialog() }}>Duyệt</button></div>
    </Modal>}
    {dialog === 'changes' && <Modal title={`Yêu cầu sửa ${piece.code}`} onClose={closeDialog}>
      <label className="field"><span className="field-label">Cần sửa gì?</span><textarea autoFocus rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="modal-actions"><button className="btn ghost" onClick={closeDialog}>Hủy</button><button className="btn primary" disabled={!note.trim()} onClick={() => { edit((c, item) => requestChanges(c, item, note.trim())); closeDialog() }}>Gửi yêu cầu sửa</button></div>
    </Modal>}
  </Section>
}
