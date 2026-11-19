from pathlib import Path

from evals.reranker import needs_sigmoid

RECORD = Path(__file__).parents[1] / "reranker-scores.md"
RECORDED_LOW = 0.0004465289821382612
RECORDED_HIGH = 0.9927901029586792


def test_when_the_recorded_scores_are_between_zero_and_one_then_the_sigmoid_is_skipped() -> None:
    text = RECORD.read_text(encoding="utf-8")

    assert f"low: {RECORDED_LOW}" in text
    assert f"high: {RECORDED_HIGH}" in text
    assert "sigmoid: skip" in text
    assert needs_sigmoid(RECORDED_LOW, RECORDED_HIGH) is False


def test_when_a_score_is_outside_zero_to_one_then_the_sigmoid_applies() -> None:
    assert needs_sigmoid(-0.2, 0.4) is True
    assert needs_sigmoid(0.2, 1.4) is True
