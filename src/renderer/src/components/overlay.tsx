import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './ui'

/**
 * Floating layers (tooltips, menus, toasts) render into <body>, so they are
 * never clipped by a scrolling panel or shifted by a transformed ancestor.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const q = window.matchMedia(query)
    const on = () => setMatch(q.matches)
    on()
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [query])
  return match
}

type Side = 'top' | 'bottom' | 'right'

/** Hover/focus label. Wraps its trigger; shows after a short delay. */
export function Tooltip({
  label,
  side = 'bottom',
  shortcut,
  className,
  disabled,
  children
}: {
  label: string
  side?: Side
  shortcut?: string
  className?: string
  disabled?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<number>(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => ref.current && setRect(ref.current.getBoundingClientRect()), 380)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setRect(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <span
      ref={ref}
      className={cx('inline-flex', className)}
      onMouseEnter={disabled ? undefined : show}
      onMouseLeave={hide}
      onFocus={disabled ? undefined : show}
      onBlur={hide}
      onMouseDown={hide}
    >
      {children}
      {rect && !disabled && (
        <Portal>
          <TipBubble rect={rect} side={side} label={label} shortcut={shortcut} />
        </Portal>
      )}
    </span>
  )
}

function TipBubble({ rect, side, label, shortcut }: { rect: DOMRect; side: Side; label: string; shortcut?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const gap = 8
    let left = side === 'right' ? rect.right + gap : rect.left + rect.width / 2 - w / 2
    let top = side === 'right' ? rect.top + rect.height / 2 - h / 2 : side === 'top' ? rect.top - h - gap : rect.bottom + gap
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left))
    top = Math.max(8, Math.min(window.innerHeight - h - 8, top))
    setPos({ left, top })
  }, [rect, side])
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[80] flex items-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-panel px-2 py-1 text-xs font-medium text-paper shadow-pop transition-opacity duration-150"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, opacity: pos ? 1 : 0 }}
    >
      {label}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </div>
  )
}

/** A key cap, for shortcuts shown in the UI. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line-strong bg-ink/60 px-1 font-sans text-[10.5px] font-semibold leading-none text-faded',
        className
      )}
    >
      {children}
    </kbd>
  )
}
