import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  Trash2,
  SlidersHorizontal
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
import { bytes, dirName, fileName, uid } from '@/lib/format'
import { useSettings, useT, useTe } from '@/lib/settings'
import { useAskPassword, useDemoFiles, useOutDir } from '@/lib/hooks'
import { usePageActive } from '@/lib/drop'
import { useToast } from '@/lib/toast'
import { extractLines, openPdf, renderToPng } from '@/lib/pdfjs'
import { Button, DropTarget, ErrorNote, Field, IconButton, Panel, Progress, Segmented, Select, Slider, cx, type SelectOption } from '@/components/ui'
import { Botanical } from '@/components/Botanical'

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

export const CATEGORY_ICONS: Record<Category, typeof Film> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  sheet: Sheet,
  pdf: FileType2
}
export const catColor = (c: Category) => `var(--color-cat-${c})`

const CATEGORY_NAMES: Record<Category, string> = {
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  document: 'Documents',
  sheet: 'Spreadsheets',
  pdf: 'PDF'
}

// What kind of file each target format makes, to group the format menu.
const TARGET_KIND: Record<string, Category> = {
  png: 'image', jpg: 'image', webp: 'image', avif: 'image', tiff: 'image', gif: 'image',
  mp4: 'video', webm: 'video', mkv: 'video', mov: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', flac: 'audio', ogg: 'audio', opus: 'audio',
  pdf: 'pdf', docx: 'document', html: 'document', txt: 'document', md: 'document',
  xlsx: 'sheet', csv: 'sheet', json: 'sheet', ods: 'sheet'
}
const KIND_ORDER: Category[] = ['image', 'video', 'audio', 'pdf', 'document', 'sheet']

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

const CATEGORY_CHIPS: [Category, string][] = [
  ['image', 'HEIC · PNG · WebP'],
  ['video', 'MP4 · MOV · MKV'],
  ['audio', 'MP3 · WAV · FLAC'],
  ['document', 'DOCX · MD · HTML'],
  ['sheet', 'XLSX · CSV · JSON'],
  ['pdf', '→ PNG · DOCX · TXT']
]

/** The one moving thing in the app: format routes cycling in large type. */
function RouteTicker() {
  const reduce = useReducedMotion()
  const active = usePageActive()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce || !active) return
    const id = setInterval(() => setI((n) => (n + 1) % ROUTES.length), 2200)
    return () => clearInterval(id)
  }, [reduce, active])
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

/** Small icon tile in the color of the file's family. */
export function FileTile({ category, size = 36 }: { category: Category; size?: number }) {
  const Icon = CATEGORY_ICONS[category]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        color: catColor(category),
        background: `color-mix(in srgb, ${catColor(category)} 13%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${catColor(category)} 22%, transparent)`
      }}
    >
      <Icon size={Math.round(size * 0.44)} strokeWidth={1.8} />
    </span>
  )
}

