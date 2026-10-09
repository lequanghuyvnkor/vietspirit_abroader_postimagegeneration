import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { registerFlusher } from '../lib/unsaved.ts'
import type { Campaign } from '../lib/types.ts'
import { LazyInput } from './LazyInput.tsx'

export type CellKind = 'text' | 'long' | 'date' | 'select' | 'static' | 'number'

export type Col<T> = {
  key: string
  label: string
  width: number
  kind?: CellKind | ((row: T) => CellKind)
  options?: { value: string; label: string }[]
  get: (row: T) => string
  /** Writes a value into the draft campaign for the row with this id. Missing = read-only. */
  set?: (draft: Campaign, id: string, value: string) => void
  /** Stays visible while scrolling sideways. */
  frozen?: boolean
  placeholder?: string
  /** A message when the cell value is not acceptable (shown as a red cell). */
  invalid?: (row: T) => string
  list?: string
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onCommit: (value: string) => void; delay?: number }

/** Multi-line cell: typing stays in the cell and the app is told when typing pauses, like LazyInput. */
export function LazyArea({ value, onCommit, delay = 300, onBlur, onFocus, ...rest }: AreaProps) {
  const [local, setLocal] = useState(value)
  const focused = useRef(false)
  const pending = useRef<string | null>(null)
  const timer = useRef(0)
  const commit = useRef(onCommit)
  const unregister = useRef<(() => void) | null>(null)
  useEffect(() => { commit.current = onCommit })
  useEffect(() => { if (!focused.current && pending.current === null) setLocal(value) }, [value])

  function flush() {
    window.clearTimeout(timer.current)
    unregister.current?.(); unregister.current = null
    if (pending.current !== null) { const next = pending.current; pending.current = null; commit.current(next) }
  }
  useEffect(() => flush, [])

  return <textarea {...rest} value={local}
    onChange={(event) => {
      setLocal(event.target.value)
      pending.current = event.target.value
      if (!unregister.current) unregister.current = registerFlusher(flush)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    }}
    onFocus={(event) => { focused.current = true; onFocus?.(event) }}
    onBlur={(event) => { focused.current = false; flush(); onBlur?.(event) }} />
}

/** Every row is this tall (cells never grow the row), which lets long tables draw only the rows in view. */
const ROW_HEIGHT = 31
const WINDOW_FROM = 60

