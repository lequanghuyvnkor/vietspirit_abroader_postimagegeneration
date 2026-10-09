import { assetUrl } from '../lib/api.ts'
import type { Campaign, HeroPhoto, Post } from '../lib/types.ts'
import { Field } from './ui.tsx'

type Props = {
  campaign: Campaign
  post: Post
  edit: (change: (draft: Post) => void) => void
}

const LAYOUTS: Record<HeroPhoto['layout'], string> = { bottom: 'Ảnh dưới chữ', right: 'Ảnh bên phải, chữ bên trái', full: 'Ảnh toàn khung, chữ ở dưới' }
const SHAPES: Record<HeroPhoto['shape'], string> = { rounded: 'Khung bo góc', circle: 'Chân dung tròn', cutout: 'Đã tách nền, đứng trên slide' }

/** The photo that leads this slide (e.g. the mentor). Photos come from the piece's "Tài nguyên" list; the AI never draws a real person. */
export function HeroPanel({ campaign, post, edit }: Props) {
  const piece = campaign.pieces.find((item) => item.id === post.pieceId)
  const photos = (piece?.assets ?? []).filter((asset) => asset.assetId)
  const hero = post.hero
  const suggestion = ['[TÊN MENTOR]', '[TRƯỜNG/CHƯƠNG TRÌNH]'].filter((key) => key.slice(1, -1) in campaign.variables).join('\n')
  const set = (change: Partial<HeroPhoto>) => edit((draft) => { if (draft.hero) draft.hero = { ...draft.hero, ...change } })

  return <div className="field">
    <span className="field-label">Ảnh chủ đạo (ảnh thật của người)</span>
    {photos.length === 0 && !hero && <p className="muted">Chưa có ảnh. Tải ảnh ở mục "Tài nguyên cần chuẩn bị" của bài rồi quay lại đây. Ảnh người thật luôn do bạn cung cấp, AI không vẽ khuôn mặt.</p>}
    {photos.length > 0 && <div className="refs">
      {photos.map((asset) => <button key={asset.id} className={hero?.assetId === asset.assetId ? 'ref picked' : 'ref'} title={asset.label} onClick={() => edit((draft) => { draft.hero = { assetId: asset.assetId!, layout: draft.hero?.layout ?? 'bottom', shape: draft.hero?.shape ?? 'rounded', focusY: draft.hero?.focusY ?? 0.3, caption: draft.hero?.caption ?? suggestion } })}><img src={assetUrl(asset.assetId!)} alt={asset.label} /></button>)}
    </div>}
    {hero && <>
      <div className="row wrap">
        <select aria-label="Bố cục ảnh" value={hero.layout} onChange={(event) => set({ layout: event.target.value as HeroPhoto['layout'] })}>{(Object.keys(LAYOUTS) as HeroPhoto['layout'][]).map((key) => <option key={key} value={key}>{LAYOUTS[key]}</option>)}</select>
        {hero.layout !== 'full' && <select aria-label="Kiểu khung" value={hero.shape} onChange={(event) => set({ shape: event.target.value as HeroPhoto['shape'] })}>{(Object.keys(SHAPES) as HeroPhoto['shape'][]).map((key) => <option key={key} value={key}>{SHAPES[key]}</option>)}</select>}
      </div>
      <label className="field"><span className="field-label">Phần ảnh được giữ lại khi cắt (lên ↔ xuống)</span><input type="range" min={0} max={1} step={0.05} value={hero.focusY ?? 0.3} onChange={(event) => set({ focusY: Number(event.target.value) })} /></label>
      {hero.layout !== 'full' && <Field label="Thẻ tên trên ảnh" hint="Dòng đầu là tên (in đậm), các dòng sau là trường và thành tích đã xác thực. Dùng [TÊN MENTOR], [TRƯỜNG/CHƯƠNG TRÌNH] để lấy từ dữ kiện chiến dịch."><textarea rows={3} value={hero.caption ?? ''} onChange={(event) => set({ caption: event.target.value })} /></Field>}
      <button className="btn small ghost" onClick={() => edit((draft) => { delete draft.hero })}>Gỡ ảnh chủ đạo</button>
    </>}
  </div>
}
