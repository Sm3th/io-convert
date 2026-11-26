import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, translateError, type Lang } from './i18n'

interface Settings {
  lang: Lang
  outDir: string // '' = next to the original file
}

function read(): Settings {
  const fallback: Settings = { lang: navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en', outDir: '' }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem('io-convert:settings') ?? '{}') }
  } catch {
    return fallback
  }
}

interface Ctx extends Settings {
  set: (patch: Partial<Settings>) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Shows an error message from the main process in the UI language. */
  te: (message: string) => string
}
const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(read)
  useEffect(() => {
    try {
      localStorage.setItem('io-convert:settings', JSON.stringify(s))
    } catch {
      /* storage unavailable: settings last for this session only */
    }
    document.documentElement.lang = s.lang
  }, [s])
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
