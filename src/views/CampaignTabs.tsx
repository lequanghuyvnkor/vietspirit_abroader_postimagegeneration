import { useRef, useState, type ChangeEvent } from 'react'
import type { ApiKey } from '../lib/api.ts'
import type { Batch, Job } from '../lib/batch.ts'
import { draftSlides, kindLabel, madeInApp, parsePlan, pieceTexts, type ParsedPlan } from '../lib/plan.ts'
import { nextStep, pieceIssues } from '../lib/planCheck.ts'
import { navigate } from '../lib/route.ts'
import { unresolvedIn } from '../lib/text.ts'
import { STATUS_LABELS } from '../lib/types.ts'
import type { Campaign, Piece, PieceStatus, Workspace } from '../lib/types.ts'
import { readXlsx } from '../lib/xlsx.ts'
import { buildPack, downloadBlob, slidesOf } from '../lib/pack.ts'
import { ConfirmDialog, Modal, Section } from './ui.tsx'
import { SheetPanel } from './SheetPanel.tsx'
import { PlanGrid } from './PlanEditor.tsx'
import { CalendarPanel, CoveragePanel, LateAlerts } from './CalendarPanel.tsx'
import { draftMissingSlides } from '../lib/planEdit.ts'
import { sheetOwnsPlan } from '../lib/sheetSync.ts'
import { ScheduleTable } from './ScheduleTable.tsx'
import { SlideThumb } from './SlideThumb.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onError: (message: string) => void
  keys: ApiKey[]
  onManageKeys: () => void
}

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
      <p><strong>{plan.pieces.length} bài</strong>: {count('carousel')} carousel, {count('static')} ảnh, {count('reel')} reel ({plan.pieces.filter((piece) => piece.kind === 'reel' && piece.production === 'external').length} có người: bên khác xử lý, app theo dõi và xuất phiếu bàn giao; {plan.pieces.filter((piece) => piece.kind === 'reel' && piece.production === 'internal').length} không người: làm trong app).</p>
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

function JobStatus({ job }: { job: Job | null }) {
  if (!job) return null
  return <p className={job.failures.length ? 'notice error' : 'notice'} role="status">
    {job.label}: {job.done}/{job.total}{job.done < job.total ? '…' : ' xong'}
    {job.failures.map((failure) => <span key={failure} className="block">{failure}</span>)}
  </p>
}

