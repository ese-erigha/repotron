# Phase 3 implementation plan: Hybrid retrieval

This plan turns Phase 3 of [prd.md](prd.md) into work that one implementer can do in order. It names the search path, the screen changes, and the checks. It contains no application code.

Do not implement the stages in one pull request. A red eval would not say which stage failed. The reranker thresholds are unknown until they are measured. The FTS table must exist on staging before a question reads it.

**Read first, in this order:**

1. `.cursor/rules/repotron.mdc` — the standing rules. They win over this plan when the two disagree.
2. [prd.md](prd.md) — Epic 5 holds the stories. Section 6 holds the metric names.
3. [architecture.md](architecture.md) — Scenario B holds the hybrid path. Scenario D holds the symbol trace. The confidence rules sit under Scenario B.
4. [features.md](features.md) — F-12 to F-16, F-21, and F-22.
5. [phase-2-plan.md](phase-2-plan.md) — the eval gate. This phase does not replace it.
6. This file. Section 3 lists the approved decisions.

**Ground rules for the implementer:**

- Every test of the live gateway runs on staging. Do not run `cf dev` or a `--local` command.
- Do not deploy, merge, or apply a migration. A push to `develop` deploys when the paths in `deploy-staging.yml` change.
- A SQL file goes under `infra/migrations`. Run `pnpm db:sync`. CI applies it. Do not apply it locally.
- A unit test calls no Cloudflare API, no GitHub API, and no OpenRouter API. It uses fixture files.
- Section 8 gives the delivery stages in order. Each stage is one pull request to `develop`.
- The required `eval` check stays on. A stage that changes `apps/gateway`, `packages/domain`, or `packages/db` runs the 30 questions against that pull request's preview Worker.
- Do not edit `baseline.json` by hand. A real gain updates it in a later pull request that states the new scores.
- Do not set `CONTEXT_CHUNKS` to 1. That change is the proof that the gate fails.

---

## 1. Scope

**In scope.** Epic 5 of [prd.md](prd.md), and F-12 to F-16, F-21, and F-22 of [features.md](features.md):

- US-5.1 — an identifier question finds the definition. Hybrid search beats dense search on identifier hit@1.
- US-5.2 — keyword results and vector results combine.
- US-5.3 — the top 50 fused chunks are reranked. The model receives the top 8.
- US-5.4 — a question can name a language or a path prefix.
- US-5.5 — one report shows dense, BM25, hybrid, and hybrid with rerank on the same golden set.
- US-5.6 — each citation shows high, medium, or low from the reranker score.
- US-5.7 — a symbol trace lists definitions, then usages, and calls no model.

**Out of scope.**

- A new embedding model. `voyage-code-3` and `text-embedding-3-small` need a new Vectorize index and a re-index of the pinned commits. The home page indexes the tip of the default branch, not a chosen SHA.
- A new answer model.
- A change to chunking or to `CONTEXT_CHUNKS`.
- The public dashboard and storing reports in R2 (Phase 4).

---

## 2. System at a glance

Phase 2 already scores the golden set against a preview of the pull request's gateway. Phase 3 changes what that gateway retrieves. The six gate scores stay the same. The production path changes only in the stage that names the change.

```text
Question
  embed the question
  Vectorize top 8 in the index namespace
  when the question starts with "where is", move the chunk whose symbol is the last name to the front
  rerank the top 50
  keep the top 8
  label each kept chunk
  send the retrieval event and stream the answer

Symbol trace
  BM25 on the identifiers column
  definitions first, then usages
  no model call
```

Until the rerank stage, the model still receives the vector top 8. A question that starts with "where is" moves the chunk whose symbol equals the last name to position 1. A role word such as "function" or "decorator" is not a name. The chunk set stays the vector set.

---

## 3. Decisions

These eight decisions were accepted on November 18, 2026. An implementer follows them. A change to one of them needs a new acceptance before the stage that uses it starts.

### Decision A: The golden set and the gate stay

The 30 questions in `apps/evals/golden/*.yaml` stay the gate. The other 30 stay in `golden/hold/`. The check still fails when one of the six scores drops by more than 0.02 from `baseline.json`.

Identifier hit@1 is a new printed number. It is the share of identifier questions whose first retrieved chunk overlaps a ground-truth range. It does not fail the gate. The stage that turns hybrid search on records the dense number first, then shows that hybrid search beats it.

### Decision B: One index id, two searches

The index id still comes from the route. It never comes from the question text.

- Vectorize keeps the namespace equal to the index id. The candidate query asks for 50 matches.
- `chunk_keywords` holds `chunk_id` and `index_id` as UNINDEXED columns, plus `content` and `identifiers`. The index id contains hyphens. The tokenizer would split those hyphens, so the id is not part of the MATCH text. The WHERE clause filters `index_id`.
- The tokenizer is `unicode61` with `tokenchars '_'`, so a snake_case name stays one token.
- The MATCH text quotes each question term and joins the terms with `OR`. A closed-class word, such as `where` or `the`, is not a term. The same splitter that writes identifiers splits the question, so `getUserById` also searches `get`, `user`, and `id`.

