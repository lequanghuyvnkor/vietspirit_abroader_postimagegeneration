import { useEffect, useRef, useState, type ReactNode } from 'react'
import { downloadBlob } from '../lib/pack.ts'
import { renderBlob, renderPost } from '../lib/render.ts'
import { formatOf } from '../lib/types.ts'
import type { Campaign, Post, Workspace } from '../lib/types.ts'
import { Lightbox } from './ui.tsx'

type Props = {
  post: Post
  campaign: Campaign
  workspace: Workspace
  /** Thumbnail width in CSS pixels. */
  width?: number
  /** Extra buttons shown under the enlarged image. */
  actions?: ReactNode
}

/** The finished slide as drawn by the real renderer (background, components, text), click to enlarge. */
export function SlideThumb({ post, campaign, workspace, width = 180, actions }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [full, setFull] = useState<{ url: string; blob: Blob } | null>(null)
  const [busy, setBusy] = useState(false)
  // Slides far off screen are not drawn until they scroll near, so a long plan stays light.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  const format = formatOf(post.format)
  const height = Math.round((width * format.height) / format.width)

  useEffect(() => {
    const node = canvas.current
    if (seen || !node) return
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect() } }, { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [seen])

  useEffect(() => {
    if (!seen) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const source = document.createElement('canvas')
      await renderPost(source, post, campaign, workspace).catch(() => undefined)
      const target = canvas.current
      if (cancelled || !target) return
      target.width = width * 2
      target.height = height * 2
      target.getContext('2d')!.drawImage(source, 0, 0, target.width, target.height)
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [post, campaign, workspace, width, height, seen])

  async function open() {
    setBusy(true)
    try {
      const blob = await renderBlob(post, campaign, workspace)
      setFull({ url: URL.createObjectURL(blob), blob })
    } finally { setBusy(false) }
  }

  function close() {
    if (full) URL.revokeObjectURL(full.url)
    setFull(null)
  }

  return <>
    <button className="slide-thumb" style={{ width }} onClick={() => { void open() }} aria-label={`Xem lớn ${post.name}`} disabled={busy}>
      <canvas ref={canvas} style={{ width, height }} />
    </button>
    {full && <Lightbox src={full.url} title={`${post.name} · ${format.width}×${format.height}`} onClose={close}
      actions={<>{actions}<button className="btn small" onClick={() => downloadBlob(full.blob, `${post.name.replace(/[^\w.-]+/g, '-')}.png`)}>Tải PNG</button></>} />}
  </>
}
