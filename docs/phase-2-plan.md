# Phase 2 implementation plan: Eval gate

This plan turns Phase 2 of [prd.md](prd.md) into work that one implementer can do in order. It names the golden set, the metrics, the gateway change, and the CI check. It contains no application code.

**Read first, in this order:**

1. `.cursor/rules/repotron.mdc` — the standing rules. They win over this plan when the two disagree.
2. [prd.md](prd.md) — section 6 holds the metric names. Epic 4 holds the stories.
3. [architecture.md](architecture.md) — Tier 7 holds the harness shape.
4. [features.md](features.md) — F-9, F-10, and F-11.
5. This file. Section 3 lists the approved decisions.

**Ground rules for the implementer:**

- Every test of the live gateway runs on staging. Do not run `cf dev` or a `--local` command.
- Do not deploy, merge, or apply a migration. A push to `develop` deploys the gateway when gateway paths change.
- `apps/evals` is not a Worker. CI runs it. No workflow deploys it.
- A unit test calls no Cloudflare API, no GitHub API, and no OpenRouter API. It uses fixture files.
- Section 8 gives the delivery stages in order. Each stage is one pull request to `develop`.

---

## 1. Scope

**In scope.** Epic 4 of [prd.md](prd.md), and F-9 to F-11 of [features.md](features.md):

- US-4.1 — a versioned golden set with ground-truth line ranges
- US-4.2 — a pull request reports the metrics of [prd.md](prd.md), section 6
- US-4.3 — the check fails when a quality score drops more than 2 percentage points below the baseline
- The saved question row keeps the chunks retrieval returned, including chunks the answer did not cite

**Out of scope.**

- BM25, RRF, the reranker, scope filters, confidence labels, and the symbol trace (Phase 3)
- The public dashboard and storing reports in R2 (Phase 4)
- A change to chunking, the embedding model, or `CONTEXT_CHUNKS`
- A new screen. The web app stays as it is.

---

## 2. System at a glance

Phase 1 already indexes a repository and answers a question. Phase 2 adds a Python harness that calls that staging gateway and scores the result.

```text
One-time setup
  Index the 3 golden commits on staging through the home page
  Record each index id in the golden file

Pull request
  eval.yml
      read golden/*.yaml
      for each question, one at a time:
          POST /api/v1/indexes/:id/questions?debug=true
          header x-repotron-eval-token
          read the retrieval event, the token events, and the done event
      score retrieval in plain Python
      score the answer with a judge through AI Gateway
      write report.json
      compare quality scores with baseline.json
      exit 1 when any quality score drops more than 0.02
```

The harness does not index a repository. A missing or unfinished index fails the job with the index id. The maintainer indexes that commit from the home page and reruns the job.

---

## 3. Decisions

### Decision A: The golden commits stay fixed

These three commits are the set. A question names line ranges in that commit. A newer default-branch commit is a different index, and the golden file does not follow it.

- `colinhacks/zod` at `90bf57b8e96a3729d766fff3185d39b2ab3ba016`. Staging already holds this index.
- `honojs/hono` at `676c8f80fcafc49e6e74c847a8f0d9c44cc7faee`. This is the tip of `main`. The home page indexes that tip, not an older commit.
- `pallets/flask` at `49943b5a94413a530761350f04e896f76e8d620e`.

The index id is `<githubRepositoryId>-<commitSha>`. The golden file stores that id after the first ready index. The harness reads the id from the file. It does not compute it.

### Decision B: Thirty questions in the run

The kinds match [architecture.md](architecture.md): `identifier`, `concept`, `architecture`, `start_here`, `feature`, and `out_of_repo`.

- The run asks 30 questions, ten from each repository. Each repository keeps two identifier, two concept, two architecture, one `start_here`, two feature, and one `out_of_repo`.
- The other 30 questions stay in `apps/evals/golden/hold/`. The loader reads only `golden/*.yaml`.
- `out_of_repo` questions have an empty range list. The expected answer contains the sentence `I did not find this in the repository.` and cites nothing.
- Every other question has at least one ground-truth range. A range is a path, a start line, and an end line in the pinned commit.
- A question id is stable, such as `zod-identifier-01`. The report names a failure by that id.

### Decision C: Overlap is a shared line

A chunk hits a ground-truth range when the paths are equal and the line ranges overlap. Overlap means `chunk.startLine <= range.endLine` and `range.startLine <= chunk.endLine`.

