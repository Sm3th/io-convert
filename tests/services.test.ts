import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, writeFile, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { execFile, execFileSync } from 'child_process'
import sharp from 'sharp'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { Document, Packer, Paragraph, HeadingLevel } from 'docx'
import * as XLSX from 'xlsx'
import { convert } from '../src/main/services/convert'
import { setHtmlPrinter, findOffice } from '../src/main/services/document'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { FFMPEG, cancelMedia, convertMedia } from '../src/main/services/media'
import * as pdf from '../src/main/services/pdf'
import { imagesToPdf } from '../src/main/services/image'
import { configureOcr, ocrToText } from '../src/main/services/ocr'
import { targetsFor } from '../src/shared/formats'

let dir = ''
const f = (n: string) => join(dir, n)
// Headless Chrome (or Edge on Windows) stands in for Electron's printToPDF during tests.
const CHROME =
  process.env.CHROME_PATH ||
  [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ].find((p) => existsSync(p)) ||
  'google-chrome'

async function isPdf(p: string) {
  const b = await readFile(p)
  return b.subarray(0, 5).toString() === '%PDF-'
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ioc-test-'))
  setHtmlPrinter(
    (html, out) =>
      new Promise((res, rej) =>
        execFile(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', `--print-to-pdf=${out}`, '--no-pdf-header-footer', html], (e) => (e ? rej(e) : res()))
      )
  )
  // Set TESSDATA_PATH to use local language data; otherwise it is downloaded once.
  configureOcr({ cachePath: join(tmpdir(), 'ioc-tessdata'), langPath: process.env.TESSDATA_PATH })
  // fixtures
  const photo = sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7bd5' } }).composite([
    { input: Buffer.from(`<svg width="2400" height="1600"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#0f0"/></linearGradient></defs><rect width="2400" height="1600" fill="url(#g)"/><circle cx="1200" cy="800" r="500" fill="#fff8"/></svg>`) }
  ])
  await photo.clone().jpeg({ quality: 95 }).toFile(f('photo.jpg'))
  await photo.clone().png().toFile(f('photo.png'))
  await writeFile(
    f('text.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220"><rect width="100%" height="100%" fill="white"/><text x="30" y="140" font-size="90" font-family="DejaVu Sans">Hello OCR 2026</text></svg>`
  )
  execFileSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', f('clip.mp4')], { stdio: 'ignore' })
  execFileSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', f('tone.wav')], { stdio: 'ignore' })
  const docx = new Document({ sections: [{ children: [new Paragraph({ text: 'Raport Zażółć gęślą jaźń', heading: HeadingLevel.HEADING_1 }), new Paragraph('Türkçe karakterler: ğüşıöç')] }] })
  await writeFile(f('report.docx'), await Packer.toBuffer(docx))
  await writeFile(f('notes.md'), '# Notes\n\nSome **bold** and *italic* text with a [link](https://example.com).\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\n```js\nconsole.log(1)\n```\n')
  await writeFile(f('page.html'), '<html><body><h1>Hello</h1><p>World <b>bold</b></p><ul><li>a</li></ul></body></html>')
  await writeFile(f('plain.txt'), 'Line one\nLine two — ąęł')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ name: 'Ala', city: 'Kraków', n: 3 }, { name: 'Ömer', city: 'İzmir', n: 5 }]), 'People')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ a: 1 }]), 'Other')
  XLSX.writeFile(wb, f('data.xlsx'))
  await writeFile(f('rows.json'), JSON.stringify([{ id: 1, user: { name: 'x' } }, { id: 2, user: { name: 'y' } }]))
  // multi-page PDF with a big photo for compression tests
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const jpg = await doc.embedJpg(await readFile(f('photo.jpg')))
  for (let i = 0; i < 5; i++) {
    const p = doc.addPage([595, 842])
    p.drawText(`Page ${i + 1}`, { x: 50, y: 780, size: 24, font })
    p.drawImage(jpg, { x: 50, y: 300, width: 495, height: 330 })
  }
  await writeFile(f('doc.pdf'), await doc.save())
})

