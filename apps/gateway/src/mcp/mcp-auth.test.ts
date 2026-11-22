import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isMcpAuthorized } from './mcp-auth.ts'

describe('isMcpAuthorized', () => {
  it('when the bearer token matches, then the call is authorized', () => {
    assert.equal(isMcpAuthorized('Bearer agent-token', 'agent-token'), true)
  })

  it('when the bearer token is wrong, then the call is rejected', () => {
    assert.equal(isMcpAuthorized('Bearer other-token', 'agent-token'), false)
  })

  it('when the secret is missing, then the call is rejected', () => {
    assert.equal(isMcpAuthorized('Bearer agent-token', undefined), false)
  })
})
