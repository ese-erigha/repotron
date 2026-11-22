import { McpServer } from '@modelcontextprotocol/server'
import { citationSchema, indexViewSchema, QUESTION_MAX_CHARS } from 'repotron-domain'
import { z } from 'zod'

import { log } from 'log'

import { readIndex } from '../domain/indexes/usecases/read-index.usecase.ts'
import { startPublicIndex } from '../domain/indexes/usecases/request-index.usecase.ts'
import { askQuestion } from '../domain/questions/usecases/ask-question.usecase.ts'
import { RequestError } from '../http-error.ts'
import { collectAnswer } from './collect-answer.ts'
import { mcpRemoteIp } from './mcp-call.ts'

const askResultSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  citations: z.array(citationSchema),
})

export function createRepotronServer(): McpServer {
  const server = new McpServer({ name: 'repotron', version: '1.0.0' })
  registerStartIndex(server)
  registerReadIndex(server)
  registerAsk(server)
  return server
}

function registerStartIndex(server: McpServer): void {
  server.registerTool(
    'start_index',
    {
      title: 'Start an index',
      description:
        'Start an index for a public GitHub repository. Returns the existing index when that commit is already known. Call read_index until status is ready.',
      inputSchema: z.object({ url: z.string().trim().url() }),
      outputSchema: z.object({ index: indexViewSchema }),
    },
    async ({ url }) =>
      toolResult(z.object({ index: indexViewSchema }), async () => {
        const result = await startPublicIndex({ url, remoteIp: mcpRemoteIp() })
        return { index: result.index }
      }),
  )
}

function registerReadIndex(server: McpServer): void {
  server.registerTool(
    'read_index',
    {
      title: 'Read an index',
      description: 'Read one index. Call again until status is ready. This call does not wait for the index job.',
      inputSchema: z.object({ indexId: z.string().trim().min(1) }),
      outputSchema: z.object({ index: indexViewSchema }),
    },
    async ({ indexId }) =>
      toolResult(z.object({ index: indexViewSchema }), async () => ({ index: await readIndex(indexId) })),
  )
}

function registerAsk(server: McpServer): void {
  server.registerTool(
    'ask',
    {
      title: 'Ask a question',
      description: 'Ask one question about a ready index. Returns the answer, the citations, and the saved answer id.',
      inputSchema: z.object({
        indexId: z.string().trim().min(1),
        question: z.string().trim().min(1).max(QUESTION_MAX_CHARS),
      }),
      outputSchema: askResultSchema,
    },
    async ({ indexId, question }) =>
      toolResult(askResultSchema, async () => {
        const stream = await askQuestion({
          indexId,
          body: { question },
          remoteIp: mcpRemoteIp(),
          evalToken: '',
          retrieval: '',
        })
        return collectAnswer(await new Response(stream).text())
      }),
  )
}

async function toolResult<T extends Record<string, unknown>>(
  schema: z.ZodType<T>,
  run: () => Promise<T>,
): Promise<{ content: { type: 'text'; text: string }[]; structuredContent?: T; isError?: boolean }> {
  try {
    const result = schema.parse(await run())
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    }
  } catch (error) {
    if (!(error instanceof RequestError)) log.error('mcp_tool_failed', error)
    const message = error instanceof RequestError ? error.message : 'Something went wrong.'
    return { isError: true, content: [{ type: 'text', text: message }] }
  }
}
