import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { log } from './log.ts'

describe('log', () => {
  it('when log records an error, then console receives the same arguments', () => {
    const calls: unknown[][] = []
    const original = console.error
    console.error = (...parts: unknown[]) => {
      calls.push(parts)
    }
    log.error('index_failed', 'index-1')
    console.error = original
    assert.deepEqual(calls, [['index_failed', 'index-1']])
  })
})
