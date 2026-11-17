import { INDEX_STATUS_TEXT } from './index-status.constants'
import { chunkProgressLabel, chunkProgressPercent } from './chunk-progress.ts'

type ChunkProgressProps = { stored: number | null; total: number }

/** The embedding progress: the stored count, the total, and a bar. */
export function ChunkProgress({ stored, total }: ChunkProgressProps) {
  const percent = chunkProgressPercent(stored, total)
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-mute">{INDEX_STATUS_TEXT.CHUNKS}</p>
        <p className="text-sm font-semibold tabular-nums text-ink">{chunkProgressLabel(stored, total)}</p>
      </div>
      <progress
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full accent-accent"
        value={stored ?? 0}
        max={total}
        aria-label={INDEX_STATUS_TEXT.CHUNKS}
      />
      <p className="sr-only">{percent}%</p>
    </div>
  )
}
