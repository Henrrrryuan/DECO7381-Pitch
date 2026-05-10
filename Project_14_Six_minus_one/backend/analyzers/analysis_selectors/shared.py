from __future__ import annotations

from typing import Any

from bs4 import Tag

from ...schemas import Issue

REGULAR_BASE_PENALTY = 3
SERIOUS_BASE_PENALTY = 4


def make_issue(
    *,
    rule_id: str,
    title: str,
    base_penalty: int,
    description: str,
    suggestion: str,
    evidence: dict[str, Any],
    locations: list[dict[str, Any]] | None = None,
) -> Issue:
    return Issue(
        rule_id=rule_id,
        title=title,
        base_penalty=base_penalty,
        penalty=base_penalty,
        description=description,
        suggestion=suggestion,
        evidence=evidence,
        locations=locations or [],
    )


def visible_text(tag: Tag) -> str:
    return " ".join(tag.get_text(" ", strip=True).split())


def tag_location(tag: Tag, **extra: Any) -> dict[str, Any]:
    attrs = {
        "id": tag.get("id", ""),
        "class": " ".join(tag.get("class", [])),
        "href": tag.get("href", ""),
        "aria-label": tag.get("aria-label", ""),
    }
    case_id = tag.get("data-case-id")
    if case_id:
        attrs["data-case-id"] = str(case_id)
    return {
        "tag": tag.name or "",
        "text": visible_text(tag)[:180],
        "preview": visible_text(tag)[:180],
        "attrs": {key: value for key, value in attrs.items() if value},
        **extra,
    }
