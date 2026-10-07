import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { contentBox } from './cutout.ts'
import { renderPost, safeColor } from './render.ts'
import type { Campaign, Post, Workspace } from './types.ts'

/** Reel export: scenes become an H.264 MP4 (1080×1920, 30 fps, no audio) encoded in the browser with WebCodecs. */

const FPS = 30
const CROSSFADE = 0.35
const ENTER_AT = 0.2
const ENTER_FOR = 0.6
const EXIT_FOR = 0.25
const MARGIN = 64

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
const easeBack = (t: number) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }

export const sceneDuration = (post: Post) => Math.min(30, Math.max(1, post.duration ?? 3))
export const reelSeconds = (scenes: Post[]) => scenes.reduce((sum, scene) => sum + sceneDuration(scene), 0)

type Scene = {
  duration: number
  plate: HTMLCanvasElement
  text: HTMLCanvasElement
  cta: HTMLCanvasElement | null
  /** Center of the CTA button, so it can pop in around its own middle. */
  ctaCenter: { x: number; y: number }
}

async function layer(post: Post, campaign: Campaign, workspace: Workspace, part: 'plate' | 'text' | 'cta'): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  await renderPost(canvas, post, campaign, workspace, { parts: [part] })
  return canvas
}

async function prepare(scenes: Post[], campaign: Campaign, workspace: Workspace): Promise<Scene[]> {
  const out: Scene[] = []
  for (const post of scenes) {
    const [plate, text] = await Promise.all([layer(post, campaign, workspace, 'plate'), layer(post, campaign, workspace, 'text')])
    const cta = post.cta.trim() ? await layer(post, campaign, workspace, 'cta') : null
    let ctaCenter = { x: plate.width / 2, y: plate.height / 2 }
    if (cta) {
      const box = contentBox(cta.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, cta.width, cta.height), 8, 0)
      if (box) ctaCenter = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    }
    out.push({ duration: sceneDuration(post), plate, text, cta, ctaCenter })
  }
  return out
}

/** Slow push-in over the length of a scene. */
function drawPlate(ctx: CanvasRenderingContext2D, plate: HTMLCanvasElement, progress: number, alpha = 1): void {
  const scale = 1 + 0.07 * easeInOut(clamp(progress))
  const { width, height } = plate
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(width / 2, height / 2 - 14 * easeInOut(clamp(progress)))
  ctx.scale(scale, scale)
  ctx.drawImage(plate, -width / 2, -height / 2)
  ctx.restore()
}

/** The route line from the brand: a thin line along the bottom with a star travelling along it as the reel plays. */
function drawRoute(ctx: CanvasRenderingContext2D, progress: number, accent: string): void {
  const { width, height } = ctx.canvas
  const y = height - 215
  const x0 = MARGIN, x1 = width - MARGIN
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
  const x = x0 + (x1 - x0) * clamp(progress)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x, y); ctx.stroke()
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 34)
  glow.addColorStop(0, `${accent}cc`)
  glow.addColorStop(1, `${accent}00`)
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = accent
  ctx.beginPath()
  const size = 15
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? size : size * 0.28
    const angle = (Math.PI / 4) * i - Math.PI / 2
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
  }
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

function drawFrame(ctx: CanvasRenderingContext2D, scenes: Scene[], index: number, local: number, overall: number, accent: string): void {
  const { width, height } = ctx.canvas
  const scene = scenes[index]
  const last = index === scenes.length - 1
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const progress = local / scene.duration
  if (index > 0 && local < CROSSFADE) {
    drawPlate(ctx, scenes[index - 1].plate, 1)
    drawPlate(ctx, scene.plate, progress, easeOut(local / CROSSFADE))
  } else drawPlate(ctx, scene.plate, progress)

  // Text rises and fades in, and fades out just before the cut (the last scene holds).
  const exit = last ? 0 : easeOut(clamp((local - (scene.duration - EXIT_FOR)) / EXIT_FOR))
  const enter = easeOut(clamp((local - ENTER_AT) / ENTER_FOR))
  ctx.save()
  ctx.globalAlpha = enter * (1 - exit)
  ctx.drawImage(scene.text, 0, (1 - enter) * 36)
  ctx.restore()

  if (scene.cta) {
    const pop = clamp((local - 0.55) / 0.45)
    if (pop > 0) {
      const scale = 0.82 + 0.18 * easeBack(pop)
      ctx.save()
      ctx.globalAlpha = easeOut(Math.min(1, pop * 2)) * (1 - exit)
      ctx.translate(scene.ctaCenter.x, scene.ctaCenter.y)
      ctx.scale(scale, scale)
      ctx.drawImage(scene.cta, -scene.ctaCenter.x, -scene.ctaCenter.y)
      ctx.restore()
    }
  }
  drawRoute(ctx, overall, accent)
}

async function pickConfig(width: number, height: number): Promise<VideoEncoderConfig> {
  if (typeof VideoEncoder === 'undefined') throw new Error('Trình duyệt này chưa hỗ trợ xuất MP4. Hãy dùng Chrome hoặc Edge bản mới.')
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42E028']) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate: 6_000_000, framerate: FPS }
    if ((await VideoEncoder.isConfigSupported(config)).supported) return config
  }
  throw new Error('Trình duyệt không hỗ trợ mã hóa H.264 ở khổ 1080×1920. Hãy dùng Chrome hoặc Edge bản mới.')
}

/** Renders the scenes in order and returns the finished MP4. `onProgress` gets 0..1. */
export async function exportReelMp4(workspace: Workspace, campaign: Campaign, posts: Post[], onProgress: (fraction: number, label: string) => void): Promise<Blob> {
  if (posts.length === 0) throw new Error('Reel chưa có cảnh nào.')
  const width = 1080, height = 1920
  const config = await pickConfig(width, height)
  onProgress(0, 'Đang chuẩn bị các cảnh…')
  const scenes = await prepare(posts, campaign, workspace)
  const total = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const frames = Math.round(total * FPS)
  const accent = safeColor(campaign.keyVisual.accentColor, '#FF4D5E')

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({ target, video: { codec: 'avc', width, height }, fastStart: 'in-memory' })
  let failure: Error | null = null
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (error) => { failure = error } })
  encoder.configure(config)

  const frame = document.createElement('canvas')
  frame.width = width
  frame.height = height
  const ctx = frame.getContext('2d')!
  const starts: number[] = []
  scenes.reduce((cursor, scene) => { starts.push(cursor); return cursor + scene.duration }, 0)

  for (let f = 0; f < frames; f++) {
    if (failure) throw failure
    const time = f / FPS
    let index = starts.length - 1
    while (index > 0 && time < starts[index]) index--
    drawFrame(ctx, scenes, index, time - starts[index], time / total, accent)
    const video = new VideoFrame(frame, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
    while (encoder.encodeQueueSize > 8) await new Promise((resolve) => setTimeout(resolve, 4))
    encoder.encode(video, { keyFrame: f % (FPS * 2) === 0 })
    video.close()
    if (f % 6 === 0) { onProgress(f / frames, `Đang dựng khung hình ${f + 1}/${frames}`); await new Promise((resolve) => setTimeout(resolve, 0)) }
  }
  await encoder.flush()
  if (failure) throw failure
  muxer.finalize()
  onProgress(1, 'Xong')
  return new Blob([target.buffer], { type: 'video/mp4' })
}
