from typing import Final

import tiktoken
from tree_sitter import Node
from tree_sitter_language_pack import get_parser

from indexer.limits import MAX_CHUNK_TOKENS
from indexer.split_identifiers import join_identifiers

_NODE_KIND: Final = {
    "function_definition": "function",
    "function_declaration": "function",
    "function_item": "function",
    "method_declaration": "method",
    "method_definition": "method",
    "class_definition": "class",
    "class_declaration": "class",
    "impl_item": "class",
    "interface_declaration": "interface",
    "trait_item": "interface",
    "type_alias_declaration": "type",
    "type_declaration": "type",
    "type_item": "type",
    "struct_item": "type",
    "enum_item": "type",
    "enum_declaration": "type",
}
_WRAPPERS: Final = frozenset({"decorated_definition", "export_statement"})
_BODY_TYPES: Final = frozenset(
    {"block", "class_body", "declaration_list", "field_declaration_list", "enum_body"}
)
_IDENTIFIER_TYPES: Final = frozenset(
    {"identifier", "type_identifier", "property_identifier", "field_identifier"}
)
_ENCODING = tiktoken.get_encoding("cl100k_base")


def chunk_code(path: str, text: str, language: str) -> list[dict[str, object]]:
    source = text.encode()
    tree = get_parser(language).parse(source)
    declarations = _declarations(tree.root_node, inside_class=False)
    chunks: list[dict[str, object]] = []
    cursor = 0
    for outer, inner, kind in declarations:
        chunks.extend(_module_region(path, source, language, cursor, outer.start_byte))
        chunks.extend(_declaration_chunks(path, source, outer, inner, kind, language, None))
        cursor = outer.end_byte
    chunks.extend(_module_region(path, source, language, cursor, len(source)))
    return chunks


def _declarations(node: Node, inside_class: bool) -> list[tuple[Node, Node, str]]:
    found: list[tuple[Node, Node, str]] = []
    for child in _named_children(node):
        inner = _unwrap(child)
        kind = _NODE_KIND.get(inner.type)
        if kind is None:
            continue
        if inside_class and kind == "function":
            kind = "method"
        found.append((child, inner, kind))
    return found


def _named_children(node: Node) -> list[Node]:
    children: list[Node] = []
    for child in node.children:
        if child.type in _BODY_TYPES:
            children.extend(body for body in child.children if body.is_named)
            continue
        if child.is_named:
            children.append(child)
    return children


def _unwrap(node: Node) -> Node:
    current = node
    while current.type in _WRAPPERS:
        named = [child for child in current.children if child.is_named]
        if not named:
            break
        current = named[-1]
    return current


def _declaration_chunks(
    path: str,
    source: bytes,
    outer: Node,
    inner: Node,
    kind: str,
    language: str,
    parent_header: str | None,
) -> list[dict[str, object]]:
    content = source[outer.start_byte : outer.end_byte].decode()
    symbol = _symbol(inner)
    header = parent_header or (f"{path} {symbol}" if symbol else path)
    if _token_count(content) <= MAX_CHUNK_TOKENS:
        return [_record(path, source, outer, language, kind, symbol, header, content)]
    children = _declarations(inner, inside_class=True)
    if not children:
        return _split_oversized(path, source, outer, language, kind, symbol, header, content)
    signature = content.splitlines()[0] if content else path
    child_header = f"{path} {signature}".strip()
    chunks: list[dict[str, object]] = []
    for child_outer, child_inner, child_kind in children:
        chunks.extend(
            _declaration_chunks(
                path, source, child_outer, child_inner, child_kind, language, child_header
            )
        )
    return chunks


def _module_region(
    path: str, source: bytes, language: str, start: int, end: int
) -> list[dict[str, object]]:
    content = source[start:end].decode()
    if content.strip() == "":
        return []
    start_line = source[:start].count(b"\n") + 1
    end_line = start_line + content.count("\n")
    return [
        {
            "path": path,
            "language": language,
            "symbol": None,
            "kind": "module",
            "startLine": start_line,
            "endLine": max(end_line, start_line),
            "content": content.strip("\n"),
            "header": path,
            "identifiers": "",
        }
    ]


def _split_oversized(
    path: str,
    source: bytes,
    outer: Node,
    language: str,
    kind: str,
    symbol: str | None,
    header: str,
    content: str,
) -> list[dict[str, object]]:
    chunks: list[dict[str, object]] = []
    for part in _token_parts(content):
        record = _record(path, source, outer, language, kind, symbol, header, part)
        record["content"] = part
        chunks.append(record)
    return chunks


def _token_parts(content: str) -> list[str]:
    tokens = _ENCODING.encode(content)
    return [
        _ENCODING.decode(tokens[start : start + MAX_CHUNK_TOKENS])
        for start in range(0, len(tokens), MAX_CHUNK_TOKENS)
    ]


def _record(
    path: str,
    source: bytes,
    outer: Node,
    language: str,
    kind: str,
    symbol: str | None,
    header: str,
    content: str,
) -> dict[str, object]:
    return {
        "path": path,
        "language": language,
        "symbol": symbol,
        "kind": kind,
        "startLine": outer.start_point[0] + 1,
        "endLine": outer.end_point[0] + 1,
        "content": content,
        "header": header,
        "identifiers": join_identifiers(_identifiers(outer)),
    }


def _symbol(node: Node) -> str | None:
    name = node.child_by_field_name("name")
    if name is None:
        return None
    return name.text.decode() if name.text is not None else None


def _identifiers(node: Node) -> list[str]:
    names: list[str] = []
    if node.type in _IDENTIFIER_TYPES and node.text is not None:
        names.append(node.text.decode())
    for child in node.children:
        names.extend(_identifiers(child))
    return names


def _token_count(content: str) -> int:
    return len(_ENCODING.encode(content))
