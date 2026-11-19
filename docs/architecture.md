# System Architecture Document: Repotron

## 1. Summary

Repotron runs on Cloudflare. Three TypeScript Workers and one Python container do the work. [phase-1-plan.md](phase-1-plan.md) holds the completed Phase 1 detail. [phase-2-plan.md](phase-2-plan.md) holds the eval gate.

- `apps/web` is a static web app. An assets-only Worker serves it. It holds no API code. The browser calls the gateway over HTTPS.
- `apps/gateway` is the public API Worker. It starts an index job and answers questions.
- `apps/pipeline` is the private Worker. It runs the index Workflows, owns the indexer container, and runs the cleanup cron.
- `apps/indexer` is a Python service in a Cloudflare Container. It downloads the repository, parses it with Tree-sitter, and writes chunks to R2.
- `apps/evals` is a Python harness. CI runs it. The deploy set omits it. Phase 2.

Python runs where the work needs it: parsing and evaluation. Parsing a large repository needs a disk, gigabytes of memory, and minutes of CPU time. A Worker request has none of the three. The Workers use TypeScript, because the `@cloudflare/containers` package and the Hono, Drizzle, and `cf` stack are TypeScript.

---

## 2. Topology

```text
[ Browser ]
    │  HTTPS: static files
    ▼
[ apps/web · assets-only Worker ]   React build. No entrypoint, no binding, no secret.

[ Browser ]
    │  HTTPS: fetch to the gateway origin, with CORS
    ▼
[ apps/gateway · Worker ]
  ├── RateLimiter Durable Object        hourly counts for each IP address
  ├── POST /api/v1/indexes                  Turnstile, rate limit, GitHub check
  ├── GET  /api/v1/indexes                  recent ready indexes
  ├── GET  /api/v1/indexes/:id              status
  ├── POST /api/v1/indexes/:id/questions    retrieve, stream answer
  ├── GET  /api/v1/questions/:id            shared answer
  ├── GET  /api/v1/indexes/:id/symbols/:name   symbol trace · Phase 3
  └── GET  /api/v1/evals                    dashboard data · Phase 4
    │
    │  Workflow binding
    ▼
[ apps/pipeline · Worker ]
  ├── RepositoryIndexing Workflow   one repository at one commit
  ├── IndexDeletion Workflow        one deleted index
  ├── Indexer Container class       one instance per index job
  └── Cron                          start IndexDeletion for stale indexes
    │
    ▼
[ apps/indexer · Python container ]
  fetch tarball → walk files → Tree-sitter → chunks → R2

Shared stores
  ├── [ D1 ]          github_repositories, repository_indexes, source_chunks, answered_questions, chunk_keywords (Phase 3)
  ├── [ Vectorize ]   one namespace per index
  ├── [ R2 ]          chunk batches, eval reports
  ├── [ Workers AI ]  embeddings, reranker
  └── [ AI Gateway ]  each model call
```

---

## 3. Index phases

One index is one public repository at one commit. The gateway starts the job and returns. The pipeline Worker runs the job. The container parses the files, then the pipeline Worker stops it.

The browser polls `GET /api/v1/indexes/:id` every 2 seconds. Each phase below writes the status on the `repository_indexes` row.

### 1. Check the request — gateway

- The browser posts the link and the Turnstile token to `POST /api/v1/indexes`.
- The gateway checks the Turnstile token.
- The gateway consumes one index unit for the hour. A refusal returns `429`.
- The gateway parses the link. A link that is not a public GitHub repository returns `400`.

### 2. Read the repository — gateway

The gateway calls the GitHub API. It does not download the files.

- `GET /repos/{owner}/{repo}` reads the id, the default branch, the privacy flag, and the size.
- A missing repository and a private repository both return `404` from GitHub. The gateway returns one error for both.
- A repository over the size limit returns `400`.
- `GET /repos/{owner}/{repo}/branches/{default_branch}` reads the head commit sha.
- `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` counts the files. A count over the file limit returns `400`.
- When a row already exists for that repository and that commit, the gateway returns it.
  - A `failed` row returns to `queued`, and the gateway restarts that Workflow.
- Otherwise the gateway inserts a `queued` row and creates the `RepositoryIndexing` instance. The id is `<repositoryId>-<commitSha>`.
- The gateway returns `201` for a new index and `200` for an existing one. The browser opens the status screen.

