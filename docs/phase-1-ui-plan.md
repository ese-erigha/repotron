# Phase 1 UI plan: The web app

This plan covers `apps/web` for Phase 1: the screens, the components, the client code, and the UI tests. [phase-1-plan.md](phase-1-plan.md) owns the API, the Worker config, and the stage order. When the two files disagree, `phase-1-plan.md` wins for the API, and this file wins for the UI.

**Read first:** `phase-1-plan.md` Decision A (section 3), the web config (section 8), and the gateway routes (section 10).

---

## 1. Scope

- **In scope**
  - 4 screens: Home, Repository, Shared answer, and Not found
  - Turnstile, the status polling, the answer stream, the citations, the 2 presets, the Share button, and the re-index banner
- **Later phases**
  - Phase 3: scope filters, confidence labels, and the symbol trace
  - Phase 4: the dashboard

---

## 2. The closetza model

`closetza/apps/pwa` is the model for the structure and the shape of the HTTP client. These parts carry over:

- **Folders by feature.** Each feature has one folder under `src/`, such as `src/ask/`. The folder holds the components, the hooks, the pure helpers with their tests, and one `<feature>.constants.ts`.
- **Shared folders.**
  - `screens/` holds one screen for each route.
  - `shell/` holds the app shell and `navigation.constants.ts`.
  - `ui/` holds the primitives.
  - `services/api/` holds the HTTP client and one service file for each API area.
- **A screen composes.** A screen reads the route, calls the feature hooks, and passes data and callbacks to feature components.
- **A feature component owns one visual piece.** Move a second piece into its own file in the same folder. A second piece is a header, a form, a list row, a menu, or a view that the parent only switches. Name the file for the piece, such as `citation-card-header.tsx`.
- **A hook loads data.** A `use-*.ts` hook calls a service function, and keeps the data, the load state, and the error in React state. A request id guards against a late response.
- **File names** use kebab-case for every file, including components: `citation-card.tsx` exports `CitationCard`.
- **Closed sets and labels** are `as const` objects with UPPER keys in the constants file of the feature. A component holds no string literal for a path, a label, or a closed value.
- **Imports** in `src/` are relative, with no file extension. `tsx` runs the tests, so the tests need no alias.
  - `fixtures/` and `vite.config.ts` run in Node, so their imports hold the `.ts` extension, as in the Workers. Section 12 describes the fixtures.

### 2.1 The HTTP client: `fetch` behind an interface

The client keeps the shape of `closetza/apps/pwa/src/services/api`, but it calls `fetch`, not axios. No screen, hook, or service calls `fetch` directly. A later change of the transport changes only `http-client.ts`.

```
services/api/
├── http-client.ts           HttpClient class. ApiError, toApiError
│                            Every response passes through one private request method
├── client.ts                getHttpClient(): one HttpClient for the app, built on first use
├── endpoints.ts             INDEX_PATH, QUESTION_PATH: as const, with path builders
├── indexes.service.ts       one function for each index endpoint
├── questions.service.ts     one function for each JSON question endpoint
└── answer-stream.service.ts openAnswerStream: the stream, through the same client
```

**`HttpClient`** is a class. The constructor takes `baseUrl`. Phase 1 needs 3 public methods: `get`, `post`, and `postStream`. Each method calls one private method, `request(path, init)`. That method does the job of the axios interceptor:

```
request(path, init)
  1. fetch(baseUrl + path, init)
     ├─ AbortError          → throw it as is. The caller aborted, so the UI shows nothing.
     └─ any other throw     → ApiError(code "network", status 0)
  2. response.ok is false   → throw await toApiError(response)
  3. return the response

get<T>(path)                → request(path, { method GET })             → response.json() as T
post<T>(path, body)         → request(path, { method POST, JSON body }) → response.json() as T
postStream(path, body, s)   → request(path, { method POST, JSON body, Accept: text/event-stream, signal s })
                            → response.body. A missing body throws ApiError(code "internal").
```

**`toApiError(response)`** reads the Repotron envelope `{ error: { code, message } }`.

- A `429` also sets `retryAfterSeconds` from the `Retry-After` header.
- A body with no envelope, such as an HTML error page, gives the code `internal`, with the status text as the message.
- `ApiError` holds `code`, `message`, `status`, and `retryAfterSeconds`.

**A service function** has one line of comment and one call:

```ts
/** Starts an index job, or returns the existing index of the commit. */
export async function requestIndex(body: RequestIndexBody): Promise<IndexView> {
  return getHttpClient().post<IndexView>(INDEX_PATH.LIST, body)
}
```

**Other rules:**

- **The base URL** is `API_ORIGIN` from `config/public-config.ts` (Decision A), not a `VITE_` variable.
- **Types** come from `repotron-domain` with `z.infer`. The JSON calls trust the types, as in closetza. The stream events are parsed with their schemas, because they arrive as text.
- **The constructor takes no `fetch` argument.** A test replaces the global `fetch` with `t.mock.method`, and `node:test` restores it after each test.

---

## 3. Screen map

```
                 ┌──────────────────────────────┐
                 │  /   Home                    │
                 │  link box · Turnstile        │
                 │  recent indexes              │
                 └──────┬────────────────┬──────┘
   POST /api/v1/indexes     │                │  select a recent index
   201 or 200           ▼                ▼
      ┌──────────────────────────────────────────────────┐
      │  /r/:owner/:repo?index=<indexId>   Repository     │
      │    queued, parsing, embedding  → status card      │
      │    failed                      → failure card     │
      │    ready                       → ask panel        │
      └──────────────────────┬───────────────────────────┘
                             │  Share, after the `done` event
                             ▼
      ┌──────────────────────────────────────────────────┐
      │  /a/:id   Shared answer                          │
      │    "Ask your own question" → /r/:owner/:repo      │
      └──────────────────────────────────────────────────┘

  /r/:owner/:repo with no ?index  → start card: Turnstile and "Index this repository"
  any other path                  → Not found screen
```

