import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { answerPath, repositoryPath } from './navigation.constants'

describe('navigation', () => {
  it('when an index id is given, then repositoryPath adds the index query value', () => {
    const path = repositoryPath('honojs', 'hono', '438384984-f6fbaf0')

    assert.equal(path, '/r/honojs/hono?index=438384984-f6fbaf0')
  })

  it('when no index id is given, then repositoryPath has no query', () => {
    const path = repositoryPath('honojs', 'hono')

    assert.equal(path, '/r/honojs/hono')
  })

  it('when a question id is given, then answerPath is the share path of that answer', () => {
    const path = answerPath('7f3a9c2e41d84b0fa6c5e8d19b3f2a67')

    assert.equal(path, '/a/7f3a9c2e41d84b0fa6c5e8d19b3f2a67')
  })
})