- **Context recall.** The share of ground-truth ranges that at least one of the top 8 retrieved chunks hits. `out_of_repo` questions are not in this score.
- **Context precision.** The share of the top 8 retrieved chunks that hit at least one ground-truth range. `out_of_repo` questions are not in this score.
- The top 8 are the chunks in the `retrieval` event, in that order. `k` is `CONTEXT_CHUNKS` from `packages/domain`. The harness does not copy the number 8.

### Decision D: The retrieval event is the eval input

The `retrieval` event already lists every chunk the gateway retrieved. The harness reads that event. It does not read D1.

`debug=true` is the query flag the harness sends. The event shape does not change. Without the eval token, the flag does nothing and the hourly limit still applies.

### Decision E: Save the retrieved chunks on the question row

The share page keeps showing only the citations the answer used. A new nullable column `retrieved_citations` stores the full retrieval list as JSON, in rank order. New answers write it. Rows that already exist stay null.

The column is for a saved answer after the fact. The eval does not read it. The SQL file is the next number under `infra/migrations` after `0001_chunk_total.sql`. Follow the migration rules in `repotron.mdc`. Do not apply it locally.

### Decision F: The eval token skips only the question limit

The hourly question limit is 30 for one IP address. One eval run asks 30 questions, so the token still skips that limit.

- The gateway secret is `EVAL_TOKEN`.
- The harness sends it in the header `x-repotron-eval-token`.
- When the header matches the secret, `askQuestion` does not call the question rate limit.
- A missing header, or a header that does not match, leaves the limit in place. The route still returns the normal error for a bad request.
- The index limit, Turnstile, and the index-ready check stay as they are.
- Logs omit the header value.

### Decision G: Judges go through AI Gateway

Faithfulness and answer relevance use DeepEval. The judge model is the gateway `ANSWER_MODEL_ID`, called through the same AI Gateway as the answer. Temperature is 0.

- Faithfulness asks whether the answer comes only from the retrieved chunk text.
- Answer relevance asks whether the answer resolves the question.
- Each score is a number from 0 to 1. The report stores the mean across the questions that have a score.
- A judge transport failure retries once. A second failure fails that question and fails the run. The harness does not ask the gateway for a second answer.

### Decision H: The gate watches quality, and it prints time and cost

These scores are compared with `baseline.json`. Each one is a number from 0 to 1.

- Context recall
- Context precision
- Faithfulness
- Answer relevance
- Citation accuracy
- Refusal accuracy

Citation accuracy is the share of cited ranges that overlap a ground-truth range, for questions that are not `out_of_repo`. A question that cites nothing adds nothing to the numerator and nothing to the denominator.

Refusal accuracy is the share of `out_of_repo` questions whose answer contains `I did not find this in the repository.` and whose cited list is empty.

The check fails when a score in the report is more than 0.02 below the same score in the baseline. A missing baseline key fails the check. A higher score passes.

The report prints p95 retrieval time, p95 time to the first token, total input tokens, total output tokens, and the dollar cost. Those numbers do not fail the check. The prices are the OpenRouter list prices in [architecture.md](architecture.md): $0.10 per million input tokens and $0.50 per million output tokens for `anthropic/claude-haiku-5.5`. The constants live in `apps/evals`. A model change updates the architecture sentence and those constants in one pull request.

### Decision I: `apps/evals` is its own uv project

It has its own `pyproject.toml` and `uv.lock`. It does not join the indexer image and it does not share a uv workspace. `package.json` scripts call `uv run`, so Turborepo can lint and test it. The deploy workflows do not build it.

### Decision J: The first baseline is a committed file

`apps/evals/baseline.json` is the file the gate reads. It is absent until stage 5. A run with no baseline writes `report.json`, prints the scores, and exits 0. Stage 5 copies that report's quality scores into `baseline.json` and commits it. Later runs compare.

Do not edit `baseline.json` by hand to make a pull request pass. A real gain updates the baseline in a pull request that states the new scores.

---

## 4. Repository layout

```text
apps/evals/
  pyproject.toml
  uv.lock
  package.json              # uv run scripts for turbo
  baseline.json             # added in stage 5
  golden/
    zod.yaml
    hono.yaml
    flask.yaml
  src/evals/
    ask.py                  # one question against the staging gateway
    metrics.py              # recall, precision, citation accuracy, refusal
    judge.py                # DeepEval calls
    report.py               # report.json and the baseline compare
    run.py                  # the entry the CI job calls
  tests/
    test_metrics.py
    test_gate.py
```

