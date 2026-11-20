#!/usr/bin/env bash
# Creates each staging resource that CI can create. A resource that exists stays as it is.
# CI runs it with `pnpm exec bash scripts/ensure-resources-staging.sh`, so `cf` is the root dev dependency.
set -euo pipefail

readonly BUCKET=repotron-staging-batches
readonly BUCKET_LOCATION=enam
readonly VECTOR_INDEX=repotron-staging-chunks
readonly VECTOR_DIMENSIONS=1024
readonly VECTOR_METRIC=cosine
readonly METADATA_PROPERTIES=(path language kind)
readonly METADATA_TYPE=string
readonly AI_GATEWAY=repotron-staging-ai-gateway
readonly NOT_FOUND='404 Not Found'

# Returns 0 when the resource exists and 1 when cf reports 404.
# Any other failure, such as a bad token, stops the script, so a create never hides it.
resource_exists() {
  local errors
  errors=$(mktemp)
  if cf "$@" >/dev/null 2>"$errors"; then
    rm -f "$errors"
    return 0
  fi
  if grep -q "$NOT_FOUND" "$errors"; then
    rm -f "$errors"
    return 1
  fi
  cat "$errors" >&2
  rm -f "$errors"
  exit 1
}

ensure_bucket() {
  if resource_exists r2 buckets get "$BUCKET"; then
    echo "R2 bucket $BUCKET exists."
    return
  fi
  cf r2 buckets create --name "$BUCKET" --location-hint "$BUCKET_LOCATION" >/dev/null
  echo "Created R2 bucket $BUCKET."
}

ensure_vector_index() {
  if resource_exists vectorize get "$VECTOR_INDEX"; then
    echo "Vectorize index $VECTOR_INDEX exists."
    return
  fi
  cf vectorize create \
    --name "$VECTOR_INDEX" \
    --index-config-dimensions "$VECTOR_DIMENSIONS" \
    --index-config-metric "$VECTOR_METRIC" >/dev/null
  echo "Created Vectorize index $VECTOR_INDEX."
}

ensure_metadata_indexes() {
  local existing
  existing=$(cf vectorize metadata-index list --index-name "$VECTOR_INDEX" | jq -r '.metadataIndexes[].propertyName')
  for property in "${METADATA_PROPERTIES[@]}"; do
    if grep -qx "$property" <<<"$existing"; then
      echo "Metadata index $property exists."
      continue
    fi
    cf vectorize metadata-index create "$VECTOR_INDEX" \
      --property-name "$property" \
      --index-type "$METADATA_TYPE" >/dev/null
    echo "Created metadata index $property."
  done
}

# Caching and gateway rate limits stay off. The answers depend on the question,
# and the RateLimiter Durable Object in the gateway owns the limits.
ensure_ai_gateway() {
  if resource_exists ai-gateway gateways get "$AI_GATEWAY"; then
    echo "AI Gateway $AI_GATEWAY exists."
    return
  fi
  cf ai-gateway gateways create \
    --id "$AI_GATEWAY" \
    --collect-logs true \
    --cache-ttl 0 \
    --cache-invalidate-on-update false \
    --rate-limiting-interval 0 \
    --rate-limiting-limit 0 >/dev/null
  echo "Created AI Gateway $AI_GATEWAY."
}

ensure_bucket
ensure_vector_index
ensure_metadata_indexes
ensure_ai_gateway
