from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag

if __package__ in {None, ""}:
    project_root = Path(__file__).resolve().parents[2]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

GRID_ROWS = 10
GRID_COLS = 10

VCS_CONSTANT = 1.743
VCS_TLC_COEFFICIENT = 0.097
VCS_WORD_COEFFICIENT = 0.053
VCS_IMAGE_COEFFICIENT = 0.003

IGNORED_TAGS = {"script", "style", "noscript", "template", "meta", "link", "title"}
TEXT_BLOCK_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "dd", "dt", "blockquote", "figcaption", "label", "button", "a"}
SEMANTIC_TLC_TAGS = {"main", "section", "article", "aside", "nav", "header", "footer", "form", "table", "ul", "ol", "figure"}
MEDIA_TAGS = {"img", "picture", "svg", "video", "canvas"}
TLC_CLASS_HINTS = (
    "card",
    "panel",
    "tile",
    "grid",
    "list",
    "item",
    "section",
    "banner",
    "hero",
    "module",
    "widget",
    "container",
)
BLOCK_DISPLAY_VALUES = {"block", "flex", "grid", "table", "list-item"}
LATIN_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")
CJK_CHAR_PATTERN = re.compile(r"[\u4e00-\u9fff]")
STYLE_DECLARATION_PATTERN = re.compile(r"([a-zA-Z-]+)\s*:\s*([^;]+)")


@dataclass
class ComplexityElement:
    kind: str
    tag: str
    summary: str
    weight: float = 1.0
    words: int = 0
    rendered_box: dict[str, Any] | None = None


def analyze_visual_complexity(html: str) -> dict[str, Any]:
    """Estimate visual complexity from HTML using the VCS model.

    This follows the paper's core logic: count TLCs, words, and images,
    calculate VCS, and produce a 10x10 heatmap. Because this variant only
    receives HTML, the heatmap uses DOM order as a proxy for rendered position.
    """

    soup = BeautifulSoup(html or "", "html.parser")
    remove_ignored_nodes(soup)

    tlc_elements = collect_tlc_elements(soup)
    word_elements = collect_word_elements(soup)
    image_elements = collect_image_elements(soup)

    word_count = sum(element.words for element in word_elements)
    tlc_count = len(tlc_elements)
    image_count = len(image_elements)
    raw_complexity = calculate_raw_vcs(tlc_count=tlc_count, word_count=word_count, image_count=image_count)
    vcs_0_to_10 = min(10.0, raw_complexity / 10)

    return {
        "model": "DOM-based Visual Complexity Score inspired by ViCRAM",
        "vcs_raw": round(raw_complexity, 3),
        "vcs_0_to_10": round(vcs_0_to_10, 2),
        "score": complexity_score(vcs_0_to_10),
        "complexity_level": complexity_level(vcs_0_to_10),
        "metrics": {
            "tlc_count": tlc_count,
            "word_count": word_count,
            "image_count": image_count,
            "grid_rows": GRID_ROWS,
            "grid_cols": GRID_COLS,
        },
        "formula": formula_metadata(),
        "heatmap": build_structural_heatmap(tlc_elements, word_elements, image_elements),
        "notes": [
            "TLC is approximated from semantic regions, table/list structures, headings, visible borders/backgrounds, and card-like class names.",
            "This HTML-only heatmap uses DOM order as a proxy for position.",
            "Use /visual-complexity-url for Playwright-rendered element coordinates.",
        ],
    }


