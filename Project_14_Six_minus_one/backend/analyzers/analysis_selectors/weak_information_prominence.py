from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from ..location_utils import stable_selector
from .shared import REGULAR_BASE_PENALTY, make_issue, visible_text
from .visual_parser import FIRST_VIEWPORT_TAG_WINDOW

CTA_COMPETING_THRESHOLD = 3


def detect_weak_information_prominence_selector(context: dict[str, Any]):
    return detect_weak_information_prominence(context["soup"])


def _normalized_attr_value(raw: Any) -> str:
    if isinstance(raw, list):
        return " ".join(str(v) for v in raw).lower()
    return (str(raw) if raw is not None else "").lower()


def _attrs_map_tag(tag: Tag) -> dict[str, str]:
    result: dict[str, str] = {}
    for key, raw in tag.attrs.items():
        if not key:
            continue
        result[key.lower()] = _normalized_attr_value(raw)
    return result


def is_direct_interactive_cta_element(tag: Tag) -> bool:
    """True only for concrete interactive CTA nodes (no region/container keyword matches).

    Allowed: button, a[href] (non-fragment), input button/submit, role=button, role=link.
    Rejects: div/section/main/... that only wrap CTAs or match CTA keywords in class/id.
    """
    if not isinstance(tag, Tag):
        return False
    name = (tag.name or "").lower()
    am = _attrs_map_tag(tag)
    role = am.get("role", "")

    if role == "button" or role == "link":
        return True
    if name == "button":
        return True
    if name == "a":
        href = am.get("href", "")
        return bool(href) and not str(href).startswith("#")
    if name == "input":
        return am.get("type", "text") in ("button", "submit")
    return False


def _tag_location_interactive_only(tag: Tag, **extra: Any) -> dict[str, Any]:
    """Location payload with text/preview scoped to this node only (subtree of this element)."""
    text = visible_text(tag)[:180]
    attrs = {
        "id": tag.get("id", ""),
        "class": " ".join(tag.get("class", [])),
        "href": tag.get("href", ""),
        "aria-label": tag.get("aria-label", ""),
    }
    return {
        "tag": tag.name or "",
        "text": text,
        "preview": text,
        "attrs": {key: value for key, value in attrs.items() if value},
        **extra,
    }


def collect_early_page_competing_cta_tags(soup: BeautifulSoup) -> list[Tag]:
    """Direct interactive CTA elements in the first N document-order tags (DOM-order proxy)."""
    found: list[Tag] = []
    for idx, tag in enumerate(soup.find_all(True), start=1):
        if idx > FIRST_VIEWPORT_TAG_WINDOW:
            break
        if not isinstance(tag, Tag):
            continue
        if is_direct_interactive_cta_element(tag):
            found.append(tag)
    return found


def detect_weak_information_prominence(soup: BeautifulSoup):
    competing_tags = collect_early_page_competing_cta_tags(soup)
    if len(competing_tags) <= CTA_COMPETING_THRESHOLD:
        return None

    locations: list[dict[str, Any]] = []
    for tag in competing_tags:
        loc = _tag_location_interactive_only(tag)
        loc["selector"] = stable_selector(tag)
        locations.append(loc)

    return make_issue(
        rule_id="WIP-1",
        title="Competing Primary Actions",
        base_penalty=REGULAR_BASE_PENALTY,
        description=(
            "Multiple CTA-like controls appear early in DOM order, which can make the next step unclear; "
            "this is a markup-order risk signal, not a rendered visual prominence test."
        ),
        suggestion=(
            "Choose one primary action for the early-page flow, then group, demote, or defer secondary CTA-like controls."
        ),
        evidence={
            "competing_cta_count": len(competing_tags),
            "early_page_tag_window": FIRST_VIEWPORT_TAG_WINDOW,
            "threshold": {"maxCompetingCtasNearby": CTA_COMPETING_THRESHOLD},
        },
        locations=locations,
    )
