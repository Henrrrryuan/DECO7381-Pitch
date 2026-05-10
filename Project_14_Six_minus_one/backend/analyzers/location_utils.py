from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup, Tag

from ..schemas import AnalysisResult

BAD_TARGET_TAGS = {
    "html", "head", "body", "script", "style", "meta", "link",
    "noscript", "template", "defs", "path", "symbol", "clippath", "mask", "title",
}
STRUCTURAL_TAGS = {"section", "article", "main", "header", "footer", "nav", "ul", "ol", "form", "fieldset", "table"}
GENERIC_SELECTOR_TAGS = {"a", "button", "div", "section", "p", "li", "img", "input", "article", "nav", "main"}
READABILITY_TAGS = {
    "p", "li", "td", "th", "caption", "figcaption", "label", "legend",
    "h1", "h2", "h3", "h4", "h5", "h6", "abbr", "acronym",
}
INTERACTION_TAGS = {"a", "button", "input", "select", "textarea", "dialog"}
MEDIA_TAGS = {"img", "video", "audio"}
FOCAL_POINT_TAGS = INTERACTION_TAGS | MEDIA_TAGS | {"h1", "h2", "h3", "nav", "header", "section", "article"}

SUMMARY_SELECTOR_PATTERN = re.compile(r"^[a-z][a-z0-9-]*(?:#[A-Za-z0-9_-]+)?(?:\.[A-Za-z0-9_-]+)*$", re.I)


def sanitize_analysis_locations(analysis: AnalysisResult, html: str) -> AnalysisResult:
    soup = BeautifulSoup(html or "", "html.parser")
    for dimension in analysis.dimensions:
        for issue in dimension.issues:
            issue.locations = sanitize_issue_locations(
                soup,
                issue.locations,
                dimension.dimension,
                issue.rule_id,
            )
    return analysis


def _location_dedupe_key(rule_id: str, selector: str, location: dict[str, Any]) -> Any:
    if rule_id == "PHS-1":
        return (selector, str(location.get("violationType") or ""))
    return selector


def _candidate_used(
    tag: Tag,
    location: dict[str, Any],
    rule_id: str,
    used_keys: set[Any],
) -> bool:
    selector = stable_selector(tag)
    key = _location_dedupe_key(rule_id, selector, location)
    return key in used_keys


def _max_sanitized_locations(rule_id: str) -> int | None:
    """Return None for no cap (preserve every detector-supplied location)."""
    if rule_id == "WIP-1":
        return None
    return 8


def _phs_structural_pass_through(location: dict[str, Any]) -> bool:
    """PHS-1 document-level finding: do not resolve to body/main or aggregate page text."""
    if not isinstance(location, dict):
        return False
    if location.get("documentStructuralFinding") is True:
        return True
    if location.get("highlightable") is False:
        return True
    if str(location.get("tag") or "").lower() == "document":
        return True
    return False


def build_structural_phs_sanitized_payload(original: dict[str, Any]) -> dict[str, Any]:
    """Stable payload for structural-only PHS rows (no DOM highlight)."""
    payload: dict[str, Any] = {
        "tag": "document",
        "selector": "",
        "summary": "",
        "label": "Document structure",
        "preview": "",
        "highlightable": False,
        "documentStructuralFinding": True,
    }
    for key in (
        "violationType",
        "headingLevel",
        "previousHeadingLevel",
        "currentHeadingLevel",
        "attrs",
    ):
        if key in original:
            payload[key] = original[key]
    return payload


PHS_HEADING_TAG_NAMES = frozenset({"h1", "h2", "h3", "h4", "h5", "h6"})
PHS_HEADING_TAGS_LIST = ["h1", "h2", "h3", "h4", "h5", "h6"]


def _phs_first_nonempty_text_field(location: dict[str, Any]) -> str:
    for key in ("text", "preview", "sentence_preview", "label"):
        raw = str(location.get(key) or "").strip()
        if raw:
            return raw
    return ""


def _phs_normalize_heading_plain(tag: Tag) -> str:
    return normalize_text(tag.get_text(" ", strip=True)).lower()


