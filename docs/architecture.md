# System Architecture Document: Repotron

## 1. Summary

Repotron runs on Cloudflare. Two TypeScript Workers and one Python container do the work.

- `apps/gateway` is the public Worker. It serves the web app, starts an index job, and answers questions.
- `apps/pipeline` is the private Worker. It runs the index Workflow, owns the indexer container, and runs the cleanup cron.
- `apps/indexer` is a Python service in a Cloudflare Container. It downloads the repository, parses it with Tree-sitter, and writes chunks to R2.
- `apps/evals` is a Python harness. CI runs it. The deploy set omits it.

Python runs where the work needs it: parsing and evaluation. Parsing a large repository needs a disk, gigabytes of memory, and minutes of CPU time. A Worker request has none of the three. The Workers use TypeScript, because the `@cloudflare/containers` package and the Hono, Drizzle, and `cf` stack are TypeScript.

---

## 2. Topology

```text
[ Browser ]
    │  HTTPS, one origin
    ▼
[ apps/gateway · Worker ]
  ├── Static assets from apps/web
  ├── POST /v1/indexes           Turnstile, rate limit, GitHub check
  ├── GET  /v1/indexes/:id        status
  ├── POST /v1/indexes/:id/questions   retrieve, rerank, stream answer
  ├── GET  /v1/questions/:id      shared answer
  ├── GET  /v1/indexes/:id/symbols/:name   symbol trace · Phase 3
  └── GET  /v1/evals              dashboard data · Phase 4
    │
    │  Workflow binding
    ▼
[ apps/pipeline · Worker ]
  ├── IndexRepository Workflow   one repository at one commit
  ├── Indexer Container class    one instance per index job
  └── Cron                       delete stale indexes
    │
    ▼
[ apps/indexer · Python container ]
  fetch tarball → walk files → Tree-sitter → chunks → R2

Shared stores
  ├── [ D1 ]          repositories, indexes, chunks, chunks_fts, questions
  ├── [ Vectorize ]   one namespace per index
  ├── [ R2 ]          chunk batches, eval reports
  ├── [ Workers AI ]  embeddings, reranker
  └── [ AI Gateway ]  each model call
```

---

## 3. Components

### Tier 1: Web app (`apps/web`)

React and Vite. The gateway serves the build as static assets.

- `/` holds the link box and Turnstile.
- `/r/:owner/:repo` shows the status, then the ask screen.
- `/a/:id` shows one shared answer.
- `/dashboard` shows the eval chart. Phase 4.

The ask screen reads the answer stream with `fetch` and a stream reader. The citation panel renders the `retrieval` event before the first token.

### Tier 2: Public Worker (`apps/gateway`)

Hono. One controller for each route group.

**Index request.**

1. Verify the Turnstile token. Apply the rate limit binding for the IP address.
2. Parse the link. Call `GET /repos/{owner}/{repo}` on the GitHub API with the server token.
3. Reject a private repository, a missing repository, and a repository over the size limit.
4. Read the head commit of the default branch.
5. When `indexes` has a row for that repository and commit, return it.
6. Otherwise insert the row as `queued`, and create an `IndexRepository` instance with the id `<repositoryId>-<sha>`. A duplicate id fails on create. Treat that error as done.

**Question.** Refer to section 4, Scenario B.

### Tier 3: Private Worker (`apps/pipeline`)

**`IndexRepository` Workflow.** Each step does one side effect and retries on its own.

1. Set the status to `parsing`.
2. Start the container for this index. Call `POST /index` with the owner, the repository, the commit, and the index id. Wait for the batch list.
3. Stop the container with `destroy()`. The batches are in R2, so the later steps do not need it.
4. Set the status to `embedding`.
5. For each batch key, run one step:
   - Read the JSONL batch from R2.
   - Insert the chunks into D1 in one batch statement.
   - Embed the chunk text with the embedding model.
   - Upsert the vectors into the namespace of the index.
6. Set the status to `ready`, with the file count and the chunk count.
7. Delete the earlier index of the same repository. Refer to Scenario C.

A failed step after its retries sets the status to `failed`, with the stage and the reason.

**Indexer Container class.** It extends `Container` from `@cloudflare/containers`. The Durable Object id is the index id, so one job owns one container. The starting instance type is `standard-2`: 1 vCPU, 6 GiB memory, and 12 GB disk.

Cloudflare bills memory and disk for each second that the container is awake, including idle time. So the Workflow stops the container as soon as the parse ends. The sleep timeout is 1 minute. That timeout stops a container that step 3 did not reach, such as after a failed parse.

**Cron.** Once each day, it deletes each index with no question for 30 days.

### Tier 4: Python indexer (`apps/indexer`)

