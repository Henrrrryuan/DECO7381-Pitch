from __future__ import annotations

from dataclasses import dataclass
import html
import re
import urllib.error
import urllib.parse
import urllib.request

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


@dataclass
class ProxiedResponse:
    body: bytes
    status_code: int
    content_type: str
    final_url: str


class EyeProxyBadRequest(ValueError):
    """Raised when an eye-tracking proxy URL is missing or unsupported."""


class EyeProxyFetchError(RuntimeError):
    """Raised when the remote webpage cannot be fetched for the eye tool."""


def ensure_http_url(raw_url: str) -> str:
    value = (raw_url or "").strip()
    if not value:
        raise EyeProxyBadRequest("Missing url query parameter.")

    if not re.match(r"^[a-zA-Z][a-zA-Z\d+\-.]*:", value):
        value = f"https://{value}"

    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in ("http", "https"):
        raise EyeProxyBadRequest("Only http/https URLs are supported.")
    if not parsed.netloc:
        raise EyeProxyBadRequest("Invalid URL.")
    return value


def rewrite_html_for_proxy(html_text: str, final_url: str) -> str:
    base_tag = f'<base href="{html.escape(final_url, quote=True)}">'

    if re.search(r"<head[^>]*>", html_text, flags=re.IGNORECASE):
        html_text = re.sub(
            r"(<head[^>]*>)",
            rf"\1{base_tag}",
            html_text,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        html_text = base_tag + html_text

    html_text = re.sub(
        r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>',
        "",
        html_text,
        flags=re.IGNORECASE,
    )

    def _rewrite_anchor(match: re.Match[str]) -> str:
        prefix, href, suffix = match.group(1), match.group(2), match.group(3)
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
            return match.group(0)
        abs_url = urllib.parse.urljoin(final_url, href)
        proxied = "/eye/proxy?url=" + urllib.parse.quote(abs_url, safe="")
        return f"{prefix}{proxied}{suffix}"

    html_text = re.sub(
        r'(<a[^>]+href=["\'])([^"\']+)(["\'])',
        _rewrite_anchor,
        html_text,
        flags=re.IGNORECASE,
    )

    def _rewrite_form(match: re.Match[str]) -> str:
        prefix, action, suffix = match.group(1), match.group(2), match.group(3)
        if not action or action.startswith(("javascript:", "data:")):
            return match.group(0)
        abs_url = urllib.parse.urljoin(final_url, action)
        proxied = "/eye/proxy?url=" + urllib.parse.quote(abs_url, safe="")
        return f"{prefix}{proxied}{suffix}"

    html_text = re.sub(
        r'(<form[^>]+action=["\'])([^"\']+)(["\'])',
        _rewrite_form,
        html_text,
        flags=re.IGNORECASE,
    )

    return html_text


def fetch_proxied_response(raw_url: str) -> ProxiedResponse:
    target_url = ensure_http_url(raw_url)
    req = urllib.request.Request(
        target_url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "*/*;q=0.8"
            ),
            "Referer": target_url,
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as upstream:
            final_url = upstream.geturl()
            status = upstream.status
            body = upstream.read()
            content_type = upstream.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        body = error.read()
        return ProxiedResponse(
            body=body,
            status_code=error.code,
            content_type=error.headers.get("Content-Type", "text/plain; charset=utf-8"),
            final_url=target_url,
        )
    except Exception as error:  # noqa: BLE001
        raise EyeProxyFetchError(f"Proxy error: {error}") from error

    if "text/html" in content_type.lower():
        charset = "utf-8"
        charset_match = re.search(
            r"charset=([A-Za-z0-9_\-]+)", content_type, flags=re.IGNORECASE
        )
        if charset_match:
            charset = charset_match.group(1)
        decoded = body.decode(charset, errors="replace")
        body = rewrite_html_for_proxy(decoded, final_url).encode("utf-8")
        content_type = "text/html; charset=utf-8"

    return ProxiedResponse(
        body=body,
        status_code=status,
        content_type=content_type or "application/octet-stream",
        final_url=final_url,
    )

