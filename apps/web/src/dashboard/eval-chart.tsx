import type { EvalSummary } from 'repotron-domain'

import { DASHBOARD_TEXT } from './dashboard.constants'
import { CHART_WIDTH, chartBands, chartHeight, type ChartSeriesId } from './eval-chart-bands'

const STROKE: Record<ChartSeriesId, string> = {
  recall: 'stroke-accent',
  retrieval: 'stroke-ink',
  cost: 'stroke-success',
}

const FILL: Record<ChartSeriesId, string> = {
  recall: 'fill-accent',
  retrieval: 'fill-ink',
  cost: 'fill-success',
}

const LABEL: Record<ChartSeriesId, string> = {
  recall: DASHBOARD_TEXT.RECALL,
  retrieval: DASHBOARD_TEXT.RETRIEVAL,
  cost: DASHBOARD_TEXT.COST,
}

type EvalChartProps = { evals: EvalSummary[] }

export function EvalChart({ evals }: EvalChartProps) {
  const bands = chartBands(evals)
  const commits = bands[0]?.points ?? []

  return (
    <figure>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight()}`}
        role="img"
        aria-label={DASHBOARD_TEXT.LEAD}
        className="h-auto w-full"
      >
        {bands.map((band) => (
          <g key={band.id}>
            <text x="0" y={band.labelY} className="fill-mute text-[13px]">
              {LABEL[band.id]}
            </text>
            <polyline
              fill="none"
              strokeWidth="2"
              points={band.points.map((point) => `${point.x},${point.y}`).join(' ')}
              className={STROKE[band.id]}
            />
            {band.points.map((point) => (
              <circle key={`${band.id}-${point.x}`} cx={point.x} cy={point.y} r="4" className={FILL[band.id]} />
            ))}
          </g>
        ))}
      </svg>
      <ol className="relative mt-1 h-5 text-[12px] text-mute">
        {commits.map((point) => (
          <li key={point.x} className="absolute -translate-x-1/2" style={{ left: `${(point.x / CHART_WIDTH) * 100}%` }}>
            {point.label}
          </li>
        ))}
      </ol>
    </figure>
  )
}
