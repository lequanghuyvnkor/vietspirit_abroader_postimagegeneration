import { strToU8, zipSync, type Zippable } from 'fflate'
import { api, assetUrl, readFileAsDataUrl } from './api.ts'
import { ASSET_REF, POST_REF } from './document.ts'
import { renderBlob } from './render.ts'
import type { Campaign, DocBlock, DocModel, Workspace } from './types.ts'

export type LoadedImage = { blob: Blob; bytes: Uint8Array; w: number; h: number }

const IMAGE_EDGE = 900

/** Slide pictures in a document are review-sized JPEGs, not the full 1080 px PNGs, so files stay light. */
async function shrink(blob: Blob): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(blob)
  const ratio = Math.min(1, IMAGE_EDGE / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  if (!jpeg) throw new Error('Không nén được ảnh.')
  return { blob: jpeg, bytes: new Uint8Array(await jpeg.arrayBuffer()), w: canvas.width, h: canvas.height }
}

export const imageRefs = (model: DocModel): string[] => [...new Set(model.blocks.flatMap((block) => (block.t === 'images' ? block.items.map((item) => item.ref) : [])))]

/** A stored version picture is already review-sized: only its dimensions are read. */
async function fromAsset(id: string): Promise<LoadedImage | null> {
  const response = await fetch(assetUrl(id))
  if (!response.ok) return null
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const size = { w: bitmap.width, h: bitmap.height }
  bitmap.close()
  return { blob, bytes: new Uint8Array(await blob.arrayBuffer()), ...size }
}

/** Renders the slides (or fetches the stored pictures of an approved version) that the document refers to. */
export async function loadDocImages(workspace: Workspace, campaign: Campaign, model: DocModel, onProgress?: (done: number, total: number) => void): Promise<Map<string, LoadedImage>> {
  const refs = imageRefs(model)
  const out = new Map<string, LoadedImage>()
  let done = 0
  const tick = () => onProgress?.(++done, refs.length)
  // Stored pictures load in parallel; slides are drawn one after another on the canvas.
  await Promise.all(refs.filter((ref) => ref.startsWith(ASSET_REF)).map(async (ref) => {
    try { const image = await fromAsset(ref.slice(ASSET_REF.length)); if (image) out.set(ref, image) } catch { /* Left out; the text still exports. */ }
    tick()
  }))
  for (const ref of refs.filter((item) => item.startsWith(POST_REF))) {
    try {
      const post = campaign.posts.find((item) => item.id === ref.slice(POST_REF.length))
      if (post) out.set(ref, await shrink(await renderBlob(post, campaign, workspace)))
    } catch { /* A picture that cannot be drawn is left out; the text still exports. */ }
    tick()
  }
  return out
}

/** Uploads the pictures so an approved version keeps showing what was approved even after the slides change. */
export async function freezeDocument(model: DocModel, images: Map<string, LoadedImage>): Promise<DocModel> {
  const stored = new Map<string, string>()
  for (const [ref, image] of images) {
    if (!ref.startsWith(POST_REF)) continue
    stored.set(ref, `${ASSET_REF}${await api.uploadAsset('version.jpg', await readFileAsDataUrl(new File([image.blob], 'version.jpg', { type: 'image/jpeg' })))}`)
  }
  return {
    ...model,
    blocks: model.blocks.map((block): DocBlock => block.t === 'images'
      ? { t: 'images', items: block.items.filter((item) => !item.ref.startsWith(POST_REF) || stored.has(item.ref)).map((item) => ({ ...item, ref: stored.get(item.ref) ?? item.ref })) }
      : block),
  }
}

const escHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const html = (text: string) => escHtml(text).replace(/\n/g, '<br>')

const PRINT_CSS = `
@page { size: A4; margin: 16mm; }
body { font-family: 'Segoe UI', 'Be Vietnam Pro', Arial, sans-serif; color: #171a21; font-size: 11pt; line-height: 1.45; margin: 0; padding: 12px 18px; }
h1 { font-size: 22pt; margin: 0 0 10px; } h2 { font-size: 15pt; margin: 22px 0 8px; border-bottom: 1px solid #d9dde3; padding-bottom: 4px; } h3 { font-size: 12pt; margin: 14px 0 6px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 10pt; } th, td { border: 1px solid #cfd4db; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #eef0f3; } td.k { width: 24%; background: #f6f7f9; font-weight: 600; }
ul { margin: 4px 0 8px; padding-left: 22px; } p { margin: 4px 0 8px; }
.images { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; } figure { margin: 0; width: 31%; break-inside: avoid; } figure img { width: 100%; display: block; border: 1px solid #d9dde3; } figcaption { font-size: 8.5pt; color: #5d6573; margin-top: 3px; }
.break { break-before: page; }
`