The gateway change stays in the current question route. No new route group.

---

## 5. Golden file

One YAML file for each repository. The harness loads every file in `golden/`.

```yaml
repository: colinhacks/zod
commitSha: 90bf57b8e96a3729d766fff3185d39b2ab3ba016
indexId: 245704608-90bf57b8e96a3729d766fff3185d39b2ab3ba016
questions:
  - id: zod-identifier-01
    kind: identifier
    question: Where is the object schema function defined?
    ranges:
      - path: packages/zod/src/v4/classic/schemas.ts
        startLine: 1731
        endLine: 1741
  - id: zod-start-01
    kind: start_here
    preset: start_here
    ranges:
      - path: README.md
        startLine: 39
        endLine: 63
  - id: zod-feature-01
    kind: feature
    preset: explain_feature
    featureName: object schemas
    ranges:
      - path: packages/zod/src/v4/classic/schemas.ts
        startLine: 1731
        endLine: 1741
  - id: zod-out-01
    kind: out_of_repo
    question: What is the refund policy?
    ranges: []
```

`start_here` sends the preset and no free-text question. `feature` sends `explain_feature` and `featureName`. The other kinds send `question`. A range that does not exist in that commit is a defect in the golden file. The files in `apps/evals/golden/` hold the real ranges.

`start_here` questions send the preset `start_here` and no free-text question. `feature` questions send the preset `explain_feature` and the feature name. The other kinds send `{ "question": "..." }`.

---

## 6. Report file

`report.json` holds one object. The gate reads `scores`. A person reads `questions` when a run fails.

- `scores` — the six quality scores, each from 0 to 1
- `latency` — `retrievalP95Ms` and `firstTokenP95Ms`
- `cost` — `inputTokens`, `outputTokens`, and `dollars`
- `questions` — one item for each golden question: the id, the retrieved paths and line ranges, the answer text, the cited ranges, and the judge scores

A failed question names its id and the score that dropped.

---

## 7. Gateway behavior

The question route stays `POST /api/v1/indexes/:id/questions`.

1. Read the header `x-repotron-eval-token`.
2. When it matches `EVAL_TOKEN`, skip the question rate limit. Otherwise count the question as today.
3. Retrieve the chunks and send the `retrieval` event, as today.
4. After a successful answer, write `retrieved_citations` with the full retrieval list. Write `citations` with the cited subset, as today.
5. A model failure still writes no row.

`readQuestion` does not return `retrieved_citations`. The share page does not change.

Add `EVAL_TOKEN` to the gateway env schema with the other required secrets. No silent fallback.

---

## 8. Delivery stages

### Stage 1: Save the retrieval list and accept the eval token

- Add the SQL file for `retrieved_citations`. Update the Drizzle table by hand. Run `pnpm db:sync`.
- Skip the question limit only when the eval header matches.
- Unit tests:
  - When the eval header matches, the question does not call the rate limit.
  - When the header is absent, the sixth question past the limit is still refused. The limit is 30, so the test uses the existing limit fake rather than 30 real calls.
  - When an answer finishes, the saved row holds every retrieved chunk, and `citations` holds only the cited ones.
- **Staging check:** ask one question on the Zod index. The new column in D1 holds the same chunks the citation panel showed, plus any chunk the answer did not cite.

### Stage 2: Write the golden set

**Status.** Done. All three indexes are `ready` on staging, and the ids in `apps/evals/golden/` match those rows.

- Add the three YAML files with real line ranges. The run loads 30 questions. The other 30 stay in `golden/hold/`.
- Index Hono and Flask at the pinned commits from the home page, if those index rows are not `ready`.
- Record each index id in its YAML file.
- **Staging check:** `GET /api/v1/indexes/:id` returns `ready` for all three ids. Open one ground-truth GitHub link for each repository and confirm the lines exist at that commit.

### Stage 3: Score retrieval

**Status.** Done. The harness reads the retrieval event and scores overlap. The tests do not call the network.

- Add `apps/evals` with uv, ruff, mypy `--strict`, and pytest.
- `ask.py` posts one question, reads the SSE events, and returns the retrieved ranges, the answer, the cited ranges, and the times and token counts from `done`. A dropped stream retries that post once.
- `metrics.py` computes recall, precision, citation accuracy, and refusal accuracy.
- `test_metrics.py` proves the overlap rule with fixture ranges. One case overlaps, one case misses, and one `out_of_repo` case counts only toward refusal.
- `test_gate.py` proves a score 0.03 below the baseline fails, and a score 0.02 below the baseline passes.
- **Local check:** `pnpm --filter evals test` passes with no network.

