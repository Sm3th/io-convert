import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FilePlus2 } from 'lucide-react'
import { useT } from './settings'

/**
 * Files dragged from the OS anywhere over the window. One full-window layer
 * catches the drop and hands the files to the drop zone of the current
 * screen. Files that screen cannot use go to Convert instead.
 */

interface Target {
  id: number
  onFiles: (paths: string[]) => void
  accept?: string[] // lower-case extensions; undefined = anything
}

interface DropCtx {
  register: (t: Omit<Target, 'id'>) => () => void
  /** True while files from the OS hover over the window. */
  dragging: boolean
}

const Ctx = createContext<DropCtx>({ register: () => () => {}, dragging: false })
export const useDrop = () => useContext(Ctx)

/**
 * False for a screen kept alive in the background (Convert, so a running
 * batch survives switching tools). Its drop zones step aside meanwhile.
 */
export const PageActive = createContext(true)
export const usePageActive = () => useContext(PageActive)

const extOf = (p: string) => p.slice(p.lastIndexOf('.') + 1).toLowerCase()
const isFileDrag = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')

export function DropProvider({
  children,
  pageLabel,
  onFallback
}: {
  children: ReactNode
  /** Name of the current screen, shown in the drop layer. */
  pageLabel: string
  /** Open Convert; the files are delivered once its drop zone mounts. */
  onFallback: () => void
}) {
  const t = useT()
  const targets = useRef<Target[]>([])
  const pending = useRef<string[] | null>(null)
  const nextId = useRef(1)
  const [dragging, setDragging] = useState(false)
  const [count, setCount] = useState(0)

  const accepts = (tg: Target, p: string) => !tg.accept || tg.accept.includes(extOf(p))

  const register = useCallback((tg: Omit<Target, 'id'>) => {
    const entry = { ...tg, id: nextId.current++ }
    targets.current.push(entry)
    if (pending.current) {
      const files = pending.current.filter((p) => accepts(entry, p))
      if (files.length) {
        pending.current = null
        window.setTimeout(() => entry.onFiles(files), 0)
      }
    }
    return () => {
      targets.current = targets.current.filter((x) => x.id !== entry.id)
    }
  }, [])

  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      depth++
      setCount(e.dataTransfer?.items.length ?? 0)
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      depth = 0
      setDragging(false)
      if (!isFileDrag(e)) return
      const paths = [...(e.dataTransfer?.files ?? [])].map((f) => window.io.pathForFile(f)).filter(Boolean)
      if (!paths.length) return
      const top = targets.current[targets.current.length - 1]
      const usable = top ? paths.filter((p) => accepts(top, p)) : []
      if (top && usable.length) top.onFiles(usable)
      else {
        pending.current = paths
        onFallback()
        // Delivered when Convert's zone mounts; never resurface later.
        window.setTimeout(() => (pending.current = null), 3000)
      }
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [onFallback])

  const value = useMemo(() => ({ register, dragging }), [register, dragging])
  const hasTarget = targets.current.length > 0
  return (
    <Ctx.Provider value={value}>
      {children}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-scrim/45 backdrop-blur-[2px]">
          <div className="pop-in flex flex-col items-center gap-3 rounded-[22px] border-2 border-dashed border-cyan/70 bg-panel/95 px-14 py-10 shadow-pop">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/15 text-cyan">
              <FilePlus2 size={26} strokeWidth={1.7} />
            </span>
            <p className="font-display text-2xl font-semibold">
              {count > 1 ? t('Drop to add {n} files', { n: count }) : t('Drop to add the file')}
            </p>
            <p className="text-[13px] text-faded">{hasTarget ? `→ ${pageLabel}` : `→ ${t('Convert')}`}</p>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
