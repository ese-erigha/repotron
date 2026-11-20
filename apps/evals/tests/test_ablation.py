from evals.ablation import mode_scores
from evals.metrics import QuestionScore
from evals.ranges import LineRange


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