### 3. Parse the files — container

The pipeline Worker sets the status to `parsing` and starts the indexer container. This phase writes R2 only. D1 and Vectorize stay empty.

1. The container downloads the repository tarball from GitHub at that commit. It runs no git command.
2. It walks the files. It skips vendored folders, lock files, minified files, binary files, and files over 1 MB.
3. It splits the remaining files into chunks. Tree-sitter keeps a function, a method, or a class in one chunk. A README splits at its headings.
4. It writes the chunks to R2 as JSONL, 500 chunks in each object, under `indexes/<indexId>/batch-<n>.jsonl`.
5. It returns the file count, the chunk count, and the batch keys. The pipeline Worker then stops the container.

The later phases read R2. They do not call the container.

### 4. Store and embed — pipeline Worker

The pipeline Worker sets the status to `embedding` and stores the file count and the total chunk count. For each R2 file it runs one Workflow step. The next file starts only after that step finishes.

1. Read the JSONL object from R2. The object holds up to 500 chunks.
2. Take the next 10 chunks.
   - Insert those rows into `source_chunks`. One statement inserts one chunk. The row exists before the vector does.
   - Embed the chunk text with Workers AI `@cf/google/embeddinggemma-2`. Each string is `title: <header> | text: <content>`. Each call sends one text. The 10 calls run at the same time.
   - Upsert those vectors into Vectorize. The namespace is the index id.
   - Record the stored chunk count on the index row. The status card shows that count on its next poll.
3. Repeat until the object is done. The next object starts only after that.

### 5. Wait for the vectors — pipeline Worker

Vectorize stamps each upsert before the call returns, then applies it. The pipeline Worker records the time immediately before the last upsert. It calls `describe()` and compares `processedUpToDatetime` with that time. The step retries every 5 seconds until Vectorize has caught up.

### 6. Finish — pipeline Worker

- Set the status to `ready`, and store the chunk count and `ready_at`.
- Delete the batch objects in R2.
- Start one `IndexDeletion` for each earlier index of the same repository.
  - That Workflow sets the old index to `deleting`, deletes its vectors and its chunk rows, then deletes the index row.
  - The `answered_questions` rows stay, so a share link still opens.

The browser reads `ready` on its next poll and opens the ask screen.

### Failure — pipeline Worker

A step that fails after its retries sets the status to `failed`. The pipeline Worker logs `indexing_failed` with the original error, and the row stores the short reason. The container logs a parse failure before it returns the short reason. The same path stops the container and deletes the batches.

---

## 4. Components

### Tier 1: Web app (`apps/web`)

React and Vite. The Worker `repotron-staging-web` serves the Vite client build as static assets. This is the current Cloudflare guidance: use Workers with static assets, not Pages. The Worker has no `entrypoint`, so no request runs code. The browser calls the gateway over HTTPS.

- `notFoundHandling` is `single-page-application`, so a reload of a screen route returns the app.
- `apps/web/src/config/public-config.ts` holds `API_ORIGIN`, the gateway URL, and the Turnstile site key. Both values are public.
- `/` holds the link box, Turnstile, and the recent list.
- `/r/:owner/:repo?index=<indexId>` shows the status, then the ask screen. A reload reads the status by id, so it needs no new Turnstile token.
- `/a/:id` shows one shared answer.
- `/dashboard` shows the eval chart. Phase 4.

The ask screen reads the answer stream with `fetch` and a stream reader. The citation panel renders the `retrieval` event before the first token.

**Local run.** `pnpm --filter web dev` serves the app at `http://localhost:5173`. The Vite dev server answers `/api/v1` from `apps/web/fixtures`, so the app needs no gateway and no Cloudflare resource. The deployed build calls the gateway. [phase-1-ui-plan.md](phase-1-ui-plan.md), section 12, lists the fixture repositories and the links that show each state.

### Tier 2: Public API Worker (`apps/gateway`)

Hono. One controller for each route group. One use case for each action.

**CORS.** The `cors` middleware from Hono allows one origin, `APP_ORIGIN`, the web Worker URL. It allows `GET`, `POST`, and the `Content-Type` header. It exposes `Retry-After`. The API sets no cookie, so it allows no credentials.

**Index request.**

