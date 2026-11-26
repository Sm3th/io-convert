// UI copy in English and Turkish. Keys read like the English text so the
// components stay legible; Turkish falls back to English if a key is missing.

const tr: Record<string, string> = {
  // output file name suffixes
  page: 'sayfa',
  pages: 'sayfalar',
  signed: 'imzalı',
  merged: 'birleştirilmiş',
  organized: 'düzenlenmiş',
  compressed: 'sıkıştırılmış',
  watermarked: 'filigranlı',
  numbered: 'numaralı',
  protected: 'şifreli',
  unlocked: 'şifresiz',
  edited: 'güncellenmiş',
  searchable: 'aranabilir',
  'Previous page': 'Önceki sayfa',
  'Next page': 'Sonraki sayfa',
  // convert
  All: 'Tümü',
  'Convert all to…': 'Hepsini dönüştür…',
  'Convert to': 'Hedef biçim',
  'Show list': 'Listeyi göster',
  '{n} files converted': '{n} dosya dönüştürüldü',
  '{done} converted, {failed} failed': '{done} dönüştürüldü, {failed} başarısız',
  'No options for these files.': 'Bu dosyalar için ayar yok.',
  // shell
  'Drop to add {n} files': 'Bırakın, {n} dosya eklensin',
  'Drop to add the file': 'Bırakın, dosya eklensin',
  'Search tools…': 'Araçlarda ara…',
  'Switch to light theme': 'Açık temaya geç',
  'Switch to dark theme': 'Koyu temaya geç',
  Appearance: 'Görünüm',
  'Nothing matches': 'Eşleşen bir şey yok',
  'to move': 'gezin',
  'to open': 'aç',
  Theme: 'Tema',
  Reset: 'Sıfırla',
  System: 'Sistem',
  'Dark mode': 'Koyu',
  'Light mode': 'Açık',
  'Follows your Windows setting': 'Windows ayarınızı izler',
  'Darkroom: prussian blue': 'Karanlık oda: prusya mavisi',
  'Print: cream paper, blue ink': 'Baskı: krem kâğıt, mavi mürekkep',
  // navigation
  Convert: 'Dönüştür',
  'PDF tools': 'PDF araçları',
  'Page tools': 'Sayfa işlemleri',
  Content: 'İçerik',
  Security: 'Güvenlik',
  'Organize pages': 'Sayfaları düzenle',
  Merge: 'Birleştir',
  Split: 'Böl',
  Compress: 'Sıkıştır',
  'Edit & sign': 'Düzenle ve imzala',
  Watermark: 'Filigran',
  'Page numbers': 'Sayfa numaraları',
  Protect: 'Şifrele',
  Unlock: 'Şifreyi kaldır',
  'Text recognition': 'Metin tanıma (OCR)',
  'Images to PDF': "Görsellerden PDF'e",
  Properties: 'Belge bilgileri',
  Settings: 'Ayarlar',
  'Works fully offline': 'Tamamen çevrimdışı çalışır',

  // convert
  Images: 'Görseller',
  Video: 'Video',
  Audio: 'Ses',
  Documents: 'Belgeler',
  Spreadsheets: 'Tablolar',
  'Drop files to convert': 'Dönüştürmek için dosyaları bırakın',
  'Images, video, audio, documents, spreadsheets and PDFs. Nothing is uploaded.':
    'Görsel, video, ses, belge, tablo ve PDF. Hiçbir şey internete yüklenmez.',
  'Choose files': 'Dosya seç',
  'Add files': 'Dosya ekle',
  'Clear list': 'Listeyi temizle',
  'Convert all to': 'Hepsini dönüştür:',
  'Convert files': 'Dosyaları dönüştür',
  'Converting…': 'Dönüştürülüyor…',
  Cancel: 'İptal',
  Ready: 'Hazır',
  Waiting: 'Sırada',
  Done: 'Bitti',
  Failed: 'Başarısız',
  'Not supported': 'Desteklenmiyor',
  'Show in folder': 'Klasörde göster',
  Open: 'Aç',
  Remove: 'Kaldır',
  Options: 'Seçenekler',
  Quality: 'Kalite',
  'Max width': 'Maksimum genişlik',
  Original: 'Orijinal',
  'Video quality': 'Video kalitesi',
  High: 'Yüksek',
  Balanced: 'Dengeli',
  Small: 'Küçük',
  Resolution: 'Çözünürlük',
  'PDF page resolution': 'PDF sayfa çözünürlüğü',
  'Audio bitrate': 'Ses bit hızı',
  'GIF frame rate': 'GIF kare hızı',
  'Text recognition language': 'Metin tanıma dili',
  'Page size': 'Sayfa boyutu',
  'Needs LibreOffice': 'LibreOffice gerekir',
  '{n} files · {done} done': '{n} dosya · {done} bitti',
  'Saved next to the original': 'Orijinalin yanına kaydedilir',
  'Saved to {dir}': '{dir} klasörüne kaydedilir',
  'Unsupported file': 'Desteklenmeyen dosya',

  // shared tool copy
  'Choose a PDF': 'PDF seç',
  'Drop a PDF here': 'PDF dosyasını buraya bırakın',
  'Drop PDFs here': 'PDF dosyalarını buraya bırakın',
  'Drop images here': 'Görselleri buraya bırakın',
  'Change file': 'Dosyayı değiştir',
  '{n} pages': '{n} sayfa',
  'Saved {name}': '{name} kaydedildi',
  'Working…': 'İşleniyor…',
  'Check for updates': 'Güncellemeleri denetle',
  'Report a problem': 'Sorun bildir',
  'Choose a PDF to get started': 'Başlamak için bir PDF seçin',
  'Files stay on this computer': 'Dosyalar bu bilgisayardan çıkmaz',
  Before: 'Önce',
  After: 'Sonra',
  'This PDF is password protected': 'Bu PDF şifre korumalı',
  'Enter its password to continue.': 'Devam etmek için şifresini girin.',
  Password: 'Şifre',
  Continue: 'Devam',
  'Wrong password': 'Şifre yanlış',

  // tool descriptions
  'Turn any file into the format you need.': 'Her dosyayı ihtiyacınız olan formata çevirin.',
  'Reorder, rotate, duplicate or delete pages. Drag to rearrange.':
    'Sayfaları sıralayın, döndürün, çoğaltın veya silin. Yerini değiştirmek için sürükleyin.',
  'Combine several PDFs into one, in the order you set.': 'Birden fazla PDF’i istediğiniz sırayla tek dosyada birleştirin.',
  'Save page ranges, every page, or fixed-size chunks as separate PDFs.':
    'Sayfa aralıklarını, her sayfayı veya eşit parçaları ayrı PDF olarak kaydedin.',
  'Shrink PDFs by re-encoding photos and repacking the file.':
    'Fotoğrafları yeniden kodlayıp dosyayı yeniden paketleyerek PDF’i küçültün.',
  'Add text, your signature, images, highlights or white-out.':
    'Metin, imza, görsel, vurgulama veya beyaz kapatma ekleyin.',
  'Stamp text across every page.': 'Her sayfaya yazı damgası basın.',
  'Number every page, starting where you choose.': 'Her sayfayı istediğiniz sayıdan başlayarak numaralandırın.',
  'Require a password to open the PDF and limit what readers can do.':
    'PDF’i açmak için şifre isteyin ve okuyucunun yetkilerini sınırlayın.',
  'Remove the password from a PDF you can open.': 'Açabildiğiniz bir PDF’in şifresini kaldırın.',
  'Read text from scans and photos. Make PDFs searchable.':
    'Taranmış belgelerden ve fotoğraflardan metni okuyun. PDF’leri aranabilir yapın.',
  'Put photos and scans into one PDF.': 'Fotoğrafları ve taramaları tek bir PDF’te toplayın.',
  'View and edit the title, author and keywords.': 'Başlık, yazar ve anahtar kelimeleri görüntüleyin ve düzenleyin.',

  // organize
  'Rotate left': 'Sola döndür',
  'Rotate right': 'Sağa döndür',
  Duplicate: 'Çoğalt',
  Delete: 'Sil',
  'Save PDF': "PDF'i kaydet",
  'Reset changes': 'Değişiklikleri geri al',
  'Select all': 'Tümünü seç',
  '{n} selected': '{n} seçili',
  'Page {n}': 'Sayfa {n}',

  // merge / images
  'Merge PDFs': "PDF'leri birleştir",
  'Add at least two PDFs': 'En az iki PDF ekleyin',
  'Create PDF': 'PDF oluştur',
  'Page fit': 'Sayfa yerleşimi',
  'Match each image': 'Görsel boyutunda',
  'A4 with margins': 'Kenar boşluklu A4',
  'Move up': 'Yukarı taşı',
  'Move down': 'Aşağı taşı',

  // split
  'Split by': 'Bölme şekli',
  Ranges: 'Aralıklar',
  'Each page': 'Her sayfa',
  Chunks: 'Parçalar',
  'Ranges, e.g. 1-3, 5, 8-': 'Aralıklar, ör. 1-3, 5, 8-',
  'Each comma-separated range becomes its own PDF.': 'Virgülle ayrılan her aralık ayrı bir PDF olur.',
  'Pages per file': 'Dosya başına sayfa',
  'Split PDF': "PDF'i böl",
  'Saved {n} files': '{n} dosya kaydedildi',

  // compress
  Level: 'Seviye',
  Light: 'Hafif',
  Strong: 'Güçlü',
  'Keeps photos sharp. Small savings.': 'Fotoğraflar net kalır. Az kazanç.',
  'Good for email and sharing.': 'E-posta ve paylaşım için ideal.',
  'Smallest file. Photos get softer.': 'En küçük dosya. Fotoğraflar yumuşar.',
  'Compress PDF': "PDF'i sıkıştır",
  '{before} to {after}': '{before} → {after}',
  '{pct}% smaller': '%{pct} daha küçük',
  'Already as small as it gets': 'Zaten olabildiğince küçük',

  // editor
  Select: 'Seç',
  Text: 'Metin',
  Signature: 'İmza',
  Image: 'Görsel',
  Highlight: 'Vurgula',
  'White-out': 'Beyaz kapat',
  'Draw your signature': 'İmzanızı çizin',
  'Use signature': 'İmzayı kullan',
  Clear: 'Temizle',
  'Click on the page to place it': 'Yerleştirmek için sayfaya tıklayın',
  'Drag on the page to cover an area': 'Bir alanı kaplamak için sayfada sürükleyin',
  'Type here': 'Buraya yazın',
  Color: 'Renk',
  Size: 'Boyut',
  'Delete item': 'Öğeyi sil',
  Zoom: 'Yakınlaştır',
  '{n} edits': '{n} düzenleme',

  // watermark / numbers
  'Watermark text': 'Filigran metni',
  Opacity: 'Opaklık',
  Diagonal: 'Çapraz',
  'Add watermark': 'Filigran ekle',
  Position: 'Konum',
  'Bottom center': 'Alt orta',
  'Bottom right': 'Sağ alt',
  'Bottom left': 'Sol alt',
  'Top right': 'Sağ üst',
  Format: 'Biçim',
  'Start at': 'Başlangıç',
  'Font size': 'Yazı boyutu',
  'Add numbers': 'Numaraları ekle',
  CONFIDENTIAL: 'GİZLİ',

  // protect / unlock
  'Password to open': 'Açma şifresi',
  'Repeat password': 'Şifreyi tekrarla',
  'Passwords do not match': 'Şifreler eşleşmiyor',
  'Allow printing': 'Yazdırmaya izin ver',
  'Allow copying text': 'Metin kopyalamaya izin ver',
  'Allow editing': 'Düzenlemeye izin ver',
  'Protect PDF': "PDF'i şifrele",
  'Unlock PDF': 'Şifreyi kaldır',
  'Current password': 'Mevcut şifre',
  'Uses AES-256 encryption.': 'AES-256 şifreleme kullanılır.',
  'This PDF is not password protected.': 'Bu PDF şifreli değil.',

  // ocr
  'Images or PDFs': 'Görseller veya PDF’ler',
  'Drop scans here': 'Taramaları buraya bırakın',
  Languages: 'Diller',
  Output: 'Çıktı',
  'Searchable PDF': 'Aranabilir PDF',
  'Plain text': 'Düz metin',
  'Recognize text': 'Metni tanı',
  'The first run downloads language data (about 10 MB per language).':
    'İlk çalıştırmada dil verisi indirilir (dil başına yaklaşık 10 MB).',

  // properties
  Title: 'Başlık',
  Author: 'Yazar',
  Subject: 'Konu',
  Keywords: 'Anahtar kelimeler',
  'Comma-separated': 'Virgülle ayrılmış',
  'Created with': 'Oluşturan',
  'Save properties': 'Bilgileri kaydet',
  'File size': 'Dosya boyutu',
  Pages: 'Sayfa',
  'PDF producer': 'PDF üreticisi',

  // settings
  Language: 'Dil',
  'Output folder': 'Çıktı klasörü',
  'Next to the original file': 'Orijinal dosyanın yanında',
  'Choose folder': 'Klasör seç',
  'Office documents': 'Office belgeleri',
  'LibreOffice found. Word, PowerPoint and OpenDocument files convert with full layout.':
    'LibreOffice bulundu. Word, PowerPoint ve OpenDocument dosyaları tam düzeniyle dönüştürülür.',
  'LibreOffice not found. DOCX, Markdown, HTML and text still work. Install LibreOffice for DOC, ODT, RTF and PowerPoint.':
    'LibreOffice bulunamadı. DOCX, Markdown, HTML ve metin yine çalışır. DOC, ODT, RTF ve PowerPoint için LibreOffice kurun.',
  'Get LibreOffice': 'LibreOffice’i indir',
  About: 'Hakkında',
  'IO Convert works entirely offline. Your files never leave this computer.':
    'IO Convert tamamen çevrimdışı çalışır. Dosyalarınız bu bilgisayardan asla çıkmaz.',

  // misc
  Page: 'Sayfa',
  Dismiss: 'Kapat',
  '{n} files': '{n} dosya',
  'Something went wrong': 'Bir şeyler ters gitti',
  'This screen hit an unexpected error. Your files are not affected.':
    'Bu ekranda beklenmeyen bir hata oluştu. Dosyalarınız etkilenmedi.',
  'Try again': 'Tekrar dene',

  // errors raised by the main process (see translateError)
  Cancelled: 'İptal edildi',
  'Enter a password': 'Bir şifre girin',
  'Enter at least one page range': 'En az bir sayfa aralığı girin',
  'Enter watermark text': 'Filigran metnini girin',
  'JSON must be an array of objects': 'JSON bir nesne dizisi olmalı',
  'Keep at least one page': 'En az bir sayfa bırakın',
  'LibreOffice did not produce an output file': 'LibreOffice bir çıktı dosyası üretmedi',
  'This file type is not supported yet': 'Bu dosya türü henüz desteklenmiyor',
  'This format needs LibreOffice. Install it from libreoffice.org, then try again.':
    'Bu biçim için LibreOffice gerekli. libreoffice.org adresinden kurup tekrar deneyin.',
  'OCR did not return a PDF page': 'Metin tanıma bir PDF sayfası döndürmedi',
  'Choose a PDF file.': 'Bir PDF dosyası seçin.',
  'This PDF needs a password.': 'Bu PDF için şifre gerekli.',
  'Render failed': 'Sayfa çizilemedi',
  'This file has no audio track': 'Bu dosyada ses kanalı yok',
  'The file is damaged or is not a media file': 'Dosya bozuk ya da bir medya dosyası değil'
}

