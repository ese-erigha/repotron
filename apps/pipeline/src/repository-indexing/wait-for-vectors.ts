import { getVectors } from '../context.ts'

export async function assertVectorsReady(lastUpsertAt: string): Promise<void> {
  const described = await getVectors().describe()
  const processedUpTo = described.processedUpToDatetime
  if (toMillis(processedUpTo) < Date.parse(lastUpsertAt)) {
    const processedText = typeof processedUpTo === 'string' || typeof processedUpTo === 'number' ? String(processedUpTo) : 'missing'
    throw new Error(
      `The vectors are not ready. Vectorize processed up to ${processedText}. The last upsert was at ${lastUpsertAt}.`,
    )
  }
}

function toMillis(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value < 1_000_000_000_000 ? value * 1000 : value
  if (typeof value !== 'string') return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}