Python 3.12, managed with uv. The image holds FastAPI, `tree-sitter`, `tree-sitter-language-pack`, `httpx`, `tiktoken`, and `boto3` for the R2 S3 API.

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
- Top-level code between declarations, such as imports and constants, joins into one chunk per file region.
- A Markdown file splits at its headings. Other files use 60-line windows with a 10-line overlap.
- Each chunk holds:
  - `path`, `language`, `symbol`, `kind`, `startLine`, and `endLine`
  - `content`: the source lines
  - `header`: the path and the enclosing symbol. The embedding input is the header plus the content.
  - `identifiers`: each identifier in the chunk, plus its parts. `getUserById` gives `get user by id`.

### Tier 5: Data stores

**D1** holds the rows. Drizzle defines the schema in `packages/db`. The SQL lives in `infra/migrations`.

- `repositories` — id, owner, name, default branch, created time
- `indexes` — id, repository id, commit sha, status, stage, error, file count, chunk count, embedding model id, created time, ready time, last question time
- `chunks` — id, index id, path, language, symbol, kind, start line, end line, content, identifiers
- `chunks_fts` — an FTS5 table over `chunks`. Phase 3.
- `questions` — id, index id, repository full name, commit sha, preset, question, answer, citations, model ids, input tokens, output tokens, latency of each stage, created time
  - The id is a random 128-bit value, so nobody can guess a share link.
  - `citations` is JSON. It copies each cited chunk: the path, the line range, the symbol, the code, and the confidence label. The share page reads only this row, so it works after the cleanup deletes the index.

The FTS5 table uses `tokenize = "unicode61 tokenchars '_'"`, so `snake_case` names stay whole. It indexes three columns: `index_id`, `content`, and `identifiers`. Each match expression starts with the index id, so a query reads one index.

D1 stops at 10 GB for one database. The 30-day cleanup keeps the chunk text under that limit. Measure the size on staging.

**Vectorize** holds one vector for each chunk.

- The namespace is the index id. A query reads one namespace.
- The vector id is `<indexId>:<chunkSeq>`. Vectorize limits an id to 64 bytes.
- The metadata holds `path`, `language`, and `kind`. Create the metadata indexes before the first insert.
- Vectorize indexes only the first 64 bytes of a metadata value. A path filter longer than that becomes a filter after the query.
- The dimension of an index is fixed. A new embedding model needs a new Vectorize index and a full re-index.

**R2** holds the chunk batches of an index job, and the eval reports from Phase 4. The Workflow deletes the batches after the `ready` step.

### Tier 6: Models

AI Gateway fronts each model call. It records the model id, the tokens, and the latency for the `questions` row. Each model id is a Worker var.

- **Embeddings.** Phase 1 starts with a Workers AI embedding model that covers code, such as `embeddinggemma-2`. Phase 3 compares it with `voyage-code-3` and `text-embedding-3-small` through AI Gateway. Each candidate fits the Vectorize limit of 1536 dimensions.
- **Reranker.** Phase 3 starts with Workers AI `bge-reranker-base`. The ablation compares it with Cohere Rerank through AI Gateway.
- **Answer model.** One chat model with streaming. Temperature 0.

### Tier 7: Evals (`apps/evals`)

Python 3.12, managed with uv. CI runs it against the staging gateway.

- `golden/<repo>.yaml` holds the repository, the commit, and each question with its kind and its ground-truth ranges.
  - The question kinds are `identifier`, `concept`, `architecture`, `start_here`, `feature`, and `out_of_repo`.
- The harness indexes each golden repository, asks each question with `debug=true`, and receives the retrieved chunk ids.
- Retrieval metrics are plain Python. They compare line ranges.
- Faithfulness and answer relevance use DeepEval with a judge model through AI Gateway.
- The report is JSON. The check compares it with `baseline.json`.

---

## 4. Request lifecycles

### Scenario A: The user indexes a repository

1. The browser posts the link and the Turnstile token to `POST /v1/indexes`.
2. The gateway checks the limits, reads the head commit, and inserts the `indexes` row.
3. The gateway creates the Workflow instance and returns `201` with the index id.
4. The browser polls `GET /v1/indexes/:id` every 2 seconds.
5. The Workflow runs the container, stores the chunks, embeds them, and sets `ready`.
6. The browser opens the ask screen.

### Scenario B: The user asks a question

1. The gateway applies the rate limit and loads the index. It rejects an index that is not `ready`.
2. Phase 1: embed the question, then query Vectorize with `topK` 8 in the namespace of the index.
3. Phase 3: run the hybrid path instead.
   1. Embed the question. Query Vectorize with `topK` 50 and the scope filters.
   2. Query `chunks_fts` with BM25 for the top 50. Quote each term of the question and join the terms with `OR`.
   3. Fuse the two lists with RRF: `score(chunk) = Σ 1 / (60 + rank)`, one term for each list.
   4. Send the top 50 fused chunks to the reranker. Keep the top 8.
   5. Give each kept chunk a confidence label from its reranker score. Refer to the confidence rules below.
