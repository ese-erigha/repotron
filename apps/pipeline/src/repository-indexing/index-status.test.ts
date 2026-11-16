import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INDEX_STATUS } from 'repotron-domain'

import { failureReason } from './index-status.ts'

describe('failureReason', () => {
  it('when the error message is short, then the reason is that message', () => {
    const reason = failureReason(new Error('The embedding response has the wrong size.'), INDEX_STATUS.embedding)

    assert.equal(reason, 'The embedding response has the wrong size.')
  })

  it('when the error message is longer than the limit, then the reason keeps the first 200 characters', () => {
    const reason = failureReason(new Error('x'.repeat(240)), INDEX_STATUS.embedding)

    assert.equal(reason, 'x'.repeat(200))
  })

  it('when the error message holds a bearer token, then the reason omits the token', () => {
    const reason = failureReason(new Error('Call failed. Bearer secret-value'), INDEX_STATUS.embedding)

    assert.equal(reason, 'Call failed. Bearer')
  })

  it('when the thrown value has a message and is not an Error, then the reason is that message', () => {
    const reason = failureReason({ message: 'AiError: 5006' }, INDEX_STATUS.embedding)

    assert.equal(reason, 'AiError: 5006')
  })

  it('when the error has no message, then the reason names the stage', () => {
    const reason = failureReason(new Error(''), INDEX_STATUS.embedding)

    assert.equal(reason, 'Indexing failed at the embedding stage.')
  })
})