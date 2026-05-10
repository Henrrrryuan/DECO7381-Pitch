from __future__ import annotations

import logging
import os
from typing import Any

from bs4 import BeautifulSoup, Tag

from ...schemas import Issue
from ..location_utils import get_tag_summary, stable_selector
from .shared import REGULAR_BASE_PENALTY, make_issue

# Document-level structural finding: no DOM highlight target (not body/main/article).

logger = logging.getLogger(__name__)

_PHS_DEBUG_ENV = "COGNILENS_DEBUG_PHS"


def detect_poor_heading_structure_selector(context: dict[str, Any]):
    return detect_poor_heading_structure(context["soup"])


def _debug_log_phs_locations(locations: list[dict[str, Any]]) -> None:
    if os.environ.get(_PHS_DEBUG_ENV, "").lower() not in ("1", "true", "yes"):
        return
    for loc in locations:
        logger.info(
            "[PHS] %s",
            {
                "violationType": loc.get("violationType"),
                "selector": loc.get("selector"),
                "headingLevel": loc.get("headingLevel"),
                "textPreview": (loc.get("text") or loc.get("preview") or "")[:120],
            },
        )


def _attrs_subset(tag: Tag) -> dict[str, Any]:
    attrs: dict[str, Any] = {}
    if tag.get("id"):
        attrs["id"] = str(tag.get("id"))
    if tag.get("class"):
        attrs["class"] = " ".join(tag.get("class", []))
    return attrs


def _location_from_tag(
    tag: Tag,
    *,
    violation_type: str,
    heading_level: int | None,
    text: str,
    previous_level: int | None = None,
    current_level: int | None = None,
) -> dict[str, Any]:
    preview = (text or "")[:160]
    payload: dict[str, Any] = {
        "violationType": violation_type,
        "headingLevel": heading_level,
        "text": preview,
        "preview": preview,
        "selector": stable_selector(tag),
        "tag": tag.name or "",
        "summary": get_tag_summary(tag),
        "attrs": _attrs_subset(tag),
    }
    if previous_level is not None:
        payload["previousHeadingLevel"] = previous_level
    if current_level is not None:
        payload["currentHeadingLevel"] = current_level
    return payload


def _document_structural_location(violation_type: str) -> dict[str, Any]:
    """PHS document-level row: no selectable DOM node (avoid body/main preview pollution)."""
    return {
        "violationType": violation_type,
        "headingLevel": None,
        "text": "",
        "preview": "",
        "selector": "",
        "tag": "document",
        "summary": "",
        "attrs": {},
        "highlightable": False,
        "documentStructuralFinding": True,
    }


