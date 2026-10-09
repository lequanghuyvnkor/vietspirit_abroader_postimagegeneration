import { useState } from 'react'
import type { ApiKey } from '../lib/api.ts'
import { kindLabel } from '../lib/plan.ts'
import { pieceIssues } from '../lib/planCheck.ts'
import { FUNNELS, addPiece, codeIsTaken, duplicatePiece, emptyPiece, movePiece, nextCode, removePiece, setKind, sortByDate } from '../lib/planEdit.ts'
import { navigate } from '../lib/route.ts'
import { STATUS_LABELS, newId } from '../lib/types.ts'
import type { Campaign, Check, Piece, PieceKind, Workspace } from '../lib/types.ts'
import { SkeletonDialog } from './PlanEditor.tsx'
import { SheetGrid, type Col } from './SheetGrid.tsx'
import { ConfirmDialog } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  keys: ApiKey[]
  onManageKeys: () => void
}

type SheetKey = 'calendar' | 'captions' | 'visual' | 'checklist'
const SHEETS: { key: SheetKey; label: string }[] = [
  { key: 'calendar', label: '01 Lịch nội dung' }, { key: 'captions', label: '02 Caption' },
  { key: 'visual', label: '03 Visual Brief' }, { key: 'checklist', label: '04 Checklist' },
]
const KIND_OPTIONS: { value: PieceKind; label: string }[] = [{ value: 'static', label: 'Ảnh' }, { value: 'carousel', label: 'Carousel' }, { value: 'reel', label: 'Reel' }]
const TAB_KEY = 'cs_plan_sheet'

const onPiece = (change: (piece: Piece, value: string) => void) => (draft: Campaign, id: string, value: string) => {
  const piece = draft.pieces.find((item) => item.id === id)
  if (piece) change(piece, value)
}

function readTab(campaignId: string): SheetKey {
  try { const saved = sessionStorage.getItem(`${TAB_KEY}:${campaignId}`); if (SHEETS.some((sheet) => sheet.key === saved)) return saved as SheetKey } catch { /* Not remembered. */ }
  return 'calendar'
}

/** ③ Kế hoạch as one workbook: the same six sheets as the content-plan Google Sheet, every cell editable, one set of data. */
export function PlanSheets(props: Props) {
  const { campaign } = props
  const [tab, setTab] = useState<SheetKey>(() => readTab(campaign.id))
  const choose = (next: SheetKey) => { setTab(next); try { sessionStorage.setItem(`${TAB_KEY}:${campaign.id}`, next) } catch { /* Ignore. */ } }
  const counts: Record<SheetKey, string> = {
    calendar: String(campaign.pieces.length), captions: String(campaign.pieces.filter((piece) => piece.caption.trim()).length),
    visual: String(campaign.pieces.filter((piece) => Object.values(piece.visual).some((value) => value.trim())).length), checklist: '',
  }
  return <div className="workbook">
    <div className="sheet-body">
      {tab === 'calendar' && <CalendarSheet {...props} />}
      {tab === 'captions' && <CaptionSheet {...props} />}
      {tab === 'visual' && <VisualSheet {...props} />}
      {tab === 'checklist' && <ChecklistSheet {...props} />}
    </div>
    <div className="sheet-tabs" role="tablist" aria-label="Các sheet của kế hoạch">
      {SHEETS.map((sheet) => <button key={sheet.key} role="tab" aria-selected={tab === sheet.key} className={tab === sheet.key ? 'on' : ''} onClick={() => choose(sheet.key)}>{sheet.label}{counts[sheet.key] && <small>{counts[sheet.key]}</small>}</button>)}
    </div>
  </div>
}

