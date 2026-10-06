import { useRef, useState, type ChangeEvent } from 'react'
import { collectTokens, draftSlides, parsePlan, pieceTexts, type ParsedPlan } from '../lib/plan.ts'
import { navigate } from '../lib/route.ts'
import { unresolvedIn } from '../lib/text.ts'
import { STATUS_LABELS } from '../lib/types.ts'
import type { Campaign, Piece, Workspace } from '../lib/types.ts'
import { readXlsx } from '../lib/xlsx.ts'
import { Field, Modal, Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onError: (message: string) => void
}

const KIND_LABEL = { static: 'Ảnh', carousel: 'Carousel', reel: 'Reel · treo' }

function ImportDialog({ workspace, campaign, edit, onClose, onError }: Props & { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ParsedPlan | null>(null)
  const [makeSlides, setMakeSlides] = useState(true)
  const [error, setError] = useState('')

  async function open(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try { setPlan(parsePlan(readXlsx(new Uint8Array(await file.arrayBuffer())))) }
    catch (caught) { setPlan(null); setError(caught instanceof Error ? caught.message : 'Không đọc được file Excel.') }
  }

  function apply() {
    if (!plan) return
    try {
      edit((draft) => {
        draft.posts = draft.posts.filter((post) => !post.pieceId)
        draft.pieces = plan.pieces
        draft.strategy = plan.strategy
        draft.guardrailNotes = plan.guardrailNotes
        if (makeSlides) for (const piece of plan.pieces) draft.posts.push(...draftSlides(piece, workspace.company, draft.backgrounds))
      })
      onClose()
    } catch (caught) { onError(caught instanceof Error ? caught.message : 'Không áp dụng được kế hoạch.') }
  }

  const count = (kind: Piece['kind']) => plan?.pieces.filter((piece) => piece.kind === kind).length ?? 0
  return <Modal title="Nhập kế hoạch nội dung (Excel)" onClose={onClose} wide>
    <input ref={input} type="file" accept=".xlsx" hidden onChange={open} />
    {!plan && <div className="import-start">
      <p>Chọn file kế hoạch .xlsx có các sheet Strategy, Calendar, Captions, Visual Brief. App tạo sẵn từng bài với caption, checklist, visual brief, và các slide nháp cho bài carousel.</p>
      <button className="btn primary" onClick={() => input.current?.click()}>Chọn file Excel</button>
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {plan && <div className="import-review">
      <p><strong>{plan.pieces.length} bài</strong>: {count('carousel')} carousel, {count('static')} ảnh, {count('reel')} reel (reel được treo: theo dõi caption và checklist, chưa làm hình).</p>
      <p className="muted">Đã đọc chiến lược ({plan.strategy.length.toLocaleString('vi-VN')} ký tự) và {plan.guardrailNotes.length} điều "không được nói".</p>
      <div className="list">
        {plan.pieces.map((piece) => <div className="list-row" key={piece.id}>
          <div className="list-main"><strong>{piece.code} · {piece.title}</strong><small>{piece.plan.format} · {piece.plan.funnel} · {piece.checks.length} mục cần duyệt</small></div>
        </div>)}
      </div>
      <label className="check"><input type="checkbox" checked={makeSlides} onChange={(event) => setMakeSlides(event.target.checked)} /> Tạo sẵn slide nháp cho bài carousel/ảnh</label>
      {campaign.pieces.length > 0 && <p className="notice">Chiến dịch đã có kế hoạch: kế hoạch cũ và các slide thuộc nó sẽ được thay thế. Bài đăng lẻ không bị ảnh hưởng.</p>}
    </div>}
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      {plan && <button className="btn primary" onClick={apply}>Áp dụng kế hoạch</button>}
    </div>
  </Modal>
}

export function PlanSection(props: Props) {
  const { workspace, campaign, edit } = props
  const [importing, setImporting] = useState(false)
  const tokens = collectTokens(campaign)

  return <>
    <Section title="Kế hoạch nội dung" aside={<button className="btn small primary" onClick={() => setImporting(true)}>Nhập kế hoạch (Excel)</button>}>
      {campaign.pieces.length === 0
        ? <p className="muted">Chưa có kế hoạch. Nhập file Excel kế hoạch nội dung để tạo sẵn các bài, caption, checklist và slide nháp.</p>
        : <div className="list">
          {campaign.pieces.map((piece) => {
            const missing = pieceTexts(campaign, piece).flatMap((text) => unresolvedIn(text, campaign.variables))
            const done = piece.checks.filter((check) => check.done).length
            return <div className="list-row" key={piece.id}>
              <button className="list-main" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>
                <strong>{piece.code} · {piece.title}</strong>
                <small>{KIND_LABEL[piece.kind]}{piece.date ? ` · ${new Date(piece.date).toLocaleDateString('vi-VN')}` : ' · chưa có ngày'} · duyệt {done}/{piece.checks.length}{missing.length ? ` · ${new Set(missing).size} biến chưa điền` : ''}</small>
              </button>
              <span className={`status ${piece.status}`}>{STATUS_LABELS[piece.status]}</span>
            </div>
          })}
        </div>}
    </Section>

    {tokens.size > 0 && <Section title="Biến chiến dịch" aside={<span className="muted">{[...tokens.keys()].filter((key) => !campaign.variables[key]?.trim()).length}/{tokens.size} chưa điền</span>}>
      <p className="muted">Điền một lần, tự thay vào mọi caption và slide khi xem trước và xuất ảnh.</p>
      <div className="vars">
        {[...tokens.entries()].map(([key, count]) => <Field key={key} label={`[${key}]`} hint={`Xuất hiện ${count} lần`}>
          <input value={campaign.variables[key] ?? ''} onChange={(event) => edit((draft) => { draft.variables[key] = event.target.value })} />
        </Field>)}
      </div>
    </Section>}
    {importing && <ImportDialog {...props} onClose={() => setImporting(false)} />}
  </>
}
