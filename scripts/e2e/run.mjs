// End-to-end check of the built app: `npm run e2e`.
//
// Generates sample files, drives every screen of the real Electron app through
// the development-only IO_SHOT_PLAN mode, then opens the produced files and
// checks their contents. Screenshots of each step land next to the reports.
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { makeFixtures } from './fixtures.mjs'
import { buildScenarios } from './scenarios.mjs'

const root = resolve(fileURLToPath(import.meta.url), '../../..')
if (!existsSync(join(root, 'out/main/index.js'))) {
  console.error('Build the app first: npm run build')
  process.exit(1)
}

const work = await mkdtemp(join(tmpdir(), 'ioc-e2e-'))
const inDir = join(work, 'in')
const reportDir = join(work, 'reports')
const shotDir = join(work, 'screens')
await mkdir(reportDir, { recursive: true })
await mkdir(shotDir, { recursive: true })

console.log('Preparing sample files…')
await makeFixtures(inDir)
const scenarios = buildScenarios(inDir, reportDir)
await writeFile(join(work, 'plan.json'), JSON.stringify({ dir: shotDir, shots: scenarios }))

console.log(`Running ${scenarios.length} scenarios in Electron…`)
const electron = createRequire(import.meta.url)('electron')
const env = { ...process.env, IO_SHOT_PLAN: join(work, 'plan.json') }
delete env.ELECTRON_RUN_AS_NODE // set by some editors' terminals; would make Electron act as Node
await new Promise((res, rej) => {
  const p = spawn(electron, [root], { env, stdio: 'ignore' })
  const timer = setTimeout(() => (p.kill(), rej(new Error('Timed out after 20 minutes'))), 20 * 60_000)
  p.on('exit', () => (clearTimeout(timer), res()))
  p.on('error', rej)
})

// --- scenario reports
let failed = 0
for (const s of scenarios) {
  const file = join(reportDir, `${s.name}.json`)
  let r
  try {
    r = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    r = { ok: false, err: 'no report' }
  }
  const ok = r.ok && !r.errors?.length
  if (!ok) failed++
  const why = ok ? '' : `  ${r.err || r.crash || r.alert || (r.errors || []).join('; ') || ''}`.slice(0, 300)
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${s.name}${why}`)
}

// --- output contents
const pdfText = async (name, password) => {
  const doc = await getDocument({ data: new Uint8Array(await readFile(join(inDir, name))), password, verbosity: 0 }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ') + '\n'
  return { doc, text }
}
const files = await readdir(inDir)
const checks = {
  'merged PDF has 15 pages': async () => (await pdfText('doc — merged.pdf')).doc.numPages === 15,
  'organized PDF has 4 pages, first rotated': async () => {
    const { doc } = await pdfText('doc — organized.pdf')
    return doc.numPages === 4 && (await doc.getPage(1)).rotate === 90
  },
  'signed PDF contains the Turkish text': async () => (await pdfText('doc — signed.pdf')).text.includes('İmza: Ğüşıöç'),
  'watermark is on the page': async () => (await pdfText('doc — watermarked.pdf')).text.includes('CONFIDENTIAL'),
  'page numbers are on the page': async () => (await pdfText('doc — numbered.pdf')).text.includes('1 / 5'),
  'protected PDF needs its password': async () => {
    try {
      await pdfText('doc — protected.pdf')
      return false
    } catch (e) {
      return e.name === 'PasswordException' && (await pdfText('doc — protected.pdf', 'secret1')).doc.numPages === 5
    }
  },
  'unlocked PDF opens without a password': async () => (await pdfText('locked — unlocked.pdf')).doc.numPages === 5,
  'properties saved': async () => (await (await pdfText('doc — edited.pdf')).doc.getMetadata()).info.Title === 'Başlık — test',
  'OCR made the PDF searchable': async () => (await pdfText('scan — searchable.pdf')).text.replace(/\s+/g, ' ').includes('Hello OCR'),
  'OCR text file': async () => (await readFile(join(inDir, 'scan.txt'), 'utf8')).includes('Hello OCR'),
  'Word to PDF keeps Polish and Turkish letters': async () => (await pdfText('report.pdf')).text.includes('Zażółć'),
  'PDF to PNG wrote one image per page': async () => files.filter((f) => /^doc — page \d\.png$/.test(f)).length === 5,
  'cancelled job left no file behind': async () => !files.includes('long.gif')
}
for (const [name, fn] of Object.entries(checks)) {
  let ok = false
  try {
    ok = await fn()
  } catch {
    ok = false
  }
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`)
}

console.log(`\n${failed ? `${failed} failed` : 'All passed'} · screenshots and reports: ${work}`)
process.exit(failed ? 1 : 0)