1. Verify the Turnstile token. Apply the hourly index limit for the IP address.
2. Parse the link. Call `GET /repos/{owner}/{repo}` on the GitHub API with the server token.
3. Reject a missing repository and a private repository with one error. GitHub returns `404` for both. Reject a repository over the size limit.
   - The `size` field of the response is in kilobytes.
4. Read the head commit sha with `GET /repos/{owner}/{repo}/branches/{default_branch}`. The repository response holds the branch name only.
5. When `repository_indexes` has a row for that repository and commit, return it.
   - When that row is `failed`, reset it to `queued` and call `restart()` on its Workflow instance. That is the retry.
6. Call `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`. Count the `blob` entries. Reject the repository when the count passes the file limit.
   - The count includes files that the indexer skips. So the check is stricter than the limit on indexed files.
   - GitHub sets `truncated` when a tree has more than 100,000 entries. Treat a truncated tree as over the limit.
7. Otherwise insert the row as `queued`, and create a `RepositoryIndexing` instance with the index id `<repositoryId>-<sha>`. A duplicate id fails on create. Treat that error as done.

**Rate limits.** The `RateLimiter` Durable Object holds the hourly counts. One object serves one IP address, from the `CF-Connecting-IP` header. It counts index requests and questions in fixed one-hour windows.

- The Workers rate limit binding does not fit. Its period is 10 or 60 seconds, and each Cloudflare location keeps its own count.

**Status.** `GET /api/v1/indexes/:id` also returns `fallbackIndexId`: the newest `ready` index of the same repository, while this index is not `ready`. The ask screen uses it during a re-index.

**Question.** Refer to section 5, Scenario B.

### Tier 3: Private Worker (`apps/pipeline`)

**`RepositoryIndexing` Workflow.** Each step does one side effect and retries on its own.

1. Set the status to `parsing`.
2. Start the container for this index. Call `POST /index` with the owner, the repository, the commit, and the index id. The container downloads the tarball, writes the chunk files to R2, and returns the batch list. D1 and Vectorize stay empty.
3. Stop the container with `destroy()`. The batches are in R2, so the later steps do not need it.
4. Set the status to `embedding`, and store the file count and the total chunk count.
5. For each batch key, run one step:
   - Read the JSONL batch from R2.
   - For each wave of 10 chunks: insert the rows, embed them, upsert the vectors, then record the stored chunk count.
     - Each insert is one `INSERT … ON CONFLICT DO NOTHING`. D1 allows 100 bound parameters and 100 KB in each statement.
     - Each embedding call sends one text. The 10 calls run at the same time.
     - The row exists before the vector does. A failed call leaves at most 10 rows with no vector, and the step retries the file.
6. Wait for the vectors. Vectorize upserts are asynchronous. The step checks `processedUpToDatetime` from `describe()` against the time recorded immediately before the last upsert, and retries until Vectorize catches up.
7. Set the status to `ready`, with the file count and the chunk count.
8. Delete the batches in R2.
9. Start one `IndexDeletion` for each earlier index of the same repository. Refer to Scenario C.

A failed step after its retries sets the status to `failed`, with the stage and the reason. The failure path also stops the container and deletes the batches.

**`IndexDeletion` Workflow.** One instance deletes one index.

1. Set the status to `deleting`. A question now gets `409`.
2. Delete one page of 500 chunks for each step: the vectors by id, then the `source_chunks` rows. Repeat until no chunk is left.
3. Delete the `repository_indexes` row. The `answered_questions` rows stay, so each share link still works.

**Indexer Container class.** It extends `Container` from `@cloudflare/containers`. The Durable Object name is the index id, so one job owns one container. The starting instance type is `standard-2`: 1 vCPU, 6 GiB memory, and 12 GB disk. `maxInstances` is 10.

Cloudflare bills memory and disk for each second that the container is awake, including idle time. So the Workflow stops the container as soon as the parse ends. The sleep timeout is 1 minute. That timeout stops a container that step 3 did not reach, such as after a failed parse.

**Cron.** Once each day, it starts one `IndexDeletion` for each index with no question for 30 days. A large index has too many pages for one cron run, so the cron only starts the Workflows.

### Tier 4: Python indexer (`apps/indexer`)