---

## 4. Layout

`AppShell` holds the header and the main area. Every screen renders inside it.

```
┌──────────────────────────────────────────────────────────────────┐
│ Repotron                       Ask a public GitHub repository    │  AppHeader
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         <screen content>                         │  main, max width 6xl
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- The logo links to `/`.
- At the `lg` breakpoint and above, the ask panel has 2 columns: the answer and the sources. Below `lg`, the sources go under the answer.
  - `SourcesLayout` owns that grid. The ask panel and the shared answer use it.
  - At `lg`, the sources panel is sticky and scrolls inside its own height. A select on `[n]` moves the panel, not the page.
- The shell has no footer. Each screen sets its own bottom space, so the sticky panel is never pushed under the header.
- `AppShell` moves the window to the top when the path changes.
- The repository screen and the shared answer load as separate chunks, because they hold the Markdown renderer. The header stays while a chunk loads.

---

## 5. Screens

### 5.1 Home `/`

```
┌──────────────────────────────────────────────────────────────────┐
│ Repotron                                                         │
├──────────────────────────────────────────────────────────────────┤
│  Ask questions about a public GitHub repository.                 │
│  Each answer cites the file and the lines.                       │
│                                                                  │
│  Repository link                                                 │
│  ┌──────────────────────────────────────────────┐ ┌───────────┐  │
│  │ https://github.com/owner/repo                │ │   Index   │  │
│  └──────────────────────────────────────────────┘ └───────────┘  │
│  ┌────────────────────────┐                                      │
│  │ [✓] Turnstile          │                                      │
│  └────────────────────────┘                                      │
│  ! This repository does not exist or is private.                 │  error line
│                                                                  │
│  Recently indexed                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ honojs/hono       a1b2c3d   1,204 files   2 hours ago     →│  │
│  │ pallets/flask     9f8e7d6     310 files   1 day ago       →│  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Behavior**

- The screen runs `parseRepositoryLink` from `repotron-domain` before the post. A bad link shows its error at once, and uses no Turnstile token and no rate limit unit. The gateway still validates the link.
  - `normalizeRepositoryLink` completes a link first. It accepts `owner/repo`, `github.com/owner/repo`, and an `http` link.
- The Index button is off until the link is not empty and Turnstile gives a token. It is also off while the request runs.
- The Turnstile widget stays hidden unless Cloudflare needs the user to act. One status line shows the state: "Checking your browser", "Browser check passed", or a load failure.
- The hero holds the title and one sentence. The 3 steps of the product sit under the recent list.
- On `201` or `200`, the screen goes to `repositoryPath(owner, name, id)`.
- On an error, the error line shows the message, and Turnstile resets. A token works once.
- The recent list loads on its own. An empty list shows "No repository is indexed yet." A failed list shows "The recent list could not load." Neither state blocks the form.

**Component tree**

```
HomeScreen                    useRequestIndex() · useRecentIndexes()
├── HomeHero                  intake/home-hero.tsx
├── RepositoryLinkForm        intake/repository-link-form.tsx
│   └── TurnstileWidget       turnstile/turnstile-widget.tsx
├── RecentIndexList           intake/recent-index-list.tsx
│   └── RecentIndexRow × n    intake/recent-index-row.tsx
└── IntakeSteps               intake/intake-steps.tsx
```

### 5.2 Repository `/r/:owner/:repo?index=<indexId>`

The screen picks one view from the URL and the index status. `selectRepositoryView` in `index-status/repository-view.ts` holds that decision as a pure function, so a unit test covers each branch.

```
read ?index from the URL
  │
  ├─ missing ──────────────────────► StartIndexCard
  │                                    Turnstile → POST /api/v1/indexes
  │                                    → replace the URL with ?index=<id>
  ▼
useIndexStatus(indexId)   (reads GET /api/v1/indexes/:id every STATUS_POLL_MS until ready or failed)
  │
  ├─ 404 ──────────────────────────► EmptyState "This index does not exist." · link to Home
  ├─ ready ────────────────────────► AskPanel(indexId)
  ├─ failed ───────────────────────► IndexFailureCard: stage, reason, Turnstile, Retry
  └─ queued | parsing | embedding
        ├─ fallbackIndexId is null ─► IndexStatusCard
        └─ fallbackIndexId is set ──► ReindexBanner + AskPanel(fallbackIndexId)
```

**Start card** (no `?index` in the URL)

```
│  honojs/hono                                            GitHub ↗ │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Index this repository to ask about it.                     │  │
│  │ ┌────────────────────────┐                                 │  │
│  │ │ [✓] Turnstile          │       [ Index this repository ] │  │
│  │ └────────────────────────┘                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
```

**Status card** (queued, parsing, or embedding)

```
│  honojs/hono · commit a1b2c3d                           GitHub ↗ │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Indexing this repository                                   │  │
│  │                                                            │  │
│  │   ● Queued ─── ● Parsing ─── ○ Embedding ─── ○ Ready        │  │
│  │                                                            │  │
│  │   Files: —    Chunks: —                                    │  │
│  │   This page checks the status every 2 seconds.             │  │
│  └────────────────────────────────────────────────────────────┘  │
```

