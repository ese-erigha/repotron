import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { linkCitationMarkers } from './link-citation-markers'

describe('linkCitationMarkers', () => {
  it('when a marker is in range, then it becomes a citation link', () => {
    const linked = linkCitationMarkers('The constructor creates the router[1].', [1, 2])

    assert.equal(linked, 'The constructor creates the router[1](#citation-1).')
  })

  it('when a space comes before a marker, then the space does not break', () => {
    const linked = linkCitationMarkers('It creates the router [2].', [1, 2])

    assert.equal(linked, 'It creates the router\u00A0[2](#citation-2).')
  })

  it('when a marker is out of range, then it stays text', () => {
    const linked = linkCitationMarkers('It creates the router [7].', [1, 2])

    assert.equal(linked, 'It creates the router [7].')
  })

  it('when a marker is inside a code span, then it stays text', () => {
    const linked = linkCitationMarkers('Read `routes[1]` first.', [1, 2])

    assert.equal(linked, 'Read `routes[1]` first.')
  })

  it('when a marker is inside a code block that the stream did not close, then it stays text', () => {
    const linked = linkCitationMarkers('Example:\n```ts\nconst first = routes[1]', [1, 2])

    assert.equal(linked, 'Example:\n```ts\nconst first = routes[1]')
  })

  it('when the number is already the text of a link, then it stays unchanged', () => {
    const linked = linkCitationMarkers('See [1](https://hono.dev).', [1])

    assert.equal(linked, 'See [1](https://hono.dev).')
  })
})
