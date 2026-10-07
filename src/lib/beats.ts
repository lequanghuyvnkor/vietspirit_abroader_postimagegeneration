import type { Piece } from './types.ts'

/** One timed scene of a reel. */
export type Beat = { start: number; end: number; label: string }

const RANGE = /(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)\s*s\b\s*:?\s*([\s\S]*?)(?=[;.]?\s*\d+(?:[.,]\d+)?\s*[–-]\s*\d+(?:[.,]\d+)?\s*s\b|$)/g
const num = (value: string) => Number(value.replace(',', '.'))
const clean = (label: string) => label.replace(/[.;:\s]+$/, '').replace(/^[:\s]+/, '').trim()

/** "0–3s: Deadline card. 3–10s: Ai phù hợp." -> beats. Needs at least two ranges with a label. */
export function rangeBeats(text: string): Beat[] | null {
  const beats = [...text.matchAll(RANGE)].map((match) => ({ start: num(match[1]), end: num(match[2]), label: clean(match[3]) })).filter((beat) => beat.label && beat.end > beat.start)
  return beats.length >= 2 ? beats : null
}

/** "Offer 4s; điều kiện 5s; CTA 3s." -> back-to-back beats from their durations. */
export function durationBeats(text: string): Beat[] | null {
  const parts = text.split(/[;.]/).map((part) => part.trim().match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*s$/)).filter((match): match is RegExpMatchArray => Boolean(match))
  if (parts.length < 2) return null
  let cursor = 0
  return parts.map((match) => { const beat = { start: cursor, end: cursor + num(match[2]), label: clean(match[1]) }; cursor = beat.end; return beat })
}

const totalSeconds = (format: string): number | null => { const match = format.match(/(\d+)\s*s\b/i); return match ? Number(match[1]) : null }

/**
 * "5 checkpoint: a, b, c. Kết: ..." with no timecodes: an intro, one scene per listed item and a closing scene
 * that fills the remaining time of the reel.
 */
function listBeats(piece: Piece): Beat[] | null {
  const list = piece.plan.structure.match(/\d+\s*[^\s:]+\s*:\s*([^.]+)\./)
  const items = list?.[1].split(',').map((item) => clean(item)).filter(Boolean) ?? []
  if (items.length < 3) return null
  const each = Number(piece.visual.layout.match(/(\d+)\s*[–-]\s*(\d+)\s*s/)?.[2] ?? 4)
  const total = totalSeconds(piece.plan.format) ?? 30
  const intro = 3
  const closingStart = intro + items.length * each
  const closing = clean(piece.plan.structure.replace(list![0], '').replace(/^\s*Kết\s*:\s*/i, '')) || 'Kết'
  return [
    { start: 0, end: intro, label: piece.visual.onImage || piece.plan.hook },
    ...items.map((item, index) => ({ start: intro + index * each, end: intro + (index + 1) * each, label: item })),
    { start: closingStart, end: Math.max(closingStart + 3, total), label: closing },
  ]
}

/** Scenes for a reel, from whichever part of the plan carries the timing; an even three-part split as a last resort. */
export function inferBeats(piece: Piece): Beat[] {
  const total = totalSeconds(piece.plan.format) ?? 30
  const found = rangeBeats(piece.plan.structure) ?? rangeBeats(piece.visual.layout) ?? durationBeats(piece.visual.layout) ?? durationBeats(piece.plan.structure) ?? listBeats(piece)
  if (found) return found
  const third = Math.round((total / 3) * 10) / 10
  return [
    { start: 0, end: third, label: piece.visual.onImage || piece.plan.hook },
    { start: third, end: third * 2, label: piece.plan.structure || piece.plan.goal },
    { start: third * 2, end: total, label: piece.plan.cta },
  ]
}

export const sceneSeconds = (beat: Beat) => Math.round((beat.end - beat.start) * 10) / 10
export const timecode = (beat: Beat) => `${beat.start}–${beat.end}s`
