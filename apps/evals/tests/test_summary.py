import json

from evals.summary import build_summary

_QUESTION = "What is Flask?"
_ANSWER = "Flask is a web framework."


def test_when_the_report_holds_an_answer_then_the_summary_keeps_the_scores_and_drops_the_text() -> (
    None
):
    report = {
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
        "questions": [{"id": "flask-architecture-01", "question": _QUESTION, "answer": _ANSWER}],
    }

    summary = build_summary(report, "abc123", 1_700_000_000_000, 1.0)

    assert summary["scores"]["recall"] == 0.66
    assert summary["latency"]["retrievalP95Ms"] == 400
    assert summary["latency"]["firstTokenP95Ms"] == 900
    assert summary["cost"]["dollars"] == 0.01
    text = json.dumps(summary)
    assert _QUESTION not in text
    assert _ANSWER not in text
