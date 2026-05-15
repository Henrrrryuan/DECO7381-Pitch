from __future__ import annotations

import base64
import html
import math
import re
from dataclasses import dataclass
from typing import Any
from urllib import parse as urllib_parse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


class VicramAnalysisError(ValueError):
    """Raised when a rendered ViCRAM analysis cannot be completed."""


@dataclass
class GridCell:
    row: int
    column: int
    images: float = 0.0
    tlc: int = 0
    word_count: float = 0.0

    @property
    def vcs(self) -> float:
        return (1.743 + 0.097 * self.tlc + 0.053 * self.word_count + 0.003 * self.images) / 10

    def to_dict(self, color: str) -> dict[str, Any]:
        return {
            "row": self.row,
            "column": self.column,
            "images": self.images,
            "tlc": self.tlc,
            "word_count": self.word_count,
            "vcs": self.vcs,
            "color": color,
        }


def analyze_vicram_url(
    url: str,
    *,
    rows: int = 20,
    columns: int = 20,
    viewport_width: int = 1366,
    viewport_height: int = 768,
    timeout_ms: int = 20000,
) -> dict[str, Any]:
    normalized_url = _normalize_url(url)
    rows = _clamp_grid_size(rows)
    columns = _clamp_grid_size(columns)

    def render(page: Any) -> tuple[dict[str, Any], bytes, str, str, str]:
        page.goto(normalized_url, wait_until="networkidle", timeout=timeout_ms)
        page.wait_for_timeout(500)
        return (
            page.evaluate(VICRAM_CAPTURE_SCRIPT),
            page.screenshot(full_page=True, type="png"),
            page.url,
            page.title(),
            "url",
        )

    return _render_and_analyze(
        render,
        rows=rows,
        columns=columns,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
    )


def analyze_vicram_html(
    html_content: str,
    *,
    rows: int = 20,
    columns: int = 20,
    viewport_width: int = 1366,
    viewport_height: int = 768,
    timeout_ms: int = 20000,
) -> dict[str, Any]:
    source = str(html_content or "").strip()
    if not source:
        raise VicramAnalysisError("Enter HTML content to analyze.")
    rows = _clamp_grid_size(rows)
    columns = _clamp_grid_size(columns)

    def render(page: Any) -> tuple[dict[str, Any], bytes, str, str, str]:
        page.set_content(source, wait_until="networkidle", timeout=timeout_ms)
        page.wait_for_timeout(500)
        return (
            page.evaluate(VICRAM_CAPTURE_SCRIPT),
            page.screenshot(full_page=True, type="png"),
            "uploaded-html",
            page.title(),
            "html",
        )

    return _render_and_analyze(
        render,
        rows=rows,
        columns=columns,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
    )


