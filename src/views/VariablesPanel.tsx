import { useState } from 'react'
import { GROUP_LABELS, describeVariables, type GroupKey } from '../lib/variables.ts'
import { navigate } from '../lib/route.ts'
import type { Campaign, Workspace } from '../lib/types.ts'
import { Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
}

/** The blanks ([SỐ SUẤT], [LINK FORM]…) left in the copy, grouped by topic, each showing where it is used. */
export function VariablesPanel({ workspace, campaign, edit }: Props) {
  const [onlyEmpty, setOnlyEmpty] = useState(false)
  const variables = describeVariables(campaign)
  if (variables.length === 0) return null
  const empty = variables.filter((item) => !item.value.trim())
  const shown = onlyEmpty ? empty : variables
  const groups = (['contact', 'offer', 'mentor', 'other'] as GroupKey[]).map((group) => ({ group, items: shown.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0)
  const set = (key: string, value: string) => edit((draft) => { draft.variables[key] = value })

  return <Section title="Thông tin cần điền" aside={<span className={empty.length ? 'flag warn' : 'flag info'}>{empty.length ? `${empty.length} chỗ còn trống` : 'Đã điền đủ'}</span>}>
    <p className="muted">Caption và slide có những chỗ trống dạng <code>[TÊN]</code> chờ thông tin thật. Điền mỗi chỗ <strong>một lần ở đây</strong>, mọi bài dùng nó sẽ tự cập nhật, cả ảnh xuất ra. Chưa điền thì bài chưa thể chuyển sang "Sẵn sàng".</p>
    <label className="check"><input type="checkbox" checked={onlyEmpty} onChange={(event) => setOnlyEmpty(event.target.checked)} /> Chỉ hiện chỗ còn trống ({empty.length})</label>
    {groups.length === 0 && <p className="notice">Tất cả đã được điền.</p>}
    {groups.map(({ group, items }) => <div className="var-group" key={group}>
      <h3>{GROUP_LABELS[group].title}<small className="muted"> {GROUP_LABELS[group].hint}</small></h3>
      <div className="var-list">
        {items.map((item) => {
          const similar = item.similar ? variables.find((other) => other.key === item.similar) : undefined
          return <div className={item.value.trim() ? 'var-row' : 'var-row empty'} key={item.key}>
            <div className="var-name">
              <strong>{item.label}</strong>
              <code>[{item.key}]</code>
            </div>
            <div className="var-input">
              <textarea rows={1} aria-label={item.label} value={item.value} placeholder="Chưa điền" onChange={(event) => set(item.key, event.target.value)} />
              <small className="muted">
                Dùng ở: {item.usedIn.length ? item.usedIn.map((entry, index) => <span key={entry.id}>{index > 0 && ', '}<button className="link plain" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, piece: entry.id })}>{entry.code}</button></span>) : 'bài đăng lẻ'}
                {item.example && <> · <em>{item.example}</em></>}
              </small>
              {!item.value.trim() && similar && similar.value.trim() && <button className="link" onClick={() => set(item.key, similar.value)}>Dùng giống [{similar.key}]: {similar.value.slice(0, 28)}</button>}
            </div>
          </div>
        })}
      </div>
    </div>)}
  </Section>
}
