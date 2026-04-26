from __future__ import annotations

from typing import Iterable

from .schemas import AnalysisResult, AudienceLensScore, DimensionResult, Severity

SEVERITY_MULTIPLIERS: dict[Severity, int] = {
    "minor": 1,
    "major": 2,
    "critical": 3,
}

SCORING_FORMULA_TEXT = (
    "Dimension Score = max(0, round(100 * (1 - Raw Penalty Sum / Dimension Penalty Cap)))"
)
PENALTY_FORMULA_TEXT = "Penalty = Base Penalty * Severity"

DIMENSION_WEIGHTS: dict[str, float] = {
    "Information Overload": 0.30,
    "Visual Complexity": 0.30,
    "Readability": 0.25,
    "Interaction & Distraction": 0.25,
    "Consistency": 0.20,
}

DIMENSION_PENALTY_CAPS: dict[str, int] = {
    "Information Overload": 57,
    "Visual Complexity": 57,
    "Readability": 54,
    "Interaction & Distraction": 30,
    "Consistency": 54,
}

PROFILE_LENS_CONFIG: dict[str, dict[str, object]] = {
    "Reading Difficulties Lens": {
        "weights": {
            "Information Overload": 0.35,
            "Readability": 0.40,
            "Interaction & Distraction": 0.10,
            "Consistency": 0.15,
        },
        "summary": "Emphasises dense language and overload in the reading path, so reading-heavy pages can score lower here even when animation is limited.",
    },
    "Attention Regulation Lens": {
        "weights": {
            "Information Overload": 0.35,
            "Readability": 0.10,
            "Interaction & Distraction": 0.35,
            "Consistency": 0.20,
        },
        "summary": "Emphasises interruption, distraction, and attention fragmentation across the page.",
    },
    "Autistic Support Lens": {
        "weights": {
            "Information Overload": 0.20,
            "Readability": 0.10,
            "Interaction & Distraction": 0.25,
            "Consistency": 0.45,
        },
        "summary": "Emphasises predictability, sensory calm, and consistency, so text-heavy pages may score higher here than pages with unstable or distracting patterns.",
    },
}


def calculate_penalty(base_penalty: int, severity: Severity) -> int:
    return base_penalty * SEVERITY_MULTIPLIERS[severity]


def clamp_score(score: float) -> int:
    return max(0, min(100, round(score)))


def calculate_dimension_score(dimension_name: str, total_penalty: int) -> int:
    penalty_cap = DIMENSION_PENALTY_CAPS[dimension_name]
    normalized_score = 100 * (1 - (total_penalty / penalty_cap))
    return clamp_score(normalized_score)


def resolve_dimension_score(dimensions: Iterable[DimensionResult], dimension_name: str) -> int:
    aliases = {
        "Information Overload": {"Information Overload", "Visual Complexity"},
        "Visual Complexity": {"Visual Complexity", "Information Overload"},
    }
    valid_names = aliases.get(dimension_name, {dimension_name})
    for dimension in dimensions:
        if dimension.dimension in valid_names:
            return dimension.score
    return 0


def calculate_weighted_average(dimensions: Iterable[DimensionResult]) -> int:
    weighted_total = 0.0
    for dimension in dimensions:
        weighted_total += dimension.score * DIMENSION_WEIGHTS[dimension.dimension]
    return clamp_score(weighted_total)


def calculate_profile_scores(dimensions: list[DimensionResult]) -> list[AudienceLensScore]:
    profiles: list[AudienceLensScore] = []
    for name, config in PROFILE_LENS_CONFIG.items():
        weights = config["weights"]
        weighted_total = 0.0
        for dimension_name, weight in weights.items():
            weighted_total += resolve_dimension_score(dimensions, str(dimension_name)) * float(weight)
        profiles.append(
            AudienceLensScore(
                name=name,
                score=clamp_score(weighted_total),
                summary=str(config["summary"]),
            )
        )
    return profiles


def calculate_overall_score(dimensions: list[DimensionResult]) -> AnalysisResult:
    weighted_average = calculate_weighted_average(dimensions)
    min_dimension_score = min((dimension.score for dimension in dimensions), default=0)
    overall_score = clamp_score((0.4 * min_dimension_score) + (0.6 * weighted_average))
    profile_scores = calculate_profile_scores(dimensions)

    return AnalysisResult(
        overall_score=overall_score,
        weighted_average=weighted_average,
        min_dimension_score=min_dimension_score,
        dimensions=dimensions,
        profile_scores=profile_scores,
    )
