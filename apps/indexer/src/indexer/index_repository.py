import os
import shutil
import tempfile
from pathlib import Path

from indexer.chunk_code import chunk_code
from indexer.chunk_text import chunk_text
from indexer.fetch_tarball import fetch_tarball
from indexer.walk_files import walk_files
from indexer.write_batches import write_batches

_TEXT_LANGUAGES = frozenset({"markdown", "text"})


def index_repository(index_id: str, owner: str, name: str, commit_sha: str) -> dict[str, object]:
    destination = Path(tempfile.mkdtemp(prefix="repotron-"))
    try:
        fetch_tarball(owner, name, commit_sha, _required("GITHUB_TOKEN"), destination)
        files = walk_files(destination)
        chunks = _chunks(files)
        keys = write_batches(
            chunks,
            index_id,
            _required("R2_BUCKET"),
            _required("R2_ENDPOINT"),
            _required("R2_ACCESS_KEY_ID"),
            _required("R2_SECRET_ACCESS_KEY"),
        )
        return {"fileCount": len(files), "chunkCount": len(chunks), "batchKeys": keys}
    finally:
        shutil.rmtree(destination, ignore_errors=True)


def _chunks(files: list[tuple[str, str, str]]) -> list[dict[str, object]]:
    chunks: list[dict[str, object]] = []
    for path, text, language in files:
        if language in _TEXT_LANGUAGES:
            chunks.extend(chunk_text(path, text, language))
            continue
        chunks.extend(chunk_code(path, text, language))
    return chunks


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value == "":
        raise RuntimeError(f"{name} is required.")
    return value
