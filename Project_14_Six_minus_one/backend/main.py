from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path
from typing import Any

REQUIRED_RUNTIME_MODULES: dict[str, str] = {
    "bs4": "beautifulsoup4",
    "fastapi": "fastapi",
    "multipart": "python-multipart",
}


def _assert_runtime_dependencies() -> None:
    missing = [
        (module_name, package_name)
        for module_name, package_name in REQUIRED_RUNTIME_MODULES.items()
        if find_spec(module_name) is None
    ]
    if not missing:
        return

    missing_modules = ", ".join(module_name for module_name, _ in missing)
    install_packages = " ".join(
        sorted({package_name for _, package_name in missing})
    )
    raise ModuleNotFoundError(
        "Missing backend runtime dependencies: "
        f"{missing_modules}. Install with "
        "`python -m pip install -r requirements.txt` "
        f"or `python -m pip install {install_packages}`."
    )


_assert_runtime_dependencies()

from .analyzers import (
    analyze_consistency,
    analyze_interaction,
    analyze_readability,
    analyze_visual,
)
from .history_store import (
    get_history_run,
    has_history_run,
    init_history_store,
    list_history_runs,
    record_compare_pair,
    save_analysis_run,
)
from .scoring import calculate_overall_score
from .schemas import AnalysisResult
from .zip_input import (
    ExtractedWebBundle,
    ZipInputError,
    extract_html_from_zip_bytes,
    extract_web_bundle_from_zip_bytes,
)
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MAX_ZIP_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
SAMPLE_INPUT_DIR = Path(__file__).resolve().parent / "sample_input"
SAMPLE_FILE_MAP = {
    "simple": SAMPLE_INPUT_DIR / "simple-page.html",
    "dense": SAMPLE_INPUT_DIR / "dense-page.html",
    "consistency": SAMPLE_INPUT_DIR / "consistency-combined.html",
}

init_history_store()


def analyze_html(
    html: str,
    *,
    css_sources: list[str] | None = None,
    js_sources: list[str] | None = None,
) -> AnalysisResult:
    dimensions = [
        analyze_readability(html),
        analyze_visual(html, css_sources=css_sources, js_sources=js_sources),
        analyze_interaction(html, js_sources=js_sources),
        analyze_consistency(html),
    ]
    return calculate_overall_score(dimensions)


def analyze_html_dict(
    html: str,
    *,
    css_sources: list[str] | None = None,
    js_sources: list[str] | None = None,
) -> dict[str, Any]:
    return analyze_html(html, css_sources=css_sources, js_sources=js_sources).to_dict()


class AnalyzePayload(BaseModel):
    html: str
    source_name: str | None = None
    baseline_run_id: str | None = None


def build_analysis_response(
    analysis: AnalysisResult,
    *,
    html_content: str,
    source_name: str | None,
    baseline_run_id: str | None,
) -> dict[str, Any]:
    saved_run = save_analysis_run(analysis, html_content, source_name)
    resolved_baseline_run_id = None
    if baseline_run_id and has_history_run(baseline_run_id):
        record_compare_pair(baseline_run_id, saved_run.run_id)
        resolved_baseline_run_id = baseline_run_id

    payload = analysis.to_dict()
    payload["run"] = saved_run.to_dict()
    payload["html_content"] = html_content
    payload["baseline_run_id"] = resolved_baseline_run_id
    return payload


app = FastAPI(title="Cognitive Accessibility Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "name": "Cognitive Accessibility Assistant API",
        "status": "ok",
        "endpoints": [
            "/health",
            "/analyze",
            "/analyze-zip",
            "/history",
            "/history/{run_id}",
        ],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/samples/{sample_name}")
def get_sample(sample_name: str) -> dict[str, str]:
    sample_path = SAMPLE_FILE_MAP.get(sample_name)
    if sample_path is None:
        raise HTTPException(status_code=404, detail="Sample not found.")
    return {
        "name": sample_name,
        "source_name": sample_path.name,
        "html": sample_path.read_text(encoding="utf-8"),
    }


@app.get("/history")
def history(limit: int = Query(default=10, ge=1, le=50)) -> dict[str, Any]:
    return list_history_runs(limit=limit).to_dict()


@app.get("/history/{run_id}")
def history_detail(run_id: str) -> dict[str, Any]:
    detail = get_history_run(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="History run not found.")
    return detail.to_dict()


@app.post("/analyze")
def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    analysis = analyze_html(payload.html)
    return build_analysis_response(
        analysis,
        html_content=payload.html,
        source_name=payload.source_name,
        baseline_run_id=payload.baseline_run_id,
    )


@app.post("/analyze-zip")
async def analyze_zip(
    file: UploadFile = File(...),
    baseline_run_id: str | None = Form(None),
) -> dict[str, Any]:
    filename = (file.filename or "").lower()
    if not filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip uploads are supported.")

    zip_bytes = await file.read()
    if not zip_bytes:
        raise HTTPException(status_code=400, detail="The uploaded ZIP file is empty.")
    if len(zip_bytes) > MAX_ZIP_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                "ZIP file is too large. Limit: "
                f"{MAX_ZIP_UPLOAD_BYTES // (1024 * 1024)}MB."
            ),
        )

    try:
        bundle = extract_web_bundle_from_zip_bytes(zip_bytes)
    except ZipInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analysis = analyze_html(
        bundle.inlined_html,
        css_sources=list(bundle.css_files.values()),
        js_sources=list(bundle.js_files.values()),
    )
    payload = build_analysis_response(
        analysis,
        html_content=bundle.html,
        source_name=file.filename or "uploaded.zip",
        baseline_run_id=baseline_run_id,
    )
    payload["resource_bundle"] = {
        "entry_name": bundle.entry_name,
        "css_file_count": len(bundle.css_files),
        "js_file_count": len(bundle.js_files),
        "css_files": sorted(bundle.css_files.keys()),
        "js_files": sorted(bundle.js_files.keys()),
    }
    return payload