export function Convert({ onShow }: { onShow?: () => void }) {
  const t = useT()
  const { outDir } = useSettings()
  const outDirOpt = useOutDir()
  const ask = useAskPassword()
  const toast = useToast()
  const active = usePageActive()
  const activeRef = useRef(active)
  activeRef.current = active
  const [jobs, setJobs] = useState<Job[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [office, setOffice] = useState(true)
  const [filter, setFilter] = useState<Category | 'all'>('all')
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
    setFilter('all')
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
          const suffix = doc.numPages > 1 ? ` — ${t('page')} ${i + 1}` : ''
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

  async function runOne(job: Job): Promise<Job> {
    update(job.id, { status: 'running', progress: 0, error: undefined })
    try {
      const r =
        job.file.category === 'pdf'
          ? await runPdfSource(job)
          : await api.convert({ jobId: job.id, input: job.file.path, target: job.target, outDir: outDirOpt, options: opts }).then((x) => ({ outputs: [x.output], size: x.size }))
      const patch = { status: 'done' as Status, progress: 100, outputs: r.outputs, outSize: r.size }
      update(job.id, patch)
      return { ...job, ...patch }
    } catch (e) {
      update(job.id, { status: 'error', error: (e as Error).message })
      return { ...job, status: 'error' }
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
    const finished: Job[] = []
    const lane = async () => {
      while (pending.length && !cancelled.current) finished.push(await runOne(pending.shift()!))
    }
    await Promise.all([lane(), lane()])
    setJobs((js) => js.map((j) => (j.status === 'waiting' ? { ...j, status: 'ready' } : j)))
    setRunning(false)
    // Someone who went to another tool meanwhile hears about it.
    if (!activeRef.current && !cancelled.current) {
      const ok = finished.filter((j) => j.status === 'done')
      const failed = finished.length - ok.length
      toast({
        tone: failed ? 'error' : 'success',
        title: failed ? t('{done} converted, {failed} failed', { done: ok.length, failed }) : t('{n} files converted', { n: ok.length }),
        body: ok[0] ? dirName(ok[0].outputs[0]) : undefined,
        action: failed ? { label: t('Show list'), run: () => onShow?.() } : ok[0] ? { label: t('Show in folder'), run: () => void api.show(ok[0].outputs[0]) } : undefined
      })
    }
  }

  function cancel() {
    cancelled.current = true
    jobs.filter((j) => j.status === 'running').forEach((j) => void api.cancel(j.id))
  }

  const cats = useMemo(() => new Set(jobs.map((j) => j.file.category!)), [jobs])
  const catCounts = useMemo(() => {
    const m = new Map<Category, number>()
    for (const j of jobs) m.set(j.file.category!, (m.get(j.file.category!) ?? 0) + 1)
    return KIND_ORDER.filter((c) => m.has(c)).map((c) => [c, m.get(c)!] as const)
  }, [jobs])
  useEffect(() => {
    if (filter !== 'all' && !cats.has(filter)) setFilter('all')
  }, [cats, filter])
  const shown = filter === 'all' ? jobs : jobs.filter((j) => j.file.category === filter)

  const allTargets = useMemo(() => {
    const set = new Set<string>()
    for (const j of jobs) for (const tg of targetsFor(j.file.ext)) set.add(tg)
    return [...set]
  }, [jobs])
  const common = jobs.every((j) => j.target === jobs[0]?.target) ? jobs[0]?.target ?? '' : ''
  const done = jobs.filter((j) => j.status === 'done').length
  // Overall progress of the current run (jobs that left the "ready" state).
  const inRun = jobs.filter((j) => j.status !== 'ready')
  const overall = inRun.length ? inRun.reduce((n, j) => n + (j.status === 'done' || j.status === 'error' ? 100 : j.progress), 0) / inRun.length : 0
  const pendingCount = jobs.filter((j) => j.status === 'ready' || j.status === 'error').length
  const hasVideo = cats.has('video')
  const wantsOcr = jobs.some((j) => j.file.category === 'image' && j.target === 'txt')
  const wantsGif = jobs.some((j) => j.target === 'gif' && j.file.category === 'video')
  const pdfToImage = jobs.some((j) => j.file.category === 'pdf' && ['png', 'jpg', 'webp'].includes(j.target))
  const printsPdf = jobs.some((j) => (j.file.category === 'document' || j.file.category === 'sheet') && j.target === 'pdf')

  function convertAll(tg: string) {
    setJobs((js) =>
      js.map((j) =>
        targetsFor(j.file.ext).includes(tg) && j.status !== 'running' ? { ...j, target: tg, status: j.status === 'done' ? 'ready' : j.status } : j
      )
    )
  }

  // ------------------------------------------------------------- empty state
  if (!jobs.length) {
    return (
      <DropTarget onFiles={add} className="group/drop h-full rounded-[22px]" activeClassName="is-over ring-2 ring-cyan">
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[22px] border border-line bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-glow)_0%,var(--color-ink)_60%)] px-10">
          <Botanical className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] w-full text-cyan opacity-[0.07]" />
          {/* dashed frame that lights up while files hover over the window */}
          <div className="pointer-events-none absolute inset-4 rounded-[16px] border-2 border-dashed border-transparent transition-colors group-[.is-over]/drop:border-cyan/50" />
          <RouteTicker />
          <h1 className="relative mt-10 font-display text-[30px] font-semibold tracking-[-0.02em]">{t('Drop files to convert')}</h1>
          <p className="relative mt-2 max-w-[52ch] text-center text-faded">{t('Images, video, audio, documents, spreadsheets and PDFs. Nothing is uploaded.')}</p>
          <Button variant="primary" className="relative mt-7 h-10 px-5" icon={<Plus size={16} />} onClick={pick}>
            {t('Choose files')}
          </Button>
          <ul className="relative mt-10 flex max-w-[720px] flex-wrap justify-center gap-2">
            {CATEGORY_CHIPS.map(([cat, sample]) => {
              const Icon = CATEGORY_ICONS[cat]
              return (
                <li key={cat} className="flex items-center gap-2 rounded-full border border-line bg-panel/70 py-1.5 pl-2.5 pr-3 text-xs text-faded backdrop-blur-sm">
                  <Icon size={13} style={{ color: catColor(cat) }} />
                  <span className="font-medium text-paper">{t(CATEGORY_NAMES[cat])}</span>
                  <span className="text-dim">{sample}</span>
                </li>
              )
            })}
          </ul>
          {rejected.length > 0 && (
            <div className="relative mt-6 w-[420px]">
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
          <div className="mt-1 flex h-6 items-center gap-4">
            <p className="text-faded">{t('{n} files · {done} done', { n: jobs.length, done })}</p>
            {running && (
              <div className="flex w-[220px] items-center gap-3">
                <Progress value={overall} state="running" />
                <span className="w-9 text-right text-xs tabular-nums text-faded">{Math.round(overall)}%</span>
              </div>
            )}
          </div>
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
            <div className="flex min-h-[52px] items-center gap-3 border-b border-line px-3 py-2">
              {catCounts.length > 1 ? (
                <div className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto" role="tablist">
                  {([['all', jobs.length] as const, ...catCounts] as const).map(([c, n]) => (
                    <button
                      key={c}
                      role="tab"
                      aria-selected={filter === c}
                      onClick={() => setFilter(c)}
                      className={cx(
                        'flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[13px] transition-colors',
                        filter === c ? 'bg-raised font-medium text-paper' : 'text-faded hover:text-paper'
                      )}
                    >
                      {c !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: catColor(c) }} />}
                      {c === 'all' ? t('All') : t(CATEGORY_NAMES[c])}
                      <span className="text-xs tabular-nums text-dim">{n}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="flex-1 pl-2 text-[13px] text-faded">{t(CATEGORY_NAMES[catCounts[0][0]])}</p>
              )}
              {jobs.length > 1 && (
                <Select
                  small
                  label={t('Convert all to')}
                  className="w-[164px] shrink-0"
                  disabled={running}
                  value={common}
                  onChange={convertAll}
                  options={[{ value: '', label: t('Convert all to…'), disabled: true }, ...targetOptions(allTargets, t)]}
                />
              )}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              <AnimatePresence initial={false}>
                {shown.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    office={office}
                    locked={running}
                    onTarget={(target) => update(j.id, { target, status: 'ready', outputs: [], progress: 0 })}
                    onRemove={() => setJobs((js) => js.filter((x) => x.id !== j.id))}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </Panel>
        </DropTarget>

        <aside className="min-h-0 overflow-y-auto pb-2">
          <Panel className="p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
              <SlidersHorizontal size={16} className="text-dim" />
              {t('Options')}
            </h2>
            {(cats.has('image') || pdfToImage) && (
              <OptionGroup category="image" title={t('Images')}>
                <Field label={t('Quality')}>
                  <Slider value={opts.quality!} min={10} max={100} onChange={(quality) => setOpt({ quality })} />
                </Field>
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
                {wantsOcr && (
                  <Field label={t('Text recognition language')}>
                    <OcrLangSelect value={opts.ocrLangs!} onChange={(ocrLangs) => setOpt({ ocrLangs })} />
                  </Field>
                )}
              </OptionGroup>
            )}
            {hasVideo && (
              <OptionGroup category="video" title={t('Video')}>
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
                {wantsGif && (
                  <Field label={t('GIF frame rate')}>
                    <Slider value={opts.gifFps!} min={5} max={30} onChange={(gifFps) => setOpt({ gifFps })} suffix=" fps" />
                  </Field>
                )}
              </OptionGroup>
            )}
            {(hasVideo || cats.has('audio')) && (
              <OptionGroup category="audio" title={t('Audio')}>
                <Field label={t('Audio bitrate')}>
                  <Select
                    value={opts.audioBitrate!}
                    onChange={(audioBitrate) => setOpt({ audioBitrate })}
                    options={(['320', '256', '192', '128', '96'] as const).map((v) => ({ value: v, label: `${v} kbps` }))}
                  />
                </Field>
              </OptionGroup>
            )}
            {printsPdf && (
              <OptionGroup category="document" title={t('Documents')}>
                <Field label={t('Page size')}>
                  <Segmented value={opts.pageSize!} onChange={(pageSize) => setOpt({ pageSize })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} />
                </Field>
              </OptionGroup>
            )}
            {!(cats.has('image') || pdfToImage || hasVideo || cats.has('audio') || printsPdf) && (
              <p className="mt-3 text-[13px] text-dim">{t('No options for these files.')}</p>
            )}

            <div className="mt-5 space-y-3 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-xs text-faded">
                <FolderOpen size={13} className="shrink-0" />
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

function OptionGroup({ category, title, children }: { category: Category; title: string; children: ReactNode }) {
  return (
    <section className="mt-4 space-y-4 border-t border-line pt-4 first-of-type:border-t-0 first-of-type:pt-2">
      <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-dim">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor(category) }} />
        {title}
      </p>
      {children}
    </section>
  )
}

/** Target formats as menu options, grouped by the kind of file they make. */
function targetOptions(targets: string[], t: (k: string) => string, ocr = false): SelectOption<string>[] {
  return [...targets]
    .sort((a, b) => KIND_ORDER.indexOf(TARGET_KIND[a] ?? 'document') - KIND_ORDER.indexOf(TARGET_KIND[b] ?? 'document'))
    .map((tg) => {
      const kind = TARGET_KIND[tg] ?? 'document'
      return {
        value: tg,
        label: tg === 'txt' && ocr ? `${t('Text')} (OCR)` : t(labelFor(tg)),
        group: t(CATEGORY_NAMES[kind]),
        dot: catColor(kind)
      }
    })
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

/** Check mark that draws itself when a job finishes. */
function DoneMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1], delay: 0.1 }} />
    </svg>
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
  const category = job.file.category ?? 'document'
  const targets = targetsFor(job.file.ext)
  const officeMissing = !office && NEEDS_OFFICE.has(job.file.ext)
  const state = job.status === 'running' ? 'running' : job.status === 'done' ? 'done' : job.status === 'error' ? 'error' : 'idle'
  return (
    <motion.li
      layout="position"
      data-testid="job"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
      className="group grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line/70 px-5 py-3.5 last:border-b-0"
    >
      {/* "exposure": the tile develops from the file's color to mint when done */}
      <AnimatePresence mode="wait" initial={false}>
        {job.status === 'done' ? (
          <motion.span
            key="done"
            initial={{ scale: 0.6, opacity: 0, backgroundColor: 'var(--color-amber)' }}
            animate={{ scale: 1, opacity: 1, backgroundColor: 'color-mix(in srgb, var(--color-mint) 14%, transparent)' }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-mint ring-1 ring-inset ring-mint/35"
          >
            <DoneMark />
          </motion.span>
        ) : (
          <motion.span key="file" exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
            <FileTile category={category} />
          </motion.span>
        )}
      </AnimatePresence>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[13.5px] font-medium" title={job.file.path}>
            {job.file.name}
          </p>
          <span className="shrink-0 text-xs tabular-nums text-dim">
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
            <p className="truncate text-xs text-faded" title={job.outputs.length > 1 ? dirName(job.outputs[0]) : job.outputs[0]}>
              <span className="text-mint">{t('Done')}</span>
              {' · '}
              {job.outputs.length > 1 ? `${t('{n} files', { n: job.outputs.length })} · ${fileName(dirName(job.outputs[0]))}` : fileName(job.outputs[0])}
            </p>
          ) : officeMissing ? (
            <p className="text-xs text-amber">{t('Needs LibreOffice')}</p>
          ) : (
            <div className="w-full max-w-[280px]">
              {job.status === 'ready' ? (
                <span className="text-xs text-dim">{t('Ready')}</span>
              ) : job.status === 'waiting' ? (
                <span className="text-xs text-dim">{t('Waiting')}</span>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Progress value={job.progress} state={state} />
                  <span className="w-8 text-right text-[11px] tabular-nums text-dim">{Math.round(job.progress)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-[74px] truncate rounded-md border border-line px-2 py-1 text-center text-[11px] font-semibold text-faded">{labelFor(normalizeExt(job.file.ext))}</span>
        <ArrowRight size={14} className="text-amber/80" />
        <Select
          small
          testId="target"
          label={t('Convert to')}
          disabled={locked}
          className="w-[132px]"
          value={job.target}
          onChange={onTarget}
          options={targetOptions(targets, t, category === 'image')}
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
    </motion.li>
  )
}
