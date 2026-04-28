from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response

from ...adapters.http.eye_proxy import EyeProxyBadRequest, EyeProxyFetchError, fetch_proxied_response
from ...adapters.persistence.history_store import (
    get_eye_tracking_session,
    has_history_run,
    list_eye_tracking_sessions,
    save_eye_tracking_session,
)
from ..core import SaveEyeTrackingSessionPayload

router = APIRouter()


@router.get("/eye/proxy")
def eye_proxy(url: str = Query(...)) -> Response:
    try:
        proxied = fetch_proxied_response(url)
    except EyeProxyBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except EyeProxyFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(
        content=proxied.body,
        status_code=proxied.status_code,
        media_type=proxied.content_type,
        headers={
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "X-Proxy-Final-Url": proxied.final_url,
        },
    )


@router.get("/eye/sessions")
def eye_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    query: str | None = Query(default=None),
    run_id: str | None = Query(default=None),
) -> dict[str, Any]:
    return list_eye_tracking_sessions(limit=limit, query=query, run_id=run_id).to_dict()


@router.get("/eye/sessions/{session_id}")
def eye_session_detail(session_id: str) -> dict[str, Any]:
    detail = get_eye_tracking_session(session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Eye tracking session not found.")
    return detail.to_dict()


@router.post("/eye/sessions")
def save_eye_session(payload: SaveEyeTrackingSessionPayload) -> dict[str, Any]:
    if payload.run_id and not has_history_run(payload.run_id):
        raise HTTPException(status_code=400, detail="The related analysis run does not exist.")

    if payload.sample_count < 0 or payload.duration_ms < 0:
        raise HTTPException(status_code=400, detail="Session metrics must be non-negative.")

    expected_cells = payload.grid_cols * payload.grid_rows
    if payload.grid_cols <= 0 or payload.grid_rows <= 0:
        raise HTTPException(status_code=400, detail="Grid dimensions must be greater than zero.")
    if len(payload.cell_counts) != expected_cells:
        raise HTTPException(
            status_code=400,
            detail="cell_counts length must match grid_cols * grid_rows.",
        )

    saved_session = save_eye_tracking_session(
        run_id=payload.run_id,
        source_name=payload.source_name,
        target_url=payload.target_url,
        html_snapshot=payload.html_snapshot,
        sample_count=payload.sample_count,
        duration_ms=payload.duration_ms,
        coverage_percent=payload.coverage_percent,
        grid_cols=payload.grid_cols,
        grid_rows=payload.grid_rows,
        cell_counts=payload.cell_counts,
        summary=payload.summary,
    )
    return {"session": saved_session.to_dict()}

