from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from .shared import REGULAR_BASE_PENALTY, make_issue, tag_location
from .visual_parser import VisualHTMLParser

VISIBLE_ELEMENT_THRESHOLD = 20
INTERACTIVE_ELEMENT_THRESHOLD = 8


def detect_visual_overload_selector(context: dict[str, Any]):
    return detect_visual_overload(context["soup"], context["visual_parser"])


def detect_visual_overload(soup: BeautifulSoup, parser: VisualHTMLParser):
    first_viewport_elements = [
        tag for index, tag in enumerate(soup.find_all(True), start=1)
        if index <= 120 and tag.name not in {"html", "head", "body", "script", "style", "meta", "link"}
    ]
    interactive_count = len([tag for tag in first_viewport_elements if is_interactive(tag)])
    if len(first_viewport_elements) <= VISIBLE_ELEMENT_THRESHOLD and interactive_count <= INTERACTIVE_ELEMENT_THRESHOLD:
        return None
    overload_amount = max(
        len(first_viewport_elements) - VISIBLE_ELEMENT_THRESHOLD,
        interactive_count - INTERACTIVE_ELEMENT_THRESHOLD,
    )
    return make_issue(
        rule_id="VO-1",
        title="Visual Overload",
        base_penalty=REGULAR_BASE_PENALTY,
        description="Excessive visual stimuli divide attention and reduce focus.",
        suggestion="Reduce competing visible elements in the first viewport and group related content into clearer regions.",
        evidence={
            "visible_element_count": len(first_viewport_elements),
            "interactive_element_count": interactive_count,
            "overload_margin": overload_amount,
            "parser_focus_elements_count": parser.focus_elements_count,
            "threshold": {
                "maxVisibleElements": VISIBLE_ELEMENT_THRESHOLD,
                "maxInteractiveElements": INTERACTIVE_ELEMENT_THRESHOLD,
            },
        },
        locations=[tag_location(tag) for tag in first_viewport_elements[:8]],
    )


def is_interactive(tag: Tag) -> bool:
    return bool(
        tag.name in {"button", "select", "textarea"}
        or (tag.name == "a" and tag.get("href"))
        or tag.name == "input"
        or tag.get("role") in {"button", "link"}
    )
