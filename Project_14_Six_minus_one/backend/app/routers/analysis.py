from __future__ import annotations

import io
import mimetypes
import os
import re
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from ...adapters.http.eye_proxy import EyeProxyBadRequest, EyeProxyFetchError, fetch_proxied_response
from ...adapters.input.snapshot_input import SnapshotInputError, capture_rendered_snapshot
from ...adapters.input.url_input import UrlInputError, extract_web_bundle_from_url_html
from ...adapters.input.zip_input import ZipInputError, extract_web_bundle_from_zip_bytes
from ...services.analysis_service import analyze_html, build_analysis_response
from ..core import (
    MAX_ZIP_UPLOAD_BYTES,
    AnalyzePayload,
    AnalyzeUrlPayload,
    PROJECT_ROOT,
)

router = APIRouter()

# Uploaded ZIP sites are expanded here so the dashboard iframe can preview them.
PREVIEW_ROOT_DIR = PROJECT_ROOT / "backend" / "data" / "uploaded_previews"
ABSOLUTE_ASSET_ATTR_PATTERN = re.compile(
    r"""(?P<attr>(?:href|src|action))=(?P<quote>["'])/(?P<asset>[^"']+) (?P=quote)""".replace(" ", ""),
    re.IGNORECASE,
)


def _is_safe_zip_member(member_name: str) -> bool:
    # Reject absolute paths and traversal entries before extracting user ZIP content.
    path = PurePosixPath(member_name.replace("\\", "/"))
    if path.is_absolute():
        return False
    return all(part not in {"", ".", ".."} for part in path.parts)


def _extract_zip_to_preview_dir(zip_bytes: bytes, preview_dir: Path) -> None:
    try:
        with ZipFile(io.BytesIO(zip_bytes)) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                normalized = info.filename.replace("\\", "/")
                if not _is_safe_zip_member(normalized):
                    continue
                target_path = preview_dir / normalized
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info, "r") as source, target_path.open("wb") as target:
                    target.write(source.read())
    except BadZipFile as exc:
        raise ZipInputError("The uploaded file is not a valid ZIP archive.") from exc


def _find_preview_entry_file(preview_dir: Path) -> Path:
    # Prefer index files because most static website exports expect them as entry points.
    root_indexes = [
        candidate
        for candidate in (preview_dir / "index.html", preview_dir / "index.htm")
        if candidate.exists() and candidate.is_file()
    ]
    if root_indexes:
        return root_indexes[0]

    top_level_dirs = sorted(item for item in preview_dir.iterdir() if item.is_dir())
    for folder in top_level_dirs:
        for index_name in ("index.html", "index.htm"):
            nested_index = folder / index_name
            if nested_index.exists() and nested_index.is_file():
                return nested_index

    all_html_files = sorted(
        file_path
        for file_path in preview_dir.rglob("*")
        if file_path.is_file() and file_path.suffix.lower() in {".html", ".htm"}
    )
    for file_path in all_html_files:
        if file_path.name.lower() in {"index.html", "index.htm"}:
            return file_path
    if all_html_files:
        return all_html_files[0]
    raise ZipInputError("No .html or .htm file was found after extracting the ZIP package.")


def _rel_preview_path(preview_dir: Path, file_path: Path) -> str:
    return file_path.relative_to(preview_dir).as_posix()


def _preview_url(preview_id: str, rel_path: str) -> str:
    return f"/preview/{preview_id}/{rel_path}"


