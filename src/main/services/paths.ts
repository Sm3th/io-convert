import { existsSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, extname, join } from 'path'

/** Builds `<dir>/<name>.<ext>` and appends " (2)", " (3)"… if the file exists. */
export function outputPath(input: string, ext: string, outDir?: string, suffix = ''): string {
  const dir = outDir || dirname(input)
  const stem = basename(input, extname(input)) + suffix
  return uniquePath(join(dir, `${stem}.${ext}`))
}

export function uniquePath(path: string): string {
  if (!existsSync(path)) return path
  const ext = extname(path)
  const stem = path.slice(0, path.length - ext.length)
  let n = 2
  while (existsSync(`${stem} (${n})${ext}`)) n++
  return `${stem} (${n})${ext}`
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'ioconvert-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
