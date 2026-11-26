import sharp, { type Sharp } from 'sharp'
import { readFile, writeFile, stat } from 'fs/promises'
import { PDFDocument } from '@cantoo/pdf-lib'
import { extOf, type ConvertOptions } from '@shared/formats'

// Pure-JS HEIC decoder: the prebuilt sharp binaries cannot decode the
// HEVC-based HEIC photos that iPhones produce.
import heicConvert from 'heic-convert'

/** Loads any supported image into a sharp pipeline. */
export async function loadImage(input: string): Promise<Sharp> {
  const ext = extOf(input)
  if (ext === 'heic' || ext === 'heif') {
    const buf = await readFile(input)
    const png = await heicConvert({ buffer: buf, format: 'PNG' })
    return sharp(Buffer.from(png))
  }
  // density makes SVG render crisp instead of at 72 dpi
  return sharp(input, { density: ext === 'svg' ? 300 : undefined, animated: ext === 'gif' || ext === 'webp' })
}

export async function convertImage(
  input: string,
  target: string,
  output: string,
  opts: ConvertOptions
): Promise<void> {
  const quality = clamp(opts.quality ?? 85, 1, 100)
  let img = (await loadImage(input)).rotate() // honour EXIF orientation
  if (opts.width) img = img.resize({ width: opts.width, withoutEnlargement: true })

  switch (target) {
    case 'png':
      await img.png({ compressionLevel: 9, palette: quality < 70 }).toFile(output)
      return
    case 'jpg':
      await img.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toFile(output)
      return
    case 'webp':
      await img.webp({ quality }).toFile(output)
      return
    case 'avif':
      await img.avif({ quality: Math.round(quality * 0.75) }).toFile(output)
      return
    case 'tiff':
      await img.tiff({ quality, compression: 'lzw' }).toFile(output)
      return
    case 'gif':
      await img.gif().toFile(output)
      return
    case 'pdf':
      await imagesToPdf([input], output, { quality, fit: 'image' })
      return
    default:
      throw new Error(`Image to ${target} is not supported`)
  }
}

export interface ImagesToPdfOptions {
  quality?: number
  /** 'image' = page matches each image, 'a4' = image centred on A4 with margin */
  fit?: 'image' | 'a4'
}

export async function imagesToPdf(inputs: string[], output: string, o: ImagesToPdfOptions = {}): Promise<void> {
  const pdf = await PDFDocument.create()
  const quality = o.quality ?? 90
  for (const input of inputs) {
    const pipeline = (await loadImage(input)).rotate()
    const meta = await pipeline.metadata()
    const hasAlpha = !!meta.hasAlpha
    // PNG keeps transparency and sharp edges; JPEG keeps photos small.
    const bytes = hasAlpha
      ? await pipeline.png().toBuffer()
      : await pipeline.flatten({ background: '#fff' }).jpeg({ quality, mozjpeg: true }).toBuffer()
    const embedded = hasAlpha ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
    if (o.fit === 'a4') {
      const [pw, ph] = [595.28, 841.89]
      const margin = 36
      const scale = Math.min((pw - margin * 2) / embedded.width, (ph - margin * 2) / embedded.height, 1)
      const w = embedded.width * scale
      const h = embedded.height * scale
      const page = pdf.addPage([pw, ph])
      page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    } else {
      // 72 dpi points; cap huge photos to a sensible page size
      const scale = Math.min(1, 1440 / Math.max(embedded.width, embedded.height))
      const w = embedded.width * scale
      const h = embedded.height * scale
      const page = pdf.addPage([w, h])
      page.drawImage(embedded, { x: 0, y: 0, width: w, height: h })
    }
  }
  await writeFile(output, await pdf.save())
}

/** Writes raw PNG bytes (rendered by the UI from a PDF page) to the requested format. */
export async function encodeRendered(png: Uint8Array, target: string, output: string, quality = 90): Promise<number> {
  let img = sharp(Buffer.from(png))
  if (target === 'jpg') img = img.flatten({ background: '#fff' }).jpeg({ quality, mozjpeg: true })
  else if (target === 'webp') img = img.webp({ quality })
  else img = img.png({ compressionLevel: 9 })
  await img.toFile(output)
  return (await stat(output)).size
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}
