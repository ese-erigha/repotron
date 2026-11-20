# Retrieval improvement plan

This plan is the path to a better search than the one on `develop` today. It uses the measurements in [hybrid-search-critique.md](hybrid-search-critique.md). It replaces the "do not re-index" limit in [phase-3-plan.md](phase-3-plan.md) for this work only.

Hybrid search and the reranker are the work. Scope filters and the symbol trace wait.

## Where we are

The current stage is the chunk-text re-index. The code on `develop` already writes the new chunk text. Staging has no rows for Zod, Hono, or Flask. Index those three repositories again, then run the 30 questions once.

Do not change the chunk text again before that run. If recall does not rise above 0.6667, and `identifierHitAt1` does not rise above 0.8333, stop this text change. The next stage is hybrid search.

## The floor we keep

Do not remove these.

- Tree-sitter chunks at the function, method, or class. Markdown stays on headings.
- The symbol on each code chunk, and the identifier text that keeps the full name plus the split parts.
- The semantic top 8 from Vectorize.
- The symbol move. A question that starts with "where is" puts the chunk whose symbol equals the last name in position 1.

The EmbeddingGemma index scored recall 0.7407 and `identifierHitAt1` 1.0. That index is gone.

The first Voyage index, before the chunk-text change, scored recall 0.6667 and `identifierHitAt1` 0.8333. Precision was 0.0972. Faithfulness was 0.9936. Answer relevance was 0.8794. Citation accuracy was 0.15. Refusal was 1.0. Those six gate scores are in `apps/evals/baseline.json`. `identifierHitAt1` is not a key in that file.

## Models

The index `repotron-staging-chunks` has 1024 dimensions and cosine distance. The name stays. The embedding model is `mongodb/voyage-code-4` on OpenRouter. The price is $0.12 per million tokens. The context window is 32,000 tokens. Questions use `input_type` `query`. Chunks use `input_type` `document`.

The embedding text is the header, then the first docstring when the chunk has one, then the content. A signature is added only when the content does not already start with it. The old `title:` and `text:` wrapper is gone. Vectors written before that change do not count.

The reranker is `mongodb/rerank-3` on OpenRouter. The price is $0.05 per million tokens. OpenRouter lists a p50 latency of 0.17 s. It is not on yet.

## Done

1. `repotron-staging-chunks` was deleted and created again at 1024 dimensions. The string metadata indexes on `path`, `language`, and `kind` exist. The Vectorize index stays. Do not delete it for a repository cleanup.
2. The gateway and the pipeline embed with `mongodb/voyage-code-4` through the Cloudflare AI Gateway OpenRouter route. That code is deployed.
3. Zod, Hono, and Flask were indexed at the head of `main`. The golden files name those commits. The code ranges were still on the same lines, so the line numbers stayed. Flask's commit did not move.
4. The manual eval on that index failed the old baseline. `baseline.json` now holds the six new gate scores.
5. The chunk text change is merged and deployed. The three repositories were then removed from staging, including their vectors, R2 files, workflow instances, and D1 rows.

## Next

Index from the home page. Each URL uses the current head of `main`.

- `https://github.com/colinhacks/zod`
- `https://github.com/honojs/hono`
- `https://github.com/pallets/flask`

Wait until all three indexes are `ready`. If a head commit moved, write the new commit SHA and the new index id into `apps/evals/golden` before the eval. Then run the Eval workflow by hand on `develop`.

Keep the result when recall is above 0.6667 and `identifierHitAt1` is above 0.8333. Update `baseline.json` when one of the six gate scores changes. When the two retrieval numbers do not rise, leave the chunk text as it is and start hybrid search.

## Later steps

One step is one pull request. Stop when the check fails. Do not hide a failure by starting the next step.

1. Hybrid search. Do this on the index we keep. Give the model the 8 semantic chunks plus one keyword chunk. Do not reorder the 8, and do not delete one of them.
   - Run semantic search for the top 8, then the symbol move. A "where is" question still puts the named function first.
   - Run keyword search for the top 50.
   - If the first keyword chunk is already inside the 8, stop. The model receives those 8.
   - If it is not inside the 8, add it at the end. The model receives 9 chunks.
   - Run the 30 questions. Merge only when recall and `identifierHitAt1` stay at the floor from the chunk-text run.
   - If recall drops, stop this step. Do not put the keyword chunk into one of the original 8 slots. That swap already failed.
2. Reranker scores. Score the 20 pairs with `mongodb/rerank-3`. Do not change the order of chunks a user receives.
   - Use the same 20 questions and the ground-truth chunks from the index we keep.
   - Call `mongodb/rerank-3`. The passage is the header, then the content. The query text is the user question.
   - Write the low score, the high score, and the sigmoid decision in `apps/evals/reranker-scores.md`.
   - Pass when every definition score is above the readme score for "What is Flask?" on this same run.
   - If a definition is still lower, stop. Do not sort with this model.
3. Sort with `mongodb/rerank-3` after step 2 passes. On a "where is" question, the symbol-matched chunk stays first. Merge only when recall and `identifierHitAt1` stay at the floor from the chunk-text run, and retrieval p95 stays under 800 ms.
4. Write the comparison. Score keyword search alone, semantic search alone, semantic search plus the extra keyword chunk, and that list after the reranker. Use the 30 questions. Split the scores by question kind. Commit the file as `apps/evals/ablation.json`. Do not change the production path in this pull request.

## What this plan refuses

- Do not remove semantic search because a blog post says keyword search wins. We have not scored keyword search alone on the 30 questions.
- Do not route on CamelCase. The live identifier questions are English sentences. The symbol move already selects them.
- Do not call `@cf/baai/bge-reranker-base`. The measured scores put a readme ahead of a definition.
- Do not replace Tree-sitter chunks with line windows. The line split remains only for a node that is too large.
- Do not set `CONTEXT_CHUNKS` to 1.
- Do not write another chunk-text wrapper before the chunk-text eval is recorded.

## Done when

- A "where is" question still has the definition first.
- Recall and `identifierHitAt1` are at or above the floor from the chunk-text run.
- Refusal stays at 1.0.
- The reranker sorts only if a definition scores above a readme on the 20 pairs.
- `repotron-staging-chunks` stays at 1024 dimensions. The name stays.
