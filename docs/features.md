# Features: Repotron

This file lists each feature, its phase, and the check that proves it on staging. [prd.md](prd.md) owns the behavior. [architecture.md](architecture.md) owns the design.

---

## 1. Rules for each feature

- An answer comes only from retrieved code. No retrieved chunk means "not found".
- Each claim cites a file path and a line range at a fixed commit.
- A retrieval change merges only with an eval score. From Phase 2, the score must not drop more than 2 percentage points below the baseline.

---

## 2. Phase 1: Index and ask

- **F-1: Repository intake.** The user pastes a public GitHub link.
  - Turnstile, the rate limit, and the size limits run before any job starts.
  - One index exists for each repository and commit.
- **F-2: Index progress.** The status screen shows the stage, the file count, and the chunk count. A failure shows the stage and the reason.
- **F-3: AST chunking.** Tree-sitter splits code at functions, methods, and classes.
  - A large node splits at its children.
  - Markdown splits at headings. Other files use line windows.
  - Each chunk keeps its path, symbol, and line range.
- **F-4: Dense retrieval.** The question embedding queries Vectorize in the namespace of the index.
- **F-5: Cited, streamed answer.** The answer streams. Each claim cites a chunk. Each citation links to GitHub at the commit and the line range.
- **F-6: Not-found answer.** When no chunk supports an answer, Repotron says so.
- **F-7: Cost record.** Each question stores the model ids, the tokens, and the latency of each stage.
- **F-8: New commit and cleanup.** A moved default branch gets a new index. The old index stays until the new one is ready. A cron deletes an index with no question for 30 days.
- **F-19: Shareable answer link.** The Share button copies `/a/:id`. The page shows the question, the answer, and the citations. It works after the index is gone.
- **F-20: Preset questions.** Two buttons send a fixed question with fixed sections.
  - "Where do I start?" gives the purpose, the entry points, the main modules, and a reading order.
  - "Explain this feature" gives what it does, the flow, the key files, and the edge cases.

## 3. Phase 2: Eval gate

- **F-9: Golden set.** 3 repositories at fixed commits, with 60 questions at least.
  - The question kinds are identifier, concept, architecture, start-here, feature, and out-of-repository.
  - Each answerable question has ground-truth line ranges.
- **F-10: RAG triad report.** Context recall and precision, faithfulness, answer relevance, citation accuracy, refusal accuracy, p95 latency, and cost.
- **F-11: CI gate.** Each pull request runs the evals against staging. The check fails on a drop of more than 2 percentage points.

## 4. Phase 3: Hybrid retrieval

- **F-12: BM25 search.** An FTS5 table over the chunk text and the split identifiers. `getUserById` also matches `get user by id`.
- **F-13: RRF fusion.** The dense list and the BM25 list merge by reciprocal rank, with `k` = 60.
- **F-14: Rerank.** A cross-encoder scores the top 50 fused chunks. The top 8 go to the model.
- **F-15: Scope filters.** The user limits a question to a language or a path prefix.
- **F-16: Ablation report.** One report compares dense, BM25, hybrid, and hybrid with rerank on the golden set. It also compares the embedding and reranker candidates.
- **F-21: Confidence label.** Each citation shows high, medium, or low from its reranker score.
- **F-22: Symbol trace.** The user types a symbol name. The result lists its definitions, then its usages. A keyword search on the identifiers does the work, with no model call.

## 5. Phase 4: Public dashboard

- **F-17: Eval history.** CI stores each eval report in R2, keyed by the Repotron commit.
- **F-18: Dashboard.** One public chart shows accuracy, p95 latency, and cost per question across commits.

---

## 6. Build order

Each step ends with one check on staging.

1. **F-1 and F-2.**
   - Check: a public link reaches `ready`. A private link returns an error and starts no job.
2. **F-3.**
   - Check: a Python file with two functions gives two chunks with correct line ranges.
3. **F-4 to F-7.**
   - Check: a question about a known function cites that function, and the GitHub link opens the right lines.
4. **F-8.**
   - Check: after a new commit, questions work during the re-index, and the old vectors are gone after `ready`.
5. **F-19 and F-20.**
   - Check: a shared link opens in a private browser window. "Where do I start?" returns the four sections, each with a citation.
6. **F-9 to F-11.** The first run writes `baseline.json`.
   - Check: a pull request that sets `topK` to 1 fails the gate.
7. **F-12 and F-13.**
   - Check: identifier hit@1 beats the dense baseline.
8. **F-14 and F-21.**
   - Check: context precision beats hybrid with no rerank. Retrieval p95 stays under 800 ms.
   - Check: `apps/evals/reranker-scores.md` records the score range, and the label code matches it.
   - Check: high citations overlap the ground truth more often than low citations.
9. **F-15, F-16, and F-22.**
   - Check: the ablation report is in the repository. A trace of a golden identifier lists its definition first.
10. **F-17 and F-18.**
    - Check: the dashboard shows the last 2 eval runs.

---

## 7. For later

- Follow-up questions that use the earlier turns
- Private repositories through a GitHub App
- A branch picker. Refer to [future-works.md](future-works.md).
- Questions across two or more repositories
- An MCP server that exposes the search, for use by the DevOps PR agent of Project 3
- A call graph view from the Tree-sitter output
