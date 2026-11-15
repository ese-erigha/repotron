-- Trigger a staging deploy.
CREATE TABLE github_repositories (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE repository_indexes (
  id TEXT PRIMARY KEY NOT NULL,
  repository_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  status TEXT NOT NULL,
  failed_stage TEXT,
  failure_reason TEXT,
  file_count INTEGER,
  chunk_count INTEGER,
  embedding_model_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ready_at INTEGER,
  last_question_at INTEGER,
  FOREIGN KEY (repository_id) REFERENCES github_repositories (id)
);

CREATE INDEX repository_indexes_repository_created ON repository_indexes (repository_id, created_at);

CREATE TABLE source_chunks (
  id TEXT PRIMARY KEY NOT NULL,
  index_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  symbol TEXT,
  kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  identifiers TEXT NOT NULL,
  FOREIGN KEY (index_id) REFERENCES repository_indexes (id)
);

CREATE INDEX source_chunks_index_path ON source_chunks (index_id, path);

CREATE TABLE answered_questions (
  id TEXT PRIMARY KEY NOT NULL,
  index_id TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  preset TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations TEXT NOT NULL,
  embedding_model_id TEXT NOT NULL,
  answer_model_id TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  retrieval_ms INTEGER NOT NULL,
  first_token_ms INTEGER,
  answer_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
