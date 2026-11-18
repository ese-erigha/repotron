from dataclasses import dataclass

from evals.ranges import LineRange, ranges_overlap

NOT_FOUND_ANSWER = "I did not find this in the repository."
OUT_OF_REPO = "out_of_repo"
IDENTIFIER = "identifier"


@dataclass(frozen=True)
class QuestionScore:
    kind: str
    truth: tuple[LineRange, ...]
    retrieved: tuple[LineRange, ...]
    cited: tuple[LineRange, ...]
    answer: str


@dataclass(frozen=True)
class RetrievalScores:
    recall: float | None
    precision: float | None
    citation_accuracy: float | None
    refusal_accuracy: float | None
    identifier_hit_at_1: float | None


def score_retrieval(questions: list[QuestionScore]) -> RetrievalScores:
    truth_hits = 0
    truth_total = 0
    retrieved_hits = 0
    retrieved_total = 0
    cited_hits = 0
    cited_total = 0
    refusals = 0
    out_of_repo = 0
    identifier_hits = 0
    identifier_total = 0
    for question in questions:
        if question.kind == IDENTIFIER:
            identifier_total += 1
            if _first_chunk_hits(question):
                identifier_hits += 1
        if question.kind == OUT_OF_REPO:
            out_of_repo += 1
            if _refused(question):
                refusals += 1
            continue
        truth_hits += _hit_count(question.truth, question.retrieved)
        truth_total += len(question.truth)
        retrieved_hits += _hit_count(question.retrieved, question.truth)
        retrieved_total += len(question.retrieved)
        cited_hits += _hit_count(question.cited, question.truth)
        cited_total += len(question.cited)
    return RetrievalScores(
        recall=_share(truth_hits, truth_total),
        precision=_share(retrieved_hits, retrieved_total),
        citation_accuracy=_share(cited_hits, cited_total),
        refusal_accuracy=_share(refusals, out_of_repo),
        identifier_hit_at_1=_share(identifier_hits, identifier_total),
    )


def _first_chunk_hits(question: QuestionScore) -> bool:
    if not question.retrieved:
        return False
    return _hit_count((question.retrieved[0],), question.truth) == 1


def _refused(question: QuestionScore) -> bool:
    return NOT_FOUND_ANSWER in question.answer and len(question.cited) == 0


def _hit_count(needles: tuple[LineRange, ...], haystack: tuple[LineRange, ...]) -> int:
    return sum(1 for needle in needles if any(ranges_overlap(needle, item) for item in haystack))


def _share(hits: int, total: int) -> float | None:
    if total == 0:
        return None
    return hits / total
