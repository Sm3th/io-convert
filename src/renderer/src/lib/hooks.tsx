import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { api, isPasswordError, type PdfInfo } from './api'
import { useSettings, useT } from './settings'
import { Button, Modal, inputCls } from '@/components/ui'
import { fileName } from './format'

// ---------------------------------------------------------------------------
// Password prompt, available anywhere through askPassword()
// ---------------------------------------------------------------------------
type Ask = (file: string, wrong?: boolean) => Promise<string | null>
const PasswordContext = createContext<Ask>(async () => null)

export function PasswordProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [state, setState] = useState<{ file: string; wrong: boolean } | null>(null)
  const [value, setValue] = useState('')
  const resolver = useRef<((v: string | null) => void) | null>(null)
  const ask = useCallback<Ask>(
    (file, wrong = false) =>
      new Promise((res) => {
        resolver.current = res
        setValue('')
        setState({ file, wrong })
      }),
    []
  )
  const close = (v: string | null) => {
    resolver.current?.(v)
    resolver.current = null
    setState(null)
  }
  return (
    <PasswordContext.Provider value={ask}>
      {children}
      <Modal open={!!state} onClose={() => close(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value) close(value)
          }}
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber/15 text-amber">
            <Lock size={18} />
          </div>
          <h2 className="font-display text-xl font-semibold">{t('This PDF is password protected')}</h2>
          <p className="mt-1 truncate text-[13px] text-faded">{state && fileName(state.file)}</p>
          <p className="mt-3 text-[13px] text-faded">{t('Enter its password to continue.')}</p>
          <input
            autoFocus
            type="password"
            className={`${inputCls} mt-3 ${state?.wrong ? 'border-coral' : ''}`}
            placeholder={t('Password')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {state?.wrong && <p className="mt-2 text-xs text-coral">{t('Wrong password')}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="quiet" onClick={() => close(null)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={!value}>
              {t('Continue')}
            </Button>
          </div>
        </form>
      </Modal>
    </PasswordContext.Provider>
  )
}
export const useAskPassword = () => useContext(PasswordContext)

// ---------------------------------------------------------------------------
// A single PDF chosen by the user, with its info and (if needed) password
// ---------------------------------------------------------------------------
export interface PickedPdf {
  path: string
  info: PdfInfo
  password?: string
}

export function usePdfFile() {
  const ask = useAskPassword()
  const [file, setFile] = useState<PickedPdf | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (path: string) => {
      setError(null)
      if (!path.toLowerCase().endsWith('.pdf')) {
        setError('Choose a PDF file.')
        return
      }
      try {
        let info = await api.pdfInfo(path)
        let password: string | undefined
        let wrong = false
        while (info.encrypted && !info.pages) {
          const pw = await ask(path, wrong)
          if (pw === null) return
          try {
            info = await api.pdfInfo(path, pw)
            password = pw
          } catch (e) {
            if ((e as Error).message !== 'Wrong password') throw e
            wrong = true
          }
        }
        setFile({ path, info, password })
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [ask]
  )

  const pick = useCallback(async () => {
    const [p] = await api.openFiles([{ name: 'PDF', extensions: ['pdf'] }], false)
    if (p) await load(p)
  }, [load])

  return { file, setFile, load, pick, error, setError, reset: () => setFile(null) }
}

/** Where outputs go: user's chosen folder, or next to the source. */
export function useOutDir(): string | undefined {
  const { outDir } = useSettings()
  return outDir || undefined
}

// ---------------------------------------------------------------------------
// Runs one async action with busy / error / result state.
// ---------------------------------------------------------------------------
export function useTask<R>() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<R | null>(null)
  const run = useCallback(async (fn: () => Promise<R>) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await fn()
      setResult(r)
      return r
    } catch (e) {
      setError(isPasswordError(e) ? 'This PDF needs a password.' : (e as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, error, result, run, setError, clear: () => (setResult(null), setError(null)) }
}

/**
 * Screenshot/demo support: `?demo=["/path/a.pdf"]` preloads files into the
 * current page. Used by the IO_SHOT_PLAN screenshot mode in src/main/index.ts
 * to render the README images (development builds only).
 */
export function useDemoFiles(load: (paths: string[]) => void) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const raw = new URLSearchParams(location.search).get('demo')
    if (!raw) return
    done.current = true
    try {
      load(JSON.parse(raw))
    } catch {
      /* ignore malformed demo input */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
