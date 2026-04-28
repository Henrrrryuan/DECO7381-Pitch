from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..core import SAMPLE_FILE_MAP

router = APIRouter()


@router.get("/api")
def api_root() -> dict[str, Any]:
    return {
        "name": "Cognitive Accessibility Assistant API",
        "status": "ok",
        "endpoints": [
            "/api",
            "/health",
            "/analyze",
            "/analyze-url",
            "/analyze-zip",
            "/visual-complexity",
            "/visual-complexity-url",
            "/history",
            "/history/{run_id}",
            "/eye/",
            "/eye/proxy",
            "/eye/sessions",
            "/eye/sessions/{session_id}",
        ],
    }


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/samples/{sample_name}")
def get_sample(sample_name: str) -> dict[str, str]:
    sample_path = SAMPLE_FILE_MAP.get(sample_name)
    if sample_path is None:
        raise HTTPException(status_code=404, detail="Sample not found.")
    return {
        "name": sample_name,
        "source_name": sample_path.name,
        "html": sample_path.read_text(encoding="utf-8"),
    }

