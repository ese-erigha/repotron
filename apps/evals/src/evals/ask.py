import json
import re
from dataclasses import dataclass

import httpx

from evals.ranges import LineRange

EVAL_HEADER = "x-repotron-eval-token"
CITATION_NUMBER = re.compile(r"\[(\d+)\]")


@dataclass(frozen=True)
class AnswerResult:
    retrieved: tuple[LineRange, ...]
    contexts: tuple[str, ...]
    answer: str
    cited: tuple[LineRange, ...]
    retrieval_ms: int
    first_token_ms: int | None
    input_tokens: int | None
    output_tokens: int | None


class AskError(Exception):
    pass


def ask_question(
    client: httpx.Client,
    origin: str,
    index_id: str,
    body: dict[str, str],
    token: str,
) -> AnswerResult:
    response = client.post(
        f"{origin}/api/v1/indexes/{index_id}/questions",
        params={"debug": "true"},
        headers={EVAL_HEADER: token, "content-type": "application/json"},
        json=body,
    )
    # The question route creates an answer, so the status is 201.
    if response.status_code != 201:
        raise AskError(f"The gateway returned {response.status_code}.")
    return read_answer(response.text)


def read_answer(body: str) -> AnswerResult:
    retrieved: list[LineRange] = []
    contexts: list[str] = []
    numbers: dict[int, LineRange] = {}
    answer = ""
    done: dict[str, object] | None = None
    for event_name, data in _events(body):
        if event_name == "retrieval":
            for citation in _citations(data):
                retrieved.append(citation[1])
                contexts.append(citation[2])
                numbers[citation[0]] = citation[1]
        elif event_name == "token":
            text = data.get("text")
            if isinstance(text, str):
                answer += text
        elif event_name == "done":
            done = data
        elif event_name == "error":
            message = data.get("message")
            detail = message if isinstance(message, str) else "The answer failed."
            raise AskError(detail)
    if done is None:
        raise AskError("The answer stream has no done event.")
    cited = tuple(numbers[number] for number in _cited_numbers(answer) if number in numbers)
    return AnswerResult(
        retrieved=tuple(retrieved),
        contexts=tuple(contexts),
        answer=answer,
        cited=cited,
        retrieval_ms=_int_field(done, "retrievalMs"),
        first_token_ms=_optional_int(done, "firstTokenMs"),
        input_tokens=_optional_int(done, "inputTokens"),
        output_tokens=_optional_int(done, "outputTokens"),
    )


def _events(body: str) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    for block in body.split("\n\n"):
        name = ""
        data = ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line.removeprefix("event:").strip()
            elif line.startswith("data:"):
                data = line.removeprefix("data:").strip()
        if name == "" or data == "":
            continue
        parsed: object = json.loads(data)
        if isinstance(parsed, dict):
            events.append((name, parsed))
    return events


def _citations(data: dict[str, object]) -> list[tuple[int, LineRange, str]]:
    raw = data.get("citations")
    if not isinstance(raw, list):
        return []
    citations: list[tuple[int, LineRange, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        number = item.get("number")
        path = item.get("path")
        start_line = item.get("startLine")
        end_line = item.get("endLine")
        content = item.get("content")
        if not isinstance(number, int) or not isinstance(path, str):
            continue
        if not isinstance(start_line, int) or not isinstance(end_line, int):
            continue
        text = content if isinstance(content, str) else ""
        citations.append((number, LineRange(path, start_line, end_line), text))
    return citations


def _cited_numbers(answer: str) -> list[int]:
    return [int(match) for match in CITATION_NUMBER.findall(answer)]


def _int_field(data: dict[str, object], name: str) -> int:
    value = data.get(name)
    if not isinstance(value, int):
        raise AskError(f"The done event has no {name}.")
    return value


def _optional_int(data: dict[str, object], name: str) -> int | None:
    value = data.get(name)
    if value is None:
        return None
    if not isinstance(value, int):
        raise AskError(f"The done event has no {name}.")
    return value
