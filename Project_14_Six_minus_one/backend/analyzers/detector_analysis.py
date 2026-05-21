from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from ..schemas import DimensionResult
from .analysis_selectors import SELECTORS
from .analysis_selectors.interaction_helpers import extract_js_hints, extract_style_hints, get_candidate_regions
from .analysis_selectors.visual_parser import VisualHTMLParser


def analyze_detector_rules(
    html: str,
    *,
    css_sources: list[str] | None = None,
    js_sources: list[str] | None = None,
) -> list[DimensionResult]:
    soup = BeautifulSoup(html or "", "html.parser")
    visual_parser = VisualHTMLParser()
    visual_parser.feed(html or "")
    visual_parser.close()

    context: dict[str, Any] = {
        "html": html,
        "css_sources": css_sources or [],
        "js_sources": js_sources or [],
        "soup": soup,
        "visual_parser": visual_parser,
        "candidate_regions": get_candidate_regions(soup),
        "style_hints": extract_style_hints(soup),
        "js_hints": extract_js_hints(js_sources or []),
    }

    dimensions: list[DimensionResult] = []
    # Each selector returns at most one issue group for its detector dimension.
    for detector_name, rule_id, selector in SELECTORS:
        issue = selector(context)
        issues = [issue] if issue is not None else []
        total_penalty = sum(item.penalty for item in issues)
        dimensions.append(
            DimensionResult(
                dimension=detector_name,  # type: ignore[arg-type]
                issues=issues,
                metadata={
                    "detector": detector_name,
                    "selector_file": f"{detector_name.lower().replace(' ', '_').replace('-', '_')}.py",
                    "implemented_rules": [rule_id],
                    "total_penalty": total_penalty,
                },
            )
        )
    return dimensions


__all__ = ["analyze_detector_rules"]
