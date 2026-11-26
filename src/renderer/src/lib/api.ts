import type { IoApi } from '../../../preload'
import type {
  Annotation,
  CompressLevel,
  ConvertRequest,
  ConvertResult,
  FileInfo,
  OrganizePage,
  PageNumberOptions,
  WatermarkOptions
} from '@shared/formats'

declare global {
  interface Window {
    io: IoApi
  }
}

const c = <T,>(ch: string, ...a: unknown[]) => window.io.call<T>(ch, ...a)

export interface Saved {
  output: string
  size: number
}
export interface PdfInfo {
  pages: number
  encrypted: boolean
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
  producer?: string
  size: number
}
export interface AppEnv {
  office: boolean
  version: string
  platform: string
  downloads: string
}

export const api = {
  openFiles: (filters?: { name: string; extensions: string[] }[], multi = true) =>
    c<string[]>('dialog:open', { filters, multi }),
  pickFolder: () => c<string | null>('dialog:folder'),
  saveAs: (defaultPath: string, ext: string) => c<string | null>('dialog:save', defaultPath, ext),
  info: (paths: string[]) => c<FileInfo[]>('fs:info', paths),
  read: (path: string) => c<Uint8Array>('fs:read', path),
  outputPath: (input: string, ext: string, outDir?: string, suffix?: string) =>
    c<string>('fs:outputPath', input, ext, outDir, suffix),
  show: (path: string) => c<void>('shell:show', path),
  open: (path: string) => c<string>('shell:open', path),
  env: () => c<AppEnv>('app:env'),

  convert: (req: ConvertRequest) => c<ConvertResult>('convert:run', req),
  cancel: (jobId: string) => c<boolean>('convert:cancel', jobId),
  saveRender: (png: Uint8Array, target: string, output: string, quality?: number) =>
    c<Saved>('render:save', png, target, output, quality),
  saveText: (pages: string[][], target: string, output: string) => c<Saved>('text:save', pages, target, output),

  pdfInfo: (input: string, password?: string) => c<PdfInfo>('pdf:info', input, password),
  merge: (inputs: string[], output: string, passwords?: Record<string, string>) =>
    c<Saved>('pdf:merge', inputs, output, passwords),
  split: (input: string, how: { mode: 'each' } | { mode: 'ranges'; ranges: string } | { mode: 'every'; n: number }, outDir?: string, pw?: string) =>
    c<string[]>('pdf:split', input, how, outDir, pw),
  organize: (input: string, pages: OrganizePage[], output: string, pw?: string) =>
    c<Saved>('pdf:organize', input, pages, output, pw),
  compress: (input: string, level: CompressLevel, output: string, pw?: string) =>
    c<{ output: string; before: number; after: number; images: number }>('pdf:compress', input, level, output, pw),
  protect: (
    input: string,
    o: { userPassword: string; ownerPassword?: string; allowPrinting: boolean; allowCopying: boolean; allowEditing: boolean },
    output: string,
    pw?: string
  ) => c<Saved>('pdf:protect', input, o, output, pw),
  unlock: (input: string, password: string, output: string) => c<Saved>('pdf:unlock', input, password, output),
  watermark: (input: string, o: WatermarkOptions, output: string, pw?: string) => c<Saved>('pdf:watermark', input, o, output, pw),
  pageNumbers: (input: string, o: PageNumberOptions, output: string, pw?: string) =>
    c<Saved>('pdf:pageNumbers', input, o, output, pw),
  annotate: (input: string, a: Annotation[], output: string, pw?: string) => c<Saved>('pdf:annotate', input, a, output, pw),
  metadata: (input: string, m: { title?: string; author?: string; subject?: string; keywords?: string }, output: string, pw?: string) =>
    c<Saved>('pdf:metadata', input, m, output, pw),
  fromImages: (inputs: string[], output: string, fit: 'image' | 'a4') => c<Saved>('pdf:fromImages', inputs, output, fit),
  ocr: (jobId: string, inputs: (string | Uint8Array)[], langs: string, target: 'pdf' | 'txt', output: string) =>
    c<Saved>('ocr:run', jobId, inputs, langs, target, output)
}

export const isPasswordError = (e: unknown) => (e as Error)?.message === 'PASSWORD_REQUIRED'
