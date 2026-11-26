import { readFile, writeFile, stat } from 'fs/promises'
import { join } from 'path'
import { inflateSync } from 'zlib'
import sharp, { type Sharp } from 'sharp'
import fontkit from '@cantoo/fontkit'
import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFArray,
  PDFDict,
  PDFPage,
  PDFFont,
  degrees,
  rgb,
  BlendMode
} from '@cantoo/pdf-lib'
import type {
  Annotation,
  CompressLevel,
  OrganizePage,
  PageNumberOptions,
  WatermarkOptions
} from '@shared/formats'
import { outputPath } from './paths'

// ---------------------------------------------------------------------------
// Fonts: the PDF standard fonts cannot encode ş, ğ, ı, ł, ą… so we embed Liberation Sans (metric-compatible with Arial).
// ---------------------------------------------------------------------------
let fontDir = join(process.cwd(), 'resources', 'fonts')
export function setFontDir(dir: string): void {
  fontDir = dir
}
async function embedUiFont(doc: PDFDocument, bold = false): Promise<PDFFont> {
  doc.registerFontkit(fontkit)
  const bytes = await readFile(join(fontDir, bold ? 'LiberationSans-Bold.ttf' : 'LiberationSans-Regular.ttf'))
  return doc.embedFont(bytes, { subset: true })
}

export class PasswordRequiredError extends Error {
  constructor() {
    super('PASSWORD_REQUIRED')
  }
}

export async function load(input: string | Uint8Array, password?: string): Promise<PDFDocument> {
  const bytes = typeof input === 'string' ? await readFile(input) : input
  try {
    const doc = await PDFDocument.load(bytes, { password, ignoreEncryption: false, updateMetadata: false })
    return doc
  } catch (e) {
    const msg = String((e as Error).message ?? e).toLowerCase()
    if (msg.includes('encrypt') || msg.includes('password')) {
      if (password) throw new Error('Wrong password')
      // Permission-only PDFs have an empty user password: open them silently.
      try {
        return await PDFDocument.load(bytes, { password: '', updateMetadata: false })
      } catch {
        throw new PasswordRequiredError()
      }
    }
    throw e
  }
}

async function save(doc: PDFDocument, output: string): Promise<{ output: string; size: number }> {
  const bytes = await doc.save({ useObjectStreams: true })
  await writeFile(output, bytes)
  return { output, size: bytes.byteLength }
}

// ---------------------------------------------------------------------------
// Info & metadata
// ---------------------------------------------------------------------------
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
export async function info(input: string, password?: string): Promise<PdfInfo> {
  const size = (await stat(input)).size
  try {
    const doc = await load(input, password)
    return {
      pages: doc.getPageCount(),
      encrypted: !!password,
      title: doc.getTitle(),
      author: doc.getAuthor(),
      subject: doc.getSubject(),
      keywords: doc.getKeywords(),
      creator: doc.getCreator(),
      producer: doc.getProducer(),
      size
    }
  } catch (e) {
    if (e instanceof PasswordRequiredError) return { pages: 0, encrypted: true, size }
    throw e
  }
}

export interface Metadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string
}
export async function setMetadata(input: string, meta: Metadata, output: string, password?: string) {
  const doc = await load(input, password)
  doc.setTitle(meta.title ?? '')
  doc.setAuthor(meta.author ?? '')
  doc.setSubject(meta.subject ?? '')
  doc.setKeywords((meta.keywords ?? '').split(',').map((k) => k.trim()).filter(Boolean))
  doc.setProducer('IO Convert')
  doc.setModificationDate(new Date())
  return save(doc, output)
}

// ---------------------------------------------------------------------------
// Merge / split / organize
// ---------------------------------------------------------------------------
export async function merge(inputs: string[], output: string, passwords: Record<string, string> = {}) {
  const out = await PDFDocument.create()
  for (const input of inputs) {
    const src = await load(input, passwords[input])
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  out.setProducer('IO Convert')
  return save(out, output)
}

/** Parses "1-3, 5, 8-" into 0-based index groups. Each comma part becomes one file. */
export function parseRanges(spec: string, total: number): number[][] {
  const groups: number[][] = []
  for (const raw of spec.split(/[,;]+/)) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(part)
    let a: number, b: number
    if (m) {
      a = m[1] ? parseInt(m[1], 10) : 1
      b = m[2] ? parseInt(m[2], 10) : total
    } else if (/^\d+$/.test(part)) {
      a = b = parseInt(part, 10)
    } else {
      throw new Error(`Cannot read page range "${part}"`)
    }
    if (a < 1 || b > total || a > b) throw new Error(`Page range "${part}" is outside 1–${total}`)
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i))
  }
  if (!groups.length) throw new Error('Enter at least one page range')
  return groups
}

