import { useEffect, useState, type ReactNode } from 'react'
import { ScanText, X, Plus } from 'lucide-react'
import { api, isPasswordError } from '@/lib/api'
import { bytes, fileName, uid } from '@/lib/format'
import { useT } from '@/lib/settings'
import { useAskPassword, useOutDir, usePdfFile, useTask, type PickedPdf } from '@/lib/hooks'
import { openPdf, renderToPng } from '@/lib/pdfjs'
import {
  Button,
  Check,
  DropTarget,
  ErrorNote,
  Field,
  IconButton,
  PageHeader,
  Panel,
  Progress,
  SavedFile,
  Segmented,
  Select,
  Slider,
  inputCls,
  cx
} from '@/components/ui'
import { EmptyDrop, FileSummary, PdfTool, usePdfDoc } from '@/components/PdfTool'
import { Thumb } from '@/components/Thumb'
import { OcrLangSelect } from './Convert'
import type { PageNumberOptions, WatermarkOptions } from '@shared/formats'

type Saved = { output: string; size: number }

function ActionButton({ busy, disabled, onClick, children }: { busy: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const t = useT()
  return (
    <Button variant="primary" className="h-10 w-full" disabled={busy || disabled} onClick={onClick}>
      {busy ? t('Working…') : children}
    </Button>
  )
}

/** Large first-page preview with an overlay, for tools that stamp pages. */
function StampPreview({ picker, overlay }: { picker: ReturnType<typeof usePdfFile>; overlay: ReactNode }) {
  const t = useT()
  const doc = usePdfDoc(picker.file)
  if (!picker.file) return null
  return (
    <DropTarget onFiles={(p) => picker.load(p[0])}>
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="truncate text-[13.5px] font-medium">{fileName(picker.file.path)}</p>
          <Button variant="quiet" onClick={picker.pick}>
            {t('Change file')}
          </Button>
        </div>
        <div className="flex justify-center bg-ink/40 py-8">
          <div className="relative overflow-hidden">
            {doc ? <Thumb doc={doc} page={0} width={360} /> : <div className="h-[509px] w-[360px]" />}
            <div className="pointer-events-none absolute inset-0">{overlay}</div>
          </div>
        </div>
      </Panel>
    </DropTarget>
  )
}

// ---------------------------------------------------------------- Split
export function Split() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<string[]>()
  const [mode, setMode] = useState<'ranges' | 'each' | 'every'>('ranges')
  const [ranges, setRanges] = useState('1-2, 3-')
  const [n, setN] = useState(2)
  const run = () =>
    task.run(() =>
      api.split(
        picker.file!.path,
        mode === 'ranges' ? { mode, ranges } : mode === 'every' ? { mode, n } : { mode },
        outDir,
        picker.file!.password
      )
    )
  return (
    <PdfTool
      title="Split"
      description="Save page ranges, every page, or fixed-size chunks as separate PDFs."
      picker={picker}
      options={
        <>
          <Field label={t('Split by')}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'ranges', label: t('Ranges') },
                { value: 'each', label: t('Each page') },
                { value: 'every', label: t('Chunks') }
              ]}
            />
          </Field>
          {mode === 'ranges' && (
            <Field label={t('Ranges, e.g. 1-3, 5, 8-')} hint={t('Each comma-separated range becomes its own PDF.')}>
              <input className={inputCls} value={ranges} onChange={(e) => setRanges(e.target.value)} />
            </Field>
          )}
          {mode === 'every' && (
            <Field label={t('Pages per file')}>
              <input type="number" min={1} className={inputCls} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value)))} />
            </Field>
          )}
        </>
      }
      action={
        <ActionButton busy={task.busy} disabled={!picker.file} onClick={run}>
          {t('Split PDF')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={
        task.result && (
          <SavedFile path={task.result[0]} note={t('Saved {n} files', { n: task.result.length })} />
        )
      }
    />
  )
}

