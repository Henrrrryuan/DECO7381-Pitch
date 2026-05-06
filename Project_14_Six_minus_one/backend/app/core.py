from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EYE_DIR = PROJECT_ROOT / "eye"
EYE_TEMP_HTML_DIR = PROJECT_ROOT / "backend" / "data" / "eye_temp_html"
MAX_EYE_TEMP_HTML_BYTES = 2 * 1024 * 1024  # 2 MiB (UTF-8 encoded body)
MAX_ZIP_UPLOAD_BYTES = 80 * 1024 * 1024  # 80MB
SAMPLE_INPUT_DIR = Path(__file__).resolve().parents[1] / "sample_input"
SAMPLE_FILE_MAP = {
    "simple": SAMPLE_INPUT_DIR / "simple-page.html",
    "dense": SAMPLE_INPUT_DIR / "dense-page.html",
    "consistency": SAMPLE_INPUT_DIR / "consistency-combined.html",
}


class AnalyzePayload(BaseModel):
    html: str
    source_name: str | None = None
    baseline_run_id: str | None = None
    persist_result: bool = True


class AnalyzeUrlPayload(BaseModel):
    url: str
    source_name: str | None = None
    baseline_run_id: str | None = None


class RenderedViewElementPayload(BaseModel):
    cognilensId: str
    tagName: str
    role: str | None = None
    text: str | None = None
    alt: str | None = None
    ariaLabel: str | None = None
    href: str | None = None
    selector: str | None = None
    rect: dict[str, float] | None = None
    visible: bool = True


class AnalyzeRenderedViewPayload(BaseModel):
    mode: str = "rendered_current_view"
    previewUrl: str | None = None
    source_name: str | None = None
    baseline_run_id: str | None = None
    persist_result: bool = True
    viewport: dict[str, float] | None = None
    elements: list[RenderedViewElementPayload]


class EyeTempHtmlUploadPayload(BaseModel):
    html: str


class SaveEyeTrackingSessionPayload(BaseModel):
    run_id: str | None = None
    source_name: str | None = None
    target_url: str | None = None
    html_snapshot: str | None = None
    sample_count: int
    duration_ms: int
    coverage_percent: float
    grid_cols: int
    grid_rows: int
    cell_counts: list[int]
    summary: dict[str, Any] | None = None


class AssistantChatPayload(BaseModel):
    message: str
    source_name: str | None = None
    analysis_context: dict[str, Any] | None = None


# Keep only shared app-level constants and request payload schemas here.

