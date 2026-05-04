from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from ...adapters.persistence.history_store import get_history_run, list_history_runs

router = APIRouter()

_HISTORY_NO_CACHE = {"Cache-Control": "no-store, max-age=0", "Pragma": "no-cache"}


@router.get("/history")
def history(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    query: str | None = Query(default=None),
) -> JSONResponse:
    body = list_history_runs(limit=limit, offset=offset, query=query).to_dict()
    return JSONResponse(content=body, headers=_HISTORY_NO_CACHE)


@router.get("/history/{run_id}")
def history_detail(run_id: str) -> JSONResponse:
    detail = get_history_run(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="History run not found.")
    return JSONResponse(content=detail.to_dict(), headers=_HISTORY_NO_CACHE)

