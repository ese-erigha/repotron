# Trigger a staging deploy.
import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from indexer.fetch_tarball import TarballError
from indexer.index_repository import index_repository

app = FastAPI()
logger = logging.getLogger(__name__)


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
        logger.exception("tarball_failed index=%s error=%s", body.indexId, error.reason)
        return JSONResponse(status_code=400, content={"reason": error.reason})
    except Exception as error:
        message = str(error)
        logger.exception("parse_failed index=%s error=%s", body.indexId, message)
        return JSONResponse(status_code=500, content={"reason": "Indexing failed."})
    return JSONResponse(status_code=200, content=result)
