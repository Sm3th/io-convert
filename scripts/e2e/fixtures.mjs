// Sample files for the end-to-end run. Everything is generated, so the run
// never depends on personal files.
import { mkdir, writeFile, copyFile, readFile } from 'fs/promises'
import { execFileSync } from 'child_process'
import { join } from 'path'
import sharp from 'sharp'
import ffmpeg from 'ffmpeg-static'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { Document, Packer, Paragraph, HeadingLevel } from 'docx'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

XLSX.set_fs(fs)

export const LOCKED_PASSWORD = 'tajne123'

export async function makeFixtures(dir) {
  await mkdir(dir, { recursive: true })
  const f = (n) => join(dir, n)

  // images
  const photo = sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7bd5' } }).composite([
    {
      input: Buffer.from(
        `<svg width="2400" height="1600"><defs><linearGradient id="g"><stop offset="0" stop-color="#1d5fbf"/><stop offset="1" stop-color="#7fe0b8"/></linearGradient></defs><rect width="2400" height="1600" fill="url(#g)"/><circle cx="1200" cy="800" r="500" fill="#fff8"/></svg>`
      )
    }
  ])
  await photo.clone().jpeg({ quality: 92 }).toFile(f('photo.jpg'))
  await photo.clone().png().toFile(f('photo.png'))
  await sharp(f('photo.png')).resize(1200).tiff().toFile(f('photo.tiff'))
  await writeFile(
    f('text.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220"><rect width="100%" height="100%" fill="white"/><text x="30" y="140" font-size="90" font-family="Arial, DejaVu Sans, sans-serif">Hello OCR 2026</text></svg>`
  )
  await sharp(f('text.svg')).png().toFile(f('scan.png'))

  // media
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', f('clip.mp4')], { stdio: 'ignore' })
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=60:size=1280x720:rate=30', '-c:v', 'libx264', '-preset', 'ultrafast', f('long.mp4')], { stdio: 'ignore' })
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', f('tone.wav')], { stdio: 'ignore' })

  // documents
  const docx = new Document({
    sections: [{ children: [new Paragraph({ text: 'Raport Zażółć gęślą jaźń', heading: HeadingLevel.HEADING_1 }), new Paragraph('Türkçe karakterler: ğüşıöç')] }]
  })
  await writeFile(f('report.docx'), await Packer.toBuffer(docx))
  await writeFile(f('notes.md'), '# Notes\n\nSome **bold** and *italic* text.\n\n- one\n- two\n')
  await writeFile(f('page.html'), '<html><body><h1>Hello</h1><p>World <b>bold</b></p></body></html>')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ name: 'Ala', city: 'Kraków', n: 3 }, { name: 'Ömer', city: 'İzmir', n: 5 }]), 'People')
  XLSX.writeFile(wb, f('data.xlsx'))
  await writeFile(f('rows.json'), JSON.stringify([{ id: 1, user: { name: 'x' } }, { id: 2, user: { name: 'y' } }]))

  // PDFs: five pages with a photo each, a copy, and a password-protected one
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const jpg = await doc.embedJpg(await readFile(f('photo.jpg')))
  for (let i = 0; i < 5; i++) {
    const p = doc.addPage([595, 842])
    p.drawText(`Page ${i + 1}`, { x: 50, y: 780, size: 24, font, color: rgb(0.08, 0.15, 0.3) })
    p.drawImage(jpg, { x: 50, y: 300, width: 495, height: 330 })
  }
  await writeFile(f('doc.pdf'), await doc.save())
  await copyFile(f('doc.pdf'), f('doc2.pdf'))
  await copyFile(f('doc.pdf'), f('doc3.pdf'))
  const locked = await PDFDocument.load(await readFile(f('doc.pdf')))
  locked.encrypt({ userPassword: LOCKED_PASSWORD, ownerPassword: LOCKED_PASSWORD + '#owner', permissions: { printing: 'highResolution' } })
  await writeFile(f('locked.pdf'), await locked.save())
}
