import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

mock.module('agents/mcp/server', {
  namedExports: {
    createMcpHandler: () => async () => new Response('mcp', { status: 200 }),
  },
})

const { handleMcp } = await import('./handle-mcp.ts')

describe('handleMcp', () => {
  it('when the bearer token is missing, then the route returns 401', async () => {
    const response = await handleMcp(new Request('https://gateway.example/mcp'), {}, { waitUntil() {} })

    assert.equal(response.status, 401)
  })
})