export type SplitMode = { mode: 'each' } | { mode: 'ranges'; ranges: string } | { mode: 'every'; n: number }

export async function split(input: string, how: SplitMode, outDir?: string, password?: string) {
  const src = await load(input, password)
  const total = src.getPageCount()
  let groups: number[][]
  if (how.mode === 'each') groups = src.getPageIndices().map((i) => [i])
  else if (how.mode === 'every') {
    const n = Math.max(1, Math.floor(how.n))
    groups = []
    for (let i = 0; i < total; i += n) groups.push(src.getPageIndices().slice(i, i + n))
  } else groups = parseRanges(how.ranges, total)

  const outputs: string[] = []
  for (const g of groups) {
    const doc = await PDFDocument.create()
    const pages = await doc.copyPages(src, g)
    pages.forEach((p) => doc.addPage(p))
    const label = g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`
    const out = outputPath(input, 'pdf', outDir, ` — pages ${label}`)
    await save(doc, out)
    outputs.push(out)
  }
  return outputs
}

/** Reorders, rotates, duplicates or drops pages in one pass. */
export async function organize(input: string, pages: OrganizePage[], output: string, password?: string) {
  if (!pages.length) throw new Error('Keep at least one page')
  const src = await load(input, password)
  const doc = await PDFDocument.create()
  const copied = await doc.copyPages(
    src,
    pages.map((p) => p.index)
  )
  copied.forEach((page, i) => {
    const extra = ((pages[i].rotate % 360) + 360) % 360
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360))
    doc.addPage(page)
  })
  doc.setTitle(src.getTitle() ?? '')
  return save(doc, output)
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
export interface ProtectOptions {
  userPassword: string
  ownerPassword?: string
  allowPrinting: boolean
  allowCopying: boolean
  allowEditing: boolean
}
export async function protect(input: string, o: ProtectOptions, output: string, currentPassword?: string) {
  if (!o.userPassword) throw new Error('Enter a password')
  const doc = await load(input, currentPassword)
  doc.encrypt({
    userPassword: o.userPassword,
    ownerPassword: o.ownerPassword || o.userPassword + '#owner',
    permissions: {
      printing: o.allowPrinting ? 'highResolution' : false,
      copying: o.allowCopying,
      modifying: o.allowEditing,
      annotating: o.allowEditing,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: o.allowEditing
    }
  })
  return save(doc, output)
}

export async function unlock(input: string, password: string, output: string) {
  const doc = await load(input, password)
  // Objects are already decrypted in memory; drop the security handler so
  // the file is written in the clear.
  const ctx = doc.context as unknown as { trailerInfo: { Encrypt?: unknown }; security?: unknown }
  delete ctx.trailerInfo.Encrypt
  ctx.security = undefined
  // The old cross-reference stream and security dictionary survive parsing as
  // plain objects and would re-flag the file as encrypted. Remove them.
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null
    if (!dict) continue
    const type = nameOf(dict.get(PDFName.of('Type')))
    const isSecurity = nameOf(dict.get(PDFName.of('Filter'))) === '/Standard' && dict.has(PDFName.of('O'))
    if (type === '/XRef' || isSecurity) doc.context.delete(ref)
  }
  return save(doc, output)
}

// ---------------------------------------------------------------------------
// Compression: re-encodes embedded photos, then repacks objects.
// ---------------------------------------------------------------------------
const LEVELS: Record<CompressLevel, { maxDim: number; quality: number; flate: boolean }> = {
  light: { maxDim: 4000, quality: 82, flate: false },
  balanced: { maxDim: 2200, quality: 68, flate: true },
  strong: { maxDim: 1400, quality: 50, flate: true }
}

function nameOf(v: unknown): string | undefined {
  return v instanceof PDFName ? v.asString() : undefined
}

export async function compress(input: string, level: CompressLevel, output: string, password?: string) {
  const original = await readFile(input)
  const doc = await load(original, password)
  const cfg = LEVELS[level]
  let recompressed = 0

  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    const dict = obj.dict
    if (nameOf(dict.get(PDFName.of('Subtype'))) !== '/Image') continue
    if (dict.get(PDFName.of('Mask')) || dict.get(PDFName.of('ImageMask'))) continue

    let filter = dict.get(PDFName.of('Filter'))
    if (filter instanceof PDFArray && filter.size() === 1) filter = filter.get(0)
    const f = nameOf(filter)
    const cs = nameOf(dict.get(PDFName.of('ColorSpace')))
    const bpc = (dict.get(PDFName.of('BitsPerComponent')) as PDFNumber | undefined)?.asNumber()
    const w = (dict.get(PDFName.of('Width')) as PDFNumber | undefined)?.asNumber() ?? 0
    const h = (dict.get(PDFName.of('Height')) as PDFNumber | undefined)?.asNumber() ?? 0
    if (!w || !h || w * h < 40_000) continue // icons and tiny images are not worth it

    try {
      let pipeline: Sharp | null = null
      if (f === '/DCTDecode' && cs !== '/DeviceCMYK' && !dict.get(PDFName.of('Decode'))) {
        pipeline = sharp(Buffer.from(obj.contents))
      } else if (
        cfg.flate &&
        f === '/FlateDecode' &&
        bpc === 8 &&
        (cs === '/DeviceRGB' || cs === '/DeviceGray') &&
        !dict.get(PDFName.of('DecodeParms'))
      ) {
        const raw = inflateSync(Buffer.from(obj.contents))
        const channels = cs === '/DeviceRGB' ? 3 : 1
        if (raw.length !== w * h * channels) continue
        pipeline = sharp(raw, { raw: { width: w, height: h, channels } })
      }
      if (!pipeline) continue

      const scale = Math.min(1, cfg.maxDim / Math.max(w, h))
      const nw = Math.round(w * scale)
      const nh = Math.round(h * scale)
      const gray = cs === '/DeviceGray'
      let p = pipeline.resize(nw, nh)
      if (gray) p = p.toColourspace('b-w')
      const jpg = await p.jpeg({ quality: cfg.quality, mozjpeg: true }).toBuffer()
      if (jpg.length >= obj.contents.length * 0.95) continue

      const newDict = dict.clone(doc.context) as PDFDict
      newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
      newDict.set(PDFName.of('Width'), PDFNumber.of(nw))
      newDict.set(PDFName.of('Height'), PDFNumber.of(nh))
      newDict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
      newDict.set(PDFName.of('ColorSpace'), PDFName.of(gray ? 'DeviceGray' : 'DeviceRGB'))
      newDict.delete(PDFName.of('DecodeParms'))
      newDict.set(PDFName.of('Length'), PDFNumber.of(jpg.length))
      doc.context.assign(ref, PDFRawStream.of(newDict, new Uint8Array(jpg)))
      recompressed++
    } catch {
      // An image we cannot decode is left untouched.
    }
  }

  if (level !== 'light') {
    // Drop editing leftovers that viewers never show.
    doc.catalog.delete(PDFName.of('PieceInfo'))
    for (const page of doc.getPages()) {
      page.node.delete(PDFName.of('PieceInfo'))
      page.node.delete(PDFName.of('Thumb'))
    }
  }

  const bytes = await doc.save({ useObjectStreams: true })
  // Never hand back a bigger file than we were given.
  const best = bytes.byteLength < original.byteLength ? bytes : original
  await writeFile(output, best)
  return { output, before: original.byteLength, after: best.byteLength, images: recompressed }
}

// ---------------------------------------------------------------------------
// Drawing helpers that respect page rotation. All UI coordinates are
// fractions of the page *as displayed* (after /Rotate), origin top-left.
// ---------------------------------------------------------------------------
interface View {
  W: number
  H: number
  ox: number
  oy: number
  rot: number
  dispW: number
  dispH: number
}
function viewOf(page: PDFPage): View {
  const box = page.getCropBox()
  const rot = ((page.getRotation().angle % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  return {
    W: box.width,
    H: box.height,
    ox: box.x,
    oy: box.y,
    rot,
    dispW: swap ? box.height : box.width,
    dispH: swap ? box.width : box.height
  }
}
/** Display fraction (u, v) → PDF user space point. */
function toPdf(v: View, u: number, w: number): { x: number; y: number } {
  let x: number, y: number
  switch (v.rot) {
    case 90:
      x = w * v.W
      y = u * v.H
      break
    case 180:
      x = v.W - u * v.W
      y = w * v.H
      break
    case 270:
      x = v.W - w * v.W
      y = v.H - u * v.H
      break
    default:
      x = u * v.W
      y = v.H - w * v.H
  }
  return { x: x + v.ox, y: y + v.oy }
}

function hexToRgb(hex = '#000000') {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex) ?? ['', '00', '00', '00']
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255)
}

function drawTextAt(
  page: PDFPage,
  font: PDFFont,
  text: string,
  u: number,
  v: number,
  sizePt: number,
  color: string,
  opacity = 1
): void {
  const view = viewOf(page)
  const lines = text.split(/\r?\n/)
  const lineH = sizePt * 1.25
  lines.forEach((line, i) => {
    // baseline of line i, in display fractions
    // half-leading + ascent matches how a CSS line-height of 1.25 positions text
    const baseV = v + (sizePt * 0.125 + font.heightAtSize(sizePt, { descender: false }) + i * lineH) / view.dispH
    const p = toPdf(view, u, baseV)
    page.drawText(line, { x: p.x, y: p.y, size: sizePt, font, color: hexToRgb(color), opacity, rotate: degrees(view.rot) })
  })
}

// ---------------------------------------------------------------------------
// Annotate / sign / white-out
// ---------------------------------------------------------------------------
export async function annotate(input: string, annotations: Annotation[], output: string, password?: string) {
  const doc = await load(input, password)
  const font = await embedUiFont(doc)
  const pages = doc.getPages()
  for (const a of annotations) {
    const page = pages[a.page]
    if (!page) continue
    const view = viewOf(page)
    const anchor = toPdf(view, a.x, a.y + a.h) // box's bottom-left as displayed
    const wPt = a.w * view.dispW
    const hPt = a.h * view.dispH
    switch (a.kind) {
      case 'rect':
        page.drawRectangle({ x: anchor.x, y: anchor.y, width: wPt, height: hPt, color: hexToRgb(a.color ?? '#ffffff'), rotate: degrees(view.rot) })
        break
      case 'highlight':
        page.drawRectangle({
          x: anchor.x,
          y: anchor.y,
          width: wPt,
          height: hPt,
          color: hexToRgb(a.color ?? '#ffe14d'),
          opacity: 0.4,
          blendMode: BlendMode.Multiply,
          rotate: degrees(view.rot)
        })
        break
      case 'image': {
        if (!a.image) break
        const img = await doc.embedPng(a.image)
        page.drawImage(img, { x: anchor.x, y: anchor.y, width: wPt, height: hPt, rotate: degrees(view.rot) })
        break
      }
      case 'text': {
        const sizePt = (a.fontSize ?? 0.018) * view.dispH
        drawTextAt(page, font, a.text ?? '', a.x, a.y, sizePt, a.color ?? '#111111')
        break
      }
    }
  }
  return save(doc, output)
}

// ---------------------------------------------------------------------------
// Watermark & page numbers
// ---------------------------------------------------------------------------
export async function watermark(input: string, o: WatermarkOptions, output: string, password?: string) {
  if (!o.text.trim()) throw new Error('Enter watermark text')
  const doc = await load(input, password)
  const font = await embedUiFont(doc, true)
  for (const page of doc.getPages()) {
    const view = viewOf(page)
    const size = Math.min(view.dispW, view.dispH) * (o.size / 100)
    const textW = font.widthOfTextAtSize(o.text, size)
    const textH = font.heightAtSize(size, { descender: false })
    const angle = o.diagonal ? Math.atan2(view.dispH, view.dispW) : 0
    // Centre of the page in PDF space; rotate the text box around it.
    const cx = view.ox + view.W / 2
    const cy = view.oy + view.H / 2
    const total = (angle * 180) / Math.PI + view.rot
    const rad = (total * Math.PI) / 180
    const x = cx - (Math.cos(rad) * textW) / 2 + (Math.sin(rad) * textH) / 2
    const y = cy - (Math.sin(rad) * textW) / 2 - (Math.cos(rad) * textH) / 2
    page.drawText(o.text, {
      x,
      y,
      size,
      font,
      color: hexToRgb(o.color),
      opacity: o.opacity / 100,
      rotate: degrees(total)
    })
  }
  return save(doc, output)
}

export async function pageNumbers(input: string, o: PageNumberOptions, output: string, password?: string) {
  const doc = await load(input, password)
  const font = await embedUiFont(doc)
  const pages = doc.getPages()
  const total = pages.length + o.start - 1
  pages.forEach((page, i) => {
    const n = i + o.start
    const label = o.format === 'n-of-total' ? `${n} / ${total}` : o.format === 'page-n' ? `${o.pageWord || 'Page'} ${n}` : `${n}`
    const view = viewOf(page)
    const sizePt = o.size
    const wFrac = font.widthOfTextAtSize(label, sizePt) / view.dispW
    const hFrac = font.heightAtSize(sizePt) / view.dispH
    const marginU = 36 / view.dispW
    const marginV = 28 / view.dispH
    const u =
      o.position === 'bottom-center' ? 0.5 - wFrac / 2 : o.position === 'bottom-left' ? marginU : 1 - marginU - wFrac
    const v = o.position === 'top-right' ? marginV : 1 - marginV - hFrac
    drawTextAt(page, font, label, u, v, sizePt, '#333333')
  })
  return save(doc, output)
}

// ---------------------------------------------------------------------------
// Assemble single-page PDFs (from OCR) into one document.
// ---------------------------------------------------------------------------
export async function assemble(parts: Uint8Array[], output: string) {
  const doc = await PDFDocument.create()
  for (const part of parts) {
    const src = await PDFDocument.load(part)
    const pages = await doc.copyPages(src, src.getPageIndices())
    pages.forEach((p) => doc.addPage(p))
  }
  return save(doc, output)
}
