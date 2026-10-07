import { strToU8, zipSync } from 'fflate'
import { renderBlob, renderPost } from './render.ts'
import { applyVars } from './text.ts'
import { sceneDuration } from './video.ts'
import type { Campaign, Piece, Post, Workspace } from './types.ts'

type Timed = { post: Post; start: number; end: number }

function timeline(scenes: Post[]): Timed[] {
  let cursor = 0
  return scenes.map((post) => { const start = cursor; cursor += sceneDuration(post); return { post, start, end: cursor } })
}

const fmt = (seconds: number) => `${Math.round(seconds * 10) / 10}`
const screenText = (post: Post) => [post.eyebrow, post.headline, post.accent, post.subtitle].filter(Boolean).join(' · ')

/** One image with every scene side by side and its timecode, for a quick read of the whole reel. */
async function contactSheet(timed: Timed[], campaign: Campaign, workspace: Workspace, piece: Piece): Promise<Blob> {
  const cols = Math.min(timed.length, 4)
  const rows = Math.ceil(timed.length / cols)
  const cellW = 300, cellH = 533, label = 96, gap = 24, head = 90
  const sheet = document.createElement('canvas')
  sheet.width = gap + cols * (cellW + gap)
  sheet.height = head + rows * (cellH + label + gap) + gap
  const ctx = sheet.getContext('2d')!
  ctx.fillStyle = '#0e1220'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 30px "Be Vietnam Pro", sans-serif'
  ctx.fillText(`${piece.code} · ${piece.title}`, gap, 48)
  ctx.fillStyle = '#9aa3b8'
  ctx.font = '400 20px "Be Vietnam Pro", sans-serif'
  ctx.fillText(`Storyboard · ${timed.length} cảnh · ${fmt(timed.at(-1)?.end ?? 0)}s · 1080×1920`, gap, 76)
  for (const [index, item] of timed.entries()) {
    const x = gap + (index % cols) * (cellW + gap)
    const y = head + Math.floor(index / cols) * (cellH + label + gap)
    const frame = document.createElement('canvas')
    await renderPost(frame, item.post, campaign, workspace)
    ctx.drawImage(frame, x, y, cellW, cellH)
    ctx.strokeStyle = '#2b3350'
    ctx.strokeRect(x - 0.5, y - 0.5, cellW + 1, cellH + 1)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 20px "Be Vietnam Pro", sans-serif'
    ctx.fillText(`Cảnh ${index + 1} · ${fmt(item.start)}–${fmt(item.end)}s`, x, y + cellH + 28)
    ctx.fillStyle = '#9aa3b8'
    ctx.font = '400 17px "Be Vietnam Pro", sans-serif'
    const words = applyVars(screenText(item.post), campaign.variables).split(' ')
    let line = ''
    let row = 0
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > cellW && line) { ctx.fillText(line, x, y + cellH + 54 + row * 22); line = word; row++; if (row > 1) break } else line = next
    }
    if (row <= 1 && line) ctx.fillText(line, x, y + cellH + 54 + row * 22)
  }
  const blob = await new Promise<Blob | null>((resolve) => sheet.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Không tạo được bảng storyboard.')
  return blob
}

/** The written script: one row per scene with its timing, on-screen text and the plan's notes. */
function script(timed: Timed[], campaign: Campaign, piece: Piece): string {
  const fill = (text: string) => applyVars(text, campaign.variables)
  return [
    `# ${piece.code} · ${piece.title}: storyboard`,
    `${piece.plan.format} · ${piece.plan.funnel} · ${piece.plan.pillar}. Tổng ${fmt(timed.at(-1)?.end ?? 0)}s.`,
    '',
    '| Cảnh | Thời gian | Chữ trên màn hình | CTA |',
    '|---|---|---|---|',
    ...timed.map((item, index) => `| ${index + 1} | ${fmt(item.start)}–${fmt(item.end)}s | ${fill(screenText(item.post)).replace(/\|/g, '/')} | ${fill(item.post.cta).replace(/\|/g, '/')} |`),
    '',
    '## Hướng dẫn hình ảnh và chuyển động (theo kế hoạch)',
    piece.visual.hero && `- **Hero visual:** ${piece.visual.hero}`,
    piece.visual.layout && `- **Bố cục:** ${piece.visual.layout}`,
    piece.visual.motion && `- **Chuyển động:** ${piece.visual.motion}`,
    piece.visual.typography && `- **Typography:** ${piece.visual.typography}`,
    piece.visual.palette && `- **Palette:** ${piece.visual.palette}`,
    piece.visual.avoid && `- **Tránh:** ${piece.visual.avoid}`,
    '',
    '## Caption và hashtag',
    fill(piece.caption) || '(chưa có)',
    '',
    piece.hashtags,
    '',
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n')
}

/** Zip: a PNG per scene, the contact sheet, and the script. */
export async function buildStoryboard(workspace: Workspace, campaign: Campaign, piece: Piece, scenes: Post[]): Promise<Blob> {
  const timed = timeline(scenes)
  const files: Record<string, Uint8Array> = {}
  for (const [index, item] of timed.entries()) {
    files[`${piece.code}-canh-${String(index + 1).padStart(2, '0')}-${fmt(item.start)}-${fmt(item.end)}s.png`] = new Uint8Array(await (await renderBlob(item.post, campaign, workspace)).arrayBuffer())
  }
  files[`${piece.code}-storyboard.png`] = new Uint8Array(await (await contactSheet(timed, campaign, workspace, piece)).arrayBuffer())
  files[`${piece.code}-kich-ban.md`] = strToU8(script(timed, campaign, piece))
  return new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' })
}
