from dataclasses import dataclass
from pathlib import Path

import yaml

from evals.ranges import LineRange

START_HERE = "Where do I start?"


@dataclass(frozen=True)
class GoldenQuestion:
    id: str
    kind: str
    index_id: str
    question: str
    body: dict[str, str]
    ranges: tuple[LineRange, ...]


def load_golden(directory: Path) -> list[GoldenQuestion]:
    questions: list[GoldenQuestion] = []
    for path in sorted(directory.glob("*.yaml")):
        parsed: object = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(parsed, dict):
            raise TypeError(f"{path.name} is not a golden file.")
        index_id = _text(parsed, "indexId")
        raw_questions = parsed.get("questions")
        if not isinstance(raw_questions, list):
            raise TypeError(f"{path.name} has no questions.")
        for item in raw_questions:
            if isinstance(item, dict):
                questions.append(_question(item, index_id))
    return questions


def _question(item: dict[str, object], index_id: str) -> GoldenQuestion:
    kind = _text(item, "kind")
    question_id = _text(item, "id")
    preset = item.get("preset")
    feature_name = item.get("featureName")
    if preset == "start_here":
        question = START_HERE
        body = {"preset": "start_here"}
    elif preset == "explain_feature" and isinstance(feature_name, str):
        question = f"Explain this feature. Feature: {feature_name}"
        body = {"preset": "explain_feature", "featureName": feature_name}
    else:
        question = _text(item, "question")
        body = {"question": question}
    return GoldenQuestion(question_id, kind, index_id, question, body, _ranges(item))


def _ranges(item: dict[str, object]) -> tuple[LineRange, ...]:
    raw = item.get("ranges")
    if not isinstance(raw, list):
        return ()
    ranges: list[LineRange] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        path = entry.get("path")
        start_line = entry.get("startLine")
        end_line = entry.get("endLine")
        if isinstance(path, str) and isinstance(start_line, int) and isinstance(end_line, int):
            ranges.append(LineRange(path, start_line, end_line))
    return tuple(ranges)


def _text(item: dict[str, object], name: str) -> str:
    value = item.get(name)
    if not isinstance(value, str) or value == "":
        raise TypeError(f"A golden question needs {name}.")
    return value
