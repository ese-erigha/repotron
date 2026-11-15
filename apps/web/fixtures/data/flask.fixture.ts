import chunks from './chunks.json' with { type: 'json' }
import type { FixtureChunk, FixtureRepository } from './fixture-repository.ts'

const ROUTING_ANSWER = `The \`route\` decorator registers a view function for a URL rule [1]. It reads the \`endpoint\` option and calls \`add_url_rule(rule, endpoint, f, **options)\` [1].

\`add_url_rule\` does the registration [2]:

- The endpoint defaults to the name of the view function.
- The methods default to \`GET\`. A string for \`methods\` raises \`TypeError\`.
- \`OPTIONS\` is added when the rule does not list it and \`PROVIDE_AUTOMATIC_OPTIONS\` is on.
- The rule goes into \`self.url_map\`, and the view goes into \`self.view_functions[endpoint]\`.

A second view function for the same endpoint raises \`AssertionError\` [2].

At request time, \`dispatch_request\` reads \`req.url_rule\` and calls \`self.view_functions[rule.endpoint](**view_args)\` [3]. The README shows the smallest example [4].`

const LIFECYCLE_ANSWER = `The WSGI server calls the app object. \`__call__\` passes that call to \`wsgi_app\` [1].

1. \`wsgi_app\` builds the context with \`request_context(environ)\` and pushes it [2].
2. \`full_dispatch_request\` sends the \`request_started\` signal, then calls \`preprocess_request\` [3].
3. \`preprocess_request\` runs each \`before_request\` function. A return value that is not \`None\` stops the request and becomes the response [4].
4. \`dispatch_request\` calls the view function of the matched rule [5].
5. \`finalize_request\` converts the return value with \`make_response\`, then runs \`process_response\` [6].

### Errors

- An exception in a view goes to \`handle_user_exception\` [3].
- An exception that leaves \`full_dispatch_request\` goes to \`handle_exception\` [2].
- \`ctx.pop(error)\` runs in the \`finally\` block, so the teardown functions run after an error too [2].`

const START_HERE_ANSWER = `## Purpose

Flask is a lightweight WSGI web application framework. It began as a wrapper around Werkzeug and Jinja [1].

## Entry points

- \`Flask(__name__)\` creates the app, and \`@app.route\` registers a view [2].
- The WSGI server calls \`__call__\`, which calls \`wsgi_app\` [3][4].

## Main modules

- **\`src/flask/app.py\`** — the request path: \`wsgi_app\`, \`full_dispatch_request\`, and \`dispatch_request\` [4][5][8].
- **\`src/flask/sansio/scaffold.py\`** — the \`route\` decorator [6].
- **\`src/flask/sansio/app.py\`** — \`add_url_rule\`, which fills the URL map [7].

## Reading order

1. \`README.md\`, for the purpose and the smallest app [1][2]
2. \`route\` in \`src/flask/sansio/scaffold.py\` [6]
3. \`add_url_rule\` in \`src/flask/sansio/app.py\` [7]
4. \`wsgi_app\` in \`src/flask/app.py\` [4]
5. \`full_dispatch_request\`, then \`dispatch_request\` [5][8]`

const ROUTING_FEATURE_ANSWER = `## What it does

Routing connects a URL rule to a view function [1].

## The flow

1. \`@app.route(rule)\` wraps the view function and calls \`add_url_rule\` [1].
2. \`add_url_rule\` builds the rule object and adds it to \`self.url_map\` [2].
3. It stores the view function in \`self.view_functions\` under the endpoint name [2].
4. For each request, \`dispatch_request\` calls the view function of \`rule.endpoint\` with the view arguments [3].

## The key files

- \`src/flask/sansio/scaffold.py\` — the \`route\` decorator [1]
- \`src/flask/sansio/app.py\` — \`add_url_rule\` [2]
- \`src/flask/app.py\` — \`dispatch_request\` [3]

## The edge cases

- A string for \`methods\` raises \`TypeError\` [2].
- Two view functions for one endpoint raise \`AssertionError\` [2].
- An \`OPTIONS\` request to a rule with automatic options gets the default options response [3].`

const OVERVIEW_ANSWER = `Flask is a lightweight WSGI web application framework. It is designed to make the start quick, and it can scale to complex applications [1].

The smallest app creates a \`Flask\` object and registers one view with \`@app.route("/")\` [2]. The \`route\` decorator calls \`add_url_rule\` to register the view [3].

For each request, \`wsgi_app\` pushes the context and calls \`full_dispatch_request\` [4]. That method calls \`preprocess_request\`, then \`dispatch_request\`, and finalizes the response [5].`

export const FLASK_REPOSITORY: FixtureRepository = {
  id: '596892',
  owner: 'pallets',
  name: 'flask',
  commitSha: '49943b5a94413a530761350f04e896f76e8d620e',
  fileCount: 268,
  chunkCount: 2417,
  chunks: chunks.flask as Record<string, FixtureChunk>,
  overview: {
    sources: ['readme-intro', 'readme-example', 'route', 'wsgi-app', 'full-dispatch', 'dispatch-request', 'add-url-rule', 'finalize'],
    text: OVERVIEW_ANSWER,
  },
  startHere: {
    sources: ['readme-intro', 'readme-example', 'call', 'wsgi-app', 'full-dispatch', 'route', 'add-url-rule', 'dispatch-request'],
    text: START_HERE_ANSWER,
  },
  topics: [
    {
      keywords: ['rout', 'url', 'rule', 'decorator', 'view'],
      sources: ['route', 'add-url-rule', 'dispatch-request', 'readme-example', 'full-dispatch', 'wsgi-app', 'preprocess', 'finalize'],
      text: ROUTING_ANSWER,
    },
    {
      keywords: ['request', 'response', 'lifecycle', 'wsgi', 'dispatch', 'entry', 'error'],
      sources: ['call', 'wsgi-app', 'full-dispatch', 'preprocess', 'dispatch-request', 'finalize', 'route', 'readme-intro'],
      text: LIFECYCLE_ANSWER,
    },
  ],
  features: [
    {
      keywords: ['rout', 'url'],
      sources: ['route', 'add-url-rule', 'dispatch-request', 'readme-example', 'full-dispatch', 'wsgi-app', 'preprocess', 'finalize'],
      text: ROUTING_FEATURE_ANSWER,
    },
  ],
}
