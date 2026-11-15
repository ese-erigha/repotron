# Phase 1 implementation plan: Index and ask

This plan turns Phase 1 of [prd.md](prd.md) into work that one implementer can do in order. It names every resource, table, route, and rule. It contains no application code.

**Read first, in this order:**

1. `.cursor/rules/repotron.mdc` — the standing rules. Stage 3 adds them. They win over this plan when the two disagree.
2. [prd.md](prd.md) — the behavior and the stories.
3. [architecture.md](architecture.md) — the system map.
4. This file. Section 2 is the map of every table and endpoint. Section 3 lists the approved decisions. The other docs match them.
5. [phase-1-ui-plan.md](phase-1-ui-plan.md) — the pages, the components, and the client code of `apps/web`.

**Ground rules for the implementer:**

- Every test of D1, Vectorize, R2, Workers AI, a Workflow, or the Container runs on staging. Do not run `cf dev` or a `--local` command.
- Do not deploy, merge, or apply a migration. A push to `develop` runs `deploy-staging.yml`, which does both.
- TypeScript unit tests run with `node:test`. Python unit tests run with `pytest`. A unit test calls no Cloudflare API, no GitHub API, and no OpenRouter API. It uses fakes or fixture files.
- Section 7 gives the delivery stages in order. Each code stage is one pull request to `develop`.

---

## 1. Scope

**In scope.** Epics 1 to 3 of [prd.md](prd.md), and F-1 to F-8, F-19, and F-20 of [features.md](features.md):

- US-1.1 to US-1.6 — intake, limits, reuse, progress, failure, and a new commit
- US-2.1 to US-2.4 — AST chunks, the split of a large node, docs, and the skip rules
- US-3.1 to US-3.9 — the stream, citations, GitHub links, not found, injection, share, the 2 presets, and the cost record

**Out of scope.**

- The golden set, the eval harness, and the CI gate (Phase 2). `apps/evals` does not exist in Phase 1.
- BM25, RRF, the reranker, scope filters, confidence labels, and the symbol trace (Phase 3)
- The dashboard (Phase 4)
- A production environment. Staging is the only environment.

---

## 2. System at a glance

This section is the map. The detail sections hold the exact rules. When this section and a detail section disagree, the detail section wins.

### 2.1 The 3 Workers and the Container

- `repotron-staging-web` (`apps/web`) — an assets-only Worker that serves the React build. No code runs on a request. No binding, no data, no secret.
- `repotron-staging-gateway` (`apps/gateway`) — the public API. Every HTTP endpoint. The browser calls it across origins, with CORS. Holds the `RateLimiter` Durable Object. Calls GitHub, Turnstile, Workers AI, Vectorize, and OpenRouter. Starts the `RepositoryIndexing` Workflow.
- `repotron-staging-pipeline` (`apps/pipeline`) — no HTTP endpoint. Runs the 2 Workflows, the `Indexer` Container class, and the daily cron.
- `repotron-staging-indexer` (`apps/indexer`) — the Python Container. Only the pipeline calls it.

### 2.2 The 3 main flows

```
Index a repository
  Browser ─► gateway POST /api/v1/indexes
      Turnstile → rate limit → GitHub checks → insert queued row
      ─► create RepositoryIndexing instance <indexId>
  RepositoryIndexing (pipeline)
      parsing → Indexer container POST /index → JSONL batches in R2 → destroy the container
      embedding → for each batch: D1 rows → embeddings → Vectorize upsert
      wait for Vectorize → ready → delete batches → start IndexDeletion for earlier indexes
  Browser polls GET /api/v1/indexes/:id every 2 seconds

Ask a question
  Browser ─► gateway POST /api/v1/indexes/:id/questions
      rate limit → embed the question → Vectorize topK 8 → load chunk rows
      ─► event retrieval
      ─► OpenRouter stream through AI Gateway ─► events token … token
      ─► event done → write the answered_questions row (waitUntil)

Clean up
  cron 0 4 * * * (pipeline) → find stale indexes → start IndexDeletion for each
  IndexDeletion → delete vectors and chunk rows in pages → delete the index row
```

### 2.3 Data

D1 database `repotron-staging-db` holds 4 tables. The migration file is `infra/migrations/0000_phase1_initial.sql`. Section 9 gives each column.

```
github_repositories ─< repository_indexes ─< source_chunks
answered_questions     (index_id with no foreign key, so a share link outlives its index)
```

- **`github_repositories`** — one row for each GitHub repository. Written by the intake. Read by the intake and the recent list.
- **`repository_indexes`** — one row for each repository at one commit. Written by the intake, both Workflows, and the question path (`last_question_at`). Read by every route.
- **`source_chunks`** — one row for each source chunk. Written by `RepositoryIndexing`. Deleted by `IndexDeletion`. Read by the question path.
- **`answered_questions`** — one row for each answered question. Written by the question path. Read by the share page.

Other stores:

- **Vectorize** `repotron-staging-chunks` — one vector for each chunk. The namespace is the index id. The vector id is the chunk id.
- **R2** `repotron-staging-batches` — JSONL batches at `indexes/<indexId>/batch-<n>.jsonl`. They live only until the index is ready.
- **Durable Object** `RateLimiter` — one object for each IP address. It holds the hourly counts.

### 2.4 HTTP endpoints

All endpoints are on the gateway, at its `workers.dev` URL. The browser calls them with `fetch`, and the gateway answers with CORS headers for the web origin. Section 10 gives the exact steps. Every JSON error uses the envelope `{ "error": { "code", "message" } }`.

- **`GET /health`** — returns `200` with `{ "ok": true }`.
- **`POST /api/v1/indexes`** — starts an index job, or returns the existing index. Guard: Turnstile and the hourly index limit.
- **`GET /api/v1/indexes`** — lists the 10 most recent ready indexes for the home screen.
- **`GET /api/v1/indexes/:id`** — returns the status of one index.
- **`POST /api/v1/indexes/:id/questions`** — answers one question as an event stream. Guard: the hourly question limit.
- **`GET /api/v1/questions/:id`** — returns one shared answer.
- **Any other `/api/v1/*` path** — `404` with the code `not_found`.

The web Worker has 3 screen routes: `/`, `/r/:owner/:repo`, and `/a/:id`. Every other path also returns the app, and the app shows its not-found screen.

### 2.5 Background entry points (pipeline)

- **Workflow `RepositoryIndexing`** — one instance for each index. Instance id: the index id. Params: `{ indexId, owner, name, commitSha }`.
- **Workflow `IndexDeletion`** — one instance for each deleted index. Instance id: `delete-<indexId>`. Params: `{ indexId }`.
- **Container class `Indexer`** — one instance for each index job. The Durable Object name is the index id.
- **Cron `0 4 * * *`** — starts `IndexDeletion` for each stale index.

### 2.6 Outbound calls

