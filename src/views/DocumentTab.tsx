import { useEffect, useRef, useState } from 'react'
import { buildDocument, documentPieces, unresolvedInDocument } from '../lib/document.ts'
import { imageRefs, loadDocImages, printHtml, toDocx, toHtml, type LoadedImage } from '../lib/docExport.ts'
import { downloadBlob } from '../lib/pack.ts'
import type { Campaign, DocModel, Workspace } from '../lib/types.ts'
import { DocPages } from './DocPages.tsx'
import { Section } from './ui.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onError: (message: string) => void
}

type Format = 'pdf' | 'docx'

const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chien-dich'

/** ⑥ Tài liệu: the whole campaign as read-only pages (like the tabs of a Google Doc), and export to Word or PDF. Editing happens in ③ Kế hoạch and on each piece's page. */
export function DocumentTab({ workspace, campaign, onError }: Props) {
  const [view, setView] = useState<'pages' | 'export'>('pages')
  const [withImages, setWithImages] = useState(true)
  const [readyOnly, setReadyOnly] = useState(false)
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const urls = useRef<string[]>([])

  const options = { readyOnly, images: withImages }
  const pieces = documentPieces(campaign, options)
  const missing = unresolvedInDocument(campaign, pieces)

  useEffect(() => () => { for (const url of urls.current) URL.revokeObjectURL(url) }, [])
  const closePreview = () => { for (const url of urls.current) URL.revokeObjectURL(url); urls.current = []; setPreview(null) }

  async function images(model: DocModel): Promise<Map<string, LoadedImage>> {
    if (!withImages || imageRefs(model).length === 0) return new Map()
    return loadDocImages(workspace, campaign, model, (done, total) => setBusy(`Đang dựng ảnh ${Math.min(done + 1, total)}/${total}…`))
  }

  async function output(format: Format | 'preview') {
    closePreview()
    setBusy('Đang chuẩn bị…')
    try {
      const model = buildDocument(workspace, campaign, options)
      const loaded = await images(model)
      if (format === 'docx') { downloadBlob(new Blob([toDocx(model, loaded) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${slug(campaign.name)}-tai-lieu.docx`); return }
      const map = new Map<string, string>()
      for (const [ref, image] of loaded) { const url = URL.createObjectURL(image.blob); urls.current.push(url); map.set(ref, url) }
      const page = toHtml(model, map)
      if (format === 'preview') setPreview(page)
      else await printHtml(page)
    } catch (error) { onError(error instanceof Error ? error.message : 'Không xuất được tài liệu.') } finally { setBusy('') }
  }

  const views = [{ key: 'pages', label: 'Trang bài' }, { key: 'export', label: 'Xuất Word / PDF' }] as const

  return <>
    <div className="docs-views" role="tablist" aria-label="Cách xem tài liệu">
      {views.map((item) => <button key={item.key} role="tab" aria-selected={view === item.key} className={view === item.key ? 'on' : ''} onClick={() => setView(item.key)}>{item.label}</button>)}
    </div>
    {view === 'pages' && <DocPages workspace={workspace} campaign={campaign} />}
    {view === 'export' && <>
      <Section title="Xuất tài liệu" aside={<span className="muted">tự ghép từ Nền tảng, Kế hoạch và các bài</span>}>
        {campaign.pieces.length === 0 ? <p className="muted">Chưa có bài nào để ghép tài liệu. Soạn kế hoạch ở tab Kế hoạch trước.</p> : <>
          <p className="muted">Một tài liệu gồm: chiến lược, lịch đăng, rồi từng bài với caption, ảnh, mục cần duyệt, và mục Kết quả khi đã có bài đăng. Luôn lấy dữ liệu mới nhất trong app.</p>
          <div className="row wrap">
            <label className="check"><input type="checkbox" checked={withImages} onChange={(event) => setWithImages(event.target.checked)} /> Kèm ảnh các slide</label>
            <label className="check"><input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} /> Chỉ bài đã "Sẵn sàng" ({campaign.pieces.filter((piece) => piece.status === 'ready').length})</label>
          </div>
          <p className="muted">{pieces.length} bài trong tài liệu.{missing.length > 0 && ` Còn ${missing.length} biến chưa điền (${missing.slice(0, 4).map((key) => `[${key}]`).join(', ')}${missing.length > 4 ? '…' : ''}); tài liệu sẽ để nguyên dấu [ ].`}</p>
          <div className="row wrap">
            <button className="btn" disabled={busy !== ''} onClick={() => { void output('preview') }}>Xem trước</button>
            <button className="btn" disabled={busy !== ''} title="Mở hộp thoại in của trình duyệt: chọn 'Lưu thành PDF'" onClick={() => { void output('pdf') }}>PDF</button>
            <button className="btn primary" disabled={busy !== ''} onClick={() => { void output('docx') }}>Word (.docx)</button>
          </div>
          {busy && <p className="notice" role="status">{busy}</p>}
        </>}
      </Section>
      {preview && <Section title="Xem trước" aside={<span className="row"><button className="btn small" onClick={() => { void printHtml(preview) }}>In / PDF</button><button className="btn small ghost" onClick={closePreview}>Đóng</button></span>}>
        <iframe className="doc-preview" title="Xem trước tài liệu" sandbox="allow-same-origin" srcDoc={preview} />
      </Section>}
    </>}
  </>
}