// Errors that carry details, e.g. `Page range "9-" is outside 1–5`.
const trErrorPatterns: [RegExp, string][] = [
  [/^Cannot read page range "(.*)"$/, 'Sayfa aralığı okunamadı: "$1"'],
  [/^Page range "(.*)" is outside 1–(\d+)$/, '"$1" sayfa aralığı 1–$2 dışında'],
  [/^Image to (\S+) is not supported$/, 'Görselden $1 biçimine dönüştürme desteklenmiyor'],
  [/^Spreadsheet to (\S+) is not supported$/, 'Tablodan $1 biçimine dönüştürme desteklenmiyor'],
  [/^(\S+) to (\S+) is not supported$/, '$1 → $2 dönüştürmesi desteklenmiyor'],
  [/^ffmpeg failed: (.*)$/s, 'FFmpeg dönüştüremedi: $1']
]

export type Lang = 'en' | 'tr'

/** True when the key has Turkish copy (used by the completeness test). */
export const hasTurkish = (key: string): boolean => Object.prototype.hasOwnProperty.call(tr, key)
const dicts: Record<Lang, Record<string, string>> = { en: {}, tr }

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

/**
 * Translates an error message from the main process. Errors cross IPC as
 * English text; known ones are shown in the UI language, anything else
 * (an OS or library message) is shown as is.
 */
export function translateError(lang: Lang, message: string): string {
  if (lang === 'en') return message
  const exact = dicts[lang][message]
  if (exact) return exact
  for (const [re, out] of trErrorPatterns) if (re.test(message)) return message.replace(re, out)
  return message
}