def _phs_narrow_tags_by_exact_heading_text(sel_tags: list[Tag], location: dict[str, Any]) -> list[Tag]:
    """When a selector matches multiple nodes, keep only headings whose text equals the location payload."""
    target = normalize_text(_phs_first_nonempty_text_field(location)).lower()
    if not target:
        return []
    out: list[Tag] = []
    for tag in sel_tags:
        if not isinstance(tag, Tag):
            continue
        if (tag.name or "").lower() not in PHS_HEADING_TAG_NAMES:
            continue
        if _phs_normalize_heading_plain(tag) == target:
            out.append(tag)
    return dedupe_tags(out)


def _find_by_text_phs_strict(soup: BeautifulSoup, text: str) -> list[Tag]:
    """PHS-1: exact normalized match on h1–h6 only; no substring / fuzzy overlap."""
    normalized = normalize_text(text).lower()
    if not normalized:
        return []
    matches: list[Tag] = []
    for tag in soup.find_all(PHS_HEADING_TAGS_LIST):
        if not isinstance(tag, Tag):
            continue
        if _phs_normalize_heading_plain(tag) == normalized:
            matches.append(tag)
    return matches


def _find_candidate_tags_phs(soup: BeautifulSoup, location: dict[str, Any]) -> list[Tag]:
    """PHS-1 only: selector-first; strict heading text fallback (no global find_by_text)."""
    selector = str(location.get("selector") or "").strip()
    if selector:
        sel_tags = select_safely(soup, selector)
        if len(sel_tags) == 1:
            return sel_tags
        if len(sel_tags) > 1:
            narrowed = _phs_narrow_tags_by_exact_heading_text(sel_tags, location)
            if narrowed:
                return narrowed

    candidates: list[Tag] = []
    summary = str(location.get("summary") or location.get("region") or "").strip()
    if is_usable_summary_selector(summary):
        candidates.extend(select_safely(soup, summary))

    attrs = location.get("attrs") if isinstance(location.get("attrs"), dict) else {}
    tag_name = normalized_tag(location.get("tag"))
    if attrs:
        candidates.extend(find_by_attrs(soup, tag_name, attrs))

    if location.get("block_index"):
        block = block_by_index(soup, int(location.get("block_index") or 0))
        if block is not None:
            return [block]

    for text_key in ("text", "preview", "sentence_preview", "label"):
        text = str(location.get(text_key) or "").strip()
        if text:
            candidates.extend(_find_by_text_phs_strict(soup, text))

    return dedupe_tags(candidates)


def sanitize_issue_locations(
    soup: BeautifulSoup,
    locations: list[dict[str, Any]],
    dimension_name: str,
    rule_id: str,
) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    used_keys: set[Any] = set()
    cap = _max_sanitized_locations(rule_id)
    for location in locations or []:
        if rule_id == "PHS-1" and _phs_structural_pass_through(location):
            dedupe_key = _location_dedupe_key(rule_id, str(location.get("selector") or ""), location)
            if dedupe_key in used_keys:
                continue
            used_keys.add(dedupe_key)
            sanitized.append(build_structural_phs_sanitized_payload(location))
            if cap is not None and len(sanitized) >= cap:
                break
            continue

        if rule_id == "PHS-1" and not _phs_structural_pass_through(location):
            locked_tag = _phs_try_lock_unique_selector_heading(soup, location, dimension_name, rule_id)
            if locked_tag is not None:
                selector = stable_selector(locked_tag)
                if selector:
                    dedupe_key = _location_dedupe_key(rule_id, selector, location)
                    if dedupe_key in used_keys:
                        continue
                    used_keys.add(dedupe_key)
                    sanitized.append(build_location_payload(locked_tag, location, selector))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        candidate = best_candidate_for_location(soup, location, dimension_name, rule_id, used_keys)
        if candidate is None:
            continue
        selector = stable_selector(candidate)
        if not selector:
            continue
        dedupe_key = _location_dedupe_key(rule_id, selector, location)
        if dedupe_key in used_keys:
            continue
        used_keys.add(dedupe_key)
        sanitized.append(build_location_payload(candidate, location, selector))
        if cap is not None and len(sanitized) >= cap:
            break
    return sanitized