- `StageProgress` fills each stage up to the current status.
- The counts show "—" until the gateway sets them. The pipeline sets both counts at `ready`.
- The card uses `aria-live="polite"`, so a screen reader hears each stage change.

**Failure card** (failed)

```
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ✕ Indexing failed at the parsing stage.                    │  │
│  │   Reason: The repository download timed out.               │  │
│  │ ┌────────────────────────┐                                 │  │
│  │ │ [✓] Turnstile          │                     [ Retry ]   │  │
│  │ └────────────────────────┘                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
```

- Retry posts the link again with a new token. The gateway resets the same index and restarts its Workflow, so the index id stays the same.

**Ask panel, before a question** (ready)

```
│  honojs/hono · commit a1b2c3d · 1,204 files · 5,880 chunks       │
│  ┌──────────────────────────────────────────────────┐┌────────┐  │
│  │ Ask a question about this repository              ││  Ask   │  │
│  └──────────────────────────────────────────────────┘└────────┘  │
│  [ Where do I start? ]  [ Explain this feature ]        0 / 1000 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Ask about a function, a file, or a flow.                   │  │  EmptyState
│  └────────────────────────────────────────────────────────────┘  │
```

**Ask panel, during and after an answer**

```
│  Q: Where is the router created?                                 │
│  ┌──────────────────────────────────────┐ ┌───────────────────┐  │
│  │ Answer                               │ │ Sources (8)       │  │
│  │                                      │ │ ┌───────────────┐ │  │
│  │ The `Hono` constructor creates the   │ │ │ [1] src/hono.ts│ │  │
│  │ router [1]. It uses `SmartRouter` by │ │ │ 41–88 · class │ │  │
│  │ default [2].▌                        │ │ │ ┌───────────┐ │ │  │
│  │                                      │ │ │ │41 export… │ │ │  │
│  │                                      │ │ │ │42   …     │ │ │  │
│  │                                      │ │ │ └───────────┘ │ │  │
│  │                                      │ │ │ GitHub ↗      │ │  │
│  │                                      │ │ └───────────────┘ │  │
│  │ [ Share ]                            │ │ [2] src/router/…  │  │
│  │ Copied. Anyone with this link can    │ │ [3] …             │  │
│  │ read this answer.                    │ │                   │  │
│  └──────────────────────────────────────┘ └───────────────────┘  │
```

- The sources render on the `retrieval` event, before the first token (US-3.1).
- Each `[n]` in the answer is a link. A select scrolls to source `n` and highlights it for 2 seconds.
- The number of a source is filled when the answer text cites it.
- The Share button shows only after `done`, because the `done` event carries the question id.
- A new question aborts the stream of the earlier question.
- Before the first question, the panel shows 3 starter questions, and the sources column shows a placeholder. The layout does not move when the first answer arrives.
- A failed answer keeps the text and the sources that arrived, and shows a "Try again" button that asks the same question.
- Enter asks the question. Shift + Enter adds a line.

**Feature name dialog** ("Explain this feature")

```
          ┌──────────────────────────────────────────┐
          │ Explain a feature                        │
          │                                          │
          │ Feature name                             │
          │ ┌──────────────────────────────────────┐ │
          │ │ rate limiting                        │ │
          │ └──────────────────────────────────────┘ │
          │                     [ Cancel ] [ Explain ]│
          └──────────────────────────────────────────┘
```

- Explain is off until the name holds 1 to 100 characters. Escape and Cancel close the dialog. The parent keeps the open and close state.

**Re-index banner** (a newer commit indexes, and an earlier index is ready)

```
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ⟳ A newer commit is indexing. Answers use the earlier      │  │
│  │   index until it is ready.             ● Parsing           │  │
│  └────────────────────────────────────────────────────────────┘  │
│  <ask panel on fallbackIndexId>                                  │
```

**Component tree**

```
RepositoryScreen               useIndexStatus(indexId) · useRequestIndex()
│                              useAnswerStream(active index id)
├── RepositoryHeader           index-status/repository-header.tsx
│   └── IndexStatusPill        index-status/index-status-pill.tsx
├── StartIndexCard             intake/start-index-card.tsx
│   └── TurnstileWidget
├── IndexStatusCard            index-status/index-status-card.tsx
│   └── StageProgress          index-status/stage-progress.tsx
├── IndexFailureCard           index-status/index-failure-card.tsx
│   └── TurnstileWidget
├── ReindexBanner              index-status/reindex-banner.tsx
└── AskPanel                   ask/ask-panel.tsx: the form, the answer, and the sources
    └── SourcesLayout          citations/sources-layout.tsx: the 2 columns
        ├── QuestionForm           ask/question-form.tsx
        │   └── PresetButtons      ask/preset-buttons.tsx
        ├── QuestionSuggestions    ask/question-suggestions.tsx: before the first question
        ├── AnswerCard             ask/answer-card.tsx
        │   ├── AnswerStatus       ask/answer-status.tsx
        │   ├── AnswerView         ask/answer-view.tsx: Markdown with linked [n] markers
        │   │   └── CitationMarker ask/citation-marker.tsx
        │   └── ShareButton        ask/share-button.tsx
        ├── FeatureNameDialog      ask/feature-name-dialog.tsx
        │   └── Dialog             ui/dialog.tsx
        └── CitationPanel          citations/citation-panel.tsx
            ├── CitationPlaceholder      citations/citation-placeholder.tsx
            └── CitationCard × n         citations/citation-card.tsx
                ├── CitationCardHeader   citations/citation-card-header.tsx
                └── CodeLines            citations/code-lines.tsx
```

