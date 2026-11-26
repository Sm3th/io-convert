import { readFile, writeFile, copyFile, readdir } from 'fs/promises'
import * as fs from 'fs'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { basename, extname, join } from 'path'
import mammoth from 'mammoth'
import { marked, type Token, type Tokens } from 'marked'
import * as XLSX from 'xlsx'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  type ParagraphChild
} from 'docx'
import { extOf, normalizeExt, NEEDS_OFFICE, type ConvertOptions } from '@shared/formats'
import { withTempDir } from './paths'

// SheetJS's ESM build has no filesystem access until it is handed `fs`.
// Without this, XLSX.writeFile throws "cannot save file" when the module is
// loaded as ESM (Vitest, or a future ESM main bundle).
XLSX.set_fs(fs)

// ---------------------------------------------------------------------------
// HTML → PDF printer. The main process injects Electron's Chromium printer;
// tests inject a headless Chrome one. Keeps this module free of `electron`.
// ---------------------------------------------------------------------------
export type HtmlPrinter = (htmlFile: string, output: string, pageSize: 'A4' | 'Letter') => Promise<void>
let printer: HtmlPrinter | null = null
export function setHtmlPrinter(p: HtmlPrinter): void {
  printer = p
}
async function printHtml(html: string, output: string, o: ConvertOptions): Promise<void> {
  if (!printer) throw new Error('No HTML printer configured')
  await withTempDir(async (tmp) => {
    const file = join(tmp, 'doc.html')
    await writeFile(file, html, 'utf8')
    await printer!(file, output, o.pageSize ?? 'A4')
  })
}

// ---------------------------------------------------------------------------
// LibreOffice (optional). Gives near-perfect Office fidelity when installed.
// ---------------------------------------------------------------------------
const OFFICE_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/usr/local/bin/soffice',
  '/snap/bin/libreoffice'
]
let officePath: string | null | undefined
export function findOffice(): string | null {
  if (officePath !== undefined) return officePath
  officePath = OFFICE_CANDIDATES.find((p) => existsSync(p)) ?? null
  return officePath
}

function officeConvert(input: string, target: string, output: string): Promise<void> {
  const soffice = findOffice()
  if (!soffice) {
    return Promise.reject(
      new Error('This format needs LibreOffice. Install it from libreoffice.org, then try again.')
    )
  }
  return withTempDir(async (tmp) => {
    // A private profile dir lets conversions run even if LibreOffice is open.
    const profile = `file:///${join(tmp, 'profile').replace(/\\/g, '/').replace(/^\//, '')}`
    await new Promise<void>((resolve, reject) => {
      execFile(
        soffice,
        [`-env:UserInstallation=${profile}`, '--headless', '--convert-to', target, '--outdir', tmp, input],
        { timeout: 180_000, windowsHide: true },
        (err, _out, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve())
      )
    })
    const produced = (await readdir(tmp)).find((f) => f.toLowerCase().endsWith(`.${target}`))
    if (!produced) throw new Error('LibreOffice did not produce an output file')
    await copyFile(join(tmp, produced), output)
  })
}