def best_candidate_for_location(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
    used_keys: set[Any],
) -> Tag | None:
    candidates = [
        candidate
        for candidate in find_candidate_tags(soup, location, dimension_name, rule_id)
        if is_candidate_highlightable(candidate, dimension_name, rule_id)
    ]
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda tag: (
            _candidate_used(tag, location, rule_id, used_keys),
            structural_penalty(tag, dimension_name, rule_id),
            document_order_index(tag),
        ),
    )[0]


def find_candidate_tags(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> list[Tag]:
    if not isinstance(location, dict):
        return []

    if rule_id == "PHS-1" and _phs_structural_pass_through(location):
        return []

    if rule_id == "PHS-1":
        return _find_candidate_tags_phs(soup, location)

    candidates: list[Tag] = []
    selector = str(location.get("selector") or "").strip()
    if selector:
        candidates.extend(select_safely(soup, selector))

    summary = str(location.get("summary") or location.get("region") or "").strip()
    if is_usable_summary_selector(summary):
        candidates.extend(select_safely(soup, summary))

    attrs = location.get("attrs") if isinstance(location.get("attrs"), dict) else {}
    tag_name = normalized_tag(location.get("tag"))
    if attrs:
        candidates.extend(find_by_attrs(soup, tag_name, attrs))

    if location.get("block_index"):
        block = block_by_index(soup, int(location.get("block_index") or 0))
        if block is not None:
            # Text selectors index their own block stream. Keep that exact
            # block ahead of fuzzy matches against short nested labels.
            return [block]

    for text_key in ("text", "preview", "sentence_preview", "label"):
        text = str(location.get(text_key) or "").strip()
        if text:
            candidates.extend(find_by_text(soup, tag_name, text, dimension_name, rule_id))

    if not candidates and rule_id == "VO-1":
        candidates.extend(first_screen_focal_points(soup))

    return dedupe_tags(candidates)


def select_safely(soup: BeautifulSoup, selector: str) -> list[Tag]:
    if is_too_generic_selector(selector):
        return []
    try:
        return [tag for tag in soup.select(selector) if isinstance(tag, Tag)]
    except Exception:
        return []


def _phs_try_lock_unique_selector_heading(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """PHS-1: when detector selector resolves to exactly one heading, lock identity (skip candidate ranking)."""
    if rule_id != "PHS-1" or _phs_structural_pass_through(location):
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if (tag.name or "").lower() not in PHS_HEADING_TAG_NAMES:
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


def find_by_attrs(soup: BeautifulSoup, tag_name: str, attrs: dict[str, Any]) -> list[Tag]:
    if attrs.get("id"):
        found = soup.find(id=str(attrs["id"]))
        return [found] if isinstance(found, Tag) else []

    selectors: list[str] = []
    if attrs.get("href") and tag_name == "a":
        selectors.append(f'a[href="{css_attr_escape(str(attrs["href"]))}"]')
    if attrs.get("aria-label"):
        selector_tag = tag_name if tag_name else "*"
        selectors.append(f'{selector_tag}[aria-label="{css_attr_escape(str(attrs["aria-label"]))}"]')
    if attrs.get("alt") and tag_name == "img":
        selectors.append(f'img[alt="{css_attr_escape(str(attrs["alt"]))}"]')

    candidates: list[Tag] = []
    for selector in selectors:
        candidates.extend(select_safely(soup, selector))

    classes = str(attrs.get("class") or "").split()
    if classes:
        tag_filter = tag_name if tag_name else True
        for class_name in classes[:2]:
            candidates.extend(
                tag for tag in soup.find_all(tag_filter, class_=class_name) if isinstance(tag, Tag)
            )
    return dedupe_tags(candidates)


def block_by_index(soup: BeautifulSoup, block_index: int) -> Tag | None:
    if block_index <= 0:
        return None
    blocks = [
        tag for tag in soup.select("p, li, td, th, caption, figcaption")
        if isinstance(tag, Tag) and text_preview(tag)
    ]
    return blocks[block_index - 1] if block_index <= len(blocks) else None


def find_by_text(
    soup: BeautifulSoup,
    tag_name: str,
    text: str,
    dimension_name: str,
    rule_id: str,
) -> list[Tag]:
    normalized = normalize_text(text).lower()
    if not normalized:
        return []
    tags = allowed_tags_for_dimension(dimension_name, rule_id)
    if tag_name and tag_name not in BAD_TARGET_TAGS:
        tags = {tag_name} | tags
    matches: list[Tag] = []
    for tag in soup.find_all(list(tags)):
        if not isinstance(tag, Tag):
            continue
        candidate = normalize_text(tag.get_text(" ", strip=True)).lower()
        if not candidate:
            continue
        if candidate in normalized or text_matches_without_short_false_positive(candidate, normalized):
            matches.append(tag)
    return matches


def text_matches_without_short_false_positive(candidate: str, target: str) -> bool:
    if target in candidate:
        return True
    if len(candidate) < 24:
        return False
    if candidate in target:
        return True
    candidate_words = set(candidate.split())
    target_words = set(target.split())
    if not candidate_words or not target_words:
        return False
    overlap = len(candidate_words & target_words) / max(1, min(len(candidate_words), len(target_words)))
    return overlap >= 0.7


def first_screen_focal_points(soup: BeautifulSoup) -> list[Tag]:
    root = soup.body if isinstance(soup.body, Tag) else soup
    matches: list[Tag] = []
    for tag in root.find_all(True):
        if not isinstance(tag, Tag):
            continue
        if len(matches) >= 12:
            break
        if tag.name in BAD_TARGET_TAGS:
            continue
        if tag.name in {"a", "button", "input", "select", "textarea", "img", "h1", "h2", "h3", "video", "audio"}:
            matches.append(tag)
            continue
        attrs_blob = " ".join([tag.get("id", ""), " ".join(tag.get("class", [])), tag.get("role", "")]).lower()
        if any(keyword in attrs_blob for keyword in ("logo", "hero", "cta", "button", "card", "tile", "nav")):
            better_child = first_highlightable_child(tag, "Visual Overload", "VO-1")
            matches.append(better_child or tag)
    return dedupe_tags(matches)


def is_candidate_highlightable(tag: Tag, dimension_name: str, rule_id: str) -> bool:
    tag_name = normalized_tag(tag.name)
    if rule_id == "PHS-1" and tag_name in {"main", "article", "body"}:
        return False
    if tag_name in BAD_TARGET_TAGS:
        return False
    if is_hidden_static(tag):
        return False
    if tag_name == "input" and (tag.get("type") or "").lower() == "hidden":
        return False
    if tag_name == "svg":
        return bool(tag.get("aria-label") or tag.get("role") == "img")
    if dimension_name in {
        "Dense Text Detection",
        "Language Complexity",
        "Sentence Complexity",
        "Long Content Without Chunking",
        "Poor Heading Structure",
        "Navigation Complexity",
        "Weak Information Prominence",
        "Visual Overload",
        "Auto-Moving Content",
        "Excessive Interruptions",
    }:
        return (
            tag_name in (READABILITY_TAGS | INTERACTION_TAGS | MEDIA_TAGS | STRUCTURAL_TAGS)
            or looks_like_visual_component(tag)
        )
    if rule_id == "VO-1":
        return tag_name in FOCAL_POINT_TAGS or looks_like_visual_component(tag)
    if tag_name in STRUCTURAL_TAGS:
        return first_highlightable_child(tag, dimension_name, rule_id) is None or looks_like_visual_component(tag)
    return True


def first_highlightable_child(tag: Tag, dimension_name: str, rule_id: str) -> Tag | None:
    for child in tag.find_all(["a", "button", "input", "img", "h1", "h2", "h3", "p", "li", "td", "th", "video", "audio"]):
        if isinstance(child, Tag) and is_candidate_highlightable(child, dimension_name, rule_id):
            return child
    return None


def build_location_payload(tag: Tag, original: dict[str, Any], selector: str) -> dict[str, Any]:
    label = accessible_label(tag) or text_preview(tag) or human_tag_label(tag)
    payload: dict[str, Any] = {
        "tag": tag.name or "unknown",
        "selector": selector,
        "summary": get_tag_summary(tag),
        "label": label[:90],
        "preview": text_preview(tag)[:160],
        "highlightable": True,
    }
    if tag.get("data-cognilens-id"):
        payload["cognilensId"] = str(tag.get("data-cognilens-id"))
    bounding_box = original.get("boundingBox") or original.get("rect") or parse_rendered_rect(tag)
    if isinstance(bounding_box, dict):
        payload["boundingBox"] = bounding_box
    for key in (
        "average_sentence_length",
        "sentence_count",
        "complex_word_ratio",
        "complex_word_count",
        "instruction_hint_count",
        "qualifier_count",
        "interrupt_type",
        "animated_count",
        "region",
        "violationType",
        "headingLevel",
        "previousHeadingLevel",
        "currentHeadingLevel",
        "text",
        "attrs",
    ):
        if key in original:
            payload[key] = original[key]
    return payload


def stable_selector(tag: Tag) -> str:
    cognilens_id = tag.get("data-cognilens-id")
    if cognilens_id:
        return f'[data-cognilens-id="{css_attr_escape(str(cognilens_id))}"]'

    if tag.get("id"):
        return f"#{css_identifier_escape(str(tag['id']))}"

    attr_selector = attribute_selector(tag)
    if attr_selector and len(select_in_root(tag, attr_selector)) == 1:
        return attr_selector

    class_selector = class_selector_for(tag)
    if class_selector and len(select_in_root(tag, class_selector)) == 1:
        return class_selector

    path = nth_of_type_path(tag)
    if path and not is_too_generic_selector(path):
        return path

    structural_root = (tag.name or "").lower()
    if structural_root in {"main", "article", "body"}:
        return structural_root

    return ""


def attribute_selector(tag: Tag) -> str:
    tag_name = tag.name or ""
    if tag.name == "a" and tag.get("href"):
        return f'a[href="{css_attr_escape(str(tag["href"]))}"]'
    if tag.get("aria-label"):
        return f'{tag_name}[aria-label="{css_attr_escape(str(tag["aria-label"]))}"]'
    if tag.get("title"):
        return f'{tag_name}[title="{css_attr_escape(str(tag["title"]))}"]'
    if tag.name == "img" and tag.get("alt"):
        return f'img[alt="{css_attr_escape(str(tag["alt"]))}"]'
    if tag.name == "input" and tag.get("name"):
        return f'input[name="{css_attr_escape(str(tag["name"]))}"]'
    return ""


def class_selector_for(tag: Tag) -> str:
    classes = [str(item) for item in tag.get("class", []) if str(item).strip()]
    if not classes:
        return ""
    tag_name = tag.name or ""
    return tag_name + "".join(f".{css_identifier_escape(class_name)}" for class_name in classes[:2])


def nth_of_type_path(tag: Tag) -> str:
    parts: list[str] = []
    current: Tag | None = tag
    while isinstance(current, Tag) and current.name not in {"[document]", "html"}:
        name = current.name or ""
        if name in BAD_TARGET_TAGS:
            break
        if current.get("id"):
            parts.append(f"{name}#{css_identifier_escape(str(current['id']))}")
            break
        siblings = [
            sibling
            for sibling in current.parent.find_all(name, recursive=False)
            if isinstance(sibling, Tag)
        ] if isinstance(current.parent, Tag) else []
        index = siblings.index(current) + 1 if current in siblings else 1
        parts.append(f"{name}:nth-of-type({index})")
        if name in {"main", "header", "nav"} or len(parts) >= 5:
            break
        current = current.parent if isinstance(current.parent, Tag) else None
    return " > ".join(reversed(parts))


def select_in_root(tag: Tag, selector: str) -> list[Tag]:
    root = tag
    while isinstance(root.parent, Tag):
        root = root.parent
    try:
        return [match for match in root.select(selector) if isinstance(match, Tag)]
    except Exception:
        return []


def allowed_tags_for_dimension(dimension_name: str, rule_id: str) -> set[str]:
    if dimension_name in {"Dense Text Detection", "Language Complexity", "Sentence Complexity"}:
        return READABILITY_TAGS | {"a", "button"}
    if dimension_name in {"Auto-Moving Content", "Excessive Interruptions"}:
        return INTERACTION_TAGS | MEDIA_TAGS | {"marquee"}
    if dimension_name in {"Poor Heading Structure", "Navigation Complexity", "Weak Information Prominence"}:
        return READABILITY_TAGS | INTERACTION_TAGS | {"nav"}
    if rule_id == "VO-1":
        return FOCAL_POINT_TAGS
    return FOCAL_POINT_TAGS | {"p", "li", "td", "th", "article", "section"}


def is_usable_summary_selector(value: str) -> bool:
    return bool(value and SUMMARY_SELECTOR_PATTERN.match(value) and not is_too_generic_selector(value))


def is_too_generic_selector(selector: str) -> bool:
    normalized = selector.strip().lower()
    if normalized in {"main", "article", "body"}:
        return False
    return normalized in GENERIC_SELECTOR_TAGS or normalized in BAD_TARGET_TAGS


def is_hidden_static(tag: Tag) -> bool:
    current: Tag | None = tag
    while isinstance(current, Tag):
        if current.has_attr("hidden") or (current.get("aria-hidden") or "").lower() == "true":
            return True
        style = str(current.get("style") or "").lower().replace(" ", "")
        if any(fragment in style for fragment in ("display:none", "visibility:hidden", "opacity:0")):
            return True
        current = current.parent if isinstance(current.parent, Tag) else None
    return False


def structural_penalty(tag: Tag, dimension_name: str, rule_id: str) -> int:
    tag_name = normalized_tag(tag.name)
    if tag_name in {"a", "button", "input", "img", "h1", "h2", "h3", "p", "li", "td", "th", "video", "audio"}:
        return 0
    if tag_name in STRUCTURAL_TAGS:
        return 2
    return 1


def looks_like_visual_component(tag: Tag) -> bool:
    attrs_blob = " ".join([tag.get("id", ""), " ".join(tag.get("class", [])), tag.get("role", "")]).lower()
    return any(keyword in attrs_blob for keyword in ("logo", "hero", "card", "tile", "button", "cta", "banner", "modal", "popup", "overlay", "nav"))


def document_order_index(tag: Tag) -> int:
    root = tag
    while isinstance(root.parent, Tag):
        root = root.parent
    for index, candidate in enumerate(root.find_all(True)):
        if candidate is tag:
            return index
    return 999999


def accessible_label(tag: Tag) -> str:
    for attr in ("aria-label", "title", "alt", "value", "placeholder"):
        value = tag.get(attr)
        if isinstance(value, str) and normalize_text(value):
            return normalize_text(value)
    return normalize_text(tag.get_text(" ", strip=True))


def text_preview(tag: Tag) -> str:
    return normalize_text(tag.get_text(" ", strip=True))


def human_tag_label(tag: Tag) -> str:
    return {
        "a": "Link",
        "button": "Button",
        "img": "Image",
        "h1": "Main heading",
        "h2": "Section heading",
        "h3": "Subsection heading",
        "video": "Video",
        "audio": "Audio",
        "iframe": "Embedded frame",
    }.get(tag.name or "", (tag.name or "Element").title())


def parse_rendered_rect(tag: Tag) -> dict[str, float] | None:
    raw = str(tag.get("data-rendered-rect") or "").strip()
    if not raw:
        return None
    rect: dict[str, float] = {}
    for part in raw.split(","):
        key, _, value = part.partition(":")
        key = key.strip()
        if key not in {"x", "y", "width", "height"}:
            continue
        try:
            rect[key] = float(value)
        except ValueError:
            return None
    return rect if {"x", "y", "width", "height"}.issubset(rect) else None


def get_tag_summary(tag: Tag) -> str:
    tag_name = tag.name or "unknown"
    element_id = f"#{tag.get('id')}" if tag.get("id") else ""
    classes = "." + ".".join(tag.get("class", [])) if tag.get("class") else ""
    return f"{tag_name}{element_id}{classes}"


def dedupe_tags(tags: list[Tag]) -> list[Tag]:
    seen: set[int] = set()
    result: list[Tag] = []
    for tag in tags:
        marker = id(tag)
        if marker not in seen:
            seen.add(marker)
            result.append(tag)
    return result


def normalized_tag(value: Any) -> str:
    return str(value or "").lower()


def normalize_text(text: str) -> str:
    return " ".join(str(text or "").split())


def css_identifier_escape(value: str) -> str:
    return re.sub(r"([^A-Za-z0-9_-])", r"\\\1", value)


def css_attr_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')
