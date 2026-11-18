# Eval workflow

This file is the plan for steps 2 and 3. [phase-2-plan.md](phase-2-plan.md) owns the golden set, the six scores, and the baseline on the current staging gateway. That baseline is step 1. This file starts after `baseline.json` is on `develop`.

Change this file before you build the workflow. The choices below are the current plan, and they are open to change.

## Step 2: Score the pull request's gateway

The Eval check must run the gateway code from the pull request. The check that exists today calls the staging gateway, so a retrieval change in the pull request is invisible until after the merge.

On each pull request to `develop`, and on each new push to that pull request:

1. Deploy that commit's gateway only.
2. Bind the preview to the staging database `repotron-staging-db` and the staging vector index `repotron-staging-chunks`. Those already hold the three golden indexes.
3. Set `EVAL_GATEWAY_ORIGIN` to the preview URL.
4. Ask the 30 questions, one at a time, with the eval token.
5. Compare the six scores with `baseline.json`. Exit 1 when any score drops by more than 0.02.

Leave the live staging URL on the last merge. Prefer an unpromoted version of `repotron-staging-gateway`. That version keeps the Worker secrets that staging already has. If the CLI cannot upload a version without promoting it, deploy a Worker named `repotron-pr-<number>-gateway`, copy the same secrets onto it, and delete that Worker when the pull request closes.

Do not do these things in this job:

- Do not deploy the pipeline or the web Worker.
- Do not apply a SQL file.
- Do not create a second database or a second vector index.
- Do not index Zod, Hono, or Flask again.

When the pull request adds a file under `infra/migrations`, fail the job and say that a schema change is scored after the merge. Applying that SQL to the staging database would change the database the live gateway still uses.

A pull request that only changes parsing or embedding is not visible to this eval. The questions read indexes that are already built. Say that in the job log. Do not re-index inside the pull request.

The job timeout stays 60 minutes. One run is 30 answers plus the judge.

The score runs when the pull request changes `apps/gateway`, `apps/evals`, `packages/domain`, `packages/db`, or `.github/workflows/eval.yml`. Any other pull request lints and skips the score. A manual run always asks the 30 questions.

## Step 3: Block the merge

Turn on the required status check for the Eval job on `develop` only after step 2 is green once. Until then a red check does not block the merge, and the first pull request has no baseline to compare.

After the check is required:

1. Open a pull request that sets `CONTEXT_CHUNKS` to 1.
2. Confirm the Eval check fails.
3. Close that pull request. Do not merge it.

A merge to `develop` still deploys staging through `deploy-staging.yml`. The preview exists only for the eval. Delete a named preview Worker when the pull request closes. An unpromoted version needs no delete.
