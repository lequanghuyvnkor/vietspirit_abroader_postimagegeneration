import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { defaultProductionNote, guessProduction, scheduleWindow } from './plan.ts'
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
        piece.assets ??= []
        piece.production ??= piece.kind === 'reel' ? guessProduction(piece.visual) : 'internal'
        piece.productionNote ??= defaultProductionNote(piece.production)
      }
      for (const post of campaign.posts) post.layers ??= []
    }
  }
  return store
}

export type SaveState = 'saved' | 'saving' | 'error'

/** Loads the store from the local server and saves every change back, debounced. */
export function useStore() {
  const [store, setStore] = useState<Store | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [loadError, setLoadError] = useState('')
  const pending = useRef<Store | null>(null)
  const timer = useRef<number>(0)
  const frozen = useRef(false)

  useEffect(() => {
    api.loadStore().then((loaded) => setStore(normalize(loaded))).catch((error: Error) => setLoadError(error.message))
  }, [])

  const flush = useCallback(async () => {
    const next = pending.current
    if (!next || frozen.current) return
    pending.current = null
    try { await api.saveStore(next); setSaveState(pending.current ? 'saving' : 'saved') }
    catch { setSaveState('error') }
  }, [])

  const update = useCallback((change: (draft: Store) => void) => {
    setStore((current) => {
      if (!current) return current
      const next = structuredClone(current)
      change(next)
      pending.current = next
      setSaveState('saving')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { void flush() }, 500)
      return next
    })
  }, [flush])

  useEffect(() => {
    const onHide = () => { if (pending.current) void flush() }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
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