function KeyPicker({ batch, keys }: { batch: Batch; keys: ApiKey[] }) {
  if (keys.length < 2) return null
  return <select aria-label="API dùng cho AI" value={batch.activeKey?.id ?? ''} onChange={(event) => batch.setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
}

/** ③ Kế hoạch: the pieces, written and edited here (the Google Sheet and Excel are optional ways in), with a check of each before production starts. */
export function PlanTab(props: Props & { batch: Batch }) {
  const { workspace, campaign, edit, batch } = props
  const [importing, setImporting] = useState(false)
  const issues = campaign.pieces.map((piece) => ({ piece, issues: pieceIssues(campaign, piece) }))
  const withIssues = issues.filter((entry) => entry.issues.length > 0)
  const sheetOwns = sheetOwnsPlan(campaign.sheetSync)
  const needSlides = campaign.pieces.filter((piece) => madeInApp(piece) && !campaign.posts.some((post) => post.pieceId === piece.id)).length

  function afterImport(plan: ParsedPlan, runAi: boolean) {
    if (!runAi) return
    // The campaign state has not caught up with the import yet, so give the draft the plan's own strategy.
    const context: Campaign = { ...campaign, strategy: plan.strategy, guardrailNotes: plan.guardrailNotes, pieces: plan.pieces, posts: [] }
    void batch.draftAll(plan.pieces.filter((piece) => piece.kind !== 'reel'), context)
  }

  return <>
    <SheetPanel workspace={workspace} campaign={campaign} edit={edit} />
    <Section title={`Kế hoạch nội dung${campaign.pieces.length ? ` (${campaign.pieces.length} bài)` : ''}`} aside={<button className="btn small ghost" disabled={sheetOwns} title={sheetOwns ? 'Google Sheet đang là nguồn của kế hoạch. Đóng băng Sheet để nhập Excel.' : 'Nhập kế hoạch từ file Excel: thay kế hoạch hiện có (một lần, khi chuyển từ Sheet/Excel sang soạn trong app).'} onClick={() => setImporting(true)}>Nhập từ Excel</button>}>
      <JobStatus job={batch.job} />
      {sheetOwns && <div className="notice">
        <p><b>Google Sheet đang là nguồn của kế hoạch</b>, nên bảng bên dưới chỉ để xem: mỗi lần Sheet đổi, chữ trong Sheet sẽ ghi đè chữ sửa ở đây. Muốn soạn ngay trong app thì đóng băng Sheet (app ngừng đọc Sheet, kế hoạch hiện có được giữ nguyên).</p>
        <button className="btn small primary" onClick={() => edit((draft) => { if (draft.sheetSync) draft.sheetSync.frozen = true })}>Đóng băng Sheet và soạn trong app</button>
      </div>}
      <PlanGrid {...props} locked={sheetOwns} />
      <CoveragePanel campaign={campaign} />
      {campaign.pieces.length > 0 && <div className="row wrap">
        {needSlides > 0 && <button className="btn small" disabled={sheetOwns} onClick={() => edit((draft) => { draftMissingSlides(draft, workspace.company) })}>Tạo slide nháp cho {needSlides} bài chưa có</button>}
        <span className={withIssues.length ? 'notice' : 'muted'}>{withIssues.length ? `${withIssues.length}/${campaign.pieces.length} bài còn điểm cần xem lại trước khi sản xuất (bấm Mở để xem chi tiết).` : 'Kế hoạch ổn, chuyển sang tab Sản xuất.'}</span>
      </div>}
    </Section>
    {importing && <ImportDialog {...props} onClose={() => setImporting(false)} onImported={afterImport} />}
  </>
}

const STATUS_ORDER: PieceStatus[] = ['brief', 'copy', 'visual', 'review', 'ready']

/** ③ Sản xuất: every piece grouped by status; AI steps run on one piece, or on the pieces the user ticked, never on everything by default. */
export function ProductionTab({ workspace, campaign, keys, onManageKeys, batch }: Props & { batch: Batch }) {
  const [confirm, setConfirm] = useState<'copy' | 'backgrounds' | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const visual = campaign.pieces.filter(madeInApp)
  const external = campaign.pieces.filter((piece) => !madeInApp(piece))
  const chosen = visual.filter((piece) => picked.has(piece.id))
  const blocked = batch.running || keys.length === 0
  const open = (piece: Piece) => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })
  const toggle = (piece: Piece) => setPicked((current) => { const next = new Set(current); if (next.has(piece.id)) next.delete(piece.id); else next.add(piece.id); return next })

  const card = (piece: Piece) => {
    const slides = slidesOf(campaign, piece)
    const warn = pieceIssues(campaign, piece).filter((issue) => issue.level === 'warn').length
    const makes = madeInApp(piece)
    return <div className={picked.has(piece.id) ? 'piece-card picked' : 'piece-card'} key={piece.id}>
      {makes && <input type="checkbox" className="piece-pick" aria-label={`Chọn ${piece.code}`} checked={picked.has(piece.id)} onChange={() => toggle(piece)} />}
      <span className="piece-thumb">{slides.length ? <SlideThumb post={slides[0]} campaign={campaign} workspace={workspace} width={64} /> : <i>{piece.kind === 'reel' ? 'Reel' : '—'}</i>}</span>
      <button className="piece-body" onClick={() => open(piece)}>
        <strong>{piece.code} · {piece.title}</strong>
        <small className="muted">{kindLabel(piece)}{slides.length > 1 ? ` · ${slides.length} ảnh` : ''}{piece.date ? ` · ${piece.date.slice(8, 10)}/${piece.date.slice(5, 7)}` : ''}</small>
        <small>Tiếp theo: <b>{nextStep(piece)}</b>{warn ? <span className="flag warn">{warn} cảnh báo</span> : null}</small>
      </button>
      {makes && <div className="piece-actions">
        <button className="btn small" disabled={blocked || slides.length === 0} title={slides.length === 0 ? 'Bài này chưa có slide' : 'Tạo ảnh chỉ cho bài này'} onClick={() => { void batch.backgroundsAll([piece]) }}>Tạo ảnh</button>
      </div>}
    </div>
  }

  if (campaign.pieces.length === 0) return <Section title="Sản xuất"><p className="muted">Chưa có bài nào. Nhập kế hoạch ở tab Kế hoạch trước.</p></Section>

  return <>
    <Section title="Sản xuất" aside={<span className="muted">{campaign.pieces.filter((piece) => piece.status === 'ready').length}/{campaign.pieces.length} bài sẵn sàng</span>}>
      <div className="row wrap">
        <KeyPicker batch={batch} keys={keys} />
        <button className="btn small ghost" onClick={() => setPicked(chosen.length === visual.length ? new Set() : new Set(visual.map((piece) => piece.id)))}>{chosen.length === visual.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
        <button className="btn" disabled={blocked || chosen.length === 0} onClick={() => setConfirm('copy')}>Soạn chữ ({chosen.length} bài đã chọn)</button>
        <button className="btn" disabled={blocked || chosen.length === 0} onClick={() => setConfirm('backgrounds')}>Tạo ảnh ({chosen.length} bài đã chọn)</button>
        {keys.length === 0 && <button className="link" onClick={onManageKeys}>Thêm API key</button>}
      </div>
      <small className="muted">Mỗi bài có nút <b>Tạo ảnh</b> riêng. Muốn làm một nhóm bài thì tick ô ở góc thẻ rồi dùng hai nút phía trên; không tick thì hai nút đó không chạy.</small>
      <JobStatus job={batch.job} />
      <LateAlerts workspace={workspace} campaign={campaign} />
      <p className="row wrap">{STATUS_ORDER.map((status) => <span key={status} className={`status ${status}`}>{STATUS_LABELS[status]} · {visual.filter((piece) => piece.status === status).length}</span>)}</p>
      <div className="board">
        {STATUS_ORDER.map((status) => {
          const items = visual.filter((piece) => piece.status === status)
          return items.length > 0 && <div className="board-col" key={status}>
            <h3><span className={`status ${status}`}>{STATUS_LABELS[status]}</span> <span className="muted">{items.length} bài</span></h3>
            <div className="board-row">{items.map(card)}</div>
          </div>
        })}
      </div>
      {external.length > 0 && <div className="field">
        <span className="field-label">Reel có người, bên ngoài sản xuất ({external.length})</span>
        <div className="board-row">{external.map(card)}</div>
      </div>}
    </Section>
    {confirm === 'copy' && <ConfirmDialog title="Soạn chữ bằng AI" message={`AI sẽ viết lại chữ trên slide của ${chosen.length} bài đã chọn (${chosen.map((piece) => piece.code).join(', ')}), ghi đè chữ hiện có trên các slide đó. Caption và hashtag đã có được giữ nguyên. Tiếp tục?`} confirm="Soạn" onConfirm={() => { void batch.draftAll(chosen) }} onClose={() => setConfirm(null)} />}
    {confirm === 'backgrounds' && <ConfirmDialog title="Tạo ảnh cho các bài đã chọn" message={`App đo chỗ đặt chữ của ${chosen.length} bài (${chosen.map((piece) => piece.code).join(', ')}), rồi nhờ AI vẽ ${chosen.length} nền và kiểm tra vùng chữ. Mỗi nền tính phí theo tài khoản của bạn; nền nào vùng chữ chưa đạt được vẽ lại một lần, tối đa ${chosen.length * 2} lượt. Tiếp tục?`} confirm="Tạo ảnh" onConfirm={() => { void batch.backgroundsAll(chosen) }} onClose={() => setConfirm(null)} />}
  </>
}

