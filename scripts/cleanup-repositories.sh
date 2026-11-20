#!/usr/bin/env bash
# Deletes the named repositories from staging.
# Pass github_repositories.id values separated by commas.
# Run it with `pnpm exec bash scripts/cleanup-repositories.sh 1,2,3`.
# D1 deletes remove every row. Vectors for the named repositories go first.
# A failed vector page stops the script, and the D1 rows are still there.
set -euo pipefail

readonly DATABASE_NAME=repotron-staging-db
readonly VECTOR_INDEX=repotron-staging-chunks
readonly BUCKET=repotron-staging-batches
readonly INDEXING_WORKFLOW=repotron-staging-repository-indexing
readonly DELETION_WORKFLOW=repotron-staging-index-deletion
readonly PAGE_SIZE=100
readonly R2_PAGE_SIZE=1000

raw_ids="${1:-}"
if [[ -z "$raw_ids" ]]; then
  echo "Usage: scripts/cleanup-repositories.sh <id,id,id>" >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

: >"$work/repository-ids"
IFS=',' read -r -a parts <<<"$raw_ids"
for part in "${parts[@]}"; do
  id="${part// /}"
  if [[ ! "$id" =~ ^[0-9]+$ ]]; then
    echo "Each id must be digits. Received '${part}'." >&2
    exit 1
  fi
  printf '%s\n' "$id" >>"$work/repository-ids"
done

database_id() {
  cf d1 list --name "$DATABASE_NAME" | jq -r --arg name "$DATABASE_NAME" '.[] | select(.name == $name) | .uuid'
}

query() {
  cf d1 query "$1" --sql "$2"
}

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

quoted_list() {
  local file=$1
  local first=1 id
  if [[ ! -s "$file" ]]; then
    return 1
  fi
  while IFS= read -r id; do
    if ((first)); then
      printf "'%s'" "$id"
      first=0
    else
      printf ",'%s'" "$id"
    fi
  done <"$file"
}

load_index_ids() {
  local repos
  repos=$(quoted_list "$work/repository-ids")
  query "$1" "SELECT id FROM repository_indexes WHERE repository_id IN (${repos}) ORDER BY id" | column >"$work/indexes"
}

load_chunk_ids() {
  local repos
  repos=$(quoted_list "$work/repository-ids")
  query "$1" "SELECT source_chunks.id AS id FROM source_chunks INNER JOIN repository_indexes ON source_chunks.index_id = repository_indexes.id WHERE repository_indexes.repository_id IN (${repos}) ORDER BY source_chunks.id" | column >"$work/chunks"
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

delete_workflow_instance() {
  local workflow=$1
  local instance=$2
  local output
  if output=$(cf workflows instances delete "$instance" --workflow-name "$workflow" --force 2>&1); then
    printf '%s\n' "$output"
    echo "Deleted workflow instance ${instance}."
    return
  fi
  if printf '%s\n' "$output" | grep -qi "not found"; then
    echo "Workflow instance ${instance} is already gone."
    return
  fi
  printf '%s\n' "$output" >&2
  exit 1
}

delete_workflow_instances() {
  local repo_id index_id instance
  if [[ -s "$work/indexes" ]]; then
    while IFS= read -r index_id; do
      delete_workflow_instance "$INDEXING_WORKFLOW" "$index_id"
      delete_workflow_instance "$DELETION_WORKFLOW" "delete-${index_id}"
    done <"$work/indexes"
  else
    echo "No index rows."
  fi
  while IFS= read -r repo_id; do
    while IFS= read -r instance; do
      [[ -z "$instance" ]] && continue
      delete_workflow_instance "$INDEXING_WORKFLOW" "$instance"
    done < <(workflow_instance_ids "$INDEXING_WORKFLOW" "${repo_id}-")
    while IFS= read -r instance; do
      [[ -z "$instance" ]] && continue
      delete_workflow_instance "$DELETION_WORKFLOW" "$instance"
    done < <(workflow_instance_ids "$DELETION_WORKFLOW" "delete-${repo_id}-")
  done <"$work/repository-ids"
}

workflow_instance_ids() {
  local workflow=$1
  local prefix=$2
  cf workflows instances list --workflow-name "$workflow" | sed -n '/^\[/,$p' | jq -r --arg prefix "$prefix" '.[] | .id | select(startswith($prefix))'
}

delete_rows() {
  local db=$1
  query "$db" "DELETE FROM chunk_keywords" >/dev/null
  echo "Deleted every keyword row."
  query "$db" "DELETE FROM source_chunks" >/dev/null
  echo "Deleted every chunk row."
  query "$db" "DELETE FROM answered_questions" >/dev/null
  echo "Deleted every answer row."
  query "$db" "DELETE FROM repository_indexes" >/dev/null
  echo "Deleted every index row."
  query "$db" "DELETE FROM github_repositories" >/dev/null
  echo "Deleted every repository row."
}

main() {
  local db
  db=$(require_database)
  load_index_ids "$db"
  load_chunk_ids "$db"
  delete_vector_pages
  delete_batches
  delete_workflow_instances
  delete_rows "$db"
  echo "Repositories $(paste -sd, "$work/repository-ids") are removed from staging."
}

main
