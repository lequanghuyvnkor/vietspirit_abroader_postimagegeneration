import { useRef, useState, type ChangeEvent } from 'react'
import { api, assetUrl, uploadImage } from '../lib/api.ts'
import { componentFor, imageSize, removePlainBackground } from '../lib/assets.ts'
import { navigate } from '../lib/route.ts'
import { newId } from '../lib/types.ts'
import type { Campaign, Piece, PieceAsset, Post, Workspace } from '../lib/types.ts'
import { Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  piece: Piece
  slides: Post[]
  edit: (change: (draft: Campaign, item: Piece) => void) => void
  onError: (message: string) => void
}

/** Real material this piece needs before its images can be finished (mentor portrait, logo, credential, consent…). */
export function PieceAssets({ workspace, campaign, piece, slides, edit, onError }: Props) {
  const [busy, setBusy] = useState('')
  const [target, setTarget] = useState<Record<string, string>>({})
  const picking = useRef<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const patch = (id: string, change: (asset: PieceAsset) => void) => edit((_, item) => { const asset = item.assets.find((entry) => entry.id === id); if (asset) change(asset) })
  const guard = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    try { await action() } catch (error) { onError(error instanceof Error ? error.message : 'Có lỗi xảy ra.') } finally { setBusy('') }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const id = picking.current
    event.target.value = ''
    if (!file || !id) return
    await guard(id, async () => {
      const assetId = await uploadImage(file, 2400)
      const old = piece.assets.find((entry) => entry.id === id)?.assetId
      if (old) void api.deleteAsset(old)
      patch(id, (asset) => { asset.assetId = assetId; asset.done = true })
    })
  }

  async function cutOut(asset: PieceAsset) {
    if (!asset.assetId) return
    await guard(asset.id, async () => {
      const assetId = await removePlainBackground(asset.assetId!)
      void api.deleteAsset(asset.assetId!)
      patch(asset.id, (entry) => { entry.assetId = assetId })
    })
  }

  async function addToSlide(asset: PieceAsset) {
    const slideId = target[asset.id] ?? slides[0]?.id
    if (!asset.assetId || !slideId) return
    await guard(asset.id, async () => {
      const size = await imageSize(asset.assetId!)
      edit((draft) => {
        const component = componentFor(draft, asset.assetId!, asset.label, size)
        draft.posts.find((post) => post.id === slideId)?.layers.push({ id: newId(), componentId: component.id, x: 0.5, y: 0.58, w: 0.45, opacity: 1, rotation: 0 })
      })
    })
  }

  /** The photo leads the slide: placed under the text, framed, with a name plate; the text and the background adapt to it. */
  async function makeHero(asset: PieceAsset) {
    const slideId = target[asset.id] ?? slides[0]?.id
    if (!asset.assetId || !slideId) return
    const caption = ['TÊN MENTOR', 'TRƯỜNG/CHƯƠNG TRÌNH'].filter((key) => key in campaign.variables).map((key) => `[${key}]`).join('\n')
    edit((draft) => {
      const post = draft.posts.find((item) => item.id === slideId)
      if (post) { post.hero = { assetId: asset.assetId!, layout: 'bottom', shape: 'rounded', focusY: 0.3, caption }; post.textAnchor = 'top' }
    })
    navigate({ workspace: workspace.id, campaign: campaign.id, post: slideId })
  }

  return <Section title={`Tài nguyên cần chuẩn bị (${piece.assets.filter((asset) => asset.done).length}/${piece.assets.length})`} aside={<button className="btn small" onClick={() => edit((_, item) => { item.assets.push({ id: newId(), label: 'Tài nguyên mới', assetId: null, done: false, note: '' }) })}>+ Thêm</button>}>
    <p className="muted">Ảnh thật, thông tin xác thực và đồng ý sử dụng cần có trước khi hoàn thiện bài. Tải ảnh lên rồi đặt vào slide, ảnh giữ nguyên người thật, không do AI vẽ.</p>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void upload(event) }} />
    {piece.assets.length === 0 && <p className="muted">Kế hoạch không ghi tài nguyên nào. Bấm "+ Thêm" nếu cần.</p>}
    <div className="asset-list">
      {piece.assets.map((asset) => <div className={asset.done ? 'asset-row done' : 'asset-row'} key={asset.id}>
        <div className="asset-top">
          <label className="check"><input type="checkbox" checked={asset.done} onChange={(event) => patch(asset.id, (entry) => { entry.done = event.target.checked })} /></label>
          <input aria-label="Tên tài nguyên" value={asset.label} onChange={(event) => patch(asset.id, (entry) => { entry.label = event.target.value })} />
          <button className="btn small ghost" aria-label={`Xóa ${asset.label}`} onClick={() => edit((_, item) => { item.assets = item.assets.filter((entry) => entry.id !== asset.id) })}>×</button>
        </div>
        <input aria-label="Ghi chú" placeholder="Ghi chú (tên, chức danh, nguồn xác thực, đã có consent…)" value={asset.note} onChange={(event) => patch(asset.id, (entry) => { entry.note = event.target.value })} />
        <div className="asset-body">
          {asset.assetId && <div className="thumb big checker"><img src={assetUrl(asset.assetId)} alt={asset.label} /></div>}
          <div className="row wrap">
            <button className="btn small" disabled={busy === asset.id} onClick={() => { picking.current = asset.id; input.current?.click() }}>{busy === asset.id ? 'Đang xử lý…' : asset.assetId ? 'Thay ảnh' : 'Tải ảnh lên'}</button>
            {asset.assetId && <button className="btn small" disabled={busy === asset.id} onClick={() => { void cutOut(asset) }} title="Dùng cho ảnh chụp trên nền đơn sắc">Tách nền</button>}
            {asset.assetId && slides.length > 0 && <>
              <select aria-label="Slide để đặt ảnh" value={target[asset.id] ?? slides[0].id} onChange={(event) => setTarget((current) => ({ ...current, [asset.id]: event.target.value }))}>{slides.map((slide) => <option key={slide.id} value={slide.id}>{slide.name}</option>)}</select>
              <button className="btn small primary" disabled={busy === asset.id} title="Ảnh dẫn dắt slide: có khung, thẻ tên, chữ và nền tự tránh ảnh" onClick={() => { void makeHero(asset) }}>Làm ảnh chủ đạo</button>
              <button className="btn small" disabled={busy === asset.id} title="Đặt như một thành phần tự do, kéo thả vị trí trong trang chỉnh slide" onClick={() => { void addToSlide(asset) }}>Đặt tự do</button>
              <button className="link" onClick={() => navigate({ workspace: workspace.id, campaign: campaign.id, post: target[asset.id] ?? slides[0].id })}>Mở slide để chỉnh vị trí</button>
            </>}
          </div>
        </div>
      </div>)}
    </div>
  </Section>
}
