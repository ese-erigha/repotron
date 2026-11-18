CREATE VIRTUAL TABLE chunk_keywords USING fts5(
  chunk_id UNINDEXED,
  index_id UNINDEXED,
  content,
  identifiers,
  tokenize = "unicode61 tokenchars '_'"
);

CREATE TRIGGER source_chunks_insert_keywords
AFTER INSERT ON source_chunks
BEGIN
  INSERT INTO chunk_keywords(chunk_id, index_id, content, identifiers)
  VALUES (new.id, new.index_id, new.content, new.identifiers);
END;

CREATE TRIGGER source_chunks_delete_keywords
AFTER DELETE ON source_chunks
BEGIN
  DELETE FROM chunk_keywords WHERE chunk_id = old.id;
END;

INSERT INTO chunk_keywords(chunk_id, index_id, content, identifiers)
SELECT id, index_id, content, identifiers FROM source_chunks;
