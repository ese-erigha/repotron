import { getVectors } from '../context.ts'

export async function assertVectorsReady(lastUpsertAt: string): Promise<void> {
  const described = await getVectors().describe()
  if (toMillis(described.processedUpToDatetime) < Date.parse(lastUpsertAt)) {
    throw new Error('The vectors are not ready.')
  }
}

function toMillis(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value < 1_000_000_000_000 ? value * 1000 : value
  if (typeof value !== 'string') return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}
