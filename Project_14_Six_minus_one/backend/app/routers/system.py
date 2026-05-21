from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..core import SAMPLE_FILE_MAP

router = APIRouter()


@router.get("/api")
def api_root() -> dict[str, Any]:
    # Lightweight service manifest for manual checks and frontend diagnostics.
    return {
        "name": "Cognitive Accessibility Assistant API",
        "status": "ok",
        "endpoints": [
            "/api",
            "/health",
            "/analyze",
            "/analyze-url",
            "/analyze-zip",
            "/history",
            "/history/{run_id}",
            "DELETE /history/{run_id}",
            "/eye/",
            "/eye/proxy",
            "/eye/temp-html",
            "/eye/temp-html/{token}",
            "/eye/sessions",
            "/eye/sessions/by-run/{run_id}",
            "/eye/sessions/{session_id}",
        ],
    }


@router.get("/health")
def health() -> dict[str, str]:
    # Used by local startup checks to confirm the backend is listening.
    return {"status": "ok"}


@router.get("/samples/{sample_name}")
def get_sample(sample_name: str) -> dict[str, str]:
    # Sample fixtures let the frontend run repeatable analyses without uploading files.
    sample_path = SAMPLE_FILE_MAP.get(sample_name)
    if sample_path is None:
        raise HTTPException(status_code=404, detail="Sample not found.")
    return {
        "name": sample_name,
        "source_name": sample_path.name,
        "html": sample_path.read_text(encoding="utf-8"),
    }

