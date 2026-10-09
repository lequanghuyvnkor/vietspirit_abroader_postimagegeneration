import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api.ts'
import { flushAllInputs } from './unsaved.ts'
import { defaultProductionNote, guessProduction, scheduleWindow } from './plan.ts'
import { emptyPiece } from './planEdit.ts'
import type { Store } from './types.ts'

/** Fills fields added after data was first saved. */
function normalize(store: Store): Store {
  for (const workspace of store.workspaces) {
    for (const campaign of workspace.campaigns) {
      campaign.sources ??= []
      campaign.components ??= []
      campaign.pieces ??= []
      campaign.variables ??= {}
      campaign.strategy ??= ''
      campaign.guardrailNotes ??= []
      campaign.guardrails ??= []
      if (!campaign.foundation) {
        const window = scheduleWindow(campaign.strategy)
        campaign.foundation = { objective: '', start: window?.start ?? '', end: window?.end ?? '', kpis: [], audiences: [], bigIdea: '', keyMessage: '', pillars: [], tone: '', dos: [] }
      }
      campaign.keyVisual.subjectIds ??= []
      campaign.keyVisual.sampleIds ??= []
      for (const piece of campaign.pieces) {
        // Fill anything missing or damaged so one bad record cannot break a whole screen.
        const blank = emptyPiece(piece.code ?? '', piece.kind ?? 'static')
        piece.plan = { ...blank.plan, ...(piece.plan ?? {}) }
        piece.visual = { ...blank.visual, ...(piece.visual ?? {}) }
        piece.checks ??= []
        piece.caption ??= ''
        piece.hashtags ??= ''
        piece.compliance ??= ''
        piece.title ??= ''
        piece.date ??= ''
        piece.status ??= 'brief'
        piece.assets ??= []
        piece.production ??= piece.kind === 'reel' ? guessProduction(piece.visual) : 'internal'
        piece.productionNote ??= defaultProductionNote(piece.production)
      }
      for (const post of campaign.posts) post.layers ??= []
    }
  }
  return store
}

export type SaveState = 'saved' | 'saving' | 'error' | 'conflict'

/** Loads the store from the local server and saves every change back, debounced. */
export function useStore() {
  const [store, setStore] = useState<Store | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [loadError, setLoadError] = useState('')
  const pending = useRef<Store | null>(null)
  const timer = useRef<number>(0)
  const frozen = useRef(false)
  const inflight = useRef(0)

  useEffect(() => {
    api.loadStore().then((loaded) => setStore(normalize(loaded))).catch((error: Error) => setLoadError(error.message))
  }, [])

  const flush = useCallback(async function run() {
    const next = pending.current
    // One save at a time: a second save would carry the revision from before the first one finished and look like a conflict.
    if (!next || frozen.current || inflight.current > 0) return
    pending.current = null
    inflight.current += 1
    try { await api.saveStore(next); setSaveState(pending.current ? 'saving' : 'saved') }
    catch (error) {
      // 409: another window saved newer data. Stop saving from this one so it cannot overwrite that work.
      if (error instanceof ApiError && error.status === 409) { frozen.current = true; pending.current = null; setSaveState('conflict') }
      else setSaveState('error')
    }
    finally {
      inflight.current -= 1
      if (pending.current && !frozen.current) window.setTimeout(() => { void run() }, 0)
    }
  }, [])

  const update = useCallback((change: (draft: Store) => void) => {
    setStore((current) => {
      if (!current) return current
      const next = structuredClone(current)
      change(next)
      pending.current = next
      setSaveState('saving')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { void flush() }, 300)
      return next
    })
  }, [flush])

  useEffect(() => {
    // Hiding the tab: hand over typed text, then save right away while the page is still alive.
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return
      flushAllInputs()
      window.setTimeout(() => { if (pending.current) void flush() }, 0)
    }
    // Closing or reloading with unsaved text would lose it (a save started during unload is cancelled): ask first.
    const onUnload = (event: BeforeUnloadEvent) => {
      const typing = flushAllInputs()
      if (typing || pending.current || inflight.current > 0) { event.preventDefault(); event.returnValue = '' }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('beforeunload', onUnload) }
  }, [flush])

  /** Saves anything pending, then blocks further saves (used right before a restore replaces the data). */
  const freeze = useCallback(async () => {
    window.clearTimeout(timer.current)
    await flush()
    frozen.current = true
    pending.current = null
  }, [flush])

  return { store, update, saveState, loadError, freeze }
}
