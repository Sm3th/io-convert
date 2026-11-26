import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { FolderOpen, ExternalLink, CircleAlert, X } from 'lucide-react'
import { useT, useTe } from '@/lib/settings'
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
        variant === 'primary' && 'bg-cyan text-ink hover:bg-[#8cc5ff] font-semibold',
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

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-faded transition-colors hover:bg-raised hover:text-paper disabled:opacity-30',
        className
      )}
    >
      {children}
    </button>
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

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  small,
  disabled
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; disabled?: boolean }[]
  className?: string
  small?: boolean
  disabled?: boolean
}) {
  return (
    <div className={className}>
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={cx(
        'w-full cursor-pointer appearance-none rounded-lg border border-line bg-ink/60 bg-[length:14px] bg-[right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] text-paper outline-none transition-colors focus:border-cyan disabled:cursor-not-allowed disabled:opacity-50',
        small ? 'h-8' : 'h-9'
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393a3c4' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")"
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled} className="bg-panel">
          {o.label}
        </option>
      ))}
    </select>
    </div>
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
      <input type="range" className="flex-1" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
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
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all', checked ? 'left-[18px] bg-ink' : 'left-0.5')} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-6 pb-6">
      <div>
        <h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 max-w-[60ch] text-faded">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  )
}

/** Wraps a region that accepts dropped files from the OS. */
export function DropTarget({
  onFiles,
  children,
  className,
  activeClassName = 'ring-2 ring-cyan ring-offset-4 ring-offset-ink'
}: {
  onFiles: (paths: string[]) => void
  children: ReactNode
  className?: string
  activeClassName?: string
}) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  return (
    <div
      className={cx(className, over && activeClassName)}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        depth.current++
        setOver(true)
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (!depth.current) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        const paths = [...e.dataTransfer.files].map((f) => window.io.pathForFile(f)).filter(Boolean)
        if (paths.length) onFiles(paths)
      }}
    >
      {children}
    </div>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[var(--radius-card)] border border-line bg-panel', className)}>{children}</section>
}

export function SavedFile({ path, size, note }: { path: string; size?: number; note?: ReactNode }) {
  const t = useT()
  return (
    <div className="rounded-xl border border-mint/30 bg-mint/[0.06] px-4 py-3">
      <p className="truncate text-[13px] font-medium text-paper" title={path}>
        {t('Saved {name}', { name: fileName(path) })}
      </p>
      <p className="text-xs text-faded">
        {size !== undefined && bytes(size)}
        {size !== undefined && note && ' · '}
        {note}
      </p>
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

export function ErrorNote({ message, onClose }: { message: string; onClose?: () => void }) {
  const t = useT()
  const te = useTe()
  return (
    <div className="flex items-start gap-3 rounded-xl border border-coral/40 bg-coral/[0.07] px-4 py-3 text-[13px] text-paper" role="alert">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050b18]/70 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-[420px] rounded-2xl border border-line-strong bg-panel p-6 shadow-[0_30px_80px_-20px_#000a]"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}
