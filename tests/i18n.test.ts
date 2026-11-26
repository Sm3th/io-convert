import { describe, it, expect } from 'vitest'
import { translate, translateError } from '../src/renderer/src/lib/i18n'

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
