import { useState } from 'react'
import { campaignWindow } from '../lib/foundation.ts'
import { navigate } from '../lib/route.ts'
import { DEFAULT_LEAD, coverage, leadOf, lateTasks, openTasks, todayIso, weeksOf, type Task } from '../lib/schedule.ts'
import type { Campaign, Lead, Piece, Workspace } from '../lib/types.ts'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const funnelClass = (piece: Piece) => `f-${piece.plan.funnel.toUpperCase() || 'NONE'}`

const when = (days: number) => (days < 0 ? `trễ ${-days} ngày` : days === 0 ? 'hôm nay' : days === 1 ? 'ngày mai' : `còn ${days} ngày`)

/** Overdue backward-schedule milestones, shown on the tabs where the work is done. */
export function LateAlerts({ workspace, campaign }: Pick<Props, 'workspace' | 'campaign'>) {
  const [today] = useState(() => todayIso())
  const late = lateTasks(openTasks(campaign, today))
  if (late.length === 0) return null
  return <div className="notice late-alert" role="status">
    <strong>{late.length} việc đã quá hạn theo lịch lùi</strong>
    <div className="row wrap">
      {late.slice(0, 8).map((task) => <button className="link" key={`${task.piece.id}-${task.milestone.key}`} onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: task.piece.id })}>{task.milestone.short} {task.piece.code} ({when(task.days)})</button>)}
      {late.length > 8 && <span className="muted">và {late.length - 8} việc nữa</span>}
    </div>
  </div>
}

