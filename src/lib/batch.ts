import { useState } from 'react'
import type { ApiKey } from './api.ts'
import { applyDraft, attachBackground, fetchDraft, generatePieceBackground } from './draft.ts'
import type { Campaign, Piece, Workspace } from './types.ts'

export type Job = { label: string; done: number; total: number; failures: string[] }

/** Batch AI steps shared by the plan and production tabs; lives in the campaign page so a run survives a tab switch. */
export function useBatch(workspace: Workspace, campaign: Campaign, edit: (change: (draft: Campaign) => void) => void, keys: ApiKey[]) {
  const [job, setJob] = useState<Job | null>(null)
  const [keyId, setKeyId] = useState('')
  const activeKey = keys.find((entry) => entry.id === keyId) ?? keys.find((entry) => entry.isDefault) ?? keys[0]
  const running = job !== null && job.done < job.total

  /** Runs one step per piece in order; a failure on one piece does not stop the rest. */
  async function run(label: string, pieces: Piece[], step: (piece: Piece) => Promise<void>) {
    const failures: string[] = []
    setJob({ label, done: 0, total: pieces.length, failures })
    for (const [index, piece] of pieces.entries()) {
      try { await step(piece) } catch (error) { failures.push(`${piece.code}: ${error instanceof Error ? error.message : 'lỗi'}`) }
      setJob({ label, done: index + 1, total: pieces.length, failures: [...failures] })
    }
  }

  const draftAll = (pieces: Piece[], context: Campaign = campaign) => run('Soạn chữ bằng AI', pieces, async (piece) => {
    const draft = await fetchDraft(workspace, context, piece, activeKey?.id)
    edit((draftCampaign) => applyDraft(draftCampaign, piece.id, draft, workspace.company))
  })

  const backgroundsAll = (pieces: Piece[]) => run('Tạo nền', pieces, async (piece) => {
    const result = await generatePieceBackground(workspace, campaign, piece, activeKey?.id)
    edit((draftCampaign) => attachBackground(draftCampaign, piece.id, result))
  })

  return { job, setJob, running, activeKey, setKeyId, draftAll, backgroundsAll }
}

export type Batch = ReturnType<typeof useBatch>