4. Load the chunk rows from D1 and send the `retrieval` event.
5. Build the prompt from the answer contract in the PRD.
   - For "Where do I start?", also load the distinct paths of the index from `chunks`, up to `START_HERE_MAX_PATHS`.
6. Stream the model tokens as `token` events.
7. Send `done` with the question id. Write the `questions` row with `ctx.waitUntil`.

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
2. Questions use the old index until the new index is `ready`.
3. The last Workflow step deletes the old index:
   - Delete the vectors by id, in batches. The `chunks` rows supply the ids, so they go last.
   - Delete the `chunks` rows and the `indexes` row.

The cleanup cron uses the same delete steps.

### Scenario D: The user traces a symbol (Phase 3)

1. The gateway applies the rate limit and loads the index.
2. It queries `chunks_fts` for the symbol name in the `identifiers` column, in that index. The limit is 50 rows.
3. It splits the rows into two lists:
   - Definitions: rows where `chunks.symbol` equals the name
   - Usages: the other rows
4. It returns the definitions first, then the usages, each with the path, the line range, and the GitHub link.

The trace calls no model, so it costs no tokens.

### Scenario E: The user opens a shared answer

1. The browser loads `/a/:id`, then calls `GET /v1/questions/:id`.
2. The gateway reads the `questions` row and returns the question, the answer, and the citations.
3. An unknown id returns `404`.
---

## 5. Security

- **Repository text is data.** The prompt marks each chunk as data. The answer contract tells the model to ignore an instruction inside a chunk. A golden case tests it.
- **No code runs.** The indexer parses files. It does not run a build, a script, or a package install.
- **Tarball safety.** The extract step rejects a path that leaves the target folder, and a symbolic link.
- **Abuse.** Turnstile and the rate limit binding guard the gateway. The size limits guard the container.
- **Index scope.** The index id comes from the route. Each Vectorize query sets the namespace. Each FTS5 query starts with the index id.
- **Secrets.** `GITHUB_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `TURNSTILE_SECRET`, and the model keys are Worker secrets. The pipeline passes the R2 keys and the GitHub token to the container as environment variables.

---

## 6. Deployment

One environment: staging. Each resource name is `repotron-staging-<role>`, such as `repotron-staging-db`.

- The CLI is `cf`. Each Worker config is `cloudflare.config.ts`. Do not add a Wrangler config.
- `.github/workflows/deploy-staging.yml` runs on each push to `develop`:
  1. Lint, type check, and test the TypeScript and the Python code.
  2. Apply the D1 migrations.
  3. Deploy the gateway and the pipeline. The pipeline deploy builds the indexer image, so the runner needs Docker.
  4. Phase 2: run `apps/evals` against staging. Fail on a regression.
- One-time setup: the Cloudflare API token, the Vectorize index with its metadata indexes, the R2 API keys, the Turnstile site, and the GitHub token.

### Why these Cloudflare products

- **Workers** serve the API and the web app with no server to run.
- **Workflows** retry one step of a long index job. A finished step stays finished.
- **Containers** run Python and Tree-sitter with a disk and enough memory for a large repository.
- **D1** holds the rows and the FTS5 BM25 index.
- **Vectorize** holds the vectors, with one namespace for each index.
- **R2** carries the chunk batches from the container to the Workflow.
- **Workers AI** runs the embeddings and the reranker on Cloudflare.
- **AI Gateway** records the model id, the tokens, and the latency of each call.
- **Turnstile** and the **rate limit binding** limit the cost of each anonymous user.

---

## 7. Repository layout

```text
repotron/
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml          # apps/* and packages/*
├── turbo.json
├── pyproject.toml               # uv workspace: apps/indexer, apps/evals
├── .github/workflows/deploy-staging.yml
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   └── features.md
├── apps/
│   ├── web/                     # React + Vite
│   ├── gateway/                 # Public Worker. Hono.
│   ├── pipeline/                # Private Worker. Workflow, Container class, cron.
│   ├── indexer/                 # Python. Dockerfile, FastAPI, Tree-sitter.
│   └── evals/                   # Python. Golden set, metrics, baseline.json.
├── packages/
│   ├── db/                      # Drizzle schema for D1
│   ├── domain/                  # Zod schemas, chunk shape, retrieval constants
│   └── log/
└── infra/
    └── migrations/              # D1 SQL
```

`packages/domain` holds `MAX_CHUNK_TOKENS`, `RRF_K` (60), `RETRIEVAL_TOP_K` (50), `CONTEXT_CHUNKS` (8), `CONFIDENCE_HIGH` (0.7), `CONFIDENCE_MEDIUM` (0.3), and `START_HERE_MAX_PATHS` (500). The Python indexer reads the chunk shape from a JSON Schema that `packages/domain` exports, so both languages use one contract.
