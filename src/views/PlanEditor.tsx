import { useState } from 'react'
import type { ApiKey } from '../lib/api.ts'
import { FUNNELS, addPiece, emptyPiece, nextCode } from '../lib/planEdit.ts'
import { formatFor, funnelMix, suggestSkeleton, type Idea } from '../lib/planAi.ts'
import type { Campaign, PieceKind, Workspace } from '../lib/types.ts'
import { Modal } from './ui.tsx'

type Props = {
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
