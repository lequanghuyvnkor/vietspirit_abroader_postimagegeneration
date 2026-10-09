import { createContext, useContext } from 'react'

export type SheetStatus = { busy: boolean; message: string }

export type SheetSyncApi = {
  /** Last message per campaign id. */
  status: Record<string, SheetStatus>
  /** Reads the Sheet now and merges it into the campaign. */
  pull: (workspaceId: string, campaignId: string) => Promise<void>
}

export const SheetSyncContext = createContext<SheetSyncApi>({ status: {}, pull: async () => {} })

export const useSheetSync = () => useContext(SheetSyncContext)
