import { campaignWindow } from './foundation.ts'
import { pieceTexts } from './plan.ts'
import { unresolvedIn } from './text.ts'
import type { Campaign, Piece } from './types.ts'

export type PlanIssue = { text: string; level: 'warn' | 'info' }

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** Problems in one piece of the plan that are cheaper to fix now than after images are made. */
export function pieceIssues(campaign: Campaign, piece: Piece): PlanIssue[] {
  const out: PlanIssue[] = []
  const window = campaignWindow(campaign)
  if (!piece.date) out.push({ text: 'Chưa có ngày đăng', level: 'warn' })
  else if (window && (piece.date < window.start || piece.date > window.end)) out.push({ text: 'Ngày đăng ngoài kỳ chiến dịch', level: 'warn' })
  if (!piece.plan.hook.trim()) out.push({ text: 'Thiếu hook', level: 'warn' })
  if (!piece.plan.cta.trim()) out.push({ text: 'Thiếu CTA', level: 'info' })
  if (!piece.caption.trim()) out.push({ text: 'Chưa có caption', level: 'info' })
  const missing = new Set(pieceTexts(campaign, piece).flatMap((text) => unresolvedIn(text, campaign.variables)))
  if (missing.size) out.push({ text: `${missing.size} biến chưa có giá trị`, level: 'warn' })
  if (piece.kind === 'reel' && piece.production === 'external' && !piece.productionNote.trim()) out.push({ text: 'Reel bên ngoài chưa có ghi chú bàn giao', level: 'info' })
  campaign.posts.filter((post) => post.pieceId === piece.id && !post.excluded).forEach((post, index) => {
    if (words(post.headline) > 10) out.push({ text: `Slide ${index + 1}: tiêu đề ${words(post.headline)} từ (nên ≤ 8)`, level: 'info' })
    if (words(post.subtitle) > 30) out.push({ text: `Slide ${index + 1}: câu dẫn ${words(post.subtitle)} từ (nên ≤ 22), sẽ bị cắt trên ảnh`, level: 'warn' })
  })
  return out
}

/** The next thing to do for a piece, by status. */
export function nextStep(piece: Piece): string {
  if (piece.kind === 'reel' && piece.production === 'external') return 'Theo dõi bàn giao'
  return { brief: 'Soạn chữ', copy: 'Tạo hình', visual: 'Gửi duyệt', review: 'Duyệt và xác nhận', ready: 'Sẵn sàng đăng' }[piece.status]
}
