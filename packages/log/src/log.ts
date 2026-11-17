const LOG_MAX_LENGTH = 1_000

export const log = {
  error(...parts: unknown[]): void {
    console.error(...parts.map(partText))
  },
}

function partText(part: unknown): string {
  return clip(sanitize(textOf(part)))
}

function textOf(part: unknown): string {
  if (part instanceof Error) return errorText(part)
  if (typeof part === 'string') return part
  if (typeof part === 'number' || typeof part === 'boolean' || part === null || part === undefined) return String(part)
  try {
    return JSON.stringify(part)
  } catch {
    return String(part)
  }
}

function errorText(error: Error): string {
  const head = error.message === '' ? (error.stack ?? error.name) : `${error.name}: ${error.message}`
  if (error.cause === undefined) return head
  return `${head} cause: ${textOf(error.cause)}`
}

function sanitize(text: string): string {
  return text.replace(/Bearer\s+\S+/gi, 'Bearer').replace(/ghp_\S+/g, '')
}

function clip(text: string): string {
  return text.length <= LOG_MAX_LENGTH ? text : text.slice(0, LOG_MAX_LENGTH)
}