### 5.3 Shared answer `/a/:id`

```
┌──────────────────────────────────────────────────────────────────┐
│ Repotron                                                         │
├──────────────────────────────────────────────────────────────────┤
│  Shared answer                                                   │
│  honojs/hono · commit a1b2c3d · Nov 14, 2026            GitHub ↗ │
│                                                                  │
│  Q: Where is the router created?                                 │
│  ┌──────────────────────────────────────┐ ┌───────────────────┐  │
│  │ The `Hono` constructor creates the   │ │ Sources (2)       │  │
│  │ router [1]. …                        │ │ [1] src/hono.ts   │  │
│  │                                      │ │ [2] src/router/…  │  │
│  └──────────────────────────────────────┘ └───────────────────┘  │
│  [ Ask your own question → ]                                     │
└──────────────────────────────────────────────────────────────────┘
```

- The screen reads `GET /api/v1/questions/:id` only. It works after the cleanup deletes the index.
- The sources are the cited chunks that the `answered_questions` row stores. Each keeps its original number.
- "Ask your own question" goes to `/r/:owner/:repo`, which shows the start card.
- A `404` shows "This answer does not exist."

**Component tree**

```
AnswerScreen                   useSharedAnswer(id)
├── SharedAnswerHeader         shared-answer/shared-answer-header.tsx
└── SourcesLayout
    ├── AnswerView             the same component as the ask panel
    ├── AskYourOwn             shared-answer/ask-your-own.tsx
    └── CitationPanel
```

### 5.4 Not found `*`

`EmptyState` with "This page does not exist." and a link to Home.

---

## 6. Folder layout

```
apps/web/
├── cloudflare.config.ts               # assets-only Worker (phase-1-plan.md, section 8)
├── vite.config.ts                     # react and tailwindcss. fixtureApi for dev, cloudflare for build
├── index.html
├── package.json
├── tsconfig.json
├── public/favicon.svg
├── fixtures/                          # the fixture API of the dev server (section 12). Node code, not in the build
│   ├── fixture-api.ts                 # the Vite plugin: serves /api/v1
│   ├── fixture-routes.ts              # one function for each gateway route
│   ├── fixture-store.ts               # the indexes and the answers, in memory
│   ├── answer-script.ts               # picks the answer for a question
│   ├── answer-stream.ts               # writes retrieval, token, and done or error
│   ├── index-timeline.ts              # the status of an index job by elapsed time
│   ├── scenarios.ts                   # the links and the questions that show one state
│   ├── send-response.ts               # JSON, the error envelope, and stream events
│   └── data/                          # chunks.json (real code at fixed commits), the answers, the seeds
└── src/
    ├── main.tsx                       # BrowserRouter, App
    ├── app.tsx                        # Routes. The repository and answer screens load as separate chunks
    ├── index.css                      # Tailwind 4 @theme tokens, surface classes, and the answer text
    ├── config/
    │   └── public-config.ts           # API_ORIGIN, TURNSTILE_SITE_KEY
    ├── shell/
    │   ├── app-shell.tsx              # the backdrop, AppHeader, and Outlet
    │   ├── app-header.tsx
    │   ├── app-logo.tsx
    │   ├── home-link.tsx              # the way back from an empty state
    │   ├── use-document-title.ts
    │   ├── use-scroll-to-top.ts
    │   ├── shell.constants.ts
    │   ├── navigation.constants.ts    # paths, INDEX_QUERY, repositoryPath, answerPath
    │   └── navigation.test.ts
    ├── github/
    │   ├── github-links.ts            # repository, commit tree, and avatar URLs
    │   ├── github-mark.tsx            # the GitHub logo. lucide-react has no brand icons
    │   ├── github-avatar.tsx          # the picture of an owner, with a letter when it fails
    │   └── commit-chip.tsx            # the short sha
    ├── screens/
    │   ├── home-screen.tsx
    │   ├── repository-screen.tsx
    │   ├── answer-screen.tsx
    │   └── not-found-screen.tsx
    ├── intake/
    │   ├── home-hero.tsx
    │   ├── repository-link-form.tsx
    │   ├── normalize-repository-link.ts   # completes owner/repo and github.com/owner/repo
    │   ├── normalize-repository-link.test.ts
    │   ├── recent-index-list.tsx
    │   ├── recent-index-row.tsx
    │   ├── intake-steps.tsx
    │   ├── start-index-card.tsx
    │   ├── use-request-index.ts
    │   ├── use-recent-indexes.ts
    │   └── intake.constants.ts
    ├── turnstile/
    │   ├── turnstile-widget.tsx
    │   ├── turnstile-state-icon.tsx
    │   ├── load-turnstile.ts          # adds the Turnstile script once
    │   └── turnstile.constants.ts     # script URL, widget options, status text
    ├── index-status/
    │   ├── repository-header.tsx
    │   ├── index-status-pill.tsx
    │   ├── index-status-card.tsx
    │   ├── stage-progress.tsx
    │   ├── index-failure-card.tsx
    │   ├── reindex-banner.tsx
    │   ├── use-index-status.ts        # polling
    │   ├── repository-view.ts         # selectRepositoryView, activeIndexIdOf
    │   ├── repository-view.test.ts
    │   ├── index-stage.ts             # isTerminalStatus, STAGE_ORDER, stageStateOf
    │   ├── index-stage.test.ts
    │   └── index-status.constants.ts  # stage labels, card text
    ├── ask/
    │   ├── ask-panel.tsx
    │   ├── question-form.tsx
    │   ├── preset-buttons.tsx
    │   ├── question-suggestions.tsx
    │   ├── feature-name-dialog.tsx
    │   ├── answer-card.tsx
    │   ├── answer-status.tsx
    │   ├── answer-view.tsx
    │   ├── citation-marker.tsx
    │   ├── share-button.tsx
    │   ├── ask-request.ts             # the request body and the question text of each kind of question
    │   ├── use-answer-stream.ts       # useReducer, AbortController
    │   ├── answer-stream-state.ts     # the reducer: pure
    │   ├── answer-stream-state.test.ts
    │   ├── link-citation-markers.ts   # [n] → [n](#citation-n)
    │   ├── link-citation-markers.test.ts
    │   └── ask.constants.ts
    ├── citations/
    │   ├── sources-layout.tsx         # the answer column and the sources column
    │   ├── citation-panel.tsx
    │   ├── citation-placeholder.tsx
    │   ├── citation-card.tsx
    │   ├── citation-card-header.tsx
    │   ├── code-lines.tsx
    │   ├── dedent-code.ts             # removes the indent that every line shares
    │   ├── dedent-code.test.ts
    │   ├── use-citation-focus.ts      # scrolls to a source and highlights it
    │   └── citations.constants.ts
    ├── shared-answer/
    │   ├── shared-answer-header.tsx
    │   ├── ask-your-own.tsx
    │   ├── use-shared-answer.ts
    │   └── shared-answer.constants.ts
    ├── services/api/
    │   ├── http-client.ts             # HttpClient, ApiError, asApiError: the only fetch
    │   ├── client.ts                  # getHttpClient
    │   ├── endpoints.ts               # INDEX_PATH, QUESTION_PATH
    │   ├── indexes.service.ts         # requestIndex, readIndex, listRecentIndexes
    │   ├── questions.service.ts       # readQuestion
    │   ├── answer-stream.service.ts   # openAnswerStream with postStream, parseEventBlock
    │   ├── http-client.test.ts
    │   ├── indexes.service.test.ts
    │   └── answer-stream.service.test.ts
    └── ui/
        ├── cn.ts
        ├── button.tsx · button.constants.ts
        ├── surface-card.tsx · surface-card.constants.ts
        ├── text-input.tsx · dialog.tsx
        ├── spinner.tsx · skeleton.tsx · empty-state.tsx · external-link.tsx
        ├── error-message.tsx · error-text.ts · error-text.test.ts
        └── format.ts · format.test.ts     # counts, the short sha, ages, and durations
```

