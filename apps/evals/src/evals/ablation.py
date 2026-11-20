import json
import os
import sys
from pathlib import Path

import httpx

from evals.ask import ask_question
from evals.golden import load_golden
from evals.metrics import QuestionScore, RetrievalScores, score_retrieval

GATEWAY_ORIGIN = "https://repotron-staging-gateway.ese-erigha.workers.dev"
ROOT = Path(__file__).resolve().parents[2]
MODES = (
    ("dense", "dense"),
    ("bm25", "bm25"),
    ("hybrid", "hybrid"),
    ("rerank", ""),
)


def main() -> None:
    token = _env("EVAL_TOKEN")
    configured = os.environ.get("EVAL_GATEWAY_ORIGIN", "").strip()
    origin = configured or GATEWAY_ORIGIN
    questions = load_golden(ROOT / "golden")
    report: dict[str, object] = {}
    timeout = httpx.Timeout(180.0)
    with httpx.Client(timeout=timeout) as client:
        for name, retrieval in MODES:
            print(name, file=sys.stderr)
            scored: list[QuestionScore] = []
            for question in questions:
                print(question.id, file=sys.stderr)
                answer = ask_question(
                    client, origin, question.index_id, question.body, token, retrieval
                )
                scored.append(
                    QuestionScore(
                        question.kind,
                        question.ranges,
                        answer.retrieved,
                        answer.cited,
                        answer.answer,
                    )
                )
            report[name] = mode_scores(scored)
    path = ROOT / "ablation.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def mode_scores(questions: list[QuestionScore]) -> dict[str, object]:
    kinds = sorted({question.kind for question in questions})
    return {
        "scores": public_scores(score_retrieval(questions)),
        "byKind": {
            kind: public_scores(
                score_retrieval([question for question in questions if question.kind == kind])
            )
            for kind in kinds
        },
    }


def public_scores(scores: RetrievalScores) -> dict[str, float | None]:
    return {
        "recall": scores.recall,
        "precision": scores.precision,
        "identifierHitAt1": scores.identifier_hit_at_1,
        "citationAccuracy": scores.citation_accuracy,
        "refusalAccuracy": scores.refusal_accuracy,
    }


def _env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value == "":
        raise RuntimeError(f"{name} is missing.")
    return value


if __name__ == "__main__":
    main()
