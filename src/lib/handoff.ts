import { applyVars, unresolvedIn } from './text.ts'
import type { Campaign, Piece } from './types.ts'

/** "0–5s: deadline. 5–12s: ai nên gửi…" -> one line per timed beat, or null when the text has no timecodes. */
function timedBeats(text: string): string[] | null {
  const parts = [...text.matchAll(/(\d+\s*[–-]\s*\d+\s*s)\b\s*:?\s*([\s\S]*?)(?=[;.]?\s*\d+\s*[–-]\s*\d+\s*s\b|$)/g)].map((match) => `${match[1].replace(/\s+/g, '')}: ${match[2].replace(/[.;\s]+$/, '').trim()}`).filter((beat) => !beat.endsWith(': '))
  return parts.length ? parts : null
}

/** The plan sometimes keeps the timed beats in "Cấu trúc nội dung" and sometimes in "Bố cục"; use whichever has them. */
function beats(structure: string, layout: string): string[] {
  return timedBeats(structure) ?? timedBeats(layout) ?? (structure ? [structure] : [])
}

const line = (label: string, value: string) => (value.trim() ? `- **${label}:** ${value.trim()}` : '')

/** A hand-off brief for a piece produced by someone else (a reel with people): everything the plan says about it. */
export function buildHandoff(campaign: Campaign, piece: Piece): string {
  const fill = (text: string) => applyVars(text, campaign.variables)
  const open = piece.checks.filter((check) => !check.done)
  const missing = [...new Set([piece.caption, piece.plan.cta, piece.visual.onImage].flatMap((text) => unresolvedIn(text, campaign.variables)))]
  return [
    `# ${piece.code} · ${piece.title}`,
    `${piece.plan.format} · ${piece.plan.funnel} · ${piece.plan.pillar}`,
    '',
    '## Thông tin chung',
    line('Ngày đăng', piece.date ? `${piece.date} ${piece.plan.time}`.trim() : `chưa xếp lịch ${piece.plan.time}`.trim()),
    line('Bên sản xuất', piece.production === 'external' ? 'Bên ngoài (có người)' : 'Nội bộ'),
    line('Ghi chú bàn giao', piece.productionNote),
    line('Mục tiêu', piece.plan.goal),
    line('Đối tượng', piece.plan.audience),
    line('Hook / tiêu đề', piece.plan.hook),
    line('CTA', fill(piece.plan.cta)),
    '',
    '## Cấu trúc theo mốc thời gian',
    ...beats(piece.plan.structure, piece.visual.layout).map((beat) => `- ${fill(beat)}`),
    line('Story hỗ trợ', piece.plan.story),
    '',
    '## Visual brief',
    line('Hero visual', piece.visual.hero),
    line('Bố cục', piece.visual.layout),
    line('Typography', piece.visual.typography),
    line('Palette', piece.visual.palette),
    line('Chữ trên hình', fill(piece.visual.onImage)),
    line('Chuyển động', piece.visual.motion),
    line('Tránh', piece.visual.avoid),
    '',
    '## Tài nguyên cần chuẩn bị',
    ...piece.assets.map((asset) => `- [${asset.done ? 'x' : ' '}] ${asset.label}${asset.note ? ` — ${asset.note}` : ''}${asset.assetId ? ' (đã có ảnh trong hệ thống)' : ''}`),
    '',
    '## Caption và hashtag',
    fill(piece.caption) || '(chưa có)',
    '',
    piece.hashtags,
    '',
    '## Điều kiện trước khi đăng',
    ...piece.checks.map((check) => `- [${check.done ? 'x' : ' '}] ${check.text} (${check.owner})`),
    '',
    piece.compliance ? `Lưu ý duyệt: ${piece.compliance}` : '',
    missing.length ? `\n⚠ Còn chỗ trống chưa điền: ${missing.map((key) => `[${key}]`).join(', ')}` : '',
    open.length ? `\n⚠ Còn ${open.length} mục duyệt chưa xong.` : '',
  ].filter((text, index, all) => text !== '' || all[index - 1] !== '').join('\n') + '\n'
}
