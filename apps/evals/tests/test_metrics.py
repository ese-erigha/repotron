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


def test_when_the_first_chunk_overlaps_then_identifier_hit_at_1_is_one() -> None:
    truth = LineRange("src/app.py", 10, 20)
    first = LineRange("src/app.py", 12, 30)
    scores = score_retrieval([_question("identifier", (truth,), (first,), ())])

    assert scores.identifier_hit_at_1 == 1


def test_when_only_a_later_chunk_overlaps_then_identifier_hit_at_1_is_zero() -> None:
    truth = LineRange("src/app.py", 10, 20)
    first = LineRange("src/other.py", 1, 2)
    later = LineRange("src/app.py", 12, 30)
    scores = score_retrieval([_question("identifier", (truth,), (first, later), ())])

    assert scores.identifier_hit_at_1 == 0


def test_when_the_question_is_not_an_identifier_then_identifier_hit_at_1_ignores_it() -> None:
    truth = LineRange("src/app.py", 10, 20)
    retrieved = LineRange("src/app.py", 12, 30)
    scores = score_retrieval([_question("concept", (truth,), (retrieved,), ())])

    assert scores.identifier_hit_at_1 is None


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
