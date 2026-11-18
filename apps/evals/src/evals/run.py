import json
import os
import sys
from pathlib import Path

import httpx

from evals.ask import AnswerResult, ask_question
from evals.golden import load_golden
from evals.judge import AnswerJudge, Complete, GatewayModel
from evals.metrics import QuestionScore, score_retrieval
from evals.ranges import LineRange
from evals.report import dollars, failing_scores, percentile_95

GATEWAY_ORIGIN = "https://repotron-staging-gateway.ese-erigha.workers.dev"
ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    token = _env("EVAL_TOKEN")
    account_id = _env("CLOUDFLARE_ACCOUNT_ID")
    openrouter_key = _env("OPENROUTER_API_KEY")
    gateway_token = _env("CF_AIG_TOKEN")
    configured = os.environ.get("EVAL_GATEWAY_ORIGIN", "").strip()
    origin = configured or GATEWAY_ORIGIN
    questions = load_golden(ROOT / "golden")
    records: list[dict[str, object]] = []
    scored: list[QuestionScore] = []
    faithfulness: list[float] = []
    relevance: list[float] = []
    retrieval_ms: list[int] = []
    first_token_ms: list[int] = []
    input_tokens = 0
    output_tokens = 0
    timeout = httpx.Timeout(180.0)
    with httpx.Client(timeout=timeout) as client:
        judge = AnswerJudge(
            GatewayModel(Complete(client, account_id, openrouter_key, gateway_token))
        )
        for question in questions:
            print(question.id, file=sys.stderr)
            answer = ask_question(client, origin, question.index_id, question.body, token)
            judgment = judge.score(question.question, answer.answer, list(answer.contexts))
            scored.append(
                QuestionScore(
                    question.kind, question.ranges, answer.retrieved, answer.cited, answer.answer
                )
            )
            faithfulness.append(judgment.faithfulness)
            relevance.append(judgment.answer_relevance)
            retrieval_ms.append(answer.retrieval_ms)
            if answer.first_token_ms is not None:
                first_token_ms.append(answer.first_token_ms)
            input_tokens += answer.input_tokens or 0
            output_tokens += answer.output_tokens or 0
            records.append(
                _record(question.id, answer, judgment.faithfulness, judgment.answer_relevance)
            )
    retrieval = score_retrieval(scored)
    scores = {
        "recall": _required(retrieval.recall, "recall"),
        "precision": _required(retrieval.precision, "precision"),
        "faithfulness": _mean(faithfulness),
        "answerRelevance": _mean(relevance),
        "citationAccuracy": _required(retrieval.citation_accuracy, "citationAccuracy"),
        "refusalAccuracy": _required(retrieval.refusal_accuracy, "refusalAccuracy"),
    }
    report = {
        "scores": scores,
        "latency": {
            "retrievalP95Ms": percentile_95(retrieval_ms),
            "firstTokenP95Ms": percentile_95(first_token_ms),
        },
        "cost": {
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "dollars": dollars(input_tokens, output_tokens),
        },
        "questions": records,
    }
    (ROOT / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    _finish(scores)


def _record(
    question_id: str, answer: AnswerResult, faithfulness: float, relevance: float
) -> dict[str, object]:
    return {
        "id": question_id,
        "retrieved": [_range(item) for item in answer.retrieved],
        "answer": answer.answer,
        "cited": [_range(item) for item in answer.cited],
        "faithfulness": faithfulness,
        "answerRelevance": relevance,
    }


def _range(item: LineRange) -> dict[str, object]:
    return {"path": item.path, "startLine": item.start_line, "endLine": item.end_line}


def _finish(scores: dict[str, float]) -> None:
    baseline_path = ROOT / "baseline.json"
    print(json.dumps(scores, indent=2))
    if os.environ.get("WRITE_BASELINE", "").strip() == "true":
        baseline_path.write_text(json.dumps(scores, indent=2) + "\n", encoding="utf-8")
        return
    if not baseline_path.exists():
        raise SystemExit("baseline.json is missing. Run the Eval workflow with write baseline.")
    parsed: object = json.loads(baseline_path.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise SystemExit("baseline.json is not an object.")
    baseline = {str(key): value for key, value in parsed.items() if isinstance(value, float | int)}
    failed = failing_scores(scores, baseline)
    if failed:
        print("Dropped scores: " + ", ".join(failed), file=sys.stderr)
        raise SystemExit(1)


def _mean(values: list[float]) -> float:
    if not values:
        raise SystemExit("The judge returned no scores.")
    return sum(values) / len(values)


def _required(score: float | None, name: str) -> float:
    if score is None:
        raise SystemExit(f"The report has no {name}.")
    return score


def _env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value == "":
        raise SystemExit(f"{name} is required.")
    return value


if __name__ == "__main__":
    main()