def detect_poor_heading_structure(soup: BeautifulSoup) -> Issue | None:
    headings = get_headings(soup)
    locations: list[dict[str, Any]] = []
    violations_evidence: list[dict[str, Any]] = []

    phs_description = (
        "Document-level semantic heading structure issue (h1–h6 markup order): inconsistent or missing "
        "heading patterns affect how the page is understood from HTML alone—not viewport layout or visual prominence."
    )
    phs_suggestion = (
        "Use a predictable h1–h6 hierarchy in the markup: one primary h1 where appropriate, avoid skipped levels, "
        "and keep heading text meaningful."
    )

    if not headings:
        loc = _document_structural_location("missing_headings")
        locations.append(loc)
        violations_evidence.append({"violationType": "missing_headings"})
        _debug_log_phs_locations(locations)
        return make_issue(
            rule_id="PHS-1",
            title="Poor Heading Structure",
            base_penalty=REGULAR_BASE_PENALTY,
            description=phs_description,
            suggestion=phs_suggestion,
            evidence={
                "heading_count": 0,
                "violations_count": 1,
                "violations": violations_evidence,
                "confidence": "Medium-High",
            },
            locations=locations[:8],
        )

    first_heading_level = headings[0]["level"]
    h1_headings = [heading for heading in headings if heading["level"] == 1]
    seen_texts: dict[str, dict[str, Any]] = {}

    jump_count = 0
    empty_heading_count = 0
    duplicate_heading_count = 0
    previous_level = headings[0]["level"]

    if not h1_headings:
        tag = headings[0]["element"]
        locations.append(
            _location_from_tag(
                tag,
                violation_type="missing_h1",
                heading_level=headings[0]["level"],
                text=headings[0]["text"],
            )
        )
        violations_evidence.append({"violationType": "missing_h1", "headingLevel": headings[0]["level"]})
    elif len(h1_headings) > 1:
        for heading in h1_headings[1:]:
            tag = heading["element"]
            locations.append(
                _location_from_tag(tag, violation_type="multiple_h1", heading_level=1, text=heading["text"])
            )
            violations_evidence.append({"violationType": "multiple_h1", "headingLevel": 1})

    if first_heading_level != 1:
        tag = headings[0]["element"]
        locations.append(
            _location_from_tag(
                tag,
                violation_type="first_heading_not_h1",
                heading_level=first_heading_level,
                text=headings[0]["text"],
                current_level=first_heading_level,
            )
        )
        violations_evidence.append(
            {"violationType": "first_heading_not_h1", "headingLevel": first_heading_level}
        )

    for heading in headings:
        normalized_heading = normalize_text(heading["text"]).lower()
        if not normalized_heading:
            empty_heading_count += 1
            tag = heading["element"]
            locations.append(
                _location_from_tag(tag, violation_type="empty_heading", heading_level=heading["level"], text="")
            )
            violations_evidence.append({"violationType": "empty_heading", "headingLevel": heading["level"]})
        elif normalized_heading in seen_texts:
            duplicate_heading_count += 1
            tag = heading["element"]
            locations.append(
                _location_from_tag(
                    tag,
                    violation_type="duplicate_heading_text",
                    heading_level=heading["level"],
                    text=heading["text"],
                    previous_level=seen_texts[normalized_heading]["level"],
                    current_level=heading["level"],
                )
            )
            violations_evidence.append(
                {
                    "violationType": "duplicate_heading_text",
                    "headingLevel": heading["level"],
                    "previousHeadingLevel": seen_texts[normalized_heading]["level"],
                }
            )
        else:
            seen_texts[normalized_heading] = heading

    for heading in headings[1:]:
        current_level = heading["level"]
        if current_level > previous_level + 1:
            jump_count += 1
            tag = heading["element"]
            locations.append(
                _location_from_tag(
                    tag,
                    violation_type="hierarchy_gap",
                    heading_level=current_level,
                    text=heading["text"],
                    previous_level=previous_level,
                    current_level=current_level,
                )
            )
            violations_evidence.append(
                {
                    "violationType": "hierarchy_gap",
                    "headingLevel": current_level,
                    "skippedFromLevel": previous_level,
                }
            )
        previous_level = current_level

    if not locations:
        return None

    trimmed_locations = locations[:8]
    _debug_log_phs_locations(trimmed_locations)

    return make_issue(
        rule_id="PHS-1",
        title="Poor Heading Structure",
        base_penalty=REGULAR_BASE_PENALTY,
        description=phs_description,
        suggestion=phs_suggestion,
        evidence={
            "heading_count": len(headings),
            "violations_count": len(violations_evidence),
            "first_heading_level": first_heading_level,
            "h1_count": len(h1_headings),
            "jump_count": jump_count,
            "empty_heading_count": empty_heading_count,
            "duplicate_heading_count": duplicate_heading_count,
            "violations": violations_evidence,
            "confidence": "Medium-High",
        },
        locations=trimmed_locations,
    )


def get_headings(soup: BeautifulSoup) -> list[dict[str, Any]]:
    headings: list[dict[str, Any]] = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        if isinstance(tag, Tag):
            headings.append({
                "element": tag,
                "tag": tag.name,
                "text": normalize_text(tag.get_text(" ", strip=True)),
                "level": int(str(tag.name)[1]),
            })
    return headings


def normalize_text(text: str) -> str:
    return " ".join(text.split())
