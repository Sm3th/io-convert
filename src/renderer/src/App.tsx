import { useCallback, useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Sidebar, itemOf, type PageId } from '@/components/Sidebar'
import { TopBar, CommandPalette } from '@/components/Shell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useMediaQuery } from '@/components/overlay'
import { DropProvider, PageActive } from '@/lib/drop'
import { ToastProvider } from '@/lib/toast'
import { useT } from '@/lib/settings'
import { Convert } from '@/pages/Convert'
import { Organize } from '@/pages/Organize'
import { Merge, ImagesToPdf } from '@/pages/Merge'
import { Split, Compress, Watermark, PageNumbers, Protect, Unlock, Properties, Ocr } from '@/pages/Tools'
import { Editor } from '@/pages/Editor'
import { Settings } from '@/pages/Settings'

const PAGES: Record<Exclude<PageId, 'convert'>, () => React.JSX.Element> = {
  organize: Organize,
  merge: Merge,
  split: Split,
  compress: Compress,
  edit: Editor,
  watermark: Watermark,
  numbers: PageNumbers,
  protect: Protect,
  unlock: Unlock,
  ocr: Ocr,
  images: ImagesToPdf,
  properties: Properties,
  settings: Settings
}

export default function App() {
  const t = useT()
  const initial = (new URLSearchParams(location.search).get('page') as PageId) || 'convert'
  const [page, setPage] = useState<PageId>(initial in PAGES ? initial : 'convert')
  const [palette, setPalette] = useState(false)
  const narrow = useMediaQuery('(max-width: 1180px)')
  const Page = page === 'convert' ? null : PAGES[page]

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((o) => !o)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const toConvert = useCallback(() => setPage('convert'), [])

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <DropProvider pageLabel={t(itemOf(page).label)} onFallback={toConvert}>
          <div className="grain flex h-full">
            <Sidebar page={page} onPage={setPage} collapsed={narrow} />
            <main className="relative z-10 flex min-w-0 flex-1 flex-col">
              <TopBar page={page} onSearch={() => setPalette(true)} />
              <div className="min-h-0 flex-1 px-9 pb-7 pt-1">
                {/* Convert stays mounted so a running batch survives a visit to another tool. */}
                <ErrorBoundary>
                  <PageActive.Provider value={page === 'convert'}>
                    <div className={page === 'convert' ? 'page-in h-full' : 'hidden'}>
                      <Convert onShow={() => setPage('convert')} />
                    </div>
                  </PageActive.Provider>
                </ErrorBoundary>
                {/* keyed by page: switching tools also clears a crashed screen */}
                {Page && (
                  <ErrorBoundary key={page}>
                    <div className="page-in h-full">
                      <Page />
                    </div>
                  </ErrorBoundary>
                )}
              </div>
            </main>
          </div>
          <CommandPalette open={palette} onClose={() => setPalette(false)} onPage={setPage} />
        </DropProvider>
      </ToastProvider>
    </MotionConfig>
  )
}
