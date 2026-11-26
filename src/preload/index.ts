import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ProgressEvent } from '@shared/formats'

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const api = {
  call,
  /** Absolute path of a dropped File (File.path was removed in Electron 32). */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  onProgress: (cb: (e: ProgressEvent) => void): (() => void) => {
    const listener = (_: unknown, e: ProgressEvent): void => cb(e)
    ipcRenderer.on('job:progress', listener)
    return () => ipcRenderer.removeListener('job:progress', listener)
  }
}

contextBridge.exposeInMainWorld('io', api)

export type IoApi = typeof api
