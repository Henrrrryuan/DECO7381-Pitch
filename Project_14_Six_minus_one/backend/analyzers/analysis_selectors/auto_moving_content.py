from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from ...schemas import Issue
from . import interaction_helpers as interaction_rules


def detect_auto_moving_content_selector(context: dict[str, Any]):
    return detect_auto_moving_content(
        context["soup"],
        context["candidate_regions"],
        context["style_hints"],
        context["js_hints"],
    )


def detect_auto_moving_content(
    soup: BeautifulSoup,
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
    js_hints: dict[str, Any],
) -> Issue | None:
    issues = (
        interaction_rules.detect_id1_autoplay_media(soup, js_hints)
        + interaction_rules.detect_id2_too_many_animated_elements(candidate_regions, style_hints, js_hints)
    )
    if not issues:
        return None
    issue = max(issues, key=lambda item: (item.penalty, item.rule_id))
    issue.rule_id = "AMC-1"
    issue.title = "Auto-Moving Content"
    issue.description = "Automatic movement interrupts concentration and distracts users."
    issue.suggestion = "Disable autoplay and infinite animation unless movement is user initiated and essential."
    return issue
