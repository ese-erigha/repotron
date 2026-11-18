from evals.report import failing_scores


def test_when_a_score_drops_by_more_than_the_limit_then_the_gate_fails() -> None:
    failed = failing_scores({"recall": 0.97}, {"recall": 1.0})

    assert failed == ["recall"]


def test_when_a_score_drops_by_the_limit_then_the_gate_passes() -> None:
    failed = failing_scores({"recall": 0.98}, {"recall": 1.0})

    assert failed == []