---

## 7. Client code

### 7.1 Data flow

```
Screen ──► use-*.ts hook ──► *.service.ts ──► getHttpClient() ──► request() ──► fetch
                                                                                  │ API_ORIGIN + path
                                                                                  │ HTTPS, CORS
                                                                                  ▼
                                                                           gateway /api/v1/*
Screen ◄── data, isLoading, error ◄── response.json() or response.body ◄── 2xx ──┤
                                      ApiError ◄── toApiError ◄── 4xx, 5xx, or no response
```

### 7.2 Hooks

Each hook keeps its state with `useState` or `useReducer`. The effect of a hook drops a response that arrives after the screen left or the id changed.

- **`useRequestIndex()`** returns `{ submit, isPending, error }`. `submit(url, token)` resolves with the index view, or with `undefined` after a failure.
- **`useRecentIndexes()`** loads the list once on mount. It returns `{ indexes, isLoading, error }`.
- **`useSharedAnswer(id)`** loads one question view. A `404` gives `error.status` 404.
- **`useIndexStatus(indexId)`** reads the status, then reads it again after `STATUS_POLL_MS`, until the status is `ready` or `failed`. It clears the timer on unmount and when the index id changes.
  - A read that fails for a reason other than `404` does not stop the polling. The last good view stays on the screen.
  - `watch(view)` shows the view that a request returned, then starts the polling again. The retry of a failed index uses it, because the index id stays the same.

```
Browser                              Gateway                     Pipeline
  GET /api/v1/indexes/:id ─────────────► queued
     … 2 s
  GET /api/v1/indexes/:id ─────────────► parsing                ◄── Workflow marks parsing
     … 2 s
  GET /api/v1/indexes/:id ─────────────► embedding              ◄── Workflow marks embedding
     … 2 s
  GET /api/v1/indexes/:id ─────────────► ready                  ◄── Workflow marks ready
  polling stops · the ask panel shows
```

- **Messages.** A component shows `error.message` as is. The gateway owns that wording. The UI adds 2 texts:
  - `rate_limited`: "Try again in N minutes."
  - `network`: "Repotron could not reach the server. Check the connection and try again."

### 7.3 Answer stream

`answer-stream.service.ts` calls `getHttpClient().postStream(...)`, so the stream uses the same `request` function and the same `toApiError` as the JSON calls. `EventSource` does not fit, because it cannot send a `POST` with a body.

```
RepositoryScreen      use-answer-stream          answer-stream.service.ts           gateway
  ask(body) ────────► abort the earlier stream
                      dispatch started
                      for await (event) ◄─────── openAnswerStream
                                                   postStream ─────────────── POST /api/v1/indexes/:id/questions
                                                   not 2xx → request throws ApiError (JSON envelope)
                                                   201 → body → TextDecoder
                                                   split at each blank line
                                                   parseEventBlock → schema of the event
  sources  ◄───────── dispatch retrieval ◄────────────────────────────── event: retrieval
  text     ◄───────── dispatch token × n ◄────────────────────────────── event: token
  Share    ◄───────── dispatch done      ◄────────────────────────────── event: done
  error    ◄───────── dispatch failed    ◄──── event: error, or a thrown ApiError
```

