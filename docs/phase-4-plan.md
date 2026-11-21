# Phase 4 implementation plan: Public dashboard

This plan turns Phase 4 of [prd.md](prd.md) into work that one implementer can do in order. It names the stored report, the screen, and the checks. It contains no application code.

Do not implement the stages in one pull request. A red eval would not say which stage failed.

**Priority.** Store the eval summary first. The chart waits until one real summary is in R2.

## Operation

Phase 3 search work is done. The production path stays the reranked list. This phase does not change retrieval.

**Read first, in this order:**

1. `.cursor/rules/repotron.mdc` — the standing rules. They win over this plan when the two disagree.
2. [prd.md](prd.md) — Epic 6 holds the story. Section 6 holds the metric names.
3. [architecture.md](architecture.md) — the route list names `GET /api/v1/evals`. The web section names `/dashboard`.
4. [features.md](features.md) — F-17 and F-18.
5. [phase-2-plan.md](phase-2-plan.md) — the eval gate. This phase does not replace it.
6. This file. Section 3 lists the decisions we follow.

**Ground rules for the implementer:**

- Every test of R2 or the live gateway runs on staging. Do not run `cf dev` or a `--local` command.
- Do not deploy, merge, or apply a migration. A push to `develop` deploys when the paths in `deploy-staging.yml` change.
- This phase adds no SQL file.
- A unit test calls no Cloudflare API, no GitHub API, and no OpenRouter API. It uses fixture files.
- Section 5 gives the delivery stages in order. Each stage is one pull request to `develop`.
- The required `eval` check stays on. A stage that changes `apps/gateway`, `packages/domain`, or `packages/db` runs the 30 questions against that pull request's preview Worker.
- Do not edit `baseline.json` by hand.

---

## 1. Scope

**In scope.** Epic 6 of [prd.md](prd.md), and F-17 and F-18 of [features.md](features.md):

- US-6.1 — a visitor sees a public chart of accuracy, p95 latency, and cost for each Repotron commit.

**Out of scope.**

- A change to retrieval, chunk text, or the answer model.
- A confidence label on a citation.
- A symbol trace on the ask screen.
- A login, a token, or a private dashboard.
- A comparison view that diffs two commits.
- A new R2 bucket.

---

## 2. System at a glance

The eval job already writes `apps/evals/report.json` on the runner. That file holds the six gate scores, the latency numbers, the cost, and the text of each answer. Phase 4 keeps a small summary of a `develop` run and shows it on one screen.

```text
Eval on develop
  score the 30 questions
  build the summary
  put evals/<commitSha>.json in the staging bucket

GET /api/v1/evals
  list those objects
  return the summaries, newest first

/dashboard
  draw recall, retrieval p95, and dollars
  list the six scores of the newest commit
```

A pull request eval still scores the preview gateway. It does not write a public point.

---

## 3. Decisions

These choices started as recommendations. We follow them. An implementer does not replace one in a stage.

### Decision A: The public object is a summary

`report.json` holds each question and each answer. The public object does not. It holds the commit, the time, the six gate scores, `identifierHitAt1`, the two p95 numbers, and the dollar cost.

The key is `evals/<commitSha>.json` in `repotron-staging-batches`. Index deletion deletes batch keys under `indexes/<indexId>/`. It does not delete `evals/`.

### Decision B: Only a develop run writes history

A successful eval on `develop` writes one object. A failed eval writes nothing. A pull request eval writes nothing. A second run of the same commit replaces that one object.

### Decision C: The chart uses three numbers

The page draws one SVG chart. It does not add a chart library. The three lines are recall, retrieval p95, and dollars. Recall is the accuracy line, because it says whether the right code was found.

The page also lists the six gate scores and `identifierHitAt1` for the newest commit. Those numbers do not share one axis with milliseconds.

### Decision D: The list is public and small

`GET /api/v1/evals` needs no token. It returns at most 30 summaries, newest first. The time is `createdAt` on the summary. The route does not trust R2 list order. The route calls no model.

The gateway reads the same bucket through an R2 binding named `CHUNK_BATCHES`. The code reads only keys under `evals/`.

### Decision E: The screen is `/dashboard`

The header links to `/dashboard`. The fixture API returns two summaries, so `pnpm --filter web dev` draws the chart with no R2 bucket.

---

## 4. What stays

- The production search path stays the reranked list.
- A "where is" question still puts the named function first.
- The ask screen has no language menu, no path box, no symbol trace, and no confidence label.
- `baseline.json` and the 0.02 gate stay as they are.
- The six gate scores stay the failing scores. The chart does not fail a pull request.

---

## 5. Delivery stages

### Stage 1: Build the summary

**Status.** Not started.

- Add one function that reads the eval report and returns the summary from Decision A.
- A unit test proves the summary has recall, both p95 numbers, and dollars.
- The same test proves the summary has no question text and no answer text.
- **Staging check:** none. This pull request does not call R2.

### Stage 2: Store a develop run

**Status.** Not started. Start after stage 1.

- After a successful eval on `develop`, put `evals/<commitSha>.json` in `repotron-staging-batches`.
- A pull request eval does not put an object.
- A failed eval does not put an object.
- **Staging check:** one manual eval on `develop` leaves that object. A pull request run leaves the `evals/` prefix unchanged.

### Stage 3: Read the history

**Status.** Not started. Start after stage 2.

- Add `GET /api/v1/evals` on the gateway.
- Return at most 30 summaries, newest first.
- The fixture returns two summaries.
- A unit test proves the route calls no model.
- **Staging check:** the route returns the object from stage 2.

### Stage 4: Draw the dashboard

**Status.** Not started. Start after stage 3.

- Add `/dashboard`.
- Draw the SVG from Decision C.
- List the six gate scores and `identifierHitAt1` for the newest commit.
- Add the header link.
- **Staging check:** the page shows the last 2 runs. The header link opens the page.

---

## 6. Risks

- **A public answer.** `report.json` holds model answers. A write of that file into `evals/` publishes them. Stage 1 and stage 2 store the summary only.
- **A failed run as a point.** A failed eval that still writes a summary draws a dip that did not ship. Stage 2 writes only after the gate passes.
- **List order.** R2 list order is not time order. The gateway sorts on `createdAt`.
- **A missing run as zero.** A gap between commits is an empty space. The chart does not draw that gap as zero.
- **The shared bucket.** A delete of `indexes/<indexId>/` must not delete `evals/`. The deletion code already deletes named batch keys. Do not replace that with a bucket wipe.

---

## 7. Secrets

No new secret. The GitHub Actions token already has R2 edit. The gateway uses the existing bucket through the `CHUNK_BATCHES` binding.
