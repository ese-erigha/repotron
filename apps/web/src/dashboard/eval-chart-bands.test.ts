import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EvalSummary } from 'repotron-domain'

import { CHART_SERIES, chartBands } from './eval-chart-bands'

describe('chartBands', () => {
  it('when the newer summary is listed first, then its point is on the right', () => {
    const bands = chartBands([summary('bbb', 2, 0.02), summary('aaa', 1, 0.01)])
    const cost = bands.find((band) => band.id === CHART_SERIES.cost)

    assert.ok(cost !== undefined)
    assert.equal(cost.points[0]?.label, 'aaa')
    assert.equal(cost.points[1]?.label, 'bbb')
    assert.ok((cost.points[1]?.x ?? 0) > (cost.points[0]?.x ?? 0))
  })

  it('when the cost rises, then the later point sits higher', () => {
    const bands = chartBands([summary('bbb', 2, 0.02), summary('aaa', 1, 0.01)])
    const cost = bands.find((band) => band.id === CHART_SERIES.cost)

    assert.ok(cost !== undefined)
    assert.ok((cost.points[1]?.y ?? 0) < (cost.points[0]?.y ?? 0))
  })
})

function summary(commitSha: string, createdAt: number, dollars: number): EvalSummary {
  return {
    commitSha,
    createdAt,
    scores: {
      recall: 0.66,
      precision: 0.09,
      faithfulness: 0.99,
      answerRelevance: 0.88,
      citationAccuracy: 0.15,
      refusalAccuracy: 1,
      identifierHitAt1: 1,
    },
    latency: { retrievalP95Ms: 400, firstTokenP95Ms: 900 },
    cost: { dollars },
  }
}
