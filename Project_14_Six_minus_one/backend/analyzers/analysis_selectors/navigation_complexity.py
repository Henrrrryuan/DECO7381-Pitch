from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from .shared import REGULAR_BASE_PENALTY, make_issue, severity_from_count, tag_location

NAV_LINK_THRESHOLD = 12
NAV_NESTING_THRESHOLD = 2


def detect_navigation_complexity_selector(context: dict[str, Any]):
    return detect_navigation_complexity(context["soup"])


def detect_navigation_complexity(soup: BeautifulSoup):
    nav_violations: list[dict[str, Any]] = []
    for nav in soup.find_all("nav"):
        links = nav.find_all("a", href=True)
        nesting_depth = max_list_depth(nav)
        if len(links) > NAV_LINK_THRESHOLD or nesting_depth > NAV_NESTING_THRESHOLD:
            nav_violations.append(tag_location(nav, nav_link_count=len(links), nesting_depth=nesting_depth))
    if not nav_violations:
        return None
    return make_issue(
        rule_id="NC-1",
        title="Navigation Complexity",
        severity=severity_from_count(len(nav_violations), major=1, critical=3),
        base_penalty=REGULAR_BASE_PENALTY,
        description="Complex navigation increases orientation difficulty and decision load.",
        suggestion="Reduce top-level navigation choices and flatten deeply nested menus.",
        evidence={
            "complex_nav_count": len(nav_violations),
            "max_nav_links": max(item["nav_link_count"] for item in nav_violations),
            "max_nesting_depth": max(item["nesting_depth"] for item in nav_violations),
            "threshold": {"maxNavLinks": NAV_LINK_THRESHOLD, "maxNestingDepth": NAV_NESTING_THRESHOLD},
        },
        locations=nav_violations[:8],
    )


def max_list_depth(tag: Tag) -> int:
    def depth(node: Tag, current: int) -> int:
        child_depths = [
            depth(child, current + 1)
            for child in node.find_all(["ul", "ol"], recursive=False)
            if isinstance(child, Tag)
        ]
        li_depths = [
            depth(child, current)
            for child in node.find_all("li", recursive=False)
            if isinstance(child, Tag)
        ]
        return max([current, *child_depths, *li_depths])

    return depth(tag, 0)