### Stage 4: Score the answer

**Status.** The judge and `evals.run` are in the package. GitHub Actions runs them. Nothing runs on a laptop.

- Add the DeepEval judge calls through AI Gateway.
- Faithfulness receives the answer and the retrieved chunk text. Answer relevance receives the answer and the question.
- The report fills all six scores, the latency numbers, and the cost.
- **Staging check:** one local run of `uv run python -m evals.run` against the three ready indexes writes `report.json`. Each question id appears once. A known `out_of_repo` item shows an empty citation list when the model refuses.

### Stage 5: Turn on the gate

**Status.** `.github/workflows/eval.yml` runs on a pull request and compares `baseline.json`. The 30 questions run only when that pull request changes `apps/gateway`, `packages/domain`, or `packages/db`. Any other pull request lints and skips the score. A manual run with "Write baseline" always asks the 30 questions and opens a pull request that adds `baseline.json`. The proof pull request that sets `CONTEXT_CHUNKS` to 1 is still open work, and it must not be merged.

- Copy the quality scores from the stage 4 report into `baseline.json` and commit that file.
- Add `.github/workflows/eval.yml`.
  - It runs on a pull request to `develop` and on `workflow_dispatch`.
  - A pull request scores the 30 questions only when the diff touches `apps/gateway`, `packages/domain`, or `packages/db`. Lint still runs.
  - `workflow_dispatch` always scores the 30 questions against the public staging URL.
  - A pull request deploys `repotron-pr-<number>-gateway` and scores that URL. The rate limiter stays on `repotron-staging-gateway`. Closing the pull request deletes the preview Worker. The live staging URL stays on the last merge.
  - A pull request that adds a SQL file fails before the upload. The message says a schema change is scored after the merge.
  - It does not deploy the pipeline or the web Worker, and it does not apply a migration.
  - The job timeout is 60 minutes. The harness asks one question at a time.
- GitHub Actions secrets for this workflow: `EVAL_TOKEN`, `OPENROUTER_API_KEY`, `CF_AIG_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`. The workflow does not print the secrets.
- **Proof:** open a pull request that sets `CONTEXT_CHUNKS` to 1. The eval check fails. Close that pull request without merging. The proof matches the check in [features.md](features.md), section 6, step 6.

---

## 9. CI

`eval.yml` is a required check after stage 5. A red eval blocks merge. A failure in the deploy workflows is a separate check.

The deploy workflows stay as they are. A change that touches only `apps/evals` does not deploy a Worker. A change that also touches the gateway still deploys the gateway through `deploy-staging.yml`.

The harness exits 1 in these cases:

- An index id is missing or the index is not `ready`.
- The gateway returns a status other than 200.
- A judge call fails twice.
- A quality score drops more than 0.02 below the baseline.
- The report is missing a score that the baseline has.

---

## 10. Risks

- **Judge noise.** One harsh judge score can fail a good pull request. Temperature 0 and one transport retry reduce that. They do not remove it. If the same commit fails two runs on judge scores alone, rerun `workflow_dispatch` once and record both reports in the pull request.
- **A chunker change moves line groups.** The golden commit does not move, but a new split can drop recall. That drop is a real failure. Fix the chunker or update the golden ranges in a pull request that explains the new lines.
- **Cost.** One full run asks 30 questions and then runs the judge. Run that set only for a pull request that changes the gateway, the question settings, the database package, or the eval harness. A manual run always asks the 30. Do not run it on every push to a feature branch.
- **A stale index.** Cleanup deletes an index with no question for 30 days. A golden index that nobody asks about for 30 days disappears. The eval questions update `last_question_at` when they succeed, so a green run refreshes the clock. A month with no pull request can still delete the index. The failed job names the index id. Index that commit again from the home page.
- **The eval token.** A leaked token lets one client skip the question limit. The token is a Worker secret and a GitHub secret. It is not in the repo and not in the web app.

---

## 11. Secrets

Set `EVAL_TOKEN` on `repotron-staging-gateway` after the stage 1 deploy, with the same command as the other gateway secrets. Generate a new random value. Do not reuse `CF_AIG_TOKEN` or `OPENROUTER_API_KEY`.

Add the same value, plus `OPENROUTER_API_KEY`, `CF_AIG_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`, as GitHub Actions secrets before stage 5 runs.

`apps/evals` has no Worker. It reads those values from the environment.
