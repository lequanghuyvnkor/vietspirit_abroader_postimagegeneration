import { campaignWindow } from './foundation.ts'
import { FUNNELS } from './planEdit.ts'
import { funnelMix } from './planAi.ts'
import type { Campaign, Lead, Piece, PieceStatus } from './types.ts'

export const DEFAULT_LEAD: Lead = { copy: 5, visual: 3, review: 1 }

export const leadOf = (campaign: Campaign): Lead => ({ ...DEFAULT_LEAD, ...campaign.lead })

const DAY = 86400000
const parse = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime()
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const addDays = (iso: string, days: number): string => format(parse(iso) + days * DAY)
export const daysBetween = (from: string, to: string): number => Math.round((parse(to) - parse(from)) / DAY)

/** Today as YYYY-MM-DD in the user's own time zone. */
export function todayIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const ORDER: PieceStatus[] = ['brief', 'copy', 'visual', 'ready']
const reached = (piece: Piece, status: PieceStatus) => ORDER.indexOf(piece.status) >= ORDER.indexOf(status)

export type Milestone = { key: keyof Lead; label: string; short: string; due: string; done: boolean }

/** The backward schedule of a piece: when text, images and the final check must be finished so it can go out on its date. */
export function milestonesOf(piece: Piece, lead: Lead): Milestone[] {
  if (!piece.date) return []
  return [
    { key: 'copy', label: 'Chữ xong', short: 'Chữ', due: addDays(piece.date, -lead.copy), done: reached(piece, 'copy') },
    { key: 'visual', label: 'Hình xong', short: 'Hình', due: addDays(piece.date, -lead.visual), done: reached(piece, 'visual') },
    { key: 'review', label: 'Sẵn sàng đăng', short: 'Sẵn sàng', due: addDays(piece.date, -lead.review), done: reached(piece, 'ready') },
  ]
}

export type Task = { piece: Piece; milestone: Milestone; days: number }

/** Unfinished milestones, most overdue first. `days` is how many days are left (negative = late). */
export function openTasks(campaign: Campaign, today: string): Task[] {
  const lead = leadOf(campaign)
  return campaign.pieces
    .flatMap((piece) => milestonesOf(piece, lead).filter((milestone) => !milestone.done).map((milestone) => ({ piece, milestone, days: daysBetween(today, milestone.due) })))
    .sort((a, b) => a.days - b.days || a.piece.code.localeCompare(b.piece.code))
}

/** A piece whose date has passed without being ready, or whose publish date is today/tomorrow and is not ready. */
export function lateTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.days < 0)
}

export function weeksOf(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const start = parse(format(first.getTime())) - offset * DAY
  const last = new Date(Date.UTC(year, month + 1, 0))
  const total = Math.ceil((offset + last.getUTCDate()) / 7) * 7
  return Array.from({ length: total / 7 }, (_, week) => Array.from({ length: 7 }, (_, day) => format(start + (week * 7 + day) * DAY)))
}

export type PillarCoverage = { name: string; count: number }
export type Coverage = {
  total: number
  funnel: { key: string; count: number; target: number }[]
  other: number
  pillars: PillarCoverage[]
  gaps: string[]
}

const norm = (text: string) => text.toLowerCase()

/** Which foundation pillar a piece serves: by name, or by its "P2" style number in the plan. A piece can serve several. */
export function pillarsOf(campaign: Campaign, piece: Piece): number[] {
  const text = norm(piece.plan.pillar)
  if (!text.trim()) return []
  return campaign.foundation.pillars.flatMap((pillar, index) => {
    const name = norm(pillar.name.replace(/\s*\(.*\)\s*$/, '').trim())
    const numbered = new RegExp(`\\bp${index + 1}\\b`).test(text)
    return numbered || (name && text.includes(name)) ? [index] : []
  })
}

/** How the plan spreads over the funnel and the pillars, and what is missing (e.g. no conversion piece near the end). */
export function coverage(campaign: Campaign): Coverage {
  const pieces = campaign.pieces
  const targets = funnelMix(pieces.length)
  const funnel = FUNNELS.map((key) => ({ key, count: pieces.filter((piece) => piece.plan.funnel.toUpperCase() === key).length, target: targets[key] }))
  const other = pieces.length - funnel.reduce((sum, item) => sum + item.count, 0)
  const pillars = campaign.foundation.pillars.map((pillar, index) => ({ name: pillar.name, count: pieces.filter((piece) => pillarsOf(campaign, piece).includes(index)).length }))
  const gaps: string[] = []
  if (pieces.length >= 3) {
    for (const item of funnel) if (item.count === 0) gaps.push(`Chưa có bài ${item.key}.`)
    const window = campaignWindow(campaign)
    const dated = pieces.filter((piece) => piece.date)
    if (window && dated.length > 0) {
      const span = daysBetween(window.start, window.end)
      const third = (piece: Piece) => (span > 0 ? daysBetween(window.start, piece.date) / span : 0)
      if (!dated.some((piece) => piece.plan.funnel.toUpperCase() === 'BOFU' && third(piece) >= 2 / 3)) gaps.push('Chưa có bài BOFU (chuyển đổi) ở một phần ba cuối kỳ.')
      if (!dated.some((piece) => piece.plan.funnel.toUpperCase() === 'TOFU' && third(piece) <= 1 / 3)) gaps.push('Chưa có bài TOFU (nhận biết) ở một phần ba đầu kỳ.')
    }
  }
  for (const pillar of pillars) if (pillar.count === 0 && pieces.length > 0) gaps.push(`Trụ cột "${pillar.name}" chưa có bài nào.`)
  if (other > 0) gaps.push(`${other} bài chưa chọn phễu.`)
  return { total: pieces.length, funnel, other, pillars, gaps }
}
