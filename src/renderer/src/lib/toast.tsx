import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleAlert, X } from 'lucide-react'
import { Portal } from '@/components/overlay'
import { cx } from '@/components/ui'
import { useT } from './settings'

interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'success' | 'error'
  action?: { label: string; run: () => void }
}

const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
/** Shows a short notice in the corner, e.g. when a background batch finishes. */
export const useToast = () => useContext(Ctx)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [items, setItems] = useState<Toast[]>([])
  const dismiss = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id))
  const push = useCallback((x: Omit<Toast, 'id'>) => {
    const id = nextId++
    setItems((xs) => [...xs.slice(-2), { ...x, id }])
    window.setTimeout(() => setItems((xs) => xs.filter((y) => y.id !== id)), 6500)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[340px] flex-col gap-2" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((x) => {
              const Icon = x.tone === 'error' ? CircleAlert : CircleCheck
              return (
                <motion.div
                  key={x.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
                  className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line-strong bg-panel px-4 py-3 shadow-pop"
                  role="status"
                >
                  <Icon size={18} className={cx('mt-0.5 shrink-0', x.tone === 'error' ? 'text-coral' : 'text-mint')} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-paper">{x.title}</p>
                    {x.body && <p className="truncate text-xs text-faded">{x.body}</p>}
                    {x.action && (
                      <button
                        onClick={() => {
                          x.action!.run()
                          dismiss(x.id)
                        }}
                        className="mt-1.5 text-xs font-semibold text-cyan hover:underline"
                      >
                        {x.action.label}
                      </button>
                    )}
                  </div>
                  <button onClick={() => dismiss(x.id)} aria-label={t('Dismiss')} className="text-dim hover:text-paper">
                    <X size={14} />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </Portal>
    </Ctx.Provider>
  )
}
