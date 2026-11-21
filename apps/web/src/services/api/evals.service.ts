import type { EvalSummary } from 'repotron-domain'

import { getHttpClient } from './client'
import { EVAL_PATH } from './endpoints'

type EvalHistoryResponse = { evals: EvalSummary[] }

/** Lists the saved score sheets, newest first. */
export async function listEvalSummaries(): Promise<EvalSummary[]> {
  const response = await getHttpClient().get<EvalHistoryResponse>(EVAL_PATH)
  return response.evals
}
