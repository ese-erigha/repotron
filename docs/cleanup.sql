-- Prefer scripts/cleanup-repository.sh. It deletes the vectors and the R2 batches, then these rows.
-- Replace REPLACE_WITH_REPOSITORY_ID with github_repositories.id.
-- That value is the numeric GitHub repository id, stored as text.
-- Run the statements in this order. The foreign keys have no ON DELETE CASCADE.
-- These statements delete rows only. Keep every table. Do not run DROP TABLE.
-- Delete chunk_keywords rows before source_chunks rows.
-- The source_chunks delete trigger also removes chunk_keywords rows.
-- The row delete clears the content in the FTS shadow tables. Those tables stay.

DELETE FROM chunk_keywords
WHERE index_id IN (
  SELECT id FROM repository_indexes WHERE repository_id = 'REPLACE_WITH_REPOSITORY_ID'
);

DELETE FROM source_chunks
WHERE index_id IN (
  SELECT id FROM repository_indexes WHERE repository_id = 'REPLACE_WITH_REPOSITORY_ID'
);

DELETE FROM answered_questions
WHERE index_id IN (
  SELECT id FROM repository_indexes WHERE repository_id = 'REPLACE_WITH_REPOSITORY_ID'
);

DELETE FROM repository_indexes
WHERE repository_id = 'REPLACE_WITH_REPOSITORY_ID';

DELETE FROM github_repositories
WHERE id = 'REPLACE_WITH_REPOSITORY_ID';
