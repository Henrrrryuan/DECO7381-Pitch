from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from ...schemas import Issue, Severity
from .shared import REGULAR_BASE_PENALTY, make_issue


def detect_poor_heading_structure_selector(context: dict[str, Any]):
    return detect_poor_heading_structure(context["soup"])


def detect_poor_heading_structure(soup: BeautifulSoup) -> Issue | None:
    headings = get_headings(soup)
    if not headings:
        return make_issue(
            rule_id="PHS-1",
            title="Poor Heading Structure",
            severity="major",
            base_penalty=REGULAR_BASE_PENALTY,
            description="Clear heading structure supports orientation and page understanding.",
            suggestion="Add one clear h1 and use lower-level headings to mark major sections in order.",
            evidence={"heading_count": 0, "violations_count": 1, "violations": [{"type": "missing_headings"}]},
        )

    violations: list[dict[str, Any]] = []
    first_heading_level = headings[0]["level"]
    h1_headings = [heading for heading in headings if heading["level"] == 1]
    seen_texts: dict[str, dict[str, Any]] = {}

    if not h1_headings:
        violations.append({"type": "missing_h1", "tag": None, "text": "", "previous_level": None, "current_level": None})
    elif len(h1_headings) > 1:
        for heading in h1_headings[1:]:
            violations.append({"type": "multiple_h1", "tag": heading["tag"], "text": heading["text"], "previous_level": 1, "current_level": 1})

    if first_heading_level != 1:
        violations.append({"type": "first_heading_not_h1", "tag": headings[0]["tag"], "text": headings[0]["text"], "previous_level": None, "current_level": first_heading_level})

    jump_count = 0
    empty_heading_count = 0
    duplicate_heading_count = 0
    previous_level = headings[0]["level"]

    for heading in headings:
        normalized_heading = normalize_text(heading["text"]).lower()
        if not normalized_heading:
            empty_heading_count += 1
            violations.append({"type": "empty_heading", "tag": heading["tag"], "text": "", "previous_level": None, "current_level": heading["level"]})
        elif normalized_heading in seen_texts:
            duplicate_heading_count += 1
            violations.append({"type": "duplicate_heading_text", "tag": heading["tag"], "text": heading["text"], "previous_level": seen_texts[normalized_heading]["level"], "current_level": heading["level"]})
        else:
            seen_texts[normalized_heading] = heading

    for heading in headings[1:]:
        current_level = heading["level"]
        if current_level > previous_level + 1:
            jump_count += 1
            violations.append({"type": "hierarchy_gap", "tag": heading["tag"], "text": heading["text"], "previous_level": previous_level, "current_level": current_level})
        previous_level = current_level

    if not violations:
        return None

    if jump_count >= 3 or first_heading_level > 2 or not h1_headings:
        severity: Severity = "critical"
    elif jump_count >= 2 or first_heading_level != 1 or duplicate_heading_count >= 2:
        severity = "major"
    else:
        severity = "minor"

    return make_issue(
        rule_id="PHS-1",
        title="Poor Heading Structure",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="Clear heading structure supports orientation and page understanding.",
        suggestion="Use one h1, avoid skipped heading levels, and keep headings descriptive.",
        evidence={
            "heading_count": len(headings),
            "violations_count": len(violations),
            "first_heading_level": first_heading_level,
            "h1_count": len(h1_headings),
            "jump_count": jump_count,
            "empty_heading_count": empty_heading_count,
            "duplicate_heading_count": duplicate_heading_count,
            "violations": violations,
        },
        locations=violations[:5],
    )


def get_headings(soup: BeautifulSoup) -> list[dict[str, Any]]:
    headings: list[dict[str, Any]] = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        if isinstance(tag, Tag):
            headings.append({
                "tag": tag.name,
                "text": normalize_text(tag.get_text(" ", strip=True)),
                "level": int(str(tag.name)[1]),
            })
    return headings


def normalize_text(text: str) -> str:
    return " ".join(text.split())
