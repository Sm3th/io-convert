import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  MousePointer2,
  Type,
  PenTool,
  ImagePlus,
  Highlighter,
  Eraser,
  Trash2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  type LucideIcon
} from 'lucide-react'
import type { Annotation } from '@shared/formats'
import { api } from '@/lib/api'
import { uid } from '@/lib/format'
import { useT } from '@/lib/settings'
import { useDemoFiles, useOutDir, usePdfFile, useTask } from '@/lib/hooks'
import { renderToCanvas, type PdfDoc } from '@/lib/pdfjs'
import { Button, DropTarget, ErrorNote, IconButton, Modal, PageHeader, Panel, SavedFile, cx } from '@/components/ui'
import { EmptyDrop, usePdfDoc } from '@/components/PdfTool'
import { Thumb } from '@/components/Thumb'
import { ColorRow } from './Tools'

type Tool = 'select' | 'text' | 'signature' | 'image' | 'highlight' | 'rect'
interface Item extends Annotation {
  id: string
  url?: string // preview for images
}

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'signature', label: 'Signature', icon: PenTool },
  { id: 'image', label: 'Image', icon: ImagePlus },
  { id: 'highlight', label: 'Highlight', icon: Highlighter },
  { id: 'rect', label: 'White-out', icon: Eraser }
]

async function toPng(blob: Blob): Promise<{ bytes: Uint8Array; w: number; h: number; url: string }> {
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  const png = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
  return { bytes: new Uint8Array(await png.arrayBuffer()), w: bmp.width, h: bmp.height, url: URL.createObjectURL(png) }
}

