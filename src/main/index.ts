import { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme, type IpcMainInvokeEvent } from 'electron'
import { join, basename } from 'path'
import { stat, readFile, writeFile } from 'fs/promises'
import { categoryOf, extOf, type ConvertRequest, type FileInfo } from '@shared/formats'
import { convert } from './services/convert'
import { cancelMedia } from './services/media'
import { setHtmlPrinter, findOffice, textPagesToDocx, textPagesToHtml } from './services/document'
import { imagesToPdf, encodeRendered, imagePreview } from './services/image'
import { configureOcr, ocrToPdf, ocrToText, shutdownOcr } from './services/ocr'
import { outputPath, uniquePath } from './services/paths'
import * as pdf from './services/pdf'

const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']
const shotMode = !!process.env['IO_SHOT_PLAN'] && !app.isPackaged
// Screenshot runs get their own profile, so they neither touch the user's
// settings nor collide with a copy of the app that is already open.
if (shotMode) app.setPath('userData', join(app.getPath('temp'), 'io-convert-shots'))
const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')

pdf.setFontDir(join(resourcesDir, 'fonts'))
configureOcr({ cachePath: join(app.getPath('userData'), 'ocr-data') })

// Chromium's own PDF printer gives the cleanest HTML → PDF output.
setHtmlPrinter(async (htmlFile, output, pageSize) => {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await win.loadFile(htmlFile)
    const data = await win.webContents.printToPDF({ pageSize, printBackground: true })
    await writeFile(output, data)
  } finally {
    win.destroy()
  }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  nativeTheme.themeSource = 'dark'
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1020,
    minHeight: 680,
    show: false,
    backgroundColor: '#0d1830',
    title: 'IO Convert',
    icon: join(resourcesDir, 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d1830', symbolColor: '#c9d6ee', height: 40 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The preload only uses contextBridge, ipcRenderer and webUtils, which are
      // all available to sandboxed preloads.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // The app is a single page and never navigates itself (main-process loads
  // and reloads do not fire this event). Anything else, such as a stray file
  // drop or a plain link, must not replace the UI: web links open in the browser.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    if (/^https?:/.test(url)) void shell.openExternal(url)
  })
  if (shotMode) void runScreenshots(mainWindow)
  else if (isDev) void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