**State of the ask panel** (`ask/answer-stream-state.ts`):

```
          ask()               retrieval             first token              done
  idle ─────────► waiting ─────────────► retrieved ─────────────► streaming ────────► done
                    │                        │                         │
                    └────── ApiError ────────┴────── error event ──────┴──────► failed

  any state ── ask() ──► waiting   (the hook aborts the earlier stream)
  the index id changes ──► idle    (the hook aborts the stream)
```

- `waiting` shows placeholder lines in the answer area and placeholder cards in the sources column.
- `retrieved` shows the sources and placeholder lines in the answer area.
- `streaming` shows the text with a cursor.
- `done` shows the answer time and the Share button.
- `failed` shows `ErrorMessage` with the message and a "Try again" button. The text and the sources stay when they arrived.
- A stream that closes with no `done` event and no `error` event counts as a network failure.

**`parseEventBlock(block)`** reads the `event:` line and the `data:` lines of one block. It joins 2 or more data lines with a newline. It parses the data with the schema of that event from `repotron-domain`. An unknown event name throws. The reader keeps a buffer, because one network chunk can end in the middle of a block.

### 7.4 Turnstile

```
TurnstileWidget mounts
  ├─ loadTurnstileScript()           adds api.js?render=explicit once for the whole app
  └─ turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: interaction-only    the widget shows only when the user must act
        callback(token)          → onToken(token)   the button turns on
        expired-callback()       → onToken(null)    a token expires after 300 seconds
        error-callback()         → onToken(null)    the status line shows the failure
     })
the parent posts with the token
  └─ after each response, the parent changes resetKey → turnstile.reset(widgetId)
TurnstileWidget unmounts → turnstile.remove(widgetId)
```

- The script URL is `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`. It lives in `turnstile/turnstile.constants.ts`.
- The widget domain is the host of the web URL (phase-1-plan.md, stage 2).
- The widget shows one status line under the field. The widget of Cloudflare appears under that line only when a challenge needs the user.
- On the dev server, `TURNSTILE_SITE_KEY` is the test key of Cloudflare, `1x00000000000000000000AA`. It passes on every host, so the real widget code runs on `localhost`.

### 7.5 Answer text and citation markers

- `AnswerView` renders the answer with `react-markdown`, because the model writes Markdown with code spans and lists.
  - The renderer gets no raw HTML plugin, so text from a repository cannot add HTML to the page.
  - The default URL filter of `react-markdown` removes `javascript:` links.
- `linkCitationMarkers(text, sourceNumbers)` changes each `[n]` into `[n](#citation-n)` before the render.
  - It changes only a number that the sources panel shows. Any other number stays as text. The shared answer shows only the cited sources, so the list of numbers can have gaps.
  - It skips code spans and code blocks, also a code block that the stream did not close yet.
  - It changes the space before a marker into a no-break space, so a number never starts a line apart from its claim.
- A link to `#citation-n` renders as `CitationMarker`, an inline link with the label "Source n". A select scrolls to the source and keeps the address of the page. Every other link opens in a new tab with `rel="noopener noreferrer"`.
- The stream re-renders the Markdown on each token. When a long answer becomes slow, batch the tokens to one render for each animation frame.

### 7.6 Constants

- `shell/navigation.constants.ts`
  - `HOME_PATH` (`/`), `REPOSITORY_ROUTE` (`/r/:owner/:repo`), and `ANSWER_ROUTE` (`/a/:id`)
  - `INDEX_QUERY` (`index`)
  - `repositoryPath(owner, repo, indexId?)` and `answerPath(questionId)`
- `services/api/endpoints.ts`
  - `INDEX_PATH`: `LIST` (`/api/v1/indexes`), `byId(id)`, and `questions(indexId)`
  - `QUESTION_PATH`: `byId(id)`
- `<feature>.constants.ts` — the labels and the messages of that feature, such as `ASK.PLACEHOLDER` and `INDEX_STATUS_TEXT.FAILED_TITLE`
- `config/public-config.ts` — `API_ORIGIN` and `TURNSTILE_SITE_KEY`. Both values are public. On the dev server, `API_ORIGIN` is empty and the site key is the test key (section 12).

### 7.7 Styles

- Tailwind 4 reads the tokens from `@theme` in `index.css`. It needs no `tailwind.config.js`.
  - The tokens name a role, not a color: `canvas`, `surface`, `sunken`, `line`, `ink`, `mute`, `faint`, and `accent`. A dark theme later changes only the token values.
  - `mute` is the lightest color for text that a person must read. `faint` is for icons, placeholders, and line numbers.
- `index.css` also holds the 2 surface classes, `surface-card` and `surface-raised`, as in closetza. `SurfaceCard` picks one from `SURFACE_ELEVATION`.
  - `field-shell` gives a field with an inner button one focus ring. `answer-prose` styles the Markdown of an answer. `shell-backdrop` draws the grid and the glow behind the header.
- `cn()` joins the class names that are set, as in closetza. It adds no merge library.
- Icons come from `lucide-react`, as in closetza. It has no brand icons, so `github/github-mark.tsx` holds the GitHub logo.
- The text font comes from `@fontsource-variable/dm-sans`, as in closetza. Code uses `ui-monospace`.
- `CodeLines` numbers each line from the start line of the chunk. It scrolls sideways for a long line and stops at a maximum height.
  - It removes the indent that every line shares. A method keeps the indent of its class in the index, and that space is wasted in a narrow panel.
