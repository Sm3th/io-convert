import { createWorker, type Worker } from 'tesseract.js'
import { writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { loadImage } from './image'
import { assemble } from './pdf'

// Language data is downloaded once on first use and cached here.
let cachePath: string | undefined
let langPath: string | undefined
export function configureOcr(o: { cachePath?: string; langPath?: string }): void {
  cachePath = o.cachePath
  langPath = o.langPath
}

let worker: Worker | null = null
let workerLangs = ''

async function getWorker(langs: string): Promise<Worker> {
  if (worker && workerLangs === langs) return worker
  if (worker) await worker.terminate()
  // Worker threads cannot start from inside app.asar, so point at the unpacked copy.
  const workerPath = join(
    dirname(require.resolve('tesseract.js/package.json')),
    'src/worker-script/node/index.js'
  ).replace('app.asar', 'app.asar.unpacked')
  worker = await createWorker(langs.split('+'), 1, {
    workerPath,
    cachePath,
    ...(langPath ? { langPath } : {}),
    logger: (m: { status: string; progress: number }) => onProgressRef?.(m.progress, m.status)
  })
  workerLangs = langs
  return worker
}
// Tesseract's logger is bound at worker creation; route it to the current job.
let onProgressRef: ((p: number, stage: string) => void) | null = null

// There is one shared worker and one progress route, so OCR jobs must not
// overlap. The Convert page runs two files at a time: without this queue, two
// images → text would race to create the worker (leaking one), and a job with
// other languages would terminate the worker mid-recognition.
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => {})
  return run
}

/** Prepares any image (HEIC, SVG, WebP…) as PNG bytes Tesseract can read. */
async function toPng(input: string | Uint8Array): Promise<Buffer> {
  if (typeof input !== 'string') return Buffer.from(input)
  return (await loadImage(input)).rotate().png().toBuffer()
}

export function ocrToText(
  inputs: (string | Uint8Array)[],
  langs: string,
  output: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return exclusive(async () => {
    const parts: string[] = []
    try {
      for (let i = 0; i < inputs.length; i++) {
        onProgressRef = (p, stage) => {
          if (stage.startsWith('recognizing')) onProgress(((i + p) / inputs.length) * 100)
        }
        const w = await getWorker(langs)
        const { data } = await w.recognize(await toPng(inputs[i]))
        parts.push(data.text.trim())
      }
    } finally {
      onProgressRef = null
    }
    await writeFile(output, parts.join('\n\n\f\n\n'), 'utf8')
  })
}

export function ocrToPdf(
  inputs: (string | Uint8Array)[],
  langs: string,
  output: string,
  onProgress: (pct: number) => void
): Promise<{ output: string; size: number }> {
  return exclusive(async () => {
    const pdfs: Uint8Array[] = []
    try {
      for (let i = 0; i < inputs.length; i++) {
        onProgressRef = (p, stage) => {
          if (stage.startsWith('recognizing')) onProgress(((i + p) / inputs.length) * 100)
        }
        const w = await getWorker(langs)
        const { data } = await w.recognize(await toPng(inputs[i]), { pdfTitle: 'IO Convert OCR' }, { pdf: true, text: false })
        if (!data.pdf) throw new Error('OCR did not return a PDF page')
        pdfs.push(Uint8Array.from(data.pdf))
      }
    } finally {
      onProgressRef = null
    }
    return assemble(pdfs, output)
  })
}

export function shutdownOcr(): Promise<void> {
  return exclusive(async () => {
    if (worker) await worker.terminate()
    worker = null
  })
}
