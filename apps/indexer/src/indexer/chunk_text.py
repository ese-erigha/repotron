from indexer.limits import LINE_OVERLAP, LINE_WINDOW
from indexer.tokens import token_parts


def chunk_text(path: str, text: str, language: str) -> list[dict[str, object]]:
    if language == "markdown":
        return _heading_chunks(path, text)
    return _window_chunks(path, text)


def _heading_chunks(path: str, text: str) -> list[dict[str, object]]:
    lines = text.splitlines()
    starts = [index for index, line in enumerate(lines) if line.startswith("#")]
    if not starts:
        return _window_chunks(path, text, kind="heading")
    chunks: list[dict[str, object]] = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        symbol = lines[start].lstrip("#").strip() or None
        chunks.extend(_one_chunk(path, lines, start, end, "markdown", "heading", symbol))
    return chunks


def _window_chunks(path: str, text: str, kind: str = "window") -> list[dict[str, object]]:
    lines = text.splitlines()
    if not lines:
        return []
    language = "markdown" if kind == "heading" else "text"
    step = max(LINE_WINDOW - LINE_OVERLAP, 1)
    chunks: list[dict[str, object]] = []
    start = 0
    while start < len(lines):
        end = min(start + LINE_WINDOW, len(lines))
        chunks.extend(_one_chunk(path, lines, start, end, language, kind, None))
        if end == len(lines):
            break
        start += step
    return chunks


def _one_chunk(
    path: str,
    lines: list[str],
    start: int,
    end: int,
    language: str,
    kind: str,
    symbol: str | None,
) -> list[dict[str, object]]:
    content = "\n".join(lines[start:end])
    if content.strip() == "":
        return []
    header = path if symbol is None else f"{path} {symbol}"
    return [
        {
            "path": path,
            "language": language,
            "symbol": symbol,
            "kind": kind,
            "startLine": start + 1,
            "endLine": end,
            "content": part,
            "header": header,
            "identifiers": "",
        }
        for part in token_parts(content)
    ]
