import { createMcpHandler } from 'agents/mcp/server'

import { gatewayContext, gatewayStorage } from '../context.ts'
import { isMcpAuthorized, readMcpToken } from './mcp-auth.ts'
import { runMcpCall } from './mcp-call.ts'
import { createRepotronServer } from './mcp-server.ts'

const MCP_PATH = '/mcp'

type WorkerContext = { waitUntil(promise: Promise<unknown>): void }

const mcpHandler = createMcpHandler(createRepotronServer, {
  route: MCP_PATH,
  corsOptions: false,
})

export function isMcpPath(pathname: string): boolean {
  return pathname === MCP_PATH
}

/** Serves the agent tools. A bad token returns 401 and does not touch the database. */
export function handleMcp(request: Request, env: unknown, ctx: WorkerContext): Promise<Response> {
  if (!isMcpAuthorized(request.headers.get('Authorization'), readMcpToken(env))) {
    return Promise.resolve(new Response('Unauthorized', { status: 401 }))
  }
  const source = env as Record<string, unknown>
  const remoteIp = request.headers.get('CF-Connecting-IP') ?? ''
  return gatewayStorage.run(gatewayContext(source, ctx), () =>
    runMcpCall(remoteIp, () => mcpHandler(request, env, ctx)),
  )
}