Python 3.12. One uv project with its own `uv.lock`, because the Docker build context is `apps/indexer`. The image holds FastAPI, `tree-sitter`, `tree-sitter-language-pack`, `httpx`, `tiktoken`, and `boto3` for the R2 S3 API. Lint is `ruff`. The type check is `mypy --strict`. Tests use `pytest`.

`POST /index` does these steps:

1. Download `GET /repos/{owner}/{repo}/tarball/{sha}` and extract it to disk. The tarball pins the exact commit and needs no git binary.
2. Walk the files. Skip:
   - `node_modules/`, `vendor/`, `dist/`, `build/`, and other paths in `SKIP_PATHS`
   - Lock files, minified files, and binary files
   - Files over 1 MB
3. Detect the language from the file extension.
4. Chunk each file. Refer to the chunk rules below.
5. Write the chunks to R2 as JSONL, 500 chunks per object, under `indexes/<indexId>/batch-<n>.jsonl`.
6. Return the file count, the chunk count, and the batch keys.

**Chunk rules.**

- The supported languages in Phase 1 are Python, TypeScript, JavaScript, Go, Java, and Rust.
- A function, a method, a class, an interface, and a type declaration each become one chunk.
- A node over `MAX_CHUNK_TOKENS` splits at its child nodes. A class keeps its signature line as a header on each part.
- Top-level code between declarations, such as imports and constants, joins into one chunk per file region. A region over `MAX_CHUNK_TOKENS` splits into parts of that size.
- A Markdown file splits at its headings. A section over `MAX_CHUNK_TOKENS` splits into parts of that size. Other files use 60-line windows with a 10-line overlap. A window over that token cap splits the same way.
- Each chunk holds:
  - `id` (`<indexId>:<seq>`), `path`, `language`, `symbol`, `kind`, `startLine`, and `endLine`
  - `content`: the source lines
  - `header`: the path and the enclosing symbol. The embedding input is `title: <header> | text: <content>`.
  - `identifiers`: each identifier in the chunk, plus its parts. `getUserById` gives `get user by id`.

### Tier 5: Data stores

**D1** holds the rows. Drizzle defines the schema in `packages/db`. The SQL lives in `infra/migrations`. No foreign key cascades. `IndexDeletion` deletes the chunk rows in pages.

- `github_repositories` — id, owner, name, default branch, created time, updated time
  - The id is the numeric GitHub repository id. The index id and the vector id hold it, and Vectorize limits both to 64 bytes. A UUID makes the vector id 78 bytes or more.
- `repository_indexes` — id, repository id, commit sha, status, failed stage, failure reason, file count, chunk count, embedding model id, created time, updated time, ready time, last question time
  - The status is one of `queued`, `parsing`, `embedding`, `ready`, `failed`, and `deleting`.
- `source_chunks` — id, index id, sequence number, path, language, symbol, kind, start line, end line, content, identifiers
- `chunk_keywords` — an FTS5 table over `source_chunks`. Phase 3.
- `answered_questions` — id, index id, repository full name, commit sha, preset, question, answer, citations, embedding model id, answer model id, input tokens, output tokens, retrieval time, first token time, answer time, created time
  - The id is a random 128-bit value, so nobody can guess a share link.
  - `index_id` has no foreign key, so the row outlives its index.
  - `citations` is JSON. It copies each cited chunk: the path, the line range, the symbol, the code, and the GitHub link. Phase 3 adds the confidence label. The share page reads only this row, so it works after the cleanup deletes the index.

The FTS5 table uses `tokenize = "unicode61 tokenchars '_'"`, so `snake_case` names stay whole. It indexes three columns: `index_id`, `content`, and `identifiers`. Each match expression starts with the index id, so a query reads one index.

D1 stops at 10 GB for one database. The 30-day cleanup keeps the chunk text under that limit. Measure the size on staging.

**Vectorize** holds one vector for each chunk.

- The namespace is the index id. A query reads one namespace.
- The vector id is the chunk id, `<indexId>:<chunkSeq>`. Vectorize limits an id to 64 bytes.
- The metadata holds `path`, `language`, and `kind`. Create the metadata indexes before the first insert.
- Vectorize indexes only the first 64 bytes of a metadata value. A path filter longer than that becomes a filter after the query.
- The dimension of an index is fixed. A new embedding model needs a new Vectorize index and a full re-index.
- An upsert is asynchronous. A vector is searchable only after Vectorize processes the mutation.

