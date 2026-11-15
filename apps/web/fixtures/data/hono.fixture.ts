import chunks from './chunks.json' with { type: 'json' }
import type { FixtureChunk, FixtureRepository } from './fixture-repository.ts'

const ROUTER_ANSWER = `The \`Hono\` constructor creates the router [1]. When the \`router\` option is not set, the constructor builds a \`SmartRouter\` that holds a \`RegExpRouter\` and a \`TrieRouter\` [1].

### How a route reaches the router

- \`#addRoute\` merges the base path with the route path, then calls \`this.router.add(method, path, [handler, r])\` [3].
- \`SmartRouter.add\` only stores the route in \`#routes\`. It does not build a matcher [2].

### How the first match selects a router

1. \`match\` adds each stored route to the first router in the list [2].
2. A router that throws \`UnsupportedPathError\` is skipped, and the next router gets the routes [2].
3. The first router that succeeds replaces \`this.match\`, so each later request goes to that router directly [2].

\`#dispatch\` calls \`this.router.match(method, path)\` for each request [4]. The README states that \`RegExpRouter\` does not use linear loops [5].`

const MIDDLEWARE_ANSWER = `Hono runs middleware with \`compose\`, which follows the \`koa-compose\` package [1].

### When compose runs

\`#dispatch\` matches the request and reads the handler list [2]. With one handler, it calls that handler directly and skips \`compose\` [2]. With two or more handlers, it calls \`compose(matchResult[0], this.errorHandler, this.#notFoundHandler)\` [2].

### How next() works

- \`dispatch(i)\` calls handler \`i\` and passes \`() => dispatch(i + 1)\` as \`next\` [1].
- A second call to \`next()\` in one handler throws \`next() called multiple times\` [1].
- An \`Error\` goes to \`onError\`, and its result becomes the response [1].
- When no handler remains and the context is not finalized, \`onNotFound\` makes the response [1].

### An example

The \`cors\` middleware returns \`async function cors(c, next)\` [3]. It answers an \`OPTIONS\` request with a \`204\` response and does not call \`next()\`. For each other method it sets the headers, then awaits \`next()\` [3].`

const REQUEST_ANSWER = `\`fetch\` is the entry point of a Hono app. It passes the request, the env, and the execution context to \`#dispatch\` [1].

\`#dispatch\` does these steps in order [2]:

1. It serves a \`HEAD\` request as a \`GET\` request with no body.
2. It reads the path and calls \`this.router.match(method, path)\`.
3. It builds a \`Context\` from the request, the path, the match result, and the env.
4. It calls the handler. With two or more handlers, it runs them through \`compose\` [2][4].

A handler makes the response from the context. For example, \`c.json()\` calls \`JSON.stringify\` and sets the content type to \`application/json\` [3].

When the chain ends and no handler finalized the context, \`#dispatch\` throws \`Context is not finalized\` [2].`

const START_HERE_ANSWER = `## Purpose

Hono is a small web framework built on Web Standards. It runs on Cloudflare Workers, Deno, Bun, AWS Lambda, and Node.js [1].

## Entry points

- \`src/hono.ts\` exports the \`Hono\` class. Its constructor sets the default router [2].
- \`fetch\` on the base class receives each request and calls \`#dispatch\` [3].

## Main modules

- **Dispatch.** \`#dispatch\` matches the route, builds the \`Context\`, and runs the handlers [4].
- **Routers.** \`SmartRouter\` selects the first router that supports the registered paths [5].
- **Middleware.** \`compose\` chains the handlers, the error handler, and the not-found handler [6].
- **Context.** Response helpers such as \`c.json()\` live on the \`Context\` class [7].
- **Built-in middleware.** \`cors\` shows the shape of a middleware function [8].

## Reading order

1. \`README.md\`, for the purpose and the smallest app [1]
2. \`src/hono.ts\`, for the constructor [2]
3. \`src/hono-base.ts\`, from \`fetch\` to \`#dispatch\` [3][4]
4. \`src/compose.ts\`, for the middleware chain [6]
5. \`src/router/smart-router/router.ts\`, for route matching [5]`

