import { useRef, useState, type ChangeEvent } from 'react'
import type { ApiKey } from '../lib/api.ts'
import { applyDraft, attachBackground, fetchDraft, generatePieceBackground } from '../lib/draft.ts'
import { collectTokens, draftSlides, parsePlan, pieceTexts, type ParsedPlan } from '../lib/plan.ts'
import { navigate } from '../lib/route.ts'
import { unresolvedIn } from '../lib/text.ts'
import { STATUS_LABELS } from '../lib/types.ts'
import type { Campaign, Piece, Workspace } from '../lib/types.ts'
import { readXlsx } from '../lib/xlsx.ts'
import { ConfirmDialog, Field, Modal, Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onError: (message: string) => void
  keys: ApiKey[]
  onManageKeys: () => void
}

const KIND_LABEL = { static: 'Ảnh', carousel: 'Carousel', reel: 'Reel · treo' }

function ImportDialog({ workspace, campaign, edit, onClose, onError, keys, onImported }: Props & { onClose: () => void; onImported: (plan: ParsedPlan, runAi: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ParsedPlan | null>(null)
  const [makeSlides, setMakeSlides] = useState(true)
  const [runAi, setRunAi] = useState(keys.length > 0)
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
      onImported(plan, runAi && makeSlides && keys.length > 0)
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
      <label className="check"><input type="checkbox" checked={runAi && makeSlides} disabled={!makeSlides || keys.length === 0} onChange={(event) => setRunAi(event.target.checked)} /> Soạn chữ cho từng slide bằng AI ngay sau khi nhập{keys.length === 0 ? ' (cần thêm API key)' : ''}</label>
      {campaign.pieces.length > 0 && <p className="notice">Chiến dịch đã có kế hoạch: kế hoạch cũ và các slide thuộc nó sẽ được thay thế. Bài đăng lẻ không bị ảnh hưởng.</p>}
    </div>}
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Hủy</button>
      {plan && <button className="btn primary" onClick={apply}>Áp dụng kế hoạch</button>}
    </div>
  </Modal>
}

type Job = { label: string; done: number; total: number; failures: string[] }

export function PlanSection(props: Props) {
  const { workspace, campaign, edit, keys, onManageKeys } = props
  const [importing, setImporting] = useState(false)
  const [keyId, setKeyId] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [confirm, setConfirm] = useState<'copy' | 'backgrounds' | null>(null)
  const tokens = collectTokens(campaign)
  const activeKey = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]
  const visual = campaign.pieces.filter((piece) => piece.kind !== 'reel')

  /** Runs one step per piece in order; a failure on one piece does not stop the rest. */
  async function run(label: string, pieces: Piece[], step: (piece: Piece) => Promise<void>) {
    const failures: string[] = []
    setJob({ label, done: 0, total: pieces.length, failures })
    for (const [index, piece] of pieces.entries()) {
      try { await step(piece) } catch (error) { failures.push(`${piece.code}: ${error instanceof Error ? error.message : 'lỗi'}`) }
      setJob({ label, done: index + 1, total: pieces.length, failures: [...failures] })
    }
  }

  const draftAll = (pieces: Piece[], context: Campaign) => run('Soạn chữ bằng AI', pieces, async (piece) => {
    const draft = await fetchDraft(workspace, context, piece, activeKey?.id)
    edit((draftCampaign) => applyDraft(draftCampaign, piece.id, draft, workspace.company))
  })

  const backgroundsAll = (pieces: Piece[]) => run('Tạo nền', pieces, async (piece) => {
    const result = await generatePieceBackground(workspace, campaign, piece, activeKey?.id)
    edit((draftCampaign) => attachBackground(draftCampaign, piece.id, result))
  })

  function afterImport(plan: ParsedPlan, runAi: boolean) {
    if (!runAi) return
    // The campaign state has not caught up with the import yet, so give the draft the plan's own strategy.
    const context: Campaign = { ...campaign, strategy: plan.strategy, guardrailNotes: plan.guardrailNotes, pieces: plan.pieces, posts: [] }
    void draftAll(plan.pieces.filter((piece) => piece.kind !== 'reel'), context)
  }

  return <>
    <Section title={`Bài đăng theo kế hoạch${campaign.pieces.length ? ` (${campaign.pieces.length})` : ''}`} aside={<button className="btn small primary" onClick={() => setImporting(true)}>Nhập kế hoạch (Excel)</button>}>
      {visual.length > 0 && <div className="batch">
        <div className="row wrap">
          {keys.length > 0 && <select aria-label="API dùng để soạn" value={activeKey?.id ?? ''} onChange={(event) => setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>}
          <button className="btn" disabled={job !== null && job.done < job.total || keys.length === 0} onClick={() => setConfirm('copy')}>Soạn chữ tất cả bằng AI ({visual.length} bài)</button>
          <button className="btn" disabled={job !== null && job.done < job.total || keys.length === 0} onClick={() => setConfirm('backgrounds')}>Tạo nền cho tất cả bài ({visual.length} ảnh)</button>
          {keys.length === 0 && <button className="link" onClick={onManageKeys}>Thêm API key</button>}
        </div>
        {job && <p className={job.failures.length ? 'notice error' : 'notice'} role="status">
          {job.label}: {job.done}/{job.total}{job.done < job.total ? '…' : ' xong'}
          {job.failures.map((failure) => <span key={failure} className="block">{failure}</span>)}
        </p>}
      </div>}
      {campaign.pieces.length === 0
        ? <p className="muted">Chưa có kế hoạch. Nhập file Excel kế hoạch nội dung để tạo sẵn các bài, caption, checklist và slide nháp.</p>
        : <div className="list">
          {campaign.pieces.map((piece) => {
            const missing = pieceTexts(campaign, piece).flatMap((text) => unresolvedIn(text, campaign.variables))
            const done = piece.checks.filter((check) => check.done).length
            const slides = campaign.posts.filter((post) => post.pieceId === piece.id)
            return <div className="list-row plan-row" key={piece.id}>
              <button className="list-main" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>
                <strong>{piece.code} · {piece.title}</strong>
                <small>{KIND_LABEL[piece.kind]}{piece.date ? ` · ${new Date(piece.date).toLocaleDateString('vi-VN')}` : ' · chưa có ngày'} · duyệt {done}/{piece.checks.length}{missing.length ? ` · ${new Set(missing).size} biến chưa điền` : ''}</small>
                {piece.caption && <span className="excerpt">{piece.caption.replace(/\s+/g, ' ').slice(0, 150)}…</span>}
                {slides.length > 0 && <span className="slide-chips">{slides.map((post, index) => <i key={post.id} title={[post.headline, post.accent, post.subtitle].filter(Boolean).join(' · ')}>{index + 1}. {post.headline || '—'}</i>)}</span>}
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
    {importing && <ImportDialog {...props} onClose={() => setImporting(false)} onImported={afterImport} />}
    {confirm === 'copy' && <ConfirmDialog title="Soạn chữ bằng AI" message={`AI sẽ viết lại chữ trên slide của ${visual.length} bài (carousel/ảnh), ghi đè chữ hiện có trên các slide đó. Caption và hashtag đã có được giữ nguyên. Tiếp tục?`} confirm="Soạn" onConfirm={() => { void draftAll(visual, campaign) }} onClose={() => setConfirm(null)} />}
    {confirm === 'backgrounds' && <ConfirmDialog title="Tạo nền cho tất cả bài" message={`Sẽ tạo ${visual.length} ảnh nền bằng AI, mỗi ảnh tính phí theo tài khoản của bạn, và gán vào slide của bài tương ứng. Tiếp tục?`} confirm="Tạo nền" onConfirm={() => { void backgroundsAll(visual) }} onClose={() => setConfirm(null)} />}
  </>
}
