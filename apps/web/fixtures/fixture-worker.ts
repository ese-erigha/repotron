import { answerRequest } from './fixture-routes.ts'
import { FixtureDisconnect, FixtureStore } from './fixture-store.ts'

const API_BASE = '/api/v1'

const store = new FixtureStore(Date.now())

/** Serves `/api/v1` from the fixture files. The asset Worker serves the screens. */
export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await answerRequest(store, fixtureRequest(request))
    } catch (failure) {
      if (failure instanceof FixtureDisconnect) return new Response(null, { status: 500 })
      throw failure
    }
  },
}

/** Removes `/api/v1`, so the route matcher sees the same path as the dev server. */
function fixtureRequest(request: Request): Request {
  const url = new URL(request.url)
  const path = url.pathname.startsWith(API_BASE) ? url.pathname.slice(API_BASE.length) || '/' : url.pathname
  return new Request(new URL(`${path}${url.search}`, url.origin), request)
}
