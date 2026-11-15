import json

import boto3

from indexer.limits import CHUNK_BATCH_SIZE


def number_chunks(chunks: list[dict[str, object]], index_id: str) -> list[dict[str, object]]:
    numbered: list[dict[str, object]] = []
    for seq, chunk in enumerate(chunks):
        row = dict(chunk)
        row["seq"] = seq
        row["id"] = f"{index_id}:{seq}"
        numbered.append(row)
    return numbered


def group_batches(chunks: list[dict[str, object]]) -> list[list[dict[str, object]]]:
    return [
        chunks[start : start + CHUNK_BATCH_SIZE]
        for start in range(0, len(chunks), CHUNK_BATCH_SIZE)
    ]


def write_batches(
    chunks: list[dict[str, object]],
    index_id: str,
    bucket: str,
    endpoint: str,
    access_key_id: str,
    secret_access_key: str,
) -> list[str]:
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="auto",
    )
    keys: list[str] = []
    for number, batch in enumerate(group_batches(number_chunks(chunks, index_id))):
        key = f"indexes/{index_id}/batch-{number}.jsonl"
        body = "".join(f"{json.dumps(chunk, ensure_ascii=False)}\n" for chunk in batch)
        client.put_object(Bucket=bucket, Key=key, Body=body.encode())
        keys.append(key)
    return keys