- Motion is short and has one purpose each: a screen rises in, a placeholder shimmers, the active stage pulses, and the cursor of a streamed answer blinks. `prefers-reduced-motion` turns each one off.

### 7.8 Accessibility

- Each input has a visible label. The question box is the exception: its label is for screen readers, and the placeholder states the purpose.
- The status card and the answer area use `aria-live="polite"`. `ErrorMessage` uses `role="alert"`.
- Each button shows a focus ring.
- `Dialog` has `role="dialog"` and `aria-modal="true"`. Escape closes it.

---

## 8. Dependencies

- No HTTP library. `http-client.ts` uses the `fetch` of the browser.
- `react`, `react-dom`, and `react-router-dom`, at the Mailer versions
- `react-markdown` — the answer text. It is new to the user's repositories.
- `lucide-react` and `@fontsource-variable/dm-sans`, as in closetza
- `repotron-domain` — the types, the schemas, the closed sets, the limits, and `parseRepositoryLink`
- Dev: `tsx` for the tests, as in closetza. Also `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `cf`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `oxlint`, `@types/react`, and `@types/react-dom`.

---

## 9. Unit tests

The test script copies closetza: `node --experimental-test-module-mocks --import tsx --test "src/**/*.test.ts" "fixtures/**/*.test.ts"`. The tests cover the services, the pure modules, and the fixture API. No test renders a component in Phase 1. The fixture dev server and the staging checks prove the screens.

- **The fetch fake.** A test of `http-client.ts` calls `t.mock.method(globalThis, 'fetch', …)`. The fake returns a fixed `Response`, or throws. `node:test` restores the real `fetch` after the test.
- **The client mock.** A service test calls `mock.module('./client', …)` so that `getHttpClient()` returns a fake `HttpClient` that records each call. Then it imports the service. The service test needs no `fetch`.
  - `client.ts` reads `import.meta.env` through `public-config.ts`, and Node has no Vite env. A test of a module that imports `client.ts` needs this mock.

Tests:

- **`services/api/http-client.ts`**
  - `when the response holds the error envelope, then the error keeps its code and message`
  - `when a 429 response has Retry-After, then the error sets retryAfterSeconds`
  - `when no response arrives, then the error code is network`
  - `when the caller aborts the request, then the AbortError passes through unchanged`
  - `when postStream gets a 201, then it returns the response body`
- **`services/api/indexes.service.ts`**
  - `when requestIndex runs, then it posts the link and the token to the indexes path`
  - `when readIndex runs, then it gets the path of that index`
- **`services/api/answer-stream.service.ts`**
  - `when a block holds a retrieval event, then parseEventBlock returns its citations`
  - `when a block holds 2 data lines, then parseEventBlock joins them with a newline`
  - `when a chunk ends inside a block, then the reader waits for the rest of the block`
  - `when the event name is unknown, then parseEventBlock throws`
- **`ask/answer-stream-state.ts`**
  - `when a token arrives while streaming, then the reducer appends its text`
  - `when an error event arrives, then the reducer keeps the sources and moves to failed`
- **`ask/link-citation-markers.ts`**
  - `when a marker is in range, then it becomes a citation link`
  - `when a marker is out of range, then it stays text`
  - `when a marker is inside a code span, then it stays text`
- **`index-status/index-stage.ts`**
  - `when the status is ready or failed, then isTerminalStatus returns true`
- **`index-status/repository-view.ts`**
  - `when the URL holds no index id, then the view is the start card`
  - `when the index job runs and an earlier index is ready, then the view keeps the ask panel`
- **`shell/navigation.constants.ts`**
  - `when an index id is given, then repositoryPath adds the index query value`
- **`intake/normalize-repository-link.ts`**
  - `when the value is the short form, then it becomes the full link`
- **`ui/error-text.ts`**
  - `when the rate limit has a wait time, then the text adds the minutes`
- **`ui/format.ts`**
  - `when the time is hours old, then formatRelativeTime uses whole hours`
- **`fixtures/`**
  - `when the store starts, then each recent index matches the schema of the gateway`
  - `when the hono fixture is checked, then each answer cites a chunk that exists`
  - `when a failed index is requested again, then the job restarts with the same id`

The lists above name the main case of each file. Each test file holds more cases.

---

## 10. Build order

Each step belongs to a stage of [phase-1-plan.md](phase-1-plan.md), section 7. The stage runs its local check and its staging check.

- **Stage 8: Gateway and web foundation**
  - `package.json`, the configs, `main.tsx`, `app.tsx`, `index.css`, `AppShell`, and `AppHeader`
  - `cn`, `Button`, `SurfaceCard`, `Spinner`, `EmptyState`, `ErrorMessage`, and `ExternalLink`
  - `public-config.ts`, `http-client.ts`, `client.ts`, `endpoints.ts`, and `navigation.constants.ts`
  - `NotFoundScreen`, and a `HomeScreen` that shows the result of `GET /health`
- **Stage 9: Intake**
  - `TurnstileWidget` and `load-turnstile.ts`
  - `indexes.service.ts`, `useRequestIndex`, `useRecentIndexes`, and `useIndexStatus`
  - `RepositoryLinkForm`, `RecentIndexList`, `RecentIndexRow`, and the real `HomeScreen`. Delete the health call of stage 8.
  - `RepositoryScreen` with `StartIndexCard`, `RepositoryHeader`, `IndexStatusCard`, `StageProgress`, and `IndexFailureCard`
  - UI staging check: a reload of `/r/:owner/:repo?index=<id>` keeps the status and asks for no Turnstile check.
- **Stage 12: Ask**
  - `answer-stream.service.ts`, `answer-stream-state.ts`, and `use-answer-stream.ts`
  - `AskPanel`, `QuestionForm`, `TextArea`, `AnswerView`, and `link-citation-markers.ts`
  - `CitationPanel`, `CitationCard`, `CitationCardHeader`, and `CodeLines`
  - UI staging check: a select on `[n]` scrolls to source `n`. Below the `lg` width, the sources go under the answer.
- **Stage 13: Share and presets**
  - `PresetButtons`, `Dialog`, `FeatureNameDialog`, `ShareButton`, `questions.service.ts`, `useSharedAnswer`, `AnswerScreen`, and `SharedAnswerHeader`
- **Stage 14: New commit and cleanup**
  - `ReindexBanner`, and the fallback branch of `RepositoryScreen`

---

## 11. Risks and open questions

- **The answer clears when the new index becomes ready.** The ask panel follows the active index id, so a switch from the fallback index to the new index resets the panel. A finished answer is still on its share link. Stage 14 checks how often this happens.
- **Markdown cost.** The build splits the repository screen and the shared answer from the home screen. The chunk with `react-markdown` is 127 kB, and 39 kB with gzip. I did not measure the render time of a long streamed answer. Stage 12 measures it.
- **Turnstile on `workers.dev`.** I did not test the widget on a `workers.dev` host. The staging check of stage 9 proves it. The dev server proves only the test key.
- **A hidden Turnstile widget.** With `interaction-only`, a user who needs a challenge sees the widget appear under the status line. I did not see a real challenge. The staging check of stage 9 must force one.
- **No component tests.** A layout bug shows only on the fixture dev server and in the staging checks. Phase 2 can add a browser test when the screens settle.
- **Fixture drift.** The fixture API copies the routes, the status codes, and the messages of the gateway by hand. A gateway change needs the same change in `apps/web/fixtures`. The fixture tests check the views against the schemas of `repotron-domain`, not against the gateway code.
- **One theme.** The app has a light theme only. The color tokens name roles, so a dark theme is a change of token values.
- **No syntax colors.** `CodeLines` shows plain text. A citation holds no language, so colors need the language from the file path, and a highlighter library.

---

## 12. Local fixtures

`pnpm --filter web dev` serves the app at `http://localhost:5173`. The Vite dev server answers `/api/v1` from `apps/web/fixtures`. It needs no gateway, no secret, and no Cloudflare resource.

