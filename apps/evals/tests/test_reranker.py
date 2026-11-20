from pathlib import Path

from evals.reranker import needs_sigmoid

RECORD = Path(__file__).parents[1] / "reranker-scores.md"
RECORDED_LOW = 0.0004465289821382612
RECORDED_HIGH = 0.9927901029586792
TITLE_LOW = 0.0002948356559500098
TITLE_HIGH = 0.9974787831306458
RERANK_LOW = 0.5245599746704102
RERANK_HIGH = 0.9392402172088623


def test_when_the_recorded_scores_are_between_zero_and_one_then_the_sigmoid_is_skipped() -> None:
    text = RECORD.read_text(encoding="utf-8")

    assert f"low: {RECORDED_LOW}" in text
    assert f"high: {RECORDED_HIGH}" in text
    assert "sigmoid: skip" in text
    assert f"title-low: {TITLE_LOW}" in text
    assert f"title-high: {TITLE_HIGH}" in text
    assert "title-sigmoid: skip" in text
    assert f"rerank-low: {RERANK_LOW}" in text
    assert f"rerank-high: {RERANK_HIGH}" in text
    assert "rerank-sigmoid: skip" in text
    assert "The function scores above the readme for the same question." in text
    assert needs_sigmoid(RECORDED_LOW, RECORDED_HIGH) is False
    assert needs_sigmoid(TITLE_LOW, TITLE_HIGH) is False
    assert needs_sigmoid(RERANK_LOW, RERANK_HIGH) is False


def test_when_a_score_is_outside_zero_to_one_then_the_sigmoid_applies() -> None:
    assert needs_sigmoid(-0.2, 0.4) is True
    assert needs_sigmoid(0.2, 1.4) is True
