from __future__ import annotations

from typing import Any

from .shared import REGULAR_BASE_PENALTY, make_issue, severity_from_count
from .visual_parser import VisualHTMLParser

CTA_COMPETING_THRESHOLD = 3


def detect_weak_information_prominence_selector(context: dict[str, Any]):
    return detect_weak_information_prominence(context["visual_parser"])


def detect_weak_information_prominence(parser: VisualHTMLParser):
    if parser.competing_action_count <= CTA_COMPETING_THRESHOLD:
        return None
    return make_issue(
        rule_id="WIP-1",
        title="Weak Information Prominence",
        severity=severity_from_count(parser.competing_action_count - CTA_COMPETING_THRESHOLD, major=2, critical=5),
        base_penalty=REGULAR_BASE_PENALTY,
        description="Users may struggle to identify the next important action.",
        suggestion="Make one primary call to action visually dominant and reduce nearby competing actions.",
        evidence={
            "competing_cta_count": parser.competing_action_count,
            "threshold": {"maxCompetingCtasNearby": CTA_COMPETING_THRESHOLD},
        },
        locations=parser.competing_action_locations[:8],
    )
