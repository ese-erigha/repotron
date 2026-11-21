import { ChartLine } from 'lucide-react'

import { EvalChart } from '../dashboard/eval-chart'
import { DASHBOARD_TEXT } from '../dashboard/dashboard.constants'
import { LatestScores } from '../dashboard/latest-scores'
import { useEvalHistory } from '../dashboard/use-eval-history'
import { useDocumentTitle } from '../shell/use-document-title'
import { EmptyState } from '../ui/empty-state'
import { ErrorMessage } from '../ui/error-message'
import { readErrorText } from '../ui/error-text'
import { Skeleton } from '../ui/skeleton'

export function DashboardScreen() {
  const history = useEvalHistory()
  const newest = history.evals[0]
  useDocumentTitle(DASHBOARD_TEXT.TITLE)

  return (
    <div className="mx-auto max-w-3xl pt-10 pb-24">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">{DASHBOARD_TEXT.TITLE}</h1>
      <p className="mt-2 text-sm text-mute">{DASHBOARD_TEXT.LEAD}</p>
      {history.isLoading ? <Skeleton className="mt-8 h-72 rounded-2xl" /> : null}
      {history.error ? <ErrorMessage className="mt-8" message={readErrorText(history.error)} /> : null}
      {!history.isLoading && !history.error && history.evals.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<ChartLine aria-hidden className="size-5" />}
          title={DASHBOARD_TEXT.EMPTY_TITLE}
          description={DASHBOARD_TEXT.EMPTY_BODY}
        />
      ) : null}
      {!history.isLoading && !history.error && newest ? (
        <div className="mt-8">
          <EvalChart evals={history.evals} />
          <LatestScores summary={newest} />
        </div>
      ) : null}
    </div>
  )
}
