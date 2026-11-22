import app from './app.ts'
import { handleMcp, isMcpPath } from './mcp/handle-mcp.ts'

export { RateLimiter } from './rate-limiter.ts'

type FetchContext = Parameters<typeof app.fetch>[2]

export default {
  fetch(request: Request, env: unknown, ctx: FetchContext): Promise<Response> {
    if (!ctx) throw new Error('The worker context is missing.')
    if (isMcpPath(new URL(request.url).pathname)) return handleMcp(request, env, ctx)
    return Promise.resolve(app.fetch(request, env, ctx))
  },
}
