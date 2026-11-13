# How Repotron works

This file walks through what the user sees. [prd.md](prd.md) owns the behavior. [architecture.md](architecture.md) owns the design.

Repotron answers a question about a public GitHub repository. The answer cites a file path and a line range at one fixed commit.

---

## 1. Ingestion

- The user pastes a public GitHub link on the home page and completes the Turnstile check.
- Repotron reads the default branch. That branch is usually `main` or `master`. It uses the latest commit on that branch.
- When an index for that commit already exists, the ask screen opens at once.
- When no index exists, the status screen shows the stage.
  - The stages are queued, parsing, embedding, and ready.
  - The screen refreshes every 2 seconds.
  - A failure shows the stage and the reason.
- Repotron downloads the files at that commit.
- Tree-sitter reads the code and splits it into chunks.
  - A function, a method, or a class stays whole in one chunk.
  - A large class splits at its methods.
  - A README splits at its headings.
  - This step uses a parser. It uses no model.
- The embedding model `@cf/google/embeddinggemma-2` turns each chunk into a list of numbers.
  - Chunks with a similar meaning get similar numbers.
  - Repotron stores the chunk text and the numbers.
- The status changes to ready. The user can ask a question.
- A bad link, a private repository, or a repository over a size limit returns an error. No job starts.

---

## 2. Question

Phase 1 uses this path.

- The user types a question, or presses a preset button.
- Repotron turns the question into numbers with `@cf/google/embeddinggemma-2`.
- It compares those numbers with the stored chunks and keeps the 8 closest chunks.
- It sends the question and those 8 chunks to `anthropic/claude-haiku-5.5` on OpenRouter.
  - The model may answer only from those chunks.
  - Thinking is off, so the first words are the answer.
- The answer streams onto the page. Each claim ends with a citation number, such as `[2]`.
- The citation panel shows the file path, the line range, the code, and a GitHub link at that commit.
- When the chunks do not hold the answer, Repotron says "I did not find this in the repository."
- The Share button copies a link. Anyone with the link can read the question, the answer, and the citations.
- Two preset buttons send a fixed question.
  - "Where do I start?" returns the purpose, the entry points, the main modules, and a reading order.
  - "Explain this feature" takes a feature name. It returns what the feature does, the flow, the key files, and the edge cases.

---

## 3. Later phases

These steps are not in the first version.

- **Phase 2.** A fixed question set scores each change. The score covers retrieval, faithfulness, and cost.
- **Phase 3.** Keyword search joins the number search. A reranker, Workers AI `bge-reranker-base`, scores the top 50 chunks and keeps the best 8 for the answer model.
  - The user can limit a question to a language or a folder.
  - Each citation shows a confidence label: high, medium, or low.
  - A symbol trace lists where a name is defined, then where the code uses it. That trace calls no model.
- **Phase 4.** A public chart shows accuracy, latency, and cost for each version of Repotron.
