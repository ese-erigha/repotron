import type { EvalSummary } from 'repotron-domain'

import { formatCount, formatDate, shortSha } from '../ui/format'
import { DASHBOARD_TEXT, SCORE_ROW } from './dashboard.constants'

type LatestScoresProps = { summary: EvalSummary }

const SCORE_KEYS = [
  'recall',
  'precision',
  'faithfulness',
  'answerRelevance',
  'citationAccuracy',
  'refusalAccuracy',
  'identifierHitAt1',
] as const

export function LatestScores({ summary }: LatestScoresProps) {
  return (
    <section aria-labelledby="newest-run" className="mt-8">
      <h2 id="newest-run" className="text-[13px] font-semibold tracking-wide text-mute uppercase">
        {DASHBOARD_TEXT.NEWEST}
      </h2>
      <p className="mt-2 text-sm text-ink">
        {shortSha(summary.commitSha)}
        <span className="text-mute"> · {formatDate(summary.createdAt)}</span>
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {SCORE_KEYS.map((key) => (
          <div key={key} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <dt className="text-[13px] text-mute">{SCORE_ROW[key]}</dt>
            <dd className="mt-1 text-[15px] font-medium text-ink">{summary.scores[key].toFixed(4)}</dd>
          </div>
        ))}
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <dt className="text-[13px] text-mute">{DASHBOARD_TEXT.RETRIEVAL}</dt>
          <dd className="mt-1 text-[15px] font-medium text-ink">{formatCount(summary.latency.retrievalP95Ms)} ms</dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <dt className="text-[13px] text-mute">{DASHBOARD_TEXT.COST}</dt>
          <dd className="mt-1 text-[15px] font-medium text-ink">${summary.cost.dollars.toFixed(4)}</dd>
        </div>
      </dl>
    </section>
  )
}
