from evals.metrics import NOT_FOUND_ANSWER, QuestionScore, score_retrieval
from evals.ranges import LineRange


def test_when_a_retrieved_chunk_overlaps_the_ground_truth_then_recall_and_precision_count_the_hit() -> (
    None
):
    truth = LineRange("src/app.py", 10, 20)
    retrieved = LineRange("src/app.py", 12, 30)
    scores = score_retrieval([_question("identifier", (truth,), (retrieved,), (retrieved,))])

    assert scores.recall == 1
    assert scores.precision == 1
    assert scores.citation_accuracy == 1


def test_when_the_retrieved_path_differs_then_recall_and_precision_count_a_miss() -> None:
    truth = LineRange("src/app.py", 10, 20)
    retrieved = LineRange("src/other.py", 10, 20)
    scores = score_retrieval([_question("identifier", (truth,), (retrieved,), ())])

    assert scores.recall == 0
    assert scores.precision == 0
    assert scores.citation_accuracy is None


def test_when_the_question_is_out_of_repo_and_the_answer_refuses_then_only_refusal_counts() -> None:
    scores = score_retrieval(
        [_question("out_of_repo", (), (), (), answer=NOT_FOUND_ANSWER)],
    )

    assert scores.refusal_accuracy == 1
    assert scores.recall is None
    assert scores.precision is None
    assert scores.citation_accuracy is None


def _question(
    kind: str,
    truth: tuple[LineRange, ...],
    retrieved: tuple[LineRange, ...],
    cited: tuple[LineRange, ...],
    answer: str = "See [1].",
) -> QuestionScore:
    return QuestionScore(kind, truth, retrieved, cited, answer)
