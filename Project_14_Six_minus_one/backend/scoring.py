from __future__ import annotations

from typing import Iterable

from .schemas import AnalysisResult, DimensionResult, Severity

SEVERITY_MULTIPLIERS: dict[Severity, int] = {
    "minor": 1,
    "major": 2,
    "critical": 3,
}

DIMENSION_WEIGHTS: dict[str, float] = {
    "Visual Complexity": 0.30,
    "Readability": 0.25,
    "Interaction & Distraction": 0.25,
    "Consistency": 0.20,
}


def calculate_penalty(base_penalty: int, severity: Severity) -> int:
    return base_penalty * SEVERITY_MULTIPLIERS[severity]


def clamp_score(score: float) -> int:
    return max(0, min(100, round(score)))


def calculate_dimension_score(total_penalty: int) -> int:
    return clamp_score(100 - total_penalty)


def calculate_weighted_average(dimensions: Iterable[DimensionResult]) -> int:
    weighted_total = 0.0
    for dimension in dimensions:
        weighted_total += dimension.score * DIMENSION_WEIGHTS[dimension.dimension]
    return clamp_score(weighted_total)


def calculate_overall_score(dimensions: list[DimensionResult]) -> AnalysisResult:
    weighted_average = calculate_weighted_average(dimensions)
    min_dimension_score = min((dimension.score for dimension in dimensions), default=0)
    overall_score = clamp_score((0.5 * min_dimension_score) + (0.5 * weighted_average))

    return AnalysisResult(
        overall_score=overall_score,
        weighted_average=weighted_average,
        min_dimension_score=min_dimension_score,
        dimensions=dimensions,
    )
