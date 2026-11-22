const BEARER = 'Bearer '

/** Accepts the agent token. A missing secret rejects the call. */
export function isMcpAuthorized(authorization: string | null, secret: unknown): boolean {
  if (typeof secret !== 'string' || secret.length === 0) return false
  if (authorization === null || !authorization.startsWith(BEARER)) return false
  const token = authorization.slice(BEARER.length)
  if (token.length !== secret.length) return false
  let mismatch = 0
  for (let index = 0; index < token.length; index += 1) {
    mismatch |= token.charCodeAt(index) ^ secret.charCodeAt(index)
  }
  return mismatch === 0
}

export function readMcpToken(env: unknown): unknown {
  if (typeof env !== 'object' || env === null || !('MCP_TOKEN' in env)) return undefined
  return env.MCP_TOKEN
}
