from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import JSONResponse

from ...adapters.persistence.history_store import (
    delete_history_run,
    get_history_run,
    has_history_run,
    list_history_runs,
    save_visual_complexity_result,
)

router = APIRouter()

# History responses should always reflect the latest local SQLite state.
_HISTORY_NO_CACHE = {"Cache-Control": "no-store, max-age=0", "Pragma": "no-cache"}


@router.get("/history")
def history(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    query: str | None = Query(default=None),
) -> JSONResponse:
    # List view supports pagination and simple text filtering for the History page.
    body = list_history_runs(limit=limit, offset=offset, query=query).to_dict()
    return JSONResponse(content=body, headers=_HISTORY_NO_CACHE)


@router.get("/history/{run_id}")
def history_detail(run_id: str) -> JSONResponse:
    # Detail view includes the saved analysis payload used to reopen dashboard reports.
    detail = get_history_run(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="History run not found.")
    return JSONResponse(content=detail.to_dict(), headers=_HISTORY_NO_CACHE)


@router.delete("/history/{run_id}")
def delete_history(run_id: str) -> JSONResponse:
    # Normalize user-provided route params before touching persistence.
    normalized_run_id = str(run_id or "").strip()
    if not normalized_run_id:
        raise HTTPException(status_code=404, detail="History run not found.")
    if not delete_history_run(normalized_run_id):
        raise HTTPException(status_code=404, detail="History run not found.")
    return JSONResponse(
        content={"deleted": True, "run_id": normalized_run_id},
        headers=_HISTORY_NO_CACHE,
    )


@router.post("/history/{run_id}/visual-complexity")
def attach_visual_complexity(
    run_id: str,
    body: dict[str, Any] = Body(...),
) -> JSONResponse:
    # Visual complexity runs are stored after the main analysis so History can replay maps.
    if not has_history_run(run_id):
        raise HTTPException(status_code=404, detail="History run not found.")

    payload = body.get("result") if isinstance(body.get("result"), dict) else body
    source_label = body.get("source_label")
    source_type = body.get("source_type")
    # Require the analyzer's page summary because History cards depend on it.
    if not isinstance(payload, dict) or not isinstance(payload.get("page"), dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must include a ViCRAM result with a page object.",
        )

    try:
        summary = save_visual_complexity_result(
            run_id,
            payload,
            source_label=str(source_label).strip() if source_label else None,
            source_type=str(source_type).strip() if source_type else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return JSONResponse(
        content={"visual_complexity_summary": summary.to_dict()},
        headers=_HISTORY_NO_CACHE,
    )

