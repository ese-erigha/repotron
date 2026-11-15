import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ERROR_TEXT, readErrorText } from './error-text'

describe('readErrorText', () => {
  it('when the gateway sends a message, then the text is that message', () => {
    const text = readErrorText({ code: 'repository_too_large', message: 'The repository is larger than 500 MB.' })

    assert.equal(text, 'The repository is larger than 500 MB.')
  })

  it('when the rate limit has a wait time, then the text adds the minutes', () => {
    const text = readErrorText({
      code: 'rate_limited',
      message: 'The hourly limit is reached.',
      retryAfterSeconds: 1_740,
    })

    assert.equal(text, 'The hourly limit is reached. Try again in 29 minutes.')
  })

  it('when the wait time is under one minute, then the text states 1 minute', () => {
    const text = readErrorText({ code: 'rate_limited', message: 'The hourly limit is reached.', retryAfterSeconds: 20 })

    assert.equal(text, 'The hourly limit is reached. Try again in 1 minute.')
  })

  it('when no response arrived, then the text is the network text', () => {
    const text = readErrorText({ code: 'network', message: 'The server did not respond.' })

    assert.equal(text, ERROR_TEXT.NETWORK)
  })
})
