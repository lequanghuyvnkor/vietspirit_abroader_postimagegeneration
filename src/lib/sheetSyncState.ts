import { createContext, useContext } from 'react'
import type { MergeReport } from './sheetSync.ts'

export type SheetStatus = { busy: boolean; message: string }

/** What a first pull would do, shown before anything is changed. */
export type PullPreview = { report: MergeReport; pieces: number; strategyChars: number; replacesStrategy: boolean; existingPieces: number }

export type SheetSyncApi = {
  /** Last message per campaign id. */
  status: Record<string, SheetStatus>
  /** Campaigns whose Sheet is also used by another campaign (and not confirmed as on purpose): who the other one is. */
  conflicts: Record<string, { campaign: string; workspace: string }>
  /** Reads the Sheet now and merges it into the campaign. The first pull of a campaign needs `confirmed` (after the preview). */
  pull: (workspaceId: string, campaignId: string, confirmed?: boolean) => Promise<void>
  /** Reads the Sheet and reports what a pull would change, without changing anything. */
  preview: (workspaceId: string, campaignId: string) => Promise<PullPreview>
}

export const SheetSyncContext = createContext<SheetSyncApi>({ status: {}, conflicts: {}, pull: async () => {}, preview: async () => { throw new Error('Chưa sẵn sàng.') } })

export const useSheetSync = () => useContext(SheetSyncContext)
