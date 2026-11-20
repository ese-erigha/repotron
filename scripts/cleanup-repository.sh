#!/usr/bin/env bash
# Deletes one repository from staging: Vectorize vectors, R2 batches, then the D1 rows.
# The repository id is github_repositories.id, the numeric GitHub id stored as text.
# Run it with `pnpm exec bash scripts/cleanup-repository.sh <repository id>`.
# Vectors go first. A failed page stops the script, and the D1 rows are still there.
set -euo pipefail

readonly DATABASE_NAME=repotron-staging-db
readonly VECTOR_INDEX=repotron-staging-chunks
readonly BUCKET=repotron-staging-batches
readonly PAGE_SIZE=100
readonly R2_PAGE_SIZE=1000

repository_id="${1:-}"
if [[ ! "$repository_id" =~ ^[0-9]+$ ]]; then
  echo "Usage: scripts/cleanup-repository.sh <github repository id>" >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

database_id() {
  cf d1 list --name "$DATABASE_NAME" | jq -r --arg name "$DATABASE_NAME" '.[] | select(.name == $name) | .uuid'
}

query() {
  cf d1 query "$1" --sql "$2"
}

# cf d1 query prints one result object per statement. Each object holds .results.
column() {
  jq -r 'if (.[0].results | type) == "array" then .[0].results[].id else error("The D1 response has no results.") end'
}

require_database() {
  local id
  id=$(database_id)
  if [[ -z "$id" || "$id" == "null" ]]; then
    echo "D1 database $DATABASE_NAME was not found." >&2
    exit 1
  fi
  printf '%s' "$id"
}

load_index_ids() {
  query "$1" "SELECT id FROM repository_indexes WHERE repository_id = '${repository_id}' ORDER BY id" | column >"$work/indexes"
}

load_chunk_ids() {
  query "$1" "SELECT source_chunks.id AS id FROM source_chunks INNER JOIN repository_indexes ON source_chunks.index_id = repository_indexes.id WHERE repository_indexes.repository_id = '${repository_id}' ORDER BY source_chunks.id" | column >"$work/chunks"
}

repository_exists() {
  local found
  found=$(query "$1" "SELECT id FROM github_repositories WHERE id = '${repository_id}'" | column)
  [[ -n "$found" ]]
}

delete_vector_pages() {
  local -a page=()
  local id count=0
  if [[ ! -s "$work/chunks" ]]; then
    echo "No chunk rows."
    return
  fi
  while IFS= read -r id; do
    page+=("$id")
    if ((${#page[@]} == PAGE_SIZE)); then
      count=$((count + PAGE_SIZE))
      echo "Deleting ${#page[@]} vectors (${count} so far)."
      cf vectorize delete-by-ids "$VECTOR_INDEX" --ids "${page[@]}" >/dev/null
      page=()
    fi
  done <"$work/chunks"
  if ((${#page[@]} > 0)); then
    count=$((count + ${#page[@]}))
    echo "Deleting ${#page[@]} vectors (${count} so far)."
    cf vectorize delete-by-ids "$VECTOR_INDEX" --ids "${page[@]}" >/dev/null
  fi
}

object_keys() {
  jq -r '
    if type == "array" then .[].key
    elif (.result | type) == "array" then .result[].key
    elif (.objects | type) == "array" then .objects[].key
    else "INVALID"
    end
  '
}

delete_batches() {
  local index_id prefix start_after="" page keys key count
  if [[ ! -s "$work/indexes" ]]; then
    echo "No index rows."
    return
  fi
  while IFS= read -r index_id; do
    prefix="indexes/${index_id}/"
    start_after=""
    echo "Deleting R2 objects under ${prefix}."
    while true; do
      if [[ -n "$start_after" ]]; then
        page=$(cf r2 objects list --bucket-name "$BUCKET" --prefix "$prefix" --per-page "$R2_PAGE_SIZE" --start-after "$start_after")
      else
        page=$(cf r2 objects list --bucket-name "$BUCKET" --prefix "$prefix" --per-page "$R2_PAGE_SIZE")
      fi
      keys=$(printf '%s' "$page" | object_keys)
      if [[ "$keys" == "INVALID" ]]; then
        echo "The R2 list response has no object keys." >&2
        printf '%s\n' "$page" >&2
        exit 1
      fi
      if [[ -z "$keys" ]]; then
        break
      fi
      count=0
      while IFS= read -r key; do
        cf r2 objects delete "$key" --bucket-name "$BUCKET" >/dev/null
        start_after="$key"
        count=$((count + 1))
      done <<<"$keys"
      if ((count < R2_PAGE_SIZE)); then
        break
      fi
    done
  done <"$work/indexes"
}

delete_keyword_pages() {
  local -a page=()
  local id list
  if [[ ! -s "$work/chunks" ]]; then
    return
  fi
  while IFS= read -r id; do
    page+=("'$id'")
    if ((${#page[@]} == PAGE_SIZE)); then
      list=$(IFS=,; echo "${page[*]}")
      query "$1" "DELETE FROM chunk_keywords WHERE chunk_id IN (${list})" >/dev/null
      echo "Deleted ${#page[@]} keyword rows."
      page=()
    fi
  done <"$work/chunks"
  if ((${#page[@]} > 0)); then
    list=$(IFS=,; echo "${page[*]}")
    query "$1" "DELETE FROM chunk_keywords WHERE chunk_id IN (${list})" >/dev/null
    echo "Deleted ${#page[@]} keyword rows."
  fi
}

delete_chunk_pages() {
  local -a page=()
  local id list
  if [[ ! -s "$work/chunks" ]]; then
    return
  fi
  while IFS= read -r id; do
    page+=("'$id'")
    if ((${#page[@]} == PAGE_SIZE)); then
      list=$(IFS=,; echo "${page[*]}")
      query "$1" "DELETE FROM source_chunks WHERE id IN (${list})" >/dev/null
      echo "Deleted ${#page[@]} chunk rows."
      page=()
    fi
  done <"$work/chunks"
  if ((${#page[@]} > 0)); then
    list=$(IFS=,; echo "${page[*]}")
    query "$1" "DELETE FROM source_chunks WHERE id IN (${list})" >/dev/null
    echo "Deleted ${#page[@]} chunk rows."
  fi
}

delete_remaining_rows() {
  local db=$1
  query "$db" "DELETE FROM answered_questions WHERE index_id IN (SELECT id FROM repository_indexes WHERE repository_id = '${repository_id}')" >/dev/null
  query "$db" "DELETE FROM repository_indexes WHERE repository_id = '${repository_id}'" >/dev/null
  query "$db" "DELETE FROM github_repositories WHERE id = '${repository_id}'" >/dev/null
  echo "Deleted the index rows and the repository row."
}

main() {
  local db
  db=$(require_database)
  if ! repository_exists "$db"; then
    echo "Repository ${repository_id} is not in ${DATABASE_NAME}." >&2
    exit 1
  fi
  load_index_ids "$db"
  load_chunk_ids "$db"
  delete_vector_pages
  delete_batches
  delete_keyword_pages "$db"
  delete_chunk_pages "$db"
  delete_remaining_rows "$db"
  echo "Repository ${repository_id} is removed from staging."
}

main
