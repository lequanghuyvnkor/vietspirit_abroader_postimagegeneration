import { useState } from 'react'
import { buildTemplate, count, percent, totalsOf, weekStarts, weekStats } from '../lib/results.ts'
import { todayIso } from '../lib/schedule.ts'
import { now } from '../lib/types.ts'
import type { Campaign, CampaignTemplate, Retro, WeeklyReview, Workspace } from '../lib/types.ts'
import { NameDialog, Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onSaveTemplate: (template: CampaignTemplate) => void
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const addSix = (iso: string) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + 6 * 86400000).toISOString().slice(0, 10)

type Note = 'wins' | 'problems' | 'actions'
const NOTES: { key: Note; label: string; hint: string }[] = [
  { key: 'wins', label: 'Điều làm tốt', hint: 'Bài nào hiệu quả, vì sao' },
  { key: 'problems', label: 'Điều chưa tốt', hint: 'Trễ lịch, số liệu thấp, phản hồi xấu' },
  { key: 'actions', label: 'Việc làm tuần tới', hint: 'Thay đổi cụ thể' },
]

/** Weekly look back, the end-of-campaign summary, and saving the campaign as a template for the next one. */
export function LookBackPanel({ campaign, edit, onSaveTemplate }: Props) {
  const [today] = useState(() => todayIso())
  const [naming, setNaming] = useState(false)
  const [saved, setSaved] = useState('')
  const weeks = weekStarts(campaign)
  const totals = totalsOf(campaign.pieces)
  const retro: Retro = campaign.retro ?? { worked: '', didnt: '', next: '', updatedAt: '' }

  const review = (weekStart: string): WeeklyReview => campaign.weeklyReviews?.find((item) => item.weekStart === weekStart) ?? { weekStart, wins: '', problems: '', actions: '', updatedAt: '' }
  const setNote = (weekStart: string, key: Note, value: string) => edit((draft) => {
    const list = draft.weeklyReviews ?? []
    const existing = list.find((item) => item.weekStart === weekStart)
    if (existing) { existing[key] = value; existing.updatedAt = now() } else list.push({ ...review(weekStart), [key]: value, updatedAt: now() })
    draft.weeklyReviews = list
  })
  const setRetro = (key: keyof Omit<Retro, 'updatedAt'>, value: string) => edit((draft) => { draft.retro = { ...retro, ...draft.retro, [key]: value, updatedAt: now() } })

  return <>
    <Section title="Xem lại hằng tuần" aside={<span className="muted">{weeks.length} tuần trong kỳ</span>}>
      {weeks.length === 0 && <p className="muted">Chưa có kỳ chiến dịch hoặc ngày đăng để chia theo tuần. Đặt ngày ở tab Nền tảng hoặc Kế hoạch.</p>}
      {weeks.map((week) => {
        const stats = weekStats(campaign, week, today)
        const current = today >= week && today <= addSix(week)
        const notes = review(week)
        const filled = Boolean(notes.wins || notes.problems || notes.actions)
        return <details className="card week" key={week} open={current}>
          <summary><strong>Tuần {dm(week)} – {dm(addSix(week))}</strong> {current && <span className="badge">Tuần này</span>} <span className="muted">kế hoạch {stats.planned.length} · đã đăng {stats.published.length}{stats.late.length ? ` · trễ ${stats.late.length}` : ''}{filled ? ' · đã ghi nhận xét' : ''}</span></summary>
          <div className="stat-row">
            <div className="stat"><strong>{count(stats.totals.reach)}</strong><span>tiếp cận</span></div>
            <div className="stat"><strong>{percent(stats.totals.er)}</strong><span>tỷ lệ tương tác</span></div>
            <div className="stat"><strong>{count(stats.totals.leads)}</strong><span>lead</span></div>
          </div>
          <ul className="coverage-gaps">
            {stats.late.length > 0 && <li>Chưa đăng dù đã quá hạn: {stats.late.map((piece) => piece.code).join(', ')}.</li>}
            {stats.best && <li>Tương tác tốt nhất tuần này: {stats.best.code} · {stats.best.title || stats.best.plan.hook}.</li>}
            {stats.planned.length === 0 && <li>Tuần này không có bài nào trong lịch.</li>}
            {stats.planned.length > 0 && stats.totals.measured < stats.totals.published && <li>Còn bài đã đăng chưa nhập số liệu.</li>}
          </ul>
          <div className="brief-grid">
            {NOTES.map((note) => <label className="field" key={note.key}><span className="field-label">{note.label}</span><textarea rows={3} placeholder={note.hint} value={notes[note.key]} onChange={(event) => setNote(week, note.key, event.target.value)} /></label>)}
          </div>
        </details>
      })}
    </Section>

    <Section title="Tổng kết chiến dịch" aside={<span className="muted">cũng xuất hiện ở mục Kết quả của tab Tài liệu</span>}>
      <div className="stat-row">
        <div className="stat"><strong>{totals.published}/{campaign.pieces.length}</strong><span>bài đã đăng</span></div>
        <div className="stat"><strong>{count(totals.reach)}</strong><span>tiếp cận</span></div>
        <div className="stat"><strong>{percent(totals.er)}</strong><span>tỷ lệ tương tác</span></div>
        <div className="stat"><strong>{count(totals.leads)}</strong><span>lead</span></div>
      </div>
      <div className="brief-grid">
        <label className="field"><span className="field-label">Điều hiệu quả, nên giữ</span><textarea rows={4} value={retro.worked} onChange={(event) => setRetro('worked', event.target.value)} /></label>
        <label className="field"><span className="field-label">Điều không hiệu quả</span><textarea rows={4} value={retro.didnt} onChange={(event) => setRetro('didnt', event.target.value)} /></label>
        <label className="field"><span className="field-label">Làm khác đi ở chiến dịch sau</span><textarea rows={4} value={retro.next} onChange={(event) => setRetro('next', event.target.value)} /></label>
      </div>
    </Section>

    <Section title="Dùng lại cho chiến dịch sau">
      <p className="muted">Lưu cấu trúc chiến dịch này thành mẫu: nền tảng, trụ cột, điều không được nói, tên biến, màu và font, cùng các bài trong kế hoạch (tiêu đề, loại, phễu, brief, mục duyệt, ngày theo mốc từ ngày bắt đầu). Không giữ caption, ảnh hay số liệu. Dùng nút "Tạo từ mẫu" ở trang Workspace.</p>
      <div className="row wrap">
        <button className="btn" disabled={campaign.pieces.length === 0} onClick={() => setNaming(true)}>Lưu chiến dịch này làm mẫu</button>
        {saved && <span className="muted" role="status">Đã lưu mẫu "{saved}".</span>}
      </div>
    </Section>
    {naming && <NameDialog title="Tên mẫu" initial={`Mẫu ${campaign.name}`} confirm="Lưu mẫu" onSubmit={(name) => { onSaveTemplate(buildTemplate(campaign, name)); setSaved(name) }} onClose={() => setNaming(false)} />}
  </>
}
