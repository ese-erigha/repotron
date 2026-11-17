import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { log } from './log.ts'

describe('log', () => {
  it('when log records a string, then console receives that string', () => {
    const calls = capture(() => log.error('index_failed', 'index-1'))

    assert.deepEqual(calls, [['index_failed', 'index-1']])
  })

  it('when log records an Error, then console receives the error message', () => {
    const calls = capture(() => log.error('index_failed', new Error('The vectors are not ready.')))

    assert.deepEqual(calls, [['index_failed', 'Error: The vectors are not ready.']])
  })

  it('when the error has a cause, then console receives the cause message', () => {
    const cause = new Error('status 500')
    const calls = capture(() => log.error('index_failed', new Error('The answer model failed.', { cause })))

    assert.deepEqual(calls, [['index_failed', 'Error: The answer model failed. cause: Error: status 500']])
  })

  it('when the error message holds a bearer token, then the log omits the token', () => {
    const calls = capture(() => log.error('index_failed', new Error('Call failed. Bearer secret-value')))

    assert.deepEqual(calls, [['index_failed', 'Error: Call failed. Bearer']])
  })

  it('when log records an object, then console receives its JSON', () => {
    const calls = capture(() => log.error('parse_failed', { reason: 'The repository download was not found.' }))

    assert.deepEqual(calls, [['parse_failed', '{"reason":"The repository download was not found."}']])
  })
})

function capture(record: () => void): unknown[][] {
  const calls: unknown[][] = []
  const original = console.error
  console.error = (...parts: unknown[]) => {
    calls.push(parts)
  }
  try {
    record()
  } finally {
    console.error = original
  }
  return calls
}
