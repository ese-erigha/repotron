import { VECTOR_METADATA_BYTES } from './limits.ts'

export type SearchScope = {
  language?: string
  pathPrefix?: string
}

export type MetadataFilter = Record<string, string | { $gte: string; $lt: string }>

export function metadataFilter(scope: SearchScope | undefined): MetadataFilter | undefined {
  if (!scope) return undefined
  const filter: MetadataFilter = {}
  if (scope.language) filter.language = scope.language
  if (scope.pathPrefix && byteLength(scope.pathPrefix) <= VECTOR_METADATA_BYTES) {
    filter.path = { $gte: scope.pathPrefix, $lt: prefixUpperBound(scope.pathPrefix) }
  }
  if (Object.keys(filter).length === 0) return undefined
  return filter
}

export function matchesScope(path: string, language: string, scope: SearchScope | undefined): boolean {
  if (!scope) return true
  if (scope.language && language !== scope.language) return false
  if (scope.pathPrefix && !path.startsWith(scope.pathPrefix)) return false
  return true
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function prefixUpperBound(prefix: string): string {
  const chars = [...prefix]
  const last = chars.pop()
  if (!last) return prefix
  const code = last.codePointAt(0) ?? 0
  return `${chars.join('')}${String.fromCodePoint(code + 1)}`
}
