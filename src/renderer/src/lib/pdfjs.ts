import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy

const base = new URL('./pdfjs/', document.baseURI).href

/** Opens a PDF from bytes. Throws Error('PASSWORD_REQUIRED') / ('Wrong password'). */
export async function openPdf(data: Uint8Array, password?: string): Promise<PdfDoc> {
  const task = pdfjs.getDocument({
    data: data.slice(), // pdf.js transfers the buffer; keep the caller's copy usable
    password,
    cMapUrl: base + 'cmaps/',
    cMapPacked: true,
    standardFontDataUrl: base + 'standard_fonts/',
    wasmUrl: base + 'wasm/',
    iccUrl: base + 'iccs/',
    enableXfa: false
  })
  try {
    return await task.promise
  } catch (e) {
    if ((e as { name?: string }).name === 'PasswordException') {
      throw new Error(password ? 'Wrong password' : 'PASSWORD_REQUIRED')
    }
    throw e
  }
}

// One render per canvas at a time: pdf.js garbles output if two overlap.
const active = new WeakMap<HTMLCanvasElement, { cancel: () => void }>()

/** Renders a page to a canvas at a target CSS width (device-pixel aware). */
export async function renderToCanvas(doc: PdfDoc, pageNo: number, canvas: HTMLCanvasElement, cssWidth: number, extraRotate = 0) {
  active.get(canvas)?.cancel()
  let cancelled = false
  active.set(canvas, { cancel: () => (cancelled = true) })
  const page = await doc.getPage(pageNo + 1)
  if (cancelled) throw new Error('cancelled')
  const rotation = (page.rotate + extraRotate) % 360
  const unit = page.getViewport({ scale: 1, rotation })
  const dpr = window.devicePixelRatio || 1
  const scale = (cssWidth / unit.width) * dpr
  const viewport = page.getViewport({ scale, rotation })
  // Draw off-screen, then copy: the visible canvas never shows a half-drawn page.
  const off = document.createElement('canvas')
  off.width = Math.floor(viewport.width)
  off.height = Math.floor(viewport.height)
  const task = page.render({ canvas: off, viewport })
  active.set(canvas, { cancel: () => ((cancelled = true), task.cancel()) })
  await task.promise
  if (cancelled) throw new Error('cancelled')
  canvas.width = off.width
  canvas.height = off.height
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${(viewport.height / dpr).toFixed(1)}px`
  canvas.getContext('2d')!.drawImage(off, 0, 0)
  active.delete(canvas)
  return { width: viewport.width / dpr, height: viewport.height / dpr }
}

/** Renders a page to PNG bytes at the given DPI. */
export async function renderToPng(doc: PdfDoc, pageNo: number, dpi = 150): Promise<Uint8Array> {
  const page = await doc.getPage(pageNo + 1)
  const viewport = page.getViewport({ scale: dpi / 72 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, viewport }).promise
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Render failed'))), 'image/png'))
  page.cleanup()
  return new Uint8Array(await blob.arrayBuffer())
}

/** Extracts text as lines per page, grouping items by their baseline. */
export async function extractLines(doc: PdfDoc): Promise<string[][]> {
  const pages: string[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const lines: { y: number; parts: { x: number; s: string }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const x = item.transform[4]
      const y = item.transform[5]
      let line = lines.find((l) => Math.abs(l.y - y) < 2.5)
      if (!line) lines.push((line = { y, parts: [] }))
      line.parts.push({ x, s: item.str })
    }
    lines.sort((a, b) => b.y - a.y)
    pages.push(
      lines.map((l) =>
        l.parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.s)
          .join(' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
      ).filter(Boolean)
    )
  }
  return pages
}
