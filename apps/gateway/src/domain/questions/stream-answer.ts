import type { NewAnsweredQuestionRecord, SourceChunkRecord } from 'db'
import {
  buildGithubLineUrl,
  EMBEDDING_MODEL_ID,
  ERROR_CODE,
  NOT_FOUND_ANSWER,
  readCitedNumbers,
  STREAM_EVENT,
  type Citation,
  type Preset,
} from 'repotron-domain'

import { getConfig, getRepositories, waitUntil } from '../../context.ts'
import { buildPrompt } from './build-prompt.ts'

export type AnswerInput = {
  index: { id: string; repositoryFullName: string; commitSha: string; owner: string; name: string }
  question: string
  preset: Preset | null
  chunks: SourceChunkRecord[]
  paths: string[]
  startedAt: number
}

export function openAnswerStream(input: AnswerInput): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start: (controller) => writeAnswer(controller, input),
  })
}

async function writeAnswer(controller: ReadableStreamDefaultController<Uint8Array>, input: AnswerInput): Promise<void> {
  const citations = input.chunks.map((chunk, index) => toCitation(input, chunk, index + 1))
  const encoder = new TextEncoder()
  const send = (name: string, data: unknown) => controller.enqueue(encoder.encode(eventBlock(name, data)))
  send(STREAM_EVENT.retrieval, { citations })
  try {
    const answer = await writeTokens(send, input, citations)
    const doneAt = Date.now()
    const done = {
      questionId: crypto.randomUUID().replaceAll('-', ''),
      inputTokens: answer.inputTokens,
      outputTokens: answer.outputTokens,
      retrievalMs: doneAt - input.startedAt,
      firstTokenMs: answer.firstTokenAt === null ? null : answer.firstTokenAt - input.startedAt,
      answerMs: doneAt - input.startedAt,
    }
    send(STREAM_EVENT.done, done)
    waitUntil(saveQuestion(input, citations, answer.text, done))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The answer failed.'
    send(STREAM_EVENT.error, { code: ERROR_CODE.internal, message })
  } finally {
    controller.close()
  }
}

async function writeTokens(
  send: (name: string, data: unknown) => void,
  input: AnswerInput,
  citations: Citation[],
): Promise<{ text: string; inputTokens: number | null; outputTokens: number | null; firstTokenAt: number | null }> {
  if (citations.length === 0) {
    send(STREAM_EVENT.token, { text: NOT_FOUND_ANSWER })
    return { text: NOT_FOUND_ANSWER, inputTokens: null, outputTokens: null, firstTokenAt: Date.now() }
  }
  const prompt = buildPrompt({
    question: input.question,
    chunks: citations,
    preset: input.preset,
    paths: input.paths,
  })
  return readModelStream(send, prompt)
}

async function readModelStream(
  send: (name: string, data: unknown) => void,
  prompt: { system: string; user: string },
): Promise<{ text: string; inputTokens: number | null; outputTokens: number | null; firstTokenAt: number | null }> {
  const response = await fetch(answerUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getConfig().OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: getConfig().ANSWER_MODEL_ID,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      stream: true,
      temperature: 0,
      reasoning: { effort: 'none' },
    }),
  })
  if (!response.ok || !response.body) throw new Error('The answer model failed.')
  return readSse(send, response.body)
}

async function readSse(
  send: (name: string, data: unknown) => void,
  body: ReadableStream<Uint8Array>,
): Promise<{ text: string; inputTokens: number | null; outputTokens: number | null; firstTokenAt: number | null }> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let text = ''
  let inputTokens: number | null = null
  let outputTokens: number | null = null
  let firstTokenAt: number | null = null
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    buffer += next.value
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const delta = readDelta(part)
      if (!delta) continue
      if (delta.text !== '') {
        if (firstTokenAt === null) firstTokenAt = Date.now()
        text += delta.text
        send(STREAM_EVENT.token, { text: delta.text })
      }
      if (delta.inputTokens !== null) inputTokens = delta.inputTokens
      if (delta.outputTokens !== null) outputTokens = delta.outputTokens
    }
  }
  return { text, inputTokens, outputTokens, firstTokenAt }
}

function readDelta(block: string): { text: string; inputTokens: number | null; outputTokens: number | null } | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('\n')
  if (data === '' || data === '[DONE]') return undefined
  const json = JSON.parse(data) as {
    choices?: { delta?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    text: json.choices?.[0]?.delta?.content ?? '',
    inputTokens: json.usage?.prompt_tokens ?? null,
    outputTokens: json.usage?.completion_tokens ?? null,
  }
}

function toCitation(input: AnswerInput, chunk: SourceChunkRecord, number: number): Citation {
  return {
    number,
    path: chunk.path,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    symbol: chunk.symbol,
    kind: chunk.kind as Citation['kind'],
    content: chunk.content,
    githubUrl: buildGithubLineUrl({
      owner: input.index.owner,
      name: input.index.name,
      commitSha: input.index.commitSha,
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    }),
  }
}

async function saveQuestion(
  input: AnswerInput,
  citations: Citation[],
  answer: string,
  done: { questionId: string; inputTokens: number | null; outputTokens: number | null; retrievalMs: number; firstTokenMs: number | null; answerMs: number },
): Promise<void> {
  const cited = new Set(readCitedNumbers(answer, citations.length))
  const row: NewAnsweredQuestionRecord = {
    id: done.questionId,
    indexId: input.index.id,
    repositoryFullName: input.index.repositoryFullName,
    commitSha: input.index.commitSha,
    preset: input.preset,
    question: input.question,
    answer,
    citations: JSON.stringify(citations.filter((citation) => cited.has(citation.number))),
    embeddingModelId: EMBEDDING_MODEL_ID,
    answerModelId: getConfig().ANSWER_MODEL_ID,
    inputTokens: done.inputTokens,
    outputTokens: done.outputTokens,
    retrievalMs: done.retrievalMs,
    firstTokenMs: done.firstTokenMs,
    answerMs: done.answerMs,
    createdAt: Date.now(),
  }
  await getRepositories().answeredQuestions.insert(row)
  await getRepositories().repositoryIndexes.recordQuestion({ id: input.index.id, at: row.createdAt })
}

function answerUrl(): string {
  const config = getConfig()
  return `https://gateway.ai.cloudflare.com/v1/${config.CLOUDFLARE_ACCOUNT_ID}/${config.AI_GATEWAY_ID}/openrouter/chat/completions`
}

function eventBlock(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
}
