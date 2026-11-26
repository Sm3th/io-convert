import { spawn, type ChildProcess } from 'child_process'
import { rm } from 'fs/promises'
import ffmpegStatic from 'ffmpeg-static'
import type { ConvertOptions } from '@shared/formats'

// Inside a packaged app the binary lives in app.asar.unpacked.
export const FFMPEG = (ffmpegStatic ?? 'ffmpeg').replace('app.asar', 'app.asar.unpacked')

const running = new Map<string, ChildProcess>()

export function cancelMedia(jobId: string): boolean {
  const p = running.get(jobId)
  if (!p) return false
  p.kill('SIGKILL')
  running.delete(jobId)
  return true
}

const AUDIO_ONLY = new Set(['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus'])

export function buildArgs(input: string, target: string, output: string, o: ConvertOptions): string[] {
  const args = ['-hide_banner', '-y', '-i', input]
  const br = `${o.audioBitrate ?? '192'}k`

  if (AUDIO_ONLY.has(target)) {
    args.push('-vn')
    switch (target) {
      case 'mp3':
        args.push('-c:a', 'libmp3lame', '-b:a', br)
        break
      case 'm4a':
        args.push('-c:a', 'aac', '-b:a', br)
        break
      case 'ogg':
        args.push('-c:a', 'libvorbis', '-b:a', br)
        break
      case 'opus':
        args.push('-c:a', 'libopus', '-b:a', br)
        break
      case 'flac':
        args.push('-c:a', 'flac')
        break
      case 'wav':
        args.push('-c:a', 'pcm_s16le')
        break
    }
    args.push(output)
    return args
  }

  if (target === 'gif') {
    const fps = o.gifFps ?? 12
    const w = o.width ?? 480
    // Two-pass palette in one filter graph gives far better colours than the default.
    args.push(
      '-vf',
      `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
      '-loop',
      '0',
      output
    )
    return args
  }

  const crf = { high: 18, balanced: 23, small: 30 }[o.videoQuality ?? 'balanced']
  const filters: string[] = []
  if (o.resolution && o.resolution !== 'original') {
    // keep aspect ratio, even dimensions, never upscale
    filters.push(`scale=-2:'min(${o.resolution},ih)'`)
  }
  if (filters.length) args.push('-vf', filters.join(','))

  switch (target) {
    case 'webm':
      args.push('-c:v', 'libvpx-vp9', '-crf', String(crf + 8), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4')
      args.push('-c:a', 'libopus', '-b:a', br)
      break
    case 'avi':
      args.push('-c:v', 'mpeg4', '-q:v', String(Math.max(2, Math.round(crf / 6))), '-c:a', 'libmp3lame', '-b:a', br)
      break
    default: // mp4, mkv, mov
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p')
      args.push('-c:a', 'aac', '-b:a', br)
      if (target === 'mp4' || target === 'mov') args.push('-movflags', '+faststart')
  }
  args.push(output)
  return args
}

function toSeconds(t: string): number {
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

export function convertMedia(
  jobId: string,
  input: string,
  target: string,
  output: string,
  o: ConvertOptions,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, buildArgs(input, target, output, o), { windowsHide: true })
    running.set(jobId, proc)
    let duration = 0
    let log = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      log = (log + text).slice(-4000)
      if (!duration) {
        const d = /Duration: (\d+:\d+:\d+\.\d+)/.exec(log)
        if (d) duration = toSeconds(d[1])
      }
      const matches = [...text.matchAll(/time=(\d+:\d+:\d+\.\d+)/g)]
      if (duration && matches.length) {
        const t = toSeconds(matches[matches.length - 1][1])
        onProgress(Math.min(99, (t / duration) * 100))
      }
    })
    // A cancelled or failed run leaves a truncated file behind; never hand
    // that to the user as if it were a result.
    const fail = (err: Error): void => void rm(output, { force: true }).finally(() => reject(err))
    proc.on('error', (e) => {
      running.delete(jobId)
      fail(e)
    })
    proc.on('close', (code, signal) => {
      running.delete(jobId)
      if (signal === 'SIGKILL') return fail(new Error('Cancelled'))
      if (code === 0) return resolve()
      const lastLine = log.trim().split('\n').slice(-2).join(' ')
      fail(new Error(`ffmpeg failed: ${lastLine}`))
    })
  })
}
