from __future__ import annotations

import io
from html import escape
import mimetypes
import re
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from ...analyzers import analyze_rendered_visual_complexity, analyze_visual_complexity
from ...adapters.http.eye_proxy import EyeProxyBadRequest, EyeProxyFetchError, fetch_proxied_response
from ...adapters.input.snapshot_input import SnapshotInputError, capture_rendered_snapshot
from ...adapters.input.url_input import UrlInputError, extract_web_bundle_from_url_html
from ...adapters.input.zip_input import ZipInputError, extract_web_bundle_from_zip_bytes
from ...services.analysis_service import analyze_html, build_analysis_response
from ..core import (
    MAX_ZIP_UPLOAD_BYTES,
    AnalyzePayload,
    AnalyzeRenderedViewPayload,
    AnalyzeUrlPayload,
    PROJECT_ROOT,
)

router = APIRouter()
PREVIEW_ROOT_DIR = PROJECT_ROOT / "backend" / "data" / "uploaded_previews"
ABSOLUTE_ASSET_ATTR_PATTERN = re.compile(
    r"""(?P<attr>(?:href|src|action))=(?P<quote>["'])/(?P<asset>[^"']+) (?P=quote)""".replace(" ", ""),
    re.IGNORECASE,
)


def _is_safe_zip_member(member_name: str) -> bool:
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
    root_index = preview_dir / "index.html"
    if root_index.exists():
        return root_index

    top_level_dirs = [item for item in preview_dir.iterdir() if item.is_dir()]
    for folder in top_level_dirs:
        nested_index = folder / "index.html"
        if nested_index.exists():
            return nested_index

    all_indexes = list(preview_dir.rglob("index.html"))
    if all_indexes:
        return sorted(all_indexes)[0]
    raise ZipInputError("No index.html file was found after extracting the ZIP package.")


def _rel_preview_path(preview_dir: Path, file_path: Path) -> str:
    return file_path.relative_to(preview_dir).as_posix()


def _preview_url(preview_id: str, rel_path: str) -> str:
    return f"/preview/{preview_id}/{rel_path}"


def _rewrite_html_for_preview(html: str, preview_id: str, rel_path: str) -> str:
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


RENDERED_VIEW_ALLOWED_TAGS = {
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "main", "article", "section", "nav", "header", "footer",
    "a", "button", "label", "li", "ul", "ol",
    "table", "caption", "th", "td", "abbr", "acronym",
    "img", "input", "textarea", "select", "form", "fieldset", "legend",
    "video", "audio", "dialog",
}


def _rendered_element_to_html(element: Any) -> str:
    tag = str(element.tagName or "").lower()
    role = str(element.role or "").lower()
    if tag not in RENDERED_VIEW_ALLOWED_TAGS and role not in {"button", "link", "alert", "status"}:
        return ""

    safe_tag = tag if tag in RENDERED_VIEW_ALLOWED_TAGS else "span"
    text = escape((element.text or "")[:500])
    attrs = [
        f'data-cognilens-id="{escape(element.cognilensId, quote=True)}"',
        'data-cognilens-rendered="true"',
    ]
    if role:
        attrs.append(f'role="{escape(role, quote=True)}"')
    if element.ariaLabel:
        attrs.append(f'aria-label="{escape(element.ariaLabel[:180], quote=True)}"')
    if element.href and safe_tag == "a":
        attrs.append(f'href="{escape(element.href[:300], quote=True)}"')
    if element.alt and safe_tag == "img":
        attrs.append(f'alt="{escape(element.alt[:180], quote=True)}"')
    if element.rect:
        rect_text = ",".join(
            f"{key}:{round(float(element.rect.get(key, 0)), 2)}"
            for key in ("x", "y", "width", "height")
        )
        attrs.append(f'data-rendered-rect="{escape(rect_text, quote=True)}"')

    attr_text = " ".join(attrs)
    if safe_tag in {"img", "input"}:
        return f"<{safe_tag} {attr_text}>"
    return f"<{safe_tag} {attr_text}>{text}</{safe_tag}>"


def _rendered_view_to_html(payload: AnalyzeRenderedViewPayload) -> str:
    elements_html = "\n".join(
        html
        for html in (_rendered_element_to_html(element) for element in payload.elements)
        if html
    )
    title = escape(payload.source_name or payload.previewUrl or "rendered-current-view", quote=True)
    return (
        "<!doctype html><html><head>"
        f"<title>{title}</title>"
        '<meta name="cognilens-analysis-mode" content="rendered_current_view">'
        "</head><body>"
        '<main data-cognilens-rendered-view="current">'
        f"{elements_html}"
        "</main></body></html>"
    )


@router.post("/analyze-rendered-view")
def analyze_rendered_view(payload: AnalyzeRenderedViewPayload) -> dict[str, Any]:
    html = _rendered_view_to_html(payload)
    analysis = analyze_html(html)
    source_name = payload.source_name or payload.previewUrl or "rendered-current-view.html"
    if not payload.persist_result:
        response_payload = analysis.to_dict()
        response_payload["html_content"] = html
        response_payload["baseline_run_id"] = None
    else:
        response_payload = build_analysis_response(
            analysis,
            html_content=html,
            source_name=source_name,
            baseline_run_id=payload.baseline_run_id,
        )
    response_payload["analysis_mode"] = "rendered_current_view"
    response_payload["rendered_view"] = {
        "preview_url": payload.previewUrl,
        "viewport": payload.viewport or {},
        "element_count": len(payload.elements),
    }
    return response_payload


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
    """Prefer a Playwright-rendered DOM so SPA frameworks expose post-hydration markup.

    Falls back to the existing proxied HTML fetch when Playwright is unavailable or fails.
    """

    rendered_snapshot_used = False
    html_content = ""
    final_url = ""

    try:
        snapshot = capture_rendered_snapshot(payload.url)
        html_content = snapshot.html
        final_url = snapshot.final_url or payload.url
        rendered_snapshot_used = True
    except SnapshotInputError:
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