const req = (input: string, target: string, options = {}) => ({ jobId: Math.random().toString(36), input: f(input), target, options })

describe('format matrix', () => {
  it('offers sensible targets', () => {
    expect(targetsFor('jpeg')).toContain('webp')
    expect(targetsFor('jpg')).not.toContain('jpg')
    expect(targetsFor('docx')).toEqual(['pdf', 'html', 'txt', 'md'])
    expect(targetsFor('exe')).toEqual([])
  })
})

describe('images', () => {
  for (const t of ['png', 'webp', 'avif', 'tiff', 'gif', 'pdf']) {
    it(`jpg → ${t}`, async () => {
      const r = await convert(req('photo.jpg', t, { quality: 80 }), () => {})
      expect(r.size).toBeGreaterThan(100)
      expect(r.output.endsWith('.' + t)).toBe(true)
    })
  }
  it('resizes and does not overwrite', async () => {
    const a = await convert(req('photo.png', 'jpg', { width: 800 }), () => {})
    const b = await convert(req('photo.png', 'jpg', { width: 800 }), () => {})
    expect(a.output).not.toBe(b.output)
    expect((await sharp(a.output).metadata()).width).toBe(800)
  })
  it('svg → png', async () => {
    const r = await convert(req('text.svg', 'png'), () => {})
    expect((await sharp(r.output).metadata()).width).toBeGreaterThan(900)
  })
  it('images → one PDF', async () => {
    const out = f('album.pdf')
    await imagesToPdf([f('photo.jpg'), f('photo.png')], out, { fit: 'a4' })
    expect((await PDFDocument.load(await readFile(out))).getPageCount()).toBe(2)
  })
  it('OCR image → text', async () => {
    const r = await convert(req('text.svg', 'txt', { ocrLangs: 'eng' }), () => {})
    expect(await readFile(r.output, 'utf8')).toMatch(/Hello OCR/)
  })
})

describe('media', () => {
  for (const t of ['webm', 'mkv', 'gif', 'mp3', 'm4a']) {
    it(`mp4 → ${t}`, async () => {
      const seen: number[] = []
      const r = await convert(req('clip.mp4', t, { resolution: '720', videoQuality: 'small' }), (p) => seen.push(p))
      expect(r.size).toBeGreaterThan(1000)
      expect(seen.at(-1)).toBe(100)
    })
  }
  for (const t of ['mp3', 'flac', 'ogg', 'opus']) {
    it(`wav → ${t}`, async () => {
      const r = await convert(req('tone.wav', t, { audioBitrate: '128' }), () => {})
      expect(r.size).toBeGreaterThan(1000)
    })
  }
})

