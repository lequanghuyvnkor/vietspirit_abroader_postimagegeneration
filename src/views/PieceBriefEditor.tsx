import { newId } from '../lib/types.ts'
import type { Campaign, Piece, PieceKind, PiecePlan, VisualBrief } from '../lib/types.ts'
import { setKind } from '../lib/planEdit.ts'
import { Field } from './ui.tsx'

type Props = {
  piece: Piece
  /** The Google Sheet still owns these fields, so changes made here would be overwritten at the next pull. */
  locked: boolean
  edit: (change: (draft: Campaign, item: Piece) => void) => void
}

const PLAN_FIELDS: { key: keyof PiecePlan; label: string; rows?: number; hint?: string }[] = [
  { key: 'goal', label: 'Mục tiêu', rows: 2 },
  { key: 'hook', label: 'Hook / tiêu đề', rows: 2 },
  { key: 'structure', label: 'Cấu trúc nội dung', rows: 4, hint: 'Carousel: S1: …; S2: … (mỗi slide một ý). Reel: theo mốc giây, ví dụ 0-3s: …' },
  { key: 'cta', label: 'CTA' },
  { key: 'audience', label: 'Đối tượng', rows: 2 },
  { key: 'kpi', label: 'KPI chính' },
  { key: 'paid', label: 'Vai trò quảng cáo (Paid)' },
  { key: 'conditions', label: 'Điều kiện trước đăng', rows: 2 },
  { key: 'story', label: 'Story hỗ trợ', rows: 2 },
]

const VISUAL_FIELDS: { key: keyof VisualBrief; label: string; rows?: number }[] = [
  { key: 'format', label: 'Khổ / định dạng ảnh' },
  { key: 'hero', label: 'Hình chủ đạo', rows: 2 },
  { key: 'layout', label: 'Bố cục', rows: 2 },
  { key: 'onImage', label: 'Chữ trên ảnh gợi ý', rows: 2 },
  { key: 'typography', label: 'Typography' },
  { key: 'palette', label: 'Palette' },
  { key: 'motion', label: 'Chuyển động (Motion)', rows: 2 },
  { key: 'assets', label: 'Tài nguyên cần chuẩn bị', rows: 2 },
  { key: 'avoid', label: 'Cần tránh', rows: 2 },
]

/** Every part of a piece's plan as a form, so the plan is written here and no longer in a spreadsheet. */
export function PieceBriefEditor({ piece, locked, edit }: Props) {
  const control = (value: string, rows: number | undefined, change: (item: Piece, next: string) => void) => rows
    ? <textarea rows={rows} disabled={locked} value={value} onChange={(event) => edit((_, item) => change(item, event.target.value))} />
    : <input disabled={locked} value={value} onChange={(event) => edit((_, item) => change(item, event.target.value))} />

  return <details className="card brief-editor">
    <summary><h2>Sửa kế hoạch của bài</h2><span className="muted">tên, loại, brief, visual brief, mục duyệt</span></summary>
    {locked && <p className="notice">Google Sheet đang là nguồn của kế hoạch nên các ô này bị khóa. Đóng băng Sheet ở tab Kế hoạch của chiến dịch để soạn trong app.</p>}
    <div className="stack">
      <div className="row wrap">
        <Field label="Tên bài">{control(piece.title, undefined, (item, next) => { item.title = next })}</Field>
        <Field label="Loại">
          <select disabled={locked} value={piece.kind} onChange={(event) => edit((_, item) => setKind(item, event.target.value as PieceKind))}>
            <option value="static">Ảnh</option><option value="carousel">Carousel</option><option value="reel">Reel</option>
          </select>
        </Field>
        <Field label="Định dạng (ghi trong kế hoạch)" hint="Ví dụ Carousel 7 slides, Reel 30s.">{control(piece.plan.format, undefined, (item, next) => { item.plan.format = next })}</Field>
      </div>
      <div className="row wrap">
        <Field label="Phễu">{control(piece.plan.funnel, undefined, (item, next) => { item.plan.funnel = next })}</Field>
        <Field label="Trụ cột">{control(piece.plan.pillar, undefined, (item, next) => { item.plan.pillar = next })}</Field>
        <Field label="Giờ đăng">{control(piece.plan.time, undefined, (item, next) => { item.plan.time = next })}</Field>
      </div>
      <h3>Brief</h3>
      <div className="brief-grid">
        {PLAN_FIELDS.map((field) => <Field key={field.key} label={field.label} hint={field.hint}>{control(piece.plan[field.key], field.rows, (item, next) => { item.plan[field.key] = next })}</Field>)}
      </div>
      <h3>Visual brief</h3>
      <div className="brief-grid">
        {VISUAL_FIELDS.map((field) => <Field key={field.key} label={field.label}>{control(piece.visual[field.key], field.rows, (item, next) => { item.visual[field.key] = next })}</Field>)}
      </div>
      <h3>Mục cần duyệt</h3>
      <div className="list">
        {piece.checks.map((check) => <div className="row" key={check.id}>
          <input aria-label="Nội dung mục duyệt" disabled={locked} value={check.text} onChange={(event) => edit((_, item) => { const target = item.checks.find((entry) => entry.id === check.id); if (target) target.text = event.target.value })} />
          <input aria-label="Người duyệt" className="owner" disabled={locked} value={check.owner} placeholder="Người duyệt" onChange={(event) => edit((_, item) => { const target = item.checks.find((entry) => entry.id === check.id); if (target) target.owner = event.target.value })} />
          <button className="btn small ghost" disabled={locked} onClick={() => edit((_, item) => { item.checks = item.checks.filter((entry) => entry.id !== check.id) })}>Xóa</button>
        </div>)}
        <div className="row"><button className="btn small" disabled={locked} onClick={() => edit((_, item) => { item.checks.push({ id: newId(), text: '', owner: 'Marketing', done: false }) })}>+ Thêm mục duyệt</button></div>
      </div>
      <Field label="Ghi chú duyệt / compliance">{control(piece.compliance, 2, (item, next) => { item.compliance = next })}</Field>
    </div>
  </details>
}