```
Browser ──► fetch /api/v1/…  (API_ORIGIN is empty on the dev server)
              │
              ▼
Vite dev server ── fixtureApi plugin ──► fixture-routes ──► FixtureStore (memory)
                                              │
                                              └─► answer-stream: retrieval, token × n, done or error
```

- **What is real.** The app code is the production code: `http-client.ts`, the error envelope, the `Retry-After` header, the stream parser, the polling, and the Turnstile widget with the test key of Cloudflare.
- **What is fixed.** The answers, the index progress, and the errors.
- **The deployed site serves the fixture files.** `API_ORIGIN` is empty, so the browser calls `/api/v1` on the web Worker. The dev server uses the Vite plugin. The deploy uses `fixtures/fixture-worker.ts` for those same routes.
- **The data lives in memory.** A restart of the dev server, or a change to a fixture file, clears each index and each answer that the session made.

### 12.1 Repositories

- `honojs/hono` and `pallets/flask` hold real code at a fixed commit, in `fixtures/data/chunks.json`. The line numbers match the files, so each GitHub link opens.
  - Questions with a topic word get a specific answer. For hono: `router`, `middleware`, and `request`. For flask: `route` and `request`.
  - "Explain a feature" knows `CORS` and `routing` for hono, and `routing` for flask. Any other feature gets the not-found answer.
- `tokio-rs/axum`, `gin-gonic/gin`, `expressjs/express`, and each new link get generated Markdown chunks. The commit sha is not real, so those GitHub links do not open.
- Each new link takes about 12 seconds to index: queued, parsing, embedding, then ready.
- `/a/7f3a9c2e41d84b0fa6c5e8d19b3f2a67` and `/a/c41e8a7d2b9f4063a5d7e1f08b6c3d92` are shared answers that exist after each restart.

### 12.2 Links that show one state

Paste one of these links on the home screen, or open `/r/fixtures/<name>`.

- `https://github.com/fixtures/private` — `404`, the repository does not exist or is private
- `https://github.com/fixtures/too-large` — `400`, larger than 500 MB
- `https://github.com/fixtures/too-many-files` — `400`, more than 20,000 files
- `https://github.com/fixtures/rate-limited` — `429`, with a wait time
- `https://github.com/fixtures/github-down` — `503`, GitHub is unavailable
- `https://github.com/fixtures/turnstile-failed` — `403`, the Turnstile check failed
- `https://github.com/fixtures/fails-parsing` — the index fails at the parsing stage. Retry makes it ready.
- `https://github.com/fixtures/slow` — the index takes 60 seconds
- `https://github.com/fixtures/new-commit` — a newer commit indexes for 35 seconds, and an earlier index answers the questions

### 12.3 Questions that show one state

Type one of these texts as the question.

- `/error` — the model fails after the first part of the answer
- `/limit` — the hourly question limit, with a wait time
- `/offline` — the connection drops
- `/none` — the repository does not hold the answer
- `/slow` — the sources and the first token arrive late
- `/long` — the answer is 4 times as long

`fixtures/scenarios.ts` holds both lists.
