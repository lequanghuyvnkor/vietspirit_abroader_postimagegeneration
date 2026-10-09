/** Text boxes that hold a typed value not yet handed to the app register here so leaving the page can commit them first. */
const flushers = new Set<() => void>()

export function registerFlusher(flush: () => void): () => void {
  flushers.add(flush)
  return () => { flushers.delete(flush) }
}

/** Commits every pending text box; returns true when there was anything to commit. */
export function flushAllInputs(): boolean {
  const had = flushers.size > 0
  for (const flush of [...flushers]) flush()
  return had
}
