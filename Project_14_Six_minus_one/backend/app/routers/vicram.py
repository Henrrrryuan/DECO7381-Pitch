from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ...analyzers.vicram_complexity import (
    VicramAnalysisError,
    analyze_vicram_html,
    analyze_vicram_url,
)
from ..core import VicramAnalyzePayload, VicramUrlPayload

router = APIRouter(tags=["vicram"])


@router.post("/vicram/analyze-url")
@router.post("/api/vicram/analyze-url")
def analyze_vicram(payload: VicramUrlPayload) -> dict[str, Any]:
    try:
        # Keep both legacy and current URL endpoints mapped to the same analyzer.
        return analyze_vicram_url(
            payload.url,
            rows=payload.rows,
            columns=payload.columns,
            viewport_width=payload.viewport_width,
            viewport_height=payload.viewport_height,
        )
    except VicramAnalysisError as exc:
        # Analysis failures are user-correctable input/rendering issues, not server crashes.
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/api/vicram/analyze")
def analyze_vicram_source(payload: VicramAnalyzePayload) -> dict[str, Any]:
    try:
        # The dashboard can analyze either a live URL or a prepared HTML preview.
        if payload.url:
            return analyze_vicram_url(
                payload.url,
                rows=payload.rows,
                columns=payload.columns,
                viewport_width=payload.viewport_width,
                viewport_height=payload.viewport_height,
            )
        if payload.html:
            return analyze_vicram_html(
                payload.html,
                rows=payload.rows,
                columns=payload.columns,
                viewport_width=payload.viewport_width,
                viewport_height=payload.viewport_height,
            )
        raise VicramAnalysisError("Provide either a URL or HTML content for ViCRAM analysis.")
    except VicramAnalysisError as exc:
        # Surface analyzer messages directly so the dashboard can explain what failed.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