### Decision C: The table follows the chunk rows

Phase 3 adds one table, `chunk_keywords`. It adds no column to `source_chunks` or to `answered_questions`. The confidence label stays inside the citation JSON that `answered_questions` already stores.

`chunk_keywords` is an FTS5 table. `chunk_id` and `index_id` are stored and are not searchable. `content` and `identifiers` are searchable.

```sql
CREATE VIRTUAL TABLE chunk_keywords USING fts5(
  chunk_id UNINDEXED,
  index_id UNINDEXED,
  content,
  identifiers,
  tokenize = "unicode61 tokenchars '_'"
);
```

- `chunk_id` copies `source_chunks.id`.
- `index_id` copies `source_chunks.index_id`. A query filters this column in the WHERE clause.
- `content` copies `source_chunks.content`.
- `identifiers` copies `source_chunks.identifiers`.

The migration creates this table, the insert trigger, the delete trigger, and one backfill from `source_chunks`. The application does not write the FTS table itself. A new chunk row inserts one FTS row. Deleting the chunk row deletes the FTS row.

The backfill covers the three golden indexes that are already `ready`. A question must not depend on a re-index.

### Decision D: A where-is question promotes the named symbol

The question path keeps the vector top 8. When the question starts with "where is", the chunk whose symbol equals the last name moves to position 1. The last name in "Where is the object schema function defined?" is `object`, because `schema`, `function`, and `defined` are role words. When no chunk has that symbol, the vector order stays. The chunk set does not change.

`fuseRanks` still computes `score(chunk) = Σ 1 / (60 + rank)`. Rank starts at 1. `RRF_K` is 60. `RETRIEVAL_TOP_K` is 50. The question path does not use that score to choose the 8.

### Decision E: The reranker is measured before it serves traffic

The model is Workers AI `bge-reranker-base`. The score range is unknown. Before any label ships:

1. Run the reranker on 20 question and chunk pairs from the golden set.
2. Record the lowest score and the highest score in `apps/evals/reranker-scores.md`.
3. When a score is below 0 or above 1, the score is raw. Apply the sigmoid in the gateway.
4. When every score is between 0 and 1, do not apply the sigmoid.

A score at `CONFIDENCE_HIGH` (0.7) or above is high. A score at `CONFIDENCE_MEDIUM` (0.3) or above is medium. A lower score is low. Both thresholds are starting values in `packages/domain`. A unit test uses the recorded scores, so a change in the model output fails the test.

The label is stored in the citation JSON on `answered_questions`. The share page reads that row. It does not load the index.

### Decision F: The ablation is a manual run

The question route accepts `retrieval=dense`, `retrieval=bm25`, `retrieval=hybrid`, or `retrieval=rerank` only when the eval token matches. A missing value uses the production path. The required pull request check uses the production path and the 30 questions once.

The ablation run is `workflow_dispatch`. It asks the 30 questions four times and writes `apps/evals/ablation.json`. That file is committed in its own pull request. A normal pull request does not run the four paths.

### Decision G: Scope is optional and absent from the golden questions

The ask form gains two optional fields: language, and path prefix. The question body carries them. Golden questions send neither field.

Vectorize uses its metadata filter when the value fits in 64 bytes. A longer path prefix is applied after the query, on the D1 rows. BM25 results are filtered on `source_chunks.language` and `source_chunks.path` after the id list returns.

### Decision H: A trace spends one question from the hourly limit

`GET /api/v1/indexes/:id/symbols/:name` applies the question rate limit. The eval token does not apply to this route.

The query reads `chunk_keywords` for that symbol in that index. The limit is 50 rows. Definitions are rows whose `source_chunks.symbol` equals the name. Usages are the other rows. The response lists definitions first. Each item has the path, the line range, and the GitHub link at the index commit. The route calls no model.

---

## 4. What stays

- The embedding model stays `@cf/google/embeddinggemma-2`.
- The answer model stays `anthropic/claude-haiku-5.5`.
- `CONTEXT_CHUNKS` stays 8.
- The preview Worker name stays `repotron-pr-<number>-gateway`. The rate limiter stays on `repotron-staging-gateway`.
- The six gate scores stay the failing scores. Latency and cost stay printed numbers. Retrieval p95 under 800 ms is a staging check for the rerank stage. It does not become a seventh failing score.

---

## 5. Delivery stages

### Stage 1: Print identifier hit@1

**Status.** The harness prints `identifierHitAt1` beside the six scores. It does not fail the gate. The dense number is recorded here after the manual Eval run.

identifierHitAt1: 0.5

The production path stays dense.