// ---------- 02 Lịch nội dung ----------
function CalendarSheet({ workspace, campaign, edit, keys, onManageKeys }: Props) {
  const [removing, setRemoving] = useState<Piece | null>(null)
  const [skeleton, setSkeleton] = useState(false)
  const pillarNames = campaign.foundation.pillars.map((pillar) => pillar.name).filter(Boolean)
  const funnelOptions = [{ value: '', label: '—' }, ...FUNNELS.map((funnel) => ({ value: funnel, label: funnel }))]
  const columns: Col<Piece>[] = [
    { key: 'code', label: 'ID', width: 70, frozen: true, get: (p) => p.code, set: onPiece((p, v) => { p.code = v.trim() }), invalid: (p) => (codeIsTaken(campaign, p) ? 'Mã trống hoặc trùng với bài khác' : '') },
    { key: 'title', label: 'Tên bài', width: 220, frozen: true, get: (p) => p.title, set: onPiece((p, v) => { p.title = v }), placeholder: 'Tên bài' },
    { key: 'kind', label: 'Loại', width: 96, kind: 'select', options: KIND_OPTIONS, get: (p) => p.kind, set: onPiece((p, v) => setKind(p, v as PieceKind)) },
    { key: 'date', label: 'Ngày', width: 130, kind: 'date', get: (p) => p.date, set: onPiece((p, v) => { p.date = v }) },
    { key: 'time', label: 'Giờ', width: 90, get: (p) => p.plan.time, set: onPiece((p, v) => { p.plan.time = v }), placeholder: '20:30' },
    { key: 'funnel', label: 'Funnel', width: 90, kind: 'select', options: funnelOptions, get: (p) => p.plan.funnel, set: onPiece((p, v) => { p.plan.funnel = v }) },
    { key: 'pillar', label: 'Pillar', width: 190, list: pillarNames.length ? `pillars-${campaign.id}` : undefined, get: (p) => p.plan.pillar, set: onPiece((p, v) => { p.plan.pillar = v }), placeholder: 'Trụ cột' },
    { key: 'hook', label: 'Title / Hook', width: 260, kind: 'long', get: (p) => p.plan.hook, set: onPiece((p, v) => { p.plan.hook = v }), placeholder: 'Câu mở bài' },
    { key: 'format', label: 'Format', width: 150, get: (p) => p.plan.format, set: onPiece((p, v) => { p.plan.format = v }) },
    { key: 'goal', label: 'Mục tiêu', width: 220, kind: 'long', get: (p) => p.plan.goal, set: onPiece((p, v) => { p.plan.goal = v }) },
    { key: 'structure', label: 'Cấu trúc nội dung', width: 280, kind: 'long', get: (p) => p.plan.structure, set: onPiece((p, v) => { p.plan.structure = v }), placeholder: 'S1: …; S2: … hoặc 0-3s: …' },
    { key: 'cta', label: 'CTA', width: 160, get: (p) => p.plan.cta, set: onPiece((p, v) => { p.plan.cta = v }), placeholder: 'Kêu gọi' },
    { key: 'audience', label: 'Target audience', width: 170, get: (p) => p.plan.audience, set: onPiece((p, v) => { p.plan.audience = v }) },
    { key: 'status', label: 'Trạng thái', width: 110, kind: 'static', get: (p) => `${STATUS_LABELS[p.status]}` },
    { key: 'made', label: 'Loại sản xuất', width: 170, kind: 'static', get: (p) => kindLabel(p) },
  ]
  return <>
    <div className="sheet-toolbar">
      <button className="btn small primary" onClick={() => edit((draft) => { addPiece(draft, emptyPiece(nextCode(draft.pieces))) })}>+ Thêm dòng</button>
      <button className="btn small" onClick={() => setSkeleton(true)}>AI gợi ý khung bài</button>
      <button className="btn small ghost" disabled={campaign.pieces.length < 2} title="Xếp lại theo ngày và giờ đăng; bài chưa có ngày xuống cuối" onClick={() => edit(sortByDate)}>Sắp theo ngày</button>
      <span className="muted">Mũi tên ↑ ↓ hoặc Enter để chuyển dòng. Ô nhiều dòng: Alt+Enter xuống dòng.</span>
    </div>
    {pillarNames.length > 0 && <datalist id={`pillars-${campaign.id}`}>{pillarNames.map((name) => <option key={name} value={name} />)}</datalist>}
    <SheetGrid name="Lịch nội dung" rows={campaign.pieces} rowId={(p) => p.id} columns={columns} edit={edit} actionsWidth={250}
      empty={<p className="muted">Chưa có dòng nào. Bấm "+ Thêm dòng", để AI gợi ý khung, hoặc nhập từ Excel/Google Sheet.</p>}
      actions={(piece, index) => {
        const warn = pieceIssues(campaign, piece).filter((issue) => issue.level === 'warn').length
        return <>
          <button className="btn small" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}>Mở{warn ? ` · ${warn}!` : ''}</button>
          <button className="btn small ghost" aria-label={`Lên ${piece.code}`} disabled={index === 0} onClick={() => edit((draft) => movePiece(draft, piece.id, -1))}>↑</button>
          <button className="btn small ghost" aria-label={`Xuống ${piece.code}`} disabled={index === campaign.pieces.length - 1} onClick={() => edit((draft) => movePiece(draft, piece.id, 1))}>↓</button>
          <button className="btn small ghost" onClick={() => edit((draft) => { duplicatePiece(draft, piece.id) })}>Nhân bản</button>
          <button className="btn small ghost" onClick={() => setRemoving(piece)}>Xóa</button>
        </>
      }} />
    {removing && <ConfirmDialog title={`Xóa dòng ${removing.code}`} message={`Xóa "${removing.title || removing.plan.hook || removing.code}" cùng các slide và bản chỉnh của bài này? Có thể khôi phục bằng nút Sao lưu ở thanh trên.`} confirm="Xóa bài" onConfirm={() => edit((draft) => removePiece(draft, removing.id))} onClose={() => setRemoving(null)} />}
    {skeleton && <SkeletonDialog workspace={workspace} campaign={campaign} edit={edit} keys={keys} onManageKeys={onManageKeys} onClose={() => setSkeleton(false)} />}
  </>
}

