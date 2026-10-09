import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'
import { ASSET_REF, buildDocument, documentPieces, pieceFingerprint, unresolvedInDocument } from '../lib/document.ts'
import { freezeDocument, imageRefs, loadDocImages, markdownPackage, printHtml, toDocx, toHtml, type LoadedImage } from '../lib/docExport.ts'
import { downloadBlob } from '../lib/pack.ts'
import { newId, now } from '../lib/types.ts'
import type { Campaign, DocModel, DocVersion, Workspace } from '../lib/types.ts'
import { ConfirmDialog, Modal, Section } from './ui.tsx'
import { DocsPanel } from './DocsPanel.tsx'

type Props = {
  workspace: Workspace
  campaign: Campaign
  edit: (change: (draft: Campaign) => void) => void
  onError: (message: string) => void
}

type Format = 'pdf' | 'docx' | 'md'
type Preview = { html: string; title: string; urls: string[] }

const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chien-dich'
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** ⑥ Tài liệu: the whole campaign compiled in the app; PDF, Word and Markdown exports; approved versions to send to others. */
export function DocumentTab({ workspace, campaign, edit, onError }: Props) {
  const [withImages, setWithImages] = useState(true)
  const [readyOnly, setReadyOnly] = useState(false)
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [approving, setApproving] = useState(false)
  const [note, setNote] = useState('')
  const [removing, setRemoving] = useState<DocVersion | null>(null)
  const previewUrls = useRef<string[]>([])

  const versions = [...(campaign.docVersions ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  const latest = versions[0]
  const options = { readyOnly, images: withImages }
  const pieces = documentPieces(campaign, options)
  const missing = unresolvedInDocument(campaign, pieces)
  const changed = latest ? pieces.filter((piece) => latest.pieces[piece.id] !== pieceFingerprint(campaign, piece)) : []
  const gone = latest ? Object.keys(latest.pieces).filter((id) => !campaign.pieces.some((piece) => piece.id === id)).length : 0
  const nextLabel = `v${(campaign.docVersions ?? []).reduce((max, version) => Math.max(max, Number(version.label.replace(/\D/g, '')) || 0), 0) + 1}`

  useEffect(() => () => { for (const url of previewUrls.current) URL.revokeObjectURL(url) }, [])

  const closePreview = () => { for (const url of previewUrls.current) URL.revokeObjectURL(url); previewUrls.current = []; setPreview(null) }

  async function images(model: DocModel, wanted: boolean): Promise<Map<string, LoadedImage>> {
    if (!wanted || imageRefs(model).length === 0) return new Map()
    return loadDocImages(workspace, campaign, model, (done, total) => setBusy(`Đang dựng ảnh ${Math.min(done + 1, total)}/${total}…`))
  }

  const urlsFor = (loaded: Map<string, LoadedImage>) => {
    const urls = new Map<string, string>()
    for (const [ref, image] of loaded) { const url = URL.createObjectURL(image.blob); previewUrls.current.push(url); urls.set(ref, url) }
    return urls
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label)
    try { await action() } catch (error) { onError(error instanceof Error ? error.message : 'Không xuất được tài liệu.') } finally { setBusy('') }
  }

  async function output(model: DocModel, format: Format | 'preview', base: string, wanted: boolean) {
    const loaded = await images(model, wanted)
    if (format === 'docx') return downloadBlob(new Blob([toDocx(model, loaded) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${base}.docx`)
    if (format === 'md') { const pack = markdownPackage(model, loaded, base); return downloadBlob(pack.blob, pack.name) }
    const page = toHtml(model, urlsFor(loaded))
    if (format === 'preview') { setPreview({ html: page, title: model.title, urls: [] }); return }
    await printHtml(page)
  }

  const live = () => buildDocument(workspace, campaign, options)
  const liveBase = () => `${slug(campaign.name)}-tai-lieu`
  const exportLive = (format: Format | 'preview') => { closePreview(); return run(format === 'preview' ? 'Đang dựng bản xem trước…' : 'Đang chuẩn bị…', () => output(live(), format, liveBase(), withImages)) }
  const exportVersion = (version: DocVersion, format: Format | 'preview') => { closePreview(); return run('Đang chuẩn bị…', () => output(version.model, format, `${slug(campaign.name)}-${version.label}`, true)) }

  async function approve() {
    setApproving(false)
    await run('Đang chốt bản duyệt…', async () => {
      const model = live()
      const frozen = await freezeDocument(model, await images(model, withImages))
      const version: DocVersion = { id: newId(), label: nextLabel, at: now(), note: note.trim(), readyOnly, model: frozen, pieces: Object.fromEntries(pieces.map((piece) => [piece.id, pieceFingerprint(campaign, piece)])) }
      edit((draft) => { draft.docVersions = [...(draft.docVersions ?? []), version] })
      setNote('')
    })
  }

  function removeVersion(version: DocVersion) {
    for (const block of version.model.blocks) if (block.t === 'images') for (const item of block.items) if (item.ref.startsWith(ASSET_REF)) void api.deleteAsset(item.ref.slice(ASSET_REF.length))
    edit((draft) => { draft.docVersions = (draft.docVersions ?? []).filter((item) => item.id !== version.id) })
  }

  const buttons = (target: 'live' | DocVersion) => {
    const go = (format: Format | 'preview') => (target === 'live' ? exportLive(format) : exportVersion(target, format))
    return <>
      <button className="btn small" disabled={busy !== ''} onClick={() => { void go('preview') }}>Xem</button>
      <button className="btn small" disabled={busy !== ''} title="Mở hộp thoại in của trình duyệt: chọn 'Lưu thành PDF'" onClick={() => { void go('pdf') }}>PDF</button>
      <button className="btn small" disabled={busy !== ''} onClick={() => { void go('docx') }}>Word</button>
      <button className="btn small" disabled={busy !== ''} title="Tệp .md (kèm thư mục ảnh trong file zip nếu có ảnh)" onClick={() => { void go('md') }}>Markdown</button>
    </>
  }

  if (campaign.pieces.length === 0) return <>
    <Section title="Tài liệu"><p className="muted">Chưa có bài nào để ghép tài liệu. Soạn kế hoạch ở tab Kế hoạch trước.</p></Section>
    <Section title="Đẩy sang Google Docs (tùy chọn)"><DocsPanel workspace={workspace} campaign={campaign} edit={edit} /></Section>
  </>

  return <>
    <Section title="Tài liệu chiến dịch" aside={<span className="muted">tự ghép từ Nền tảng, Kế hoạch và các bài</span>}>
      <p className="muted">Một tài liệu gồm: chiến lược, lịch đăng, rồi từng bài với caption, ảnh, mục cần duyệt. Luôn lấy dữ liệu mới nhất trong app; muốn gửi người khác một bản cố định thì <b>chốt bản duyệt</b>.</p>
      <div className="row wrap">
        <label className="check"><input type="checkbox" checked={withImages} onChange={(event) => setWithImages(event.target.checked)} /> Kèm ảnh các slide</label>
        <label className="check"><input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} /> Chỉ bài đã "Sẵn sàng" ({campaign.pieces.filter((piece) => piece.status === 'ready').length})</label>
      </div>
      <p className="muted">{pieces.length} bài trong tài liệu.{missing.length > 0 && ` Còn ${missing.length} biến chưa điền (${missing.slice(0, 4).map((key) => `[${key}]`).join(', ')}${missing.length > 4 ? '…' : ''}); tài liệu sẽ để nguyên dấu [ ].`}</p>
      <div className="row wrap">
        {buttons('live')}
        <span className="spacer" />
        <button className="btn primary" disabled={busy !== '' || pieces.length === 0} onClick={() => setApproving(true)}>Chốt bản duyệt {nextLabel}</button>
      </div>
      {busy && <p className="notice" role="status">{busy}</p>}
    </Section>

    {preview && <Section title={`Xem trước: ${preview.title}`} aside={<span className="row"><button className="btn small" onClick={() => { void printHtml(preview.html) }}>In / PDF</button><button className="btn small ghost" onClick={closePreview}>Đóng</button></span>}>
      <iframe className="doc-preview" title="Xem trước tài liệu" sandbox="allow-same-origin" srcDoc={preview.html} />
    </Section>}

    <Section title={`Các bản đã chốt (${versions.length})`}>
      {versions.length === 0 && <p className="muted">Chưa chốt bản nào. Bản chốt giữ nguyên chữ và ảnh tại thời điểm duyệt, kể cả khi bạn sửa bài sau đó.</p>}
      {latest && (changed.length > 0 || gone > 0
        ? <p className="notice">Từ {latest.label} đến nay: {changed.length} bài đã đổi hoặc mới{changed.length > 0 ? ` (${changed.slice(0, 8).map((piece) => piece.code).join(', ')}${changed.length > 8 ? '…' : ''})` : ''}{gone > 0 ? `, ${gone} bài đã xóa` : ''}. Chốt bản mới để gửi bản cập nhật.</p>
        : <p className="muted">Tài liệu hiện tại giống bản {latest.label}.</p>)}
      <div className="list">
        {versions.map((version) => <div className="key-row" key={version.id}>
          <div className="list-main">
            <strong>{version.label} <span className="badge">{Object.keys(version.pieces).length} bài</span></strong>
            <small>{when(version.at)}{version.readyOnly ? ' · chỉ bài Sẵn sàng' : ''}{version.note ? ` · ${version.note}` : ''}</small>
          </div>
          <div className="row">{buttons(version)}<button className="btn small ghost" disabled={busy !== ''} onClick={() => setRemoving(version)}>Xóa</button></div>
        </div>)}
      </div>
    </Section>

    <Section title="Đẩy sang Google Docs (tùy chọn)">
      <p className="muted">Không bắt buộc: tài liệu đã nằm trong app. Dùng khi cần một bản trên Google Docs cho người khác cùng xem.</p>
      <DocsPanel workspace={workspace} campaign={campaign} edit={edit} />
    </Section>

    {approving && <Modal title={`Chốt bản duyệt ${nextLabel}`} onClose={() => setApproving(false)}>
      <p>App lưu lại chữ và ảnh của {pieces.length} bài như hiện tại{withImages ? '' : ' (không kèm ảnh)'}. Sau này sửa bài thì bản này không đổi.</p>
      {missing.length > 0 && <p className="notice">Còn {missing.length} biến chưa điền; bản chốt sẽ có dấu [ ].</p>}
      <label className="field"><span className="field-label">Ghi chú (không bắt buộc)</span><input autoFocus placeholder="Ví dụ: gửi anh Minh duyệt vòng 1" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="modal-actions"><button className="btn ghost" onClick={() => setApproving(false)}>Hủy</button><button className="btn primary" onClick={() => { void approve() }}>Chốt {nextLabel}</button></div>
    </Modal>}
    {removing && <ConfirmDialog title={`Xóa bản ${removing.label}`} message="Xóa bản đã chốt này cùng các ảnh đã lưu của nó? Có thể lấy lại bằng nút Sao lưu ở thanh trên trong 30 ngày." confirm="Xóa bản" onConfirm={() => removeVersion(removing)} onClose={() => setRemoving(null)} />}
  </>
}
