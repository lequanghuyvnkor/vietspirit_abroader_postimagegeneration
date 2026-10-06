import { formatForSize, parseGuideline, type Extracted, type TextItem } from './guideline.ts'
import type { FormatKey } from './types.ts'

export type PdfPage = {
  index: number
  width: number
  height: number
  /** Post size this page matches, or null for guideline/other pages. */
  format: FormatKey | null
  dataUrl: string
  luminance: number
}

export type PdfAnalysis = {
  title: string
  pages: PdfPage[]
  extracted: Extracted
  /** HEX colors sampled from the sample posts, used when the text layer has none. */
  sampledColors: string[]
}

const MAX_EDGE = 1800

function sampleColors(canvas: HTMLCanvasElement): { luminance: number; colors: Map<string, number> } {
  const size = 48
  const small = document.createElement('canvas')
  small.width = size
  small.height = size
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  const colors = new Map<string, number>()
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    const key = [data[i], data[i + 1], data[i + 2]].map((value) => Math.min(255, Math.round(value / 32) * 32).toString(16).padStart(2, '0')).join('')
    colors.set(key, (colors.get(key) ?? 0) + 1)
  }
  return { luminance: sum / (size * size), colors }
}

/** Reads a key visual PDF: renders every page and parses the guideline text layer. Runs in the browser. */
export async function analyzePdf(file: File): Promise<PdfAnalysis> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const meta = await doc.getMetadata().catch(() => null)
  const info = meta?.info as { Title?: string } | undefined

  const pages: PdfPage[] = []
  const textPages: TextItem[][] = []
  const totals = new Map<string, number>()
  for (let index = 1; index <= doc.numPages; index++) {
    const page = await doc.getPage(index)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(2, MAX_EDGE / Math.max(base.width, base.height)) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport, intent: 'print' }).promise // 'print' avoids requestAnimationFrame, which stalls in background tabs
    const format = formatForSize(base.width, base.height)
    const sampled = sampleColors(canvas)
    if (format) sampled.colors.forEach((count, key) => totals.set(key, (totals.get(key) ?? 0) + count))
    pages.push({ index, width: base.width, height: base.height, format, dataUrl: canvas.toDataURL('image/webp', 0.9), luminance: sampled.luminance })
    const content = await page.getTextContent()
    textPages.push((content.items as { str?: string; transform: number[]; height: number }[]).filter((item) => typeof item.str === 'string').map((item) => ({ str: item.str!, x: item.transform[4], y: item.transform[5], height: item.height })))
  }

  const sampledColors = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => `#${key}`.toUpperCase())
  const title = (info?.Title ?? '').replace(/^key\s*visual\s*[—–-]\s*/i, '').trim() || file.name.replace(/\.pdf$/i, '').replace(/^key\s*visual\s*[—–-]\s*/i, '').trim()
  return { title, pages, extracted: parseGuideline(textPages), sampledColors }
}
