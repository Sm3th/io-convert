import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
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
import { api } from '@/lib/api'
import { useT } from '@/lib/settings'
import { cx } from './ui'
import { Logo } from './Logo'
import { Tooltip } from './overlay'

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

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  /** Extra words the command palette matches, in both languages. */
  keywords?: string
}

export const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [{ id: 'convert', label: 'Convert', icon: ArrowLeftRight, keywords: 'format image video audio word excel heic mp4 mp3 dönüştür görsel ses' }] },
  {
    group: 'Page tools',
    items: [
      { id: 'organize', label: 'Organize pages', icon: LayoutGrid, keywords: 'reorder rotate delete duplicate sırala döndür sil' },
      { id: 'merge', label: 'Merge', icon: Combine, keywords: 'combine join birleştir' },
      { id: 'split', label: 'Split', icon: Scissors, keywords: 'extract pages range ayır böl' },
      { id: 'compress', label: 'Compress', icon: Shrink, keywords: 'shrink smaller reduce size küçült boyut' },
      { id: 'images', label: 'Images to PDF', icon: Images, keywords: 'photos jpg scan fotoğraf' }
    ]
  },
  {
    group: 'Content',
    items: [
      { id: 'edit', label: 'Edit & sign', icon: PenLine, keywords: 'signature text annotate highlight imza metin' },
      { id: 'watermark', label: 'Watermark', icon: Stamp, keywords: 'stamp confidential damga' },
      { id: 'numbers', label: 'Page numbers', icon: Hash, keywords: 'numbering footer numara' },
      { id: 'ocr', label: 'Text recognition', icon: ScanText, keywords: 'ocr scan searchable tara aranabilir' },
      { id: 'properties', label: 'Properties', icon: Info, keywords: 'metadata title author başlık yazar' }
    ]
  },
  {
    group: 'Security',
    items: [
      { id: 'protect', label: 'Protect', icon: Lock, keywords: 'password encrypt şifre' },
      { id: 'unlock', label: 'Unlock', icon: LockOpen, keywords: 'remove password decrypt şifre kaldır' }
    ]
  }
]

export const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'Settings', icon: Settings2, keywords: 'theme language folder tema dil klasör' }

/** Group a page belongs to, for breadcrumbs. */
export function groupOf(id: PageId): string | null {
  return NAV.find((g) => g.items.some((i) => i.id === id))?.group ?? null
}
/** Icon of the tool with this (English) label, for page headers. */
export function iconFor(label: string): LucideIcon | undefined {
  return [...NAV.flatMap((g) => g.items), SETTINGS_ITEM].find((i) => i.label === label)?.icon
}
export function itemOf(id: PageId): NavItem {
  return NAV.flatMap((g) => g.items).find((i) => i.id === id) ?? SETTINGS_ITEM
}

export function Sidebar({ page, onPage, collapsed }: { page: PageId; onPage: (p: PageId) => void; collapsed: boolean }) {
  const t = useT()
  const [version, setVersion] = useState('')
  useEffect(() => {
    api.env().then((e) => setVersion(e.version)).catch(() => {})
  }, [])

  const item = ({ id, label, icon: Icon }: NavItem) => {
    const active = page === id
    return (
      <Tooltip key={id} label={t(label)} side="right" disabled={!collapsed} className="w-full">
        <button
          onClick={() => onPage(id)}
          aria-current={active ? 'page' : undefined}
          aria-label={collapsed ? t(label) : undefined}
          className={cx(
            'group relative flex h-[34px] w-full items-center gap-3 rounded-lg text-left text-[13.5px] transition-colors',
            collapsed ? 'justify-center px-0' : 'px-3',
            active ? 'text-paper' : 'text-faded hover:bg-raised/60 hover:text-paper'
          )}
        >
          {active && (
            <motion.span
              layoutId="nav-active"
              transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan/[0.16] to-raised/70 ring-1 ring-inset ring-cyan/15"
            >
              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-cyan" />
            </motion.span>
          )}
          <Icon size={16} strokeWidth={1.9} className={cx('relative shrink-0', active ? 'text-cyan' : 'text-dim group-hover:text-faded')} />
          {!collapsed && <span className="relative truncate">{t(label)}</span>}
        </button>
      </Tooltip>
    )
  }

  return (
    <aside
      className={cx(
        'relative z-10 flex shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-300 ease-[var(--ease-out-soft)]',
        collapsed ? 'w-[68px]' : 'w-[236px]'
      )}
    >
      <div className={cx('drag flex h-[64px] items-center gap-2.5 pt-2', collapsed ? 'justify-center' : 'px-5')}>
        <Logo />
        {!collapsed && (
          <span className="whitespace-nowrap font-display text-[19px] font-semibold tracking-[-0.01em]">
            IO <span className="font-normal text-faded">Convert</span>
          </span>
        )}
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1">
        {NAV.map((g, i) => (
          <div key={i}>
            {g.group &&
              (collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-line" />
              ) : (
                <p className="mb-1 whitespace-nowrap px-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-dim">{t(g.group)}</p>
              ))}
            <div className="space-y-0.5">{g.items.map(item)}</div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-3 py-3">
        {item(SETTINGS_ITEM)}
        <Tooltip label={t('Works fully offline')} side="right" disabled={!collapsed} className="w-full">
          <p className={cx('mt-2 flex w-full items-center gap-2 text-xs text-dim', collapsed ? 'justify-center' : 'px-3')}>
            <ShieldCheck size={13} className="shrink-0 text-mint" />
            {!collapsed && (
              <>
                <span className="truncate">{t('Works fully offline')}</span>
                {version && <span className="ml-auto tabular-nums text-dim/80">v{version}</span>}
              </>
            )}
          </p>
        </Tooltip>
      </div>
    </aside>
  )
}
