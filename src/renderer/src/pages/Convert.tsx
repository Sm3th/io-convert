import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Sheet,
  FileType2,
  X,
  Plus,
  FolderOpen,
  ExternalLink,
  CircleAlert,
  Check as CheckIcon,
  Trash2
} from 'lucide-react'
import {
  ALL_INPUT_EXTS,
  NEEDS_OFFICE,
  labelFor,
  normalizeExt,
  targetsFor,
  type Category,
  type ConvertOptions,
  type FileInfo
} from '@shared/formats'
import { api, isPasswordError } from '@/lib/api'
import { bytes, dirName, uid } from '@/lib/format'
import { useSettings, useT, useTe } from '@/lib/settings'
import { useAskPassword, useDemoFiles, useOutDir } from '@/lib/hooks'
import { extractLines, openPdf, renderToPng } from '@/lib/pdfjs'
import { Button, DropTarget, ErrorNote, Field, IconButton, Panel, Progress, Segmented, Select, Slider, cx } from '@/components/ui'

type Status = 'ready' | 'waiting' | 'running' | 'done' | 'error'
interface Job {
  id: string
  file: FileInfo
  target: string
  status: Status
  progress: number
  outputs: string[]
  outSize?: number
  error?: string
}

const ICONS: Record<Category, typeof Film> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  sheet: Sheet,
  pdf: FileType2
}

// Sensible first choice for each source type.
const DEFAULT_TARGET: Record<string, string> = {
  heic: 'jpg', png: 'jpg', jpg: 'webp', webp: 'png', avif: 'png', tiff: 'jpg', gif: 'mp4', svg: 'png',
  mp4: 'mp3', mov: 'mp4', mkv: 'mp4', avi: 'mp4', webm: 'mp4', wmv: 'mp4', flv: 'mp4', m4v: 'mp4',
  wav: 'mp3', flac: 'mp3', m4a: 'mp3', ogg: 'mp3', opus: 'mp3', wma: 'mp3', aiff: 'mp3', mp3: 'wav',
  pdf: 'png', xlsx: 'csv', xls: 'xlsx', ods: 'xlsx', csv: 'xlsx', tsv: 'xlsx', json: 'xlsx',
  html: 'pdf', md: 'pdf', txt: 'pdf'
}

function defaultTarget(ext: string): string {
  const list = targetsFor(ext)
  const pref = DEFAULT_TARGET[normalizeExt(ext)] ?? 'pdf'
  if (ext === 'gif') return 'webp'
  return list.includes(pref) ? pref : list[0] ?? ''
}

const ROUTES: [string, string][] = [
  ['HEIC', 'JPG'],
  ['MP4', 'GIF'],
  ['DOCX', 'PDF'],
  ['PDF', 'PNG'],
  ['MOV', 'MP3'],
  ['XLSX', 'CSV'],
  ['PNG', 'WebP'],
  ['Markdown', 'Word']
]

