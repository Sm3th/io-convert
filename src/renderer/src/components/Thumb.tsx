import { useEffect, useRef, useState } from 'react'
import type { PdfDoc } from '@/lib/pdfjs'
import { renderToCanvas } from '@/lib/pdfjs'

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
      className="block rounded-[3px] bg-white shadow-[0_1px_0_#0003,0_8px_20px_-10px_#000c] transition-opacity duration-300"
      style={{ width, height: ready ? undefined : width * 1.414, opacity: ready ? 1 : 0.15 }}
    />
  )
}
