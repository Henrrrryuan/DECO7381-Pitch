from __future__ import annotations

from dataclasses import dataclass
import re
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from bs4 import BeautifulSoup


MAX_LINKED_RESOURCES_PER_TYPE = 12
MAX_LINKED_RESOURCE_BYTES = 512 * 1024
URL_TEXT_ENCODINGS = ("utf-8-sig", "utf-8", "gb18030", "latin-1")


class UrlInputError(ValueError):
    """Raised when a fetched URL is not suitable for analysis."""


@dataclass
class ExtractedUrlBundle:
    final_url: str
    html: str
    inlined_html: str
    css_files: dict[str, str]
    js_files: dict[str, str]


def extract_web_bundle_from_url_html(html: str, final_url: str) -> ExtractedUrlBundle:
    if looks_like_error_page(html):
        raise UrlInputError(
            "The target URL appears to be an error page, such as 'Page not found'. "
            "Check the address and analyze the actual page instead."
        )

    css_files = _extract_linked_resources(html, final_url, resource_type="css")
    js_files = _extract_linked_resources(html, final_url, resource_type="js")

    return ExtractedUrlBundle(
        final_url=final_url,
        html=html,
        inlined_html=_inline_css_into_html(html, css_files),
        css_files=css_files,
        js_files=js_files,
    )


def looks_like_error_page(html: str) -> bool:
    soup = BeautifulSoup(html or "", "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    heading_text = " ".join(
        heading.get_text(" ", strip=True)
        for heading in soup.find_all(["h1", "h2"], limit=4)
    )
    combined = f"{title} {heading_text}".lower()
    return bool(
        re.search(
            r"\b(404|page not found|not found|file not found|requested page could not be found)\b",
            combined,
        )
    )


def _extract_linked_resources(
    html: str,
    final_url: str,
    *,
    resource_type: str,
) -> dict[str, str]:
    soup = BeautifulSoup(html or "", "html.parser")
    resources: dict[str, str] = {}

    if resource_type == "css":
        references = [
            tag.get("href", "")
            for tag in soup.find_all("link")
            if "stylesheet" in [item.lower() for item in (tag.get("rel") or [])]
        ]
        accepted_types = ("text/css",)
        accepted_extensions = (".css",)
    else:
        references = [tag.get("src", "") for tag in soup.find_all("script") if tag.get("src")]
        accepted_types = ("javascript", "ecmascript", "text/plain")
        accepted_extensions = (".js", ".mjs")

    for reference in references:
        if len(resources) >= MAX_LINKED_RESOURCES_PER_TYPE:
            break
        resource_url = _resolve_resource_url(reference, final_url)
        if not resource_url:
            continue
        text = _fetch_text_resource(
            resource_url,
            accepted_types=accepted_types,
            accepted_extensions=accepted_extensions,
        )
        if text is not None:
            resources[resource_url] = text

    return resources


def _resolve_resource_url(reference: str, final_url: str) -> str | None:
    cleaned = (reference or "").strip()
    if not cleaned:
        return None
    lowered = cleaned.lower()
    if lowered.startswith(("data:", "javascript:", "mailto:", "tel:", "#")):
        return None
    if lowered.startswith("//"):
        parsed_base = urllib_parse.urlparse(final_url)
        cleaned = f"{parsed_base.scheme}:{cleaned}"
    return urllib_parse.urljoin(final_url, cleaned)


def _fetch_text_resource(
    url: str,
    *,
    accepted_types: tuple[str, ...],
    accepted_extensions: tuple[str, ...],
) -> str | None:
    parsed = urllib_parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return None

    request = urllib_request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/css,application/javascript,text/javascript,*/*;q=0.8",
        },
    )
    try:
        with urllib_request.urlopen(request, timeout=8) as response:
            content_type = response.headers.get("Content-Type", "")
            lowered_type = content_type.lower()
            path = urllib_parse.urlparse(response.geturl()).path.lower()
            if not any(item in lowered_type for item in accepted_types) and not path.endswith(accepted_extensions):
                return None
            raw = response.read(MAX_LINKED_RESOURCE_BYTES + 1)
    except (urllib_error.HTTPError, urllib_error.URLError, TimeoutError, OSError):
        return None

    if len(raw) > MAX_LINKED_RESOURCE_BYTES:
        raw = raw[:MAX_LINKED_RESOURCE_BYTES]
    return _decode_text(raw, content_type)


def _decode_text(raw_bytes: bytes, content_type: str = "") -> str:
    charset_match = re.search(
        r"charset=([A-Za-z0-9_\-]+)", content_type or "", flags=re.IGNORECASE
    )
    encodings = [charset_match.group(1)] if charset_match else []
    encodings.extend(URL_TEXT_ENCODINGS)
    for encoding in encodings:
        try:
            return raw_bytes.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw_bytes.decode("utf-8", errors="replace")


def _inline_css_into_html(html: str, css_files: dict[str, str]) -> str:
    if not css_files:
        return html

    soup = BeautifulSoup(html or "", "html.parser")
    replaced = False

    for link_tag in soup.find_all("link"):
        rel_tokens = [item.lower() for item in (link_tag.get("rel") or [])]
        if "stylesheet" not in rel_tokens:
            continue
        raw_href = (link_tag.get("href", "") or "").split("?", 1)[0].split("#", 1)[0]
        css_entry = next(
            (
                (name, css_text)
                for name, css_text in css_files.items()
                if name.endswith(raw_href)
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
