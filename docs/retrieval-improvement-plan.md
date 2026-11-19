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

The code models are these. The default is `mongodb/voyage-code-4` on OpenRouter, at 1024 dimensions. We already call OpenRouter for the answer model.

Voyage API at `https://api.voyageai.com/v1/embeddings`. These two are the code models. Voyage recommends `voyage-code-4`. `voyage-code-3` is the older code model and is still on that API. Both default to 1024 dimensions and also allow 256, 512, and 2048. The context window is 32,000 tokens.

OpenRouter embedding route. The MongoDB ids are the Voyage 4 models under the `mongodb/` owner.

- `mongodb/voyage-code-4`. This is the code model. It is the default for the re-index.
- `mongodb/voyage-4-large`. General purpose. Not the default.
- `mongodb/voyage-4`. General purpose. Not the default.
- `mongodb/voyage-4-lite`. General purpose, lower cost. Not the default.
- `mongodb/voyage-multimodal-3.5`. Text, image, and video. Not the default.

`voyage-code-3` is not an OpenRouter model id. OpenRouter also hosts `mistralai/codestral-embed-2505`, which is a code embedding model and is not a Voyage model. It is not the default.

The measured reranker is `@cf/baai/bge-reranker-base`. Workers AI hosts that one reranker and does not host `bge-reranker-v2-m3`. `bge-reranker-base` is an older English cross-encoder. `bge-reranker-v2-m3` is a newer multilingual BAAI model. It is not on Workers AI, and it is not in the OpenRouter list read on 19 November 2026. Step 2 still scores `bge-reranker-base` with a new question text, because that call needs no new vendor. When that check fails, step 4 uses `mongodb/rerank-3` on OpenRouter.

OpenRouter rerankers:

- `mongodb/rerank-3`. Voyage reranker. This is the default after `bge-reranker-base` fails.
- `mongodb/rerank-3-lite`. Smaller Voyage reranker.
- `mongodb/rerank-2.5` and `mongodb/rerank-2.5-lite`. Older Voyage rerankers.
- `cohere/rerank-5-pro` and `cohere/rerank-5-fast`. Current Cohere rerankers.
- `cohere/rerank-4-pro`, `cohere/rerank-4-fast`, and `cohere/rerank-v3.5`. Older Cohere rerankers.
- `qwen/qwen3-reranker-8b` and `qwen/qwen3-reranker-0.6b`. Qwen rerankers.

## Re-index

Step 1 is the re-index. Hybrid search and the reranker wait until that index exists. The semantic half of hybrid search reads the vectors. Those vectors come from `@cf/google/embeddinggemma-2`. A hybrid test on that index would be thrown away with the index.

The keyword table does not depend on the embedding model. It stays. The re-index uses the pinned commits in `apps/evals/golden/*.yaml`. It does not use the tip of the default branch. The home page still indexes the branch tip for a visitor. The golden re-index passes the commit SHA into the existing workflow.

## Steps

One step is one pull request. Stop when the check fails. Do not hide a failure by starting the next step.

1. Re-index. Replace the general-purpose vectors before any hybrid test.
   - Delete the Vectorize index `repotron-staging-chunks`.
   - Create `repotron-staging-chunks` again with 1024 dimensions and cosine distance.
   - Create the string metadata indexes on `path`, `language`, and `kind` before the first insert.
   - Embed the three pinned commits with `mongodb/voyage-code-4`.
   - The embedding text is `title: path symbol | text: content`, plus the first docstring or the signature when the chunk has one.
   - Keep the binding name `repotron-staging-chunks`. The gateway and the pipeline do not change index names.
   - Keep the symbol move.
   - Questions have no vectors from the delete until the new index is `ready`.
   - Run the 30 questions on semantic search plus the symbol move.
   - Record the new recall and the new `identifierHitAt1`. Those two numbers are the floor for steps 2 and 4.
2. Hybrid search. Do this on the new index only. Give the model the 8 semantic chunks plus one keyword chunk. Do not reorder the 8, and do not delete one of them.
   - Run semantic search for the top 8, then the symbol move. A "where is" question still puts the named function first.
   - Run keyword search for the top 50.
   - If the first keyword chunk is already inside the 8, stop. The model receives those 8.
   - If it is not inside the 8, add it at the end. The model receives 9 chunks.
   - Run the 30 questions. Merge only when recall and `identifierHitAt1` stay at the floor from step 1.
   - If recall drops, stop this step. Do not put the keyword chunk into one of the original 8 slots. That swap already failed.
3. Reranker text. Find a question string that makes a definition score higher than a readme. Do not change the order of chunks a user receives.
   - Use the same 20 questions and the ground-truth chunks from the new index.
   - Call `@cf/baai/bge-reranker-base`. The passage is `title: path symbol | text: content`.
   - First query text: the symbol name only. For the Hono class, that text is `Hono`.
   - Write the low score, the high score, and the sigmoid decision in `apps/evals/reranker-scores.md`.
   - Pass when every definition score is above the readme score for "What is Flask?" on this same run.
   - If a definition is still lower, run the 20 pairs once more. The query text is `Where is {symbol} defined?`.
   - If that run also fails, leave `bge-reranker-base` unused for sorting. Step 4 then tries `mongodb/rerank-3`.
4. Choose the reranker on `repotron-staging-chunks` after step 1. If step 3 passed, use `@cf/baai/bge-reranker-base`. If step 3 failed, score the same 20 pairs with `mongodb/rerank-3` and apply the same definition-versus-readme check. Sort the chunks only after that check passes. On a "where is" question, the symbol-matched chunk stays first. Merge only when recall and `identifierHitAt1` stay at the floor from step 1, and retrieval p95 stays under 800 ms.
5. Write the comparison. Score keyword search alone, semantic search alone, semantic search plus the extra keyword chunk, and that list after the reranker. Use the 30 questions. Split the scores by question kind. Commit the file as `apps/evals/ablation.json`. Do not change the production path in this pull request.

## What this plan refuses

- Do not remove semantic search because a blog post says keyword search wins. We have not scored keyword search alone on the 30 questions.
- Do not route on CamelCase. The live identifier questions are English sentences. The symbol move already selects them.
- Do not turn on `bge-reranker-base` as a sort while a definition scores near 0 and a readme scores near 1.
- Do not replace Tree-sitter chunks with line windows. The line split remains only for a node that is too large.
- Do not set `CONTEXT_CHUNKS` to 1.

## Done when

- A "where is" question still has the definition first.
- Recall is above 0.7407 on the index we keep.
- Precision is above 0.1019 on that index.
- Refusal stays at 1.0.
- The reranker sorts only if a definition scores above a readme on the 20 pairs.
- `repotron-staging-chunks` is deleted and created again at 1024 dimensions. The name stays.
