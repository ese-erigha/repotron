import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { findFixtureProblems } from './find-fixture-problems.ts'
import { FLASK_REPOSITORY } from './flask.fixture.ts'
import { buildGenericRepository } from './generic.fixture.ts'
import { HONO_REPOSITORY } from './hono.fixture.ts'

describe('fixture data', () => {
  it('when the hono fixture is checked, then each answer cites a chunk that exists', () => {
    assert.deepEqual(findFixtureProblems(HONO_REPOSITORY), [])
  })

  it('when the flask fixture is checked, then each answer cites a chunk that exists', () => {
    assert.deepEqual(findFixtureProblems(FLASK_REPOSITORY), [])
  })

  it('when a generic repository is built, then each answer cites a chunk that exists', () => {
    const repository = buildGenericRepository({ owner: 'tokio-rs', name: 'axum' })

    assert.deepEqual(findFixtureProblems(repository), [])
  })

  it('when a generic repository is built 2 times, then the commit sha is the same', () => {
    const first = buildGenericRepository({ owner: 'tokio-rs', name: 'axum' })
    const second = buildGenericRepository({ owner: 'tokio-rs', name: 'axum' })

    assert.equal(first.commitSha, second.commitSha)
  })
})