**R2** holds the chunk batches of an index job, and the eval reports from Phase 4. The Workflow deletes the batches after the `ready` step or after a failure.

### Tier 6: Models

AI Gateway fronts each model call. It records the model id, the tokens, and the latency for the `answered_questions` row.

- **Embeddings.** Phase 1 starts with the Workers AI model `@cf/google/embeddinggemma-2`. It covers code, gives 768 dimensions, and has an 8,192-token context window.
  - The model id is the constant `EMBEDDING_MODEL_ID` in `packages/domain`, not a Worker var. The gateway and the pipeline must use the same model, and the Vectorize dimension depends on it.
  - The model expects task prefixes. A question becomes `task: search result | query: <question>`. A chunk uses the `title` and `text` form in the chunk rules.
  - One request allows 8,192 tokens. That limit is the sum of every text in the request. `EMBED_BATCH_SIZE` is 1, so one chunk at the 1,500-token cap stays under that limit. `EMBED_CONCURRENCY` is 10, so ten calls run at the same time.
  - Phase 3 compares it with `voyage-code-3` and `text-embedding-3-small` through AI Gateway. Each candidate fits the Vectorize limit of 1536 dimensions.
- **Reranker.** Phase 3 starts with Workers AI `bge-reranker-base`. The ablation compares it with Cohere Rerank through AI Gateway.
- **Answer model.** OpenRouter model `anthropic/claude-haiku-5.5`, through the AI Gateway OpenRouter route. Stream the tokens. Temperature 0. The Worker var is `ANSWER_MODEL_ID`. The gateway calls it with `fetch`, with no SDK.
  - Set `reasoning.effort` to `none`. Thinking is on by default. Thinking tokens delay the first answer token and add to the output bill.
  - OpenRouter lists this model at $0.10 per million input tokens and $0.50 per million output tokens, as of November 2026.
  - Prefer the Anthropic route. Its p50 latency is 0.88 seconds. The Bedrock route is 2.44 seconds, and that route can miss the 3-second first-token target.
  - `openai/gpt-6-luna` has the same list price. Its standard routes are slower, at about 2.6 to 3.2 seconds. `google/gemini-3.7-flash` scores higher and costs $0.75 and $3.75 per million tokens. Swap `ANSWER_MODEL_ID` only after an eval.

### Tier 7: Evals (`apps/evals`)

Python 3.12, managed with uv. CI runs it against the staging gateway. Phase 2 decides whether `apps/indexer` and `apps/evals` share a uv workspace.

- `golden/<repo>.yaml` holds the repository, the commit, and each question with its kind and its ground-truth ranges.
  - The question kinds are `identifier`, `concept`, `architecture`, `start_here`, `feature`, and `out_of_repo`.
- The harness indexes each golden repository, asks each question with `debug=true`, and receives the retrieved chunk ids.
- Retrieval metrics are plain Python. They compare line ranges.
- Faithfulness and answer relevance use DeepEval with a judge model through AI Gateway.
- The report is JSON. The check compares it with `baseline.json`.

---

## 5. Request lifecycles

### Scenario A: The user indexes a repository

1. The browser posts the link and the Turnstile token to `POST /api/v1/indexes` on the gateway origin.
2. The gateway checks the limits, reads the head commit, and inserts the `repository_indexes` row.
3. The gateway creates the Workflow instance and returns `201` with the index view.
4. The browser moves to `/r/:owner/:repo?index=<indexId>` and polls `GET /api/v1/indexes/:id` every 2 seconds.
5. The Workflow runs the container, stores the chunks, embeds them, waits for Vectorize, and sets `ready`.
6. The browser opens the ask screen.

### Scenario B: The user asks a question

1. The gateway applies the hourly question limit and loads the index. It rejects an index that is not `ready`.
2. Phase 1: embed the question, then query Vectorize with `topK` 8 in the namespace of the index.
3. Phase 3: run the hybrid path instead.
   1. Embed the question. Query Vectorize with `topK` 8.
   2. When the question starts with "where is", move the chunk whose symbol equals the last name to position 1. A role word such as "function" or "decorator" is not a name.
   3. A later stage sends candidates to the reranker and keeps the top 8.
   4. Give each kept chunk a confidence label from its reranker score. Refer to the confidence rules below.
