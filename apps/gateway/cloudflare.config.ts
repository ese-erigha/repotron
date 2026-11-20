import { bindings, defineConfig, exports } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'repotron-staging-gateway',
    entrypoint,
    compatibilityDate: '2026-11-11',
    workersDev: true,
    observability: { enabled: true },
    exports: {
      RateLimiter: exports.durableObject({ storage: 'sqlite' }),
    },
    env: {
      DB: bindings.d1({ id: 'f78d8026-6c6d-4a12-ba21-713f9b540fec', name: 'repotron-staging-db' }),
      CHUNK_VECTORS: bindings.vectorize({ name: 'repotron-staging-chunks' }),
      REPOSITORY_INDEXING: bindings.workflow({
        name: 'repotron-staging-repository-indexing',
        worker: 'repotron-staging-pipeline',
        exportName: 'RepositoryIndexing',
      }),
      RATE_LIMITER: bindings.durableObject({
        worker: 'repotron-staging-gateway',
        exportName: 'RateLimiter',
      }),
      APP_ORIGIN: bindings.text('https://repotron-staging-web.ese-erigha.workers.dev'),
      CLOUDFLARE_ACCOUNT_ID: bindings.text('ebdd8a56ec566f7624f98652addd5ecf'),
      AI_GATEWAY_ID: bindings.text('repotron-staging-ai-gateway'),
      ANSWER_MODEL_ID: bindings.text('anthropic/claude-haiku-5.5'),
    },
  },
})
