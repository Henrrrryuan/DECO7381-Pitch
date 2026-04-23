from __future__ import annotations

import json
import os
import ssl
from importlib.util import find_spec
from pathlib import Path
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

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
from .eye_proxy import (
    EyeProxyBadRequest,
    EyeProxyFetchError,
    fetch_proxied_response,
)
from .history_store import (
    get_eye_tracking_session,
    get_history_run,
    has_history_run,
    init_history_store,
    list_eye_tracking_sessions,
    list_history_runs,
    record_compare_pair,
    save_eye_tracking_session,
    save_analysis_run,
)
from .scoring import calculate_overall_score
from .schemas import AnalysisResult
from .url_input import (
    UrlInputError,
    extract_web_bundle_from_url_html,
)
from .zip_input import (
    ExtractedWebBundle,
    ZipInputError,
    extract_html_from_zip_bytes,
    extract_web_bundle_from_zip_bytes,
)
from fastapi import FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
EYE_DIR = PROJECT_ROOT / "eye"
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


class AnalyzeUrlPayload(BaseModel):
    url: str
    source_name: str | None = None
    baseline_run_id: str | None = None


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


def format_analysis_context(context: dict[str, Any] | None) -> str:
    if not context:
        return "No analysis context was provided."

    lines = [
        f"Source: {context.get('source_name') or 'Uploaded file'}",
        f"Overall score: {context.get('overall_score', 'n/a')}",
        f"Lowest dimension score: {context.get('min_dimension_score', 'n/a')}",
    ]

    for dimension in context.get("dimensions", []):
        issue_count = len(dimension.get("issues", []))
        lines.append(
            f"- {dimension.get('dimension', 'Unknown dimension')}: score {dimension.get('score', 'n/a')}, issues {issue_count}"
        )
        for issue in dimension.get("issues", [])[:2]:
            lines.append(
                "  "
                + f"* {issue.get('rule_id', 'rule')}: {issue.get('description', '')}"
            )

    return "\n".join(lines)


def build_fallback_assistant_reply(payload: AssistantChatPayload) -> str:
    context = payload.analysis_context or {}
    dimensions = context.get("dimensions", [])
    risky_dimensions = [dimension for dimension in dimensions if dimension.get("issues")]

    opening = (
        "Claude API is not currently available, so this reply is generated from the local analysis context."
    )
    if not risky_dimensions:
        return (
            f"{opening}\n\n"
            "The current page does not trigger any of the active heuristic rules. "
            "You can ask me to explain a dimension in more detail or upload a denser page for richer feedback."
        )

    first_dimension = risky_dimensions[0]
    bullets = []
    for issue in first_dimension.get("issues", [])[:3]:
        bullets.append(
            f"- {issue.get('rule_id', 'Issue')}: {issue.get('suggestion', 'Review this issue and simplify the interaction.')}"
        )

    return (
        f"{opening}\n\n"
        f"Based on your question: \"{payload.message}\", the most urgent area is "
        f"{first_dimension.get('dimension', 'the current dimension')} "
        f"(score {first_dimension.get('score', 'n/a')}).\n\n"
        "Recommended first fixes:\n"
        + "\n".join(bullets)
    )


