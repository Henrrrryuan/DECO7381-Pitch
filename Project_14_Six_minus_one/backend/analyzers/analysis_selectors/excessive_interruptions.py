from __future__ import annotations

import os
from typing import Any

from bs4 import BeautifulSoup, Tag

from ...schemas import Issue
from . import interaction_helpers as interaction_rules


def _ei_audit_enabled() -> bool:
    return os.environ.get("EI_AUDIT") == "1"


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
    if _ei_audit_enabled():
        print("[EI audit]", {
            "rule_id": "EI-1",
            "dimension_name": "Excessive Interruptions",
            "backend_modules": [
                "analysis_selectors/excessive_interruptions.py",
                "analysis_selectors/interaction_helpers.py (ID-3 pipeline)",
            ],
            "detection_strategy": "interaction-based heuristic (ID-3 dynamic interruptions), static HTML + style/js hints",
            "candidate_selectors": "soup.find_all(True) then looks_like_interruption_candidate(tag, style_hints)",
            "grouping_strategy": "single Issue (ID-3) with locations=top candidates[:5] + js interruption samples[:2]",
            "location_payload_shape": "snippet-based dicts: summary/html_snippet/interrupt_type/flags (no stable selector guaranteed)",
            "sanitize_behavior": "generic sanitize attempts to resolve selectors/text; may collapse/dedupe; audit via EI lineage logs",
        })
    issues = interaction_rules.detect_id3_dynamic_interruptions(soup, candidate_regions, style_hints, js_hints)
    if not issues:
        if _ei_audit_enabled():
            print("[EI lineage]", {
                "stage": "detector.none",
                "candidate_count": 0,
                "issue_count": 0,
                "location_count_before_sanitize": 0,
            })
        return None
    issue = issues[0]
    if _ei_audit_enabled():
        locs = list(getattr(issue, "locations", []) or [])
        print("[EI lineage]", {
            "stage": "detector.id3.selected",
            "candidate_count": int(issue.evidence.get("interrupting_element_count", 0)) if hasattr(issue, "evidence") and isinstance(issue.evidence, dict) else None,
            "issue_count": 1,
            "location_count_before_sanitize": len(locs),
            "caps": {"locations_cap": 5, "js_samples_cap": 2},
        })
    issue.rule_id = "EI-1"
    issue.title = "Excessive Interruptions"
    issue.description = "Static signs of initial-load interruptions can break task continuity and increase cognitive load."
    issue.suggestion = "Avoid initial dialogs, sticky prompts, overlays, and assertive notices that compete with the main task; this check does not simulate all focus or input-triggered changes."
    return issue
