# Retrieval improvement plan

This plan is the path to a better search than the one on `develop` today. It uses the measurements in [hybrid-search-critique.md](hybrid-search-critique.md). It replaces the "do not re-index" limit in [phase-3-plan.md](phase-3-plan.md) for this work only.

Hybrid search and the reranker are the work. Scope filters and the symbol trace wait.

## The floor we keep

Do not remove these. They are the best measured path.

- Tree-sitter chunks at the function, method, or class. Markdown stays on headings.
- The symbol on each code chunk, and the identifier text that keeps the full name plus the split parts.
- The semantic top 8 from Vectorize.
- The symbol move. A question that starts with "where is" puts the chunk whose symbol equals the last name in position 1.
- On that path, `identifierHitAt1` is 1.0 and recall is 0.7407. Precision is 0.1019. Refusal is 1.0.

Precision is the weak number. About 1 chunk in 8 overlaps the expected lines. Recall misses about 1 ground-truth range in 4. The symbol move fixed the first chunk for "where is" questions. It did not fix precision.

## Models

The live index uses `@cf/google/embeddinggemma-2`. That model is a general text model. The re-index deletes `repotron-staging-chunks` and creates it again at 1024 dimensions. The name stays. The vectors do not. A purge of the old vectors is not enough, because a 768-dimension index cannot store a 1024-number vector.

The re-index model is `mongodb/voyage-code-4` on OpenRouter, at 1024 dimensions. The price is $0.12 per million tokens. The context window is 32,000 tokens. The answer model already uses that account.

The reranker is `mongodb/rerank-3` on OpenRouter. The price is $0.05 per million tokens. OpenRouter lists a p50 latency of 0.17 s.

## Re-index

Clear the staging data first. Then change the code. Hybrid search and the reranker wait until the three pinned commits are in the new index. A hybrid test on the old vectors would be thrown away with those vectors.

The re-index uses the pinned commits in `apps/evals/golden/*.yaml`. It does not use the tip of the default branch. The home page still indexes the branch tip for a visitor. The golden re-index passes the commit SHA into the existing workflow.

## Steps

Step 1 is a staging change, not a pull request. Step 2 is one pull request, and that pull request does not run the 30-question eval. Each later step is one pull request. Stop when the check fails. Do not hide a failure by starting the next step.

1. Clear staging, then recreate the vector index. Do this before the code pull request.
   - Delete every row in `source_chunks`, then `answered_questions`, then `repository_indexes`, then `github_repositories`. The chunk delete clears `chunk_keywords`.
   - Delete the objects in the R2 bucket `repotron-staging-batches`.
   - Delete the Vectorize index `repotron-staging-chunks`.
   - Create `repotron-staging-chunks` again with 1024 dimensions and cosine distance.
   - Create the string metadata indexes on `path`, `language`, and `kind` before the first insert.
   - Do not index a repository until step 2 is on `develop`. The live Workers still write 768-number vectors until that merge.
2. Switch the code to the new index. One pull request.
   - Set `EMBEDDING_MODEL_ID` to `mongodb/voyage-code-4`.
   - Set the vector dimension to 1024.
   - The gateway and the pipeline embed through OpenRouter with that model.
   - Keep the binding name `repotron-staging-chunks`.
   - The embedding text is `title: path symbol | text: content`, plus the first docstring or the signature when the chunk has one.
   - Turn off the 30-question eval on this pull request. Change `eval.yml` so the `eval` job does not score. The database is empty, and a red eval blocks the merge.
   - The skip stays until step 3 records the new floor. The pull request that records the floor removes the skip.
   - Merge this pull request. A push to `develop` deploys the gateway and the pipeline.
3. Fill the index, then turn the eval back on.
   - Index the three pinned commits with the deployed pipeline.
   - Keep the symbol move.
   - Run the 30 questions on semantic search plus the symbol move.
   - Record the new recall and the new `identifierHitAt1`. Those two numbers are the floor for steps 4 and 6.
   - Remove the eval skip in that same pull request. Later pull requests score again.
4. Hybrid search. Do this on the new index only. Give the model the 8 semantic chunks plus one keyword chunk. Do not reorder the 8, and do not delete one of them.
   - Run semantic search for the top 8, then the symbol move. A "where is" question still puts the named function first.
   - Run keyword search for the top 50.
   - If the first keyword chunk is already inside the 8, stop. The model receives those 8.
   - If it is not inside the 8, add it at the end. The model receives 9 chunks.
   - Run the 30 questions. Merge only when recall and `identifierHitAt1` stay at the floor from step 3.
   - If recall drops, stop this step. Do not put the keyword chunk into one of the original 8 slots. That swap already failed.
5. Reranker scores. Score the 20 pairs with `mongodb/rerank-3`. Do not change the order of chunks a user receives.
   - Use the same 20 questions and the ground-truth chunks from the new index.
   - Call `mongodb/rerank-3`. The passage is `title: path symbol | text: content`. The query text is the user question.
   - Write the low score, the high score, and the sigmoid decision in `apps/evals/reranker-scores.md`.
   - Pass when every definition score is above the readme score for "What is Flask?" on this same run.
   - If a definition is still lower, stop. Do not sort with this model.
6. Sort with `mongodb/rerank-3` after step 5 passes. On a "where is" question, the symbol-matched chunk stays first. Merge only when recall and `identifierHitAt1` stay at the floor from step 3, and retrieval p95 stays under 800 ms.
7. Write the comparison. Score keyword search alone, semantic search alone, semantic search plus the extra keyword chunk, and that list after the reranker. Use the 30 questions. Split the scores by question kind. Commit the file as `apps/evals/ablation.json`. Do not change the production path in this pull request.

## What this plan refuses

- Do not remove semantic search because a blog post says keyword search wins. We have not scored keyword search alone on the 30 questions.
- Do not route on CamelCase. The live identifier questions are English sentences. The symbol move already selects them.
- Do not call `@cf/baai/bge-reranker-base`. The measured scores put a readme ahead of a definition.
- Do not replace Tree-sitter chunks with line windows. The line split remains only for a node that is too large.
- Do not set `CONTEXT_CHUNKS` to 1.

## Done when

- A "where is" question still has the definition first.
- Recall is above 0.7407 on the index we keep.
- Precision is above 0.1019 on that index.
- Refusal stays at 1.0.
- The reranker sorts only if a definition scores above a readme on the 20 pairs.
- `repotron-staging-chunks` is deleted and created again at 1024 dimensions. The name stays.
