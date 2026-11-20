import { bindings, defineConfig, defineContainer, exports, triggers } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

const container = defineContainer({
  name: 'repotron-staging-indexer',
  image: { dockerfile: '../indexer/Dockerfile' },
  instanceType: 'standard-2',
  maxInstances: 10,
})

export default defineConfig({
  containers: [container],
  worker: {
    name: 'repotron-staging-pipeline',
    entrypoint,
    compatibilityDate: '2026-11-11',
    workersDev: false,
    observability: { enabled: true },
    exports: {
      RepositoryIndexing: exports.workflow({ name: 'repotron-staging-repository-indexing' }),
      IndexDeletion: exports.workflow({ name: 'repotron-staging-index-deletion' }),
      Indexer: exports.durableObject({ storage: 'sqlite', container }),
    },
    triggers: [triggers.scheduled({ schedule: '0 4 * * *' })],
    env: {
      DB: bindings.d1({ id: 'f78d8026-6c6d-4a12-ba21-713f9b540fec', name: 'repotron-staging-db' }),
      CHUNK_VECTORS: bindings.vectorize({ name: 'repotron-staging-chunks' }),
      CHUNK_BATCHES: bindings.r2({ name: 'repotron-staging-batches' }),
      INDEXER: bindings.durableObject({ worker: 'repotron-staging-pipeline', exportName: 'Indexer' }),
      REPOSITORY_INDEXING: bindings.workflow({
        name: 'repotron-staging-repository-indexing',
        worker: 'repotron-staging-pipeline',
        exportName: 'RepositoryIndexing',
      }),
      INDEX_DELETION: bindings.workflow({
        name: 'repotron-staging-index-deletion',
        worker: 'repotron-staging-pipeline',
        exportName: 'IndexDeletion',
      }),
      AI_GATEWAY_ID: bindings.text('repotron-staging-ai-gateway'),
      CLOUDFLARE_ACCOUNT_ID: bindings.text('ebdd8a56ec566f7624f98652addd5ecf'),
      R2_ENDPOINT: bindings.text('https://ebdd8a56ec566f7624f98652addd5ecf.r2.cloudflarestorage.com'),
      R2_BUCKET: bindings.text('repotron-staging-batches'),
    },
  },
})
