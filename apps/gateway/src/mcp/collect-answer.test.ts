import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RequestError } from '../http-error.ts'
import { collectAnswer } from './collect-answer.ts'

const citation = {
  number: 1,
  path: 'src/app.ts',
  startLine: 1,
  endLine: 2,
  symbol: null,
  kind: 'function',
  content: 'export const app = 1',
  githubUrl: 'https://github.com/owner/repo/blob/abc/src/app.ts#L1-L2',
}

describe('collectAnswer', () => {
  it('when the stream finishes, then the answer and the saved id are returned', () => {
    const body = [
      `event: retrieval\ndata: ${JSON.stringify({ citations: [citation] })}\n\n`,
      'event: token\ndata: {"text":"See [1]."}\n\n',
      'event: done\ndata: {"questionId":"abc","inputTokens":1,"outputTokens":1,"retrievalMs":1,"firstTokenMs":1,"answerMs":1}\n\n',
    ].join('')

    const result = collectAnswer(body)

    assert.equal(result.answer, 'See [1].')
    assert.equal(result.questionId, 'abc')
    assert.equal(result.citations.length, 1)
  })

  it('when the stream sends an error, then the answer fails', () => {
    const body = 'event: error\ndata: {"code":"internal","message":"The answer failed."}\n\n'

    assert.throws(() => collectAnswer(body), (error: unknown) => error instanceof RequestError && error.message === 'The answer failed.')
  })
})
