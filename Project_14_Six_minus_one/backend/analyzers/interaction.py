from __future__ import annotations

from ..schemas import DimensionResult


def analyze_interaction(html: str) -> DimensionResult:
    """Interaction & Distraction analyzer stub.

    Team member owning Interaction should implement:
    - ID-1 autoplay media
    - ID-2 animated elements > 2
    - ID-3 CTA count > 2
    """

    return DimensionResult(
        dimension="Interaction & Distraction",
        score=100,
        issues=[],
        metadata={
            "implemented_rules": [],
            "pending_rules": ["ID-1", "ID-2", "ID-3"],
        },
    )
