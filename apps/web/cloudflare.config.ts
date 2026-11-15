import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'repotron-staging-web',
    entrypoint: './fixtures/fixture-worker.ts',
    compatibilityDate: '2026-11-11',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/api/v1/*'],
    },
  },
})
