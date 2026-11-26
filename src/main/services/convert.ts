import { stat } from 'fs/promises'
import { categoryOf, extOf, type ConvertRequest, type ConvertResult } from '@shared/formats'
import { outputPath } from './paths'
import { convertImage } from './image'
import { convertMedia } from './media'
import { convertDocument, convertSheet } from './document'
import { ocrToText } from './ocr'

export async function convert(req: ConvertRequest, onProgress: (pct: number) => void): Promise<ConvertResult> {
  const { input, target, options, outDir, jobId } = req
  const cat = categoryOf(extOf(input))
  const output = outputPath(input, target, outDir)

  switch (cat) {
    case 'image':
      if (target === 'txt') await ocrToText([input], options.ocrLangs ?? 'eng', output, onProgress)
      else await convertImage(input, target, output, options)
      break
    case 'video':
    case 'audio':
      await convertMedia(jobId, input, target, output, options, onProgress)
      break
    case 'document':
      await convertDocument(input, target, output, options)
      break
    case 'sheet':
      await convertSheet(input, target, output, options)
      break
    case 'pdf':
      throw new Error('PDF sources are converted by the renderer pipeline')
    default:
      throw new Error('This file type is not supported yet')
  }
  onProgress(100)
  return { output, size: (await stat(output)).size }
}
