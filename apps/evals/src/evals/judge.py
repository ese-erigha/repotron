from dataclasses import dataclass

import httpx
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric
from deepeval.models import DeepEvalBaseLLM
from deepeval.test_case import LLMTestCase

ANSWER_MODEL_ID = "anthropic/claude-haiku-5.5"
AI_GATEWAY_ID = "repotron-staging-ai-gateway"


@dataclass(frozen=True)
class JudgeScores:
    faithfulness: float
    answer_relevance: float


class GatewayModel(DeepEvalBaseLLM):  # type: ignore[no-untyped-call]
    def __init__(self, complete: "Complete") -> None:
        self.complete = complete

    def load_model(self) -> "GatewayModel":
        return self

    def generate(self, prompt: str) -> str:
        return self.complete(prompt)

    async def a_generate(self, prompt: str) -> str:
        return self.generate(prompt)

    def get_model_name(self) -> str:
        return ANSWER_MODEL_ID


class Complete:
    def __init__(
        self, client: httpx.Client, account_id: str, openrouter_key: str, gateway_token: str
    ) -> None:
        self.client = client
        self.account_id = account_id
        self.openrouter_key = openrouter_key
        self.gateway_token = gateway_token

    def __call__(self, prompt: str) -> str:
        response = self.client.post(
            f"https://gateway.ai.cloudflare.com/v1/{self.account_id}/{AI_GATEWAY_ID}/openrouter/chat/completions",
            headers={
                "Authorization": f"Bearer {self.openrouter_key}",
                "cf-aig-authorization": f"Bearer {self.gateway_token}",
                "content-type": "application/json",
            },
            json={
                "model": ANSWER_MODEL_ID,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            },
        )
        if response.status_code != 200:
            raise RuntimeError(f"The judge returned {response.status_code}.")
        payload: object = response.json()
        return _message(payload)


class AnswerJudge:
    def __init__(self, model: GatewayModel) -> None:
        self.model = model

    def score(self, question: str, answer: str, contexts: list[str]) -> JudgeScores:
        return _score_once(self.model, question, answer, contexts)


def _score_once(
    model: GatewayModel, question: str, answer: str, contexts: list[str]
) -> JudgeScores:
    case = LLMTestCase(
        input=question,
        actual_output=answer,
        retrieval_context=list(contexts or [""]),
    )
    try:
        return _measure(model, case)
    except (httpx.HTTPError, RuntimeError, ValueError):
        return _measure(model, case)


def _measure(model: GatewayModel, case: LLMTestCase) -> JudgeScores:
    faithfulness = FaithfulnessMetric(
        threshold=0, model=model, include_reason=False, async_mode=False
    )
    relevance = AnswerRelevancyMetric(
        threshold=0, model=model, include_reason=False, async_mode=False
    )
    faithfulness.measure(case)
    relevance.measure(case)
    if faithfulness.score is None or relevance.score is None:
        raise RuntimeError("The judge returned no score.")
    return JudgeScores(faithfulness.score, relevance.score)


def _message(payload: object) -> str:
    if not isinstance(payload, dict):
        raise TypeError("The judge returned no message.")
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise TypeError("The judge returned no message.")
    message = choices[0].get("message")
    if not isinstance(message, dict):
        raise TypeError("The judge returned no message.")
    content = message.get("content")
    if not isinstance(content, str):
        raise TypeError("The judge returned no message.")
    return content