// ---------- 03 Caption ----------
function CaptionSheet({ campaign, edit }: Props) {
  const columns: Col<Piece>[] = [
    { key: 'code', label: 'ID', width: 70, frozen: true, kind: 'static', get: (p) => p.code },
    { key: 'title', label: 'Tên bài', width: 220, frozen: true, kind: 'static', get: (p) => p.title },
    { key: 'caption', label: 'Caption draft', width: 520, kind: 'long', get: (p) => p.caption, set: onPiece((p, v) => { p.caption = v }), placeholder: 'Caption (giữ nguyên [TÊN BIẾN])' },
    { key: 'hashtags', label: 'Hashtags', width: 260, get: (p) => p.hashtags, set: onPiece((p, v) => { p.hashtags = v }) },
  ]
  return <>
    <div className="sheet-toolbar"><span className="muted">Caption và hashtag của từng bài. Viết lại bằng AI hoặc xem bản đã điền biến ở trang từng bài (nút Mở).</span></div>
    <SheetGrid name="Caption" rows={campaign.pieces} rowId={(p) => p.id} columns={columns} edit={edit} empty={<p className="muted">Chưa có bài nào. Thêm dòng ở sheet 01.</p>} />
  </>
}

// ---------- 04 Visual Brief ----------
function VisualSheet({ campaign, edit }: Props) {
  const field = (key: keyof Piece['visual'], label: string, width: number, long = false): Col<Piece> => ({ key, label, width, kind: long ? 'long' : 'text', get: (p) => p.visual[key], set: onPiece((p, v) => { p.visual[key] = v }) })
  const columns: Col<Piece>[] = [
    { key: 'code', label: 'ID', width: 70, frozen: true, kind: 'static', get: (p) => p.code },
    { key: 'title', label: 'Tên bài', width: 200, frozen: true, kind: 'static', get: (p) => p.title },
    field('format', 'Khổ/định dạng', 150), field('hero', 'Hero visual', 260, true), field('layout', 'Bố cục', 240, true), field('typography', 'Typography', 180),
    field('palette', 'Palette (tham khảo)', 180), field('onImage', 'On-image copy', 260, true), field('motion', 'Motion', 220, true), field('assets', 'Asset cần chuẩn bị', 240, true), field('avoid', 'Tránh', 200, true),
  ]
  return <>
    <div className="sheet-toolbar"><span className="muted">Hướng dẫn hình ảnh từng bài. Màu và font thật của ảnh luôn theo tab ② Moodboard; cột Palette chỉ để ghi chú.</span></div>
    <SheetGrid name="Visual Brief" rows={campaign.pieces} rowId={(p) => p.id} columns={columns} edit={edit} empty={<p className="muted">Chưa có bài nào. Thêm dòng ở sheet 01.</p>} />
  </>
}