/** The one moving thing in the app: format routes cycling in large type. */
function RouteTicker() {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setI((n) => (n + 1) % ROUTES.length), 2200)
    return () => clearInterval(id)
  }, [reduce])
  const [from, to] = ROUTES[i]
  return (
    <div className="relative h-[92px] w-full overflow-hidden" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={i}
          initial={{ y: 40, opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -40, opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute inset-0 flex items-center justify-center gap-6 font-display text-[76px] font-semibold leading-none tracking-[-0.04em]"
        >
          <span className="text-faded/70">{from}</span>
          <ArrowRight size={44} strokeWidth={2.2} className="text-amber" />
          <span className="text-cyan">{to}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function Convert() {
  const t = useT()
  const { outDir } = useSettings()
  const outDirOpt = useOutDir()
  const ask = useAskPassword()
  const [jobs, setJobs] = useState<Job[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [office, setOffice] = useState(true)
  const cancelled = useRef(false)

  const [opts, setOpts] = useState<ConvertOptions & { dpi: number }>({
    quality: 85,
    width: undefined,
    videoQuality: 'balanced',
    resolution: 'original',
    audioBitrate: '192',
    gifFps: 12,
    ocrLangs: 'eng',
    pageSize: 'A4',
    dpi: 150
  })
  const setOpt = (p: Partial<typeof opts>) => setOpts((o) => ({ ...o, ...p }))

  useEffect(() => {
    api.env().then((e) => setOffice(e.office)).catch(() => {})
    return window.io.onProgress(({ jobId, percent }) =>
      setJobs((js) => js.map((j) => (j.id === jobId && j.status === 'running' ? { ...j, progress: percent } : j)))
    )
  }, [])

  async function add(paths: string[]) {
    const infos = await api.info(paths)
    const ok = infos.filter((f) => f.category && targetsFor(f.ext).length)
    setRejected(infos.filter((f) => !ok.includes(f)).map((f) => f.name))
    setJobs((js) => [
      ...js.filter((j) => j.status !== 'done' || running),
      ...ok
        .filter((f) => !js.some((j) => j.file.path === f.path && j.status !== 'done'))
        .map((file) => ({ id: uid(), file, target: defaultTarget(file.ext), status: 'ready' as Status, progress: 0, outputs: [] }))
    ])
  }

  useDemoFiles((p) => void add(p))

  async function pick() {
    const paths = await api.openFiles([{ name: 'Supported files', extensions: ALL_INPUT_EXTS }])
    if (paths.length) await add(paths)
  }

  const update = (id: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)))

  async function runPdfSource(job: Job): Promise<{ outputs: string[]; size: number }> {
    const data = await api.read(job.file.path)
    let password: string | undefined
    let doc
    for (;;) {
      try {
        doc = await openPdf(data, password)
        break
      } catch (e) {
        if (!isPasswordError(e) && (e as Error).message !== 'Wrong password') throw e
        const pw = await ask(job.file.path, !!password)
        if (pw === null) throw new Error(t('This PDF is password protected'))
        password = pw
      }
    }
    try {
      if (['png', 'jpg', 'webp'].includes(job.target)) {
        const outputs: string[] = []
        let size = 0
        for (let i = 0; i < doc.numPages; i++) {
          if (cancelled.current) throw new Error('Cancelled')
          const png = await renderToPng(doc, i, opts.dpi)
          const suffix = doc.numPages > 1 ? ` — page ${i + 1}` : ''
          const out = await api.outputPath(job.file.path, job.target, outDirOpt, suffix)
          const r = await api.saveRender(png, job.target, out, opts.quality)
          outputs.push(r.output)
          size += r.size
          update(job.id, { progress: ((i + 1) / doc.numPages) * 100 })
        }
        return { outputs, size }
      }
      const lines = await extractLines(doc)
      const out = await api.outputPath(job.file.path, job.target, outDirOpt)
      const r = await api.saveText(lines, job.target, out)
      return { outputs: [r.output], size: r.size }
    } finally {
      void doc.loadingTask.destroy()
    }
  }

  async function runOne(job: Job) {
    update(job.id, { status: 'running', progress: 0, error: undefined })
    try {
      if (job.file.category === 'pdf') {
        const r = await runPdfSource(job)
        update(job.id, { status: 'done', progress: 100, outputs: r.outputs, outSize: r.size })
      } else {
        const r = await api.convert({ jobId: job.id, input: job.file.path, target: job.target, outDir: outDirOpt, options: opts })
        update(job.id, { status: 'done', progress: 100, outputs: [r.output], outSize: r.size })
      }
    } catch (e) {
      update(job.id, { status: 'error', error: (e as Error).message })
    }
  }

  async function start() {
    const queue = jobs.filter((j) => j.status === 'ready' || j.status === 'error')
    if (!queue.length) return
    cancelled.current = false
    setRunning(true)
    setJobs((js) => js.map((j) => (queue.some((q) => q.id === j.id) ? { ...j, status: 'waiting', progress: 0 } : j)))
    // Two lanes: keeps the CPU busy without starving long video jobs.
    const pending = [...queue]
    const lane = async () => {
      while (pending.length && !cancelled.current) {
        const job = pending.shift()!
        await runOne(job)
      }
    }
    await Promise.all([lane(), lane()])
    setJobs((js) => js.map((j) => (j.status === 'waiting' ? { ...j, status: 'ready' } : j)))
    setRunning(false)
  }

  function cancel() {
    cancelled.current = true
    jobs.filter((j) => j.status === 'running').forEach((j) => void api.cancel(j.id))
  }

  const cats = useMemo(() => new Set(jobs.map((j) => j.file.category)), [jobs])
  const allTargets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const j of jobs) for (const tg of targetsFor(j.file.ext)) counts.set(tg, (counts.get(tg) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 10)
  }, [jobs])
  const done = jobs.filter((j) => j.status === 'done').length
  const pendingCount = jobs.filter((j) => j.status === 'ready' || j.status === 'error').length
  const hasVideo = cats.has('video')
  const wantsOcr = jobs.some((j) => j.file.category === 'image' && j.target === 'txt')
  const wantsGif = jobs.some((j) => j.target === 'gif' && j.file.category === 'video')
  const pdfToImage = jobs.some((j) => j.file.category === 'pdf' && ['png', 'jpg', 'webp'].includes(j.target))
  const printsPdf = jobs.some((j) => (j.file.category === 'document' || j.file.category === 'sheet') && j.target === 'pdf')

  // ------------------------------------------------------------- empty state
  if (!jobs.length) {
    return (
      <DropTarget onFiles={add} className="h-full rounded-[22px] transition-shadow" activeClassName="ring-2 ring-cyan">
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[22px] border border-line bg-[radial-gradient(120%_80%_at_50%_0%,#163063_0%,#0d1830_60%)] px-10">
          <RouteTicker />
          <h1 className="mt-10 font-display text-[30px] font-semibold tracking-[-0.02em]">{t('Drop files to convert')}</h1>
          <p className="mt-2 max-w-[52ch] text-center text-faded">
            {t('Images, video, audio, documents, spreadsheets and PDFs. Nothing is uploaded.')}
          </p>
          <Button variant="primary" className="mt-7 h-10 px-5" icon={<Plus size={16} />} onClick={pick}>
            {t('Choose files')}
          </Button>
          {rejected.length > 0 && (
            <div className="mt-6 w-[420px]">
              <ErrorNote message={`${t('Unsupported file')}: ${rejected.join(', ')}`} onClose={() => setRejected([])} />
            </div>
          )}
        </div>
      </DropTarget>
    )
  }

  // --------------------------------------------------------------- job list
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-end justify-between gap-6 pb-5">
        <div>
          <h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.02em]">{t('Convert')}</h1>
          <p className="mt-1 text-faded">{t('{n} files · {done} done', { n: jobs.length, done })}</p>
        </div>
        <div className="flex gap-2">
          <Button icon={<Plus size={15} />} onClick={pick} disabled={running}>
            {t('Add files')}
          </Button>
          <Button variant="quiet" icon={<Trash2 size={15} />} onClick={() => setJobs([])} disabled={running}>
            {t('Clear list')}
          </Button>
          {running ? (
            <Button onClick={cancel}>{t('Cancel')}</Button>
          ) : (
            <Button variant="primary" disabled={!pendingCount} onClick={start}>
              {t('Convert files')}
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-6">
        <DropTarget onFiles={add} className="flex min-h-0 flex-col rounded-[var(--radius-card)]">
          <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {allTargets.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                <span className="mr-1 text-[13px] text-faded">{t('Convert all to')}</span>
                {allTargets.map((tg) => (
                  <button
                    key={tg}
                    disabled={running}
                    onClick={() =>
                      setJobs((js) => js.map((j) => (targetsFor(j.file.ext).includes(tg) && j.status !== 'running' ? { ...j, target: tg, status: j.status === 'done' ? 'ready' : j.status } : j)))
                    }
                    className="h-7 rounded-full border border-line px-3 text-xs font-medium text-faded transition-colors hover:border-cyan hover:text-cyan disabled:opacity-40"
                  >
                    {t(labelFor(tg))}
                  </button>
                ))}
              </div>
            )}
            <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
              {jobs.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  office={office}
                  locked={running}
                  onTarget={(target) => update(j.id, { target, status: 'ready', outputs: [], progress: 0 })}
                  onRemove={() => setJobs((js) => js.filter((x) => x.id !== j.id))}
                />
              ))}
            </ul>
          </Panel>
        </DropTarget>

        <aside className="min-h-0 overflow-y-auto pb-2">
          <Panel className="space-y-5 p-5">
            <h2 className="font-display text-lg font-semibold">{t('Options')}</h2>
            {(cats.has('image') || pdfToImage) && (
              <Field label={t('Quality')}>
                <Slider value={opts.quality!} min={10} max={100} onChange={(quality) => setOpt({ quality })} />
              </Field>
            )}
            {cats.has('image') && (
              <Field label={t('Max width')}>
                <Select
                  value={String(opts.width ?? '')}
                  onChange={(v) => setOpt({ width: v ? Number(v) : undefined })}
                  options={[{ value: '', label: t('Original') }, ...['3840', '2560', '1920', '1280', '800', '400'].map((v) => ({ value: v, label: `${v} px` }))]}
                />
              </Field>
            )}
            {pdfToImage && (
              <Field label={t('PDF page resolution')}>
                <Segmented value={String(opts.dpi)} onChange={(v) => setOpt({ dpi: Number(v) })} options={['72', '150', '300'].map((v) => ({ value: v, label: `${v} dpi` }))} />
              </Field>
            )}
            {hasVideo && (
              <>
                <Field label={t('Video quality')}>
                  <Segmented
                    value={opts.videoQuality!}
                    onChange={(videoQuality) => setOpt({ videoQuality })}
                    options={[
                      { value: 'high', label: t('High') },
                      { value: 'balanced', label: t('Balanced') },
                      { value: 'small', label: t('Small') }
                    ]}
                  />
                </Field>
                <Field label={t('Resolution')}>
                  <Select
                    value={opts.resolution!}
                    onChange={(resolution) => setOpt({ resolution })}
                    options={[
                      { value: 'original', label: t('Original') },
                      { value: '2160', label: '4K (2160p)' },
                      { value: '1080', label: '1080p' },
                      { value: '720', label: '720p' },
                      { value: '480', label: '480p' }
                    ]}
                  />
                </Field>
              </>
            )}
            {wantsGif && (
              <Field label={t('GIF frame rate')}>
                <Slider value={opts.gifFps!} min={5} max={30} onChange={(gifFps) => setOpt({ gifFps })} suffix=" fps" />
              </Field>
            )}
            {(hasVideo || cats.has('audio')) && (
              <Field label={t('Audio bitrate')}>
                <Select
                  value={opts.audioBitrate!}
                  onChange={(audioBitrate) => setOpt({ audioBitrate })}
                  options={(['320', '256', '192', '128', '96'] as const).map((v) => ({ value: v, label: `${v} kbps` }))}
                />
              </Field>
            )}
            {wantsOcr && (
              <Field label={t('Text recognition language')}>
                <OcrLangSelect value={opts.ocrLangs!} onChange={(ocrLangs) => setOpt({ ocrLangs })} />
              </Field>
            )}
            {printsPdf && (
              <Field label={t('Page size')}>
                <Segmented value={opts.pageSize!} onChange={(pageSize) => setOpt({ pageSize })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} />
              </Field>
            )}

            <div className="space-y-3 border-t border-line pt-5">
              <p className="flex items-center gap-2 text-xs text-faded">
                <FolderOpen size={13} />
                <span className="truncate">{outDir ? t('Saved to {dir}', { dir: outDir }) : t('Saved next to the original')}</span>
              </p>
              {rejected.length > 0 && <ErrorNote message={`${t('Unsupported file')}: ${rejected.join(', ')}`} onClose={() => setRejected([])} />}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

export function OcrLangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={[
        { value: 'eng', label: 'English' },
        { value: 'tur', label: 'Türkçe' },
        { value: 'pol', label: 'Polski' },
        { value: 'deu', label: 'Deutsch' },
        { value: 'eng+tur', label: 'English + Türkçe' },
        { value: 'eng+pol', label: 'English + Polski' },
        { value: 'tur+pol+eng', label: 'Türkçe + Polski + English' }
      ]}
    />
  )
}

