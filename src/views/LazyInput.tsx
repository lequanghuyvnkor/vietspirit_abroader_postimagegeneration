import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
  /** Milliseconds of quiet typing before the change is handed to the app. */
  delay?: number
}

/**
 * A text box for long lists: typing only updates this box, and the app is told once typing pauses (or on leaving the box).
 * Without it every keystroke in a 150-row table re-renders the whole page.
 */
export function LazyInput({ value, onCommit, delay = 300, onBlur, onFocus, ...rest }: Props) {
  const [local, setLocal] = useState(value)
  const focused = useRef(false)
  const pending = useRef<string | null>(null)
  const timer = useRef(0)
  const commit = useRef(onCommit)
  useEffect(() => { commit.current = onCommit })

  useEffect(() => { if (!focused.current && pending.current === null) setLocal(value) }, [value])

  function flush() {
    window.clearTimeout(timer.current)
    if (pending.current !== null) { const next = pending.current; pending.current = null; commit.current(next) }
  }
  useEffect(() => flush, [])

  return <input {...rest} value={local}
    onChange={(event) => {
      setLocal(event.target.value)
      pending.current = event.target.value
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    }}
    onFocus={(event) => { focused.current = true; onFocus?.(event) }}
    onBlur={(event) => { focused.current = false; flush(); onBlur?.(event) }} />
}
