import { useState } from 'react'
import { Sidebar, type PageId } from '@/components/Sidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Convert } from '@/pages/Convert'
import { Organize } from '@/pages/Organize'
import { Merge, ImagesToPdf } from '@/pages/Merge'
import { Split, Compress, Watermark, PageNumbers, Protect, Unlock, Properties, Ocr } from '@/pages/Tools'
import { Editor } from '@/pages/Editor'
import { Settings } from '@/pages/Settings'

const PAGES: Record<PageId, () => React.JSX.Element> = {
  convert: Convert,
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
  const initial = (new URLSearchParams(location.search).get('page') as PageId) || 'convert'
  const [page, setPage] = useState<PageId>(PAGES[initial] ? initial : 'convert')
  const Page = PAGES[page]
  return (
    <div className="grain flex h-full">
      <Sidebar page={page} onPage={setPage} />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="drag h-10 shrink-0" />
        <div className="min-h-0 flex-1 px-9 pb-7">
          {/* keyed by page: switching tools also clears a crashed screen */}
          <ErrorBoundary key={page}>
            <div className="page-in h-full">
              <Page />
            </div>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
