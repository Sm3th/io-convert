import { useEffect, useState, type ReactNode } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { openPdf, type PdfDoc } from '@/lib/pdfjs'
import { bytes, fileName } from '@/lib/format'
import { useT } from '@/lib/settings'
import { useDemoFiles, type PickedPdf, type usePdfFile } from '@/lib/hooks'
import { Button, DropTarget, ErrorNote, PageHeader, Panel } from './ui'
import { Thumb } from './Thumb'
import { iconFor } from './Sidebar'

export function usePdfDoc(file: PickedPdf | null): PdfDoc | null {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  useEffect(() => {
    setDoc(null)
    if (!file) return
    let alive = true
    let opened: PdfDoc | null = null
    api
      .read(file.path)
      .then((data) => openPdf(data, file.password))
      .then((d) => {
        opened = d
        if (alive) setDoc(d)
        else void d.loadingTask.destroy()
      })
      .catch(() => {})
    return () => {
      alive = false
      void opened?.loadingTask.destroy()
    }
  }, [file])
  return doc
}

export function EmptyDrop({
  onFiles,
  onPick,
  title,
  button,
  icon,
  accept = ['pdf']
}: {
  onFiles: (p: string[]) => void
  onPick: () => void
  title: string
  button: string
  icon?: ReactNode
  accept?: string[]
}) {
  const t = useT()
  const hint = t('Files stay on this computer')
  return (
    <DropTarget onFiles={onFiles} accept={accept} className="h-full rounded-[var(--radius-card)]" activeClassName="ring-2 ring-cyan">
      <button
        onClick={onPick}
        className="group flex h-full min-h-[340px] w-full flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-[radial-gradient(90%_70%_at_50%_0%,color-mix(in_srgb,var(--color-glow)_40%,transparent)_0%,transparent_70%)] bg-panel/40 transition-colors hover:border-cyan/60 hover:bg-panel/70"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-raised text-cyan transition-transform duration-300 group-hover:-translate-y-0.5">
          {icon ?? <FileText size={24} strokeWidth={1.6} />}
        </span>
        <span className="font-display text-2xl font-medium">{title}</span>
        <span className="inline-flex h-9 items-center rounded-lg bg-cyan px-4 text-[13px] font-semibold text-on-accent shadow-glow">{button}</span>
        <span className="text-xs text-dim">{hint}</span>
      </button>
    </DropTarget>
  )
}

export function FileSummary({ file, doc, onChange, showPages = 8 }: { file: PickedPdf; doc: PdfDoc | null; onChange: () => void; showPages?: number }) {
  const t = useT()
  const n = Math.min(file.info.pages, showPages)
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <FileText size={18} className="text-cyan" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{fileName(file.path)}</p>
          <p className="text-xs text-faded">
            {t('{n} pages', { n: file.info.pages })} · {bytes(file.info.size)}
          </p>
        </div>
        <Button variant="quiet" icon={<RefreshCw size={14} />} onClick={onChange}>
          {t('Change file')}
        </Button>
      </div>
      {showPages > 0 && (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] justify-items-center gap-x-4 gap-y-5 bg-ink/40 px-5 py-5">
        {doc ? (
          Array.from({ length: n }, (_, i) => (
            <div key={i} className="shrink-0 text-center">
              <Thumb doc={doc} page={i} width={118} />
              <span className="mt-2 block text-xs text-dim">{i + 1}</span>
            </div>
          ))
        ) : (
          <div className="h-[190px]" />
        )}
        {file.info.pages > n && (
          <div className="flex h-[167px] w-[118px] items-center justify-center rounded-[3px] border border-dashed border-line-strong font-display text-lg text-faded">+{file.info.pages - n}</div>
        )}
      </div>
      )}
    </Panel>
  )
}

/**
 * Standard layout for single-PDF tools: file on the left, options and the
 * action on the right.
 */
export function PdfTool({
  title,
  description,
  picker,
  options,
  action,
  result,
  error,
  onClearError,
  main
}: {
  title: string
  description: string
  picker: ReturnType<typeof usePdfFile>
  options?: ReactNode
  action: ReactNode
  result?: ReactNode
  error?: string | null
  onClearError?: () => void
  main?: (file: PickedPdf) => ReactNode
}) {
  const t = useT()
  const doc = usePdfDoc(picker.file)
  useDemoFiles((p) => void picker.load(p[0]))
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={iconFor(title)} title={t(title)} description={t(description)} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="min-h-0 space-y-4 overflow-y-auto pb-6">
          {picker.error && <ErrorNote message={picker.error} onClose={() => picker.setError(null)} />}
          {picker.file ? (
            main ? (
              main(picker.file)
            ) : (
              <DropTarget accept={['pdf']} onFiles={(p) => picker.load(p[0])}>
                <FileSummary file={picker.file} doc={doc} onChange={picker.pick} />
              </DropTarget>
            )
          ) : (
            <EmptyDrop onFiles={(p) => picker.load(p[0])} onPick={picker.pick} title={t('Drop a PDF here')} button={t('Choose a PDF')} />
          )}
        </div>
        <aside className="min-h-0 overflow-y-auto pb-6">
          <Panel className="space-y-5 p-5">
            {options}
            <div className="space-y-3 pt-1">
              {action}
              {!picker.file && <p className="text-center text-xs text-dim">{t('Choose a PDF to get started')}</p>}
              {error && <ErrorNote message={error} onClose={onClearError} />}
              {result}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