4. Load the chunk rows from D1 and send the `retrieval` event.
5. Build the prompt from the answer contract in the PRD.
   - For "Where do I start?", also load the distinct paths of the index from `source_chunks`, up to `START_HERE_MAX_PATHS`.
6. Stream the model tokens as `token` events. A model failure sends one `error` event and ends the stream.
7. Send `done` with the question id. Write the `answered_questions` row with `ctx.waitUntil`.

Vectorize returns 50 results at most when a query asks for metadata. That limit sets the top 50 of the hybrid path.

**Confidence rules.**

- The label uses a score from 0 to 1.
- The Workers AI output schema for `bge-reranker-base` documents `score` as a number with no range. The model page says a sigmoid maps the score to the range 0 to 1. Neither page states whether Workers AI applies that sigmoid.
- Before you set the thresholds, measure the score range:
  1. Run the reranker on 20 question and chunk pairs from the golden set.
  2. Record the lowest score and the highest score in `apps/evals/reranker-scores.md`.
  3. When a score is below 0 or above 1, the score is raw. Apply the sigmoid in the gateway.
  4. When every score is between 0 and 1, do not apply the sigmoid. A sigmoid on a scaled score squeezes each value into 0.5 to 0.73, and each label becomes medium.
- A unit test fixes that decision with the recorded scores, so a change in the model output fails the test.
- A score at `CONFIDENCE_HIGH` (0.7) or above is high. A score at `CONFIDENCE_MEDIUM` (0.3) or above is medium. A lower score is low.
- Both thresholds are starting values. Set them from the Phase 3 eval.
- The thresholds belong to one reranker model. A different reranker, such as Cohere Rerank, needs its own range check and its own thresholds.
- Phase 1 has no reranker, so a Phase 1 citation has no label.

### Scenario C: The default branch moves

1. A new request finds a new head commit. Scenario A runs for that commit.
2. Questions use the old index until the new index is `ready`. The status response names the old index in `fallbackIndexId`.
3. The last step of `RepositoryIndexing` starts one `IndexDeletion` for each earlier index of the repository:
   - Delete the vectors by id, in pages. The `source_chunks` rows supply the ids, so they go after the vectors.
   - Delete the `repository_indexes` row last.

The cleanup cron starts the same Workflow.

### Scenario D: The user traces a symbol (Phase 3)

1. The gateway applies the rate limit and loads the index.
2. It queries `chunk_keywords` for the symbol name in the `identifiers` column, in that index. The limit is 50 rows.
3. It splits the rows into two lists:
   - Definitions: rows where `source_chunks.symbol` equals the name
   - Usages: the other rows
4. It returns the definitions first, then the usages, each with the path, the line range, and the GitHub link.

The trace calls no model, so it costs no tokens.

### Scenario E: The user opens a shared answer

1. The browser loads `/a/:id`, then calls `GET /api/v1/questions/:id`.
2. The gateway reads the `answered_questions` row and returns the question, the answer, and the citations.
3. An unknown id returns `404`.

---

## 6. Security

- **Repository text is data.** The prompt wraps each chunk in tags after the rules. The answer contract tells the model to ignore an instruction inside a chunk. A unit test checks it in Phase 1. A golden case tests it from Phase 2.
- **No code runs.** The indexer parses files. It does not run a build, a script, or a package install.
- **Tarball safety.** The extract step rejects a path that leaves the target folder, and skips each symbolic link.
- **Abuse.** Turnstile and the `RateLimiter` Durable Object guard the gateway. The size limits guard the container.
- **CORS.** The gateway allows only the web origin. CORS does not stop a script outside a browser, so Turnstile and the rate limits stay the real guard.
- **Index scope.** The index id comes from the route. Each Vectorize query sets the namespace. Each D1 chunk query filters on the index id. Each FTS5 query starts with the index id.
- **Secrets.** `TURNSTILE_SECRET`, `GITHUB_TOKEN`, `OPENROUTER_API_KEY`, `CF_AIG_TOKEN`, and `EVAL_TOKEN` are gateway secrets. The answer request sends `CF_AIG_TOKEN` in `cf-aig-authorization`. `GITHUB_TOKEN`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are pipeline secrets. The pipeline passes its three secrets to the container as environment variables. The web Worker has no secret.

