import { useState } from 'react'
import { campaignWindow } from '../lib/foundation.ts'
import { defaultProductionNote, kindLabel, pieceTexts, suggestDates } from '../lib/plan.ts'
import { navigate } from '../lib/route.ts'
import { unresolvedIn } from '../lib/text.ts'
import { STATUS_LABELS } from '../lib/types.ts'
import type { Campaign, Piece, PieceStatus, Production, Workspace } from '../lib/types.ts'
import { ConfirmDialog } from './ui.tsx'
import { SlideThumb } from './SlideThumb.tsx'
import { slidesOf } from '../lib/pack.ts'
import { copyDocsHtml } from '../lib/docsExport.ts'
import { docsSyncReady, emptyDocsSync, loadDocsSync } from '../lib/docsSync.ts'
import { useDocsSync } from '../lib/docsSyncState.ts'
import type { DocsSync } from '../lib/types.ts'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

const DAY = 86400000

const weekday = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' })
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function ScheduleTable({ workspace, campaign, edit }: Props) {
  const [confirmSuggest, setConfirmSuggest] = useState(false)
  const [prefill] = useState(loadDocsSync)
  const [syncOpen, setSyncOpen] = useState(false)
  const docs = useDocsSync()
  const sync = campaign.docsSync ?? emptyDocsSync(prefill)
  const syncStatus = docs.status[campaign.id]
  const pending = docs.pending[campaign.id] ?? campaign.pieces.length
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const window = campaignWindow(campaign)
  const undated = campaign.pieces.filter((piece) => !piece.date)
  const sorted = [...campaign.pieces].filter((piece) => piece.date).sort((a, b) => a.date.localeCompare(b.date) || a.plan.time.localeCompare(b.plan.time) || a.code.localeCompare(b.code))
  const perDay = new Map<string, number>()
  for (const piece of sorted) perDay.set(piece.date, (perDay.get(piece.date) ?? 0) + 1)
  const [todayMs] = useState(() => Date.now())

  const patch = (id: string, change: (piece: Piece) => void) => edit((draft) => { const piece = draft.pieces.find((item) => item.id === id); if (piece) change(piece) })

  function warnings(piece: Piece): { text: string; level: 'warn' | 'info' }[] {
    const out: { text: string; level: 'warn' | 'info' }[] = []
    const missing = new Set(pieceTexts(campaign, piece).flatMap((text) => unresolvedIn(text, campaign.variables))).size
    if (missing) out.push({ text: `${missing} biến chưa điền`, level: 'warn' })
    const open = piece.checks.filter((check) => !check.done).length
    if (open) out.push({ text: `${open} mục chưa duyệt`, level: 'info' })
    if (piece.date) {
      const days = Math.ceil((new Date(`${piece.date}T00:00:00`).getTime() - todayMs) / DAY)
      if (piece.status !== 'ready' && days <= 2) out.push({ text: days < 0 ? 'Quá hạn' : days === 0 ? 'Đăng hôm nay' : `Còn ${days} ngày`, level: 'warn' })
      if (window && (piece.date < window.start || piece.date > window.end)) out.push({ text: 'Ngoài kỳ chiến dịch', level: 'warn' })
      if ((perDay.get(piece.date) ?? 0) > 1) out.push({ text: 'Trùng ngày', level: 'info' })
    }
    return out
  }

  function exportCsv() {
    const rows = [['Ngày', 'Giờ', 'Mã', 'Tiêu đề', 'Loại', 'Định dạng', 'Funnel', 'Pillar', 'Bên sản xuất', 'Ghi chú sản xuất', 'Trạng thái', 'Cảnh báo'],
      ...[...sorted, ...undated].map((piece) => [piece.date, piece.plan.time, piece.code, piece.title, kindLabel(piece), piece.plan.format, piece.plan.funnel, piece.plan.pillar, piece.production === 'external' ? 'Bên ngoài' : 'Nội bộ', piece.productionNote, STATUS_LABELS[piece.status], warnings(piece).map((item) => item.text).join('; ')])]
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `lich-dang-${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'chien-dich'}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  async function copyForDocs() {
    try { await copyDocsHtml(campaign); setCopied('ok') } catch { setCopied('fail') }
    setTimeout(() => setCopied(null), 4000)
  }

  const setSync = (change: Partial<DocsSync>) => edit((draft) => { draft.docsSync = { ...emptyDocsSync(prefill), ...draft.docsSync, ...change } })
  const ready = docsSyncReady(sync)

  function toggleAuto(on: boolean) {
    setSync({ auto: on })
    if (on && ready) void docs.pushNow(workspace.id, campaign.id, false)
  }

  function applySuggestion() {
    if (!window) return
    const dates = suggestDates(undated.length, window)
    edit((draft) => {
      const targets = draft.pieces.filter((piece) => !piece.date)
      targets.forEach((piece, index) => { piece.date = dates[index] })
    })
  }

  const row = (piece: Piece) => {
    const flags = warnings(piece)
    return <tr key={piece.id} className={piece.production === 'external' ? 'parked' : ''}>
      <td className="date-cell">
        <input type="date" aria-label={`Ngày đăng ${piece.code}`} value={piece.date} onChange={(event) => patch(piece.id, (item) => { item.date = event.target.value })} />
        {piece.date && <small className="muted">{weekday(piece.date)}</small>}
      </td>
      <td><input className="time" aria-label={`Giờ đăng ${piece.code}`} value={piece.plan.time} placeholder="20:30" onChange={(event) => patch(piece.id, (item) => { item.plan.time = event.target.value })} /></td>
      <td className="title-cell">
        <button className="link plain" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })}><strong>{piece.code}</strong> · {piece.title}</button>
        <small className="muted">{piece.plan.goal}</small>
      </td>
      <td className="thumb-cell">{(() => { const slides = slidesOf(campaign, piece); return slides.length ? <><SlideThumb post={slides[0]} campaign={campaign} workspace={workspace} width={52} />{slides.length > 1 && <small className="muted block">{slides.length} ảnh</small>}</> : <span className="muted">{piece.kind === 'reel' ? (piece.production === 'external' ? 'bên ngoài' : 'sắp có') : '—'}</span> })()}</td>
      <td>{kindLabel(piece)}<small className="muted block">{piece.plan.format}</small></td>
      <td className="production-cell"><select aria-label={`Bên sản xuất ${piece.code}`} value={piece.production} onChange={(event) => patch(piece.id, (item) => { item.production = event.target.value as Production; if (!item.productionNote.trim() || item.productionNote === defaultProductionNote(item.production === 'external' ? 'internal' : 'external')) item.productionNote = defaultProductionNote(item.production) })}><option value="internal">Nội bộ</option><option value="external">Bên ngoài</option></select>{piece.productionNote && <small className="muted block">{piece.productionNote.slice(0, 70)}{piece.productionNote.length > 70 ? '…' : ''}</small>}</td>
      <td>{piece.plan.funnel}<small className="muted block">{piece.plan.pillar}</small></td>
      <td>
        <select aria-label={`Trạng thái ${piece.code}`} value={piece.status} onChange={(event) => patch(piece.id, (item) => { item.status = event.target.value as PieceStatus })}>
          {(Object.keys(STATUS_LABELS) as PieceStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
      </td>
      <td className="flags">{flags.length === 0 ? <span className="muted">—</span> : flags.map((flag) => <span key={flag.text} className={`flag ${flag.level}`}>{flag.text}</span>)}</td>
    </tr>
  }

  return <div className="schedule">
    <div className="row wrap schedule-bar">
      <span className="muted">Đã xếp lịch {sorted.length}/{campaign.pieces.length} bài{window ? ` · kỳ ${dayMonth(window.start)}–${dayMonth(window.end)}` : ''}</span>
      <span className="spacer" />
      {window && undated.length > 0 && <button className="btn small" onClick={() => setConfirmSuggest(true)}>Gợi ý lịch cho {undated.length} bài chưa có ngày</button>}
      <button className="btn small" onClick={copyForDocs} title="Mỗi bài một thẻ, dán thẳng vào Google Docs (Ctrl+V)">{copied === 'ok' ? 'Đã sao chép, hãy dán vào Docs' : copied === 'fail' ? 'Không sao chép được' : 'Sao chép cho Google Docs'}</button>
      <button className="btn small" onClick={() => setSyncOpen((open) => !open)} aria-expanded={syncOpen}>Đẩy lên Google Docs</button>
      <button className="btn small" onClick={exportCsv}>Xuất CSV</button>
    </div>
    {syncOpen && <div className="stack schedule-bar">
      <div className="row wrap">
        <input aria-label="Link Google Docs" placeholder="Link Google Docs" value={sync.doc} onChange={(event) => setSync({ doc: event.target.value })} />
        <input aria-label="URL web app Apps Script" placeholder="URL web app Apps Script (…/exec)" value={sync.url} onChange={(event) => setSync({ url: event.target.value })} />
      </div>
      <div className="row wrap">
        <button className="btn small primary" disabled={syncStatus?.busy || !ready} onClick={() => { void docs.pushNow(workspace.id, campaign.id, false) }}>{pending > 0 ? `Đẩy ${pending} bài thay đổi` : 'Đã khớp, đẩy lại bài thay đổi'}</button>
        <button className="btn small" disabled={syncStatus?.busy || !ready} onClick={() => { void docs.pushNow(workspace.id, campaign.id, true) }}>Đẩy lại tất cả {campaign.pieces.length} bài</button>
        <label className="row" title="Khi nội dung hoặc hình ảnh của một bài đổi (ở bất kỳ trang nào của app), Google Docs tự cập nhật bài đó sau vài giây."><input type="checkbox" checked={sync.auto} disabled={!ready} onChange={(event) => toggleAuto(event.target.checked)} /> Tự động cập nhật khi có thay đổi</label>
      </div>
      {syncStatus?.message && <span className="muted" role="status">{syncStatus.message}</span>}
      <small className="muted">Mỗi bài là một tab: bảng thông tin và ảnh hoàn chỉnh (hoặc các cảnh của Reel). Chữ bạn gõ tay trong các tab này sẽ bị thay khi bài đó được đẩy lại.</small>
    </div>}
    <div className="table-wrap">
      <table>
        <thead><tr><th>Ngày</th><th>Giờ</th><th>Bài</th><th>Ảnh</th><th>Loại</th><th>Bên sản xuất</th><th>Funnel</th><th>Trạng thái</th><th>Cần lưu ý</th></tr></thead>
        <tbody>
          {sorted.map(row)}
          {undated.length > 0 && <tr className="group-row"><td colSpan={9}>Chưa xếp lịch ({undated.length})</td></tr>}
          {undated.map(row)}
        </tbody>
      </table>
    </div>
    {confirmSuggest && window && <ConfirmDialog title="Gợi ý lịch đăng" message={`Gán ngày cho ${undated.length} bài chưa có ngày, cách đều trong kỳ ${dayMonth(window.start)}–${dayMonth(window.end)} theo thứ tự mã bài. Đây chỉ là gợi ý để bạn chỉnh lại. Tiếp tục?`} confirm="Gán ngày" onConfirm={applySuggestion} onClose={() => setConfirmSuggest(false)} />}
  </div>
}
