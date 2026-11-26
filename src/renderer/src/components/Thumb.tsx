import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { openPdf, renderToCanvas, type PdfDoc } from '@/lib/pdfjs'
import { cx } from './ui'

/** Lazily renders one PDF page when it scrolls into view. */
export function Thumb({ doc, page, width, rotate = 0 }: { doc: PdfDoc; page: number; width: number; rotate?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || !ref.current) return
    let alive = true
    renderToCanvas(doc, page, ref.current, width, rotate)
      .then(() => alive && setReady(true))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [visible, doc, page, width, rotate])
  return (
    <canvas
      ref={ref}
      className={cx('block rounded-[3px] shadow-page', ready ? 'bg-white' : 'skeleton')}
      style={{ width, height: ready ? undefined : width * 1.414 }}
    />
  )
}

/**
 * First page of a file the app just wrote, for result cards. Renders nothing
 * when the file cannot be opened without a password.
 */
export function OutputThumb({ path, width = 54 }: { path: string; width?: number }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    let opened: PdfDoc | null = null
    setDoc(null)
    setFailed(false)
    api
      .read(path)
      .then((b) => openPdf(b))
      .then((d) => {
        opened = d
        if (alive) setDoc(d)
        else void d.loadingTask.destroy()
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      void opened?.loadingTask.destroy()
    }
  }, [path])
  if (failed) return null
  return doc ? <Thumb doc={doc} page={0} width={width} /> : <div className="skeleton rounded-[3px]" style={{ width, height: width * 1.414 }} />
}
