// Copies PDF.js fonts, CMaps, ICC profiles and WASM decoders into the
// renderer's public folder so PDFs render fully offline.
import { cpSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const src = join('node_modules', 'pdfjs-dist')
const dest = join('src', 'renderer', 'public', 'pdfjs')
mkdirSync(dest, { recursive: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  if (existsSync(join(src, dir))) cpSync(join(src, dir), join(dest, dir), { recursive: true })
}
console.log('pdf.js assets copied to', dest)