def analyze_rendered_visual_complexity(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Estimate visual complexity from a Playwright-rendered DOM snapshot."""

    viewport = snapshot.get("viewport") or {}
    viewport_width = int(viewport.get("width") or 1260)
    viewport_height = int(viewport.get("height") or 885)
    raw_elements = [
        element
        for element in snapshot.get("elements", [])
        if element.get("visible") and float(element.get("width") or 0) > 0 and float(element.get("height") or 0) > 0
    ]

    tlc_elements = collect_rendered_tlc_elements(raw_elements)
    word_elements = collect_rendered_word_elements(raw_elements)
    image_elements = collect_rendered_image_elements(raw_elements)

    word_count = sum(element.words for element in word_elements)
    tlc_count = len(tlc_elements)
    image_count = len(image_elements)
    raw_complexity = calculate_raw_vcs(tlc_count=tlc_count, word_count=word_count, image_count=image_count)
    vcs_0_to_10 = min(10.0, raw_complexity / 10)

    return {
        "model": "Rendered Visual Complexity Score inspired by ViCRAM",
        "source_url": snapshot.get("final_url", ""),
        "title": snapshot.get("title", ""),
        "vcs_raw": round(raw_complexity, 3),
        "vcs_0_to_10": round(vcs_0_to_10, 2),
        "score": complexity_score(vcs_0_to_10),
        "complexity_level": complexity_level(vcs_0_to_10),
        "metrics": {
            "tlc_count": tlc_count,
            "word_count": word_count,
            "image_count": image_count,
            "visible_element_count": len(raw_elements),
            "grid_rows": GRID_ROWS,
            "grid_cols": GRID_COLS,
            "viewport_width": viewport_width,
            "viewport_height": viewport_height,
        },
        "formula": formula_metadata(),
        "heatmap": build_rendered_heatmap(
            tlc_elements,
            word_elements,
            image_elements,
            viewport_width=viewport_width,
            viewport_height=viewport_height,
        ),
        "notes": [
            "This endpoint uses browser-rendered element bounding boxes captured with Playwright.",
            "TLC and image counts are assigned to the grid cell containing the element top-left coordinate.",
            "Word counts are distributed across every grid cell covered by the rendered text element.",
        ],
    }


def calculate_raw_vcs(*, tlc_count: int, word_count: int, image_count: int) -> float:
    return (
        VCS_CONSTANT
        + (VCS_TLC_COEFFICIENT * tlc_count)
        + (VCS_WORD_COEFFICIENT * word_count)
        + (VCS_IMAGE_COEFFICIENT * image_count)
    )


def complexity_score(vcs_0_to_10: float) -> int:
    return max(0, round(100 - (vcs_0_to_10 * 10)))


def formula_metadata() -> dict[str, str]:
    return {
        "raw": "1.743 + 0.097*TLC + 0.053*words + 0.003*images",
        "vcs_0_to_10": "min(10, raw / 10)",
        "score": "max(0, round(100 - vcs_0_to_10 * 10))",
    }


def collect_tlc_elements(soup: BeautifulSoup) -> list[ComplexityElement]:
    elements: list[ComplexityElement] = []
    counted_nodes: set[int] = set()

    for tag in soup.find_all(True):
        if not isinstance(tag, Tag) or should_ignore_tag(tag) or id(tag) in counted_nodes:
            continue
        if is_tlc_candidate(tag):
            elements.append(ComplexityElement(kind="tlc", tag=tag.name or "unknown", summary=get_tag_summary(tag)))
            counted_nodes.add(id(tag))

    return elements


def collect_word_elements(soup: BeautifulSoup) -> list[ComplexityElement]:
    elements: list[ComplexityElement] = []
    used_text_nodes: set[int] = set()

    for tag in soup.find_all(TEXT_BLOCK_TAGS):
        if not isinstance(tag, Tag) or should_ignore_tag(tag):
            continue
        text = visible_text_for_leafish_tag(tag)
        word_count = estimate_word_count(text)
        if word_count <= 0:
            continue
        for text_node in tag.find_all(string=True):
            used_text_nodes.add(id(text_node))
        elements.append(
            ComplexityElement(
                kind="words",
                tag=tag.name or "unknown",
                summary=get_tag_summary(tag),
                weight=float(word_count),
                words=word_count,
            )
        )

    for text_node in soup.find_all(string=True):
        if id(text_node) in used_text_nodes or not isinstance(text_node, NavigableString):
            continue
        parent = text_node.parent
        if not isinstance(parent, Tag) or should_ignore_tag(parent):
            continue
        word_count = estimate_word_count(normalize_text(str(text_node)))
        if word_count <= 0:
            continue
        elements.append(
            ComplexityElement(
                kind="words",
                tag=parent.name or "text",
                summary=get_tag_summary(parent),
                weight=float(word_count),
                words=word_count,
            )
        )

    return elements


def collect_image_elements(soup: BeautifulSoup) -> list[ComplexityElement]:
    elements: list[ComplexityElement] = []

    for tag in soup.find_all(True):
        if not isinstance(tag, Tag) or should_ignore_tag(tag):
            continue
        if (tag.name or "").lower() in MEDIA_TAGS or has_background_image(tag):
            elements.append(ComplexityElement(kind="image", tag=tag.name or "unknown", summary=get_tag_summary(tag)))

    return elements


def collect_rendered_tlc_elements(raw_elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [element for element in raw_elements if is_rendered_tlc_candidate(element)]


def collect_rendered_word_elements(raw_elements: list[dict[str, Any]]) -> list[ComplexityElement]:
    elements: list[ComplexityElement] = []
    for element in raw_elements:
        tag = str(element.get("tag", "")).lower()
        if tag not in TEXT_BLOCK_TAGS:
            continue
        word_count = estimate_word_count(str(element.get("text") or ""))
        if word_count <= 0:
            continue
        elements.append(
            ComplexityElement(
                kind="words",
                tag=tag,
                summary=rendered_element_summary(element),
                weight=float(word_count),
                words=word_count,
                rendered_box=element,
            )
        )
    return elements


def collect_rendered_image_elements(raw_elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    elements: list[dict[str, Any]] = []
    for element in raw_elements:
        tag = str(element.get("tag", "")).lower()
        background_image = str(element.get("background_image") or "").lower()
        if tag in MEDIA_TAGS or "url(" in background_image:
            elements.append(element)
    return elements


def build_structural_heatmap(
    tlc_elements: list[ComplexityElement],
    word_elements: list[ComplexityElement],
    image_elements: list[ComplexityElement],
) -> list[dict[str, Any]]:
    cells = empty_heatmap_cells()
    structural_stream: list[ComplexityElement] = []
    structural_stream.extend(tlc_elements)
    structural_stream.extend(word_elements)
    structural_stream.extend(image_elements)

    if not structural_stream:
        return cells

    for index, element in enumerate(structural_stream):
        cell = cells[min(len(cells) - 1, int(index * len(cells) / len(structural_stream)))]
        if element.kind == "tlc":
            cell["tlc_count"] += 1
        elif element.kind == "image":
            cell["image_count"] += 1
        elif element.kind == "words":
            cell["word_count"] += element.words

    return finalize_heatmap_cells(cells)


def build_rendered_heatmap(
    tlc_elements: list[dict[str, Any]],
    word_elements: list[ComplexityElement],
    image_elements: list[dict[str, Any]],
    *,
    viewport_width: int,
    viewport_height: int,
) -> list[dict[str, Any]]:
    cells = empty_heatmap_cells()

    for element in tlc_elements:
        cells[cell_index_for_point(element, viewport_width, viewport_height)]["tlc_count"] += 1

    for element in image_elements:
        cells[cell_index_for_point(element, viewport_width, viewport_height)]["image_count"] += 1

    for word_element in word_elements:
        box = word_element.rendered_box
        if not isinstance(box, dict):
            continue
        covered_indexes = cell_indexes_for_box(box, viewport_width, viewport_height)
        if not covered_indexes:
            continue
        words_per_cell = word_element.words / len(covered_indexes)
        for index in covered_indexes:
            cells[index]["word_count"] += words_per_cell

    return finalize_heatmap_cells(cells)


def empty_heatmap_cells() -> list[dict[str, Any]]:
    return [
        {
            "row": row,
            "col": col,
            "tlc_count": 0,
            "word_count": 0.0,
            "image_count": 0,
            "vcs_raw": 0.0,
            "relative_intensity": 0.0,
            "color": "dark-green",
        }
        for row in range(GRID_ROWS)
        for col in range(GRID_COLS)
    ]


def finalize_heatmap_cells(cells: list[dict[str, Any]]) -> list[dict[str, Any]]:
    max_vcs = 0.0
    for cell in cells:
        cell["word_count"] = round(cell["word_count"], 2)
        if not cell["tlc_count"] and not cell["word_count"] and not cell["image_count"]:
            cell["vcs_raw"] = 0.0
        else:
            cell["vcs_raw"] = round(
                calculate_raw_vcs(
                    tlc_count=int(cell["tlc_count"]),
                    word_count=int(round(cell["word_count"])),
                    image_count=int(cell["image_count"]),
                ),
                3,
            )
        max_vcs = max(max_vcs, float(cell["vcs_raw"]))

    for cell in cells:
        ratio = float(cell["vcs_raw"]) / max_vcs if max_vcs else 0.0
        cell["relative_intensity"] = round(ratio, 3)
        cell["color"] = heatmap_color(ratio)
    return cells


def is_tlc_candidate(tag: Tag) -> bool:
    tag_name = (tag.name or "").lower()
    if tag_name in SEMANTIC_TLC_TAGS:
        return True
    if has_heading_child(tag):
        return True
    if has_visible_border(tag):
        return True
    if has_background_fill(tag):
        return True
    if class_or_id_contains(tag, TLC_CLASS_HINTS):
        return True
    if display_value(tag) in BLOCK_DISPLAY_VALUES and estimate_word_count(tag.get_text(" ", strip=True)) >= 20:
        return True
    return False


def is_rendered_tlc_candidate(element: dict[str, Any]) -> bool:
    tag_name = str(element.get("tag", "")).lower()
    width = float(element.get("width") or 0)
    height = float(element.get("height") or 0)
    if width < 40 or height < 24:
        return False
    if tag_name in SEMANTIC_TLC_TAGS:
        return True
    if str(element.get("display", "")).lower() in BLOCK_DISPLAY_VALUES and estimate_word_count(str(element.get("text") or "")) >= 20:
        return True
    if rendered_class_or_id_contains(element, TLC_CLASS_HINTS):
        return True
    if rendered_has_visible_border(element):
        return True
    if rendered_has_background_fill(element):
        return True
    return False


def cell_index_for_point(element: dict[str, Any], viewport_width: int, viewport_height: int) -> int:
    cell_width = max(1, viewport_width / GRID_COLS)
    cell_height = max(1, viewport_height / GRID_ROWS)
    col = max(0, min(GRID_COLS - 1, int(float(element.get("x") or 0) / cell_width)))
    row = max(0, min(GRID_ROWS - 1, int(float(element.get("y") or 0) / cell_height)))
    return (row * GRID_COLS) + col


def cell_indexes_for_box(element: dict[str, Any], viewport_width: int, viewport_height: int) -> list[int]:
    cell_width = max(1, viewport_width / GRID_COLS)
    cell_height = max(1, viewport_height / GRID_ROWS)
    x = max(0.0, float(element.get("x") or 0))
    y = max(0.0, float(element.get("y") or 0))
    right = min(float(viewport_width), x + float(element.get("width") or 0))
    bottom = min(float(viewport_height), y + float(element.get("height") or 0))
    if right <= x or bottom <= y:
        return []

    start_col = max(0, min(GRID_COLS - 1, int(x / cell_width)))
    end_col = max(0, min(GRID_COLS - 1, int((right - 1) / cell_width)))
    start_row = max(0, min(GRID_ROWS - 1, int(y / cell_height)))
    end_row = max(0, min(GRID_ROWS - 1, int((bottom - 1) / cell_height)))
    return [(row * GRID_COLS) + col for row in range(start_row, end_row + 1) for col in range(start_col, end_col + 1)]


def remove_ignored_nodes(soup: BeautifulSoup) -> None:
    for tag in soup.find_all(IGNORED_TAGS):
        tag.decompose()


def should_ignore_tag(tag: Tag) -> bool:
    if (tag.name or "").lower() in IGNORED_TAGS or tag.has_attr("hidden"):
        return True
    style = parse_style(tag)
    return style.get("display", "").strip().lower() == "none" or style.get("visibility", "").strip().lower() == "hidden"


def visible_text_for_leafish_tag(tag: Tag) -> str:
    child_text_block = tag.find(list(TEXT_BLOCK_TAGS - {tag.name or ""}))
    if child_text_block is not None:
        direct_parts = [normalize_text(str(child)) for child in tag.children if isinstance(child, NavigableString)]
        return normalize_text(" ".join(direct_parts))
    return normalize_text(tag.get_text(" ", strip=True))


def estimate_word_count(text: str) -> int:
    latin_count = len(LATIN_WORD_PATTERN.findall(text or ""))
    cjk_count = len(CJK_CHAR_PATTERN.findall(text or ""))
    return latin_count + (round(cjk_count / 2) if cjk_count else 0)


def has_heading_child(tag: Tag) -> bool:
    return tag.find(["h1", "h2", "h3", "h4", "h5", "h6"]) is not None


def has_visible_border(tag: Tag) -> bool:
    style = parse_style(tag)
    border_tokens = [style.get("border", ""), style.get("border-top", ""), style.get("border-right", ""), style.get("border-bottom", ""), style.get("border-left", ""), style.get("outline", "")]
    return any(token and "none" not in token and "0" not in token.split()[:1] for token in border_tokens)


def has_background_fill(tag: Tag) -> bool:
    style = parse_style(tag)
    background = style.get("background", "") or style.get("background-color", "")
    normalized = background.strip().lower()
    return bool(normalized) and normalized not in {"transparent", "rgba(0,0,0,0)", "rgba(0, 0, 0, 0)", "none"}


def has_background_image(tag: Tag) -> bool:
    style = parse_style(tag)
    background = style.get("background", "") + " " + style.get("background-image", "")
    return "url(" in background.lower()


def display_value(tag: Tag) -> str:
    return parse_style(tag).get("display", "").strip().lower()


def parse_style(tag: Tag) -> dict[str, str]:
    raw_style = tag.get("style", "")
    if not isinstance(raw_style, str) or not raw_style.strip():
        return {}
    return {name.strip().lower(): value.strip().lower() for name, value in STYLE_DECLARATION_PATTERN.findall(raw_style)}


def rendered_has_visible_border(element: dict[str, Any]) -> bool:
    border = f"{element.get('border', '')} {element.get('outline', '')}".lower()
    return bool(border.strip()) and "none" not in border and not re.search(r"\b0(px)?\b", border)


def rendered_has_background_fill(element: dict[str, Any]) -> bool:
    background = str(element.get("background_color") or "").strip().lower()
    return bool(background) and background not in {"transparent", "rgba(0, 0, 0, 0)", "rgba(0,0,0,0)"}


def class_or_id_contains(tag: Tag, hints: tuple[str, ...]) -> bool:
    parts = [tag.get("id", "")]
    classes = tag.get("class", [])
    if isinstance(classes, list):
        parts.extend(str(item) for item in classes)
    elif isinstance(classes, str):
        parts.append(classes)
    blob = " ".join(parts).lower()
    return any(hint in blob for hint in hints)


def rendered_class_or_id_contains(element: dict[str, Any], hints: tuple[str, ...]) -> bool:
    blob = f"{element.get('id', '')} {element.get('class_name', '')} {element.get('role', '')}".lower()
    return any(hint in blob for hint in hints)


def get_tag_summary(tag: Tag) -> str:
    tag_name = tag.name or "unknown"
    element_id = f"#{tag.get('id')}" if tag.get("id") else ""
    classes = "." + ".".join(tag.get("class", [])) if tag.get("class") else ""
    return f"{tag_name}{element_id}{classes}"


def rendered_element_summary(element: dict[str, Any]) -> str:
    tag_name = str(element.get("tag") or "unknown")
    element_id = f"#{element.get('id')}" if element.get("id") else ""
    class_blob = str(element.get("class_name") or "").strip()
    classes = "." + ".".join(class_blob.split()) if class_blob else ""
    return f"{tag_name}{element_id}{classes}"


def normalize_text(text: str) -> str:
    return " ".join((text or "").split())


def heatmap_color(ratio: float) -> str:
    if ratio >= 0.8:
        return "red"
    if ratio >= 0.6:
        return "orange"
    if ratio >= 0.4:
        return "yellow"
    if ratio >= 0.2:
        return "yellow-green"
    if ratio > 0:
        return "green"
    return "dark-green"


def complexity_level(vcs_0_to_10: float) -> str:
    if vcs_0_to_10 >= 8:
        return "very high"
    if vcs_0_to_10 >= 6:
        return "high"
    if vcs_0_to_10 >= 4:
        return "moderate"
    if vcs_0_to_10 >= 2:
        return "low"
    return "very low"


def load_html_from_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def main() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Estimate DOM-based visual complexity for an HTML file.")
    parser.add_argument("html_file", help="Path to an HTML file")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    args = parser.parse_args()

    result = analyze_visual_complexity(load_html_from_file(args.html_file))
    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