// ---------------------------------------------------------------------------
// Styling used for every document we print, so outputs look deliberate.
// ---------------------------------------------------------------------------
const PRINT_CSS = `
  @page { margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #1b1f29; max-width: 100%; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.4em 0 .5em; color: #0e1a33; }
  h1 { font-size: 22pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
  p { margin: 0 0 .8em; }
  img { max-width: 100%; height: auto; }
  pre, code { font-family: Consolas, "SF Mono", monospace; font-size: 9.5pt; }
  pre { background: #f3f5f9; padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
  blockquote { margin: 0 0 .8em; padding-left: 12px; border-left: 3px solid #c9d3e6; color: #4a5470; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: .6em 0 1em; }
  th, td { border: 1px solid #d5dbe7; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eef2f8; }
  tr:nth-child(even) td { background: #fafbfd; }
  a { color: #1f5fbf; }
`
export function wrapHtml(body: string, title = 'Document'): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`
}
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// ---------------------------------------------------------------------------
// Markdown → DOCX (headings, paragraphs, lists, quotes, code, links, emphasis)
// ---------------------------------------------------------------------------
interface RunStyle {
  bold?: boolean
  italics?: boolean
  code?: boolean
  strike?: boolean
}
function inlineRuns(tokens: Token[] | undefined, style: RunStyle = {}): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        out.push(...inlineRuns((t as Tokens.Strong).tokens, { ...style, bold: true }))
        break
      case 'em':
        out.push(...inlineRuns((t as Tokens.Em).tokens, { ...style, italics: true }))
        break
      case 'del':
        out.push(...inlineRuns((t as Tokens.Del).tokens, { ...style, strike: true }))
        break
      case 'codespan':
        out.push(new TextRun({ text: decode((t as Tokens.Codespan).text), font: 'Consolas', ...style }))
        break
      case 'link': {
        const l = t as Tokens.Link
        out.push(
          new ExternalHyperlink({
            link: l.href,
            children: [new TextRun({ text: decode(l.text), style: 'Hyperlink', ...style })]
          })
        )
        break
      }
      case 'br':
        out.push(new TextRun({ text: '', break: 1 }))
        break
      case 'text': {
        const tt = t as Tokens.Text
        if (tt.tokens?.length) out.push(...inlineRuns(tt.tokens, style))
        else out.push(new TextRun({ text: decode(tt.text), ...style }))
        break
      }
      default:
        if ('text' in t && typeof t.text === 'string') out.push(new TextRun({ text: decode(t.text), ...style }))
    }
  }
  return out
}
function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6
]
function blocks(tokens: Token[], depth = 0): Paragraph[] {
  const out: Paragraph[] = []
  for (const t of tokens) {
    switch (t.type) {
      case 'heading': {
        const h = t as Tokens.Heading
        out.push(new Paragraph({ heading: HEADINGS[h.depth - 1], children: inlineRuns(h.tokens) }))
        break
      }
      case 'paragraph':
        out.push(new Paragraph({ children: inlineRuns((t as Tokens.Paragraph).tokens), spacing: { after: 160 } }))
        break
      case 'list': {
        const l = t as Tokens.List
        for (const item of l.items) {
          const [first, ...rest] = item.tokens
          const runs = first && 'tokens' in first ? inlineRuns((first as Tokens.Text).tokens) : []
          out.push(
            new Paragraph({
              children: runs,
              ...(l.ordered ? { numbering: { reference: 'ordered', level: depth } } : { bullet: { level: depth } })
            })
          )
          out.push(...blocks(rest, depth + 1))
        }
        break
      }
      case 'blockquote':
        for (const p of blocks((t as Tokens.Blockquote).tokens, depth)) out.push(p)
        break
      case 'code':
        for (const line of (t as Tokens.Code).text.split('\n')) {
          out.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Consolas', size: 19 })] }))
        }
        out.push(new Paragraph({}))
        break
      case 'hr':
        out.push(new Paragraph({ thematicBreak: true }))
        break
      case 'table': {
        const tb = t as Tokens.Table
        const row = (cells: Tokens.TableCell[]): string => cells.map((c) => c.text).join('  |  ')
        out.push(new Paragraph({ children: [new TextRun({ text: row(tb.header), bold: true })] }))
        for (const r of tb.rows) out.push(new Paragraph({ text: row(r) }))
        break
      }
      case 'space':
        break
      default:
        if ('text' in t && typeof t.text === 'string' && t.text.trim()) out.push(new Paragraph({ text: t.text }))
    }
  }
  return out
}
export async function markdownToDocx(md: string, output: string): Promise<void> {
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [
        {
          reference: 'ordered',
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: 'decimal' as const,
            text: `%${level + 1}.`,
            alignment: 'left' as const,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } }
          }))
        }
      ]
    },
    sections: [{ children: blocks(marked.lexer(md)) }]
  })
  await writeFile(output, await Packer.toBuffer(doc))
}

export async function textPagesToDocx(pages: string[][], output: string): Promise<void> {
  const children: Paragraph[] = []
  pages.forEach((lines, i) => {
    for (const line of lines) children.push(new Paragraph({ text: line, spacing: { after: 80 } }))
    if (i < pages.length - 1) children.push(new Paragraph({ pageBreakBefore: true }))
  })
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }]
  })
  await writeFile(output, await Packer.toBuffer(doc))
}

export function textPagesToHtml(pages: string[][], title: string): string {
  const body = pages
    .map(
      (lines, i) =>
        `<section${i ? ' style="page-break-before:always"' : ''}>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</section>`
    )
    .join('')
  return wrapHtml(body, title)
}

// Minimal HTML → Markdown/text for HTML and DOCX sources.
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
  ).trim()
}
export function htmlToMarkdown(html: string): string {
  let s = html.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, n, t) => `\n${'#'.repeat(Number(n))} ${t.trim()}\n\n`)
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**').replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
  s = s.replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  s = s.replace(/<img [^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  s = s.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
  s = s.replace(/<br\s*\/?>/gi, '  \n').replace(/<\/p>/gi, '\n\n')
  return decode(s.replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// ---------------------------------------------------------------------------
// Document router
// ---------------------------------------------------------------------------
export async function convertDocument(input: string, target: string, output: string, o: ConvertOptions): Promise<void> {
  const src = normalizeExt(extOf(input))
  const title = basename(input, extname(input))

  // Formats only LibreOffice can read, or Office → PDF when it is available
  // (much better layout fidelity than our HTML path).
  if (NEEDS_OFFICE.has(src) || (src === 'docx' && target === 'pdf' && findOffice())) {
    if (target === 'txt' && src !== 'docx') return officeConvert(input, 'txt', output)
    return officeConvert(input, target, output)
  }

  switch (src) {
    case 'docx': {
      if (target === 'txt') {
        const r = await mammoth.extractRawText({ path: input })
        return writeFile(output, r.value, 'utf8')
      }
      if (target === 'md') {
        // convertToMarkdown is deprecated in mammoth's types but still shipped
        const md = (mammoth as unknown as { convertToMarkdown: typeof mammoth.convertToHtml }).convertToMarkdown
        const r = await md({ path: input })
        return writeFile(output, r.value, 'utf8')
      }
      const { value } = await mammoth.convertToHtml({ path: input })
      if (target === 'html') return writeFile(output, wrapHtml(value, title), 'utf8')
      if (target === 'pdf') return printHtml(wrapHtml(value, title), output, o)
      break
    }
    case 'md': {
      const md = await readFile(input, 'utf8')
      if (target === 'docx') return markdownToDocx(md, output)
      const html = wrapHtml(await marked.parse(md), title)
      if (target === 'html') return writeFile(output, html, 'utf8')
      if (target === 'pdf') return printHtml(html, output, o)
      if (target === 'txt') return writeFile(output, htmlToText(html), 'utf8')
      break
    }
    case 'html': {
      const html = await readFile(input, 'utf8')
      if (target === 'pdf') {
        if (!printer) throw new Error('No HTML printer configured')
        return printer(input, output, o.pageSize ?? 'A4') // print in place: keeps relative assets
      }
      if (target === 'txt') return writeFile(output, htmlToText(html), 'utf8')
      if (target === 'md') return writeFile(output, htmlToMarkdown(html), 'utf8')
      if (target === 'docx') return markdownToDocx(htmlToMarkdown(html), output)
      break
    }
    case 'txt': {
      const txt = await readFile(input, 'utf8')
      if (target === 'docx') {
        return textPagesToDocx([txt.split(/\r?\n/)], output)
      }
      const html = wrapHtml(
        `<div style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:10pt">${escapeHtml(txt)}</div>`,
        title
      )
      if (target === 'html') return writeFile(output, html, 'utf8')
      if (target === 'pdf') return printHtml(html, output, o)
      break
    }
  }
  throw new Error(`${src.toUpperCase()} to ${target.toUpperCase()} is not supported`)
}

