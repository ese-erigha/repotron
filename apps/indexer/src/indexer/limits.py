import json
from pathlib import Path
from typing import Final

_CONTRACT = json.loads(Path(__file__).with_name("contract.json").read_text(encoding="utf-8"))
_LIMITS = _CONTRACT["limits"]

MAX_CHUNK_TOKENS: Final = int(_LIMITS["maxChunkTokens"])
LINE_WINDOW: Final = int(_LIMITS["lineWindow"])
LINE_OVERLAP: Final = int(_LIMITS["lineOverlap"])
CHUNK_BATCH_SIZE: Final = int(_LIMITS["chunkBatchSize"])
FILE_MAX_BYTES: Final = int(_LIMITS["fileMaxBytes"])
BINARY_PROBE_BYTES: Final = 8_192

SKIP_DIRECTORY_NAMES: Final = frozenset(
    {
        ".git",
        ".hg",
        ".svn",
        "node_modules",
        "vendor",
        "dist",
        "build",
        "target",
        "coverage",
        "__pycache__",
    }
)
LOCK_FILE_NAMES: Final = frozenset(
    {
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "Cargo.lock",
        "poetry.lock",
        "go.sum",
    }
)
MINIFIED_SUFFIXES: Final = (".min.js", ".min.css")
