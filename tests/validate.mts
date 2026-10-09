import { readFileSync } from 'node:fs'

/** Structural sanity checks for a store.json: orphans, duplicate ids, impossible values. Prints problems; exit code 1 if any. */
const file = process.argv[2]
if (!file) { console.error('usage: node tests/validate.mts <store.json>'); process.exit(2) }
const store = JSON.parse(readFileSync(file, 'utf8'))
const problems: string[] = []
const ids = new Map<string, string>()
const see = (id: string, where: string) => { if (!id) problems.push(`${where}: missing id`); else if (ids.has(id)) problems.push(`${where}: duplicate id (also ${ids.get(id)})`); else ids.set(id, where) }
const STATUS = ['brief', 'copy', 'visual', 'review', 'ready']
for (const w of store.workspaces) {
  see(w.id, `workspace ${w.name}`)
  for (const c of w.campaigns) {
    const where = `${w.name}/${c.name}`
    see(c.id, where)
    const pieceIds = new Set(c.pieces.map((p: any) => p.id))
    const codes = new Map<string, number>()
    for (const p of c.pieces) {
      see(p.id, `${where}/${p.code}`)
      codes.set(p.code, (codes.get(p.code) ?? 0) + 1)
      if (!STATUS.includes(p.status)) problems.push(`${where}/${p.code}: bad status ${p.status}`)
      if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) problems.push(`${where}/${p.code}: bad date ${p.date}`)
      if (p.status === 'ready' && p.approval && !p.approval.fingerprint) problems.push(`${where}/${p.code}: approval without fingerprint`)
      if (p.metrics) for (const k of ['reach', 'engagement', 'clicks', 'leads']) if (p.metrics[k] !== null && !(p.metrics[k] >= 0)) problems.push(`${where}/${p.code}: bad metric ${k}`)
      if (p.published && Number.isNaN(Date.parse(p.published.at))) problems.push(`${where}/${p.code}: bad publish time`)
    }
    for (const [code, n] of codes) if (n > 1) problems.push(`${where}: code ${code} used ${n} times`)
    for (const post of c.posts) {
      see(post.id, `${where}/post ${post.name}`)
      if (post.pieceId && !pieceIds.has(post.pieceId)) problems.push(`${where}: slide "${post.name}" points to a piece that does not exist`)
      if (post.backgroundId && !c.backgrounds.some((b: any) => b.id === post.backgroundId)) problems.push(`${where}: slide "${post.name}" points to a missing background`)
    }
    for (const post of c.posts) for (const layer of post.layers ?? []) if (!c.components.some((x: any) => x.id === layer.componentId)) problems.push(`${where}: slide "${post.name}" uses a missing component`)
    for (const v of c.docVersions ?? []) for (const id of Object.keys(v.pieces)) void id
  }
}
console.log(problems.length ? problems.map((p) => '✖ ' + p).join('\n') : '✔ no structural problems')
process.exit(problems.length ? 1 : 0)