const letter = (index: number) => (index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(64 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`)

type Props<T> = {
  rows: T[]
  rowId: (row: T) => string
  columns: Col<T>[]
  edit: (change: (draft: Campaign) => void) => void
  /** The Google Sheet still owns this data: cells are read-only. */
  locked?: boolean
  /** Buttons at the end of each row. */
  actions?: (row: T, index: number) => ReactNode
  actionsWidth?: number
  /** Accessible name of the grid, also used in cell labels. */
  name: string
  empty?: ReactNode
  rowTitle?: (row: T) => string
}

/** A spreadsheet-style grid: row numbers, lettered columns, frozen leading columns, arrow/Enter navigation, edits saved as you go. */
export function SheetGrid<T>({ rows, rowId, columns, edit, locked = false, actions, actionsWidth = 0, name, empty, rowTitle }: Props<T>) {
  const left: number[] = []
  let sum = 44
  for (const column of columns) { left.push(sum); sum += column.frozen ? column.width : 0 }
  const frozenLeft = (index: number) => (columns[index].frozen ? left[index] : undefined)

  const scroller = useRef<HTMLDivElement>(null)
  const windowed = rows.length > WINDOW_FROM
  const [range, setRange] = useState({ start: 0, end: 50 })
  const measure = useCallback(() => {
    const box = scroller.current
    if (!box) return
    const first = Math.max(0, Math.floor(box.scrollTop / ROW_HEIGHT) - 10)
    setRange((current) => (Math.abs(current.start - first) < 4 && current.end > first + 20 ? current : { start: first, end: first + Math.ceil(box.clientHeight / ROW_HEIGHT) + 24 }))
  }, [])
  useEffect(() => { if (windowed) measure() }, [windowed, measure, rows.length])
  const from = windowed ? Math.min(range.start, Math.max(0, rows.length - 1)) : 0
  const to = windowed ? Math.min(rows.length, Math.max(range.end, from + 30)) : rows.length

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const target = event.target as HTMLElement
    const cell = target.getAttribute('data-cell')
    if (!cell) return
    const [r, c] = cell.split(':').map(Number)
    const multi = target.tagName === 'TEXTAREA'
    let nextRow = r
    if (event.key === 'ArrowDown' && !(multi && !event.ctrlKey)) nextRow = r + 1
    else if (event.key === 'ArrowUp' && !(multi && !event.ctrlKey)) nextRow = r - 1
    else if (event.key === 'Enter' && !event.shiftKey && !event.altKey) nextRow = r + 1
    else return
    if (nextRow < 0 || nextRow >= rows.length) return
    const table = event.currentTarget as HTMLElement
    const next = table.querySelector<HTMLElement>(`[data-cell="${nextRow}:${c}"]`)
    event.preventDefault()
    if (next) { next.focus(); if (next instanceof HTMLInputElement && next.type === 'text') next.select(); return }
    // The target row is not drawn yet (long table): scroll to it, then focus once it exists.
    const box = scroller.current
    if (box) {
      box.scrollTop = Math.max(0, nextRow * ROW_HEIGHT - box.clientHeight / 2)
      window.setTimeout(() => { const late = table.querySelector<HTMLElement>(`[data-cell="${nextRow}:${c}"]`); late?.focus() }, 60)
    }
  }

  if (rows.length === 0) return <div className="sheet-empty">{empty ?? 'Chưa có dòng nào.'}</div>

  return <div className="sheet-scroll" ref={scroller} onScroll={windowed ? measure : undefined}>
    <table className="sheet" aria-label={name} onKeyDown={onKeyDown} style={{ width: 44 + columns.reduce((total, column) => total + column.width, 0) + (actions ? actionsWidth || 220 : 0) }}>
      <colgroup><col style={{ width: 44 }} />{columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}{actions && <col style={{ width: actionsWidth || 220 }} />}</colgroup>
      <thead>
        <tr className="sheet-letters"><th className="corner" />{columns.map((column, index) => <th key={column.key} style={{ left: frozenLeft(index) }} className={column.frozen ? 'frozen' : ''}>{letter(index)}</th>)}{actions && <th />}</tr>
        <tr className="sheet-labels"><th className="corner">#</th>{columns.map((column, index) => <th key={column.key} style={{ left: frozenLeft(index) }} className={column.frozen ? 'frozen' : ''}>{column.label}</th>)}{actions && <th>Thao tác</th>}</tr>
      </thead>
      <tbody>
        {windowed && from > 0 && <tr aria-hidden="true" style={{ height: from * ROW_HEIGHT }}><td colSpan={columns.length + 1 + (actions ? 1 : 0)} /></tr>}
        {rows.slice(from, to).map((row, offset) => {
          const r = from + offset
          const id = rowId(row)
          return <tr key={id} title={rowTitle?.(row)} style={{ height: ROW_HEIGHT }}>
            <th className="rownum" scope="row">{r + 1}</th>
            {columns.map((column, c) => {
              const value = column.get(row)
              const problem = column.invalid?.(row) ?? ''
              const kind: CellKind = (typeof column.kind === 'function' ? column.kind(row) : column.kind) ?? 'text'
              const writable = Boolean(column.set) && !locked && kind !== 'static'
              const label = `${column.label} ${name} dòng ${r + 1}`
              const common = { 'data-cell': `${r}:${c}`, 'aria-label': label, disabled: !writable, title: problem || undefined, 'aria-invalid': problem ? true : undefined }
              let content: ReactNode
              if (!column.set || kind === 'static') content = <span className="cell-static">{value}</span>
              else if (kind === 'long') content = <LazyArea {...common} spellCheck={false} placeholder={column.placeholder} value={value} onCommit={(text) => edit((draft) => column.set!(draft, id, text))} />
              else if (kind === 'select') content = <select {...common} value={value} onChange={(event) => edit((draft) => column.set!(draft, id, event.target.value))}>{column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              else if (kind === 'date') content = <input {...common} type="date" value={value} onChange={(event) => edit((draft) => column.set!(draft, id, event.target.value))} />
              else content = <LazyInput {...common} type={kind === 'number' ? 'number' : 'text'} list={column.list} placeholder={column.placeholder} value={value} onCommit={(text) => edit((draft) => column.set!(draft, id, text))} />
              return <td key={column.key} style={{ left: frozenLeft(c) }} className={`${column.frozen ? 'frozen' : ''}${problem ? ' invalid' : ''}${kind === 'long' ? ' long' : ''}`}>{content}</td>
            })}
            {actions && <td className="sheet-actions">{actions(row, r)}</td>}
          </tr>
        })}
        {windowed && to < rows.length && <tr aria-hidden="true" style={{ height: (rows.length - to) * ROW_HEIGHT }}><td colSpan={columns.length + 1 + (actions ? 1 : 0)} /></tr>}
      </tbody>
    </table>
  </div>
}