// ---------------------------------------------------------------- Compress
export function Compress() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<{ output: string; before: number; after: number }>()
  const [level, setLevel] = useState<'light' | 'balanced' | 'strong'>('balanced')
  const hints = { light: 'Keeps photos sharp. Small savings.', balanced: 'Good for email and sharing.', strong: 'Smallest file. Photos get softer.' }
  async function run() {
    const out = await api.outputPath(picker.file!.path, 'pdf', outDir, ' — compressed')
    await task.run(() => api.compress(picker.file!.path, level, out, picker.file!.password))
  }
  const r = task.result
  const pct = r ? Math.round((1 - r.after / r.before) * 100) : 0
  return (
    <PdfTool
      title="Compress"
      description="Shrink PDFs by re-encoding photos and repacking the file."
      picker={picker}
      options={
        <Field label={t('Level')} hint={t(hints[level])}>
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: 'light', label: t('Light') },
              { value: 'balanced', label: t('Balanced') },
              { value: 'strong', label: t('Strong') }
            ]}
          />
        </Field>
      }
      action={
        <ActionButton busy={task.busy} disabled={!picker.file} onClick={run}>
          {t('Compress PDF')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={
        r && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-ink/50 p-4">
              <p className="font-display text-3xl font-semibold text-cyan">{pct > 0 ? t('{pct}% smaller', { pct }) : t('Already as small as it gets')}</p>
              <p className="mt-1 text-[13px] text-faded">{t('{before} to {after}', { before: bytes(r.before), after: bytes(r.after) })}</p>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 rounded-full bg-line" />
                <div className="h-2 rounded-full bg-cyan" style={{ width: `${Math.max(3, (r.after / r.before) * 100)}%` }} />
              </div>
            </div>
            <SavedFile path={r.output} size={r.after} />
          </div>
        )
      }
    />
  )
}

