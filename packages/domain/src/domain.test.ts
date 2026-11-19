import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { buildContract } from './contract.ts'
import { formatChunkInput, formatQueryInput } from './formats.ts'
import { fuseRanks, keywordMatch, promoteSymbolHit } from './keywords.ts'
import { buildGithubLineUrl, parseRepositoryLink } from './links.ts'
import { readCitedNumbers } from './citations.ts'

describe('parseRepositoryLink', () => {
  it('when the link is not a GitHub repository, then it returns no link', () => {
    assert.equal(parseRepositoryLink('https://gitlab.com/owner/repo'), undefined)
    assert.equal(parseRepositoryLink('https://github.com/owner'), undefined)
  })

  it('when the link has a trailing slash or a .git suffix, then it returns the repository', () => {
    assert.deepEqual(parseRepositoryLink('https://github.com/owner/repo.git/'), {
      owner: 'owner',
      name: 'repo',
    })
  })
})

describe('formatChunkInput', () => {
  it('when a chunk has a header and content, then the input uses the title and text form', () => {
    assert.equal(formatChunkInput('src/app.py App', 'class App:'), 'title: src/app.py App | text: class App:')
  })
})

describe('keywordMatch', () => {
  it('when the question names getUserById, then the match text quotes the split parts', () => {
    const match = keywordMatch('Where is getUserById defined?')

    assert.equal(match.includes('"getUserById"'), true)
    assert.equal(match.includes('"get"'), true)
    assert.equal(match.includes('"user"'), true)
    assert.equal(match.includes('"by"'), true)
    assert.equal(match.includes('"id"'), true)
    assert.equal(match.includes('9-abc'), false)
  })

  it('when the question uses closed-class words, then the match text keeps the content words', () => {
    const match = keywordMatch('Where is the object schema function defined?')

    assert.equal(match.includes('"object"'), true)
    assert.equal(match.includes('"schema"'), true)
    assert.equal(match.includes('"function"'), true)
    assert.equal(match.includes('"defined"'), true)
    assert.equal(match.includes('"the"'), false)
  })
})

describe('promoteSymbolHit', () => {
  it('when the question does not ask where a name is, then the chunk order stays', () => {
    const chunks = [
      { symbol: 'object', id: 'a' },
      { symbol: 'string', id: 'b' },
    ]
    const ordered = promoteSymbolHit(chunks, 'How does Zod build an object schema from a shape?')

    assert.deepEqual(ordered.map((chunk) => chunk.id), ['a', 'b'])
  })

  it('when a later chunk symbol is the last name, then that chunk moves to the front', () => {
    const chunks = [
      { symbol: 'shape', id: 'a' },
      { symbol: 'object', id: 'b' },
    ]
    const ordered = promoteSymbolHit(chunks, 'Where is the object schema function defined?')

    assert.deepEqual(ordered.map((chunk) => chunk.id), ['b', 'a'])
  })

  it('when the question names a constructor, then the constructor chunk moves ahead of the class', () => {
    const chunks = [
      { symbol: 'Hono', id: 'class' },
      { symbol: 'constructor', id: 'ctor' },
    ]
    const ordered = promoteSymbolHit(chunks, 'Where is the Hono constructor defined?')

    assert.deepEqual(ordered.map((chunk) => chunk.id), ['ctor', 'class'])
  })

  it('when the question names a decorator, then the route chunk moves to the front', () => {
    const chunks = [
      { symbol: 'Flask', id: 'class' },
      { symbol: 'route', id: 'method' },
    ]
    const ordered = promoteSymbolHit(chunks, 'Where is the route decorator defined?')

    assert.deepEqual(ordered.map((chunk) => chunk.id), ['method', 'class'])
  })
})

describe('fuseRanks', () => {
  it('when a chunk is first in both lists, then it ranks above a chunk from one list', () => {
    const fused = fuseRanks(['both', 'dense-only'], ['both', 'keyword-only'])

    assert.deepEqual(fused, ['both', 'dense-only', 'keyword-only'])
  })
})

describe('formatQueryInput', () => {
  it('when a question is embedded, then the input uses the search task prefix', () => {
    assert.equal(formatQueryInput('Where is main?'), 'task: search result | query: Where is main?')
  })
})

describe('buildGithubLineUrl', () => {
  it('when a citation has a line range, then the link uses the commit and those lines', () => {
    const url = buildGithubLineUrl({
      owner: 'owner',
      name: 'repo',
      commitSha: 'abc',
      path: 'src/app.py',
      startLine: 4,
      endLine: 9,
    })
    assert.equal(url, 'https://github.com/owner/repo/blob/abc/src/app.py#L4-L9')
  })
})

describe('readCitedNumbers', () => {
  it('when a marker is outside the source list, then it is ignored', () => {
    assert.deepEqual(readCitedNumbers('See [1] and [9].', 2), [1])
  })
})

describe('buildContract', () => {
  it('when the contract file is committed, then it matches the generated contract', () => {
    const committed = readFileSync(new URL('../../../apps/indexer/src/indexer/contract.json', import.meta.url), 'utf8')
    assert.equal(committed, buildContract())
  })
})
