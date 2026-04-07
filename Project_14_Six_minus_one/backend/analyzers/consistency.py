from __future__ import annotations

from ..schemas import DimensionResult


def analyze_consistency(html: str) -> DimensionResult:
    """Consistency analyzer stub.

    Team member owning Consistency should implement:
    - CS-1 heading hierarchy gaps
    - CS-2 missing breadcrumb/progress
    """

    return DimensionResult(
        dimension="Consistency",
        score=100,
        issues=[],
        metadata={
            "implemented_rules": [],
            "pending_rules": ["CS-1", "CS-2"],
        },
    )
