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

The live index uses `@cf/google/embeddinggemma-2`. That model is a general text model. The re-index replaces it with a code embedding model. The new Vectorize index replaces `repotron-staging-chunks`. Do not write the new vectors into the old index.

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

Steps 1 and 2 do not re-index. The keyword table is full. The three golden commits already have vectors in `repotron-staging-chunks`.

Step 3 does re-index. A reload of the current vectors is not that step. The current model, `@cf/google/embeddinggemma-2`, writes one vector space. A new model, or a new embedding text, is a new space. Old vectors cannot be compared with new vectors.

The re-index uses the pinned commits in `apps/evals/golden/*.yaml`. It does not use the tip of the default branch. The home page still indexes the branch tip for a visitor. The golden re-index is a separate run that passes the commit SHA into the existing workflow.

## Steps

One step is one pull request. Stop when the check fails. Do not hide a failure by starting the next step.

1. Add the keyword chunk without a deletion. Keep the semantic top 8 and the symbol move. Call `keywordSearch` with a limit of 50. When the best keyword chunk is not already in the 8, append it. The model receives 9 chunks. Merge only when recall stays at 0.7407 and `identifierHitAt1` stays at 1.0. When recall drops, stop. Do not swap a keyword chunk into the 8. Equal reciprocal rank fusion already failed that test.
2. Change the reranker text. Do not sort the live list. Score the same 20 ground-truth pairs with `@cf/baai/bge-reranker-base`. Send the symbol name, with the chunk title in the passage. Record the low score, the high score, and the sigmoid decision in `apps/evals/reranker-scores.md`. The check passes when the lowest definition score is above 0.9927901029586792, the titled-passage score for "What is Flask?". When a definition still scores lower, try one more text, `Where is {symbol} defined?`. When that also fails, leave `bge-reranker-base` unsorted. Step 4 then scores `mongodb/rerank-3`. Do not sort with a model that ranks a readme above a definition.
3. Re-index the three pinned commits with `mongodb/voyage-code-4` at 1024 dimensions. Create a new Vectorize index and point the gateway and the pipeline at it. Delete `repotron-staging-chunks` after the new index is `ready` and the 30 questions have run. The embedding text stays `title: path symbol | text: content`, and it adds the first docstring or the signature when the chunk has one. The raw code stays in `chunk_keywords`. The symbol move stays. Record the new recall and the new `identifierHitAt1` as the floor for later steps.
4. Choose the reranker on the index that step 3 kept. If step 2 passed, use `@cf/baai/bge-reranker-base`. If step 2 failed, score the same 20 pairs with `mongodb/rerank-3` and apply the same definition-versus-readme check. Sort the chunks only after that check passes. On a "where is" question, the symbol-matched chunk stays first. Merge only when recall stays at the new floor from step 3, `identifierHitAt1` stays at 1.0, and retrieval p95 stays under 800 ms.
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
- `repotron-staging-chunks` is deleted after the code-model index is `ready` and the 30 questions have a recorded score.
