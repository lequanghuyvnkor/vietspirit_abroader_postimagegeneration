import { useState } from 'react'
import type { ApiKey } from '../lib/api.ts'
import { auditFacts, emptyFoundation, extractFoundation, factIssues, type FactIssue } from '../lib/foundation.ts'
import { newId } from '../lib/types.ts'
import type { Campaign, Foundation, Workspace } from '../lib/types.ts'
import { ConfirmDialog, Field, Section } from './ui.tsx'
import { VariablesPanel } from './VariablesPanel.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  keys: ApiKey[]
  onManageKeys: () => void
  onError: (message: string) => void
}

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)

/** ① Nền tảng: the single source of truth every post, AI prompt and check reads from. */
export function FoundationTab({ workspace, campaign, edit, keys, onManageKeys, onError }: Props) {
  const f = campaign.foundation ?? emptyFoundation()
  const key = keys.find((item) => item.isDefault) ?? keys[0]
  const [busy, setBusy] = useState<'' | 'extract' | 'audit'>('')
  const [proposal, setProposal] = useState<Foundation | null>(null)
  const [aiIssues, setAiIssues] = useState<FactIssue[] | null>(null)
  const [dosText, setDosText] = useState(f.dos.join('\n'))
  const [dontsText, setDontsText] = useState(campaign.guardrailNotes.join('\n'))
  const issues = factIssues(campaign)

  const setF = (change: (draft: Foundation) => void) => edit((draft) => { draft.foundation ??= emptyFoundation(); change(draft.foundation) })

  async function extract() {
    setBusy('extract')
    try { setProposal(await extractFoundation(campaign, key?.id)) }
    catch (error) { onError(error instanceof Error ? error.message : 'AI không dựng được nền tảng.') }
    finally { setBusy('') }
  }

  async function audit() {
    setBusy('audit')
    try { setAiIssues(await auditFacts(campaign, key?.id)) }
    catch (error) { onError(error instanceof Error ? error.message : 'AI không soát được dữ kiện.') }
    finally { setBusy('') }
  }

  function applyProposal(next: Foundation) {
    edit((draft) => { draft.foundation = next })
    setDosText(next.dos.join('\n'))
  }

  const issueList = (list: FactIssue[]) => <ul className="issues">{list.map((issue, index) => <li key={index} className={issue.level}>{issue.text}</li>)}</ul>

  return <>
    {campaign.strategy.trim() && <div className="notice row wrap">
      <span>Có sẵn văn bản chiến lược từ file Excel ({campaign.strategy.length.toLocaleString('vi-VN')} ký tự). AI có thể dựng nền tảng từ đó để bạn chỉnh lại.</span>
      <button className="btn small primary" disabled={busy !== '' || !key} onClick={() => { void extract() }}>{busy === 'extract' ? 'AI đang đọc chiến lược…' : 'AI dựng nền tảng từ chiến lược'}</button>
      {!key && <button className="link" onClick={onManageKeys}>Thêm API key</button>}
    </div>}

    <div className="two-col">
      <div className="stack">
        <Section title="Mục tiêu và thời gian">
          <Field label="Mục tiêu chiến dịch"><textarea rows={2} value={f.objective} onChange={(event) => setF((draft) => { draft.objective = event.target.value })} /></Field>
          <div className="row wrap">
            <Field label="Bắt đầu"><input type="date" value={f.start} onChange={(event) => setF((draft) => { draft.start = event.target.value })} /></Field>
            <Field label="Kết thúc"><input type="date" value={f.end} onChange={(event) => setF((draft) => { draft.end = event.target.value })} /></Field>
          </div>
          <div className="field">
            <span className="field-label">KPI</span>
            {f.kpis.map((kpi) => <div className="row" key={kpi.id}>
              <input aria-label="Chỉ số" placeholder="Ví dụ: lead đủ chuẩn" value={kpi.label} onChange={(event) => setF((draft) => { const item = draft.kpis.find((entry) => entry.id === kpi.id); if (item) item.label = event.target.value })} />
              <input aria-label="Mục tiêu" placeholder="Ví dụ: 40" value={kpi.target} onChange={(event) => setF((draft) => { const item = draft.kpis.find((entry) => entry.id === kpi.id); if (item) item.target = event.target.value })} />
              <button className="btn small ghost" aria-label="Xóa KPI" onClick={() => setF((draft) => { draft.kpis = draft.kpis.filter((entry) => entry.id !== kpi.id) })}>×</button>
            </div>)}
            <div><button className="btn small" onClick={() => setF((draft) => { draft.kpis.push({ id: newId(), label: '', target: '' }) })}>+ KPI</button></div>
          </div>
        </Section>

        <Section title="Đối tượng">
          {f.audiences.length === 0 && <p className="muted">Ai cần nghe thông điệp này? Ví dụ: học sinh STEM lớp 12, phụ huynh là người chi trả.</p>}
          {f.audiences.map((audience) => <div className="sub-card" key={audience.id}>
            <div className="row"><input aria-label="Tên nhóm" placeholder="Tên nhóm" value={audience.name} onChange={(event) => setF((draft) => { const item = draft.audiences.find((entry) => entry.id === audience.id); if (item) item.name = event.target.value })} /><button className="btn small ghost" aria-label="Xóa nhóm" onClick={() => setF((draft) => { draft.audiences = draft.audiences.filter((entry) => entry.id !== audience.id) })}>×</button></div>
            <Field label="Insight (điều họ thật sự lo hoặc muốn)"><textarea rows={2} value={audience.insight} onChange={(event) => setF((draft) => { const item = draft.audiences.find((entry) => entry.id === audience.id); if (item) item.insight = event.target.value })} /></Field>
            <Field label="Rào cản (điều khiến họ chần chừ)"><textarea rows={2} value={audience.barrier} onChange={(event) => setF((draft) => { const item = draft.audiences.find((entry) => entry.id === audience.id); if (item) item.barrier = event.target.value })} /></Field>
          </div>)}
          <div><button className="btn small" onClick={() => setF((draft) => { draft.audiences.push({ id: newId(), name: '', insight: '', barrier: '' }) })}>+ Nhóm đối tượng</button></div>
        </Section>

        <Section title="Giọng điệu và giới hạn">
          <Field label="Giọng điệu" hint={workspace.company.tone ? `Mặc định của thương hiệu: ${workspace.company.tone}` : undefined}><input value={f.tone} placeholder={workspace.company.tone} onChange={(event) => setF((draft) => { draft.tone = event.target.value })} /></Field>
          <Field label="Nên nói (mỗi dòng một ý)"><textarea rows={3} value={dosText} onChange={(event) => setDosText(event.target.value)} onBlur={() => setF((draft) => { draft.dos = lines(dosText) })} /></Field>
          <Field label="Không được nói (mỗi dòng một ý)" hint="AI soạn chữ tránh các ý này. App cảnh báo khi một cụm đặt trong ngoặc kép (hoặc cả dòng, nếu ngắn) xuất hiện nguyên văn trong caption hay slide."><textarea rows={4} value={dontsText} onChange={(event) => setDontsText(event.target.value)} onBlur={() => edit((draft) => { draft.guardrailNotes = lines(dontsText) })} /></Field>
        </Section>
      </div>

      <div className="stack">
        <Section title="Nhà thông điệp">
          <Field label="Ý tưởng lớn" hint="Câu chuyện xuyên suốt chiến dịch, ví dụ: mentor như ngôi sao dẫn lối trên đường chân trời. Đây là phần LỜI; ở tab Moodboard, AI đổi nó thành hình ảnh (mô tả không khí)."><textarea rows={2} value={f.bigIdea} onChange={(event) => setF((draft) => { draft.bigIdea = event.target.value })} /></Field>
          <Field label="Thông điệp chính (một câu)"><textarea rows={2} value={f.keyMessage} onChange={(event) => setF((draft) => { draft.keyMessage = event.target.value })} /></Field>
          <div className="field">
            <span className="field-label">Trụ cột nội dung</span>
            <small>Mỗi bài trong kế hoạch nên thuộc một trụ cột. Bằng chứng là điều có thật để chứng minh trụ cột đó.</small>
            {f.pillars.map((pillar, index) => <div className="sub-card" key={pillar.id}>
              <div className="row"><strong>{index + 1}</strong><input aria-label="Tên trụ cột" placeholder="Tên trụ cột" value={pillar.name} onChange={(event) => setF((draft) => { const item = draft.pillars.find((entry) => entry.id === pillar.id); if (item) item.name = event.target.value })} /><button className="btn small ghost" aria-label="Xóa trụ cột" onClick={() => setF((draft) => { draft.pillars = draft.pillars.filter((entry) => entry.id !== pillar.id) })}>×</button></div>
              <Field label="Thông điệp của trụ cột"><textarea rows={2} value={pillar.message} onChange={(event) => setF((draft) => { const item = draft.pillars.find((entry) => entry.id === pillar.id); if (item) item.message = event.target.value })} /></Field>
              <Field label="Bằng chứng"><textarea rows={2} value={pillar.proof} onChange={(event) => setF((draft) => { const item = draft.pillars.find((entry) => entry.id === pillar.id); if (item) item.proof = event.target.value })} /></Field>
            </div>)}
            <div><button className="btn small" onClick={() => setF((draft) => { draft.pillars.push({ id: newId(), name: '', message: '', proof: '' }) })}>+ Trụ cột</button></div>
          </div>
        </Section>

        <Section title="Kiểm tra dữ kiện" aside={<button className="btn small" disabled={busy !== '' || !key} onClick={() => { void audit() }}>{busy === 'audit' ? 'AI đang soát…' : 'AI soát mâu thuẫn'}</button>}>
          <p className="muted">App tự kiểm ngày vượt kỳ chiến dịch, giá trị trùng và chỗ còn trống. Nút "AI soát mâu thuẫn" tìm thêm lỗi mà quy tắc không thấy được: bậc ưu đãi bị đảo, điều kiện tự mâu thuẫn, con số không khớp.</p>
          {issues.length === 0 ? <p className="muted">Không thấy lỗi theo quy tắc.</p> : issueList(issues)}
          {aiIssues && (aiIssues.length === 0 ? <p className="notice">AI không thấy mâu thuẫn nào.</p> : <><strong>AI phát hiện ({aiIssues.length})</strong>{issueList(aiIssues)}</>)}
        </Section>
      </div>
    </div>

    <VariablesPanel workspace={workspace} campaign={campaign} edit={edit} />

    {campaign.strategy.trim() && <details className="card collapsible">
      <summary><h2>Văn bản chiến lược gốc (từ Excel)</h2><span className="muted">Chỉ để tham khảo; AI dùng phần nền tảng ở trên khi đã có.</span></summary>
      <textarea rows={12} value={campaign.strategy} onChange={(event) => edit((draft) => { draft.strategy = event.target.value })} />
    </details>}

    {proposal && <ConfirmDialog title="Áp dụng nền tảng AI đề xuất?" message={`AI dựng được: ${proposal.pillars.length} trụ cột, ${proposal.audiences.length} nhóm đối tượng, ${proposal.kpis.length} KPI${proposal.start ? `, thời gian ${proposal.start} → ${proposal.end}` : ''}. Phần nền tảng hiện có sẽ bị thay; bạn chỉnh lại từng ô sau đó.`} confirm="Áp dụng" onConfirm={() => applyProposal(proposal)} onClose={() => setProposal(null)} />}
  </>
}
