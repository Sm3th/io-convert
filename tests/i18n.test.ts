import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { hasTurkish, translate, translateError } from '../src/renderer/src/lib/i18n'

const RENDERER = join(__dirname, '../src/renderer/src')

describe('translate', () => {
  it('uses Turkish copy and fills variables', () => {
    expect(translate('tr', 'Convert')).toBe('Dönüştür')
    expect(translate('tr', '{n} files', { n: 3 })).toBe('3 dosya')
  })
  it('falls back to the English key', () => {
    expect(translate('tr', 'Not a real key')).toBe('Not a real key')
    expect(translate('en', '{n} files', { n: 3 })).toBe('3 files')
  })
})

describe('translateError', () => {
  it('translates fixed main-process errors', () => {
    expect(translateError('tr', 'Cancelled')).toBe('İptal edildi')
    expect(translateError('tr', 'Keep at least one page')).toBe('En az bir sayfa bırakın')
  })
  it('translates errors that carry details', () => {
    expect(translateError('tr', 'Page range "9-" is outside 1–5')).toBe('"9-" sayfa aralığı 1–5 dışında')
    expect(translateError('tr', 'Cannot read page range "x"')).toBe('Sayfa aralığı okunamadı: "x"')
    expect(translateError('tr', 'DOC to MD is not supported')).toBe('DOC → MD dönüştürmesi desteklenmiyor')
    expect(translateError('tr', 'Image to bmp is not supported')).toBe('Görselden bmp biçimine dönüştürme desteklenmiyor')
    expect(translateError('tr', 'ffmpeg failed: Invalid data found')).toBe('FFmpeg dönüştüremedi: Invalid data found')
  })
  it('leaves English and unknown messages untouched', () => {
    expect(translateError('en', 'Cancelled')).toBe('Cancelled')
    expect(translateError('tr', 'EACCES: permission denied')).toBe('EACCES: permission denied')
  })
})

describe('Turkish copy is complete', () => {
  // Every string the renderer passes through t(), plus the labels and headings
  // that reach t() indirectly (navigation, tool layouts).
  const used = new Map<string, string>()
  for (const file of readdirSync(RENDERER, { recursive: true }) as string[]) {
    if (!file.endsWith('.tsx')) continue
    const src = readFileSync(join(RENDERER, file), 'utf8')
    const patterns = [
      /\bt\(\s*'((?:[^'\\]|\\.)*)'/g,
      /\b(?:label|group|hint|title|description): '([^']+)'/g,
      /\b(?:title|description)="([^"]+)"/g
    ]
    for (const re of patterns) for (const m of src.matchAll(re)) used.set(m[1].replace(/\\'/g, "'"), file)
  }
  // Names that read the same in every language.
  const universal = /^(English|Türkçe|Polski|Deutsch|PDF|A4|Letter|\d.*|[\d\s/]+|.* \+ .*|4K \(2160p\))$/

  it('has a translation for every UI string', () => {
    expect(used.size).toBeGreaterThan(150) // the scan itself found the UI strings
    const missing = [...used].filter(([k]) => !hasTurkish(k) && !universal.test(k)).map(([k, f]) => `${k}  (${f})`)
    expect(missing).toEqual([])
  })
})
