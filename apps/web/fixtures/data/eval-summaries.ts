import type { EvalSummary } from 'repotron-domain'

const scores = {
  recall: 0.66,
  precision: 0.09,
  faithfulness: 0.99,
  answerRelevance: 0.88,
  citationAccuracy: 0.15,
  refusalAccuracy: 1,
  identifierHitAt1: 1,
}

const latency = { retrievalP95Ms: 400, firstTokenP95Ms: 900 }

export const FIXTURE_EVALS: EvalSummary[] = [
  {
    commitSha: 'bbb',
    createdAt: 1_700_000_000_100,
    scores,
    latency,
    cost: { dollars: 0.02 },
  },
  {
    commitSha: 'aaa',
    createdAt: 1_700_000_000_000,
    scores,
    latency,
    cost: { dollars: 0.01 },
  },
]
