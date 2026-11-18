# Eval workflow

This file is the plan for steps 2 and 3. [phase-2-plan.md](phase-2-plan.md) owns the golden set, the six scores, and the baseline on the current staging gateway. That baseline is step 1. This file starts after `baseline.json` is on `develop`.

## Step 2: Score the pull request's gateway

`eval.yml` scores the gateway code from the pull request. The live staging URL stays on the last merge.

On each pull request to `develop`, and on each new push to that pull request, `eval.yml` does this when the score paths changed:

1. Fail the job when the pull request adds a file under `infra/migrations`. The message says a schema change is scored after the merge.
2. From `apps/gateway`, run `cf workers versions create --preview-alias pr-<number>`. This uploads a version of `repotron-staging-gateway` and leaves the live URL on the last merge.
3. Set `EVAL_GATEWAY_ORIGIN` to `https://pr-<number>-repotron-staging-gateway.ese-erigha.workers.dev`.
4. Ask the 30 questions, one at a time, with the eval token.
5. Compare the six scores with `baseline.json`. Exit 1 when any score drops by more than 0.02.

The preview uses the bindings in `apps/gateway/cloudflare.config.ts` and the secrets already on that Worker. A manual run does not upload a version. It calls the public staging URL.

Do not do these things in this job:

- Do not deploy the pipeline or the web Worker.
- Do not apply a SQL file.
- Do not create a second database or a second vector index.
- Do not index Zod, Hono, or Flask again.

A pull request that only changes parsing or embedding is not visible to this eval. The questions read indexes that are already built. Say that in the job log. Do not re-index inside the pull request.

The job timeout stays 60 minutes. One run is 30 answers plus the judge.

The score runs when the pull request changes `apps/gateway`, `packages/domain`, or `packages/db`. A change to the eval harness, the workflow, or the docs lints and skips the preview and the 30 questions. A manual run always asks the 30 questions.

## Step 3: Block the merge

Turn on the required status check for the Eval job on `develop` only after step 2 is green once. Until then a red check does not block the merge, and the first pull request has no baseline to compare.

After the check is required:

1. Open a pull request that sets `CONTEXT_CHUNKS` to 1.
2. Confirm the Eval check fails.
3. Close that pull request. Do not merge it.

A merge to `develop` still deploys staging through `deploy-staging.yml`. The preview exists only for the eval. An unpromoted version needs no delete.
