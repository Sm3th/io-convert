import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { FolderOpen, ExternalLink, CircleAlert, CircleCheck, LoaderCircle, X, ChevronDown, Check as CheckMark } from 'lucide-react'
import { useT, useTe } from '@/lib/settings'
import { useDrop, usePageActive } from '@/lib/drop'
import { Portal, Tooltip } from './overlay'
import { OutputThumb } from './Thumb'
import { api } from '@/lib/api'
import { bytes, fileName } from '@/lib/format'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger'
export function Button({
  variant = 'ghost',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-cyan font-semibold text-on-accent shadow-glow hover:bg-cyan-hover active:translate-y-px disabled:translate-y-0 disabled:bg-raised disabled:text-dim disabled:opacity-100 disabled:shadow-none',
        variant === 'ghost' && 'border border-line bg-panel text-paper hover:border-line-strong hover:bg-raised',
        variant === 'quiet' && 'text-faded hover:bg-raised hover:text-paper',
        variant === 'danger' && 'text-coral hover:bg-coral/10',
        className
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  shortcut,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string }) {
  return (
    <Tooltip label={label} shortcut={shortcut} disabled={rest.disabled}>
      <button
        {...rest}
        aria-label={label}
        className={cx(
          'inline-flex h-8 w-8 items-center justify-center rounded-md text-faded transition-colors hover:bg-raised hover:text-paper disabled:opacity-30',
          className
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-faded">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-dim">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'h-9 w-full rounded-lg border border-line bg-ink/60 px-3 text-[13px] text-paper placeholder:text-dim outline-none transition-colors focus:border-cyan'

export interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
  /** Options sharing a group are listed under its heading. */
  group?: string
  /** CSS color for a small dot before the label. */
  dot?: string
}

/**
 * Dropdown with a themed menu (the native <select> popup ignores the app's
 * look). Keyboard: arrows, Home/End, Enter, Escape and type-to-find.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  small,
  disabled,
  testId,
  label
}: {
  value: T
  onChange: (v: T) => void
  options: SelectOption<T>[]
  className?: string
  small?: boolean
  disabled?: boolean
  testId?: string
  /** Accessible name when no visible <label> wraps the control. */
  label?: string
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  return (
    <div className={className}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        data-testid={testId}
        data-value={value}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cx(
          'flex w-full items-center gap-2 rounded-lg border bg-ink/60 pl-3 pr-2.5 text-left text-[13px] text-paper outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-cyan' : 'border-line hover:border-line-strong',
          small ? 'h-8' : 'h-9'
        )}
      >
        {current?.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: current.dot }} />}
        <span className="flex-1 truncate">{current?.label ?? ''}</span>
        <ChevronDown size={14} className={cx('shrink-0 text-faded transition-transform', open && 'rotate-180')} />
      </button>
      {open && trigger.current && (
        <ListboxMenu
          anchor={trigger.current}
          options={options}
          value={value}
          onPick={(v) => {
            onChange(v)
            close()
          }}
          onClose={close}
        />
      )}
    </div>
  )
}

function ListboxMenu<T extends string>({
  anchor,
  options,
  value,
  onPick,
  onClose
}: {
  anchor: HTMLElement
  options: SelectOption<T>[]
  value: T
  onPick: (v: T) => void
  onClose: (refocus?: boolean) => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const enabled = options.filter((o) => !o.disabled)
  const [active, setActive] = useState(() => Math.max(0, enabled.findIndex((o) => o.value === value)))
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)
  const typed = useRef({ text: '', at: 0 })

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const want = Math.min(320, (menu.current?.scrollHeight ?? 320) + 2)
    const up = below < Math.min(want, 200) && above > below
    const maxHeight = Math.min(320, up ? above : below)
    const width = Math.max(r.width, 168)
    setPos({
      left: Math.min(r.left, window.innerWidth - width - 8),
      top: up ? r.top - 6 - Math.min(want, maxHeight) : r.bottom + 6,
      width,
      maxHeight
    })
  }, [anchor])

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    menu.current?.focus()
    const away = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeRef.current(false)
    }
    const gone = () => closeRef.current(false)
    window.addEventListener('mousedown', away)
    window.addEventListener('resize', gone)
    window.addEventListener('blur', gone)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('resize', gone)
      window.removeEventListener('blur', gone)
    }
  }, [anchor])

  useEffect(() => {
    menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => Math.min(enabled.length - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(enabled.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') enabled[active] && onPick(enabled[active].value)
    else if (e.key === 'Escape' || e.key === 'Tab') onClose(e.key === 'Escape')
    else if (e.key.length === 1) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const i = enabled.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
      return
    } else return
    e.preventDefault()
  }

  let lastGroup: string | undefined
  return (
    <Portal>
      <div
        ref={menu}
        role="listbox"
        tabIndex={-1}
        onKeyDown={onKey}
        aria-activedescendant={enabled[active] ? `opt-${enabled[active].value}` : undefined}
        className="pop-in fixed z-85 overflow-y-auto rounded-xl border border-line-strong bg-panel p-1 shadow-pop outline-none"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: pos?.width, maxHeight: pos?.maxHeight }}
      >
        {options.map((o) => {
          const header = o.group && o.group !== lastGroup ? o.group : null
          lastGroup = o.group
          const idx = enabled.indexOf(o)
          const selected = o.value === value
          return (
            <div key={o.value}>
              {header && <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-dim first:pt-1">{header}</p>}
              <div
                id={`opt-${o.value}`}
                role="option"
                aria-selected={selected}
                aria-disabled={o.disabled}
                data-value={o.value}
                data-index={idx}
                onMouseMove={() => idx >= 0 && setActive(idx)}
                onClick={() => !o.disabled && onPick(o.value)}
                className={cx(
                  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px]',
                  o.disabled ? 'cursor-not-allowed opacity-40' : idx === active ? 'bg-raised text-paper' : 'text-faded',
                  selected && 'font-medium text-paper'
                )}
              >
                {o.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
                <span className="flex-1 truncate">{o.label}</span>
                {selected && <CheckMark size={14} className="shrink-0 text-cyan" />}
              </div>
            </div>
          )
        })}
      </div>
    </Portal>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-line bg-ink/60 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-8 flex-1 rounded-md px-2.5 text-[13px] transition-colors',
            value === o.value ? 'bg-raised font-medium text-paper shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-faded hover:text-paper'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = ''
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="flex-1"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
      <span className="w-12 text-right text-[13px] tabular-nums text-paper">
        {value}
        {suffix}
      </span>
    </div>
  )
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px]">
      <span
        className={cx(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-cyan' : 'bg-line'
        )}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_#0005] transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon
}: {
  title: string
  description: string
  actions?: ReactNode
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>
}) {
  return (
    <header className="flex items-end justify-between gap-6 pb-6">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-cyan/12 text-cyan ring-1 ring-inset ring-cyan/20">
            <Icon size={24} strokeWidth={1.7} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          <p className="mt-0.5 max-w-[62ch] text-faded">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  )
}

