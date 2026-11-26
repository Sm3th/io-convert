import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: { testTimeout: 120_000, hookTimeout: 120_000, fileParallelism: false }
})
