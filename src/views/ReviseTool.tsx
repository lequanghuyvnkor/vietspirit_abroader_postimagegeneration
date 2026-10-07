import { useState } from 'react'
import { api, type ApiKey } from '../lib/api.ts'
import { applyRevise, buildBackgroundEditPrompt, buildReviseRequest, parseRevise, type Annotation, type Region } from '../lib/revise.ts'
import { drawCover, loadImage, renderPost } from '../lib/render.ts'
import { navigate } from '../lib/route.ts'
import { addVariant, removeVariant, rootOf, chooseVersion } from '../lib/variants.ts'
import { formatOf, newId, now } from '../lib/types.ts'
import type { Campaign, Post, Workspace } from '../lib/types.ts'
import { SlideThumb } from './SlideThumb.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  post: Post
  annotations: Annotation[]
  setAnnotations: (next: Annotation[]) => void
  keys: ApiKey[]
  onManageKeys: () => void
  /** Changes the campaign (slides, backgrounds) in one saved step. */
  mutate: (change: (campaign: Campaign) => void) => void
}

const CHIPS = [
  'Chữ khó đọc ở vùng này, làm nền sau chữ tối và sạch hơn',
  'Bỏ các vật thể/thẻ/đường trong vùng này khỏi ảnh nền',
  'Làm vùng này tối và gọn hơn, ít chi tiết hơn',
  'Đẩy khối chữ xuống thấp hơn, tránh đè lên hình',
  'Thu nhỏ chữ một chút',
]

function drawRegions(ctx: CanvasRenderingContext2D, regions: Region[], width: number, height: number): void {
  ctx.save()
  const line = Math.max(4, width / 160)
  const badge = Math.max(26, width / 30)
  regions.forEach((region, index) => {
    const x = region.x * width, y = region.y * height
    ctx.strokeStyle = '#ff2d2d'
    ctx.lineWidth = line
    ctx.strokeRect(x, y, region.w * width, region.h * height)
    if (regions.length > 1) {
      ctx.fillStyle = '#ff2d2d'
      ctx.fillRect(x, y, badge, badge)
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 ${Math.round(badge * 0.72)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(index + 1), x + badge / 2, y + badge / 2 + 1)
    }
  })
  ctx.restore()
}

/** The slide as drawn, downsized, with every chosen region outlined and numbered: what the AI looks at. */
function markedSlide(full: HTMLCanvasElement, regions: Region[]): string {
  const ratio = Math.min(1, 900 / Math.max(full.width, full.height))
  const out = document.createElement('canvas')
  out.width = Math.round(full.width * ratio)
  out.height = Math.round(full.height * ratio)
  const ctx = out.getContext('2d')!
  ctx.drawImage(full, 0, 0, out.width, out.height)
  drawRegions(ctx, regions, out.width, out.height)
  return out.toDataURL('image/jpeg', 0.85)
}

type Run = { id: string; summary: string; created: string[]; direct: { id: string; before: Post }[]; notes: string[] }

