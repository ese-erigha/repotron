import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { chunkProgressLabel, chunkProgressPercent } from './chunk-progress.ts'

describe('chunkProgressLabel', () => {
  it('when some chunks are stored, then the label shows the stored count and the total', () => {
    assert.equal(chunkProgressLabel(1500, 5429), '1,500 of 5,429')
  })

  it('when no chunks are stored yet, then the label starts at zero', () => {
    assert.equal(chunkProgressLabel(null, 5429), '0 of 5,429')
  })
})

describe('chunkProgressPercent', () => {
  it('when some chunks are stored, then the percent is the stored share of the total', () => {
    assert.equal(chunkProgressPercent(1500, 5429), 28)
  })

  it('when the total is zero, then the percent is zero', () => {
    assert.equal(chunkProgressPercent(0, 0), 0)
  })
})
