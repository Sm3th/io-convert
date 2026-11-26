import { useEffect, useState } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { ArrowUp, ArrowDown, X, Plus, FileText, Image as ImageIcon, GripVertical } from 'lucide-react'
import { api } from '@/lib/api'
import { bytes, fileName, uid } from '@/lib/format'
import { useT, useTe } from '@/lib/settings'
import { useAskPassword, useDemoFiles, useOutDir, useTask } from '@/lib/hooks'
import { Button, DropTarget, ErrorNote, Field, IconButton, PageHeader, Panel, SavedFile, Segmented, cx, Spinner } from '@/components/ui'
import { EmptyDrop } from '@/components/PdfTool'
import { iconFor } from '@/components/Sidebar'

interface Entry {
  key: string
  path: string
  size: number
  pages?: number
  password?: string
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tif', 'tiff', 'gif', 'heic', 'heif', 'svg']
const PREVIEWABLE = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg'])
const MIME: Record<string, string> = { svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

function ImagePreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const ext = path.split('.').pop()!.toLowerCase()
    // Formats Chromium cannot show (HEIC, TIFF) get a thumbnail from the main process.
    const direct = PREVIEWABLE.has(ext)
    let u: string | null = null
    let alive = true
    ;(direct ? api.read(path) : api.imagePreview(path))
      .then((b) => {
        if (!alive) return
        u = URL.createObjectURL(new Blob([b as BlobPart], { type: direct ? (MIME[ext] ?? `image/${ext}`) : 'image/png' }))
        setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [path])
  return url ? (
    <img src={url} alt="" className="h-11 w-11 rounded-md border border-line object-cover" />
  ) : (
    <span className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-raised text-faded">
      <ImageIcon size={16} />
    </span>
  )
}

/** Shared reorderable list used by Merge and Images to PDF. */
function useEntries(kind: 'pdf' | 'image') {
  const ask = useAskPassword()
  const te = useTe()
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  async function add(paths: string[]) {
    const exts = kind === 'pdf' ? ['pdf'] : IMAGE_EXTS
    const infos = (await api.info(paths)).filter((f) => exts.includes(f.ext))
    const next: Entry[] = []
    for (const f of infos) {
      const e: Entry = { key: uid(), path: f.path, size: f.size }
      if (kind === 'pdf') {
        try {
          let info = await api.pdfInfo(f.path)
          let wrong = false
          while (info.encrypted && !info.pages) {
            const pw = await ask(f.path, wrong)
            if (pw === null) break
            try {
              info = await api.pdfInfo(f.path, pw)
              e.password = pw
            } catch {
              wrong = true
            }
          }
          if (!info.pages) continue
          e.pages = info.pages
        } catch (err) {
          setError(`${f.name}: ${te((err as Error).message)}`)
          continue
        }
      }
      next.push(e)
    }
    setEntries((es) => [...es, ...next])
  }
  async function pick() {
    const paths = await api.openFiles([kind === 'pdf' ? { name: 'PDF', extensions: ['pdf'] } : { name: 'Images', extensions: IMAGE_EXTS }])
    if (paths.length) await add(paths)
  }
  useDemoFiles((p) => void add(p))
  const move = (i: number, d: number) =>
    setEntries((es) => {
      const n = [...es]
      const [x] = n.splice(i, 1)
      n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x)
      return n
    })
  return { entries, setEntries, add, pick, move, error, setError }
}

/** Colors that tell merged files apart in the list and the page bar. */
const STACK = ['var(--color-cyan)', 'var(--color-amber)', 'var(--color-mint)', 'var(--color-coral)', 'var(--color-cat-sheet)', 'var(--color-faded)']
const stackColor = (i: number) => STACK[i % STACK.length]

function EntryList({ list, kind }: { list: ReturnType<typeof useEntries>; kind: 'pdf' | 'image' }) {
  return (
    <Reorder.Group axis="y" values={list.entries} onReorder={list.setEntries} as="ul">
      {list.entries.map((e, i) => (
        <EntryRow key={e.key} entry={e} index={i} list={list} kind={kind} />
      ))}
    </Reorder.Group>
  )
}

function EntryRow({ entry: e, index: i, list, kind }: { entry: Entry; index: number; list: ReturnType<typeof useEntries>; kind: 'pdf' | 'image' }) {
  const t = useT()
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={e}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileDrag={{ scale: 1.015, boxShadow: 'var(--shadow-pop)', zIndex: 5 }}
      className="relative flex items-center gap-3 border-b border-line/70 bg-panel px-4 py-3 last:border-b-0"
    >
      <span
        className="flex h-8 w-5 cursor-grab touch-none items-center justify-center text-dim hover:text-faded active:cursor-grabbing"
        onPointerDown={(ev) => controls.start(ev)}
        aria-hidden="true"
      >
        <GripVertical size={15} />
      </span>
      <span className="w-5 text-right text-xs tabular-nums text-dim">{i + 1}</span>
      {kind === 'image' ? (
        <ImagePreview path={e.path} />
      ) : (
        <span className="relative flex h-11 w-11 items-center justify-center rounded-md border border-line bg-raised text-cyan">
          <FileText size={17} />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-panel" style={{ background: stackColor(i) }} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{fileName(e.path)}</p>
        <p className="text-xs text-faded">
          {e.pages !== undefined && <>{t('{n} pages', { n: e.pages })} · </>}
          {bytes(e.size)}
        </p>
      </div>
      <IconButton label={t('Move up')} disabled={i === 0} onClick={() => list.move(i, -1)}>
        <ArrowUp size={15} />
      </IconButton>
      <IconButton label={t('Move down')} disabled={i === list.entries.length - 1} onClick={() => list.move(i, 1)}>
        <ArrowDown size={15} />
      </IconButton>
      <IconButton label={t('Remove')} onClick={() => list.setEntries((es) => es.filter((x) => x.key !== e.key))}>
        <X size={15} />
      </IconButton>
    </Reorder.Item>
  )
}

function ListLayout({
  title,
  description,
  list,
  kind,
  side
}: {
  title: string
  description: string
  list: ReturnType<typeof useEntries>
  kind: 'pdf' | 'image'
  side: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={iconFor(title)} title={t(title)} description={t(description)} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="min-h-0 space-y-4 overflow-y-auto pb-6">
          {list.error && <ErrorNote message={list.error} onClose={() => list.setError(null)} />}
          {list.entries.length ? (
            <DropTarget accept={kind === 'pdf' ? ['pdf'] : IMAGE_EXTS} onFiles={list.add} className="rounded-[var(--radius-card)]">
              <Panel className="overflow-hidden">
                <EntryList list={list} kind={kind} />
                <div className="border-t border-line p-3">
                  <Button variant="quiet" icon={<Plus size={15} />} onClick={list.pick}>
                    {t('Add files')}
                  </Button>
                </div>
              </Panel>
            </DropTarget>
          ) : (
            <EmptyDrop
              accept={kind === 'pdf' ? ['pdf'] : IMAGE_EXTS}
              onFiles={list.add}
              onPick={list.pick}
              title={t(kind === 'pdf' ? 'Drop PDFs here' : 'Drop images here')}
              button={t('Choose files')}
              icon={kind === 'image' ? <ImageIcon size={24} strokeWidth={1.6} /> : undefined}
            />
          )}
        </div>
        <aside className="min-h-0 overflow-y-auto pb-6">
          <Panel className="space-y-5 p-5">{side}</Panel>
        </aside>
      </div>
    </div>
  )
}

export function Merge() {
  const t = useT()
  const list = useEntries('pdf')
  const outDir = useOutDir()
  const task = useTask<{ output: string; size: number }>()
  const total = list.entries.reduce((n, e) => n + (e.pages ?? 0), 0)
  async function run() {
    const first = list.entries[0].path
    const out = await api.outputPath(first, 'pdf', outDir, ` — ${t('merged')}`)
    const pw = Object.fromEntries(list.entries.filter((e) => e.password).map((e) => [e.path, e.password!]))
    await task.run(() => api.merge(list.entries.map((e) => e.path), out, pw))
  }
  return (
    <ListLayout
      title="Merge"
      description="Combine several PDFs into one, in the order you set."
      list={list}
      kind="pdf"
      side={
        <>
          <div>
            <p className="font-display text-4xl font-semibold tabular-nums">{total}</p>
            <p className="text-[13px] text-faded">{t('Pages')}</p>
            {total > 0 && (
              <div className="mt-3 flex h-2.5 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
                {list.entries.map((e, i) => (
                  <span key={e.key} className="h-full rounded-sm transition-[flex-grow] duration-500" style={{ flexGrow: e.pages ?? 0, background: stackColor(i) }} />
                ))}
              </div>
            )}
          </div>
          <Button variant="primary" className="h-10 w-full" disabled={list.entries.length < 2 || task.busy} onClick={run}>
            {task.busy ? <><Spinner />{t('Working…')}</> : t('Merge PDFs')}
          </Button>
          {list.entries.length < 2 && <p className="text-xs text-dim">{t('Add at least two PDFs')}</p>}
          {task.error && <ErrorNote message={task.error} onClose={task.clear} />}
          {task.result && <SavedFile path={task.result.output} size={task.result.size} />}
        </>
      }
    />
  )
}

export function ImagesToPdf() {
  const t = useT()
  const list = useEntries('image')
  const outDir = useOutDir()
  const task = useTask<{ output: string; size: number }>()
  const [fit, setFit] = useState<'image' | 'a4'>('a4')
  async function run() {
    const out = await api.outputPath(list.entries[0].path, 'pdf', outDir)
    await task.run(() => api.fromImages(list.entries.map((e) => e.path), out, fit))
  }
  return (
    <ListLayout
      title="Images to PDF"
      description="Put photos and scans into one PDF."
      list={list}
      kind="image"
      side={
        <>
          <Field label={t('Page fit')}>
            <Segmented value={fit} onChange={setFit} options={[{ value: 'a4', label: t('A4 with margins') }, { value: 'image', label: t('Match each image') }]} />
          </Field>
          <Button variant="primary" className="h-10 w-full" disabled={!list.entries.length || task.busy} onClick={run}>
            {task.busy ? <><Spinner />{t('Working…')}</> : t('Create PDF')}
          </Button>
          {task.error && <ErrorNote message={task.error} onClose={task.clear} />}
          {task.result && <SavedFile path={task.result.output} size={task.result.size} />}
        </>
      }
    />
  )
}
