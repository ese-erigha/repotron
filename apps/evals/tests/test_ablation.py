import json
from pathlib import Path

from evals.ablation import mode_scores
from evals.metrics import QuestionScore
from evals.ranges import LineRange

RECORD = Path(__file__).parents[1] / "ablation.json"


def test_when_questions_have_two_kinds_then_the_report_splits_the_scores() -> None:
    truth = LineRange("src/app.py", 1, 2)
    questions = [
        QuestionScore("identifier", (truth,), (truth,), (truth,), "See [1]."),
        QuestionScore("concept", (truth,), (), (), "See [1]."),
    ]

    report = mode_scores(questions)

    scores = report["scores"]
    by_kind = report["byKind"]
    assert isinstance(scores, dict)
    assert isinstance(by_kind, dict)
    assert scores["identifierHitAt1"] == 1
    assert isinstance(by_kind["identifier"], dict)
    assert isinstance(by_kind["concept"], dict)
    assert by_kind["identifier"]["recall"] == 1
    assert by_kind["concept"]["recall"] == 0


def test_when_the_ablation_file_is_read_then_hybrid_and_rerank_keep_the_first_chunk_hit() -> None:
    report = json.loads(RECORD.read_text(encoding="utf-8"))

    assert report["hybrid"]["scores"]["identifierHitAt1"] == 1
    assert report["rerank"]["scores"]["identifierHitAt1"] == 1
    assert report["hybrid"]["scores"]["recall"] == report["rerank"]["scores"]["recall"]
    assert report["bm25"]["scores"]["recall"] < report["dense"]["scores"]["recall"]
