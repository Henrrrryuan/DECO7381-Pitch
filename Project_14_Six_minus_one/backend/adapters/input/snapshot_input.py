from __future__ import annotations

from dataclasses import dataclass
from importlib.util import find_spec
from typing import Any
from urllib import parse as urllib_parse


class SnapshotInputError(ValueError):
    """Raised when a rendered browser snapshot cannot be captured."""


@dataclass
class RenderedSnapshot:
    final_url: str
    title: str
    html: str
    viewport: dict[str, int]
    elements: list[dict[str, Any]]


def capture_rendered_snapshot(
    url: str,
    *,
    viewport_width: int = 1260,
    viewport_height: int = 885,
    timeout_ms: int = 15000,
) -> RenderedSnapshot:
    if find_spec("playwright") is None:
        raise SnapshotInputError(
            "Playwright is not installed. Install it with "
            "`python -m pip install playwright` and `python -m playwright install chromium`."
        )

    normalized_url = normalize_snapshot_url(url)

    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright

    browser = None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": viewport_width, "height": viewport_height},
                device_scale_factor=1,
            )
            page.goto(normalized_url, wait_until="networkidle", timeout=timeout_ms)
            page.wait_for_timeout(500)
            elements = page.evaluate(SNAPSHOT_SCRIPT)
            html = page.content()
            final_url = page.url
            title = page.title()
    except PlaywrightTimeoutError as exc:
        raise SnapshotInputError("Timed out while rendering the page snapshot.") from exc
    except PlaywrightError as exc:
        raise SnapshotInputError(f"Could not render the page snapshot: {exc}") from exc
    finally:
        if browser is not None:
            browser.close()

    return RenderedSnapshot(
        final_url=final_url,
        title=title,
        html=html,
        viewport={"width": viewport_width, "height": viewport_height},
        elements=elements,
    )


def normalize_snapshot_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        raise SnapshotInputError("Enter a URL to capture.")
    parsed = urllib_parse.urlparse(cleaned)
    if parsed.scheme not in {"http", "https"}:
        raise SnapshotInputError("Only http:// and https:// URLs can be rendered.")
    return cleaned


SNAPSHOT_SCRIPT = """
() => {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1260;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 885;
  const isVisible = (rect, style) => {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > viewportHeight || rect.left > viewportWidth) return false;
    return true;
  };

  return Array.from(document.body ? document.body.querySelectorAll("*") : document.querySelectorAll("*"))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = isVisible(rect, style);
      const className = typeof el.className === "string" ? el.className : "";
      const left = Math.max(0, rect.left);
      const top = Math.max(0, rect.top);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        class_name: className,
        role: el.getAttribute("role") || "",
        text: visible ? (el.innerText || el.textContent || "") : "",
        alt: el.getAttribute("alt") || "",
        src: el.getAttribute("src") || "",
        href: el.getAttribute("href") || "",
        x: left,
        y: top,
        width: Math.max(0, Math.min(rect.width, viewportWidth - left)),
        height: Math.max(0, Math.min(rect.height, viewportHeight - top)),
        display: style.display,
        visibility: style.visibility,
        position: style.position,
        border: style.border,
        outline: style.outline,
        background_color: style.backgroundColor,
        background_image: style.backgroundImage,
        visible,
      };
    })
    .filter((item) => item.visible);
}
"""