// ---------------------------------------------------------------------------
// Spreadsheets: xlsx / xls / ods / csv / tsv / json
// ---------------------------------------------------------------------------
async function readWorkbook(input: string): Promise<XLSX.WorkBook> {
  const ext = extOf(input)
  if (ext === 'json') {
    const data = JSON.parse(await readFile(input, 'utf8'))
    const wb = XLSX.utils.book_new()
    if (Array.isArray(data)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map((r) => flatten(r))), 'Sheet1')
    } else if (data && typeof data === 'object') {
      // { "Sheet name": [ ...rows ] } or a single object
      const entries = Object.entries(data)
      if (entries.every(([, v]) => Array.isArray(v))) {
        for (const [name, rows] of entries) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((rows as unknown[]).map((r) => flatten(r))), name.slice(0, 31))
        }
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([flatten(data)]), 'Sheet1')
      }
    } else {
      throw new Error('JSON must be an array of objects')
    }
    return wb
  }
  const buf = await readFile(input)
  if (ext === 'csv' || ext === 'tsv') {
    return XLSX.read(buf.toString('utf8'), { type: 'string', FS: ext === 'tsv' ? '\t' : undefined, raw: false })
  }
  return XLSX.read(buf, { type: 'buffer', cellDates: true })
}

function flatten(v: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    out[prefix || 'value'] = Array.isArray(v) ? JSON.stringify(v) : v
    return out
  }
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (val && typeof val === 'object' && !Array.isArray(val)) flatten(val, key, out)
    else out[key] = Array.isArray(val) ? JSON.stringify(val) : val
  }
  return out
}

export async function convertSheet(input: string, target: string, output: string, o: ConvertOptions): Promise<void> {
  const wb = await readWorkbook(input)
  const title = basename(input, extname(input))
  switch (target) {
    case 'xlsx':
    case 'ods':
      XLSX.writeFile(wb, output, { bookType: target, compression: true })
      return
    case 'csv': {
      const first = wb.Sheets[wb.SheetNames[0]]
      // BOM so Excel opens UTF-8 (Polish/Turkish characters) correctly
      await writeFile(output, '\uFEFF' + XLSX.utils.sheet_to_csv(first), 'utf8')
      return
    }
    case 'json': {
      const sheets = wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null })] as const)
      const data = sheets.length === 1 ? sheets[0][1] : Object.fromEntries(sheets)
      await writeFile(output, JSON.stringify(data, null, 2), 'utf8')
      return
    }
    case 'html':
    case 'pdf': {
      const body = wb.SheetNames.map((n, i) => {
        const table = XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })
        const heading = wb.SheetNames.length > 1 ? `<h2>${escapeHtml(n)}</h2>` : ''
        return `<section${i ? ' style="page-break-before:always"' : ''}>${heading}${table}</section>`
      }).join('')
      const html = wrapHtml(`<h1>${escapeHtml(title)}</h1>${body}`, title)
      if (target === 'html') return writeFile(output, html, 'utf8')
      return printHtml(html, output, o)
    }
  }
  throw new Error(`Spreadsheet to ${target} is not supported`)
}
