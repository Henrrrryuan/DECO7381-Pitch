from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ...adapters.persistence.history_store import get_history_run, list_history_runs

router = APIRouter()


@router.get("/history")
def history(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    query: str | None = Query(default=None),
) -> dict[str, Any]:
    return list_history_runs(limit=limit, offset=offset, query=query).to_dict()


@router.get("/history/{run_id}")
def history_detail(run_id: str) -> dict[str, Any]:
    detail = get_history_run(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="History run not found.")
    return detail.to_dict()