def _render_and_analyze(
    render: Any,
    *,
    rows: int,
    columns: int,
    viewport_width: int,
    viewport_height: int,
) -> dict[str, Any]:
    browser = None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": viewport_width, "height": viewport_height},
                device_scale_factor=1,
            )
            capture, screenshot_bytes, final_url, title, source_type = render(page)
    except PlaywrightTimeoutError as exc:
        raise VicramAnalysisError("Timed out while rendering the page for ViCRAM analysis.") from exc
    except PlaywrightError as exc:
        raise VicramAnalysisError(f"Could not render the page for ViCRAM analysis: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise VicramAnalysisError(f"Could not complete ViCRAM analysis: {exc}") from exc
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception:  # noqa: BLE001
                pass

    page_width = max(1, int(round(float(capture.get("width") or viewport_width))))
    page_height = max(1, int(round(float(capture.get("height") or viewport_height))))
    grid = [[GridCell(row, column) for column in range(columns)] for row in range(rows)]

    text_rects = [item for item in capture.get("textRects", []) if _valid_rect(item)]
    image_rects = [item for item in capture.get("imageRects", []) if _valid_rect(item)]
    element_rects = [item for item in capture.get("elementRects", []) if _valid_rect(item)]

    for rect in image_rects:
        _add_area_weighted(grid, rect, page_width, page_height, rows, columns, "images", 1.0)

    for rect in text_rects:
        words = _word_count(str(rect.get("text") or ""))
        if words:
            _add_area_weighted(grid, rect, page_width, page_height, rows, columns, "word_count", float(words))

    for rect in element_rects:
        if _is_tlc_candidate(rect):
            row, column = _center_grid(rect, page_width, page_height, rows, columns)
            grid[row][column].tlc += 1

    page_vcs = _page_vcs(
        word_count=sum(_word_count(str(rect.get("text") or "")) for rect in text_rects),
        images=len(image_rects),
        tlc=sum(cell.tlc for row in grid for cell in row),
    )
    color_map = _old_vicram_colors(grid, page_vcs)
    cells = [
        grid[row][column].to_dict(color_map[(row, column)])
        for row in range(rows)
        for column in range(columns)
    ]
    overlay_svg = _build_overlay_svg(page_width, page_height, rows, columns, cells)
    summary_report = _build_summary_report(page_vcs, rows, columns, cells, capture)

    return {
        "url": final_url,
        "source_type": source_type,
        "title": title,
        "page": {
            "width": page_width,
            "height": page_height,
            "vcs": page_vcs,
            "word_count": sum(_word_count(str(rect.get("text") or "")) for rect in text_rects),
            "images": len(image_rects),
            "tlc": sum(cell.tlc for row in grid for cell in row),
        },
        "grid": {
            "rows": rows,
            "columns": columns,
            "cells": cells,
            "formula": "GridVCS = (1.743 + 0.097 * TLC + 0.053 * WordCount + 0.003 * Images) / 10",
            "color_rule": "Original ViCRAM rank buckets constrained by whole-page VCS.",
        },
        "artifacts": {
            "screenshot_png_base64": base64.b64encode(screenshot_bytes).decode("ascii"),
            "overlay_svg": overlay_svg,
            "overlay_svg_base64": base64.b64encode(overlay_svg.encode("utf-8")).decode("ascii"),
        },
        "summary_report": summary_report,
        "debug": {
            "text_rects": len(text_rects),
            "image_rects": len(image_rects),
            "element_rects": len(element_rects),
        },
    }


def _normalize_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        raise VicramAnalysisError("Enter a URL to analyze.")
    parsed = urllib_parse.urlparse(cleaned)
    if parsed.scheme not in {"http", "https"}:
        raise VicramAnalysisError("Only http:// and https:// URLs are supported.")
    return cleaned


def _clamp_grid_size(value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = 20
    return max(2, min(50, parsed))


def _valid_rect(rect: dict[str, Any]) -> bool:
    return float(rect.get("width") or 0) > 0 and float(rect.get("height") or 0) > 0


def _word_count(text: str) -> int:
    return len(re.findall(r"[\w\u00C0-\uFFFF]+", text, flags=re.UNICODE))


def _page_vcs(*, word_count: int, images: int, tlc: int) -> float:
    return (1.743 + 0.097 * tlc + 0.053 * word_count + 0.003 * images) / 10


def _center_grid(
    rect: dict[str, Any],
    page_width: int,
    page_height: int,
    rows: int,
    columns: int,
) -> tuple[int, int]:
    cell_width = page_width / columns
    cell_height = page_height / rows
    cx = float(rect.get("x") or 0) + float(rect.get("width") or 0) / 2
    cy = float(rect.get("y") or 0) + float(rect.get("height") or 0) / 2
    column = max(0, min(columns - 1, int(cx / cell_width)))
    row = max(0, min(rows - 1, int(cy / cell_height)))
    return row, column


def _add_area_weighted(
    grid: list[list[GridCell]],
    rect: dict[str, Any],
    page_width: int,
    page_height: int,
    rows: int,
    columns: int,
    field_name: str,
    value: float,
) -> None:
    cell_width = page_width / columns
    cell_height = page_height / rows
    x1 = max(0.0, float(rect.get("x") or 0))
    y1 = max(0.0, float(rect.get("y") or 0))
    x2 = min(float(page_width), x1 + float(rect.get("width") or 0))
    y2 = min(float(page_height), y1 + float(rect.get("height") or 0))
    if x2 <= x1 or y2 <= y1:
        return

    start_col = max(0, min(columns - 1, int(x1 / cell_width)))
    end_col = max(0, min(columns - 1, int(math.ceil(x2 / cell_width) - 1)))
    start_row = max(0, min(rows - 1, int(y1 / cell_height)))
    end_row = max(0, min(rows - 1, int(math.ceil(y2 / cell_height) - 1)))

    overlaps: list[tuple[int, int, float]] = []
    total_area = 0.0
    for row in range(start_row, end_row + 1):
        for column in range(start_col, end_col + 1):
            cx1 = column * cell_width
            cy1 = row * cell_height
            cx2 = cx1 + cell_width
            cy2 = cy1 + cell_height
            overlap_width = max(0.0, min(x2, cx2) - max(x1, cx1))
            overlap_height = max(0.0, min(y2, cy2) - max(y1, cy1))
            area = overlap_width * overlap_height
            if area > 0:
                overlaps.append((row, column, area))
                total_area += area

    if not overlaps or total_area <= 0:
        row, column = _center_grid(rect, page_width, page_height, rows, columns)
        current = getattr(grid[row][column], field_name)
        setattr(grid[row][column], field_name, current + value)
        return

    for row, column, area in overlaps:
        current = getattr(grid[row][column], field_name)
        setattr(grid[row][column], field_name, current + value * (area / total_area))


def _is_tlc_candidate(rect: dict[str, Any]) -> bool:
    tag = str(rect.get("tag") or "").lower()
    if tag in {"body", "html", "script", "style", "meta", "link", "title"}:
        return False
    if tag in {"table", "ul", "ol", "nav", "form", "section", "article", "aside", "header", "footer", "main"}:
        return True
    if tag in {"h1", "h2", "h3", "h4", "h5", "h6", "hr"}:
        return True
    role = str(rect.get("role") or "").lower()
    if role in {"navigation", "table", "form", "banner", "contentinfo", "main"}:
        return True
    if bool(rect.get("has_border")) or bool(rect.get("has_background_image")):
        return True
    return False


def _old_vicram_colors(grid: list[list[GridCell]], page_vcs: float) -> dict[tuple[int, int], str]:
    cells = [cell for row in grid for cell in row]
    sorted_cells = sorted(cells, key=lambda cell: cell.vcs)
    colors = ["#006400", "#00c000", "#77ff00", "#ffd400", "#ffb74c", "#ed1a3d"]
    if page_vcs < 3:
        max_color_index = 2
    elif page_vcs < 6:
        max_color_index = 4
    else:
        max_color_index = 5

    non_base = [cell for cell in sorted_cells if cell.vcs > 0.1743]
    result: dict[tuple[int, int], str] = {
        (cell.row, cell.column): colors[0] for cell in cells
    }
    if not non_base:
        return result

    for rank, cell in enumerate(non_base):
        ratio = rank / max(1, len(non_base) - 1)
        color_index = 1 + int(round(ratio * max(0, max_color_index - 1)))
        color_index = max(1, min(max_color_index, color_index))
        result[(cell.row, cell.column)] = colors[color_index]
    return result


def _build_overlay_svg(
    page_width: int,
    page_height: int,
    rows: int,
    columns: int,
    cells: list[dict[str, Any]],
) -> str:
    cell_width = page_width / columns
    cell_height = page_height / rows
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{page_width}" height="{page_height}" viewBox="0 0 {page_width} {page_height}">',
        '<rect width="100%" height="100%" fill="none"/>',
    ]
    for cell in cells:
        x = cell["column"] * cell_width
        y = cell["row"] * cell_height
        parts.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{cell_width:.2f}" height="{cell_height:.2f}" '
            f'fill="{html.escape(cell["color"])}" fill-opacity="0.42" stroke="#1f7a46" stroke-opacity="0.45" stroke-width="1"/>'
        )
    parts.append("</svg>")
    return "".join(parts)


