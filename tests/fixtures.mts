import { emptyPiece } from '../src/lib/planEdit.ts'
import { draftSlides } from '../src/lib/plan.ts'
import { emptyCompany, newCampaign, newId, now } from '../src/lib/types.ts'
import type { Campaign, Piece, PieceKind, Store, Workspace } from '../src/lib/types.ts'

export function makePiece(code: string, title: string, over: Partial<Piece> & { kind?: PieceKind; funnel?: string; pillar?: string } = {}): Piece {
  const piece = emptyPiece(code, over.kind ?? 'carousel')
  piece.title = title
  piece.plan.hook = title
  piece.plan.cta = 'Nhắn tư vấn'
  piece.plan.funnel = over.funnel ?? 'TOFU'
  piece.plan.pillar = over.pillar ?? ''
  piece.plan.structure = 'S1: mở đầu; S2: nội dung; S3: CTA'
  piece.caption = `Caption của ${title}`
  const { kind: _kind, funnel: _funnel, pillar: _pillar, ...rest } = over
  return Object.assign(piece, rest)
}

export function makeCampaign(name: string, titles: string[], opts: { start?: string; end?: string } = {}): Campaign {
  const campaign = newCampaign(name)
  campaign.foundation.start = opts.start ?? '2026-10-07'
  campaign.foundation.end = opts.end ?? '2026-10-21'
  campaign.foundation.pillars = [
    { id: newId(), name: 'Đồng hành chuyên môn (Mentor-led)', message: 'm', proof: '' },
    { id: newId(), name: 'Thông tin minh bạch', message: 'm', proof: '' },
  ]
  campaign.pieces = titles.map((title, index) => makePiece(`P${String(index + 1).padStart(2, '0')}`, title))
  return campaign
}

export function withSlides(workspace: Workspace, campaign: Campaign): void {
  for (const piece of campaign.pieces) campaign.posts.push(...draftSlides(piece, workspace.company, campaign.backgrounds))
}

export function makeWorkspace(name: string, campaigns: Campaign[] = []): Workspace {
  return { id: newId(), name, company: emptyCompany(name), campaigns, updatedAt: now() }
}

export const makeStore = (...workspaces: Workspace[]): Store => ({ workspaces })
