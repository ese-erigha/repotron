import type { EvalSummary } from 'repotron-domain'

import { shortSha } from '../ui/format'

export const CHART_SERIES = {
  recall: 'recall',
  retrieval: 'retrieval',
  cost: 'cost',
} as const

export type ChartSeriesId = (typeof CHART_SERIES)[keyof typeof CHART_SERIES]

export const CHART_WIDTH = 640
export const CHART_BAND_HEIGHT = 72
export const CHART_BAND_GAP = 28
const CHART_PAD_LEFT = 132
const CHART_PAD_RIGHT = 20
const PLOT_TOP = 28
const PLOT_BOTTOM_INSET = 8

export type ChartPoint = { x: number; y: number; label: string }

export type ChartBand = {
  id: ChartSeriesId
  labelY: number
  points: ChartPoint[]
}

export function chartHeight(): number {
  return 3 * CHART_BAND_HEIGHT + 2 * CHART_BAND_GAP
}

/** Places each saved run from left to right. Each band has its own vertical scale. */
export function chartBands(summaries: EvalSummary[]): ChartBand[] {
  const ordered = [...summaries].sort((left, right) => left.createdAt - right.createdAt)
  return [
    band(CHART_SERIES.recall, ordered, ordered.map((item) => item.scores.recall), 0, 1),
    band(
      CHART_SERIES.retrieval,
      ordered,
      ordered.map((item) => item.latency.retrievalP95Ms),
      1,
      maxOf(ordered.map((item) => item.latency.retrievalP95Ms)),
    ),
    band(
      CHART_SERIES.cost,
      ordered,
      ordered.map((item) => item.cost.dollars),
      2,
      maxOf(ordered.map((item) => item.cost.dollars)),
    ),
  ]
}

function band(
  id: ChartSeriesId,
  ordered: EvalSummary[],
  values: number[],
  index: number,
  span: number,
): ChartBand {
  const top = index * (CHART_BAND_HEIGHT + CHART_BAND_GAP)
  const points = ordered.map((item, position) => ({
    x: xOf(position, ordered.length),
    y: yOf(top, values[position] ?? 0, span),
    label: shortSha(item.commitSha),
  }))
  return { id, labelY: top + 18, points }
}

function maxOf(values: number[]): number {
  if (values.length === 0) return 1
  const max = Math.max(...values)
  return max <= 0 ? 1 : max
}

function xOf(position: number, count: number): number {
  const left = CHART_PAD_LEFT
  const right = CHART_WIDTH - CHART_PAD_RIGHT
  if (count <= 1) return (left + right) / 2
  return left + ((right - left) * position) / (count - 1)
}

function yOf(top: number, value: number, span: number): number {
  const plotTop = top + PLOT_TOP
  const plotBottom = top + CHART_BAND_HEIGHT - PLOT_BOTTOM_INSET
  return plotBottom - (plotBottom - plotTop) * (value / span)
}