describe('documents', () => {
  it('docx → pdf / html / txt / md', async () => {
    for (const t of ['pdf', 'html', 'txt', 'md']) {
      const r = await convert(req('report.docx', t), () => {})
      if (t === 'pdf') expect(await isPdf(r.output)).toBe(true)
      else expect(await readFile(r.output, 'utf8')).toMatch(/Zażółć|Za.*/)
    }
  })
  it('markdown → docx / pdf / html', async () => {
    for (const t of ['docx', 'pdf', 'html']) {
      const r = await convert(req('notes.md', t), () => {})
      expect(r.size).toBeGreaterThan(200)
    }
  })
  it('html → pdf / md / docx', async () => {
    expect(await isPdf((await convert(req('page.html', 'pdf'), () => {})).output)).toBe(true)
    expect(await readFile((await convert(req('page.html', 'md'), () => {})).output, 'utf8')).toMatch(/# Hello/)
    expect((await convert(req('page.html', 'docx'), () => {})).size).toBeGreaterThan(500)
  })
  it('txt → pdf / docx', async () => {
    expect(await isPdf((await convert(req('plain.txt', 'pdf'), () => {})).output)).toBe(true)
    expect((await convert(req('plain.txt', 'docx'), () => {})).size).toBeGreaterThan(500)
  })
  it('reports whether LibreOffice is available', () => {
    expect(typeof (findOffice() ?? '')).toBe('string')
  })
})

describe('spreadsheets', () => {
  it('xlsx → csv keeps unicode', async () => {
    const r = await convert(req('data.xlsx', 'csv'), () => {})
    expect(await readFile(r.output, 'utf8')).toMatch(/Kraków/)
  })
  it('xlsx → json has both sheets', async () => {
    const r = await convert(req('data.xlsx', 'json'), () => {})
    expect(Object.keys(JSON.parse(await readFile(r.output, 'utf8')))).toEqual(['People', 'Other'])
  })
  it('json → xlsx flattens nested', async () => {
    const r = await convert(req('rows.json', 'xlsx'), () => {})
    const wb = XLSX.read(await readFile(r.output))
    expect(Object.keys(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Sheet1)[0])).toContain('user.name')
  })
  it('xlsx → pdf / html / ods', async () => {
    for (const t of ['pdf', 'html', 'ods']) expect((await convert(req('data.xlsx', t), () => {})).size).toBeGreaterThan(300)
  })
})

