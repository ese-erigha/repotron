from pathlib import Path

from indexer.languages import language_for
from indexer.limits import (
    BINARY_PROBE_BYTES,
    FILE_MAX_BYTES,
    LOCK_FILE_NAMES,
    MINIFIED_SUFFIXES,
    SKIP_DIRECTORY_NAMES,
)


def walk_files(root: Path) -> list[tuple[str, str, str]]:
    source_root = _unwrap_archive_root(root)
    files: list[tuple[str, str, str]] = []
    for path in sorted(source_root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(source_root).as_posix()
        if _skipped(path, relative):
            continue
        text = _read_text(path)
        if text is None:
            continue
        files.append((relative, text, language_for(relative)))
    return files


def _unwrap_archive_root(root: Path) -> Path:
    children = [child for child in root.iterdir() if child.name != ".git"]
    if len(children) == 1 and children[0].is_dir():
        return children[0]
    return root


def _skipped(path: Path, relative: str) -> bool:
    parts = set(Path(relative).parts)
    if parts & SKIP_DIRECTORY_NAMES:
        return True
    if path.name in LOCK_FILE_NAMES or path.name.lower().endswith(MINIFIED_SUFFIXES):
        return True
    if path.stat().st_size > FILE_MAX_BYTES:
        return True
    probe = path.read_bytes()[:BINARY_PROBE_BYTES]
    return b"\x00" in probe


def _read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None
