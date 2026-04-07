from __future__ import annotations

from typing import Any

from .analyzers import (
    analyze_consistency,
    analyze_interaction,
    analyze_readability,
    analyze_visual,
)
from .scoring import calculate_overall_score
from .schemas import AnalysisResult


def analyze_html(html: str) -> AnalysisResult:
    dimensions = [
        analyze_readability(html),
        analyze_visual(html),
        analyze_interaction(html),
        analyze_consistency(html),
    ]
    return calculate_overall_score(dimensions)


def analyze_html_dict(html: str) -> dict[str, Any]:
    return analyze_html(html).to_dict()


try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    class AnalyzePayload(BaseModel):
        html: str

    app = FastAPI(title="Cognitive Accessibility Assistant API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/analyze")
    def analyze(payload: AnalyzePayload) -> dict[str, Any]:
        return analyze_html_dict(payload.html)

except ImportError:  # pragma: no cover - FastAPI is optional at scaffold stage.
    app = None
