from __future__ import annotations

from ..schemas import DimensionResult


def analyze_visual(html: str) -> DimensionResult:
    """Visual Complexity analyzer stub.

    Team member owning Visual should implement:
    - VC-1 first viewport elements > 12
    - VC-2 dense cards/items > 6
    - VC-3 too many sidebars/banners
    """

    return DimensionResult(
        dimension="Visual Complexity",
        score=100,
        issues=[],
        metadata={
            "implemented_rules": [],
            "pending_rules": ["VC-1", "VC-2", "VC-3"],
        },
    )
