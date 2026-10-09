import { campaignWindow } from '../lib/foundation.ts'
import { engagementRate, count, groupTotals, percent, topPieces, totalsOf, type GroupRow } from '../lib/results.ts'
import { navigate } from '../lib/route.ts'
import { now } from '../lib/types.ts'
import type { Campaign, Metrics, Piece, Workspace } from '../lib/types.ts'
import { Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

type MetricKey = 'reach' | 'engagement' | 'clicks' | 'leads'
const FIELDS: { key: MetricKey; label: string; hint: string }[] = [
  { key: 'reach', label: 'Tiếp cận', hint: 'Số người nhìn thấy bài (Reach)' },
  { key: 'engagement', label: 'Tương tác', hint: 'Tổng like, bình luận, chia sẻ, lưu' },
  { key: 'clicks', label: 'Nhấp link', hint: 'Số lượt bấm vào link / nút' },
  { key: 'leads', label: 'Lead', hint: 'Số người để lại thông tin hoặc nhắn tư vấn' },
]

function GroupTable({ title, rows }: { title: string; rows: GroupRow[] }) {
  return <div className="stack">
    <h3>{title}</h3>
    <div className="table-wrap"><table className="results-table">
      <thead><tr><th>{title.replace('Theo ', '').replace(/^./, (letter) => letter.toUpperCase())}</th><th>Kế hoạch</th><th>Đã đăng</th><th>Tiếp cận</th><th>Tương tác</th><th>Tỷ lệ tương tác</th><th>Nhấp</th><th>Lead</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.planned}</td><td>{row.published}</td><td>{count(row.reach)}</td><td>{count(row.engagement)}</td><td>{percent(row.er)}</td><td>{count(row.clicks)}</td><td>{count(row.leads)}</td></tr>)}</tbody>
    </table></div>
  </div>
}

/** Results typed in by hand per published piece, rolled up by funnel, pillar and kind. */
export function ResultsPanel({ workspace, campaign, edit }: Props) {
  const published = campaign.pieces.filter((piece) => piece.published)
  const totals = totalsOf(campaign.pieces)
  const window = campaignWindow(campaign)

  function setMetric(piece: Piece, key: MetricKey, raw: string) {
    const value = raw.trim() === '' ? null : Math.max(0, Math.round(Number(raw)))
    const id = piece.id
    edit((draft) => {
      const target = draft.pieces.find((item) => item.id === id)
      if (!target) return
      const metrics: Metrics = target.metrics ?? { reach: null, engagement: null, clicks: null, leads: null, updatedAt: '' }
      metrics[key] = value !== null && Number.isFinite(value) ? value : null
      metrics.updatedAt = now()
      target.metrics = metrics
    })
  }

  const top = (by: 'leads' | 'er') => topPieces(campaign, by)
  const open = (piece: Piece) => navigate({ workspace: workspace.id, campaign: campaign.id, piece: piece.id })

  return <Section title="Số liệu" aside={<span className="muted">nhập tay từ phần thống kê của Facebook/Instagram</span>}>
    {published.length === 0 ? <p className="muted">Chưa có bài nào được ghi nhận là đã đăng. Ghi nhận ở phần "Đăng bài" phía trên, rồi nhập số liệu tại đây.</p> : <>
      <div className="table-wrap"><table className="results-table">
        <thead><tr><th>Bài</th><th>Đăng lúc</th>{FIELDS.map((field) => <th key={field.key} title={field.hint}>{field.label}</th>)}<th>Tỷ lệ tương tác</th></tr></thead>
        <tbody>{published.sort((a, b) => a.published!.at.localeCompare(b.published!.at)).map((piece) => <tr key={piece.id}>
          <td><button className="link plain" onClick={() => open(piece)}><strong>{piece.code}</strong> · {piece.title || piece.plan.hook}</button></td>
          <td>{new Date(piece.published!.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
          {FIELDS.map((field) => <td key={field.key}><input type="number" min={0} className="metric" aria-label={`${field.label} ${piece.code}`} value={piece.metrics?.[field.key] ?? ''} onChange={(event) => setMetric(piece, field.key, event.target.value)} /></td>)}
          <td>{percent(engagementRate(piece.metrics))}</td>
        </tr>)}</tbody>
      </table></div>

      <div className="stat-row">
        <div className="stat"><strong>{totals.published}/{campaign.pieces.length}</strong><span>bài đã đăng</span></div>
        <div className="stat"><strong>{count(totals.reach)}</strong><span>tiếp cận</span></div>
        <div className="stat"><strong>{percent(totals.er)}</strong><span>tỷ lệ tương tác</span></div>
        <div className="stat"><strong>{count(totals.clicks)}</strong><span>nhấp link</span></div>
        <div className="stat"><strong>{count(totals.leads)}</strong><span>lead</span></div>
      </div>
      {totals.measured < totals.published && <p className="muted">{totals.published - totals.measured} bài đã đăng chưa nhập Tiếp cận; chưa tính vào tổng và tỷ lệ tương tác.</p>}
      {(campaign.foundation.kpis.length > 0 || window) && <p className="muted">Mục tiêu đã đặt: {campaign.foundation.kpis.map((kpi) => `${kpi.label}${kpi.target ? ` (${kpi.target})` : ''}`).join(' · ') || '—'}{window ? ` · kỳ ${window.start.slice(8, 10)}/${window.start.slice(5, 7)}–${window.end.slice(8, 10)}/${window.end.slice(5, 7)}` : ''}</p>}

      <GroupTable title="Theo phễu" rows={groupTotals(campaign, 'funnel')} />
      <GroupTable title="Theo trụ cột" rows={groupTotals(campaign, 'pillar')} />
      <GroupTable title="Theo loại bài" rows={groupTotals(campaign, 'kind')} />
      <small className="muted">Bài phục vụ hai trụ cột được tính ở cả hai dòng.</small>

      {(top('leads').length > 0 || top('er').length > 0) && <div className="coverage">
        {([['leads', 'Nhiều lead nhất'], ['er', 'Tương tác cao nhất']] as const).map(([by, label]) => top(by).length > 0 && <div className="coverage-col" key={by}>
          <h3>{label}</h3>
          {top(by).map((piece) => <div className="coverage-row" key={piece.id}><button className="link" onClick={() => open(piece)}>{piece.code} · {piece.title || piece.plan.hook}</button><span className="muted">{by === 'leads' ? `${count(piece.metrics?.leads ?? 0)} lead` : percent(engagementRate(piece.metrics))}</span></div>)}
        </div>)}
      </div>}
    </>}
  </Section>
}