describe('pdf tools', () => {
  it('info', async () => {
    expect((await pdf.info(f('doc.pdf'))).pages).toBe(5)
  })
  it('merge + split by ranges / each', async () => {
    const m = await pdf.merge([f('doc.pdf'), f('doc.pdf')], f('merged.pdf'))
    expect((await pdf.info(m.output)).pages).toBe(10)
    const parts = await pdf.split(f('merged.pdf'), { mode: 'ranges', ranges: '1-3, 7, 9-' }, dir)
    expect(parts).toHaveLength(3)
    expect((await pdf.info(parts[2])).pages).toBe(2)
    expect(await pdf.split(f('doc.pdf'), { mode: 'each' }, dir)).toHaveLength(5)
    expect(() => pdf.parseRanges('4-2', 5)).toThrow()
  })
  it('organize reorders, rotates, drops', async () => {
    const r = await pdf.organize(f('doc.pdf'), [{ index: 4, rotate: 90 }, { index: 0, rotate: 0 }], f('org.pdf'))
    const d = await PDFDocument.load(await readFile(r.output))
    expect(d.getPageCount()).toBe(2)
    expect(d.getPage(0).getRotation().angle).toBe(90)
  })
  it('compress shrinks photo PDFs', async () => {
    const r = await pdf.compress(f('doc.pdf'), 'strong', f('small.pdf'))
    expect(r.after).toBeLessThan(r.before * 0.7)
    expect(r.images).toBeGreaterThan(0)
    expect((await pdf.info(r.output)).pages).toBe(5)
  })
  it('protect then unlock', async () => {
    await pdf.protect(f('doc.pdf'), { userPassword: 'tajne123', allowCopying: false, allowEditing: false, allowPrinting: true }, f('locked.pdf'))
    expect((await pdf.info(f('locked.pdf'))).encrypted).toBe(true)
    await expect(pdf.unlock(f('locked.pdf'), 'nope', f('x.pdf'))).rejects.toThrow()
    const u = await pdf.unlock(f('locked.pdf'), 'tajne123', f('unlocked.pdf'))
    const i = await pdf.info(u.output)
    expect(i.pages).toBe(5)
    expect(i.encrypted).toBe(false)
  })
  it('watermark, page numbers, annotate with unicode', async () => {
    await pdf.watermark(f('doc.pdf'), { text: 'POUFNE • GİZLİ', opacity: 20, size: 12, color: '#ff0000', diagonal: true }, f('wm.pdf'))
    await pdf.pageNumbers(f('org.pdf'), { position: 'bottom-center', format: 'n-of-total', start: 1, size: 10 }, f('num.pdf'))
    const sig = await sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    const r = await pdf.annotate(
      f('org.pdf'),
      [
        { kind: 'text', page: 0, x: 0.1, y: 0.1, w: 0.3, h: 0.05, text: 'Ğüşıöç łąę\nsecond line', color: '#0033cc' },
        { kind: 'rect', page: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
        { kind: 'highlight', page: 1, x: 0.1, y: 0.2, w: 0.2, h: 0.05 },
        { kind: 'image', page: 1, x: 0.6, y: 0.8, w: 0.25, h: 0.08, image: new Uint8Array(sig) }
      ],
      f('signed.pdf')
    )
    expect(r.size).toBeGreaterThan(1000)
    for (const p of ['wm.pdf', 'num.pdf', 'signed.pdf']) expect(existsSync(f(p))).toBe(true)
  })
  it('metadata round trip', async () => {
    await pdf.setMetadata(f('doc.pdf'), { title: 'Umowa', author: 'İsmet' }, f('meta.pdf'))
    expect((await pdf.info(f('meta.pdf'))).author).toBe('İsmet')
  })
})

describe('robustness', () => {
  it('runs overlapping OCR jobs on the shared worker', async () => {
    // The Convert page runs two files at once; both must finish intact.
    const [a, b] = await Promise.all([
      ocrToText([f('text.svg')], 'eng', f('ocr-a.txt'), () => {}),
      ocrToText([f('text.svg')], 'eng', f('ocr-b.txt'), () => {})
    ]).then(() => Promise.all([readFile(f('ocr-a.txt'), 'utf8'), readFile(f('ocr-b.txt'), 'utf8')]))
    expect(a).toMatch(/Hello OCR/)
    expect(b).toMatch(/Hello OCR/)
  })
  it('removes the partial file when a media job is cancelled', async () => {
    execFileSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=60:size=1280x720:rate=30', '-c:v', 'libx264', '-preset', 'ultrafast', f('long.mp4')], { stdio: 'ignore' })
    const out = f('long-cancelled.webm')
    const job = convertMedia('cancel-me', f('long.mp4'), 'webm', out, {}, () => {})
    await new Promise((r) => setTimeout(r, 1500))
    expect(cancelMedia('cancel-me')).toBe(true)
    await expect(job).rejects.toThrow('Cancelled')
    expect(existsSync(out)).toBe(false)
  })
  it('explains a video without sound instead of passing on the FFmpeg log', async () => {
    // long.mp4 (made above) has a video stream only
    const out = f('silent.mp3')
    await expect(convertMedia('silent', f('long.mp4'), 'mp3', out, {}, () => {})).rejects.toThrow('This file has no audio track')
    expect(existsSync(out)).toBe(false)
  })
  it('prints page numbers in the UI language', async () => {
    const r = await pdf.pageNumbers(f('doc.pdf'), { position: 'bottom-center', format: 'page-n', start: 1, size: 10, pageWord: 'Sayfa' }, f('sayfa.pdf'))
    const doc = await getDocument({ data: new Uint8Array(await readFile(r.output)) }).promise
    const firstPage = await (await doc.getPage(1)).getTextContent()
    const text = firstPage.items.map((i) => ('str' in i ? i.str : '')).join(' ')
    // (the fixture itself draws "Page 1" as a heading, so only the label is checked)
    expect(text).toContain('Sayfa 1')
    await doc.loadingTask.destroy()
  })
})

describe('localized file names', () => {
  it('names split files in the UI language', async () => {
    const out = await pdf.split(f('doc.pdf'), { mode: 'ranges', ranges: '1, 2-3' }, dir, undefined, { page: 'sayfa', pages: 'sayfalar' })
    expect(out.map((p) => basename(p))).toEqual(['doc — sayfa 1.pdf', 'doc — sayfalar 2-3.pdf'])
  })
})

it('keeps outputs for inspection', async () => {
  expect((await stat(dir)).isDirectory()).toBe(true)
})
