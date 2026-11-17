import { formatCount } from '../ui/format'

export function chunkProgressLabel(stored: number | null, total: number): string {
  return `${formatCount(stored ?? 0)} of ${formatCount(total)}`
}

export function chunkProgressPercent(stored: number | null, total: number): number {
  if (total <= 0) return 0
  const done = Math.min(total, stored ?? 0)
  return Math.round((done / total) * 100)
}