---

## 7. Deployment

One environment: staging. Each resource name is `repotron-staging-<role>`, such as `repotron-staging-db`.

- The CLI is `cf`. Each Worker config is `cloudflare.config.ts`. Do not add a Wrangler config.
- `.github/workflows/deploy-staging.yml` runs on a push to `develop` when the gateway, the pipeline, the indexer, a shared package, or the infra changes:
  1. Lint, type check, and test the TypeScript and the Python code.
  2. Apply the D1 migrations.
  3. Create each missing CI resource: the R2 bucket, the Vectorize index with its metadata indexes, and the AI Gateway.
  4. Deploy the pipeline, then the gateway. The gateway binds a Workflow of the pipeline. The pipeline deploy builds the indexer image, so the runner needs Docker.
- `.github/workflows/deploy-web.yml` runs on a push to `develop` when `apps/web`, `packages/domain`, or the lockfile changes. It checks the web package and deploys `repotron-staging-web`. A web-only change does not run the staging workflow.
- Phase 2: run `apps/evals` against staging. Fail on a regression. [phase-2-plan.md](phase-2-plan.md) holds the stages.
- Manual setup: the Cloudflare API token, the D1 database, the Turnstile widget, the GitHub token, the OpenRouter key, the R2 API keys, and the Worker secrets. Each one gives a value that goes into the code or into a secret. [phase-1-plan.md](phase-1-plan.md), section 7, gives the delivery stages and each manual step.

### Why these Cloudflare products

- **Workers** serve the API, and serve the web app as static assets, with no server to run.
- **Workflows** retry one step of a long index job. A finished step stays finished.
- **Containers** run Python and Tree-sitter with a disk and enough memory for a large repository.
- **D1** holds the rows and the FTS5 BM25 index.
- **Vectorize** holds the vectors, with one namespace for each index.
- **R2** carries the chunk batches from the container to the Workflow.
- **Workers AI** runs the embeddings and the reranker on Cloudflare.
- **AI Gateway** routes the answer call to OpenRouter. It records the model id, the tokens, and the latency of each call.
- **Turnstile** and a **Durable Object** counter limit the cost of each anonymous user.

---

## 8. Repository layout

[phase-1-plan.md](phase-1-plan.md), section 4, holds the full Phase 1 tree.

```text
repotron/
├── .cursor/rules/               # repotron.mdc and repotron-rule-maintenance.mdc
├── .github/workflows/deploy-staging.yml
├── .github/workflows/deploy-web.yml
├── .husky/pre-commit
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml          # apps/* and packages/*
├── turbo.json
├── drizzle.config.ts
├── scripts/                     # migration journal sync, R2 bucket check
├── docs/
├── apps/
│   ├── web/                     # React + Vite. Assets-only Worker. fixtures/ serves the API on the dev server.
│   ├── gateway/                 # Public API Worker. Hono. RateLimiter.
│   ├── pipeline/                # Private Worker. Workflows, Container class, cron.
│   ├── indexer/                 # Python. uv project, Dockerfile, FastAPI, Tree-sitter.
│   └── evals/                   # Python. Golden set, metrics, baseline.json. Phase 2.
├── packages/
│   ├── db/                      # Drizzle schema and repositories for D1
│   ├── domain/                  # repotron-domain: Zod schemas, chunk shape, constants
│   └── log/
└── infra/
    └── migrations/              # D1 SQL
```

`packages/domain` holds the Phase 1 constants. Examples: `MAX_CHUNK_TOKENS` (1,500, a starting value), `CONTEXT_CHUNKS` (8), `EMBED_BATCH_SIZE` (1), `EMBED_CONCURRENCY` (10), `START_HERE_MAX_PATHS` (500), and `EMBEDDING_MODEL_ID`. Phase 3 adds `RRF_K` (60), `RETRIEVAL_TOP_K` (50), `CONFIDENCE_HIGH` (0.7), and `CONFIDENCE_MEDIUM` (0.3).

`MAX_CHUNK_TOKENS` keeps the header and the content under the 8,192-token window of the embedding model. `tiktoken` counts tokens differently from the Gemma tokenizer, so the value leaves a margin.

The Python indexer reads the chunk shape from a JSON Schema that `packages/domain` exports, so both languages use one contract.
