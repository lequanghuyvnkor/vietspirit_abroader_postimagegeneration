import { createContext, useContext } from 'react'

export type SyncStatus = { busy: boolean; message: string }

export type DocsSyncApi = {
  /** Last message per campaign id. */
  status: Record<string, SyncStatus>
  /** Pieces whose Docs tab is out of date, per campaign id. */
  pending: Record<string, number>
  /** Pushes the changed pieces (or every piece with `force`) of one campaign now. */
  pushNow: (workspaceId: string, campaignId: string, force: boolean) => Promise<void>
}

export const DocsSyncContext = createContext<DocsSyncApi>({ status: {}, pending: {}, pushNow: async () => {} })

export const useDocsSync = () => useContext(DocsSyncContext)