- Compute hit@1 from the retrieval event the harness already reads.
- Print it next to the six scores. Do not add it to `failing_scores`.
- **Staging check:** one manual Eval run prints a hit@1 for the dense path. Record that number in the stage status of this file after the run. That number is the dense baseline.

### Stage 2: Add the FTS table

**Status.** The SQL file creates `chunk_keywords`, the triggers, and the backfill. The question path does not read the table yet. The row-count check waits until CI applies the migration.

- Add the SQL file. It creates `chunk_keywords`, the insert trigger, the delete trigger, and the backfill.
- Update the Drizzle schema by hand so it matches the SQL.
- Run `pnpm db:sync`.
- `IndexDeletion` still deletes `source_chunks`. The delete trigger removes the FTS rows.
- The question path does not read the table yet.
- **Staging check:** after CI applies the migration, the FTS row count for one golden index equals the `source_chunks` count for that index.

### Stage 3: Add BM25 behind the eval flag

**Status.** `retrieval=bm25` runs the keyword query only when the eval token matches. A normal question still uses vector search. The staging check is one identifier question with that flag.

The production path stays dense.

- Add a repository method that runs one BM25 query for an index id and a term list. The limit is 50.
- Honor `retrieval=bm25` only for a matching eval token.
- Unit test: the MATCH text for `getUserById` contains the split parts, and the index id is a bound parameter, not a piece of the MATCH text.
- **Staging check:** one identifier question with `retrieval=bm25` returns a chunk whose path is the ground-truth path. The required eval check stays green, because the production path is still dense.

### Stage 4: Turn on hybrid search

**Status.** A normal question uses the vector top 8. A question that starts with "where is" moves the chunk whose symbol equals the last name to position 1. The eval token can still request `retrieval=dense` or `retrieval=bm25`. Do not merge unless identifier hit@1 is above 0.5.

- Give the model the vector top 8.
- Move the named symbol to position 1 when the question starts with "where is".
- Leave the chunk set unchanged.
- This is the production path.
- **Staging check:** the required eval check is green. The printed identifier hit@1 is higher than the dense number from stage 1. When hit@1 is not higher, do not merge.

### Stage 5: Measure the reranker

The production path stays hybrid without rerank.

- Call `bge-reranker-base` on 20 golden pairs.
- Write `apps/evals/reranker-scores.md` with the low score, the high score, and the sigmoid decision.
- Add the unit test that freezes that decision.
- **Staging check:** the required eval check is green. The markdown file is in the pull request.

### Stage 6: Turn on rerank and the labels

- Rerank the top 50 fused chunks. Keep 8.
- Attach high, medium, or low to each citation in the retrieval event and in the saved citation JSON.
- Show the label on the citation panel and on the share page.
- **Staging check:** the required eval check is green. Context precision is higher than the hybrid-only number from stage 4. The printed retrieval p95 is under 800 ms. High citations overlap the ground truth more often than low citations. When one of those three checks fails, do not merge.

### Stage 7: Add scope filters

- Add the language field and the path prefix field to the ask form and to the question schema.
- Apply Decision G.
- Golden questions stay unscoped.
- **Staging check:** the required eval check is green. One staged question with a path prefix returns only chunks under that prefix.

### Stage 8: Add the symbol trace

- Add `GET /api/v1/indexes/:id/symbols/:name`.
- Add the trace box on the ask screen.
- Unit test: definitions come before usages, and the route does not call the model client.
- **Staging check:** a trace of one golden identifier lists its definition first. The required eval check is green.

### Stage 9: Commit the ablation report

- Run the Eval workflow by hand four times, once for each `retrieval` value, or one workflow that loops the four values.
- Commit `apps/evals/ablation.json`.
- **Staging check:** the file contains dense, BM25, hybrid, and hybrid with rerank. Hybrid with rerank has the highest context precision of the four. This pull request does not change the production path.

---

## 6. Risks

- **An empty FTS table.** A question that runs BM25 before the backfill returns no keyword hits. Hybrid search then leans on vectors only, and identifier hit@1 does not move. Stage 2 finishes the backfill before stage 3 reads the table.
- **The gate and the new metric.** A hybrid change can raise hit@1 and still drop recall by more than 0.02. The required check fails. Fix the ranking or revert the stage. Do not widen the gate.
- **Reranker latency.** Fifty pairs can push retrieval p95 over 800 ms. Stage 6 does not merge when the printed p95 is over that target.
- **Judge noise.** Faithfulness and answer relevance can move by more than 0.02 on one run. The same rule as Phase 2 applies. When the same commit fails twice on judge scores alone, rerun the workflow once and record both reports.
- **A new embedding model.** It is out of this plan. Shipping it beside the reranker would mix a new vector space with a new ranker.

---

## 7. Secrets

No new secret. The reranker uses the Workers AI binding. That binding is already on the gateway. The preview deploy already sends the gateway secrets.
