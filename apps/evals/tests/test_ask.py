import httpx
import pytest

from evals.ask import ask_question, read_answer

_DONE = '{"questionId":"abc","inputTokens":1,"outputTokens":1,"retrievalMs":1,"firstTokenMs":1,"answerMs":1}'
_STREAM = f'event: retrieval\ndata: {{"citations":[]}}\n\nevent: token\ndata: {{"text":"ok"}}\n\nevent: done\ndata: {_DONE}'


def test_when_the_stream_finishes_then_the_result_holds_the_ranges_and_the_times() -> None:
    retrieval = '{"citations":[{"number":1,"path":"src/app.py","startLine":10,"endLine":20,"content":"def main(): pass"},{"number":2,"path":"src/other.py","startLine":1,"endLine":2,"content":"x = 1"}]}'
    done = '{"questionId":"abc","inputTokens":10,"outputTokens":2,"retrievalMs":40,"firstTokenMs":80,"answerMs":100}'
    body = f'event: retrieval\ndata: {retrieval}\n\nevent: token\ndata: {{"text":"See "}}\n\nevent: token\ndata: {{"text":"[1]."}}\n\nevent: done\ndata: {done}'

    result = read_answer(body)

    assert [(item.path, item.start_line, item.end_line) for item in result.retrieved] == [
        ("src/app.py", 10, 20),
        ("src/other.py", 1, 2),
    ]
    assert [(item.path, item.start_line) for item in result.cited] == [("src/app.py", 10)]
    assert result.contexts == ("def main(): pass", "x = 1")
    assert result.answer == "See [1]."
    assert result.retrieval_ms == 40
    assert result.first_token_ms == 80
    assert result.input_tokens == 10
    assert result.output_tokens == 2


def test_when_the_stream_drops_once_then_the_question_is_asked_again() -> None:
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.RemoteProtocolError("peer closed connection")
        return httpx.Response(201, text=_STREAM)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = ask_question(
        client, "https://gateway.test", "index-id", {"question": "Where?"}, "token"
    )

    assert attempts == 2
    assert result.answer == "ok"


def test_when_the_stream_drops_twice_then_the_error_is_raised() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.RemoteProtocolError("peer closed connection")

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(httpx.RemoteProtocolError):
        ask_question(client, "https://gateway.test", "index-id", {"question": "Where?"}, "token")
