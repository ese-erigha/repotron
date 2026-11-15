import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildContract } from '../dist/contract.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const target = join(root, 'apps/indexer/src/indexer/contract.json')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, buildContract())