export function ReviseTool({ workspace, campaign, post, annotations, setAnnotations, keys, onManageKeys, mutate }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const [keyId, setKeyId] = useState('')
  const [allowBackground, setAllowBackground] = useState(true)
  const [asVariant, setAsVariant] = useState(true)
  const [others, setOthers] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failures, setFailures] = useState<string[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const activeKey = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]
  const regions = annotations.map((item) => item.region)
  const ready = annotations.length > 0 && annotations.every((item) => item.comment.trim())
  const busy = progress !== null && progress.done < progress.total
  const hasBackground = (target: Post) => campaign.backgrounds.some((item) => item.id === target.backgroundId)

  const sameFamily = (a: Post, b: Post) => rootOf(a) === rootOf(b)
  const candidates = campaign.posts.filter((item) => item.id !== post.id && !item.excluded && !sameFamily(item, post))
  const sharing = candidates.filter((item) => item.backgroundId && item.backgroundId === post.backgroundId)
  const samePiece = candidates.filter((item) => item.pieceId && item.pieceId === post.pieceId)
  const pieceCode = (item: Post) => campaign.pieces.find((piece) => piece.id === item.pieceId)?.code ?? 'Bài lẻ'

  const setComment = (id: string, comment: string) => setAnnotations(annotations.map((item) => item.id === id ? { ...item, comment } : item))
  const toggleOther = (id: string) => setOthers((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const pick = (list: Post[]) => setOthers(new Set(list.map((item) => item.id)))

  /** Clean background plate at the slide's size, and a copy with the numbered boxes, for the image model. */
  async function editBackground(target: Post, instruction: string): Promise<string> {
    const background = campaign.backgrounds.find((item) => item.id === target.backgroundId)
    const image = await loadImage(background?.assetId ?? null)
    if (!image) throw new Error('Slide này chưa có ảnh nền để sửa.')
    const [width, height] = formatOf(target.format).generate
    const plate = document.createElement('canvas')
    plate.width = width
    plate.height = height
    drawCover(plate.getContext('2d')!, image, width, height)
    const marked = document.createElement('canvas')
    marked.width = width
    marked.height = height
    const mctx = marked.getContext('2d')!
    mctx.drawImage(plate, 0, 0)
    drawRegions(mctx, regions, width, height)
    const [plateId, markedId] = await Promise.all([api.uploadAsset('plate.jpg', plate.toDataURL('image/jpeg', 0.92)), api.uploadAsset('marked.jpg', marked.toDataURL('image/jpeg', 0.92))])
    try {
      return await api.generate({ prompt: buildBackgroundEditPrompt(instruction, regions, campaign.keyVisual.palette), width, height, quality: 'high', referenceIds: [plateId, markedId], keyId: activeKey?.id })
    } finally {
      void api.deleteAsset(plateId)
      void api.deleteAsset(markedId)
    }
  }

  async function apply() {
    if (!ready) return
    const targets = [post, ...candidates.filter((item) => others.has(item.id))]
    const run: Run = { id: newId(), summary: '', created: [], direct: [], notes: [] }
    const problems: string[] = []
    // Slides that share a background get the same edited background, made once, so a set of similar slides stays consistent.
    const editedBackgrounds = new Map<string, string>()
    setFailures([])
    setProgress({ done: 0, total: targets.length })
    for (const [index, target] of targets.entries()) {
      try {
        const full = document.createElement('canvas')
        await renderPost(full, target, campaign, workspace)
        const allow = allowBackground && hasBackground(target)
        const { system, prompt } = buildReviseRequest(target, annotations, allow)
        const { text } = await api.generateText({ system, prompt, json: true, keyId: activeKey?.id, images: [markedSlide(full, regions)] })
        const plan = parseRevise(text)
        if (!allow) plan.background = null
        if (!run.summary) run.summary = plan.summary

        let newBackground: string | null = null
        if (plan.background && target.backgroundId) {
          let edited = editedBackgrounds.get(target.backgroundId)
          if (!edited) {
            edited = await editBackground(target, plan.background.instruction)
            editedBackgrounds.set(target.backgroundId, edited)
          }
          newBackground = edited
        }
        const backgroundEntry = newBackground ? { assetId: newBackground, id: newId() } : null
        const variantId = newId()
        if (asVariant) run.created.push(variantId)
        else run.direct.push({ id: target.id, before: structuredClone(target) })
        mutate((c) => {
          const base = c.posts.find((item) => item.id === target.id)
          if (!base) return
          let backgroundId = base.backgroundId
          if (backgroundEntry && newBackground) {
            // One saved background per edited asset, shared by every slide that used the same original.
            const existing = c.backgrounds.find((item) => item.assetId === newBackground)
            if (existing) backgroundId = existing.id
            else {
              const old = c.backgrounds.find((item) => item.id === base.backgroundId)
              c.backgrounds.push({ id: backgroundEntry.id, assetId: newBackground, format: base.format, label: `${old?.label ?? 'Nền'} · chỉnh` })
              backgroundId = backgroundEntry.id
            }
          }
          const revised = { ...applyRevise(base, plan), backgroundId }
          if (asVariant) addVariant(c, base, revised, variantId)
          else Object.assign(base, revised, { updatedAt: now() })
        })
        if (newBackground) run.notes.push(`${target.name}: đã tạo nền chỉnh sửa.`)
      } catch (caught) {
        problems.push(`${target.name}: ${caught instanceof Error ? caught.message : 'lỗi'}`)
      }
      setProgress({ done: index + 1, total: targets.length })
    }
    setFailures(problems)
    if (run.created.length || run.direct.length) {
      setRuns((list) => [run, ...list].slice(0, 6))
      setAnnotations([])
      setOthers(new Set())
    }
  }

  function undoRun(run: Run) {
    mutate((c) => {
      for (const id of run.created) removeVariant(c, id)
      for (const { id, before } of run.direct) {
        const target = c.posts.find((item) => item.id === id)
        if (!target) continue
        for (const key of Object.keys(target)) if (!(key in before)) delete (target as unknown as Record<string, unknown>)[key]
        Object.assign(target, before)
      }
    })
    setRuns((list) => list.filter((item) => item.id !== run.id))
  }

  return <div className="revise">
    <h3>Chỉnh bằng ghi chú</h3>
    {keys.length === 0 && <p className="notice">Cần API key để AI hiểu ghi chú. <button className="link" onClick={onManageKeys}>Thêm API key</button></p>}
    {annotations.length === 0 && <p className="muted">Kéo chuột trên ảnh để khoanh vùng cần chỉnh. Khoanh nhiều vùng được, mỗi vùng một ghi chú, rồi bấm sửa một lần.</p>}

    {annotations.map((item, index) => <div className={item.id === active ? 'annotation active' : 'annotation'} key={item.id} onFocus={() => setActive(item.id)}>
      <span className="badge-num">{index + 1}</span>
      <textarea rows={2} aria-label={`Ghi chú cho vùng ${index + 1}`} value={item.comment} placeholder="Ví dụ: bỏ các thẻ vé ở đây, nền tối hơn" onChange={(event) => setComment(item.id, event.target.value)} />
      <button className="btn small ghost" aria-label={`Xóa vùng ${index + 1}`} onClick={() => setAnnotations(annotations.filter((entry) => entry.id !== item.id))}>×</button>
    </div>)}
    {annotations.length > 0 && <div className="chips-row">{CHIPS.map((chip) => <button key={chip} className="chip" onClick={() => { const id = active ?? annotations[annotations.length - 1].id; setComment(id, chip) }}>{chip}</button>)}</div>}

    {annotations.length > 0 && <>
      <div className="stack tight">
        <label className="check"><input type="radio" name="revise-mode" checked={asVariant} onChange={() => setAsVariant(true)} /> Tạo <strong>bản chỉnh mới</strong> (giữ nguyên bản gốc, chọn bản dùng sau)</label>
        <label className="check"><input type="radio" name="revise-mode" checked={!asVariant} onChange={() => setAsVariant(false)} /> Sửa trực tiếp trên slide này</label>
        <label className="check"><input type="checkbox" checked={allowBackground} onChange={(event) => setAllowBackground(event.target.checked)} /> Cho phép AI sửa ảnh nền (tính phí ảnh, mỗi nền gốc 1 ảnh)</label>
      </div>

      {candidates.length > 0 && <details className="targets">
        <summary>Áp dụng thêm cho slide khác ({others.size} đã chọn)</summary>
        <div className="row wrap">
          {sharing.length > 0 && <button className="btn small" onClick={() => pick(sharing)}>Cùng nền ({sharing.length})</button>}
          {samePiece.length > 0 && <button className="btn small" onClick={() => pick(samePiece)}>Cùng bài ({samePiece.length})</button>}
          <button className="btn small ghost" onClick={() => setOthers(new Set())}>Bỏ chọn</button>
        </div>
        <div className="target-list">
          {candidates.map((item) => <label className="check small" key={item.id}><input type="checkbox" checked={others.has(item.id)} onChange={() => toggleOther(item.id)} /> {pieceCode(item)} · {item.name}</label>)}
        </div>
        <small className="muted">Vùng khoanh và ghi chú được áp dụng cho từng slide; AI nhìn riêng từng ảnh nên chữ và bố cục khác nhau vẫn được xử lý phù hợp.</small>
      </details>}

      <div className="row wrap">
        {keys.length > 1 && <select aria-label="API dùng để chỉnh" value={activeKey?.id ?? ''} onChange={(event) => setKeyId(event.target.value)}>{keys.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>}
        <button className="btn primary" disabled={busy || !ready || keys.length === 0} onClick={() => { void apply() }}>{busy ? 'Đang chỉnh…' : `Sửa ${annotations.length} vùng${others.size ? ` trên ${others.size + 1} slide` : ''}`}</button>
        <button className="btn ghost" disabled={busy} onClick={() => setAnnotations([])}>Bỏ hết vùng</button>
      </div>
      {!ready && <small className="muted">Cần ghi chú cho mọi vùng đã khoanh.</small>}
    </>}

    {progress && <p className="notice" role="status">{busy ? `Đang xử lý slide ${progress.done + 1}/${progress.total}…${allowBackground ? ' (sửa nền có thể mất 1–2 phút)' : ''}` : `Xong ${progress.done}/${progress.total} slide.`}</p>}
    {failures.length > 0 && <p className="notice error" role="alert">{failures.map((line) => <span className="block" key={line}>{line}</span>)}</p>}

    {runs.length > 0 && <div className="steps">
      <strong>Kết quả</strong>
      {runs.map((run) => <div className="step run" key={run.id}>
        <span>{run.summary}{run.notes.map((note) => <small className="muted block" key={note}>{note}</small>)}</span>
        {run.created.length > 0 && <div className="variant-strip">
          {run.created.map((id) => {
            const variant = campaign.posts.find((item) => item.id === id)
            if (!variant) return null
            return <figure key={id}>
              <SlideThumb post={variant} campaign={campaign} workspace={workspace} width={92} />
              <figcaption>
                <small>{variant.name.replace(/^.* · /, '')}{!variant.excluded && ' · đang dùng'}</small>
                <span className="row">
                  <button className="btn small" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, post: variant.id })}>Mở</button>
                  {variant.excluded && <button className="btn small" onClick={() => mutate((c) => chooseVersion(c, id))}>Dùng bản này</button>}
                </span>
              </figcaption>
            </figure>
          })}
        </div>}
        <button className="btn small ghost" disabled={busy} onClick={() => undoRun(run)}>{run.created.length ? 'Xóa các bản chỉnh' : 'Hoàn tác'}</button>
      </div>)}
    </div>}
  </div>
}