/**
 * Marks the region of a screen that takes files dropped from the OS. The drop
 * itself is caught window-wide (lib/drop.tsx) and routed to the zone that is
 * on screen; this component registers the zone and lights it up meanwhile.
 */
export function DropTarget({
  onFiles,
  accept,
  children,
  className,
  activeClassName = 'ring-2 ring-cyan ring-offset-4 ring-offset-ink'
}: {
  onFiles: (paths: string[]) => void
  /** Lower-case extensions this zone can use; others go to Convert. */
  accept?: string[]
  children: ReactNode
  className?: string
  activeClassName?: string
}) {
  const { register, dragging } = useDrop()
  const active = usePageActive()
  const handler = useRef(onFiles)
  handler.current = onFiles
  const key = accept?.join(',')
  useEffect(
    () => (active ? register({ onFiles: (p) => handler.current(p), accept }) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [register, key, active]
  )
  return <div className={cx(className, 'transition-shadow', dragging && active && activeClassName)}>{children}</div>
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[var(--radius-card)] border border-line bg-panel', className)}>{children}</section>
}

export function SavedFile({ path, size, note }: { path: string; size?: number; note?: ReactNode }) {
  const t = useT()
  return (
    <div className="pop-in rounded-xl border border-mint/30 bg-mint/[0.06] px-4 py-3">
      <div className="flex items-start gap-3">
        {path.toLowerCase().endsWith('.pdf') ? (
          <div className="relative mt-0.5 shrink-0">
            <OutputThumb path={path} />
            <CircleCheck size={18} className="absolute -right-2 -top-2 rounded-full bg-panel text-mint" />
          </div>
        ) : (
          <CircleCheck size={18} className="mt-0.5 shrink-0 text-mint" />
        )}
        <div className="min-w-0 flex-1 self-center">
          <p className="truncate text-[13px] font-medium text-paper" title={path}>
            {t('Saved {name}', { name: fileName(path) })}
          </p>
          <p className="text-xs text-faded">
            {size !== undefined && bytes(size)}
            {size !== undefined && note && ' · '}
            {note}
          </p>
        </div>
      </div>
      <div className="-ml-2 mt-2 flex gap-1">
        <Button variant="quiet" className="h-8 px-2" icon={<FolderOpen size={14} />} onClick={() => api.show(path)}>
          {t('Show in folder')}
        </Button>
        <Button variant="quiet" className="h-8 px-2" icon={<ExternalLink size={14} />} onClick={() => api.open(path)}>
          {t('Open')}
        </Button>
      </div>
    </div>
  )
}

/** Small spinning indicator for buttons that are working. */
export function Spinner({ size = 15 }: { size?: number }) {
  return <LoaderCircle size={size} className="animate-spin motion-reduce:animate-none" />
}

export function ErrorNote({ message, onClose }: { message: string; onClose?: () => void }) {
  const t = useT()
  const te = useTe()
  return (
    <div className="pop-in flex items-start gap-3 rounded-xl border border-coral/40 bg-coral/[0.07] px-4 py-3 text-[13px] text-paper" role="alert">
      <CircleAlert size={16} className="mt-0.5 shrink-0 text-coral" />
      <p className="flex-1 select-text">{te(message)}</p>
      {onClose && (
        <button onClick={onClose} aria-label={t('Dismiss')} title={t('Dismiss')} className="text-faded hover:text-paper">
          <X size={15} />
        </button>
      )}
    </div>
  )
}

export function Progress({ value, state }: { value: number; state: 'running' | 'done' | 'error' | 'idle' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/70">
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-300',
          state === 'running' && 'developing',
          state === 'done' && 'bg-cyan',
          state === 'error' && 'bg-coral'
        )}
        style={{ width: `${state === 'done' ? 100 : Math.max(state === 'running' ? 6 : 0, value)}%` }}
      />
    </div>
  )
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/70 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-[420px] rounded-2xl border border-line-strong bg-panel p-6 shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}
