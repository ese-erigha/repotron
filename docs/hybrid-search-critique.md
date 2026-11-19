# Critique of a hybrid-search note for code

This note reviews an outside recommendation about hybrid search for a GitHub repository question-and-answer system. The recommendation is kept in full at the end of this file. The review uses the Repotron indexer, the keyword table, and the eval numbers from November 2026.

The goal of Phase 3 is hybrid search and a reranker. Scope filters and the symbol trace are not that goal.

## What the note gets right

Equal fusion can let a weak vector hit outrank an exact name. Repotron used reciprocal rank fusion with equal lists of 50. A chunk in both lists scored about 0.018. The best vector-only chunk scored about 0.016. The overlap took the slots. Recall fell from 0.7407 to 0.6667. A later swap of the last semantic slot dropped recall from 20 of 27 ranges to 19 of 27.

Code questions and concept questions are different jobs. "Where is the route decorator defined?" needs a symbol. "How does Flask dispatch a request?" needs a description of behavior. One weight for both jobs is a blunt tool.

A keyword index that cannot see `getUserById` as one name and as the parts `get`, `user`, `by`, and `id` will miss symbol questions. That part of the note is a real requirement.

## What Repotron already does

The note assumes a naive stack. These parts are already built.

- Code chunks come from Tree-sitter. The split is the function, the method, or the class. An oversized node is split again by lines. Markdown is split on headings.
- Each code chunk stores the symbol. The embedding text is `title: path symbol | text: content`.
- The keyword table copies `content` and `identifiers`. The identifier text keeps the full name and the split parts. `getUserById` is stored with `get user by id`.
- The FTS tokenizer is `unicode61` with `tokenchars '_'`. An underscore stays inside a token. A dot does not. `auth.service.ts` becomes separate tokens.
- The production path does not fuse lists. It takes the semantic top 8. A question that starts with "where is" moves the chunk whose symbol equals the last name to position 1. On that path, `identifierHitAt1` is 1.0 and recall is 0.7407.
- The live embedding model is `@cf/google/embeddinggemma-2`, a general text model. The re-index replaces it with `mongodb/voyage-code-4` and deletes `repotron-staging-chunks`. The model list is in [retrieval-improvement-plan.md](retrieval-improvement-plan.md).

## Where the note does not match the measurements

**Pure keyword search has not won.** The note says hybrid search often loses to keyword search, and that embeddings should be removed if keyword search wins both symbol questions and concept questions. Repotron has not scored BM25 alone on the 30 questions. The measured loss was hybrid against the semantic path, not hybrid against BM25. The semantic path, plus the symbol move, is the best path we have measured. Stripping it is not supported.

**The golden symbol questions are English, not CamelCase.** The note says to route CamelCase, snake_case, paths, and backticks to keyword search. The live identifier questions look like "Where is the object schema function defined?" and "Where is jsonify defined?" A router that looks for CamelCase does not select those questions. The symbol move already handles the "where is" shape, and it does not need a fusion weight.

**The cross-encoder did not keep the definition.** The note says a cross-encoder drops a near miss and keeps the right function. We scored 20 ground-truth pairs with `@cf/baai/bge-reranker-base`. The correct definition was the passage. Identifier pairs still scored near 0. "What is Flask?" scored 0.9927901029586792. The Hono class pair scored 0.0004465289821382612. A second run put the chunk title in the passage. Zod definitions stayed near 0, and Flask concept pairs stayed near 1. Sorting by that score puts a readme ahead of the function. The reranker is not a filter we can turn on until a definition scores above a readme.

**Equal RRF was a bad weight. A lower vector weight is untested.** The note suggests a linear mix with the vector weight at 0.2 to 0.3. Repotron did not run that mix. The failure of equal RRF does not prove that 0.2 is safe. Any mix that removes one of the semantic 8 can drop a range. The next hybrid attempt keeps those 8 and adds the best keyword chunk as a 9th chunk.

## Where the note is out of this phase

- A code embedding model needs a new Vectorize index and a re-index of the pinned commits. That re-index is step 3 of [retrieval-improvement-plan.md](retrieval-improvement-plan.md). The default model is `mongodb/voyage-code-4`. The home page still indexes the branch tip for a visitor. The golden re-index passes the pinned commit SHA.
- Embedding a generated summary, and keeping raw code only in BM25, is a second index. It is a re-embed of every chunk. It is not a fusion tweak. A summary that omits the symbol can miss "where is" questions. The symbol column already carries that name.
- Cohere Rerank and `bge-reranker-v2-m3` are different models. Each one needs its own score range before it sorts a list. The measured model is `bge-reranker-base`.

## What to do next

Hybrid search and the reranker stay first. Do not treat scope filters or the symbol trace as the next search change.

1. Hybrid search. Keep the semantic top 8. Add the best keyword chunk as a 9th chunk. Do not remove a semantic chunk. Merge only when recall stays at 0.7407 and `identifierHitAt1` stays at 1.0.
2. Reranker. Change the text sent to `bge-reranker-base` until a definition scores above a readme on the same 20 pairs. The sort stays off until that is true. Record the new low score, the new high score, and the sigmoid decision in `apps/evals/reranker-scores.md`.
3. Diagnostic, after those two. Score BM25 alone and semantic search alone on the 30 questions, split by question kind. Do not remove semantic search unless BM25 wins both the identifier kind and the concept kind.

## The recommendation, unchanged

In codebases, hybrid search often underperforms pure keyword search because general-purpose embedding models treat distinct code symbols as semantically similar. For example, `authenticateUser()`, `validateToken()`, and `checkPermissions()` all sit right next to each other in vector space. When you fuse vector results with BM25 results using equal weights or reciprocal rank fusion, noisy vector matches frequently outrank the exact function definition or variable reference you actually need.

To fix hybrid retrieval for a GitHub repo RAG pipeline, target these five bottlenecks:

1. Rebalance fusion weights, or route by query type. Standard reciprocal rank fusion gives equal weight to dense and sparse retrieval, which is usually too heavy on vectors for source code. If you use a linear mix, drop the vector weight to 0.2 or 0.3 so keyword matches anchor the results. If the query contains CamelCase, snake_case, a file path, a stack trace, or backticks, route to keyword search. Use vector search for architectural questions.

2. Fix code tokenization in the keyword index. Split `getUserById` and `get_user_by_id` into parts, and also keep the full identifier. Do not let an English analyzer strip underscores, dots, and arrows.

3. Use a code embedding model and Tree-sitter chunks. General text embeddings are trained on prose. Chunk at the function, method, or class, and prepend the file path and the parent signature before embedding.

4. Add a cross-encoder reranker and raise the candidate count. Take the top 30 to 50 from BM25 and from vector search. Deduplicate. Rerank with a cross-encoder and keep 5 to 8 chunks.

5. Embed docstrings or summaries for the vector index, and index the raw code in BM25. Both indexes point at the same chunk.

Diagnostic. Log recall and mean reciprocal rank on 20 to 30 real questions, split into symbol lookups and concept questions. If keyword search wins both, remove embeddings until Tree-sitter chunks and a code embedding model are in place.
