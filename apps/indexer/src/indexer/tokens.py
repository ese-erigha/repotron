import tiktoken

from indexer.limits import MAX_CHUNK_TOKENS

_ENCODING = tiktoken.get_encoding("cl100k_base")


def token_count(content: str) -> int:
    return len(_ENCODING.encode(content))


def token_parts(content: str) -> list[str]:
    tokens = _ENCODING.encode(content)
    if len(tokens) <= MAX_CHUNK_TOKENS:
        return [content]
    return [
        _ENCODING.decode(tokens[start : start + MAX_CHUNK_TOKENS])
        for start in range(0, len(tokens), MAX_CHUNK_TOKENS)
    ]
