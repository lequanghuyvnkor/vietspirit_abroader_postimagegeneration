import { useDeferredValue, useMemo, useState } from 'react'
import { navigate } from '../lib/route.ts'
import { searchStore, type Hit } from '../lib/search.ts'
import type { Store } from '../lib/types.ts'

type Props = { store: Store; onClose: () => void }

const KIND = { campaign: 'Chiến dịch', piece: 'Bài', slide: 'Slide' } as const

function go(hit: Hit) {
  if (hit.kind === 'slide' && hit.postId) navigate({ workspace: hit.workspaceId, campaign: hit.campaignId, post: hit.postId })
  else if (hit.pieceId) navigate({ workspace: hit.workspaceId, campaign: hit.campaignId, piece: hit.pieceId })
  else navigate({ workspace: hit.workspaceId, campaign: hit.campaignId })
}

/** Search over every campaign, piece and slide text (accents are optional), opened with Ctrl+K. */
export function SearchDialog({ store, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const deferred = useDeferredValue(query)
  const hits = useMemo(() => searchStore(store, deferred), [store, deferred])
  const choose = (hit: Hit | undefined) => { if (hit) { go(hit); onClose() } }

  function onKey(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(hits.length - 1, value + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)) }
    else if (event.key === 'Enter') { event.preventDefault(); choose(hits[active]) }
    else if (event.key === 'Escape') onClose()
  }

  return <div className="modal-backdrop search-backdrop" onMouseDown={onClose}>
    <div className="modal wide search-dialog" role="dialog" aria-modal="true" aria-label="Tìm kiếm" onMouseDown={(event) => event.stopPropagation()}>
      <input autoFocus type="search" placeholder="Tìm bài, caption, slide, chiến dịch… (không cần gõ dấu)" aria-label="Từ khóa tìm kiếm" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0) }} onKeyDown={onKey} />
      {query.trim() && hits.length === 0 && <p className="muted">Không thấy kết quả cho "{query.trim()}".</p>}
      {!query.trim() && <p className="muted">Gõ vài chữ: mã bài (P03), một câu trong caption, tên chiến dịch, giá trị biến, link bài đăng. ↑ ↓ để chọn, Enter để mở.</p>}
      <div className="search-results" role="listbox">
        {hits.map((hit, index) => <button key={`${hit.kind}-${hit.postId ?? hit.pieceId ?? hit.campaignId}-${hit.field}`} role="option" aria-selected={index === active} className={index === active ? 'search-hit on' : 'search-hit'} onMouseEnter={() => setActive(index)} onClick={() => choose(hit)}>
          <span className="search-kind">{KIND[hit.kind]}</span>
          <span className="search-main"><strong>{hit.title}</strong><small>{hit.where} · {hit.field}</small><span className="excerpt">{hit.excerpt}</span></span>
        </button>)}
      </div>
    </div>
  </div>
}
