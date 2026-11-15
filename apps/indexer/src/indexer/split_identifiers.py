import re
from typing import Final

_CAMEL_PART: Final = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+")


def split_identifier(name: str) -> str:
    parts: list[str] = []
    for piece in name.replace("-", "_").split("_"):
        if piece == "":
            continue
        found = _CAMEL_PART.findall(piece)
        parts.extend(found or [piece])
    phrase = " ".join(part.lower() for part in parts)
    if phrase == "" or phrase == name.lower():
        return name
    return f"{name} {phrase}"


def join_identifiers(names: list[str]) -> str:
    seen: list[str] = []
    for name in names:
        rendered = split_identifier(name)
        if rendered not in seen:
            seen.append(rendered)
    return " ".join(seen)
