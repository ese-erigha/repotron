import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

import { answerRequest } from './fixture-routes.ts'
import { FixtureDisconnect, FixtureStore } from './fixture-store.ts'

const API_BASE = '/api/v1'

/**
 * Serves the gateway API from fixtures on the Vite dev server.
 * The web app runs on localhost with no gateway, no secret, and no Cloudflare resource.
 */
export function fixtureApi(): Plugin {
  return {
    name: 'repotron-fixture-api',
    configureServer(server) {
      const store = new FixtureStore(Date.now())
      server.middlewares.use(API_BASE, (request, response) => {
        void serveFixture(store, request, response)
      })
    },
  }
}

async function serveFixture(store: FixtureStore, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const fixtureResponse = await answerRequest(store, await toFetchRequest(request))
    await writeNodeResponse(response, fixtureResponse)
  } catch (failure) {
    if (failure instanceof FixtureDisconnect) {
      request.socket.destroy()
      return
    }
    if (!response.headersSent) response.writeHead(500)
    response.end()
  }
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const url = new URL(request.url ?? '/', 'http://fixture')
  const method = request.method ?? 'GET'
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  if (method === 'GET' || method === 'HEAD') return new Request(url, { method, headers })
  const parts: Buffer[] = []
  for await (const part of request) parts.push(part as Buffer)
  return new Request(url, { method, headers, body: Buffer.concat(parts) })
}

async function writeNodeResponse(response: ServerResponse, fixtureResponse: Response): Promise<void> {
  const headers: Record<string, string> = {}
  fixtureResponse.headers.forEach((value, key) => {
    headers[key] = value
  })
  response.writeHead(fixtureResponse.status, headers)
  if (!fixtureResponse.body) {
    response.end()
    return
  }
  const reader = fixtureResponse.body.getReader()
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    response.write(next.value)
  }
  response.end()
}
