from typing import Final

CODE_LANGUAGE_BY_SUFFIX: Final = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".go": "go",
    ".java": "java",
    ".rs": "rust",
}
MARKDOWN_SUFFIXES: Final = frozenset({".md", ".markdown"})


def language_for(path: str) -> str:
    lowered = path.lower()
    for suffix, language in CODE_LANGUAGE_BY_SUFFIX.items():
        if lowered.endswith(suffix):
            return language
    for suffix in MARKDOWN_SUFFIXES:
        if lowered.endswith(suffix):
            return "markdown"
    return "text"
