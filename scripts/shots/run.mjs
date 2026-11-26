// README screenshots: `npm run shots` (after `npm run build`).
//
// Makes demo files, opens each screen of the built app through the
// development-only IO_SHOT_PLAN mode and writes the images to docs/screenshots.
// The hero image puts the dark and light themes side by side.
import { mkdtemp, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { makeDemoFiles } from './demo-files.mjs'

const root = resolve(fileURLToPath(import.meta.url), '../../..')
const outDir = join(root, 'docs/screenshots')
if (!existsSync(join(root, 'out/main/index.js'))) {
  console.error('Build the app first: npm run build')
  process.exit(1)
}

const work = await mkdtemp(join(tmpdir(), 'ioc-shots-'))
const demo = join(work, 'demo')
await makeDemoFiles(demo)
const slash = (p) => p.split(String.fromCharCode(92)).join('/')
const D = (n) => slash(join(demo, n))

// Small helpers available to every scenario script.
const prelude = `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $$ = (s) => [...document.querySelectorAll(s)];
const btn = (t) => $$('button').find((b) => b.textContent.trim() === t);
const waitFor = async (fn, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); } return null; };
const setVal = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
`
const script = (body) => `(async () => { ${prelude} ${body}; return true })()`

const batch = ['Kraków trip 042.jpg', 'Logo draft.png', 'Product demo.mp4', 'Voice memo.wav', 'Thesis chapter 3.docx', 'Budget 2026.xlsx', 'Project proposal.pdf', 'README.md'].map(D)
const convertAndWait = script(`
  await waitFor(() => $$('[data-testid=job]').length >= 8);
  btn('Convert files').click();
  await sleep(1200);
  await waitFor(() => !btn('Cancel'), 180000);
  await sleep(900)`)

const signature = script(`
  let pg = await waitFor(() => document.querySelector('[data-page]')); await sleep(1000);
  for (let i = 0; i < 3; i++) { $$('button[aria-label="Zoom"]')[0].click(); await sleep(150); }
  await sleep(800); pg = document.querySelector('[data-page]');
  btn('Signature').click();
  const pad = await waitFor(() => document.querySelector('[role=dialog] canvas')); await sleep(300);
  const r = pad.getBoundingClientRect();
  const fire = (type, x, y) => pad.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, pointerId: 7 }));
  // A looping hand-written stroke (prolate cycloid) with a tall first letter and an underline.
  const stroke = (pts) => { fire('pointerdown', ...pts[0]); for (const p of pts.slice(1)) fire('pointermove', ...p); fire('pointerup', ...pts[pts.length - 1]); };
  stroke(Array.from({ length: 40 }, (_, i) => { const t = i / 39; return [0.14 + Math.sin(t * Math.PI) * 0.03, 0.15 + t * 0.62]; }));
  stroke(Array.from({ length: 260 }, (_, i) => { const t = (i / 259) * 7 * Math.PI; return [0.2 + t * 0.026 - 0.035 * Math.sin(t), 0.55 - 0.2 * Math.cos(t) * (1 - i / 520)]; }));
  stroke(Array.from({ length: 50 }, (_, i) => { const t = i / 49; return [0.12 + t * 0.74, 0.86 - Math.sin(t * Math.PI) * 0.04]; }));
  await sleep(200);
  btn('Use signature').click(); await sleep(600);
  // move it from the default spot to the blank lower right of the page
  const sig = document.querySelector('[data-page] [data-item]');
  if (sig) {
    const s = sig.getBoundingClientRect(); const pr = pg.getBoundingClientRect();
    sig.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: s.left + 5, clientY: s.top + 5, pointerId: 3 }));
    const stage = pg.parentElement;
    stage.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: pr.left + pr.width * 0.58 + 5, clientY: pr.top + pr.height * 0.80 + 5, pointerId: 3 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3 }));
    await sleep(200);
  }
  btn('Text').click(); await sleep(150);
  const p = pg.getBoundingClientRect();
  pg.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p.left + p.width * 0.12, clientY: p.top + p.height * 0.86, pointerId: 1 }));
  const ta = await waitFor(() => document.querySelector('[data-page] textarea'), 3000);
  setVal(ta, 'Approved, 26 November 2026'); await sleep(100); ta.blur(); await sleep(300);
  const img = document.querySelector('[data-page] [data-item] img'); img && img.closest('[data-item]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))`)

const organize = script(`
  await waitFor(() => $$('[data-testid=page-card] canvas').length >= 6); await sleep(900);
  const cards = $$('[data-testid=page-card]');
  cards[2].click(); await sleep(100);
  cards[3].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); await sleep(100);
  $$('button[aria-label="Rotate right"]')[0].click(); await sleep(600)`)

const shots = [
  { name: 'convert-batch', page: 'convert', theme: 'dark', files: batch, wait: 2500, after: 600, script: convertAndWait },
  { name: 'convert-batch-light', page: 'convert', theme: 'light', files: batch, wait: 2500, after: 600, script: convertAndWait },
  { name: 'convert', page: 'convert', theme: 'dark', wait: 1500 },
  { name: 'turkish', page: 'convert', theme: 'light', lang: 'tr', wait: 1500 },
  { name: 'organize', page: 'organize', theme: 'light', files: [D('Project proposal.pdf')], wait: 2500, after: 900, script: organize },
  { name: 'edit-sign', page: 'edit', theme: 'dark', files: [D('Project proposal.pdf')], wait: 2500, after: 900, script: signature },
  { name: 'watermark', page: 'watermark', theme: 'light', files: [D('Project proposal.pdf')], wait: 2500 },
  { name: 'compress', page: 'compress', theme: 'dark', files: [D('Project proposal.pdf')], wait: 2500, after: 1600, script: script(`btn('Compress PDF').click(); await waitFor(() => $$('p[title]').some((p) => /^Saved/.test(p.textContent)), 60000)`) },
  { name: 'palette', page: 'merge', theme: 'dark', wait: 1500, after: 500, script: script(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); const i = await waitFor(() => document.querySelector('[role=combobox]')); setVal(i, 'pdf')`) },
  { name: 'themes', page: 'settings', theme: 'light', wait: 1500 }
]
await writeFile(join(work, 'plan.json'), JSON.stringify({ dir: slash(outDir), shots }))

console.log(`Capturing ${shots.length} screens…`)
const electron = createRequire(import.meta.url)('electron')
const env = { ...process.env, IO_SHOT_PLAN: join(work, 'plan.json') }
delete env.ELECTRON_RUN_AS_NODE
await new Promise((res, rej) => {
  const p = spawn(electron, [root], { env, stdio: 'ignore' })
  p.on('exit', res)
  p.on('error', rej)
})

// Hero: dark on the left, light on the right, split along a slight diagonal.
const dark = join(outDir, 'convert-batch.png')
const light = join(outDir, 'convert-batch-light.png')
const { width, height } = await sharp(dark).metadata()
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${width * 0.56},0 ${width},0 ${width},${height} ${width * 0.44},${height}" fill="#fff"/></svg>`
)
const lightHalf = await sharp(light).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
await sharp(dark).composite([{ input: lightHalf }]).png({ compressionLevel: 9 }).toFile(join(outDir, 'hero.png'))

console.log(`Saved to ${outDir}`)