// ---------------------------------------------------------------- signature pad
function SignaturePad({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (b: Blob) => void }) {
  const t = useT()
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)
  const [ink, setInk] = useState('#1a2a6c')
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const c = ref.current
      if (!c) return
      c.width = 740
      c.height = 260
      setEmpty(true)
    })
  }, [open])
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 740, ((e.clientY - r.top) / r.height) * 260] as const
  }
  function trimmed(): Promise<Blob> {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let [x0, y0, x1, y1] = [c.width, c.height, 0, 0]
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 10) {
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
    const pad = 8
    const w = Math.max(1, x1 - x0 + pad * 2)
    const h = Math.max(1, y1 - y0 + pad * 2)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d')!.drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, w, h)
    return new Promise((r) => out.toBlob((b) => r(b!), 'image/png'))
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-xl font-semibold">{t('Draw your signature')}</h2>
      <canvas
        ref={ref}
        className="mt-4 h-[130px] w-full touch-none rounded-xl bg-white"
        style={{ cursor: 'crosshair' }}
        onPointerDown={(e) => {
          drawing.current = true
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          const ctx = ref.current!.getContext('2d')!
          const [x, y] = pos(e)
          ctx.beginPath()
          ctx.moveTo(x, y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = ref.current!.getContext('2d')!
          ctx.lineWidth = 3.2
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = ink
          const [x, y] = pos(e)
          ctx.lineTo(x, y)
          ctx.stroke()
          setEmpty(false)
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <div className="mt-4 flex items-center justify-between">
        <ColorRow value={ink} onChange={setInk} colors={['#1a2a6c', '#111111', '#1f5fbf']} />
        <div className="flex gap-2">
          <Button variant="quiet" onClick={() => (ref.current!.getContext('2d')!.clearRect(0, 0, 740, 260), setEmpty(true))}>
            {t('Clear')}
          </Button>
          <Button variant="primary" disabled={empty} onClick={async () => onUse(await trimmed())}>
            {t('Use signature')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- page canvas
function PageCanvas({ doc, page, width, onSize }: { doc: PdfDoc; page: number; width: number; onSize: (w: number, h: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const sizeCb = useRef(onSize)
  sizeCb.current = onSize
  useEffect(() => {
    let alive = true
    renderToCanvas(doc, page, ref.current!, width).then((s) => alive && sizeCb.current(s.width, s.height)).catch(() => {})
    return () => {
      alive = false
    }
  }, [doc, page, width])
  return <canvas ref={ref} className="block bg-white" />
}

// ---------------------------------------------------------------- editor
export function Editor() {
  const t = useT()
  const picker = usePdfFile()
  const doc = usePdfDoc(picker.file)
  useDemoFiles((p) => void picker.load(p[0]))
  const outDir = useOutDir()
  const task = useTask<{ output: string; size: number }>()
  const [page, setPage] = useState(0)
  const [tool, setTool] = useState<Tool>('select')
  const [items, setItems] = useState<Item[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [color, setColor] = useState('#111111')
  const [fontPt, setFontPt] = useState(14)
  const [sigOpen, setSigOpen] = useState(false)
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(700)
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; orig: Item } | null>(null)
  const pageHeightPt = useRef(842)

  useEffect(() => {
    setItems([])
    setPage(0)
    setSel(null)
    task.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.file])

  useEffect(() => {
    if (!doc) return
    doc.getPage(page + 1).then((p) => (pageHeightPt.current = p.getViewport({ scale: 1 }).height))
  }, [doc, page])

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(() => setStageW(Math.min(860, el.clientWidth - 64)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (editing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        setItems((its) => its.filter((i) => i.id !== sel))
        setSel(null)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sel, editing])

  const width = Math.round(stageW * zoom)
  const onSize = (w: number, h: number) => setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
  const frac = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.querySelector('[data-page]')!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const patch = (id: string, p: Partial<Item>) => setItems((its) => its.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const current = items.filter((i) => i.page === page)
  const selected = items.find((i) => i.id === sel)

  function placeImage(png: { bytes: Uint8Array; w: number; h: number; url: string }, at?: { x: number; y: number }) {
    const aspect = png.h / png.w
    const w = 0.3
    const h = (w * aspect * size.w) / size.h
    const x = at ? at.x - w / 2 : 0.5 - w / 2
    const y = at ? at.y - h / 2 : 0.7
    const id = uid()
    setItems((its) => [...its, { id, kind: 'image', page, x, y, w, h, image: png.bytes, url: png.url }])
    setSel(id)
    setTool('select')
  }

  async function pickImage() {
    const [p] = await api.openFiles([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }], false)
    if (!p) return setTool('select')
    const bytes = await api.read(p)
    placeImage(await toPng(new Blob([bytes as BlobPart])))
  }

  function onStageDown(e: React.PointerEvent) {
    if (!(e.target as HTMLElement).closest('[data-page]')) return
    if ((e.target as HTMLElement).closest('[data-item]')) return
    const p = frac(e)
    if (tool === 'select') {
      setSel(null)
      setEditing(null)
      return
    }
    if (tool === 'text') {
      const id = uid()
      const fontSize = fontPt / pageHeightPt.current
      setItems((its) => [...its, { id, kind: 'text', page, x: p.x, y: p.y - fontSize * 0.6, w: 0.25, h: fontSize * 1.3, text: '', fontSize, color }])
      setSel(id)
      setEditing(id)
      setTool('select')
      return
    }
    if (tool === 'highlight' || tool === 'rect') {
      setDraft({ x: p.x, y: p.y, w: 0, h: 0 })
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* synthetic pointer: capture is optional */
      }
    }
  }
  function onStageMove(e: React.PointerEvent) {
    if (draft) {
      const p = frac(e)
      setDraft((d) => d && { ...d, w: p.x - d.x, h: p.y - d.y })
      return
    }
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / size.w
    const dy = (e.clientY - d.sy) / size.h
    if (d.mode === 'move') patch(d.id, { x: d.orig.x + dx, y: d.orig.y + dy })
    else if (d.orig.kind === 'image') {
      const w = Math.max(0.03, d.orig.w + dx)
      patch(d.id, { w, h: (w * d.orig.h) / d.orig.w })
    } else patch(d.id, { w: Math.max(0.01, d.orig.w + dx), h: Math.max(0.005, d.orig.h + dy) })
  }
  function onStageUp() {
    if (draft) {
      const r = { x: Math.min(draft.x, draft.x + draft.w), y: Math.min(draft.y, draft.y + draft.h), w: Math.abs(draft.w), h: Math.abs(draft.h) }
      if (r.w > 0.005 && r.h > 0.003) {
        const id = uid()
        setItems((its) => [...its, { id, kind: tool === 'rect' ? 'rect' : 'highlight', page, ...r, color: tool === 'rect' ? '#ffffff' : '#ffe14d' }])
        setSel(id)
      }
      setDraft(null)
    }
    drag.current = null
  }

  async function save() {
    const f = picker.file!
    const out = await api.outputPath(f.path, 'pdf', outDir, ' — signed')
    const annotations: Annotation[] = items
      .filter((i) => i.kind !== 'text' || i.text?.trim())
      .map(({ id: _id, url: _url, ...a }) => a) // eslint-disable-line @typescript-eslint/no-unused-vars
    await task.run(() => api.annotate(f.path, annotations, out, f.password))
  }

  if (!picker.file || !doc) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('Edit & sign')} description={t('Add text, your signature, images, highlights or white-out.')} />
        {picker.error && <ErrorNote message={picker.error} onClose={() => picker.setError(null)} />}
        <EmptyDrop onFiles={(p) => picker.load(p[0])} onPick={picker.pick} title={t('Drop a PDF here')} button={t('Choose a PDF')} />
      </div>
    )
  }

  const hint = tool === 'text' || tool === 'signature' || tool === 'image' ? t('Click on the page to place it') : tool === 'highlight' || tool === 'rect' ? t('Drag on the page to cover an area') : ''

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('Edit & sign')}
        description={t('Add text, your signature, images, highlights or white-out.')}
        actions={
          <>
            <Button variant="quiet" icon={<RefreshCw size={14} />} onClick={picker.pick}>
              {t('Change file')}
            </Button>
            <Button variant="primary" disabled={!items.length || task.busy} onClick={save}>
              {task.busy ? t('Working…') : t('Save PDF')}
            </Button>
          </>
        }
      />
      {(task.error || task.result) && (
        <div className="mb-4">
          {task.error && <ErrorNote message={task.error} onClose={task.clear} />}
          {task.result && <SavedFile path={task.result.output} size={task.result.size} note={t('{n} edits', { n: items.length })} />}
        </div>
      )}
      <Panel className="flex min-h-0 flex-1 overflow-hidden">
        {/* page strip */}
        <div className="w-[118px] shrink-0 space-y-4 overflow-y-auto border-r border-line bg-ink/40 p-4">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)} className="block w-full text-center">
              <div className={cx('rounded-md p-1 transition-colors', page === i ? 'bg-cyan/20 ring-2 ring-cyan' : 'hover:bg-raised')}>
                <Thumb doc={doc} page={i} width={76} />
              </div>
              <span className="mt-1 block text-[11px] text-dim">
                {i + 1}
                {items.some((it) => it.page === i) && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle" />}
              </span>
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* toolbar */}
          <div className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-line px-3">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTool(id)
                  if (id === 'signature') setSigOpen(true)
                  if (id === 'image') void pickImage()
                }}
                className={cx(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors',
                  tool === id ? 'bg-cyan/15 text-cyan' : 'text-faded hover:bg-raised hover:text-paper'
                )}
              >
                <Icon size={15} />
                <span className={cx(selected?.kind === 'text' || tool === 'text' ? 'hidden 2xl:inline' : '')}>{t(label)}</span>
              </button>
            ))}
            <span className="mx-2 h-5 w-px bg-line" />
            {(selected?.kind === 'text' || tool === 'text') && (
              <div className="flex items-center gap-3">
                <ColorRow
                  value={selected?.kind === 'text' ? selected.color! : color}
                  onChange={(c) => (setColor(c), selected?.kind === 'text' && patch(selected.id, { color: c }))}
                  colors={['#111111', '#1f5fbf', '#c62828']}
                  small
                />
                <select
                  className="h-8 rounded-md border border-line bg-ink px-2 text-[13px]"
                  value={selected?.kind === 'text' ? Math.round(selected.fontSize! * pageHeightPt.current) : fontPt}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setFontPt(v)
                    if (selected?.kind === 'text') patch(selected.id, { fontSize: v / pageHeightPt.current })
                  }}
                  aria-label={t('Size')}
                >
                  {[8, 10, 12, 14, 18, 24, 32, 48].map((s) => (
                    <option key={s} value={s}>
                      {s} pt
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              {selected && (
                <IconButton label={t('Delete item')} className="hover:text-coral" onClick={() => (setItems((its) => its.filter((i) => i.id !== sel)), setSel(null))}>
                  <Trash2 size={16} />
                </IconButton>
              )}
              <IconButton label={t('Zoom')} onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
                <ZoomOut size={16} />
              </IconButton>
              <span className="w-10 text-center text-xs tabular-nums text-faded">{Math.round(zoom * 100)}%</span>
              <IconButton label={t('Zoom')} onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
                <ZoomIn size={16} />
              </IconButton>
            </div>
          </div>

          {/* stage */}
          <div
            ref={stage}
            className={cx('relative min-h-0 flex-1 overflow-auto bg-[#0a1326] p-8', tool !== 'select' && 'cursor-crosshair')}
            onPointerDown={onStageDown}
            onPointerMove={onStageMove}
            onPointerUp={onStageUp}
          >
            {hint && <p className="pointer-events-none sticky top-0 z-20 mx-auto mb-3 w-fit rounded-full bg-amber px-3 py-1 text-xs font-medium text-ink">{hint}</p>}
            <div data-page className="relative mx-auto w-fit shadow-[0_20px_60px_-20px_#000]">
              <PageCanvas doc={doc} page={page} width={width} onSize={onSize} />
              {current.map((it) => (
                <div
                  key={it.id}
                  data-item
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setSel(it.id)
                    if (editing === it.id) return
                    drag.current = { id: it.id, mode: 'move', sx: e.clientX, sy: e.clientY, orig: it }
                    stage.current!.setPointerCapture(e.pointerId)
                  }}
                  onDoubleClick={() => it.kind === 'text' && setEditing(it.id)}
                  className={cx('absolute', editing === it.id ? 'cursor-text' : 'cursor-move', sel === it.id && 'outline outline-2 outline-offset-2 outline-cyan')}
                  style={{
                    left: `${it.x * 100}%`,
                    top: `${it.y * 100}%`,
                    width: it.kind === 'text' ? undefined : `${it.w * 100}%`,
                    height: it.kind === 'text' ? undefined : `${it.h * 100}%`,
                    background: it.kind === 'rect' ? it.color : it.kind === 'highlight' ? `${it.color}66` : undefined,
                    mixBlendMode: it.kind === 'highlight' ? 'multiply' : undefined
                  }}
                >
                  {it.kind === 'image' && <img src={it.url} alt="" className="pointer-events-none h-full w-full" draggable={false} />}
                  {it.kind === 'text' && (
                    <TextBox
                      item={it}
                      editing={editing === it.id}
                      pageH={size.h}
                      placeholder={t('Type here')}
                      onChange={(text) => patch(it.id, { text })}
                      onDone={() => {
                        setEditing(null)
                        if (!it.text?.trim()) setItems((its) => its.filter((x) => x.id !== it.id))
                      }}
                    />
                  )}
                  {sel === it.id && it.kind !== 'text' && (
                    <span
                      className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-ink bg-cyan"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        drag.current = { id: it.id, mode: 'resize', sx: e.clientX, sy: e.clientY, orig: it }
                        stage.current!.setPointerCapture(e.pointerId)
                      }}
                    />
                  )}
                </div>
              ))}
              {draft && (
                <div
                  className={cx('absolute border border-dashed', tool === 'rect' ? 'border-faded bg-white' : 'border-amber bg-[#ffe14d66]')}
                  style={{
                    left: `${Math.min(draft.x, draft.x + draft.w) * 100}%`,
                    top: `${Math.min(draft.y, draft.y + draft.h) * 100}%`,
                    width: `${Math.abs(draft.w) * 100}%`,
                    height: `${Math.abs(draft.h) * 100}%`
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </Panel>

      <SignaturePad
        open={sigOpen}
        onClose={() => (setSigOpen(false), setTool('select'))}
        onUse={async (blob) => {
          setSigOpen(false)
          placeImage(await toPng(blob))
        }}
      />
    </div>
  )
}

function TextBox({
  item,
  editing,
  pageH,
  placeholder,
  onChange,
  onDone
}: {
  item: Item
  editing: boolean
  pageH: number
  placeholder: string
  onChange: (s: string) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const px = (item.fontSize ?? 0.018) * pageH
  const lines = (item.text || placeholder).split('\n')
  const cols = Math.max(4, ...lines.map((l) => l.length)) + 1
  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])
  const style = { fontSize: `${px}px`, lineHeight: 1.25, color: item.color, fontFamily: 'Arial, "Liberation Sans", sans-serif' }
  return editing ? (
    <textarea
      ref={ref}
      value={item.text}
      placeholder={placeholder}
      rows={lines.length}
      cols={cols}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget as HTMLTextAreaElement).blur()}
      className="block resize-none overflow-hidden whitespace-pre bg-cyan/10 p-0 outline-none placeholder:text-[#8899b8]"
      style={{ ...style, width: `${cols * 0.6}em` }}
    />
  ) : (
    <div className="whitespace-pre" style={style}>
      {item.text}
    </div>
  )
}
