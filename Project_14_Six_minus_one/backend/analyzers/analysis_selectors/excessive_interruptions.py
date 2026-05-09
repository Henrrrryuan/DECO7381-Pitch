from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup, Tag

from ...schemas import Issue
from . import interaction_helpers as interaction_rules


def detect_excessive_interruptions_selector(context: dict[str, Any]):
    return detect_excessive_interruptions(
        context["soup"],
        context["candidate_regions"],
        context["style_hints"],
        context["js_hints"],
    )


def detect_excessive_interruptions(
    soup: BeautifulSoup,
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
    js_hints: dict[str, Any],
) -> Issue | None:
    issues = interaction_rules.detect_id3_dynamic_interruptions(soup, candidate_regions, style_hints, js_hints)
    if not issues:
        return None
    issue = issues[0]
    issue.rule_id = "EI-1"
    issue.title = "Excessive Interruptions"
    issue.description = "Interruptions disrupt task continuity and increase cognitive load."
    issue.suggestion = "Avoid auto-opening overlays; provide a clear dismiss control and keep interruptions out of the primary task flow."
    return issue
