import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Search, Moon, Sun, Languages, CornerDownLeft, type LucideIcon } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { NAV, SETTINGS_ITEM, groupOf, itemOf, type PageId } from './Sidebar'
import { Kbd, Portal } from './overlay'
import { cx } from './ui'

/** Window title row: where you are, and the way to jump anywhere. */
export function TopBar({ page, onSearch }: { page: PageId; onSearch: () => void }) {
  const { t } = useSettings()
  const group = groupOf(page)
  return (
    <div className="drag relative flex h-10 shrink-0 items-center px-9 pr-[150px]">
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-dim">
        {group && (
          <>
            <span className="truncate">{t(group)}</span>
            <ChevronRight size={12} className="shrink-0" />
          </>
        )}
        <span className="truncate font-medium text-faded">{t(itemOf(page).label)}</span>
      </p>
      <button
        onClick={onSearch}
        className="no-drag absolute left-1/2 top-1/2 flex h-7 w-[300px] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-line bg-panel/70 px-2.5 text-xs text-dim transition-colors hover:border-line-strong hover:text-faded"
      >
        <Search size={13} />
        <span className="flex-1 text-left">{t('Search tools…')}</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </button>
    </div>
  )
}

interface Entry {
  key: string
  label: string
  hint: string
  icon: LucideIcon
  hay: string
  run: () => void
}

/** Lower-case and strip accents so "sikistir" finds "Sıkıştır". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

function score(q: string, e: Entry): number {
  if (!q) return 1
  const label = norm(e.label)
  if (label.startsWith(q)) return 100
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 80
  if (e.hay.includes(q)) return 50
  // letters in order: "pnum" → "page numbers"
  let i = 0
  for (const ch of label) if (ch === q[i]) i++
  return i === q.length ? 20 : 0
}

export function CommandPalette({ open, onClose, onPage }: { open: boolean; onClose: () => void; onPage: (p: PageId) => void }) {
  const { t, set, lang } = useSettings()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const entries = useMemo<Entry[]>(() => {
    const dark = document.documentElement.dataset.theme !== 'light'
    const pages = [...NAV.flatMap((g) => g.items.map((i) => ({ i, g: g.group }))), { i: SETTINGS_ITEM, g: null }].map(({ i, g }) => ({
      key: i.id,
      label: t(i.label),
      hint: g ? t(g) : '',
      icon: i.icon,
      // every tool in a group works on PDFs, so "pdf" finds them all
      hay: norm(`${t(i.label)} ${i.label} ${g ? `${t(g)} ${g} pdf` : ''} ${i.keywords ?? ''}`),
      run: () => onPage(i.id)
    }))
    const actions: Entry[] = [
      {
        key: 'theme',
        label: t(dark ? 'Switch to light theme' : 'Switch to dark theme'),
        hint: t('Appearance'),
        icon: dark ? Sun : Moon,
        hay: norm('theme light dark tema açık koyu appearance görünüm'),
        run: () => set({ theme: dark ? 'light' : 'dark' })
      },
      {
        key: 'lang',
        label: lang === 'tr' ? 'Switch to English' : 'Türkçe arayüze geç',
        hint: t('Language'),
        icon: Languages,
        hay: norm('language dil english turkce türkçe'),
        run: () => set({ lang: lang === 'tr' ? 'en' : 'tr' })
      }
    ]
    return [...pages, ...actions]
  }, [t, set, lang, onPage])

  const nq = norm(q.trim())
  const shown = entries
    .map((e) => ({ e, s: score(nq, e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e)

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (e?: Entry) => {
    if (!e) return
    onClose()
    e.run()
  }

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[75] flex justify-center bg-scrim/55 pt-[13vh] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={onClose}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('Search tools…')}
              className="h-fit w-[560px] overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-pop"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search size={16} className="text-dim" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('Search tools…')}
                  className="h-12 flex-1 bg-transparent text-[14px] text-paper outline-none placeholder:text-dim"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setActive((a) => Math.min(shown.length - 1, a + 1))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setActive((a) => Math.max(0, a - 1))
                    } else if (e.key === 'Enter') run(shown[active])
                    else if (e.key === 'Escape') onClose()
                  }}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="palette-list"
                  aria-activedescendant={shown[active] ? `palette-${shown[active].key}` : undefined}
                />
                <Kbd>Esc</Kbd>
              </div>
              <div ref={list} id="palette-list" role="listbox" className="max-h-[360px] overflow-y-auto p-2">
                {shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-dim">{t('Nothing matches')}</p>}
                {shown.map((e, i) => (
                  <div
                    key={e.key}
                    id={`palette-${e.key}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(e)}
                    className={cx(
                      'flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13.5px]',
                      i === active ? 'bg-raised text-paper' : 'text-faded'
                    )}
                  >
                    <e.icon size={16} strokeWidth={1.9} className={i === active ? 'text-cyan' : 'text-dim'} />
                    <span className="flex-1 truncate">{e.label}</span>
                    {e.hint && <span className="text-xs text-dim">{e.hint}</span>}
                    {i === active && <CornerDownLeft size={13} className="text-dim" />}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-dim">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  {t('to move')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd>
                  {t('to open')}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  )
}
