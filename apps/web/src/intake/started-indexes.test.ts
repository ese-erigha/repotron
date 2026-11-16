import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { forgetStartedIndex, readStartedIndexIds, rememberStartedIndex } from './started-indexes.ts'

function memoryStore(): { getItem(key: string): string | null; setItem(key: string, value: string): void } {
  const values = new Map<string, string>()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

describe('started indexes', () => {
  it('when an index id is remembered, then the list returns that id first', () => {
    const storage = memoryStore()
    rememberStartedIndex(storage, 'index-old')

    rememberStartedIndex(storage, 'index-new')

    assert.deepEqual(readStartedIndexIds(storage), ['index-new', 'index-old'])
  })

  it('when the same index id is remembered again, then the list keeps it once', () => {
    const storage = memoryStore()
    rememberStartedIndex(storage, 'index-1')

    rememberStartedIndex(storage, 'index-1')

    assert.deepEqual(readStartedIndexIds(storage), ['index-1'])
  })

  it('when an index id is forgotten, then the list omits it', () => {
    const storage = memoryStore()
    rememberStartedIndex(storage, 'index-1')

    forgetStartedIndex(storage, 'index-1')

    assert.deepEqual(readStartedIndexIds(storage), [])
  })

  it('when the stored value is not a list, then the list is empty', () => {
    const storage = memoryStore()
    storage.setItem('repotron.started-indexes', '{"id":"index-1"}')

    assert.deepEqual(readStartedIndexIds(storage), [])
  })
})