function JobRow({
  job,
  office,
  locked,
  onTarget,
  onRemove
}: {
  job: Job
  office: boolean
  locked: boolean
  onTarget: (t: string) => void
  onRemove: () => void
}) {
  const t = useT()
  const te = useTe()
  const Icon = ICONS[job.file.category ?? 'document']
  const targets = targetsFor(job.file.ext)
  const officeMissing = !office && NEEDS_OFFICE.has(job.file.ext)
  const state = job.status === 'running' ? 'running' : job.status === 'done' ? 'done' : job.status === 'error' ? 'error' : 'idle'
  return (
    <li className="group grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5">
      <span
        className={cx(
          'flex h-9 w-9 items-center justify-center rounded-lg border',
          job.status === 'done' ? 'border-mint/40 bg-mint/10 text-mint' : 'border-line bg-raised text-faded'
        )}
      >
        {job.status === 'done' ? <CheckIcon size={16} /> : <Icon size={16} strokeWidth={1.8} />}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[13.5px] font-medium" title={job.file.path}>
            {job.file.name}
          </p>
          <span className="shrink-0 text-xs text-dim">
            {bytes(job.file.size)}
            {job.outSize !== undefined && <> → {bytes(job.outSize)}</>}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          {job.status === 'error' ? (
            <p className="flex items-center gap-1.5 truncate text-xs text-coral" title={te(job.error ?? '')}>
              <CircleAlert size={13} className="shrink-0" />
              {te(job.error ?? '')}
            </p>
          ) : job.status === 'done' ? (
            <p className="truncate text-xs text-faded">
              {job.outputs.length > 1 ? `${t('{n} files', { n: job.outputs.length })} · ${dirName(job.outputs[0])}` : job.outputs[0]}
            </p>
          ) : officeMissing ? (
            <p className="text-xs text-amber">{t('Needs LibreOffice')}</p>
          ) : (
            <div className="w-full max-w-[280px]">
              {job.status === 'ready' ? <span className="text-xs text-dim">{t('Ready')}</span> : job.status === 'waiting' ? <span className="text-xs text-dim">{t('Waiting')}</span> : <Progress value={job.progress} state={state} />}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-[74px] truncate rounded-md border border-line px-2 py-1 text-center text-[11px] font-semibold text-faded">{labelFor(normalizeExt(job.file.ext))}</span>
        <ArrowRight size={14} className="text-amber/80" />
        <Select
          small
          disabled={locked}
          className="w-[128px]"
          value={job.target}
          onChange={onTarget}
          options={targets.map((tg) => ({ value: tg, label: tg === 'txt' && job.file.category === 'image' ? `${t('Text')} (OCR)` : t(labelFor(tg)) }))}
        />
        <div className="flex w-[72px] justify-end">
          {job.status === 'done' ? (
            <>
              <IconButton label={t('Show in folder')} onClick={() => api.show(job.outputs[0])}>
                <FolderOpen size={15} />
              </IconButton>
              <IconButton label={t('Open')} onClick={() => api.open(job.outputs[0])}>
                <ExternalLink size={15} />
              </IconButton>
            </>
          ) : (
            <IconButton label={t('Remove')} onClick={onRemove} disabled={locked}>
              <X size={15} />
            </IconButton>
          )}
        </div>
      </div>
    </li>
  )
}