/** A complete HTML page of the document. `urls` maps image references to something an <img> can load. */
export function toHtml(model: DocModel, urls: Map<string, string>): string {
  const body = model.blocks.map((block) => {
    switch (block.t) {
      case 'h': return `<h${block.level}>${html(block.text)}</h${block.level}>`
      case 'p': return `<p>${html(block.text)}</p>`
      case 'list': return `<ul>${block.items.map((item) => `<li>${html(item)}</li>`).join('')}</ul>`
      case 'table': return `<table><thead><tr>${block.head.map((cell) => `<th>${html(cell)}</th>`).join('')}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      case 'kv': return `<table><tbody>${block.rows.map(([label, value]) => `<tr><td class="k">${html(label)}</td><td>${html(value)}</td></tr>`).join('')}</tbody></table>`
      case 'images': return `<div class="images">${block.items.filter((item) => urls.has(item.ref)).map((item) => `<figure><img src="${escHtml(urls.get(item.ref)!)}" alt="${escHtml(item.caption)}"><figcaption>${html(item.caption)}</figcaption></figure>`).join('')}</div>`
      case 'break': return '<div class="break"></div>'
    }
  }).join('\n')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escHtml(model.title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`
}

/** Opens the browser's print dialog for the document; "Save as PDF" there makes the PDF. */
export async function printHtml(page: string): Promise<void> {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  await new Promise<void>((resolve) => { frame.onload = () => resolve(); frame.srcdoc = page })
  const doc = frame.contentDocument
  await Promise.all([...(doc?.images ?? [])].map((image) => image.decode().catch(() => undefined)))
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  setTimeout(() => frame.remove(), 60_000)
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, '<br>')

/** Markdown text of the document; `names` maps image references to file names (null leaves the pictures out). */
export function toMarkdown(model: DocModel, names: Map<string, string> | null): string {
  const out: string[] = []
  for (const block of model.blocks) {
    if (block.t === 'h') out.push(`${'#'.repeat(block.level)} ${block.text}`)
    else if (block.t === 'p') out.push(block.text)
    else if (block.t === 'list') out.push(block.items.map((item) => `- ${item}`).join('\n'))
    else if (block.t === 'table') out.push([`| ${block.head.map(cell).join(' | ')} |`, `| ${block.head.map(() => '---').join(' | ')} |`, ...block.rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n'))
    else if (block.t === 'kv') out.push(['| Mục | Nội dung |', '| --- | --- |', ...block.rows.map(([label, value]) => `| **${cell(label)}** | ${cell(value)} |`)].join('\n'))
    else if (block.t === 'images' && names) {
      const lines = block.items.filter((item) => names.has(item.ref)).map((item) => `![${item.caption.replace(/[[\]]/g, '')}](${names.get(item.ref)})`)
      if (lines.length) out.push(lines.join('\n\n'))
    } else if (block.t === 'break') out.push('---')
  }
  return `${out.join('\n\n')}\n`
}

/** Markdown file, or a zip with the markdown and its pictures when there are any. */
export function markdownPackage(model: DocModel, images: Map<string, LoadedImage>, base: string): { blob: Blob; name: string } {
  if (images.size === 0) return { blob: new Blob([toMarkdown(model, null)], { type: 'text/markdown;charset=utf-8' }), name: `${base}.md` }
  const names = new Map<string, string>()
  const files: Zippable = {}
  let n = 0
  for (const [ref, image] of images) {
    const name = `images/${String(++n).padStart(3, '0')}.jpg`
    names.set(ref, name)
    files[name] = [image.bytes, { level: 0 }]
  }
  files[`${base}.md`] = strToU8(toMarkdown(model, names))
  return { blob: new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), name: `${base}.zip` }
}

// ---------- Word (.docx) ----------
const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const EMU_PER_INCH = 914400
const IMAGE_WIDTH_IN = 1.95

const run = (text: string, props = '') => {
  const parts = text.split('\n').map((line) => `<w:t xml:space="preserve">${xml(line)}</w:t>`).join('<w:br/>')
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${parts}</w:r>`
}
const para = (text: string, style?: string, props = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${run(text, props)}</w:p>`

function tableXml(rows: string[][], options: { head?: string[]; firstColumnWidth?: number }): string {
  const columns = (options.head ?? rows[0] ?? []).length || 1
  const widths = options.firstColumnWidth ? [options.firstColumnWidth, 100 - options.firstColumnWidth] : Array.from({ length: columns }, () => Math.floor(100 / columns))
  const tc = (text: string, width: number, header: boolean, label: boolean) => `<w:tc><w:tcPr><w:tcW w:w="${width * 50}" w:type="pct"/>${header || label ? `<w:shd w:val="clear" w:color="auto" w:fill="${header ? 'EEF0F3' : 'F6F7F9'}"/>` : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${run(text, header || label ? '<w:b/>' : '')}</w:p></w:tc>`
  const body = [
    ...(options.head ? [`<w:tr><w:trPr><w:tblHeader/></w:trPr>${options.head.map((text, i) => tc(text, widths[i] ?? 10, true, false)).join('')}</w:tr>`] : []),
    ...rows.map((row) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((text, i) => tc(text, widths[i] ?? 10, false, Boolean(options.firstColumnWidth) && i === 0)).join('')}</w:tr>`),
  ].join('')
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CFD4DB"/><w:left w:val="single" w:sz="4" w:color="CFD4DB"/><w:bottom w:val="single" w:sz="4" w:color="CFD4DB"/><w:right w:val="single" w:sz="4" w:color="CFD4DB"/><w:insideH w:val="single" w:sz="4" w:color="CFD4DB"/><w:insideV w:val="single" w:sz="4" w:color="CFD4DB"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width * 90}"/>`).join('')}</w:tblGrid>${body}</w:tbl><w:p/>`
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="260"/><w:spacing w:after="40"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="5D6573"/><w:sz w:val="16"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`

/** A Word file (.docx) built by hand: headings, tables, lists and the slide pictures. */
export function toDocx(model: DocModel, images: Map<string, LoadedImage>): Uint8Array {
  const media: Record<string, Uint8Array> = {}
  const rels: string[] = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>']
  const relId = new Map<string, string>()
  let nextImage = 0
  const picture = (ref: string, image: LoadedImage, caption: string) => {
    let id = relId.get(ref)
    if (!id) {
      nextImage += 1
      id = `rId${nextImage + 1}`
      relId.set(ref, id)
      media[`word/media/image${nextImage}.jpg`] = image.bytes
      rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${nextImage}.jpg"/>`)
    }
    const cx = Math.round(IMAGE_WIDTH_IN * EMU_PER_INCH)
    const cy = Math.round((cx * image.h) / image.w)
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="114300"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${nextImage + 100}" name="${xml(caption).slice(0, 60)}" descr="${xml(caption)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${nextImage}" name="image${nextImage}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  }

  const body = model.blocks.map((block) => {
    switch (block.t) {
      case 'h': return para(block.text, `Heading${block.level}`)
      case 'p': return para(block.text)
      case 'list': return block.items.map((item) => para(`•  ${item}`, 'ListBullet')).join('')
      case 'table': return tableXml(block.rows, { head: block.head })
      case 'kv': return tableXml(block.rows.map(([label, value]) => [label, value]), { firstColumnWidth: 24 })
      case 'images': {
        const shown = block.items.filter((item) => images.has(item.ref))
        if (shown.length === 0) return ''
        const pictures = `<w:p>${shown.map((item) => picture(item.ref, images.get(item.ref)!, item.caption)).join('')}</w:p>`
        return `${pictures}<w:p>${shown.map((item, i) => run(`${i ? '   ' : ''}${item.caption.slice(0, 40)}`, '<w:color w:val="5D6573"/><w:sz w:val="16"/>')).join('')}</w:p>`
      }
      case 'break': return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    }
  }).join('')

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const files: Zippable = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(document),
    'word/styles.xml': strToU8(STYLES),
    'word/_rels/document.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`),
  }
  for (const [name, bytes] of Object.entries(media)) files[name] = [bytes, { level: 0 }]
  return zipSync(files)
}
