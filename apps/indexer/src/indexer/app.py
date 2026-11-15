from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from indexer.fetch_tarball import TarballError
from indexer.index_repository import index_repository

app = FastAPI()


class IndexRequest(BaseModel):
    indexId: str
    owner: str
    name: str
    commitSha: str


@app.get("/health")
def read_health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/index")
def read_index(body: IndexRequest) -> JSONResponse:
    try:
        result = index_repository(body.indexId, body.owner, body.name, body.commitSha)
    except TarballError as error:
        return JSONResponse(status_code=400, content={"reason": error.reason})
    except Exception:  # noqa: BLE001 — an unexpected parse failure stays a generic 500
        return JSONResponse(status_code=500, content={"reason": "Indexing failed."})
    return JSONResponse(status_code=200, content=result)