const CORS_FEATURE_ANSWER = `## What it does

The \`cors\` middleware adds the CORS headers to a response, and it answers each preflight request [1].

## The flow

1. \`cors(options)\` merges the options with the defaults. The default origin is \`*\` [1].
2. For each request, it resolves the allowed origin and sets \`Access-Control-Allow-Origin\` [1].
3. For an \`OPTIONS\` request, it sets the allowed methods and headers, then returns a \`204\` response. It does not call \`next()\` [1].
4. For each other method, it awaits \`next()\`. \`compose\` then runs the next handler [1][2].

## The key files

- \`src/middleware/cors/index.ts\` holds the whole middleware [1].
- \`src/compose.ts\` runs it in the handler chain [2].
- \`src/hono-base.ts\` builds that chain in \`#dispatch\` [3].

## The edge cases

- When the origin is not \`*\`, the response gets \`Vary: Origin\` [1].
- With no \`allowHeaders\` option, the middleware copies \`Access-Control-Request-Headers\` from the request [1].
- A preflight response has no \`Content-Length\` header and no \`Content-Type\` header [1].`

const ROUTING_FEATURE_ANSWER = `## What it does

Routing maps the method and the path of a request to its handlers [2].

## The flow

1. The \`Hono\` constructor builds a \`SmartRouter\` with a \`RegExpRouter\` and a \`TrieRouter\` [1].
2. \`#addRoute\` merges the base path and registers the handler with \`this.router.add()\` [3].
3. On the first request, \`SmartRouter.match\` gives the routes to each router in order and keeps the first one that accepts them [2].
4. \`#dispatch\` calls \`this.router.match(method, path)\` and runs the handlers of the result [4].

## The key files

- \`src/hono.ts\` — the default router [1]
- \`src/router/smart-router/router.ts\` — the router selection [2]
- \`src/hono-base.ts\` — \`#addRoute\` and \`#dispatch\` [3][4]

## The edge cases

- A call to \`add\` after the first match throws, because the matcher is already built [2].
- A router that throws \`UnsupportedPathError\` is skipped [2].
- When no router accepts the routes, \`match\` throws \`Fatal error\` [2].`

const OVERVIEW_ANSWER = `Hono is a small web framework built on Web Standards. The same code runs on Cloudflare Workers, Deno, Bun, AWS Lambda, and Node.js [1].

The README lists the main properties [2]:

- **Fast routing.** \`RegExpRouter\` does not use linear loops.
- **Small size.** The \`hono/tiny\` preset is under 12 kB, with zero dependencies.
- **Middleware.** Built-in, custom, and third-party middleware.

In the code, the \`Hono\` class sets the default router [3]. \`fetch\` receives each request [4], and \`#dispatch\` matches the route and runs the handlers [5].`

export const HONO_REPOSITORY: FixtureRepository = {
  id: '438384984',
  owner: 'honojs',
  name: 'hono',
  commitSha: 'f6fbaf0299c48eea9e656e03e2ffe7ac755e8823',
  fileCount: 742,
  chunkCount: 6183,
  chunks: chunks.hono as Record<string, FixtureChunk>,
  overview: {
    sources: ['readme-intro', 'readme-features', 'hono-class', 'fetch', 'dispatch', 'compose', 'smart-router', 'cors'],
    text: OVERVIEW_ANSWER,
  },
  startHere: {
    sources: ['readme-intro', 'hono-class', 'fetch', 'dispatch', 'smart-router', 'compose', 'context-json', 'cors'],
    text: START_HERE_ANSWER,
  },
  topics: [
    {
      keywords: ['middleware', 'compose', 'next', 'cors'],
      sources: ['compose', 'dispatch', 'cors', 'fetch', 'hono-class', 'add-route', 'smart-router', 'readme-features'],
      text: MIDDLEWARE_ANSWER,
    },
    {
      keywords: ['request', 'response', 'context', 'json', 'fetch', 'entry'],
      sources: ['fetch', 'dispatch', 'context-json', 'compose', 'smart-router', 'hono-class', 'add-route', 'readme-intro'],
      text: REQUEST_ANSWER,
    },
    {
      keywords: ['rout', 'match', 'path'],
      sources: ['hono-class', 'smart-router', 'add-route', 'dispatch', 'readme-features', 'fetch', 'compose', 'context-json'],
      text: ROUTER_ANSWER,
    },
  ],
  features: [
    {
      keywords: ['cors'],
      sources: ['cors', 'compose', 'dispatch', 'add-route', 'fetch', 'hono-class', 'context-json', 'readme-features'],
      text: CORS_FEATURE_ANSWER,
    },
    {
      keywords: ['rout'],
      sources: ['hono-class', 'smart-router', 'add-route', 'dispatch', 'fetch', 'readme-features', 'compose', 'context-json'],
      text: ROUTING_FEATURE_ANSWER,
    },
  ],
}