def call_claude_assistant(payload: AssistantChatPayload) -> str:
    auth_token = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not auth_token:
        return build_fallback_assistant_reply(payload)

    base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
    endpoint = f"{base_url}/v1/messages"
    preferred_models = [
        os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
    ]
    system_prompt = (
        "You are an AI accessibility assistant inside CogniLens. "
        "Answer briefly and concretely for a developer. Focus on cognitive accessibility, readability, "
        "visual clutter, interaction distraction, and consistency. Prioritize the most important fix first. "
        "Keep the answer concise and avoid markdown tables."
    )
    user_prompt = (
        f"User question:\n{payload.message}\n\n"
        "Analysis context:\n"
        f"{format_analysis_context(payload.analysis_context)}"
    )
    headers = {
        "Content-Type": "application/json",
        "x-api-key": auth_token,
        "Authorization": f"Bearer {auth_token}",
        "anthropic-version": "2023-06-01",
    }
    ssl_context = None
    if endpoint.startswith("https://"):
        if find_spec("certifi") is not None:
            import certifi

            ssl_context = ssl.create_default_context(cafile=certifi.where())
        elif "api.anthropic.com" not in endpoint:
            ssl_context = ssl._create_unverified_context()

    opener = None
    if ssl_context is not None:
        opener = urllib_request.build_opener(urllib_request.HTTPSHandler(context=ssl_context))

    last_error: Exception | None = None
    for model in dict.fromkeys(preferred_models):
        request_body = {
            "model": model,
            "max_tokens": 320,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        request = urllib_request.Request(
            endpoint,
            data=json.dumps(request_body).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            open_fn = opener.open if opener is not None else urllib_request.urlopen
            with open_fn(request, timeout=45) as response:
                payload_json = json.loads(response.read().decode("utf-8"))
        except urllib_error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="ignore")
            if "model_not_found" in error_body:
                last_error = exc
                continue
            return build_fallback_assistant_reply(payload)
        except (urllib_error.URLError, TimeoutError) as exc:
            last_error = exc
            continue

        content = payload_json.get("content", [])
        text_parts = [
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        reply = "\n".join(part.strip() for part in text_parts if part.strip())
        if reply:
            return reply

    return build_fallback_assistant_reply(payload)


app = FastAPI(title="Cognitive Accessibility Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api")
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
            "/history",
            "/history/{run_id}",
            "/eye/",
            "/eye/proxy",
            "/eye/sessions",
            "/eye/sessions/{session_id}",
        ],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/eye/proxy")
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
def history(
    limit: int = Query(default=10, ge=1, le=50),
    query: str | None = Query(default=None),
) -> dict[str, Any]:
    return list_history_runs(limit=limit, query=query).to_dict()


@app.get("/history/{run_id}")
def history_detail(run_id: str) -> dict[str, Any]:
    detail = get_history_run(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="History run not found.")
    return detail.to_dict()


@app.get("/eye/sessions")
def eye_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    query: str | None = Query(default=None),
    run_id: str | None = Query(default=None),
) -> dict[str, Any]:
    return list_eye_tracking_sessions(limit=limit, query=query, run_id=run_id).to_dict()


@app.get("/eye/sessions/{session_id}")
def eye_session_detail(session_id: str) -> dict[str, Any]:
    detail = get_eye_tracking_session(session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Eye tracking session not found.")
    return detail.to_dict()


@app.post("/eye/sessions")
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


@app.post("/analyze")
def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    analysis = analyze_html(payload.html)
    return build_analysis_response(
        analysis,
        html_content=payload.html,
        source_name=payload.source_name,
        baseline_run_id=payload.baseline_run_id,
    )


@app.post("/analyze-url")
def analyze_url(payload: AnalyzeUrlPayload) -> dict[str, Any]:
    try:
        proxied = fetch_proxied_response(payload.url)
    except EyeProxyBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except EyeProxyFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if proxied.status_code >= 400:
        raise HTTPException(
            status_code=proxied.status_code,
            detail=f"Target URL returned status {proxied.status_code}.",
        )

    if "text/html" not in proxied.content_type.lower():
        raise HTTPException(
            status_code=400,
            detail="The target URL did not return an HTML page.",
        )

    html_content = proxied.body.decode("utf-8", errors="replace")
    try:
        bundle = extract_web_bundle_from_url_html(html_content, proxied.final_url)
    except UrlInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    analysis = analyze_html(
        bundle.inlined_html,
        css_sources=list(bundle.css_files.values()),
        js_sources=list(bundle.js_files.values()),
    )
    payload_dict = build_analysis_response(
        analysis,
        html_content=html_content,
        source_name=proxied.final_url or payload.source_name,
        baseline_run_id=payload.baseline_run_id,
    )
    for dimension in payload_dict.get("dimensions", []):
        metadata = dimension.get("metadata") or {}
        input_scope = metadata.setdefault("input_scope", [])
        if "url_fetch" not in input_scope:
            input_scope.append("url_fetch")
        metadata["out_of_scope"] = [
            item for item in metadata.get("out_of_scope", []) if item != "live_url_fetch"
        ]
    payload_dict["resource_bundle"] = {
        "entry_name": proxied.final_url,
        "css_file_count": len(bundle.css_files),
        "js_file_count": len(bundle.js_files),
        "css_files": sorted(bundle.css_files.keys()),
        "js_files": sorted(bundle.js_files.keys()),
    }
    return payload_dict


@app.post("/assistant/chat")
def assistant_chat(payload: AssistantChatPayload) -> dict[str, Any]:
    reply = call_claude_assistant(payload)
    provider = (
        "claude"
        if (os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY"))
        else "fallback"
    )
    return {
        "reply": reply,
        "provider": provider,
    }


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


app.mount("/eye", StaticFiles(directory=EYE_DIR, html=True), name="eye")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
