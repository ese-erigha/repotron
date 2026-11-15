import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeRepositoryLink } from './normalize-repository-link'

describe('normalizeRepositoryLink', () => {
  it('when the link has no scheme, then it gets https', () => {
    assert.equal(normalizeRepositoryLink('github.com/honojs/hono'), 'https://github.com/honojs/hono')
  })

  it('when the link uses http or www, then it becomes the https link of github.com', () => {
    assert.equal(normalizeRepositoryLink('http://www.github.com/honojs/hono'), 'https://github.com/honojs/hono')
  })

  it('when the value is the short form, then it becomes the full link', () => {
    assert.equal(normalizeRepositoryLink(' honojs/hono '), 'https://github.com/honojs/hono')
  })

  it('when the link is complete, then it stays the same', () => {
    assert.equal(normalizeRepositoryLink('https://github.com/honojs/hono'), 'https://github.com/honojs/hono')
  })

  it('when the link names another host, then it stays the same', () => {
    assert.equal(normalizeRepositoryLink('https://gitlab.com/honojs/hono'), 'https://gitlab.com/honojs/hono')
  })
})
