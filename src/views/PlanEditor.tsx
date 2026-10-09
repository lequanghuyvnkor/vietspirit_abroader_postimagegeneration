import { useState } from 'react'
import type { ApiKey } from '../lib/api.ts'
import { kindLabel } from '../lib/plan.ts'
import { pieceIssues } from '../lib/planCheck.ts'
import { FUNNELS, addPiece, codeIsTaken, duplicatePiece, emptyPiece, movePiece, nextCode, removePiece, setKind, sortByDate } from '../lib/planEdit.ts'
import { formatFor, funnelMix, suggestSkeleton, type Idea } from '../lib/planAi.ts'
import { navigate } from '../lib/route.ts'
import type { Campaign, Piece, PieceKind, Workspace } from '../lib/types.ts'
import { ConfirmDialog, Modal } from './ui.tsx'

type Props = {
  /** True while the Google Sheet still owns the plan: the grid is shown but cannot be edited. */
  locked?: boolean
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  keys: ApiKey[]
  onManageKeys: () => void
  onError: (message: string) => void
}

const KIND_OPTIONS: { value: PieceKind; label: string }[] = [{ value: 'static', label: 'Ảnh' }, { value: 'carousel', label: 'Carousel' }, { value: 'reel', label: 'Reel' }]

/** Asks the AI for a skeleton of N pieces, shows it, and adds the ones the user keeps. */
export function SkeletonDialog({ workspace, campaign, edit, keys, onManageKeys, onClose }: Omit<Props, 'onError'> & { onClose: () => void }) {
  const [count, setCount] = useState(6)
  const [note, setNote] = useState('')
  const [keyId, setKeyId] = useState('')
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [keep, setKeep] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mix = funnelMix(count)
  const key = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]

  async function ask() {
    setBusy(true)
    setError('')
    try {
      const result = await suggestSkeleton(workspace, campaign, count, note, key?.id)
      setIdeas(result)
      setKeep(new Set(result.map((_, index) => index)))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không lấy được gợi ý.') }
    finally { setBusy(false) }
  }

  function add() {
    if (!ideas) return
    edit((draft) => {
      const taken: string[] = []
      ideas.forEach((idea, index) => {
        if (!keep.has(index)) return
        const code = nextCode(draft.pieces, taken)
        taken.push(code)
        const piece = emptyPiece(code, idea.kind)
        piece.title = idea.title
        piece.date = idea.date
        Object.assign(piece.plan, { funnel: idea.funnel, pillar: idea.pillar, goal: idea.goal, hook: idea.hook || idea.title, structure: idea.structure, cta: idea.cta, audience: idea.audience, time: idea.time, format: formatFor(idea) })
        addPiece(draft, piece)
      })
    })
    onClose()
  }

  return <Modal title="AI gợi ý khung bài" onClose={onClose} wide>
    {!ideas && <div className="stack">
      <p className="muted">AI đọc phần Nền tảng (mục tiêu, đối tượng, trụ cột) và các bài đang có, rồi đề xuất khung các bài mới cân giữa các tầng phễu và các trụ cột. Chưa viết caption: bạn chọn bài nào giữ lại, rồi soạn tiếp từng bài.</p>
      <div className="row wrap end">
        <label className="field"><span className="field-label">Số bài mới</span><input type="number" min={1} max={20} value={count} onChange={(event) => setCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <small className="muted">Tỷ lệ phễu: {FUNNELS.map((funnel) => `${funnel} ${mix[funnel]}`).join(' · ')}</small>
      </div>
      <label className="field"><span className="field-label">Yêu cầu thêm (không bắt buộc)</span><textarea rows={2} placeholder="Ví dụ: ít reel hơn, thêm một bài giải đáp thắc mắc về chi phí" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {keys.length > 1 && <select aria-label="API dùng để gợi ý" value={key?.id ?? ''} onChange={(event) => setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>}
      {keys.length === 0 && <p className="notice">Cần API key văn bản. <button className="link" onClick={onManageKeys}>Thêm API key</button></p>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>}
    {ideas && <div className="stack">
      <p className="muted">Tick các bài muốn thêm. Ngày đăng được rải đều trong kỳ chiến dịch, sửa lại sau trong bảng.</p>
      <div className="list">
        {ideas.map((idea, index) => <label className="list-row" key={index}>
          <input type="checkbox" checked={keep.has(index)} onChange={() => setKeep((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} />
          <div className="list-main">
            <strong>{idea.title || idea.hook}</strong>
            <small>{[KIND_OPTIONS.find((option) => option.value === idea.kind)?.label, idea.funnel, idea.pillar, idea.date && idea.date.split('-').reverse().slice(0, 2).join('/')].filter(Boolean).join(' · ')}</small>
            {idea.hook && <span className="excerpt">Hook: {idea.hook}</span>}
          </div>
        </label>)}
      </div>
    </div>}
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      {ideas && <button className="btn" onClick={() => setIdeas(null)}>Gợi ý lại</button>}
      {!ideas && <button className="btn primary" disabled={busy || keys.length === 0} onClick={() => { void ask() }}>{busy ? 'AI đang lập khung…' : 'Gợi ý khung bài'}</button>}
      {ideas && <button className="btn primary" disabled={keep.size === 0} onClick={add}>Thêm {keep.size} bài vào kế hoạch</button>}
    </div>
  </Modal>
}

/** The plan as an editable grid: one row per piece, with add, duplicate, delete and reorder. */
export function PlanGrid({ workspace, campaign, edit, keys, onManageKeys, locked = false }: Props) {
  const [removing, setRemoving] = useState<Piece | null>(null)
  const [skeleton, setSkeleton] = useState(false)
  const funnels = new Set(FUNNELS)
  const pillarNames = campaign.foundation.pillars.map((pillar) => pillar.name).filter(Boolean)
  const patch = (id: string, change: (piece: Piece) => void) => edit((draft) => { const piece = draft.pieces.find((item) => item.id === id); if (piece) change(piece) })

  function add() {
    edit((draft) => { addPiece(draft, emptyPiece(nextCode(draft.pieces))) })
  }

  const listId = `pillars-${campaign.id}`
  return <div className="stack">
    <div className="row wrap">
      <button className="btn primary" disabled={locked} onClick={add}>+ Thêm bài</button>
      <button className="btn" disabled={locked} onClick={() => setSkeleton(true)}>AI gợi ý khung bài</button>
      <button className="btn small ghost" disabled={locked || campaign.pieces.length < 2} title="Xếp lại theo ngày và giờ đăng; bài chưa có ngày xuống cuối" onClick={() => edit(sortByDate)}>Sắp theo ngày</button>
    </div>
    {pillarNames.length > 0 && <datalist id={listId}>{pillarNames.map((name) => <option key={name} value={name} />)}</datalist>}
    {campaign.pieces.length === 0
      ? <p className="muted">Chưa có bài nào. Bấm "+ Thêm bài", để AI gợi ý khung, hoặc nhập từ Excel/Google Sheet.</p>
      : <div className="table-wrap"><table className="plan-grid">
        <thead><tr><th>Mã</th><th>Tên bài</th><th>Loại</th><th>Ngày</th><th>Giờ</th><th>Phễu</th><th>Trụ cột</th><th>Hook</th><th>CTA</th><th /></tr></thead>
        <tbody>
          {campaign.pieces.map((piece, index) => {
            const warn = pieceIssues(campaign, piece).filter((issue) => issue.level === 'warn').length
            const clash = codeIsTaken(campaign, piece)
            return <tr key={piece.id}>
              <td><input disabled={locked} className={clash ? 'code invalid' : 'code'} aria-label={`Mã bài ${piece.code}`} aria-invalid={clash} title={clash ? 'Mã trống hoặc trùng với bài khác' : undefined} value={piece.code} onChange={(event) => patch(piece.id, (item) => { item.code = event.target.value.trim() })} /></td>
              <td><input disabled={locked} aria-label={`Tên bài ${piece.code}`} value={piece.title} placeholder="Tên bài" onChange={(event) => patch(piece.id, (item) => { item.title = event.target.value })} /></td>
              <td>
                <select disabled={locked} aria-label={`Loại bài ${piece.code}`} value={piece.kind} onChange={(event) => patch(piece.id, (item) => setKind(item, event.target.value as PieceKind))}>{KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                {piece.kind === 'reel' && <small className="block muted">{kindLabel(piece).replace('Reel · ', '')}</small>}
              </td>
              <td><input disabled={locked} type="date" aria-label={`Ngày đăng ${piece.code}`} value={piece.date} onChange={(event) => patch(piece.id, (item) => { item.date = event.target.value })} /></td>
              <td><input disabled={locked} className="time" aria-label={`Giờ đăng ${piece.code}`} value={piece.plan.time} placeholder="20:30" onChange={(event) => patch(piece.id, (item) => { item.plan.time = event.target.value })} /></td>
              <td><select disabled={locked} aria-label={`Phễu ${piece.code}`} value={piece.plan.funnel} onChange={(event) => patch(piece.id, (item) => { item.plan.funnel = event.target.value })}>
                <option value="">—</option>
                {piece.plan.funnel && !funnels.has(piece.plan.funnel) && <option value={piece.plan.funnel}>{piece.plan.funnel}</option>}
                {FUNNELS.map((funnel) => <option key={funnel} value={funnel}>{funnel}</option>)}
              </select></td>
              <td><input disabled={locked} aria-label={`Trụ cột ${piece.code}`} list={pillarNames.length ? listId : undefined} value={piece.plan.pillar} placeholder="Trụ cột" onChange={(event) => patch(piece.id, (item) => { item.plan.pillar = event.target.value })} /></td>
              <td><input disabled={locked} aria-label={`Hook ${piece.code}`} value={piece.plan.hook} placeholder="Câu mở bài" onChange={(event) => patch(piece.id, (item) => { item.plan.hook = event.target.value })} /></td>
              <td><input disabled={locked} aria-label={`CTA ${piece.code}`} value={piece.plan.cta} placeholder="Kêu gọi" onChange={(event) => patch(piece.id, (item) => { item.plan.cta = event.target.value })} /></td>
              <td className="plan-actions">
                <button className="btn small" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>Mở{warn ? ` · ${warn}!` : ''}</button>
                <button className="btn small ghost" aria-label={`Lên ${piece.code}`} disabled={locked || index === 0} onClick={() => edit((draft) => movePiece(draft, piece.id, -1))}>↑</button>
                <button className="btn small ghost" aria-label={`Xuống ${piece.code}`} disabled={locked || index === campaign.pieces.length - 1} onClick={() => edit((draft) => movePiece(draft, piece.id, 1))}>↓</button>
                <button className="btn small ghost" disabled={locked} onClick={() => edit((draft) => { duplicatePiece(draft, piece.id) })}>Nhân bản</button>
                <button className="btn small ghost" disabled={locked} onClick={() => setRemoving(piece)}>Xóa</button>
              </td>
            </tr>
          })}
        </tbody>
      </table></div>}
    {removing && <ConfirmDialog title={`Xóa bài ${removing.code}`} message={`Xóa "${removing.title || removing.plan.hook || removing.code}" cùng các slide và bản chỉnh của bài này? Có thể khôi phục bằng nút Sao lưu ở thanh trên.`} confirm="Xóa bài" onConfirm={() => edit((draft) => removePiece(draft, removing.id))} onClose={() => setRemoving(null)} />}
    {skeleton && <SkeletonDialog workspace={workspace} campaign={campaign} edit={edit} keys={keys} onManageKeys={onManageKeys} onClose={() => setSkeleton(false)} />}
  </div>
}
