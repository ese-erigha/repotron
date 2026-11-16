-- Prefer scripts/cleanup-repository.sh. It deletes the vectors and the R2 batches, then these rows.
-- Replace REPLACE_WITH_REPOSITORY_ID with github_repositories.id.
-- That value is the numeric GitHub repository id, stored as text.
-- Run the statements in this order. The foreign keys have no ON DELETE CASCADE.
-- These statements delete D1 rows only.

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
