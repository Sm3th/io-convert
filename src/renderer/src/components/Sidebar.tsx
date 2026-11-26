import {
  ArrowLeftRight,
  LayoutGrid,
  Combine,
  Scissors,
  Shrink,
  PenLine,
  Stamp,
  Hash,
  Lock,
  LockOpen,
  ScanText,
  Images,
  Info,
  Settings2,
  ShieldCheck,
  type LucideIcon
} from 'lucide-react'
import { useT } from '@/lib/settings'
import { cx } from './ui'
import { Logo } from './Logo'

export type PageId =
  | 'convert'
  | 'organize'
  | 'merge'
  | 'split'
  | 'compress'
  | 'edit'
  | 'watermark'
  | 'numbers'
  | 'protect'
  | 'unlock'
  | 'ocr'
  | 'images'
  | 'properties'
  | 'settings'

export const NAV: { group: string | null; items: { id: PageId; label: string; icon: LucideIcon }[] }[] = [
  { group: null, items: [{ id: 'convert', label: 'Convert', icon: ArrowLeftRight }] },
  {
    group: 'Page tools',
    items: [
      { id: 'organize', label: 'Organize pages', icon: LayoutGrid },
      { id: 'merge', label: 'Merge', icon: Combine },
      { id: 'split', label: 'Split', icon: Scissors },
      { id: 'compress', label: 'Compress', icon: Shrink },
      { id: 'images', label: 'Images to PDF', icon: Images }
    ]
  },
  {
    group: 'Content',
    items: [
      { id: 'edit', label: 'Edit & sign', icon: PenLine },
      { id: 'watermark', label: 'Watermark', icon: Stamp },
      { id: 'numbers', label: 'Page numbers', icon: Hash },
      { id: 'ocr', label: 'Text recognition', icon: ScanText },
      { id: 'properties', label: 'Properties', icon: Info }
    ]
  },
  {
    group: 'Security',
    items: [
      { id: 'protect', label: 'Protect', icon: Lock },
      { id: 'unlock', label: 'Unlock', icon: LockOpen }
    ]
  }
]

export function Sidebar({ page, onPage }: { page: PageId; onPage: (p: PageId) => void }) {
  const t = useT()
  const item = (id: PageId, label: string, Icon: LucideIcon) => (
    <button
      key={id}
      onClick={() => onPage(id)}
      aria-current={page === id ? 'page' : undefined}
      className={cx(
        'group relative flex h-[34px] w-full items-center gap-3 rounded-lg px-3 text-left text-[13.5px] transition-colors',
        page === id
          ? 'bg-gradient-to-r from-cyan/[0.16] to-raised/70 text-paper shadow-[inset_0_0_0_1px_#6fb6ff1f]'
          : 'text-faded hover:bg-raised/60 hover:text-paper'
      )}
    >
      {page === id && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-cyan" />}
      <Icon size={16} strokeWidth={1.9} className={page === id ? 'text-cyan' : 'text-dim group-hover:text-faded'} />
      {t(label)}
    </button>
  )
  return (
    <aside className="relative z-10 flex w-[236px] shrink-0 flex-col border-r border-line bg-[#0b1529]">
      <div className="drag flex h-[64px] items-center gap-2.5 px-5 pt-2">
        <Logo />
        <span className="font-display text-[19px] font-semibold tracking-[-0.01em]">
          IO <span className="font-normal text-faded">Convert</span>
        </span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-1">
        {NAV.map((g, i) => (
          <div key={i}>
            {g.group && <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-dim">{t(g.group)}</p>}
            <div className="space-y-0.5">{g.items.map((it) => item(it.id, it.label, it.icon))}</div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-3 py-3">
        {item('settings', 'Settings', Settings2)}
        <p className="mt-2 flex items-center gap-2 px-3 text-xs text-dim">
          <ShieldCheck size={13} className="text-mint" />
          {t('Works fully offline')}
        </p>
      </div>
    </aside>
  )
}