def _rewrite_html_for_preview(html: str, preview_id: str, rel_path: str) -> str:
    # Inject a preview-local base path so uploaded static sites keep relative assets working.
    current_dir = PurePosixPath(rel_path).parent
    current_dir_text = "" if current_dir.as_posix() == "." else current_dir.as_posix().strip("/")
    asset_base = f"/preview/{preview_id}/"
    if current_dir_text:
        asset_base = f"{asset_base}{current_dir_text}/"

    def _replace(match: re.Match[str]) -> str:
        attr = match.group("attr")
        quote = match.group("quote")
        asset = match.group("asset")
        rewritten = f"{asset_base}{asset}"
        return f"{attr}={quote}{rewritten}{quote}"

    rewritten = ABSOLUTE_ASSET_ATTR_PATTERN.sub(_replace, html)
    base_href = asset_base
    if "<head" in rewritten.lower():
        rewritten = re.sub(
            r"<head([^>]*)>",
            lambda match: f"<head{match.group(1)}><base href=\"{base_href}\">",
            rewritten,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        rewritten = f"<base href=\"{base_href}\">{rewritten}"
    return rewritten


@router.get("/preview/{preview_id}/{asset_path:path}")
def preview_uploaded_site(preview_id: str, asset_path: str) -> Response:
    # Serve only files inside the generated preview folder for this upload.
    preview_dir = PREVIEW_ROOT_DIR / preview_id
    if not preview_dir.exists():
        raise HTTPException(status_code=404, detail="Preview not found.")

    normalized = PurePosixPath(asset_path)
    if normalized.is_absolute() or any(part in {"", ".", ".."} for part in normalized.parts):
        raise HTTPException(status_code=400, detail="Invalid preview asset path.")

    target = (preview_dir / normalized.as_posix()).resolve()
    preview_root_resolved = preview_dir.resolve()
    if preview_root_resolved not in target.parents and target != preview_root_resolved:
        raise HTTPException(status_code=400, detail="Invalid preview asset path.")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Preview asset not found.")

    suffix = target.suffix.lower()
    if suffix in {".html", ".htm"}:
        html = target.read_text(encoding="utf-8", errors="replace")
        rewritten = _rewrite_html_for_preview(html, preview_id, normalized.as_posix())
        return Response(content=rewritten, media_type="text/html; charset=utf-8")

    media_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(target, media_type=media_type)


@router.post("/analyze")
def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    # Direct HTML analysis is used for pasted/uploaded single-file pages.
    analysis = analyze_html(payload.html)
    if not payload.persist_result:
        # Some UI flows need a transient analysis without adding a history record.
        response_payload = analysis.to_dict()
        response_payload["html_content"] = payload.html
        response_payload["baseline_run_id"] = None
        return response_payload
    response_payload = build_analysis_response(
        analysis,
        html_content=payload.html,
        source_name=payload.source_name,
        baseline_run_id=payload.baseline_run_id,
    )
    return response_payload


def _dt1_locations_summary(payload_dict: dict[str, Any]) -> dict[str, Any]:
    dims = payload_dict.get("dimensions") or []
    for dim in dims:
        if dim.get("dimension") != "Dense Text Detection":
            continue
        for issue in dim.get("issues") or []:
            if issue.get("rule_id") != "DT-1":
                continue
            locs = issue.get("locations") or []
            selectors = [str(loc.get("selector") or "") for loc in locs if isinstance(loc, dict)]
            ids = []
            for idx, loc in enumerate(locs):
                if not isinstance(loc, dict):
                    continue
                attrs = loc.get("attrs") if isinstance(loc.get("attrs"), dict) else {}
                dom_id = str(attrs.get("id") or "")
                case_id = str(attrs.get("data-case-id") or "")
                tag = str(loc.get("tag") or "")
                selector = str(loc.get("selector") or "")
                text = str(loc.get("text") or loc.get("preview") or "")
                ids.append(f"dt:{idx}:{selector}:{tag}:{dom_id}:{case_id}:{len(text)}")
            dup_selector_count = sum(1 for s in set(selectors) if s and selectors.count(s) > 1)
            dup_text_count = 0
            return {
                "dt_location_count": len(locs),
                "dt_location_ids": ids,
                "selectors": selectors,
                "duplicate_selector_count": dup_selector_count,
                "duplicate_text_count": dup_text_count,
            }
    return {"dt_location_count": 0, "dt_location_ids": [], "selectors": [], "duplicate_selector_count": 0, "duplicate_text_count": 0}


def _lcc_locations_summary(payload_dict: dict[str, Any]) -> dict[str, Any]:
    dims = payload_dict.get("dimensions") or []
    for dim in dims:
        if dim.get("dimension") != "Long Content Without Chunking":
            continue
        for issue in dim.get("issues") or []:
            if issue.get("rule_id") != "LCC-1":
                continue
            locs = issue.get("locations") or []
            selectors = [str(loc.get("selector") or "") for loc in locs if isinstance(loc, dict)]
            ids = []
            for idx, loc in enumerate(locs):
                if not isinstance(loc, dict):
                    continue
                attrs = loc.get("attrs") if isinstance(loc.get("attrs"), dict) else {}
                dom_id = str(attrs.get("id") or "")
                case_id = str(attrs.get("data-case-id") or "")
                tag = str(loc.get("tag") or "")
                selector = str(loc.get("selector") or "")
                wc = str(loc.get("word_count") or "")
                hc = str(loc.get("heading_count") or "")
                lc = str(loc.get("list_count") or "")
                pc = str(loc.get("paragraph_count") or "")
                ids.append(f"lcc:{idx}:{selector}:{tag}:{dom_id}:{case_id}:{wc}:{hc}:{lc}:{pc}")
            dup_selector_count = sum(1 for s in set(selectors) if s and selectors.count(s) > 1)
            return {
                "raw_candidate_count": None,
                "issue_count": 1,
                "location_count_before_sanitize": None,
                "location_count_after_sanitize": len(locs),
                "grouped_into_single_issue": len(locs) > 1,
                "grouping_reason": "single_issue_locations_array_cap_8" if len(locs) > 1 else "",
                "location_count": len(locs),
                "location_ids": ids,
                "selectors": selectors,
                "duplicate_selector_count": dup_selector_count,
            }
    return {
        "raw_candidate_count": None,
        "issue_count": 0,
        "location_count_before_sanitize": None,
        "location_count_after_sanitize": 0,
        "grouped_into_single_issue": False,
        "grouping_reason": "",
        "location_count": 0,
        "location_ids": [],
        "selectors": [],
        "duplicate_selector_count": 0,
    }


def _amc_locations_summary(payload_dict: dict[str, Any]) -> dict[str, Any]:
    dims = payload_dict.get("dimensions") or []
    for dim in dims:
        if dim.get("dimension") != "Auto-Moving Content":
            continue
        for issue in dim.get("issues") or []:
            if issue.get("rule_id") != "AMC-1":
                continue
            locs = issue.get("locations") or []
            ids = []
            for idx, loc in enumerate(locs):
                if not isinstance(loc, dict):
                    continue
                tag = str(loc.get("tag") or "")
                summary = str(loc.get("summary") or "")
                region = str(loc.get("region") or "")
                muted = str(loc.get("muted") or "")
                src = str(loc.get("src") or "")
                ids.append(f"amc:{idx}:{tag}:{region}:{muted}:{len(summary)}:{len(src)}")
            summaries = [str(loc.get("summary") or "") for loc in locs if isinstance(loc, dict)]
            dup_summary_count = sum(1 for s in set(summaries) if s and summaries.count(s) > 1)
            return {
                "raw_candidate_count": None,
                "issue_count": 1,
                "location_count_before_sanitize": None,
                "location_count_after_sanitize": len(locs),
                "rendered_location_count": None,
                "grouped_into_single_issue": True,
                "grouping_reason": "single_issue_max_underlying_issue",
                "collapse_detected": False,
                "collapse_stage": "",
                "location_count": len(locs),
                "location_ids": ids,
                "duplicate_summary_count": dup_summary_count,
            }
    return {
        "raw_candidate_count": None,
        "issue_count": 0,
        "location_count_before_sanitize": None,
        "location_count_after_sanitize": 0,
        "rendered_location_count": None,
        "grouped_into_single_issue": False,
        "grouping_reason": "",
        "collapse_detected": False,
        "collapse_stage": "",
        "location_count": 0,
        "location_ids": [],
        "duplicate_summary_count": 0,
    }


@router.post("/analyze-url")
def analyze_url(payload: AnalyzeUrlPayload) -> dict[str, Any]:
    """Prefer a Playwright-rendered DOM so SPA frameworks expose post-hydration markup.

    Falls back to the existing proxied HTML fetch when Playwright is unavailable or fails.
    """

    rendered_snapshot_used = False
    html_content = ""
    final_url = ""

    try:
        # Render first when possible so modern client-side pages expose hydrated markup.
        snapshot = capture_rendered_snapshot(payload.url)
        html_content = snapshot.html
        final_url = snapshot.final_url or payload.url
        rendered_snapshot_used = True
    except SnapshotInputError:
        # Fallback keeps URL analysis usable when Playwright is unavailable locally.
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
        final_url = proxied.final_url
        rendered_snapshot_used = False

    try:
        bundle = extract_web_bundle_from_url_html(html_content, final_url)
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
        source_name=final_url or payload.source_name,
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
        metadata["rendered_snapshot_used"] = rendered_snapshot_used
    payload_dict["rendered_snapshot_used"] = rendered_snapshot_used
    payload_dict["resource_bundle"] = {
        "entry_name": final_url,
        "css_file_count": len(bundle.css_files),
        "js_file_count": len(bundle.js_files),
        "css_files": sorted(bundle.css_files.keys()),
        "js_files": sorted(bundle.js_files.keys()),
        "rendered_snapshot_used": rendered_snapshot_used,
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

    preview_id = uuid4().hex
    preview_dir = PREVIEW_ROOT_DIR / preview_id
    preview_dir.mkdir(parents=True, exist_ok=True)
    try:
        # Build the browser preview before extracting the analyzable resource bundle.
        _extract_zip_to_preview_dir(zip_bytes, preview_dir)
        entry_file = _find_preview_entry_file(preview_dir)
        entry_rel = _rel_preview_path(preview_dir, entry_file)
        preview_url = _preview_url(preview_id, entry_rel)
    except ZipInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        bundle = extract_web_bundle_from_zip_bytes(zip_bytes)
    except ZipInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Prefer analyzing the same entry HTML that is used for the preview, so the
    # report and the iframe share a consistent DOM snapshot. Fall back to the
    # original inlined HTML if the entry file cannot be read.
    try:
        entry_html = entry_file.read_text(encoding="utf-8", errors="replace")
        analysis_html = _rewrite_html_for_preview(entry_html, preview_id, entry_rel)
    except OSError:
        analysis_html = bundle.inlined_html

    analysis = analyze_html(
        analysis_html,
        css_sources=list(bundle.css_files.values()),
        js_sources=list(bundle.js_files.values()),
    )
    payload = build_analysis_response(
        analysis,
        html_content=analysis_html,
        source_name=file.filename or "uploaded.zip",
        baseline_run_id=baseline_run_id,
    )
    payload["resource_bundle"] = {
        "entry_name": bundle.entry_name,
        "css_file_count": len(bundle.css_files),
        "js_file_count": len(bundle.js_files),
        "css_files": sorted(bundle.css_files.keys()),
        "js_files": sorted(bundle.js_files.keys()),
        "preview_id": preview_id,
        "preview_url": preview_url,
    }
    payload["analysis_id"] = payload.get("run", {}).get("run_id")
    payload["preview_id"] = preview_id
    payload["preview_url"] = preview_url
    return payload
