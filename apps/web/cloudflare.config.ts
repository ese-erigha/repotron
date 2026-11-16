import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'repotron-staging-web',
    compatibilityDate: '2026-11-11',
    assets: { notFoundHandling: 'single-page-application' },
    workersDev: true,
  },
})
