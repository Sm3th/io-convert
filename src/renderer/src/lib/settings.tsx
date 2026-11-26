import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, translateError, type Lang } from './i18n'

export type ThemeChoice = 'system' | 'dark' | 'light'

interface Settings {
  lang: Lang
  outDir: string // '' = next to the original file
  theme: ThemeChoice
}

const KEY = 'io-convert:settings'

export function readSettings(): Settings {
  const fallback: Settings = { lang: navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en', outDir: '', theme: 'system' }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return fallback
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Puts the resolved theme on <html> so the CSS tokens switch. */
export function applyTheme(choice: ThemeChoice, animate = false): 'dark' | 'light' {
  const resolved = choice === 'system' ? (darkQuery().matches ? 'dark' : 'light') : choice
  const root = document.documentElement
  if (root.dataset.theme === resolved) return resolved
  if (animate) {
    root.classList.add('theme-fade')
    window.setTimeout(() => root.classList.remove('theme-fade'), 320)
  }
  root.dataset.theme = resolved
  return resolved
}

interface Ctx extends Settings {
  set: (patch: Partial<Settings>) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Shows an error message from the main process in the UI language. */
  te: (message: string) => string
}
const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(readSettings)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* storage unavailable: settings last for this session only */
    }
    document.documentElement.lang = s.lang
  }, [s])

  // Theme: tell the main process (window frame, native controls), then follow
  // the OS while "system" is chosen.
  useEffect(() => {
    let first = true
    const sync = () => {
      applyTheme(s.theme, !first)
      first = false
    }
    window.io
      .call('app:theme', s.theme)
      .catch(() => {})
      .finally(sync)
    const q = darkQuery()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [s.theme])

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      set: (p) => setS((o) => ({ ...o, ...p })),
      t: (k, v) => translate(s.lang, k, v),
      te: (m) => translateError(s.lang, m)
    }),
    [s]
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): Ctx {
  const c = useContext(SettingsContext)
  if (!c) throw new Error('SettingsProvider missing')
  return c
}
export const useT = () => useSettings().t
export const useTe = () => useSettings().te