- **GitHub REST API** — gateway only, from `apps/gateway/src/domain/indexes/github-repository.ts`:
  - `GET /repos/{owner}/{repo}`
  - `GET /repos/{owner}/{repo}/branches/{branch}`
  - `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
- **GitHub tarball** — indexer only: `GET /repos/{owner}/{repo}/tarball/{sha}`
- **Turnstile siteverify** — gateway only
- **Workers AI** `@cf/google/embeddinggemma-2` — gateway (the question) and pipeline (the chunks). Each call goes through AI Gateway.
- **OpenRouter** `POST /chat/completions` through AI Gateway — gateway only
- **R2 S3 API** — indexer only, with `boto3`. The pipeline uses the R2 binding.

---

## 3. Decisions

The user approved these decisions on 2026-11-14. `architecture.md`, `prd.md`, and `features.md` match them.

### Decision A: The web app is a static frontend that calls the gateway

`apps/web` is not a full-stack Worker. It deploys to `repotron-staging-web`, an assets-only Worker, which is the current Cloudflare guidance for a static site: Workers static assets, not Pages. The browser calls the public gateway URL over HTTPS.

- The web config has no `entrypoint`. The Cloudflare Vite plugin builds the client, and `cf deploy` uploads that build as the assets.
- The web Worker has no binding, so it deploys alone, in any order.
- The gateway is the API only. It turns `workers.dev` on and answers CORS for one origin, `APP_ORIGIN`. Section 10 gives the CORS rules.
- `apps/web/src/config/public-config.ts` holds `API_ORIGIN`, the gateway URL. The gateway URL is public, so it needs no secret and no build var.
- Mailer forwards `/v1/*` through a service binding, because its `SameSite=Lax` session cookie needs one origin. Repotron has no cookie, so the forward adds code and gives nothing.

### Decision B: Model calls

- **Embeddings.** `EMBEDDING_MODEL_ID` is a constant in `packages/domain`, not a Worker var. The Vectorize dimension (768) depends on it, and the gateway and the pipeline must use the same model. Both call `env.AI.run` with the option `gateway: { id: AI_GATEWAY_ID }`.
- **Answer.** `ANSWER_MODEL_ID` stays a Worker var on the gateway. The gateway calls `POST https://gateway.ai.cloudflare.com/v1/<CLOUDFLARE_ACCOUNT_ID>/<AI_GATEWAY_ID>/openrouter/chat/completions` with `fetch`. Do not add an SDK.
- **Request rules.** `stream: true`, `temperature: 0`, and `reasoning: { effort: "none" }`.
- **Prefixes.** The question input is `task: search result | query: <question>`. The chunk input is `title: <header> | text: <content>`. `packages/domain` owns both formats.

### Decision C: Names that change

- The table `repositories` becomes `github_repositories`. In code, "repository" also means a data-access class.
- The Workflow `IndexRepository` becomes `RepositoryIndexing`. The data-access class for `repository_indexes` is `RepositoryIndexRepository`.
- A new Workflow, `IndexDeletion`, deletes one index. Scenario C and the cron both start it. A large index has too many pages for one cron run.

### Decision D: Index status and retry

- `INDEX_STATUS`: `queued`, `parsing`, `embedding`, `ready`, `failed`, and `deleting`.
- A failed index keeps its row. A new request for the same commit resets the row to `queued` and calls `restart()` on the Workflow instance. That is the retry of US-1.5.
- While a new index runs, `GET /api/v1/indexes/:id` returns `fallbackIndexId`, the newest ready index of the same repository. The ask screen uses it (US-1.6).

### Decision E: The stream has 4 events

The PRD names `retrieval`, `token`, and `done`. A model failure after the first token needs a fourth event: `error`, with the error code and message. The answer then stops, and no `answered_questions` row is written.

### Decision F: The ask screen route carries the index id

The ask screen URL is `/r/:owner/:repo?index=<indexId>`. A reload reads `GET /api/v1/indexes/:id`. It needs no Turnstile token and uses none of the 5 index requests of the hour. Without the query value, the screen shows Turnstile and posts the link again.

### Decision G: Python tooling

- `apps/indexer` is one uv project with its own `uv.lock`. The Docker build context is `apps/indexer`, so a root workspace lock would sit outside the context. Phase 2 decides the uv workspace when `apps/evals` arrives.
- Lint: `ruff check` and `ruff format --check`. Type check: `mypy --strict`. Tests: `pytest`.
- `apps/indexer/package.json` holds scripts that call `uv run`, so `turbo run lint typecheck test` covers Python too.

### Decision H: Starting values

These values are guesses until staging measures them. Each one lives in `packages/domain`.

- `MAX_CHUNK_TOKENS` = 1,500 (`tiktoken` `cl100k_base`). The value leaves room under the 8,192-token window of the embedding model, because the Gemma tokenizer counts differently. 8 chunks then stay near 12,000 input tokens for the answer model.
- `EMBED_BATCH_SIZE` = 100 texts in each Workers AI call. The staging check of stage 11 measures the real limit.
- `QUESTION_MAX_CHARS` = 1,000. The value validates the question at the boundary.

### Decision I: The deploy branch

`develop` exists on your machine. Stage 1 pushes it to GitHub. `deploy-staging.yml` runs on each push to `develop`, the same as in Mailer.

---

## 4. Repository layout

The layout copies Mailer. New parts for Repotron are the Python indexer, the Container class, and the Durable Object in the gateway.

```text
repotron/
├── .cursor/rules/
│   ├── repotron.mdc                    # standing rules (section 5)
│   └── repotron-rule-maintenance.mdc   # when to update the rule
├── .github/workflows/deploy-staging.yml
├── .husky/pre-commit
├── .gitignore
├── package.json                        # pnpm root: turbo scripts, db:sync, husky
├── pnpm-workspace.yaml                 # apps/*, packages/*
├── turbo.json
├── drizzle.config.ts
├── scripts/
│   ├── sync-migration-journal.mjs      # copy from Mailer, rename the env var
│   └── ensure-resources-staging.sh     # creates the R2 bucket when missing
├── infra/migrations/
│   ├── 0000_phase1_initial.sql
│   └── meta/_journal.json
├── docs/
├── apps/
│   ├── web/
│   │   ├── cloudflare.config.ts
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/                        # no worker/ folder: the Worker is assets-only
│   │       ├── main.tsx · app.tsx · index.css
│   │       ├── config/public-config.ts # API_ORIGIN and TURNSTILE_SITE_KEY, both public
│   │       ├── services/api/           # fetch http-client, endpoints, one service file for each area
│   │       ├── shell/ · ui/            # the app shell, navigation constants, and primitives
│   │       ├── intake/ · index-status/ · ask/ · citations/ · shared-answer/ · turnstile/
│   │       └── screens/                # home, repository, answer, and not-found screens
│   │                                   # full tree: phase-1-ui-plan.md, section 6
│   ├── gateway/
│   │   ├── cloudflare.config.ts
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── app.ts                  # Worker entry: CORS, controllers, exports RateLimiter
│   │       ├── context.ts · env.ts · http-error.ts
│   │       ├── rate-limiter.ts         # Durable Object
│   │       └── domain/
│   │           ├── indexes/
│   │           │   ├── indexes.controller.ts
│   │           │   ├── indexes.schema.ts
│   │           │   ├── github-repository.ts
│   │           │   ├── verify-turnstile.ts
│   │           │   └── usecases/       # request-index, read-index, list-recent-indexes
│   │           └── questions/
│   │               ├── questions.controller.ts
│   │               ├── questions.schema.ts
│   │               ├── retrieve-chunks.ts
│   │               ├── build-prompt.ts
│   │               ├── stream-answer.ts
│   │               └── usecases/       # ask-question, read-question
│   ├── pipeline/
│   │   ├── cloudflare.config.ts
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── index.ts                # exports the classes, dispatches the cron
│   │       ├── context.ts · env.ts · bindings.ts
│   │       ├── indexer-container/indexer-container.ts
│   │       ├── repository-indexing/    # repository-indexing.ts, store-batch.ts, wait-for-vectors.ts
│   │       ├── index-deletion/index-deletion.ts
│   │       └── delete-stale-indexes/delete-stale-indexes.ts
│   └── indexer/
│       ├── Dockerfile
│       ├── package.json                # turbo scripts that call uv
│       ├── pyproject.toml · uv.lock
│       ├── src/indexer/
│       │   ├── app.py                  # FastAPI: GET /health, POST /index
│       │   ├── index_repository.py     # the job, one step per function
│       │   ├── fetch_tarball.py
│       │   ├── walk_files.py
│       │   ├── languages.py
│       │   ├── chunk_code.py
│       │   ├── chunk_text.py
│       │   ├── split_identifiers.py
│       │   ├── write_batches.py
│       │   └── contract.json           # generated from packages/domain
│       └── tests/                      # pytest, with fixtures/
└── packages/
    ├── domain/                         # package name repotron-domain
    ├── db/                             # Drizzle schema and repositories
    └── log/
```

---

## 5. Tooling and Cursor rules

### 5.1 Monorepo

- **pnpm** and **Turborepo**, copied from Mailer: `package.json`, `pnpm-workspace.yaml`, and `turbo.json`. `test` and `typecheck` depend on `^build`.
- **TypeScript** `~6.0`, with the Mailer `tsconfig` settings. **oxlint** in each package. **Zod 4**. **Hono** in the gateway. **React 19**, **Vite**, **Tailwind**, and **react-router-dom** in the web app.
- **`cf`** and **`@cloudflare/vite-plugin`** in each Worker, at the Mailer versions. No Wrangler.
- **`@cloudflare/containers`** in `apps/pipeline`.
- **husky** pre-commit: `REPOTRON_SYNC_MIGRATIONS_STAGE=1 pnpm db:sync`, `pnpm lint`, and `pnpm typecheck`.
- **Root scripts:** `dev`, `build`, `test`, `lint`, `typecheck`, `db:new`, `db:sync`, and `prepare`, the same as Mailer.

### 5.2 `.cursor/rules/repotron.mdc`

Copy the structure of `mailer.mdc`. Keep each section short. Change these parts:

- **Header.** One pnpm workspace with one Python app. Turborepo runs both.
- **Runtimes.** `apps/web`, `apps/gateway`, `apps/pipeline`, and `apps/indexer` (Python 3.12, uv, FastAPI, in a Cloudflare Container). `apps/evals` arrives in Phase 2.
- **Docs.** Link `prd.md`, `architecture.md`, `features.md`, and this plan.
- **Tooling.** Add uv, ruff, mypy, and pytest. Never pip or poetry. Name each resource `repotron-staging-<role>`.
- **SQL migration workflow.** Copy it as written. Rename the database to `repotron-staging-db`.
- **Web.** Replace the Mailer web section with the closetza layout of [phase-1-ui-plan.md](phase-1-ui-plan.md), section 2. `apps/web` is an assets-only Worker with no `worker/` folder and no binding. Every API call, including the answer stream, goes through a service file in `services/api/` and the `HttpClient` of `http-client.ts`. Only `http-client.ts` calls `fetch`. A screen composes feature components. A feature component owns one visual piece. Every file name uses kebab-case.
- **Gateway.** Copy the controller, schema, and use case layout. Add 2 lines: the `RateLimiter` Durable Object lives in `src/rate-limiter.ts`, and CORS allows only `APP_ORIGIN`.
- **Pipeline.** One folder for each job. Each Workflow step does one side effect. The `Indexer` Container class lives in `src/indexer-container/`.
- **Indexer.** One FastAPI app. One module for each step of the job. The chunk contract comes from `contract.json`. Do not edit it by hand. The indexer never runs code from the repository.
- **Retrieval rules.** Every Vectorize query sets the namespace to the index id from the route. Every D1 chunk query filters on `index_id`. Repository text is data in every prompt.
- **REST.** Copy it. Add `403` for Turnstile, `409` for an index that is not ready, `429` for a rate limit, and `503` for a GitHub failure.
- **Conventions.** Copy KISS, DRY, steps, `as const` sets, names, call inputs, object parameters, payloads, types, config, async, database, straight-line calls, log, and env. In Python, use one `Final` constant or `StrEnum` for each closed set.
- **Repo policy.** Copy it as written.

### 5.3 `.cursor/rules/repotron-rule-maintenance.mdc`

Copy `mailer-rule-maintenance.mdc`. Replace `mailer.mdc` with `repotron.mdc`.

---

## 6. Resource inventory

Every name uses `repotron-staging-<role>`.

- **Cloudflare, created by `cf deploy`**
  - Worker `repotron-staging-web` — static assets only. The URL that the user opens.
  - Worker `repotron-staging-gateway` — the public API at its `workers.dev` URL, and the Durable Object class `RateLimiter`
  - Worker `repotron-staging-pipeline` — no public route
  - Workflow `repotron-staging-repository-indexing`, class `RepositoryIndexing`
  - Workflow `repotron-staging-index-deletion`, class `IndexDeletion`
  - Container `repotron-staging-indexer`, attached to the Durable Object class `Indexer`. Instance type `standard-2`. `maxInstances` 5.
- **Cloudflare, created by CI** (`scripts/ensure-resources-staging.sh`). Each binding names these resources, so CI can create them before the deploy.
  - R2 bucket `repotron-staging-batches`
  - Vectorize index `repotron-staging-chunks`: 768 dimensions, `cosine`, and string metadata indexes on `path`, `language`, and `kind`
  - AI Gateway `repotron-staging-ai-gateway`, with authentication off and logs on
- **Cloudflare, created once by hand.** Each one gives a value that goes into the code or into a secret.
  - The CI API token
  - D1 database `repotron-staging-db`. Its id goes into 2 configs.
  - Turnstile widget `repotron-staging-turnstile`, for the host of the web Worker
  - R2 API token with Object Read and Write on `repotron-staging-batches`. It needs the bucket, so you create it after the first CI run.
- **GitHub**
  - Fine-grained token `repotron-staging-github`, with read-only access to public repositories
  - Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- **OpenRouter**
  - API key `repotron-staging-openrouter`, with a credit limit

---

## 7. Delivery stages

Phase 1 ships in 15 stages, in this order. A stage starts only after the stage before it is done.

- **Stages 1 and 2** are setup that only you can do: in the dashboard, on GitHub, or with `cf` on your machine.
- **Stage 3** builds the monorepo. **Stage 4** adds the deploy workflow and creates the CI resources.
- **Stages 5 to 14** build the product. Each one is one pull request to `develop`. Each one adds its own deploy job when it adds a Worker.
- **Stage 15** is the release check.

Each code stage has 2 checks:

- **Local check.** `pnpm turbo run lint typecheck test build` passes, with the unit tests of the stage.
- **Staging check.** After the merge, the workflow runs green, and the staging check of the stage passes. When a check fails, fix it in a new pull request before the next stage starts.

A step marked **You** needs your account. Every other step is code.

### Stage 1: Account and access

1. **You: Install `cf` and find the account id.** `cf` needs Node.js 22.18 or later. Stage 3 adds `cf` to each Worker package, so CI uses `pnpm exec cf`. Before stage 3, run the global copy:

   ```bash
   npm install --global cf
   cf --version
   cf auth login
   cf auth whoami
   ```

   Copy the account id. When another tool named `cf` is on your `PATH`, use `cloudflare` in its place. The package installs both names.
2. **You: Find the 2 public URLs.** In the dashboard, open **Workers & Pages** and read the `workers.dev` subdomain of the account. Write down:
   - the web URL: `https://repotron-staging-web.<subdomain>.workers.dev`
   - the gateway URL: `https://repotron-staging-gateway.<subdomain>.workers.dev`
3. **You: Create the CI token.** In the dashboard, open **My Profile**, then **API Tokens**, then **Create Custom Token**. Limit it to this account. Give it these account permissions:
   - Workers Scripts: Edit
   - D1: Edit
   - Workers R2 Storage: Edit
   - Vectorize: Edit
   - AI Gateway: Edit
   - Account Settings: Read
   - Containers: Edit
     - The permission list also has Cloudchamber: Edit, the older name of the Containers platform. The docs do not say whether a container deploy needs it. When the first pipeline deploy in stage 7 fails with an authorization error, add it.

   Set an end date and write it down.
4. **You: Add the GitHub secrets.** In the repository, open **Settings**, **Secrets and variables**, **Actions**. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
5. **You: Push `develop`.** The branch exists on your machine only. Run `git push -u origin develop`.

**Done when** `cf auth whoami` names the account, and GitHub shows both secrets and the `develop` branch.

### Stage 2: Resources that CI cannot create

Each resource here gives a value that goes into the code or into a secret. So it must exist before the code.

1. **You: Create D1.** Run `cf d1 create --name repotron-staging-db --primary-location-hint enam`. Keep the `uuid`. Stages 7 and 8 write it into the configs.
2. **You: Create the Turnstile widget.** Run this command, or use the dashboard:

   ```bash
   cf turnstile widgets create \
     --name repotron-staging-turnstile \
     --domains repotron-staging-web.<subdomain>.workers.dev \
     --widget-mode managed
   ```

   Keep 2 values:
   - the site key. It is public. Stage 8 writes it into `apps/web/src/config/public-config.ts`.
   - the secret key. Stage 8 sets it as a secret.
3. **You: Create the GitHub token.** On GitHub, create a fine-grained token `repotron-staging-github` with "Public repositories (read-only)". Set an end date.
4. **You: Create the OpenRouter key.** Add credits, then create the key `repotron-staging-openrouter` with a credit limit.
5. **You: Store the secret values** (the Turnstile secret, the GitHub token, and the OpenRouter key) in a password manager. Do not put them in the repository or in a GitHub secret.

**Done when** `cf d1 list` shows `repotron-staging-db`, and you hold the D1 id, the site key, and the 3 secret values.

### Stage 3: Monorepo and tooling

- **Build**
  - The root files, copied from Mailer: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, the `tsconfig` files, `.gitignore`, `.husky/pre-commit`, `drizzle.config.ts`, and `scripts/sync-migration-journal.mjs`
  - The 2 rule files in `.cursor/rules` (section 5)
  - `packages/log`, copied from Mailer
- **Local check:** `pnpm install` and the local check pass, and the pre-commit hook runs on a commit.
- **Staging check:** none. No workflow exists yet.

### Stage 4: Deploy workflow and CI resources

- **Build**
  - `.github/workflows/deploy-staging.yml` with 4 jobs: `detect-changes`, `test`, `ensure-resources`, and `summary` (section 15). Later stages add the other jobs.
  - `cf` as a root dev dependency at the Mailer version, because no Worker package exists yet. CI runs `pnpm exec bash scripts/ensure-resources-staging.sh`.
  - `scripts/ensure-resources-staging.sh`. For each resource, it reads the resource first, and creates it only when `cf` reports `404 Not Found`. Any other failure stops the script.
    - the R2 bucket: `cf r2 buckets get`, then `cf r2 buckets create --name repotron-staging-batches --location-hint enam`, next to D1
    - the Vectorize index: `cf vectorize get`, then `cf vectorize create --name repotron-staging-chunks --index-config-dimensions 768 --index-config-metric cosine`
    - the metadata indexes: `cf vectorize metadata-index list`, then `cf vectorize metadata-index create repotron-staging-chunks --property-name <name> --index-type string` for each missing name of `path`, `language`, and `kind`
    - the AI Gateway: `cf ai-gateway gateways get repotron-staging-ai-gateway`, then `cf ai-gateway gateways create --id repotron-staging-ai-gateway --collect-logs true --cache-ttl 0 --cache-invalidate-on-update false --rate-limiting-interval 0 --rate-limiting-limit 0`. The API requires the cache and rate limit fields. Both stay off, because `RateLimiter` owns the limits.
- **You, after the merge:** Create the R2 API token. In the dashboard, open **R2**, then **Manage API tokens**. Give it Object Read and Write on `repotron-staging-batches` only. Keep the access key id and the secret access key. The bucket exists only after this run, so this step comes now.
- **Staging check**
  - The dashboard shows the bucket, the Vectorize index with 3 metadata indexes, and the AI Gateway.
  - A second run, from `workflow_dispatch`, creates no resource.

Each create command passed a `--dry-run`. Each `get` returns `404 Not Found` for the missing resource. A stub test of the script covers 3 cases: all resources missing, all present, and an auth error.

### Stage 5: Shared domain package

- **Build:** `packages/domain` (section 13): the closed sets, the limits, the model ids, the Zod schemas, the functions, and the JSON Schema export of the chunk
- **Local check:** unit tests prove each function. Examples: `parseRepositoryLink` rejects a link that is not GitHub, and `formatChunkInput` gives `title: <header> | text: <content>`.
- **Staging check:** the workflow runs green. Nothing deploys.

### Stage 6: Database schema

- **Build**
  - `infra/migrations/0000_phase1_initial.sql` and its journal (section 9)
  - The Drizzle tables and the 4 repository classes in `packages/db` (section 13)
  - The `migrate` job in the workflow
- **Local check:** the repository unit tests pass on a fake D1, and `pnpm db:sync` changes no file.
- **Staging check:** the D1 console lists the 4 tables.

### Stage 7: Pipeline and indexer skeleton

- **Build**
  - `apps/indexer`: the uv project, the `package.json` scripts, the Dockerfile, and a FastAPI app with `GET /health` only
  - `apps/pipeline` with its config (section 8), the `Indexer` Container class, and the 2 Workflow classes with empty bodies
  - The `deploy-pipeline` job. The `test` job installs uv from this stage.
- **Local check:** `ruff`, `mypy --strict`, and `pytest` pass. `docker build -t repotron-indexer apps/indexer` succeeds on a machine with Docker.
- **You, after the merge:** Set the 3 pipeline secrets: `GITHUB_TOKEN`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Read each value with `read -s VALUE` first, so it stays out of the shell history:

  ```bash
  cf workers secrets update GITHUB_TOKEN --worker repotron-staging-pipeline --type secret_text --text "$VALUE"
  ```

- **Staging check:** the dashboard shows the pipeline Worker, the 2 Workflows, and the container application `repotron-staging-indexer`. This deploy also proves the Dockerfile build context.

### Stage 8: Gateway and web foundation

- **Build**
  - `apps/gateway` with its config (section 8): the env schema, the error envelope, CORS, `GET /health`, the `404` fallback, and the `RateLimiter` Durable Object
  - `apps/web` with its config (section 8), `public-config.ts` with the gateway URL and the site key, and a home screen that calls `GET /health` through the `HttpClient` in `services/api/`. [phase-1-ui-plan.md](phase-1-ui-plan.md), section 10, lists the UI work of each stage.
  - The `deploy-gateway` job, after `deploy-pipeline`, and the `deploy-web` job
- **Local check:** unit tests prove 4 rules:
  - An unknown `/api/v1/*` path returns the `404` envelope.
  - A request from `APP_ORIGIN` gets the CORS headers, and a request from another origin gets none.
  - A preflight `OPTIONS` returns `204`.
  - `RateLimiter` refuses the sixth index request in one hour and returns the seconds until the next hour.
- **You, after the merge:** Set the 3 gateway secrets with the same command: `TURNSTILE_SECRET`, `GITHUB_TOKEN`, and `OPENROUTER_API_KEY`. The web Worker has no secret.
- **Staging check**
  - `<gateway URL>/api/v1/unknown` returns the `404` envelope.
  - `<web URL>/r/a/b` returns the app, not a `404`.
  - The home screen shows the health result, with no CORS error in the browser console.

### Stage 9: Intake (F-1)

- **Build**
  - `POST /api/v1/indexes`, `GET /api/v1/indexes`, and `GET /api/v1/indexes/:id` (section 10), with `github-repository.ts` and `verify-turnstile.ts`
  - A `RepositoryIndexing` that only marks `parsing`
  - The home screen with Turnstile and the recent list, and the status view (section 14)
- **Local check:** use case tests with fakes prove each rule of the route:
  - each error code of the route
  - `201` for a new index and `200` for an existing one
  - the reset and `restart()` of a failed index
  - a truncated tree is over the limit
- **Staging check**
  - A public link creates one `queued` row and one Workflow instance. A second request for that link creates neither.
  - A bad link, a missing repository, and a private repository each return an error. D1 gets no row.
  - A repository over 20,000 files returns an error that names the limit.
  - The sixth request in one hour returns `429`.

### Stage 10: Parse (F-3)

- **Build:** the indexer job (section 12) with `contract.json` and its test. Then steps 1 to 4 of `RepositoryIndexing`.
- **Local check:** `pytest` proves the chunk rules:
  - A Python file with 2 functions gives 2 chunks with correct line ranges.
  - A large class splits at its methods and keeps its header.
  - Markdown splits at headings.
  - The skip rules hold.
  - A tar with a `../` path fails.
- **Staging check**
  - A small public repository gets JSONL objects in R2. The status becomes `embedding`.
  - The dashboard shows the container stopped after the parse.

### Stage 11: Embed and ready (F-2)

- **Build:** steps 5 to 8 of `RepositoryIndexing`, and the failure path
- **Local check:** unit tests with fakes prove 2 rules:
  - A retried batch step writes no second chunk row.
  - The wait step retries until `processedUpToDatetime` passes the last upsert.
- **Staging check**
  - A public link reaches `ready`. The chunk count on the status view equals the D1 row count and the Vectorize count of the namespace.
  - The R2 prefix of the index is empty after `ready`.
  - Set a wrong `GITHUB_TOKEN` on the pipeline, then index a new repository. The status view shows `failed`, the stage, and the reason. Put the real token back. Retry. The index reaches `ready`.
  - A repository with about 1,000 source files is ready within 5 minutes. Record the time, the Vectorize wait, and the largest `EMBED_BATCH_SIZE` that works.

### Stage 12: Ask (F-4 to F-7)

- **Build:** `POST /api/v1/indexes/:id/questions` (section 10) with the retrieval, the prompt, the stream, and the `answered_questions` row. The ask panel and the citation panel (section 14).
- **Local check:** unit tests prove 4 rules:
  - The events arrive in the order `retrieval`, `token`, `done`.
  - A model failure sends `error` and writes no `answered_questions` row.
  - An injected instruction in a chunk stays inside the `<chunk>` tags, after the rules (US-3.5, Phase 1 check).
  - An index that is not `ready` returns `409`.
- **Staging check**
  - A question about a known function cites that function. The GitHub link opens the correct lines at the commit.
  - A question that the repository cannot answer returns "I did not find this in the repository."
  - The `answered_questions` row holds both model ids, the token counts, and the 3 latency values.
  - The AI Gateway log shows 1 embedding call and 1 OpenRouter call for the question.
  - The `retrieval` event arrives before the first token (US-3.1). Record the first-token time of 10 questions.

### Stage 13: Share and presets (F-19, F-20)

- **Build:** `GET /api/v1/questions/:id`, the answer page, the Share button, and the 2 presets
- **Local check:** unit tests prove that each preset adds its section list, and that an unknown question id returns `404`.
- **Staging check**
  - A shared link opens in a private browser window.
  - "Where do I start?" returns the 4 sections, each with a citation.
  - "Explain this feature" with a feature name returns its 4 sections.

### Stage 14: New commit and cleanup (F-8)

- **Build:** `IndexDeletion`, step 9 of `RepositoryIndexing`, `fallbackIndexId`, and the cron (section 11)
- **Local check:** unit tests with fakes prove 2 rules:
  - `IndexDeletion` deletes the vectors before the rows of each page.
  - The cron selects an index only after 30 days with no question.
- **Staging check**
  - Use a public test repository that you own. Index it. Push a commit, then index it again.
  - During the second job, the ask panel answers from the old index.
  - After `ready`, the old index has no D1 row, no chunk rows, and no vectors.
  - A share link from the old index still opens.
  - In the D1 console, set `last_question_at` of one test index to 31 days ago. After the next cron run, that index is gone.

### Stage 15: Phase 1 release check

Run these steps on staging:

1. Paste a public link. The index reaches `ready`.
2. Ask about a known function. The citation opens the correct lines on GitHub.
3. Ask an out-of-repository question. The answer is "I did not find this in the repository."
4. Share the answer. The link opens in a private window.
5. Push a commit to the test repository and index again. Questions work during the job, and the old vectors are gone after `ready`.
6. Record the index time, the p95 first-token time, and the cost of 10 questions. Phase 2 uses these numbers as the first baseline.

---

## 8. Configuration and secrets

`cloudflare.config.ts` sets each binding and var. Stages 7 and 8 of section 7 set the secrets. Each Worker validates its env with Zod at the boundary and fails loudly when a value is missing.

### `repotron-staging-web`

- **Entrypoint:** none. The config omits `entrypoint`, so the Worker is assets-only. The assets are the Vite client build.
- **Bindings:** none
- **Assets:** `notFoundHandling: "single-page-application"`
- **Vars and secrets:** none. `API_ORIGIN` and the Turnstile site key are public, so they live in `apps/web/src/config/public-config.ts`.
- **Settings:** `workers.dev` on.

```ts
import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'repotron-staging-web',
    compatibilityDate: '2026-11-11',
    assets: { notFoundHandling: 'single-page-application' },
    workersDev: true,
  },
})
```

### `repotron-staging-gateway`

- **Bindings**
  - `DB` — D1 `repotron-staging-db`
  - `CHUNK_VECTORS` — Vectorize `repotron-staging-chunks`
  - `AI` — Workers AI
  - `REPOSITORY_INDEXING` — Workflow `repotron-staging-repository-indexing`, worker `repotron-staging-pipeline`, export `RepositoryIndexing`
  - `RATE_LIMITER` — Durable Object `RateLimiter`, SQLite storage
- **Vars:** `APP_ORIGIN` (the web URL, for CORS), `CLOUDFLARE_ACCOUNT_ID`, `AI_GATEWAY_ID` (`repotron-staging-ai-gateway`), and `ANSWER_MODEL_ID` (`anthropic/claude-haiku-5.5`)
- **Secrets:** `TURNSTILE_SECRET`, `GITHUB_TOKEN`, and `OPENROUTER_API_KEY`
- **Settings:** observability on. `workers.dev` on. This URL is the public API.

### `repotron-staging-pipeline`

- **Exports**
  - `RepositoryIndexing` — `exports.workflow({ name: "repotron-staging-repository-indexing" })`
  - `IndexDeletion` — `exports.workflow({ name: "repotron-staging-index-deletion" })`
  - `Indexer` — `exports.durableObject({ storage: "sqlite", container })`. `container` comes from `defineContainer` with `image: { dockerfile: "../indexer/Dockerfile" }`, `instanceType: "standard-2"`, and `maxInstances: 5`.
- **Triggers:** `triggers.scheduled({ schedule: "0 4 * * *" })`
- **Bindings**
  - `DB`, `CHUNK_VECTORS`, and `AI`, as on the gateway
  - `CHUNK_BATCHES` — R2 `repotron-staging-batches`
  - `INDEXER` — Durable Object `Indexer`
  - `REPOSITORY_INDEXING` and `INDEX_DELETION` — the 2 Workflows of this Worker
- **Vars:** `AI_GATEWAY_ID`, `R2_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`), and `R2_BUCKET` (`repotron-staging-batches`)
- **Secrets:** `GITHUB_TOKEN`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`
- **Settings:** observability on. `workers.dev` off.

### `repotron-staging-indexer` (Container)

The `Indexer` class sets `envVars` from the pipeline env: `GITHUB_TOKEN`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. `defaultPort` is 8080. `sleepAfter` is `1m`.

---

## 9. Database schema

- **Files.** `infra/migrations/0000_phase1_initial.sql` holds the SQL. `packages/db/src/schema` holds the Drizzle tables. Write both by hand so they match, column for column.
- **Types.** Times are integers in epoch milliseconds (UTC). Ids are text. The SQL sets no default.
- **Foreign keys.** No `ON DELETE CASCADE`. `IndexDeletion` deletes `source_chunks` in pages, because one statement must not delete hundreds of thousands of rows.
- **Closed sets.** No CHECK constraints. Zod validates the values from the `as const` objects in `packages/domain`.

### Table `github_repositories`

- `id` — text, primary key. The numeric GitHub repository id, as text. It keeps the vector id under 64 bytes.
- `owner` — text, not null. As GitHub returns it.
- `name` — text, not null. As GitHub returns it.
- `default_branch` — text, not null
- `created_at`, `updated_at` — integer, not null

The intake upserts the row on each request, so a renamed repository keeps its id and gets the new name.

### Table `repository_indexes`

- `id` — text, primary key. `<repositoryId>-<commitSha>`. It is also the Workflow instance id and the Vectorize namespace.
- `repository_id` — text, not null, foreign key to `github_repositories.id`
- `commit_sha` — text, not null. 40 hex characters.
- `status` — text, not null. One of `INDEX_STATUS`.
- `failed_stage` — text, null allowed. The status at the time of the failure.
- `failure_reason` — text, null allowed. One plain sentence. It holds no token and no stack trace.
- `file_count`, `chunk_count` — integer, null allowed. Set by the Workflow.
- `embedding_model_id` — text, not null
- `created_at`, `updated_at` — integer, not null
- `ready_at`, `last_question_at` — integer, null allowed
- Index `(repository_id, created_at)`

**Constraints:**

- One row for each repository and commit. The primary key enforces it.
- Only the Workflows change `status`, except two cases. The intake inserts `queued` and resets `failed` to `queued`.
- A question reads only a `ready` index.

### Table `source_chunks`

- `id` — text, primary key. `<indexId>:<seq>`. It is also the vector id.
- `index_id` — text, not null, foreign key to `repository_indexes.id`
- `seq` — integer, not null. The order from the indexer.
- `path` — text, not null. The path inside the repository.
- `language` — text, not null. One of `LANGUAGE`.
- `symbol` — text, null allowed. The enclosing symbol name.
- `kind` — text, not null. One of `CHUNK_KIND`.
- `start_line`, `end_line` — integer, not null. 1-based and inclusive.
- `content` — text, not null. The source lines.
- `identifiers` — text, not null. Space-separated words. Phase 3 reads it.
- Index `(index_id, path)`

**Constraints:**

- The insert ignores a duplicate primary key, so a retried batch step writes no second row.
- A file is 1 MB or less, so a row stays under the 2 MB row limit of D1.

### Table `answered_questions`

- `id` — text, primary key. 128 random bits as 32 hex characters.
- `index_id` — text, not null. No foreign key.
- `repository_full_name` — text, not null. `<owner>/<name>`.
- `commit_sha` — text, not null
- `preset` — text, null allowed. One of `PRESET`.
- `question` — text, not null. For "Explain this feature", the stored text includes the feature name.
- `answer` — text, not null
- `citations` — text, not null. A JSON array of the cited chunks: `number`, `path`, `startLine`, `endLine`, `symbol`, `kind`, `content`, and `githubUrl`.
- `embedding_model_id`, `answer_model_id` — text, not null
- `input_tokens`, `output_tokens` — integer, null allowed. Null when the model reports no usage.
- `retrieval_ms` — integer, not null. From the request start to the chunk list.
- `first_token_ms` — integer, null allowed. From the request start to the first token.
- `answer_ms` — integer, not null. From the request start to the last token.
- `created_at` — integer, not null

**Constraints:**

- The share page reads only this row. It still works after `IndexDeletion` removes the index.
- The table holds no IP address.

---

## 10. Gateway: routes and behavior

**Code layout.** One controller for each route group, one use case for each action, and the repositories from `packages/db`. A controller calls `parseRequest`, calls one use case, and returns JSON or a stream. A use case has no Hono types.

**Errors.** `ERROR_CODE` in `packages/domain`:

- `validation_failed` — `400`
- `repository_too_large` — `400`. The message names the limit, for example "The repository has more than 20,000 files."
- `turnstile_failed` — `403`
- `not_found`, `repository_not_found` — `404`
- `index_not_ready` — `409`
- `rate_limited` — `429`, with a `Retry-After` header in seconds
- `github_unavailable` — `503`
- `internal` — `500`

**CORS.** `app.ts` mounts the `cors` middleware from `hono/cors` before each controller, for every route:

- `origin`: `APP_ORIGIN` only. A request from another origin gets no CORS headers, so the browser blocks the response.
- `allowMethods`: `GET`, `POST`, and `OPTIONS`. `allowHeaders`: `Content-Type`. A JSON `POST` sends a preflight `OPTIONS`, and the middleware answers it with `204`.
- `exposeHeaders`: `Retry-After`, so the web app can read the wait time of a `429`.
- `credentials`: off. The API uses no cookie.
- `maxAge`: 600 seconds, so the browser repeats the preflight less often.
- The answer stream is a normal `fetch` response, so it gets the same headers.

**Client address.** The rate limit key is the `CF-Connecting-IP` header. The browser calls the gateway directly, so the header holds the address of the user.

**`RateLimiter` Durable Object.** Its name is the IP address. It has one method, `consume(kind)`, where `kind` is one of `RATE_LIMIT_KIND` (`index` or `question`).

- The window is the current clock hour.
- The object stores one count for each kind and window.
- It allows the call when the count is below the limit (`INDEX_REQUESTS_PER_HOUR` 5, `QUESTIONS_PER_HOUR` 30). Otherwise it returns the seconds until the next hour.

### `POST /api/v1/indexes`

Body: `{ url, turnstileToken }`.

1. Parse the body.
2. Verify the token with Turnstile siteverify, with `remoteip`. A failure returns `403`.
3. Consume one `index` unit. A refusal returns `429`.
4. Parse the link with `parseRepositoryLink` from `packages/domain`. It accepts `https://github.com/<owner>/<repo>`, with an optional trailing slash or `.git`. Anything else returns `400`.
5. Call `GET /repos/{owner}/{repo}`.
   - `404` returns `repository_not_found`. GitHub also returns `404` for a private repository, so one message covers both: "This repository does not exist or is private."
   - `private: true` returns the same error.
   - `size` (kilobytes) over `REPOSITORY_MAX_KILOBYTES` (512,000) returns `repository_too_large`.
   - A `403`, a `429`, or a `5xx` returns `github_unavailable`.
6. Call `GET /repos/{owner}/{repo}/branches/{default_branch}`. Read `commit.sha`.
7. Build the index id and read the row.
   - When the row exists and is not `failed`, return `200` with the index view.
   - When the row is `failed`, reset it to `queued`, call `restart()` on the Workflow instance, and return `200`.
8. Call `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`. Count the `blob` entries. A truncated tree, or a count over `REPOSITORY_MAX_FILES` (20,000), returns `repository_too_large`.
9. Upsert `github_repositories`. Insert the `repository_indexes` row as `queued`.
10. Create the `RepositoryIndexing` instance with the id and the params in section 2.5.
    - An error that says the id exists means a parallel request already started it. Treat it as done.
    - Any other error marks the row `failed`, with the stage `queued`, and returns `503`.
11. Return `201` with the index view.

**Index view** (also from `GET /api/v1/indexes/:id`):

```
{ id, repository: { owner, name }, commitSha, status, failedStage, failureReason,
  fileCount, chunkCount, fallbackIndexId, createdAt, readyAt }
```

### `GET /api/v1/indexes/:id`

- Unknown id: `404`.
- `fallbackIndexId` is the id of the newest `ready` index of the same repository. It is set only when this index is not `ready`. Otherwise it is null.

### `GET /api/v1/indexes`

- Returns `{ indexes: IndexView[] }`: the `RECENT_INDEX_COUNT` (10) newest `ready` indexes, by `ready_at`.

### `POST /api/v1/indexes/:id/questions`

Body, one of these:

- `{ question }` — 1 to `QUESTION_MAX_CHARS` characters
- `{ preset: "start_here" }`
- `{ preset: "explain_feature", featureName }` — `featureName` is 1 to 100 characters

Steps:

1. Parse the body. Consume one `question` unit. Load the index. When the index is unknown, return `404`. When it is not `ready`, return `409`. These errors use the JSON envelope.
2. Build the question text. A preset uses the fixed text from `PRESET_QUESTION` in `packages/domain`.
3. **Retrieve** (`retrieve-chunks.ts`):
   - Embed `formatQueryInput(question)` with `EMBEDDING_MODEL_ID`.
   - Query `CHUNK_VECTORS` with `topK` `CONTEXT_CHUNKS` (8) and `namespace` equal to the index id. Return ids only.
   - Load those chunk rows in one D1 query, with `index_id` in the filter. Keep the Vectorize order.
4. Start the response: `201`, `Content-Type: text/event-stream`. Send `retrieval` with the citation list. Number each chunk from 1. Build each `githubUrl` with `buildGithubLineUrl`.
5. When retrieval returns no chunk, send the fixed answer "I did not find this in the repository." as one `token`. Skip the model.
6. **Build the prompt** (`build-prompt.ts`):
   - The system message states the 4 rules of the answer contract in [prd.md](prd.md), section 5.
   - A preset adds its section list. "Where do I start?" also adds up to `START_HERE_MAX_PATHS` (500) distinct paths of the index, from one D1 query.
   - The user message holds the question, then each chunk. Each chunk has a header `[n] <path>:<start>-<end> (<kind> <symbol>)` and sits between `<chunk>` and `</chunk>` tags as data.
7. **Stream** (`stream-answer.ts`): call OpenRouter with the request rules of Decision B. Forward each content delta as a `token` event. Read `usage` from the last chunk.
   - On a model error, send `error` and end the stream.
8. Send `done` with `{ questionId, inputTokens, outputTokens, retrievalMs, firstTokenMs, answerMs }`.
9. With `ctx.waitUntil`, insert the `answered_questions` row and set `repository_indexes.last_question_at`. `citations` holds only the chunks whose numbers appear in the answer. `readCitedNumbers` finds them and ignores a number that is out of range.

**Event format:**

```
event: retrieval   data: { citations: Citation[] }
event: token       data: { text }
event: done        data: { questionId, inputTokens, outputTokens, retrievalMs, firstTokenMs, answerMs }
event: error       data: { code, message }
```

### `GET /api/v1/questions/:id`

- Returns `{ id, repositoryFullName, commitSha, preset, question, answer, citations, createdAt }`.
- Unknown id: `404`.

---

## 11. Pipeline: Workflows, Container, and cron

### Container class `Indexer`

- `Indexer` extends `Container` from `@cloudflare/containers`. Settings are in section 8.
- The Workflow gets the instance with `getContainer(env.INDEXER, indexId)`, so one job owns one container.

### Workflow `RepositoryIndexing`

Each step does one side effect and retries on its own: 3 retries, exponential backoff from 5 seconds. Step results stay small. A batch never passes through a step result.

1. **Mark parsing.** Set `status = parsing`.
2. **Parse the repository.** `POST /index` on the container with `{ indexId, owner, name, commitSha }`. The step returns `{ fileCount, chunkCount, batchKeys }`.
3. **Stop the container.** Call `destroy()`.
4. **Mark embedding.** Set `status = embedding` and `file_count`.
5. **Store batch `<n>`**, one step for each batch key (`store-batch.ts`):
   - Read the JSONL object from R2. Parse each line with the chunk schema from `packages/domain`.
   - Insert the rows with one `db.batch()` call that holds one `INSERT … ON CONFLICT DO NOTHING` for each chunk. D1 allows 100 bound parameters in each statement, so one multi-row insert cannot hold 500 chunks.
   - Embed `formatChunkInput(header, content)` in groups of `EMBED_BATCH_SIZE`.
   - Upsert the vectors: id = chunk id, namespace = index id, metadata `{ path, language, kind }`.
   - Return the time of the last upsert.
6. **Wait for the vectors** (`wait-for-vectors.ts`). Vectorize upserts are asynchronous. Call `describe()`. When `processedUpToDatetime` is earlier than the last upsert time, throw. The step retries every 5 seconds, up to 60 times.
   - Do not compare `processedUpToMutation` with one mutation id. A parallel job can move it past that id.
7. **Mark ready.** Set `status = ready`, `chunk_count`, and `ready_at`.
8. **Delete the batches.** Delete each batch key in R2.
9. **Delete earlier indexes.** List the other indexes of the same repository with an earlier `created_at`. Start one `IndexDeletion` for each, with the Workflow batch create.

**Failure.** The `run` method catches the final error of any step. Then 3 steps run:

- **Mark failed.** Set `status = failed`, `failed_stage` = the status at that moment, and `failure_reason`.
  - A container error returns the reason in its JSON body.
  - Any other error becomes "Indexing failed at the <stage> stage."
- **Stop the container.**
- **Delete the batches.**

### Workflow `IndexDeletion`

1. **Mark deleting.** Set `status = deleting`. A question now gets `409`.
2. **Delete page `<n>`.** Repeat until a page is empty:
   - List up to `DELETE_PAGE_SIZE` (500) chunk ids of the index, ordered by id.
   - Call `deleteByIds` on `CHUNK_VECTORS` with those ids.
   - Delete the chunk rows with `index_id = ? AND id <= <last id of the page>`. The statement has 2 parameters.
3. **Delete the index row.** Leave the `answered_questions` rows.

### Cron `0 4 * * *`

Find each index with these conditions, in one query:

- the status is `ready` or `failed`
- `coalesce(last_question_at, ready_at, created_at)` is older than `INDEX_RETENTION_DAYS` (30)

Then start one `IndexDeletion` for each one, with the Workflow batch create. An existing instance id means a deletion already started. Treat it as done.

---

## 12. Indexer (`apps/indexer`)

Python 3.12 and uv. Dependencies: `fastapi`, `uvicorn`, `tree-sitter`, `tree-sitter-language-pack`, `httpx`, `tiktoken`, and `boto3`. Dev dependencies: `ruff`, `mypy`, `pytest`, and `jsonschema`.

- **`Dockerfile`** — a Python 3.12 slim base. Copy `pyproject.toml` and `uv.lock`, run `uv sync --frozen --no-dev`, then copy `src`. Start `uvicorn indexer.app:app` on port 8080.
- **`GET /health`** — returns `{ "ok": true }`.
- **`POST /index`** — Pydantic validates the body. The job in `index_repository.py` runs these steps:
  1. **Fetch** (`fetch_tarball.py`). Stream the tarball to a temp folder with `GITHUB_TOKEN`, and follow the redirect. Extract with `tarfile` and `filter="data"`. Skip each symbolic link and hard link. Reject a path that leaves the folder.
  2. **Walk** (`walk_files.py`). Skip these files:
     - each path in `SKIP_PATHS` (`node_modules/`, `vendor/`, `dist/`, `build/`, `.git/`, and similar)
     - lock files and minified files (`*.min.js`, `*.min.css`)
     - binary files, where the first 8 KB hold a null byte
     - files over `FILE_MAX_BYTES` (1 MB)
  3. **Detect the language** (`languages.py`) from the extension. Code languages: Python, TypeScript, JavaScript, Go, Java, and Rust. Markdown gets heading chunks. Every other text file gets line windows.
  4. **Chunk code** (`chunk_code.py`):
     - Each declaration node in the language map becomes one chunk.
     - A node over `MAX_CHUNK_TOKENS` splits at its child nodes. Each part keeps the class signature line as its header.
     - The code between declarations joins into one `module` chunk for each region.
  5. **Chunk text** (`chunk_text.py`). Markdown splits at headings. Other files use windows of `LINE_WINDOW` (60) lines with `LINE_OVERLAP` (10).
  6. **Add identifiers** (`split_identifiers.py`). Collect the identifier nodes. Add each name, its parts, and the lowercase forms. `getUserById` gives `getUserById get user by id`.
  7. **Write batches** (`write_batches.py`). Number the chunks from 0, and build each id as `<indexId>:<seq>`. Write `CHUNK_BATCH_SIZE` (500) chunks to each JSONL object with `boto3`.
  8. Delete the temp folder. Return `{ fileCount, chunkCount, batchKeys }`.
- **Errors.** A known failure returns a `4xx` with `{ "reason": "<one sentence>" }`, such as a missing tarball. An unexpected error returns `500` with a generic reason. Logs never hold a token.
- **Contract.** `contract.json` holds the chunk JSON Schema and the chunk limits, generated by `packages/domain`. The indexer reads its limits from that file. A test validates each written chunk against the schema.

---

## 13. Shared packages

- **`packages/domain`** (package name `repotron-domain`)
  - Closed sets: `INDEX_STATUS`, `CHUNK_KIND`, `LANGUAGE`, `PRESET`, `ERROR_CODE`, `STREAM_EVENT`, and `RATE_LIMIT_KIND`
  - Limits:
    - `REPOSITORY_MAX_KILOBYTES` (512,000), `REPOSITORY_MAX_FILES` (20,000), and `FILE_MAX_BYTES` (1,048,576)
    - `MAX_CHUNK_TOKENS` (1,500), `LINE_WINDOW` (60), `LINE_OVERLAP` (10), and `CHUNK_BATCH_SIZE` (500)
    - `EMBED_BATCH_SIZE` (100), `DELETE_PAGE_SIZE` (500), and `CONTEXT_CHUNKS` (8)
    - `START_HERE_MAX_PATHS` (500), `QUESTION_MAX_CHARS` (1,000), `RECENT_INDEX_COUNT` (10), and `INDEX_RETENTION_DAYS` (30)
    - `INDEX_REQUESTS_PER_HOUR` (5), `QUESTIONS_PER_HOUR` (30), and `STATUS_POLL_MS` (2,000)
  - Models: `EMBEDDING_MODEL_ID` (`@cf/google/embeddinggemma-2`) and `EMBEDDING_DIMENSIONS` (768)
  - Presets: `PRESET_QUESTION` and `PRESET_SECTIONS`
  - Zod schemas: the chunk, the citation, the index view, the question view, and each stream event. The gateway and the web app share them.
  - Functions:
    - `parseRepositoryLink`, `buildIndexId`, `buildChunkId`, and `buildGithubLineUrl`
    - `formatQueryInput` and `formatChunkInput`
    - `readCitedNumbers`
  - Contract: the build writes `apps/indexer/src/indexer/contract.json` with `z.toJSONSchema` and the chunk limits. A unit test fails when the committed file differs from the output.
  - Phase 3 adds `RRF_K`, `RETRIEVAL_TOP_K`, and the confidence thresholds. Phase 1 does not.
- **`packages/db`**
  - Drizzle tables that match `0000_phase1_initial.sql`
  - One class for each table: `GithubRepositoryRepository`, `RepositoryIndexRepository`, `SourceChunkRepository`, and `AnsweredQuestionRepository`. `RepotronRepositories` holds all 4.
  - Method names follow the Mailer rule: Get, Find, List, and one named action for each write. Examples: `insertQueued`, `markParsing`, `markReady`, `markFailed`, `resetToQueued`, `recordQuestion`, `insertBatch`, `listIdPage`, and `deleteThrough`.
  - `SourceChunkRepository.insertBatch` is the one method that runs a `db.batch()`. Every other method runs one statement.
- **`packages/log`** — copy from Mailer.

---

## 14. Web screens

[phase-1-ui-plan.md](phase-1-ui-plan.md) owns the web app: the screen map, the wireframes, the component trees, the client code, and the UI tests. The 3 pages are Home `/`, Repository `/r/:owner/:repo?index=<indexId>`, and Shared answer `/a/:id`.

---

## 15. CI: `deploy-staging.yml`

Copy the Mailer file. Keep one workflow file. Change these parts.

The file grows with the stages of section 7. Each job arrives with the first stage that needs it:

- Stage 4: `detect-changes`, `test`, `ensure-resources`, and `summary`
- Stage 6: `migrate`
- Stage 7: `deploy-pipeline`, and uv in `test`
- Stage 8: `deploy-gateway` and `deploy-web`

The job order below is the final shape.

**Job order:**

```
detect-changes → test → migrate (when SQL changed)
                      → ensure-resources (every run)
                            → deploy-pipeline → deploy-gateway ─┐
                      → deploy-web ─────────────────────────────┴→ summary
```

- **Trigger.** A push to `develop`, and `workflow_dispatch` with `apply_migrations`, `force_deploy_gateway`, `force_deploy_pipeline`, and `force_deploy_web`.
- **detect-changes.** 4 outputs:
  - `migrations` — `infra/migrations/*.sql`
  - `pipeline` — `apps/pipeline/`, `apps/indexer/`, `packages/`, `pnpm-lock.yaml`, and the workflow file
  - `gateway` — `apps/gateway/`, `packages/`, `pnpm-lock.yaml`, and the workflow file
  - `web` — `apps/web/`, `packages/`, `pnpm-lock.yaml`, and the workflow file
- **test.** Install pnpm, Node 22, and uv with `astral-sh/setup-uv`. Run `pnpm install --frozen-lockfile`, then `pnpm turbo run lint typecheck test build`. Turbo runs the Python scripts through `apps/indexer/package.json`.
- **migrate.** Look up `repotron-staging-db` by name. When it is missing, fail with "Create D1 repotron-staging-db with cf, as in docs/phase-1-plan.md, section 7." Apply with `cf d1 migrations apply` from `apps/gateway`.
- **ensure-resources.** Run `scripts/ensure-resources-staging.sh`. It creates each missing CI resource: the R2 bucket, the Vectorize index and its 3 metadata indexes, and the AI Gateway. Stage 4 of section 7 gives the commands. A second run creates nothing.
- **deploy-pipeline.** Run `pnpm build`, then `pnpm exec cf deploy --message "<sha>"` in `apps/pipeline`. The shared packages export `dist`, and a fresh runner has no `dist` until that build. The runner has Docker, and `cf` builds the indexer image.
- **deploy-gateway.** Run `pnpm build`, then deploy. It runs after deploy-pipeline succeeds or is skipped. The Workflow binding needs the pipeline Worker.
- **deploy-web.** Runs after test. It has no binding, so it does not wait for another deploy. `cf deploy` in `apps/web` builds the client and uploads the assets.
- **summary.** Prints each result, as in Mailer.

Phase 2 adds the eval job.

---

## 16. Business constraints

These rules hold in every stage. A change that breaks one is a defect.

- **Isolation**
  - A query reads one index only. The index id comes from the route, never from the question text.
  - Each Vectorize query sets the namespace. Each D1 chunk query filters on `index_id`.
- **Answers**
  - The answer comes only from the retrieved chunks. With no chunk, the answer is the fixed not-found sentence.
  - Each citation in the panel is a chunk that retrieval returned for that question.
  - Each GitHub link uses the commit sha, not a branch name.
  - Repository text is data. The prompt wraps each chunk in tags, and the rules come before the chunks.
- **Safety**
  - The indexer never runs a build, a script, or a package install from a repository.
  - Turnstile and the hourly limit run before any GitHub call or job.
  - CORS allows only `APP_ORIGIN`. CORS does not block a script outside a browser, so Turnstile and the limits stay the real guard.
  - The size limits run before any job.
- **Data**
  - D1 and the logs never hold a token, a secret, or an IP address.
  - A share page needs only its `answered_questions` row.
  - R2 batches live only until the index is ready or failed.
- **Cost**
  - One index exists for each repository and commit.
  - The container stops when the parse ends. `sleepAfter` stops it when the Workflow cannot.
  - An index with no question for 30 days is deleted.

---

## 17. Risks and open questions

- **Vectorize processing time.** Step 6 waits up to 5 minutes. A slower index fails the job at the `embedding` stage. The staging check of stage 11 measures the time.
- **Container cold start.** I did not measure the image size or the start time. Both count against the 5-minute target.
- **Container concurrency.** `maxInstances` is 5. A sixth parallel job fails step 2, then retries with backoff. Measure the queue time on staging.
- **Dockerfile path.** I did not confirm that `cf` uses the folder of the Dockerfile as the build context. The first pipeline deploy in stage 7 proves it.
- **Embedding batch size.** The model page states no limit for each call. The staging check of stage 11 sets the value.
- **Vectorize delete batch size.** I did not find a documented limit for `deleteByIds`. 500 ids stays under the upsert limit of 1,000. The staging check of stage 14 proves it.
- **OpenRouter usage in a stream.** I did not confirm that the last stream chunk holds `usage` through AI Gateway. The token columns allow null, so the answer still works. The staging check of stage 12 proves it.
- **GitHub rate limit.** One token allows 5,000 API calls each hour. Each new index uses 3 calls plus the tarball.
- **Private and missing repositories.** GitHub returns `404` for both, so US-1.1 shows one message for both cases.
- **One user behind a shared IP address.** The hourly limits count by IP address, so users on one network share 5 index requests and 30 questions.
- **Origin values.** `API_ORIGIN` and `APP_ORIGIN` hold the `workers.dev` URLs. A custom domain later changes both values in one pull request. A wrong `APP_ORIGIN` blocks every browser call. The CORS unit test and the staging check of stage 8 catch it.
- **Unauthenticated AI Gateway.** Anyone with the gateway URL can send traffic to it. Each call still needs the OpenRouter key or Workers AI billing on this account. Turn on authentication before a public launch.
- **`MAX_CHUNK_TOKENS`.** The value 1,500 is a starting guess. Phase 2 tunes it with the eval.
- **D1 size.** One database stops at 10 GB. The 30-day cleanup is the only control. Measure the size on staging.

---

## 18. Worker secrets

Set each secret after the Worker exists.

- **`repotron-staging-gateway`**
  - `TURNSTILE_SECRET`
  - `GITHUB_TOKEN`
  - `OPENROUTER_API_KEY`
- **`repotron-staging-pipeline`**
  - `GITHUB_TOKEN`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
- **`repotron-staging-web`**
  - none

