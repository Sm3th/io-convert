// Single source of truth for which formats IO Convert understands and
// what each one can become. Shared by the main process and the UI.

export type Category = 'image' | 'video' | 'audio' | 'document' | 'sheet' | 'pdf'

export interface FormatInfo {
  ext: string
  label: string
  category: Category
}

const IMAGE_IN = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tif', 'tiff', 'gif', 'heic', 'heif', 'svg']
const VIDEO_IN = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v', '3gp', 'mpeg', 'mpg', 'ts']
const AUDIO_IN = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'amr']
const DOC_IN = ['docx', 'doc', 'odt', 'rtf', 'md', 'markdown', 'html', 'htm', 'txt', 'pptx', 'ppt', 'odp']
const SHEET_IN = ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'json']

export const TARGETS: Record<Category, string[]> = {
  image: ['png', 'jpg', 'webp', 'avif', 'tiff', 'gif', 'pdf', 'txt'],
  video: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'gif', 'mp3', 'wav', 'm4a', 'flac', 'ogg'],
  audio: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus'],
  document: ['pdf', 'docx', 'html', 'txt', 'md'],
  sheet: ['xlsx', 'csv', 'json', 'html', 'pdf', 'ods'],
  pdf: ['png', 'jpg', 'webp', 'txt', 'docx', 'html']
}

// Some document routes depend on the source type.
const DOC_ROUTES: Record<string, string[]> = {
  docx: ['pdf', 'html', 'txt', 'md'],
  doc: ['pdf', 'docx', 'txt'],
  odt: ['pdf', 'docx', 'txt'],
  rtf: ['pdf', 'docx', 'txt'],
  md: ['pdf', 'html', 'docx', 'txt'],
  markdown: ['pdf', 'html', 'docx', 'txt'],
  html: ['pdf', 'docx', 'txt', 'md'],
  htm: ['pdf', 'docx', 'txt', 'md'],
  txt: ['pdf', 'docx', 'html'],
  pptx: ['pdf'],
  ppt: ['pdf'],
  odp: ['pdf']
}

// Routes that need LibreOffice installed on the machine.
export const NEEDS_OFFICE = new Set(['doc', 'odt', 'rtf', 'pptx', 'ppt', 'odp'])

export function extOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? ''
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i + 1).toLowerCase() : ''
}

export function categoryOf(ext: string): Category | null {
  ext = ext.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (IMAGE_IN.includes(ext)) return 'image'
  if (VIDEO_IN.includes(ext)) return 'video'
  if (AUDIO_IN.includes(ext)) return 'audio'
  if (DOC_IN.includes(ext)) return 'document'
  if (SHEET_IN.includes(ext)) return 'sheet'
  return null
}

export function normalizeExt(ext: string): string {
  const e = ext.toLowerCase()
  if (e === 'jpeg') return 'jpg'
  if (e === 'tif') return 'tiff'
  if (e === 'htm') return 'html'
  if (e === 'markdown') return 'md'
  if (e === 'heif') return 'heic'
  return e
}

export function targetsFor(ext: string): string[] {
  const e = ext.toLowerCase()
  const cat = categoryOf(e)
  if (!cat) return []
  const list = cat === 'document' ? (DOC_ROUTES[e] ?? []) : TARGETS[cat]
  const self = normalizeExt(e)
  return list.filter((t) => t !== self)
}

export const ALL_INPUT_EXTS = [
  'pdf',
  ...IMAGE_IN,
  ...VIDEO_IN,
  ...AUDIO_IN,
  ...DOC_IN,
  ...SHEET_IN
]

export const FORMAT_LABELS: Record<string, string> = {
  jpg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  tiff: 'TIFF',
  gif: 'GIF',
  heic: 'HEIC',
  svg: 'SVG',
  pdf: 'PDF',
  txt: 'Text',
  docx: 'Word',
  html: 'HTML',
  md: 'Markdown',
  xlsx: 'Excel',
  csv: 'CSV',
  json: 'JSON',
  ods: 'ODS',
  mp4: 'MP4',
  webm: 'WebM',
  mkv: 'MKV',
  mov: 'MOV',
  avi: 'AVI',
  mp3: 'MP3',
  wav: 'WAV',
  m4a: 'M4A',
  flac: 'FLAC',
  ogg: 'OGG',
  opus: 'Opus'
}

export const labelFor = (ext: string): string => FORMAT_LABELS[ext] ?? ext.toUpperCase()

// ---------- Job types shared over IPC ----------

export interface ConvertOptions {
  quality?: number // 1-100 for images, also video preset mapping
  width?: number // resize target width (images/video)
  videoQuality?: 'high' | 'balanced' | 'small'
  resolution?: 'original' | '2160' | '1080' | '720' | '480'
  audioBitrate?: '320' | '256' | '192' | '128' | '96'
  gifFps?: number
  ocrLangs?: string
  pageSize?: 'A4' | 'Letter'
}

export interface ConvertRequest {
  jobId: string
  input: string
  target: string
  outDir?: string
  options: ConvertOptions
}

export interface ConvertResult {
  output: string
  size: number
}

export interface ProgressEvent {
  jobId: string
  percent: number
  stage?: string
}

export type AnnotationKind = 'text' | 'image' | 'rect' | 'highlight'

export interface Annotation {
  kind: AnnotationKind
  page: number // 0-based
  // Coordinates as fractions (0..1) of the page box, origin top-left.
  x: number
  y: number
  w: number
  h: number
  text?: string
  fontSize?: number // in fractions of page height
  color?: string // hex
  image?: Uint8Array // PNG bytes
}

export interface OrganizePage {
  index: number // source page (0-based)
  rotate: number // extra rotation 0/90/180/270
}

export interface WatermarkOptions {
  text: string
  opacity: number
  size: number
  color: string
  diagonal: boolean
}

export interface PageNumberOptions {
  position: 'bottom-center' | 'bottom-right' | 'top-right' | 'bottom-left'
  format: 'n' | 'n-of-total' | 'page-n'
  start: number
  size: number
  /** The word printed by the 'page-n' format, in the UI language ("Page", "Sayfa"). */
  pageWord?: string
}

export type CompressLevel = 'light' | 'balanced' | 'strong'

export interface FileInfo {
  path: string
  name: string
  ext: string
  size: number
  category: Category | null
}
