from typing import Final, TypedDict

_GATE_SCORES: Final[tuple[str, ...]] = (
    "recall",
    "precision",
    "faithfulness",
    "answerRelevance",
    "citationAccuracy",
    "refusalAccuracy",
)


class SummaryScores(TypedDict):
    recall: float
    precision: float
    faithfulness: float
    answerRelevance: float
    citationAccuracy: float
    refusalAccuracy: float
    identifierHitAt1: float


class SummaryLatency(TypedDict):
    retrievalP95Ms: int
    firstTokenP95Ms: int


class SummaryCost(TypedDict):
    dollars: float


class EvalSummary(TypedDict):
    commitSha: str
    createdAt: int
    scores: SummaryScores
    latency: SummaryLatency
    cost: SummaryCost


def build_summary(
    report: object,
    commit_sha: str,
    created_at: int,
    identifier_hit_at_1: float,
) -> EvalSummary:
    if commit_sha == "":
        raise ValueError("The summary needs a commit.")
    body = _mapping(report, "report")
    scores = _gate_scores(body)
    latency = _mapping(body.get("latency"), "latency")
    cost = _mapping(body.get("cost"), "cost")
    summary: EvalSummary = {
        "commitSha": commit_sha,
        "createdAt": created_at,
        "scores": {
            "recall": scores["recall"],
            "precision": scores["precision"],
            "faithfulness": scores["faithfulness"],
            "answerRelevance": scores["answerRelevance"],
            "citationAccuracy": scores["citationAccuracy"],
            "refusalAccuracy": scores["refusalAccuracy"],
            "identifierHitAt1": identifier_hit_at_1,
        },
        "latency": {
            "retrievalP95Ms": _whole(_field(latency, "retrievalP95Ms"), "retrievalP95Ms"),
            "firstTokenP95Ms": _whole(_field(latency, "firstTokenP95Ms"), "firstTokenP95Ms"),
        },
        "cost": {"dollars": _number(_field(cost, "dollars"), "dollars")},
    }
    return summary


def _gate_scores(body: dict[str, object]) -> dict[str, float]:
    scores = _mapping(body.get("scores"), "scores")
    values: dict[str, float] = {}
    for name in _GATE_SCORES:
        values[name] = _number(_field(scores, name), name)
    return values


def _mapping(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise TypeError(f"The report {label} is not an object.")
    result: dict[str, object] = {}
    for key, item in value.items():
        if not isinstance(key, str):
            raise TypeError(f"The report {label} has a key that is not text.")
        result[key] = item
    return result


def _field(body: dict[str, object], name: str) -> object:
    if name not in body:
        raise ValueError(f"The report has no {name}.")
    return body[name]


def _number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise TypeError(f"The report has no {label}.")
    return float(value)


def _whole(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"The report has no {label}.")
    return value