/** How the plan covers the funnel and the pillars, and what is missing. */
export function CoveragePanel({ campaign }: Pick<Props, 'campaign'>) {
  const data = coverage(campaign)
  if (data.total === 0) return null
  return <div className="coverage">
    <div className="coverage-col">
      <h3>Phủ phễu</h3>
      {data.funnel.map((item) => <div className="coverage-row" key={item.key}>
        <span className={`funnel-tag f-${item.key}`}>{item.key}</span>
        <div className="bar"><i className={`f-${item.key}`} style={{ width: `${Math.round((item.count / data.total) * 100)}%` }} /></div>
        <span>{item.count} bài <small className="muted">(gợi ý ~{item.target})</small></span>
      </div>)}
    </div>
    <div className="coverage-col">
      <h3>Phủ trụ cột</h3>
      {data.pillars.length === 0 && <p className="muted">Chưa có trụ cột trong Nền tảng.</p>}
      {data.pillars.map((pillar) => <div className="coverage-row" key={pillar.name}>
        <span className="pillar-name">{pillar.name}</span>
        <span className={pillar.count === 0 ? 'flag warn' : 'muted'}>{pillar.count} bài</span>
      </div>)}
    </div>
    {data.gaps.length > 0 && <ul className="coverage-gaps">{data.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>}
  </div>
}

/** A month calendar to move pieces by dragging, with the backward-schedule deadlines and the funnel/pillar coverage. */
export function CalendarPanel({ workspace, campaign, edit }: Props) {
  const [today] = useState(() => todayIso())
  const window = campaignWindow(campaign)
  const [month, setMonth] = useState(() => {
    const base = campaign.pieces.find((piece) => piece.date)?.date ?? window?.start ?? today
    return { year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) - 1 }
  })
  const [showDeadlines, setShowDeadlines] = useState(true)
  const [over, setOver] = useState('')
  const lead = leadOf(campaign)
  const weeks = weeksOf(month.year, month.month)
  const tasks = openTasks(campaign, today)
  const undated = campaign.pieces.filter((piece) => !piece.date)
  const title = new Date(Date.UTC(month.year, month.month, 1)).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const shift = (delta: number) => setMonth((current) => { const date = new Date(Date.UTC(current.year, current.month + delta, 1)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() } })
  const setDate = (id: string, date: string) => edit((draft) => { const piece = draft.pieces.find((item) => item.id === id); if (piece) piece.date = date })
  const setLead = (key: keyof Lead, value: number) => edit((draft) => { draft.lead = { ...DEFAULT_LEAD, ...draft.lead, [key]: Math.max(0, Math.min(30, Math.round(value) || 0)) } })
  const open = (piece: Piece) => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })

  const drop = (date: string) => (event: React.DragEvent) => {
    event.preventDefault()
    setOver('')
    const id = event.dataTransfer.getData('text/plain')
    if (id && campaign.pieces.some((piece) => piece.id === id)) setDate(id, date)
  }
  const target = (date: string) => ({ onDragOver: (event: React.DragEvent) => { event.preventDefault(); setOver(date) }, onDragLeave: () => setOver((current) => (current === date ? '' : current)), onDrop: drop(date) })

  const chip = (piece: Piece) => <button key={piece.id} draggable className={`cal-chip ${funnelClass(piece)} ${piece.status === 'ready' ? 'ready' : ''}`} title={`${piece.title || piece.plan.hook} · kéo sang ngày khác để dời lịch`}
    onDragStart={(event) => { event.dataTransfer.setData('text/plain', piece.id); event.dataTransfer.effectAllowed = 'move' }} onClick={() => open(piece)}>
    <b>{piece.code}</b> {piece.title || piece.plan.hook}
  </button>

  const dueByDay = new Map<string, Task[]>()
  if (showDeadlines) for (const task of tasks) dueByDay.set(task.milestone.due, [...(dueByDay.get(task.milestone.due) ?? []), task])

  return <div className="stack calendar">
    <div className="row wrap">
      <button className="btn small" aria-label="Tháng trước" onClick={() => shift(-1)}>←</button>
      <strong className="cal-title">{title}</strong>
      <button className="btn small" aria-label="Tháng sau" onClick={() => shift(1)}>→</button>
      <span className="spacer" />
      <label className="row"><input type="checkbox" checked={showDeadlines} onChange={(event) => setShowDeadlines(event.target.checked)} /> Hiện hạn lùi</label>
    </div>
    <div className="cal-grid" role="grid" aria-label="Lịch đăng theo tháng">
      {WEEKDAYS.map((name) => <div className="cal-head" key={name}>{name}</div>)}
      {weeks.flat().map((date) => {
        const inMonth = Number(date.slice(5, 7)) - 1 === month.month
        const inWindow = !window || (date >= window.start && date <= window.end)
        const pieces = campaign.pieces.filter((piece) => piece.date === date).sort((a, b) => a.plan.time.localeCompare(b.plan.time))
        const due = dueByDay.get(date) ?? []
        return <div key={date} role="gridcell" className={`cal-cell${inMonth ? '' : ' faded'}${inWindow ? '' : ' outside'}${date === today ? ' today' : ''}${over === date ? ' over' : ''}`} {...target(date)}>
          <span className="cal-day">{Number(date.slice(8, 10))}</span>
          {pieces.map(chip)}
          {due.map((task) => <button key={`${task.piece.id}-${task.milestone.key}`} className={`cal-due${task.days < 0 ? ' late' : ''}`} title={`${task.milestone.label} cho ${task.piece.code} (đăng ${dayMonth(task.piece.date)})`} onClick={() => open(task.piece)}>{task.milestone.short} {task.piece.code}</button>)}
        </div>
      })}
    </div>
    <div className={`cal-tray${over === 'none' ? ' over' : ''}`} {...target('none')} onDrop={drop('')}>
      <strong>Chưa xếp lịch ({undated.length})</strong>
      {undated.length === 0 ? <span className="muted">Tất cả bài đã có ngày. Kéo một bài vào đây để bỏ ngày.</span> : <div className="row wrap">{undated.map(chip)}</div>}
    </div>
    <div className="row wrap lead-row">
      <span className="muted">Lịch lùi, tính từ ngày đăng:</span>
      {([['copy', 'chữ xong trước'], ['visual', 'hình xong trước'], ['review', 'sẵn sàng đăng trước']] as const).map(([key, label]) => <label className="row" key={key}>{label} <input className="lead" type="number" min={0} max={30} aria-label={label} value={lead[key]} onChange={(event) => setLead(key, Number(event.target.value))} /> ngày</label>)}
    </div>
    <TaskList tasks={tasks} onOpen={open} />
  </div>
}

function TaskList({ tasks, onOpen }: { tasks: Task[]; onOpen: (piece: Piece) => void }) {
  const [all, setAll] = useState(false)
  if (tasks.length === 0) return <p className="muted">Không còn việc nào chờ theo lịch lùi (hoặc các bài chưa có ngày đăng).</p>
  const shown = all ? tasks : tasks.slice(0, 8)
  return <div className="stack">
    <h3>Việc sắp đến hạn</h3>
    <div className="list">
      {shown.map((task) => <div className="list-row" key={`${task.piece.id}-${task.milestone.key}`}>
        <button className="list-main" onClick={() => onOpen(task.piece)}>
          <strong>{task.milestone.label}: {task.piece.code} · {task.piece.title || task.piece.plan.hook}</strong>
          <small>Hạn {dayMonth(task.milestone.due)} · đăng {dayMonth(task.piece.date)}</small>
        </button>
        <span className={task.days < 0 ? 'flag warn' : task.days <= 2 ? 'flag info' : 'muted'}>{when(task.days)}</span>
      </div>)}
    </div>
    {tasks.length > 8 && <button className="link" onClick={() => setAll((value) => !value)}>{all ? 'Thu gọn' : `Xem cả ${tasks.length} việc`}</button>}
  </div>
}
