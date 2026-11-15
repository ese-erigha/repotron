FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.8 /uv /uvx /bin/
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY src ./src
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src"
EXPOSE 8080
CMD ["uvicorn", "indexer.app:app", "--host", "0.0.0.0", "--port", "8080"]
