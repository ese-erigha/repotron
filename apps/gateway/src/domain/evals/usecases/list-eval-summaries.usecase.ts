import { EVAL_HISTORY_COUNT, evalSummarySchema, type EvalSummary } from 'repotron-domain'

import { getEvalReports, type EvalReportList } from '../../../context.ts'

const SUMMARY_PREFIX = 'evals/'

export async function listEvalSummaries(): Promise<{ evals: EvalSummary[] }> {
  const keys = await listSummaryKeys()
  const summaries = await readSummaries(keys)
  const newest = [...summaries].sort((left, right) => right.createdAt - left.createdAt)
  return { evals: newest.slice(0, EVAL_HISTORY_COUNT) }
}

async function listSummaryKeys(): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined
  let truncated = true
  while (truncated) {
    const page = await getEvalReports().list(pageRequest(cursor))
    collectKeys(page, keys)
    if (page.objects.length === 0) return keys
    truncated = page.truncated && page.cursor !== undefined && page.cursor !== cursor
    cursor = page.cursor
  }
  return keys
}

function pageRequest(cursor: string | undefined): { prefix: string; cursor?: string } {
  if (cursor === undefined) return { prefix: SUMMARY_PREFIX }
  return { prefix: SUMMARY_PREFIX, cursor }
}

function collectKeys(page: EvalReportList, keys: string[]): void {
  for (const object of page.objects) {
    if (object.key.startsWith(SUMMARY_PREFIX) && object.key.endsWith('.json')) keys.push(object.key)
  }
}

async function readSummaries(keys: string[]): Promise<EvalSummary[]> {
  const reads = keys.map((key) => readSummary(key))
  return Promise.all(reads)
}

async function readSummary(key: string): Promise<EvalSummary> {
  const object = await getEvalReports().get(key)
  if (!object) throw new Error(`The eval summary ${key} is missing.`)
  const body: unknown = await object.json()
  return evalSummarySchema.parse(body)
}
