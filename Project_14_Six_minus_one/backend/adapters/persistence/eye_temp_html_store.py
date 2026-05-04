from __future__ import annotations

import re
import time
from pathlib import Path
from uuid import uuid4

from ...app.core import EYE_TEMP_HTML_DIR, MAX_EYE_TEMP_HTML_BYTES

_TOKEN_RE = re.compile(r"^[a-fA-F0-9]{32}$")
_MAX_FILES = 120
_MAX_AGE_S = 86400 * 2


def _ensure_dir() -> None:
    EYE_TEMP_HTML_DIR.mkdir(parents=True, exist_ok=True)


def _prune_dir() -> None:
    if not EYE_TEMP_HTML_DIR.is_dir():
        return
    paths = [p for p in EYE_TEMP_HTML_DIR.glob("*.html") if p.is_file()]
    now = time.time()
    for p in paths:
        try:
            if now - p.stat().st_mtime > _MAX_AGE_S:
                p.unlink(missing_ok=True)
        except OSError:
            continue
    paths = [p for p in EYE_TEMP_HTML_DIR.glob("*.html") if p.is_file()]
    if len(paths) <= _MAX_FILES:
        return
    paths.sort(key=lambda x: x.stat().st_mtime)
    for p in paths[: max(0, len(paths) - _MAX_FILES)]:
        try:
            p.unlink(missing_ok=True)
        except OSError:
            continue


def save_temp_html(html: str) -> str:
    stripped = html.strip()
    if not stripped:
        raise ValueError("HTML must not be empty.")
    raw = stripped.encode("utf-8")
    if len(raw) > MAX_EYE_TEMP_HTML_BYTES:
        raise ValueError(f"HTML exceeds maximum size ({MAX_EYE_TEMP_HTML_BYTES // (1024 * 1024)} MiB).")

    _ensure_dir()
    _prune_dir()
    token = uuid4().hex
    path = EYE_TEMP_HTML_DIR / f"{token}.html"
    path.write_bytes(raw)
    return token


def read_temp_html_bytes(token: str) -> bytes | None:
    if not _TOKEN_RE.match(token):
        return None
    path = EYE_TEMP_HTML_DIR / f"{token}.html"
    if not path.is_file():
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None
