import { log } from 'log'
import { z } from 'zod'

const parseResultSchema = z.object({
  fileCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  batchKeys: z.array(z.string()),
})

export type ParseResult = z.infer<typeof parseResultSchema>

export async function readParseResult(response: Response): Promise<ParseResult> {
  const body: unknown = await response.json()
  if (!response.ok) {
    log.error('parse_failed', response.status, body)
    throw new Error(readReason(body))
  }
  return parseResultSchema.parse(body)
}

function readReason(body: unknown): string {
  if (body && typeof body === 'object' && 'reason' in body && typeof body.reason === 'string') {
    return body.reason
  }
  return 'The repository could not be parsed.'
}
