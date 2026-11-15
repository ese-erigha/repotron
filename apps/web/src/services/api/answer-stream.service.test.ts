import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { STREAM_EVENT } from 'repotron-domain'

import type { AnswerStreamEvent } from './answer-stream.service'

// The real client module reads the Vite env, which Node does not have. These tests open no request.
mock.module('./client', {
  namedExports: {
    getHttpClient(): never {
      throw new Error('This test opens no request.')
    },
  },
})

const { parseEventBlock, readEvents } = await import('./answer-stream.service')

const CITATION = {
  number: 1,
  path: 'src/hono.ts',
  startLine: 16,
  endLine: 34,
  symbol: 'Hono',
  kind: 'class',
  content: 'export class Hono {}',
  githubUrl: 'https://github.com/honojs/hono/blob/f6fbaf0/src/hono.ts#L16-L34',
}

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collectEvents(stream: ReadableStream<Uint8Array>): Promise<AnswerStreamEvent[]> {
  const events: AnswerStreamEvent[] = []
  for await (const event of readEvents(stream)) events.push(event)
  return events
}

describe('answer stream service', () => {
  it('when a block holds a retrieval event, then parseEventBlock returns its citations', () => {
    const block = `event: retrieval\ndata: ${JSON.stringify({ citations: [CITATION] })}`

    const event = parseEventBlock(block)

    assert.deepEqual(event, { name: STREAM_EVENT.retrieval, data: { citations: [CITATION] } })
  })

  it('when a block holds 2 data lines, then parseEventBlock joins them with a newline', () => {
    const block = 'event: token\ndata: {"text":\ndata: "Hono"}'

    const event = parseEventBlock(block)

    assert.deepEqual(event, { name: STREAM_EVENT.token, data: { text: 'Hono' } })
  })

  it('when the event name is unknown, then parseEventBlock throws', () => {
    const block = 'event: progress\ndata: {"text":"Hono"}'

    assert.throws(() => parseEventBlock(block), /unknown event: progress/)
  })

  it('when the data does not match the schema of the event, then parseEventBlock throws', () => {
    const block = 'event: done\ndata: {"questionId":42}'

    assert.throws(() => parseEventBlock(block))
  })

  it('when a chunk ends inside a block, then the reader waits for the rest of the block', async () => {
    const stream = streamOf(['event: token\ndata: {"te', 'xt":"Hono "}\n\nevent: token\ndata: {"text":"runs."}\n\n'])

    const events = await collectEvents(stream)

    assert.deepEqual(events, [
      { name: STREAM_EVENT.token, data: { text: 'Hono ' } },
      { name: STREAM_EVENT.token, data: { text: 'runs.' } },
    ])
  })
})
