from __future__ import annotations

from io import BytesIO
from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

HTML_EXTENSIONS = (".html", ".htm")
ZIP_TEXT_ENCODINGS = ("utf-8-sig", "utf-8", "gb18030", "latin-1")


class ZipInputError(ValueError):
    """Raised when a ZIP upload cannot be converted into analyzable HTML."""


def extract_html_from_zip_bytes(zip_bytes: bytes) -> str:
    if not zip_bytes:
        raise ZipInputError("ZIP 文件为空。")

    try:
        with ZipFile(BytesIO(zip_bytes)) as archive:
            html_candidates = _collect_html_candidates(archive)
            if not html_candidates:
                raise ZipInputError("ZIP 中未找到 .html 或 .htm 文件。")

            target_name = _pick_entry_html(html_candidates)
            with archive.open(target_name, "r") as stream:
                raw_html = stream.read()
    except BadZipFile as exc:
        raise ZipInputError("上传文件不是有效的 ZIP 格式。") from exc

    return _decode_html(raw_html)


def _collect_html_candidates(archive: ZipFile) -> list[str]:
    candidates: list[str] = []
    for info in archive.infolist():
        if info.is_dir():
            continue
        normalized_name = info.filename.replace("\\", "/")
        if not _is_safe_member_name(normalized_name):
            continue
        if normalized_name.lower().endswith(HTML_EXTENSIONS):
            candidates.append(normalized_name)
    return candidates


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


def _decode_html(raw_html: bytes) -> str:
    for encoding in ZIP_TEXT_ENCODINGS:
        try:
            return raw_html.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ZipInputError("无法解码 ZIP 中的 HTML 文件内容。")