def _build_summary_report(
    page_vcs: float,
    rows: int,
    columns: int,
    cells: list[dict[str, Any]],
    capture: dict[str, Any],
) -> str:
    lines = [
        "======= Web Page Visual Complexity =======",
        "",
        f"VCS = {page_vcs}",
        "",
        "The Visual Complexity Score (VCS) ranges from 0 to 10, with 0 being very visually simple and 10 very visually complex.",
        "",
        "----- Complexity Visualization View -----",
        f"Debug: textPositions={len(capture.get('textRects', []))}; imagePositions={len(capture.get('imageRects', []))}; elementPositions={len(capture.get('elementRects', []))};",
        "Colour range: Red - Orange - Yellow - YellowGreen - Green - DarkGreen",
        "",
        "The more to the red colour, the more visually complex the grid is. The colours depend on the overall visual complexity of the page.",
        "",
        "----- Grid Description: -----",
    ]
    for cell in cells:
        lines.append(
            "Grid (row-column): "
            f"{cell['row']}-{cell['column']} | Images: {cell['images']} | TLC: {cell['tlc']} "
            f"| Word Count: {cell['word_count']} | VCS = {cell['vcs']}"
        )
    lines.append("")
    lines.append(f"Grid size: {rows} x {columns}")
    return "\n".join(lines)


VICRAM_CAPTURE_SCRIPT = """
() => {
  const width = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0,
    window.innerWidth
  );
  const height = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
    window.innerHeight
  );
  const rectToObject = (rect) => ({
    x: Math.max(0, rect.left + window.scrollX),
    y: Math.max(0, rect.top + window.scrollY),
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
  });
  const isVisible = (el, rect, style) => {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    return true;
  };
  const textRects = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = (node.nodeValue || "").replace(/\\s+/g, " ").trim();
    if (!text) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    const style = window.getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach();
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      textRects.push({ ...rectToObject(rect), text });
    }
  }
  const imageRects = Array.from(document.images || [])
    .map((img) => {
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      return { ...rectToObject(rect), tag: "img", alt: img.getAttribute("alt") || "", visible: isVisible(img, rect, style) };
    })
    .filter((item) => item.visible);
  const elementRects = Array.from((document.body || document.documentElement).querySelectorAll("*"))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const borderWidths = [
        parseFloat(style.borderTopWidth || "0"),
        parseFloat(style.borderRightWidth || "0"),
        parseFloat(style.borderBottomWidth || "0"),
        parseFloat(style.borderLeftWidth || "0"),
      ];
      return {
        ...rectToObject(rect),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || "",
        visible: isVisible(el, rect, style),
        has_border: borderWidths.some((value) => value > 0),
        has_background_image: Boolean(style.backgroundImage && style.backgroundImage !== "none"),
      };
    })
    .filter((item) => item.visible);
  return { width, height, textRects, imageRects, elementRects };
}
"""
