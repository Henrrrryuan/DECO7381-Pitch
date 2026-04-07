from __future__ import annotations

from ..schemas import DimensionResult


def analyze_readability(html: str) -> DimensionResult:
    """Readability analyzer stub.

    Team member owning Readability should implement:
    - RD-1 average sentence length > 20
    - RD-2 paragraph > 4 sentences
    - RD-3 vague button text
    """

    return DimensionResult(
        dimension="Readability",
        score=100,
        issues=[],
        metadata={
            "implemented_rules": [],
            "pending_rules": ["RD-1", "RD-2", "RD-3"],
        },
    )
