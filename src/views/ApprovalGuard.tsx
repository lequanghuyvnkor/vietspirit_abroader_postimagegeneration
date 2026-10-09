import { useEffect } from 'react'
import { contentFingerprint, revokeStaleApprovals } from '../lib/review.ts'
import { now } from '../lib/types.ts'
import type { Store } from '../lib/types.ts'

type Props = {
  store: Store
  update: (change: (draft: Store) => void) => void
  onNotice: (message: string) => void
}

/** Watches the data: an approved piece whose content no longer matches what was approved goes back to review. */
export function ApprovalGuard({ store, update, onNotice }: Props) {
  useEffect(() => {
    const stale = store.workspaces.some((workspace) => workspace.campaigns.some((campaign) => campaign.pieces.some((piece) => piece.status === 'ready' && piece.approval && piece.approval.fingerprint !== contentFingerprint(campaign, piece))))
    if (!stale) return
    const codes: string[] = []
    update((draft) => {
      for (const workspace of draft.workspaces) for (const campaign of workspace.campaigns) {
        const revoked = revokeStaleApprovals(campaign)
        if (revoked.length) { codes.push(...revoked); campaign.updatedAt = now() }
      }
    })
    if (codes.length) onNotice(`Đã sửa sau khi duyệt: ${codes.join(', ')} quay về "Chờ duyệt".`)
  }, [store, update, onNotice])
  return null
}
