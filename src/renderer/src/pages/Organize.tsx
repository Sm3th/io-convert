import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { RotateCcw, RotateCw, Copy, Trash2, Undo2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { uid } from '@/lib/format'
import { useT } from '@/lib/settings'
import { useDemoFiles, useOutDir, usePdfFile, useTask } from '@/lib/hooks'
import { Button, DropTarget, ErrorNote, IconButton, PageHeader, Panel, SavedFile, cx, Spinner } from '@/components/ui'
import { EmptyDrop, usePdfDoc } from '@/components/PdfTool'
import { Thumb } from '@/components/Thumb'
import { iconFor } from '@/components/Sidebar'

interface Item {
  key: string
  index: number
  rotate: number
}

export function Organize() {
  const t = useT()
  const picker = usePdfFile()
  const doc = usePdfDoc(picker.file)
  useDemoFiles((p) => void picker.load(p[0]))
  const outDir = useOutDir()
  const task = useTask<{ output: string; size: number }>()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  const initial = () => Array.from({ length: picker.file?.info.pages ?? 0 }, (_, index) => ({ key: uid(), index, rotate: 0 }))
  useEffect(() => {
    setItems(initial())
    setSelected(new Set())
    task.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.file])

  // Keyboard: R / Shift+R rotate, Del removes, Ctrl+D duplicates, Ctrl+A selects all.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [role=dialog], [role=listbox]')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(new Set(items.map((i) => i.key)))
      } else if (!selected.size) return
      else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicate()
      } else if (!mod && e.key.toLowerCase() === 'r') rotate(e.shiftKey ? -90 : 90)
      else if (e.key === 'Delete' || e.key === 'Backspace') remove()
      else if (e.key === 'Escape') setSelected(new Set())
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const targets = (key?: string) => (key && !selected.has(key) ? new Set([key]) : selected)

  function rotate(by: number, key?: string) {
    const set = targets(key)
    setItems((its) => its.map((it) => (set.has(it.key) ? { ...it, rotate: (it.rotate + by + 360) % 360 } : it)))
  }
  function duplicate(key?: string) {
    const set = targets(key)
    setItems((its) => its.flatMap((it) => (set.has(it.key) ? [it, { ...it, key: uid() }] : [it])))
  }
  function remove(key?: string) {
    const set = targets(key)
    setItems((its) => its.filter((it) => !set.has(it.key)))
    setSelected(new Set())
  }
  function click(e: React.MouseEvent, key: string) {
    if (e.shiftKey && anchor) {
      const a = items.findIndex((i) => i.key === anchor)
      const b = items.findIndex((i) => i.key === key)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      setSelected(new Set(items.slice(lo, hi + 1).map((i) => i.key)))
      return
    }
    setAnchor(key)
    setSelected((s) => {
      const n = new Set(e.ctrlKey || e.metaKey ? s : [])
      if (s.has(key) && (e.ctrlKey || e.metaKey)) n.delete(key)
      else n.add(key)
      return n
    })
  }
  function drop() {
    if (dragKey === null || dropAt === null) return
    setItems((its) => {
      const moving = selected.has(dragKey) ? its.filter((i) => selected.has(i.key)) : its.filter((i) => i.key === dragKey)
      const before = its.slice(0, dropAt).filter((i) => !moving.includes(i)).length
      const rest = its.filter((i) => !moving.includes(i))
      return [...rest.slice(0, before), ...moving, ...rest.slice(before)]
    })
    setDragKey(null)
    setDropAt(null)
  }

  async function save() {
    if (!picker.file) return
    const out = await api.outputPath(picker.file.path, 'pdf', outDir, ` — ${t('organized')}`)
    await task.run(() => api.organize(picker.file!.path, items.map(({ index, rotate }) => ({ index, rotate })), out, picker.file!.password))
  }

  const changed = items.length !== (picker.file?.info.pages ?? 0) || items.some((it, i) => it.index !== i || it.rotate)
  const sel = selected.size

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={iconFor('Organize pages')}
        title={t('Organize pages')}
        description={t('Reorder, rotate, duplicate or delete pages. Drag to rearrange.')}
        actions={
          picker.file && (
            <>
              <Button variant="quiet" icon={<RefreshCw size={14} />} onClick={picker.pick}>
                {t('Change file')}
              </Button>
              <Button variant="primary" onClick={save} disabled={task.busy || !items.length}>
                {task.busy ? <><Spinner />{t('Working…')}</> : t('Save PDF')}
              </Button>
            </>
          )
        }
      />
      {picker.error && <ErrorNote message={picker.error} onClose={() => picker.setError(null)} />}
      {!picker.file ? (
        <EmptyDrop onFiles={(p) => picker.load(p[0])} onPick={picker.pick} title={t('Drop a PDF here')} button={t('Choose a PDF')} />
      ) : (
        <DropTarget accept={['pdf']} onFiles={(p) => picker.load(p[0])} className="flex min-h-0 flex-1 flex-col">
          <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-12 items-center gap-1 border-b border-line px-3">
              <span className="mr-3 pl-2 text-[13px] text-faded">{sel ? t('{n} selected', { n: sel }) : t('{n} pages', { n: items.length })}</span>
              <IconButton label={t('Rotate left')} shortcut="Shift R" disabled={!sel} onClick={() => rotate(-90)}>
                <RotateCcw size={16} />
              </IconButton>
              <IconButton label={t('Rotate right')} shortcut="R" disabled={!sel} onClick={() => rotate(90)}>
                <RotateCw size={16} />
              </IconButton>
              <IconButton label={t('Duplicate')} shortcut="Ctrl D" disabled={!sel} onClick={() => duplicate()}>
                <Copy size={16} />
              </IconButton>
              <IconButton label={t('Delete')} shortcut="Del" disabled={!sel} onClick={() => remove()} className="hover:text-coral">
                <Trash2 size={16} />
              </IconButton>
              <span className="mx-2 h-5 w-px bg-line" />
              <Button variant="quiet" className="h-8" onClick={() => setSelected(new Set(items.map((i) => i.key)))}>
                {t('Select all')}
              </Button>
              <Button variant="quiet" className="h-8" icon={<Undo2 size={14} />} disabled={!changed} onClick={() => (setItems(initial()), setSelected(new Set()))}>
                {t('Reset changes')}
              </Button>
            </div>
            <div
              className="dot-grid min-h-0 flex-1 overflow-y-auto p-6"
              onClick={(e) => e.target === e.currentTarget && setSelected(new Set())}
            >
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7">
                {doc &&
                  items.map((it, pos) => (
                    <motion.div key={it.key} layout="position" transition={{ type: 'spring', stiffness: 480, damping: 38 }}>
                    <div
                      data-testid="page-card"
                      draggable
                      onDragStart={(e) => {
                        setDragKey(it.key)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => {
                        if (dragKey === null) return
                        e.preventDefault()
                        const r = e.currentTarget.getBoundingClientRect()
                        setDropAt(e.clientX < r.left + r.width / 2 ? pos : pos + 1)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        drop()
                      }}
                      onDragEnd={() => (setDragKey(null), setDropAt(null))}
                      onClick={(e) => click(e, it.key)}
                      className={cx('group relative flex cursor-grab flex-col items-center', dragKey === it.key && 'opacity-40')}
                    >
                      {dropAt === pos && <span className="absolute -left-3 top-0 bottom-6 w-[3px] rounded-full bg-amber" />}
                      {dropAt === pos + 1 && pos === items.length - 1 && <span className="absolute -right-3 top-0 bottom-6 w-[3px] rounded-full bg-amber" />}
                      <div
                        className={cx(
                          'relative flex h-[190px] w-full items-center justify-center rounded-xl p-2 transition-colors',
                          selected.has(it.key) ? 'bg-cyan/15 ring-2 ring-cyan' : 'hover:bg-raised/60'
                        )}
                      >
                        <div className="transition-transform duration-300" style={{ transform: `rotate(${it.rotate}deg)` }}>
                          <Thumb doc={doc} page={it.index} width={it.rotate % 180 ? 112 : 120} />
                        </div>
                        <div className="absolute right-1.5 top-1.5 hidden gap-0.5 rounded-lg border border-line bg-panel/95 p-0.5 group-hover:flex">
                          <IconButton label={t('Rotate right')} className="h-7 w-7" onClick={(e) => (e.stopPropagation(), rotate(90, it.key))}>
                            <RotateCw size={14} />
                          </IconButton>
                          <IconButton label={t('Delete')} className="h-7 w-7 hover:text-coral" onClick={(e) => (e.stopPropagation(), remove(it.key))}>
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </div>
                      <span className={cx('mt-2 text-xs tabular-nums', it.index !== pos ? 'text-amber' : 'text-dim')}>
                        {pos + 1}
                        {it.index !== pos && <span className="text-dim"> · {t('Page {n}', { n: it.index + 1 })}</span>}
                      </span>
                    </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          </Panel>
          <div className="space-y-3 pt-4">
            {task.error && <ErrorNote message={task.error} onClose={task.clear} />}
            {task.result && <SavedFile path={task.result.output} size={task.result.size} />}
          </div>
        </DropTarget>
      )}
    </div>
  )
}
