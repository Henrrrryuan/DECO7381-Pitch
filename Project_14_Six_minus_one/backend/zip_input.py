from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

from bs4 import BeautifulSoup

HTML_EXTENSIONS = (".html", ".htm")
ZIP_TEXT_ENCODINGS = ("utf-8-sig", "utf-8", "gb18030", "latin-1")


class ZipInputError(ValueError):
    """Raised when a ZIP upload cannot be converted into analyzable content."""


@dataclass
class ExtractedWebBundle:
    entry_name: str
    html: str
    inlined_html: str
    css_files: dict[str, str]
    js_files: dict[str, str]


def extract_html_from_zip_bytes(zip_bytes: bytes) -> str:
    return extract_web_bundle_from_zip_bytes(zip_bytes).inlined_html


def extract_web_bundle_from_zip_bytes(zip_bytes: bytes) -> ExtractedWebBundle:
    if not zip_bytes:
        raise ZipInputError("The ZIP file is empty.")

    try:
        with ZipFile(BytesIO(zip_bytes)) as archive:
            safe_members = _safe_member_map(archive)
            html_candidates = [
                member_name
                for member_name in safe_members
                if member_name.lower().endswith(HTML_EXTENSIONS)
            ]
            if not html_candidates:
                raise ZipInputError("No .html or .htm file was found in the ZIP archive.")

            entry_name = _pick_entry_html(html_candidates)
            raw_html = _read_member_bytes(archive, entry_name)
            html = _decode_text(raw_html)
            css_files = _extract_linked_resources(archive, safe_members, entry_name, html, resource_type="css")
            js_files = _extract_linked_resources(archive, safe_members, entry_name, html, resource_type="js")
    except BadZipFile as exc:
        raise ZipInputError("The uploaded file is not a valid ZIP archive.") from exc

    return ExtractedWebBundle(
        entry_name=entry_name,
        html=html,
        inlined_html=_inline_css_into_html(html, css_files),
        css_files=css_files,
        js_files=js_files,
    )


def _safe_member_map(archive: ZipFile) -> dict[str, str]:
    members: dict[str, str] = {}
    for info in archive.infolist():
        if info.is_dir():
            continue
        normalized_name = info.filename.replace("\\", "/")
        if not _is_safe_member_name(normalized_name):
            continue
        members[normalized_name.lower()] = normalized_name
    return members


def _read_member_bytes(archive: ZipFile, member_name: str) -> bytes:
    with archive.open(member_name, "r") as stream:
        return stream.read()


def _is_safe_member_name(member_name: str) -> bool:
    path = PurePosixPath(member_name)
    if path.is_absolute():
        return False
    return all(part not in {"..", ""} for part in path.parts)


def _pick_entry_html(candidates: list[str]) -> str:
    for name in candidates:
        if PurePosixPath(name).name.lower() in {"index.html", "index.htm"}:
            return name
    return candidates[0]


def _decode_text(raw_bytes: bytes) -> str:
    for encoding in ZIP_TEXT_ENCODINGS:
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ZipInputError("Could not decode the text file contents inside the ZIP archive.")


def _extract_linked_resources(
    archive: ZipFile,
    safe_members: dict[str, str],
    entry_name: str,
    html: str,
    *,
    resource_type: str,
) -> dict[str, str]:
    soup = BeautifulSoup(html or "", "html.parser")
    entry_dir = PurePosixPath(entry_name).parent
    resources: dict[str, str] = {}

    if resource_type == "css":
        candidate_paths = [
            tag.get("href", "")
            for tag in soup.find_all("link")
            if "stylesheet" in [item.lower() for item in (tag.get("rel") or [])]
        ]
    else:
        candidate_paths = [tag.get("src", "") for tag in soup.find_all("script") if tag.get("src")]

    for raw_path in candidate_paths:
        normalized_ref = _normalize_resource_reference(raw_path)
        if not normalized_ref:
            continue
        resolved = _resolve_member_name(normalized_ref, entry_dir, safe_members)
        if not resolved:
            continue
        if resource_type == "css" and not resolved.lower().endswith(".css"):
            continue
        if resource_type == "js" and not resolved.lower().endswith(".js"):
            continue
        try:
            resources[resolved] = _decode_text(_read_member_bytes(archive, resolved))
        except ZipInputError:
            continue

    return resources


def _normalize_resource_reference(reference: str) -> str | None:
    cleaned = (reference or "").strip()
    if not cleaned:
        return None
    lowered = cleaned.lower()
    if lowered.startswith(("http://", "https://", "//", "data:", "javascript:", "#")):
        return None
    without_query = cleaned.split("?", 1)[0].split("#", 1)[0]
    return without_query or None


def _resolve_member_name(
    reference: str,
    entry_dir: PurePosixPath,
    safe_members: dict[str, str],
) -> str | None:
    candidate_path = PurePosixPath(reference)
    if candidate_path.is_absolute():
        joined = candidate_path.relative_to("/")
    else:
        joined = (entry_dir / candidate_path)

    normalized_parts: list[str] = []
    for part in joined.parts:
        if part in {"", "."}:
            continue
        if part == "..":
            if normalized_parts:
                normalized_parts.pop()
            else:
                return None
            continue
        normalized_parts.append(part)

    normalized_name = "/".join(normalized_parts)
    if not normalized_name:
        return None
    return safe_members.get(normalized_name.lower())


def _inline_css_into_html(html: str, css_files: dict[str, str]) -> str:
    if not css_files:
        return html

    soup = BeautifulSoup(html or "", "html.parser")
    css_iter = iter(css_files.items())
    replaced = False

    for link_tag in soup.find_all("link"):
        rel_tokens = [item.lower() for item in (link_tag.get("rel") or [])]
        if "stylesheet" not in rel_tokens:
            continue
        href = _normalize_resource_reference(link_tag.get("href", ""))
        if not href:
            continue
        css_entry = next(
            (
                (name, css_text)
                for name, css_text in css_files.items()
                if name.endswith(href) or PurePosixPath(name).name == PurePosixPath(href).name
            ),
            None,
        )
        if css_entry is None:
            continue

        style_tag = soup.new_tag("style")
        style_tag.attrs["data-source"] = css_entry[0]
        style_tag.string = css_entry[1]
        link_tag.replace_with(style_tag)
        replaced = True

    if not replaced:
        container = soup.head or soup.body or soup
        for name, css_text in css_files.items():
            style_tag = soup.new_tag("style")
            style_tag.attrs["data-source"] = name
            style_tag.string = css_text
            container.append(style_tag)

    return str(soup)