/** ④ Lịch & xuất: the day table (Docs sync, CSV) and the zip of finished images. */
export function ScheduleTab({ workspace, campaign, edit, batch }: Props & { batch: Batch }) {
  const [confirm, setConfirm] = useState(false)
  const [scope, setScope] = useState<'all' | 'ready'>('all')
  const withSlides = campaign.pieces.filter(madeInApp).filter((piece) => slidesOf(campaign, piece).length > 0)
  const exportable = withSlides.filter((piece) => scope === 'all' || piece.status === 'ready')
  const exportMissing = new Set(exportable.flatMap((piece) => pieceTexts(campaign, piece).flatMap((text) => unresolvedIn(text, campaign.variables)))).size

  async function exportAll() {
    const total = exportable.reduce((sum, piece) => sum + slidesOf(campaign, piece).length, 0)
    batch.setJob({ label: 'Xuất ảnh hoàn chỉnh', done: 0, total, failures: [] })
    try {
      const blob = await buildPack(workspace, campaign, exportable, true, (done) => batch.setJob({ label: 'Xuất ảnh hoàn chỉnh', done, total, failures: [] }))
      downloadBlob(blob, `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'chien-dich'}-anh-hoan-chinh.zip`)
    } catch (error) { batch.setJob({ label: 'Xuất ảnh hoàn chỉnh', done: total, total, failures: [error instanceof Error ? error.message : 'Không xuất được.'] }) }
  }

  if (campaign.pieces.length === 0) return <Section title="Lịch & xuất"><p className="muted">Chưa có bài nào. Nhập kế hoạch ở tab Kế hoạch trước.</p></Section>

  return <>
    <Section title="Lịch tháng" aside={<span className="muted">kéo bài sang ngày khác để dời lịch</span>}>
      <LateAlerts workspace={workspace} campaign={campaign} />
      <CalendarPanel workspace={workspace} campaign={campaign} edit={edit} />
      <CoveragePanel campaign={campaign} />
    </Section>
    <Section title="Lịch đăng" aside={<button className="btn small primary" disabled={withSlides.length === 0 || batch.running} onClick={() => setConfirm(true)}>Xuất ảnh hoàn chỉnh ({withSlides.length} bài)</button>}>
      <JobStatus job={batch.job} />
      <ScheduleTable workspace={workspace} campaign={campaign} edit={edit} />
    </Section>
    {confirm && <Modal title="Xuất ảnh hoàn chỉnh" onClose={() => setConfirm(false)}>
      <p>Xuất ảnh PNG của từng slide cùng caption, mỗi bài một thư mục, gộp trong một file zip. Reel xuất ở trang từng bài (storyboard, MP4).</p>
      <label className="check"><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} /> Tất cả bài đã có slide ({withSlides.length})</label>
      <label className="check"><input type="radio" name="scope" checked={scope === 'ready'} onChange={() => setScope('ready')} /> Chỉ bài đã "Sẵn sàng" ({withSlides.filter((piece) => piece.status === 'ready').length})</label>
      {exportMissing > 0 && <p className="notice">Còn {exportMissing} biến chưa điền trong các bài này; ảnh xuất sẽ còn nguyên dấu [ ].</p>}
      <div className="modal-actions"><button className="btn ghost" onClick={() => setConfirm(false)}>Hủy</button><button className="btn primary" disabled={exportable.length === 0} onClick={() => { setConfirm(false); void exportAll() }}>Xuất {exportable.length} bài</button></div>
    </Modal>}
  </>
}
