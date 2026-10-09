import { docIdOf } from './docsSync.ts'
import type { Campaign, Store, Workspace } from './types.ts'

/** The Apps Script id inside a Sheet bridge URL: two campaigns with the same one read the very same Google Sheet. */
export const sheetKey = (url: string): string => url.match(/\/macros\/s\/([\w-]+)/)?.[1] ?? ''

export type LinkKind = 'sheet' | 'docs'

function keyOf(campaign: Campaign, kind: LinkKind): string {
  if (kind === 'sheet') return campaign.sheetSync ? sheetKey(campaign.sheetSync.url) : ''
  return campaign.docsSync?.doc ? docIdOf(campaign.docsSync.doc) : ''
}

export type Owner = { workspace: Workspace; campaign: Campaign }

/** Another campaign (in any workspace) already linked to the same Google Sheet or Doc, if any. */
export function otherOwner(store: Store, campaignId: string, kind: LinkKind, url: string): Owner | null {
  const key = kind === 'sheet' ? sheetKey(url) : url.trim() ? docIdOf(url) : ''
  if (!key) return null
  for (const workspace of store.workspaces) {
    for (const campaign of workspace.campaigns) {
      if (campaign.id !== campaignId && keyOf(campaign, kind) === key) return { workspace, campaign }
    }
  }
  return null
}

/** True while a campaign shares its Sheet/Doc with another one and the user has not said that is on purpose. */
export function linkBlocked(store: Store, campaign: Campaign, kind: LinkKind): Owner | null {
  const settings = kind === 'sheet' ? campaign.sheetSync : campaign.docsSync
  if (!settings || settings.allowShared) return null
  return otherOwner(store, campaign.id, kind, kind === 'sheet' ? campaign.sheetSync!.url : campaign.docsSync!.doc)
}

export type Issue = {
  id: string
  level: 'warn' | 'info'
  text: string
  workspaceId: string
  campaignId: string
  /** What the "fix" button does for this campaign. */
  fix?: 'detachSheet' | 'detachDocs'
  fixLabel?: string
  /** Which shared link the "on purpose" button confirms. */
  allow?: LinkKind
}

const titleKey = (campaign: Campaign) => new Set(campaign.pieces.map((piece) => `${piece.code}|${piece.title.trim().toLowerCase()}`).filter((key) => !key.endsWith('|')))

/** Looks for signs that one project's data leaked into another: shared Sheet/Doc links and look-alike plans in different workspaces. */
export function findIssues(store: Store): Issue[] {
  const issues: Issue[] = []
  const all = store.workspaces.flatMap((workspace) => workspace.campaigns.map((campaign) => ({ workspace, campaign })))
  for (const kind of ['sheet', 'docs'] as const) {
    for (const { workspace, campaign } of all) {
      const other = linkBlocked(store, campaign, kind)
      if (!other) continue
      issues.push({
        id: `${kind}-${campaign.id}`, level: 'warn', workspaceId: workspace.id, campaignId: campaign.id,
        text: `"${campaign.name}" (${workspace.name}) dùng chung ${kind === 'sheet' ? 'Google Sheet' : 'Google Docs'} với "${other.campaign.name}" (${other.workspace.name}). Mỗi chiến dịch cần ${kind === 'sheet' ? 'một Sheet' : 'một Docs'} riêng, nếu không bài của hai bên sẽ lẫn vào nhau.`,
        allow: kind,
        ...(kind === 'sheet' ? { fix: 'detachSheet' as const, fixLabel: 'Gỡ dữ liệu Sheet khỏi chiến dịch này' } : { fix: 'detachDocs' as const, fixLabel: 'Ngắt kết nối Docs của chiến dịch này' }),
      })
    }
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j]
      if (a.workspace.id === b.workspace.id) continue
      const keys = titleKey(b.campaign)
      const shared = [...titleKey(a.campaign)].filter((key) => keys.has(key)).length
      if (shared >= 3) {
        issues.push({
          id: `plan-${a.campaign.id}-${b.campaign.id}`, level: 'info', workspaceId: b.workspace.id, campaignId: b.campaign.id,
          text: `${shared} bài trong "${b.campaign.name}" (${b.workspace.name}) giống hệt bài của "${a.campaign.name}" (${a.workspace.name}): cùng mã và tiêu đề. Nếu không chủ ý nhân bản, đây có thể là dữ liệu bị lẫn.`,
        })
      }
    }
  }
  return issues.filter((issue) => !all.find((entry) => entry.campaign.id === issue.campaignId)?.campaign.ignoredIssues?.includes(issue.id))
}

/**
 * Removes what a Sheet pull put into a campaign: the pieces that came from the Sheet with their slides, the strategy and
 * "do not say" notes the Sheet wrote, and the connection itself. Work the user created in the app (pieces without a Sheet link) stays.
 */
export function detachSheetData(campaign: Campaign): { pieces: number; posts: number } {
  const linked = new Set(campaign.pieces.filter((piece) => piece.sheetBase?.linked).map((piece) => piece.id))
  const posts = campaign.posts.filter((post) => post.pieceId && linked.has(post.pieceId)).length
  campaign.posts = campaign.posts.filter((post) => !(post.pieceId && linked.has(post.pieceId)))
  campaign.pieces = campaign.pieces.filter((piece) => !linked.has(piece.id))
  if (campaign.sheetSync?.pulledAt) { campaign.strategy = ''; campaign.guardrailNotes = [] }
  delete campaign.sheetSync
  return { pieces: linked.size, posts }
}
