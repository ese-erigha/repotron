import json
from pathlib import Path

import pytest

from evals.store import summary_key, write_summary

_QUESTION = "What is Flask?"
_ANSWER = "Flask is a web framework."
_COMMIT = "abc123"
_CREATED_AT = 1_700_000_000_000


def _report() -> dict[str, object]:
    return {
        "scores": {
            "recall": 0.66,
            "precision": 0.09,
            "faithfulness": 0.99,
            "answerRelevance": 0.88,
            "citationAccuracy": 0.15,
            "refusalAccuracy": 1.0,
        },
        "latency": {"retrievalP95Ms": 400, "firstTokenP95Ms": 900},
        "cost": {"inputTokens": 10, "outputTokens": 20, "dollars": 0.01},
        "identifierHitAt1": 1.0,
        "questions": [{"id": "flask-architecture-01", "question": _QUESTION, "answer": _ANSWER}],
    }


def test_when_the_report_holds_an_answer_then_the_summary_file_keeps_the_scores_and_drops_the_text(
    tmp_path: Path,
) -> None:
    dest = tmp_path / "summary.json"

    write_summary(_report(), _COMMIT, _CREATED_AT, dest)

    summary = json.loads(dest.read_text(encoding="utf-8"))
    assert summary["scores"]["recall"] == 0.66
    assert summary["scores"]["identifierHitAt1"] == 1.0
    assert summary["latency"]["retrievalP95Ms"] == 400
    assert summary["latency"]["firstTokenP95Ms"] == 900
    assert summary["cost"]["dollars"] == 0.01
    text = dest.read_text(encoding="utf-8")
    assert _QUESTION not in text
    assert _ANSWER not in text


def test_when_the_commit_is_known_then_the_object_key_is_under_evals() -> None:
    assert summary_key(_COMMIT) == "evals/abc123.json"


def test_when_the_commit_contains_a_slash_then_the_key_is_refused() -> None:
    with pytest.raises(ValueError):
        summary_key("ab/cd")
