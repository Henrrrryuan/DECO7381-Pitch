from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ...analyzers import analyze_rendered_visual_complexity, analyze_visual_complexity
from ...adapters.http.eye_proxy import EyeProxyBadRequest, EyeProxyFetchError, fetch_proxied_response
from ...adapters.input.snapshot_input import SnapshotInputError, capture_rendered_snapshot
from ...adapters.input.url_input import UrlInputError, extract_web_bundle_from_url_html
from ...adapters.input.zip_input import ZipInputError, extract_web_bundle_from_zip_bytes
from ...services.analysis_service import analyze_html, build_analysis_response
from ..core import MAX_ZIP_UPLOAD_BYTES, AnalyzePayload, AnalyzeUrlPayload

router = APIRouter()


@router.post("/analyze")
def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    analysis = analyze_html(payload.html)
    if not payload.persist_result:
        response_payload = analysis.to_dict()
        response_payload["html_content"] = payload.html
        response_payload["baseline_run_id"] = None
        return response_payload
    return build_analysis_response(
        analysis,
        html_content=payload.html,
        source_name=payload.source_name,
        baseline_run_id=payload.baseline_run_id,
    )


@router.post("/visual-complexity")
def visual_complexity(payload: AnalyzePayload) -> dict[str, Any]:
    return analyze_visual_complexity(payload.html)


@router.post("/visual-complexity-url")
def visual_complexity_url(payload: AnalyzeUrlPayload) -> dict[str, Any]:
    try:
        snapshot = capture_rendered_snapshot(payload.url)
    except SnapshotInputError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return analyze_rendered_visual_complexity(
        {
            "final_url": snapshot.final_url,
            "title": snapshot.title,
            "html": snapshot.html,
            "viewport": snapshot.viewport,
            "elements": snapshot.elements,
        }
    )


@router.post("/analyze-url")
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


@router.post("/analyze-zip")
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