// ---------- 05 Checklist duyệt (matrix: check × piece) ----------
function ChecklistSheet({ campaign, edit }: Props) {
  const [extra, setExtra] = useState<{ text: string; owner: string }[]>([])
  const [draft, setDraft] = useState('')
  const rows = new Map<string, { text: string; owner: string }>()
  for (const piece of campaign.pieces) for (const check of piece.checks) if (check.text.trim() && !rows.has(check.text)) rows.set(check.text, { text: check.text, owner: check.owner })
  for (const entry of extra) if (!rows.has(entry.text)) rows.set(entry.text, entry)
  const list = [...rows.values()]
  const toggle = (piece: Piece, row: { text: string; owner: string }, on: boolean) => edit((d) => {
    const target = d.pieces.find((item) => item.id === piece.id)
    if (!target) return
    if (on) target.checks.push({ id: newId(), text: row.text, owner: row.owner, done: false } satisfies Check)
    else target.checks = target.checks.filter((check) => check.text !== row.text)
  })
  const setOwner = (text: string, owner: string) => edit((d) => { for (const piece of d.pieces) for (const check of piece.checks) if (check.text === text) check.owner = owner })
  const removeRow = (text: string) => { edit((d) => { for (const piece of d.pieces) piece.checks = piece.checks.filter((check) => check.text !== text) }); setExtra((current) => current.filter((entry) => entry.text !== text)) }

  return <>
    <div className="sheet-toolbar">
      <input className="sheet-add" placeholder="Mục kiểm tra mới, ví dụ: Có consent của mentor" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && draft.trim()) { setExtra((current) => [...current, { text: draft.trim(), owner: 'Marketing' }]); setDraft('') } }} />
      <button className="btn small primary" disabled={!draft.trim()} onClick={() => { setExtra((current) => [...current, { text: draft.trim(), owner: 'Marketing' }]); setDraft('') }}>+ Thêm dòng</button>
      <span className="muted">Tick một ô = mục đó áp dụng cho bài ở cột đó. Tick "đã làm" ở trang từng bài.</span>
    </div>
    {list.length === 0 || campaign.pieces.length === 0 ? <div className="sheet-empty"><p className="muted">Chưa có mục kiểm tra nào. Thêm một mục ở trên rồi tick các bài áp dụng.</p></div> : <div className="sheet-scroll">
      <table className="sheet matrix" aria-label="Checklist" style={{ width: 44 + 320 + 140 + campaign.pieces.length * 64 + 120 }}>
        <thead><tr className="sheet-labels"><th className="corner">#</th><th className="frozen" style={{ left: 44, width: 320 }}>Check</th><th style={{ width: 140 }}>Người kiểm tra</th>{campaign.pieces.map((piece) => <th key={piece.id} style={{ width: 64 }} title={piece.title}>{piece.code}</th>)}<th /></tr></thead>
        <tbody>
          {list.map((row, index) => <tr key={row.text}>
            <th className="rownum" scope="row">{index + 1}</th>
            <td className="frozen" style={{ left: 44 }}><span className="cell-static">{row.text}</span></td>
            <td><input aria-label={`Người kiểm tra ${row.text}`} defaultValue={row.owner} onBlur={(event) => { if (event.target.value !== row.owner) setOwner(row.text, event.target.value) }} /></td>
            {campaign.pieces.map((piece) => <td key={piece.id} className="tick"><input type="checkbox" aria-label={`${row.text} cho ${piece.code}`} checked={piece.checks.some((check) => check.text === row.text)} onChange={(event) => toggle(piece, row, event.target.checked)} /></td>)}
            <td className="sheet-actions"><button className="btn small ghost" onClick={() => removeRow(row.text)}>Xóa dòng</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </>
}