// ---------------------------------------------------------------- Watermark
export function Watermark() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<Saved>()
  const [o, setO] = useState<WatermarkOptions>({ text: t('CONFIDENTIAL'), opacity: 18, size: 11, color: '#d22f2f', diagonal: true })
  const set = (p: Partial<WatermarkOptions>) => setO((x) => ({ ...x, ...p }))
  async function run() {
    const out = await api.outputPath(picker.file!.path, 'pdf', outDir, ' — watermarked')
    await task.run(() => api.watermark(picker.file!.path, o, out, picker.file!.password))
  }
  return (
    <PdfTool
      title="Watermark"
      description="Stamp text across every page."
      picker={picker}
      main={() => (
        <StampPreview
          picker={picker}
          overlay={
            <div className="flex h-full items-center justify-center">
              <span
                className="whitespace-nowrap font-bold"
                style={{
                  color: o.color,
                  opacity: o.opacity / 100,
                  fontSize: `${(360 * o.size) / 100}px`,
                  fontFamily: 'Arial, sans-serif',
                  transform: o.diagonal ? `rotate(-${(Math.atan2(842, 595) * 180) / Math.PI}deg)` : undefined
                }}
              >
                {o.text}
              </span>
            </div>
          }
        />
      )}
      options={
        <>
          <Field label={t('Watermark text')}>
            <input className={inputCls} value={o.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label={t('Size')}>
            <Slider value={o.size} min={4} max={25} onChange={(size) => set({ size })} suffix="%" />
          </Field>
          <Field label={t('Opacity')}>
            <Slider value={o.opacity} min={5} max={100} onChange={(opacity) => set({ opacity })} suffix="%" />
          </Field>
          <Field label={t('Color')}>
            <ColorRow value={o.color} onChange={(color) => set({ color })} colors={['#d22f2f', '#1f5fbf', '#111111', '#808080', '#1c8a4a']} />
          </Field>
          <Check checked={o.diagonal} onChange={(diagonal) => set({ diagonal })} label={t('Diagonal')} />
        </>
      }
      action={
        <ActionButton busy={task.busy} disabled={!picker.file || !o.text.trim()} onClick={run}>
          {t('Add watermark')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={task.result && <SavedFile path={task.result.output} size={task.result.size} />}
    />
  )
}

export function ColorRow({ value, onChange, colors, small }: { value: string; onChange: (c: string) => void; colors: string[]; small?: boolean }) {
  const dot = small ? 'h-5 w-5' : 'h-7 w-7'
  return (
    <div className="flex items-center gap-2">
      {colors.map((c) => (
        <button
          key={c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cx(dot, 'shrink-0 rounded-full border-2 transition-transform', value === c ? 'scale-110 border-paper' : 'border-transparent')}
          style={{ background: c }}
        />
      ))}
      <label className={cx(dot, 'relative shrink-0 cursor-pointer overflow-hidden rounded-full border border-line-strong')} style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  )
}

// ---------------------------------------------------------------- Page numbers
export function PageNumbers() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<Saved>()
  const [o, setO] = useState<PageNumberOptions>({ position: 'bottom-center', format: 'n-of-total', start: 1, size: 10 })
  const set = (p: Partial<PageNumberOptions>) => setO((x) => ({ ...x, ...p }))
  const total = (picker.file?.info.pages ?? 1) + o.start - 1
  const pageWord = t('Page')
  const label = o.format === 'n-of-total' ? `${o.start} / ${total}` : o.format === 'page-n' ? `${pageWord} ${o.start}` : `${o.start}`
  async function run() {
    const out = await api.outputPath(picker.file!.path, 'pdf', outDir, ' — numbered')
    await task.run(() => api.pageNumbers(picker.file!.path, { ...o, pageWord }, out, picker.file!.password))
  }
  const pos: Record<PageNumberOptions['position'], string> = {
    'bottom-center': 'bottom-[3.3%] left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-[3.3%] right-[6%]',
    'bottom-left': 'bottom-[3.3%] left-[6%]',
    'top-right': 'top-[3.3%] right-[6%]'
  }
  return (
    <PdfTool
      title="Page numbers"
      description="Number every page, starting where you choose."
      picker={picker}
      main={() => (
        <StampPreview
          picker={picker}
          overlay={
            <span className={cx('absolute rounded bg-amber/25 px-1 text-[#333] outline outline-1 outline-amber', pos[o.position])} style={{ fontSize: `${(o.size * 360) / 595}px`, fontFamily: 'Arial, sans-serif' }}>
              {label}
            </span>
          }
        />
      )}
      options={
        <>
          <Field label={t('Position')}>
            <Select
              value={o.position}
              onChange={(position) => set({ position })}
              options={[
                { value: 'bottom-center', label: t('Bottom center') },
                { value: 'bottom-right', label: t('Bottom right') },
                { value: 'bottom-left', label: t('Bottom left') },
                { value: 'top-right', label: t('Top right') }
              ]}
            />
          </Field>
          <Field label={t('Format')}>
            <Segmented
              value={o.format}
              onChange={(format) => set({ format })}
              options={[
                { value: 'n', label: '1' },
                { value: 'n-of-total', label: '1 / 9' },
                { value: 'page-n', label: `${pageWord} 1` }
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Start at')}>
              <input type="number" min={0} className={inputCls} value={o.start} onChange={(e) => set({ start: Number(e.target.value) })} />
            </Field>
            <Field label={t('Font size')}>
              <input type="number" min={6} max={36} className={inputCls} value={o.size} onChange={(e) => set({ size: Number(e.target.value) })} />
            </Field>
          </div>
        </>
      }
      action={
        <ActionButton busy={task.busy} disabled={!picker.file} onClick={run}>
          {t('Add numbers')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={task.result && <SavedFile path={task.result.output} size={task.result.size} />}
    />
  )
}

// ---------------------------------------------------------------- Protect
export function Protect() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<Saved>()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [perm, setPerm] = useState({ allowPrinting: true, allowCopying: false, allowEditing: false })
  const mismatch = pw2.length > 0 && pw !== pw2
  async function run() {
    const out = await api.outputPath(picker.file!.path, 'pdf', outDir, ' — protected')
    await task.run(() => api.protect(picker.file!.path, { userPassword: pw, ...perm }, out, picker.file!.password))
  }
  return (
    <PdfTool
      title="Protect"
      description="Require a password to open the PDF and limit what readers can do."
      picker={picker}
      options={
        <>
          <Field label={t('Password to open')} hint={t('Uses AES-256 encryption.')}>
            <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label={t('Repeat password')}>
            <input type="password" className={cx(inputCls, mismatch && 'border-coral')} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          {mismatch && <p className="-mt-3 text-xs text-coral">{t('Passwords do not match')}</p>}
          <div>
            <Check checked={perm.allowPrinting} onChange={(allowPrinting) => setPerm((p) => ({ ...p, allowPrinting }))} label={t('Allow printing')} />
            <Check checked={perm.allowCopying} onChange={(allowCopying) => setPerm((p) => ({ ...p, allowCopying }))} label={t('Allow copying text')} />
            <Check checked={perm.allowEditing} onChange={(allowEditing) => setPerm((p) => ({ ...p, allowEditing }))} label={t('Allow editing')} />
          </div>
        </>
      }
      action={
        <ActionButton busy={task.busy} disabled={!picker.file || !pw || pw !== pw2} onClick={run}>
          {t('Protect PDF')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={task.result && <SavedFile path={task.result.output} size={task.result.size} />}
    />
  )
}

// ---------------------------------------------------------------- Unlock
export function Unlock() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<Saved>()
  async function run() {
    const f = picker.file!
    const out = await api.outputPath(f.path, 'pdf', outDir, ' — unlocked')
    await task.run(() => api.unlock(f.path, f.password ?? '', out))
  }
  const notLocked = picker.file && !picker.file.password
  return (
    <PdfTool
      title="Unlock"
      description="Remove the password from a PDF you can open."
      picker={picker}
      options={notLocked ? <p className="text-[13px] text-faded">{t('This PDF is not password protected.')}</p> : undefined}
      action={
        <ActionButton busy={task.busy} disabled={!picker.file || !!notLocked} onClick={run}>
          {t('Unlock PDF')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={task.result && <SavedFile path={task.result.output} size={task.result.size} />}
    />
  )
}

// ---------------------------------------------------------------- Properties
export function Properties() {
  const t = useT()
  const picker = usePdfFile()
  const outDir = useOutDir()
  const task = useTask<Saved>()
  const [m, setM] = useState({ title: '', author: '', subject: '', keywords: '' })
  useEffect(() => {
    const i = picker.file?.info
    setM({ title: i?.title ?? '', author: i?.author ?? '', subject: i?.subject ?? '', keywords: i?.keywords ?? '' })
    task.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.file])
  async function run() {
    const out = await api.outputPath(picker.file!.path, 'pdf', outDir, ' — edited')
    await task.run(() => api.metadata(picker.file!.path, m, out, picker.file!.password))
  }
  const field = (k: keyof typeof m, label: string, hint?: string) => (
    <Field label={t(label)} hint={hint && t(hint)}>
      <input className={inputCls} value={m[k]} onChange={(e) => setM((x) => ({ ...x, [k]: e.target.value }))} />
    </Field>
  )
  const info = picker.file?.info
  return (
    <PdfTool
      title="Properties"
      description="View and edit the title, author and keywords."
      picker={picker}
      main={(file: PickedPdf) => (
        <div className="space-y-4">
          <DropTarget onFiles={(p) => picker.load(p[0])}>
            <FileSummary file={file} doc={null} onChange={picker.pick} showPages={0} />
          </DropTarget>
          <Panel className="grid grid-cols-2 gap-x-8 gap-y-4 p-5 text-[13px]">
            {[
              ['File size', bytes(info!.size)],
              ['Pages', String(info!.pages)],
              ['Created with', info!.creator || '—'],
              ['PDF producer', info!.producer || '—']
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-faded">{t(k)}</p>
                <p className="mt-0.5 select-text truncate">{v}</p>
              </div>
            ))}
          </Panel>
        </div>
      )}
      options={
        picker.file && (
          <>
            {field('title', 'Title')}
            {field('author', 'Author')}
            {field('subject', 'Subject')}
            {field('keywords', 'Keywords', 'Comma-separated')}
          </>
        )
      }
      action={
        <ActionButton busy={task.busy} disabled={!picker.file} onClick={run}>
          {t('Save properties')}
        </ActionButton>
      }
      error={task.error}
      onClearError={task.clear}
      result={task.result && <SavedFile path={task.result.output} size={task.result.size} />}
    />
  )
}

// ---------------------------------------------------------------- OCR
const OCR_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'heic', 'heif', 'bmp', 'gif']
export function Ocr() {
  const t = useT()
  const ask = useAskPassword()
  const outDir = useOutDir()
  const task = useTask<Saved>()
  const [files, setFiles] = useState<{ key: string; path: string; size: number }[]>([])
  const [langs, setLangs] = useState('eng')
  const [target, setTarget] = useState<'pdf' | 'txt'>('pdf')
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const jobId = 'ocr'
  useEffect(() => window.io.onProgress((e) => e.jobId === jobId && setProgress(e.percent)), [])

  async function add(paths: string[]) {
    const infos = (await api.info(paths)).filter((f) => OCR_EXTS.includes(f.ext))
    setFiles((fs) => [...fs, ...infos.map((f) => ({ key: uid(), path: f.path, size: f.size }))])
  }
  async function pick() {
    const p = await api.openFiles([{ name: t('Images or PDFs'), extensions: OCR_EXTS }])
    if (p.length) await add(p)
  }
  async function run() {
    setProgress(0)
    await task.run(async () => {
      // PDFs are rasterized here (PDF.js); images go straight to the main process.
      const inputs: (string | Uint8Array)[] = []
      for (const f of files) {
        if (!f.path.toLowerCase().endsWith('.pdf')) {
          inputs.push(f.path)
          continue
        }
        const data = await api.read(f.path)
        let pw: string | undefined
        let doc
        for (;;) {
          try {
            doc = await openPdf(data, pw)
            break
          } catch (e) {
            if (!isPasswordError(e) && (e as Error).message !== 'Wrong password') throw e
            const p = await ask(f.path, !!pw)
            if (p === null) throw new Error(t('This PDF is password protected'))
            pw = p
          }
        }
        for (let i = 0; i < doc.numPages; i++) {
          setStage(`${fileName(f.path)} · ${i + 1}/${doc.numPages}`)
          inputs.push(await renderToPng(doc, i, 220))
        }
        void doc.loadingTask.destroy()
      }
      setStage('')
      const out = await api.outputPath(files[0].path, target, outDir, target === 'pdf' ? ' — searchable' : '')
      return api.ocr(jobId, inputs, langs, target, out)
    })
  }
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('Text recognition')} description={t('Read text from scans and photos. Make PDFs searchable.')} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="min-h-0 overflow-y-auto pb-6">
          {files.length ? (
            <DropTarget onFiles={add} className="rounded-[var(--radius-card)]">
              <Panel className="overflow-hidden">
                <ul className="divide-y divide-line/70">
                  {files.map((f) => (
                    <li key={f.key} className="flex items-center gap-3 px-4 py-3">
                      <ScanText size={16} className="text-cyan" />
                      <p className="min-w-0 flex-1 truncate text-[13.5px]">{fileName(f.path)}</p>
                      <span className="text-xs text-dim">{bytes(f.size)}</span>
                      <IconButton label={t('Remove')} onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))}>
                        <X size={15} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line p-3">
                  <Button variant="quiet" icon={<Plus size={15} />} onClick={pick}>
                    {t('Add files')}
                  </Button>
                </div>
              </Panel>
            </DropTarget>
          ) : (
            <EmptyDrop onFiles={add} onPick={pick} title={t('Drop scans here')} button={t('Choose files')} icon={<ScanText size={24} strokeWidth={1.6} />} />
          )}
        </div>
        <aside className="min-h-0 overflow-y-auto pb-6">
          <Panel className="space-y-5 p-5">
            <Field label={t('Languages')} hint={t('The first run downloads language data (about 10 MB per language).')}>
              <OcrLangSelect value={langs} onChange={setLangs} />
            </Field>
            <Field label={t('Output')}>
              <Segmented value={target} onChange={setTarget} options={[{ value: 'pdf', label: t('Searchable PDF') }, { value: 'txt', label: t('Plain text') }]} />
            </Field>
            <ActionButton busy={task.busy} disabled={!files.length} onClick={run}>
              {t('Recognize text')}
            </ActionButton>
            {task.busy && (
              <div className="space-y-2">
                <Progress value={progress} state="running" />
                <p className="text-xs text-faded">{stage || `${progress}%`}</p>
              </div>
            )}
            {task.error && <ErrorNote message={task.error} onClose={task.clear} />}
            {task.result && <SavedFile path={task.result.output} size={task.result.size} />}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
