---
name: cleanup-repositories
description: >-
  Deletes the named staging repositories in one pass. The user passes
  github_repositories.id values separated by commas. Use when the user
  asks to clean up several repositories, or names cleanup-repositories.
disable-model-invocation: true
---

# Cleanup named repositories

Deletes only the repositories the user names. The ids are `github_repositories.id`, the numeric GitHub repository ids stored as text.

## Input

The user must give the ids in the same request, separated by commas. Example: `245704608,438384984,596892`.

Each id is digits only. Spaces around a comma are allowed.

When the ids are missing, ask for them. Do not guess an id from a repository name, a commit, or a row you have not been given.

## Rows

Keep every table. Do not run `DROP TABLE`.

Vectors for the named repositories go first. The script reads those chunk ids before it deletes rows. Then it deletes the same things the one-repository cleanup deletes:

- R2 objects under `indexes/<index id>/`
- The indexing workflow instance for each index id, and any older instance whose id starts with the repository id
- The deletion workflow instance `delete-<index id>`

Then D1 deletes every row. These statements have no repository filter, because only the named repositories are indexed:

1. `DELETE FROM chunk_keywords`
2. `DELETE FROM source_chunks`
3. `DELETE FROM answered_questions`
4. `DELETE FROM repository_indexes`
5. `DELETE FROM github_repositories`

The Vectorize index stays. The R2 bucket stays.

## Run

From the repository root:

```bash
pnpm exec bash scripts/cleanup-repositories.sh ID,ID,ID
```

Replace `ID,ID,ID` with the digits the user gave.

- Run that command. Do not reimplement the deletes.
- Do not pass `--local`. The script talks to staging.
- A failed vector page stops the script and leaves the D1 rows. Run the same command again after the cause is fixed. Do not delete the rows another way.

## Report

State the repository ids, whether the command exited 0, and the last lines of its output. When it fails, quote the error and stop.
