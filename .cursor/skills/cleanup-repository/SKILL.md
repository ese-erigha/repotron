---
name: cleanup-repository
description: >-
  Deletes one staging repository: Vectorize vectors, R2 batches, then the D1
  rows. Use when the user asks to clean up, remove, or delete a repository by
  repository id, github_repositories.id, or scripts/cleanup-repository.sh.
disable-model-invocation: true
---

# Cleanup one repository

Deletes one repository from staging. The id is `github_repositories.id`, the numeric GitHub repository id stored as text.

## Input

The user must give the repository id in the same request. It is digits only.

When the id is missing, ask for it. Do not guess an id from a repository name, a commit, or a row you have not been given.

## Run

From the repository root:

```bash
pnpm exec bash scripts/cleanup-repository.sh REPOSITORY_ID
```

Replace `REPOSITORY_ID` with the digits the user gave.

- Run that command. Do not reimplement the deletes.
- Do not run `docs/cleanup.sql` by itself. That file deletes D1 rows only.
- Do not pass `--local`. The script talks to staging.
- A failed vector page stops the script and leaves the D1 rows. Run the same command again after the cause is fixed. Do not delete the rows another way.

## Report

State the repository id, whether the command exited 0, and the last lines of its output. When it fails, quote the error and stop.