/** Dev-only: renders pages listed in IO_SHOT_PLAN and saves PNGs (README images). */
async function runScreenshots(win: BrowserWindow): Promise<void> {
  const plan = JSON.parse(await readFile(process.env['IO_SHOT_PLAN']!, 'utf8')) as {
    dir: string
    shots: { name: string; page: string; files?: string[]; wait?: number; script?: string; after?: number; lang?: string }[]
  }
  win.setContentSize(1320, 840)
  for (const s of plan.shots) {
    const query: Record<string, string> = { page: s.page }
    if (s.files) query.demo = JSON.stringify(s.files)
    await win.loadFile(join(__dirname, '../renderer/index.html'), { query })
    await new Promise((r) => setTimeout(r, 400)) // let the app persist its own settings first
    await win.webContents.executeJavaScript(
      `localStorage.setItem('io-convert:settings', JSON.stringify({ lang: '${s.lang ?? 'en'}', outDir: '' })); true`
    )
    await win.loadFile(join(__dirname, '../renderer/index.html'), { query })
    await new Promise((r) => setTimeout(r, s.wait ?? 1500))
    if (s.script) {
      await win.webContents.executeJavaScript(s.script)
      await new Promise((r) => setTimeout(r, s.after ?? 900))
    }
    // capturePage never settles while the window is minimized, so bring it
    // back first and give up on a shot rather than hang the whole run.
    if (win.isMinimized()) win.restore()
    win.showInactive()
    const img = await Promise.race([
      win.webContents.capturePage(),
      new Promise<null>((r) => setTimeout(() => r(null), 10000))
    ])
    if (img) await writeFile(join(plan.dir, `${s.name}.png`), img.toPNG())
  }
  app.quit()
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
type Handler = (e: IpcMainInvokeEvent, ...args: any[]) => unknown // eslint-disable-line @typescript-eslint/no-explicit-any

/** Wraps handlers so errors reach the UI as readable messages, not stack traces. */
function handle(channel: string, fn: Handler): void {
  ipcMain.handle(channel, async (e, ...args) => {
    try {
      return { ok: true, value: await fn(e, ...args) }
    } catch (err) {
      const message = err instanceof pdf.PasswordRequiredError ? 'PASSWORD_REQUIRED' : (err as Error).message
      return { ok: false, error: message }
    }
  })
}

function progress(e: IpcMainInvokeEvent, jobId: string) {
  let last = -1
  return (percent: number) => {
    const p = Math.round(percent)
    if (p === last) return
    last = p
    e.sender.send('job:progress', { jobId, percent: p })
  }
}

function registerIpc(): void {
  handle('dialog:open', async (_e, opts: { filters?: { name: string; extensions: string[] }[]; multi?: boolean }) => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      properties: opts?.multi === false ? ['openFile'] : ['openFile', 'multiSelections'],
      filters: opts?.filters
    })
    return r.canceled ? [] : r.filePaths
  })
  handle('dialog:folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('dialog:save', async (_e, defaultPath: string, ext: string) => {
    const r = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: uniquePath(defaultPath),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    return r.canceled ? null : r.filePath
  })

  handle('fs:info', async (_e, paths: string[]): Promise<FileInfo[]> => {
    const out: FileInfo[] = []
    for (const p of paths) {
      try {
        const s = await stat(p)
        if (!s.isFile()) continue
        const ext = extOf(p)
        out.push({ path: p, name: basename(p), ext, size: s.size, category: categoryOf(ext) })
      } catch {
        /* vanished or unreadable */
      }
    }
    return out
  })
  handle('fs:read', async (_e, path: string) => new Uint8Array(await readFile(path)))
  handle('image:preview', (_e, path: string) => imagePreview(path))
  handle('fs:outputPath', (_e, input: string, ext: string, outDir?: string, suffix?: string) =>
    outputPath(input, ext, outDir, suffix)
  )
  handle('shell:show', (_e, path: string) => shell.showItemInFolder(path))
  handle('shell:open', (_e, path: string) => shell.openPath(path))
  handle('app:env', () => ({
    office: !!findOffice(),
    version: app.getVersion(),
    platform: process.platform,
    downloads: app.getPath('downloads')
  }))

  // Conversion
  handle('convert:run', (e, req: ConvertRequest) => convert(req, progress(e, req.jobId)))
  handle('convert:cancel', (_e, jobId: string) => cancelMedia(jobId))

  // Pages rendered/extracted by the UI's PDF.js
  handle('render:save', async (_e, png: Uint8Array, target: string, output: string, quality?: number) => ({
    output,
    size: await encodeRendered(png, target, output, quality)
  }))
  handle('text:save', async (_e, pages: string[][], target: string, output: string) => {
    if (target === 'docx') await textPagesToDocx(pages, output)
    else if (target === 'html') await writeFile(output, textPagesToHtml(pages, basename(output)), 'utf8')
    else await writeFile(output, pages.map((p) => p.join('\n')).join('\n\n\f\n\n'), 'utf8')
    return { output, size: (await stat(output)).size }
  })

  // PDF tools
  handle('pdf:info', (_e, input: string, password?: string) => pdf.info(input, password))
  handle('pdf:merge', (_e, inputs: string[], output: string, pw?: Record<string, string>) => pdf.merge(inputs, output, pw))
  handle('pdf:split', (_e, input: string, how: pdf.SplitMode, outDir?: string, pw?: string, words?: pdf.SplitWords) =>
    pdf.split(input, how, outDir, pw, words)
  )
  handle('pdf:organize', (_e, input: string, pages, output: string, pw?: string) => pdf.organize(input, pages, output, pw))
  handle('pdf:compress', (_e, input: string, level, output: string, pw?: string) => pdf.compress(input, level, output, pw))
  handle('pdf:protect', (_e, input: string, o: pdf.ProtectOptions, output: string, pw?: string) => pdf.protect(input, o, output, pw))
  handle('pdf:unlock', (_e, input: string, password: string, output: string) => pdf.unlock(input, password, output))
  handle('pdf:watermark', (_e, input: string, o, output: string, pw?: string) => pdf.watermark(input, o, output, pw))
  handle('pdf:pageNumbers', (_e, input: string, o, output: string, pw?: string) => pdf.pageNumbers(input, o, output, pw))
  handle('pdf:annotate', (_e, input: string, a, output: string, pw?: string) => pdf.annotate(input, a, output, pw))
  handle('pdf:metadata', (_e, input: string, m: pdf.Metadata, output: string, pw?: string) => pdf.setMetadata(input, m, output, pw))
  handle('pdf:fromImages', async (_e, inputs: string[], output: string, fit: 'image' | 'a4') => {
    await imagesToPdf(inputs, output, { fit })
    return { output, size: (await stat(output)).size }
  })
  handle('ocr:run', async (e, jobId: string, inputs: (string | Uint8Array)[], langs: string, target: 'pdf' | 'txt', output: string) => {
    const onProgress = progress(e, jobId)
    if (target === 'pdf') await ocrToPdf(inputs, langs, output, onProgress)
    else await ocrToText(inputs, langs, output, onProgress)
    return { output, size: (await stat(output)).size }
  })
}

// One window is enough: a second launch focuses the running app instead.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(() => {
  app.setAppUserModelId('com.iosoftware.ioconvert')
  // The default menu only adds reload and DevTools shortcuts, which a released
  // build should not expose. macOS keeps it for the standard Edit shortcuts.
  if (app.isPackaged && process.platform !== 'darwin') Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void shutdownOcr()
  if (process.platform !== 'darwin') app.quit()
})
