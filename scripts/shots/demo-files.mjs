// Realistic-looking sample files for the README screenshots. Everything is
// drawn here: no personal photos or documents end up in the repository.
import { mkdir, writeFile, readFile } from 'fs/promises'
import { execFileSync } from 'child_process'
import { join } from 'path'
import sharp from 'sharp'
import ffmpeg from 'ffmpeg-static'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

XLSX.set_fs(fs)

/** A calm landscape at dusk: layered hills under a low sun. */
function landscape(w, h, hue) {
  const hills = [0.62, 0.7, 0.8]
    .map((y, i) => {
      const base = h * y
      const pts = Array.from({ length: 9 }, (_, k) => `${(w / 8) * k},${base + Math.sin(k * 1.3 + i * 2) * h * 0.05}`).join(' ')
      const shade = ['#2b4c7e', '#1d3557', '#11213d'][i]
      return `<polygon points="0,${h} ${pts} ${w},${h}" fill="${shade}"/>`
    })
    .join('')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${hue},55%,28%)"/><stop offset=".55" stop-color="hsl(${hue + 25},70%,62%)"/><stop offset="1" stop-color="#f4b860"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#sky)"/>
    <circle cx="${w * 0.68}" cy="${h * 0.58}" r="${h * 0.09}" fill="#ffe2a8" opacity=".95"/>
    ${hills}
  </svg>`)
}

async function proposalPdf(file) {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.08, 0.15, 0.3)
  const grey = rgb(0.42, 0.47, 0.56)
  const accent = rgb(0.96, 0.72, 0.38)
  const blue = rgb(0.18, 0.5, 0.88)
  const lines = (page, y, n, width = 470) => {
    for (let i = 0; i < n; i++) page.drawRectangle({ x: 62, y: y - i * 16, width: i === n - 1 ? width * 0.6 : width, height: 6, color: rgb(0.86, 0.88, 0.92) })
  }
  const photo = await doc.embedJpg(await sharp(landscape(1200, 700, 215)).jpeg({ quality: 85 }).toBuffer())

  // 1: cover
  let p = doc.addPage([595, 842])
  p.drawRectangle({ x: 62, y: 610, width: 44, height: 6, color: accent })
  p.drawText('Project proposal', { x: 62, y: 560, size: 38, font: bold, color: ink })
  p.drawText('IO Convert, private document tools', { x: 62, y: 528, size: 13, font: regular, color: grey })
  p.drawImage(photo, { x: 62, y: 220, width: 471, height: 275 })
  p.drawText('Warsaw, November 2026', { x: 62, y: 90, size: 10, font: regular, color: grey })
  // 2-6: content pages with headings, text bars and a chart
  const titles = ['Summary', 'The problem', 'Approach', 'Timeline', 'Budget']
  titles.forEach((title, k) => {
    p = doc.addPage([595, 842])
    p.drawText(title, { x: 62, y: 760, size: 22, font: bold, color: ink })
    p.drawRectangle({ x: 62, y: 746, width: 28, height: 4, color: accent })
    lines(p, 712, 7)
    if (k % 2 === 0) {
      const bars = [0.45, 0.7, 0.55, 0.9, 0.65, 0.8]
      bars.forEach((v, i) => p.drawRectangle({ x: 80 + i * 70, y: 360, width: 40, height: 220 * v, color: i === 3 ? blue : rgb(0.72, 0.8, 0.93) }))
      p.drawRectangle({ x: 62, y: 356, width: 470, height: 1.5, color: grey })
    } else p.drawImage(photo, { x: 62, y: 330, width: 471, height: 275 })
    lines(p, 290, 9)
    p.drawText(String(k + 2), { x: 528, y: 50, size: 9, font: regular, color: grey })
  })
  await writeFile(file, await doc.save())
}

export async function makeDemoFiles(dir) {
  await mkdir(dir, { recursive: true })
  const f = (n) => join(dir, n)
  await sharp(landscape(3000, 2000, 220)).jpeg({ quality: 88 }).toFile(f('Kraków trip 042.jpg'))
  await sharp(landscape(2400, 1600, 260)).jpeg({ quality: 90 }).toFile(f('Lake at dusk.jpg'))
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#fbf9f3"/><rect x="560" y="210" width="480" height="480" rx="150" fill="#12213f"/><rect x="700" y="330" width="56" height="240" rx="28" fill="#f4b860"/><circle cx="900" cy="450" r="92" fill="none" stroke="#6fb6ff" stroke-width="56"/></svg>`
    )
  )
    .png()
    .toFile(f('Logo draft.png'))
  await proposalPdf(f('Project proposal.pdf'))
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'smptebars=duration=3:size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f('Product demo.mp4')], { stdio: 'ignore' })
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=8', f('Voice memo.wav')], { stdio: 'ignore' })
  const docx = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: 'Chapter 3: Method', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun('Files are converted locally, so nothing leaves the computer. ')] })
        ]
      }
    ]
  })
  await writeFile(f('Thesis chapter 3.docx'), await Packer.toBuffer(docx))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { month: 'January', rent: 2400, food: 900, travel: 300 },
      { month: 'February', rent: 2400, food: 850, travel: 120 }
    ]),
    'Budget'
  )
  XLSX.writeFile(wb, f('Budget 2026.xlsx'))
  await writeFile(f('README.md'), '# Notes\n\nA short **Markdown** file with a list:\n\n- convert\n- merge\n- sign\n')
  return { proposal: f('Project proposal.pdf'), bytes: await readFile(f('Project proposal.pdf')) }
}
