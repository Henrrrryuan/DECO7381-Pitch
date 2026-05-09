from __future__ import annotations

from typing import Iterable, Mapping

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
    "Dense Text Detection": 0.10,
    "Language Complexity": 0.10,
    "Sentence Complexity": 0.10,
    "Long Content Without Chunking": 0.10,
    "Poor Heading Structure": 0.10,
    "Navigation Complexity": 0.10,
    "Weak Information Prominence": 0.10,
    "Visual Overload": 0.10,
    "Auto-Moving Content": 0.10,
    "Excessive Interruptions": 0.10,
}

DIMENSION_PENALTY_CAPS: dict[str, int] = {
    "Dense Text Detection": 18,
    "Language Complexity": 18,
    "Sentence Complexity": 18,
    "Long Content Without Chunking": 18,
    "Poor Heading Structure": 18,
    "Navigation Complexity": 18,
    "Weak Information Prominence": 18,
    "Visual Overload": 18,
    "Auto-Moving Content": 18,
    "Excessive Interruptions": 18,
}

PROFILE_LENS_CONFIG: dict[str, dict[str, object]] = {
    "Reading Difficulties Lens": {
        "weights": {
            "Dense Text Detection": 0.25,
            "Language Complexity": 0.25,
            "Sentence Complexity": 0.25,
            "Long Content Without Chunking": 0.15,
            "Visual Overload": 0.10,
        },
        "summary": "Emphasises dense language and overload in the reading path, so reading-heavy pages can score lower here even when animation is limited.",
    },
    "Attention Regulation Lens": {
        "weights": {
            "Visual Overload": 0.20,
            "Weak Information Prominence": 0.15,
            "Auto-Moving Content": 0.30,
            "Excessive Interruptions": 0.25,
            "Navigation Complexity": 0.10,
        },
        "summary": "Emphasises interruption, distraction, and attention fragmentation across the page.",
    },
    "Autistic Support Lens": {
        "weights": {
            "Poor Heading Structure": 0.30,
            "Navigation Complexity": 0.25,
            "Auto-Moving Content": 0.20,
            "Excessive Interruptions": 0.15,
            "Visual Overload": 0.10,
        },
        "summary": "Emphasises predictability, sensory calm, and consistency, so text-heavy pages may score higher here than pages with unstable or distracting patterns.",
    },
}


def calculate_penalty(base_penalty: int, severity: Severity) -> int:
    return base_penalty * SEVERITY_MULTIPLIERS[severity]


def clamp_score(score: float) -> int:
    return max(0, min(100, round(score)))


def calculate_dimension_score(dimension_name: str, total_penalty: int) -> int:
    penalty_cap = DIMENSION_PENALTY_CAPS.get(dimension_name, 18)
    normalized_score = 100 * (1 - (total_penalty / penalty_cap))
    return clamp_score(normalized_score)


def resolve_dimension_score(dimensions: Iterable[DimensionResult], dimension_name: str) -> int:
    valid_names = {dimension_name}
    for dimension in dimensions:
        if dimension.dimension in valid_names:
            return dimension.score
    return 0


def calculate_weighted_average(dimensions: Iterable[DimensionResult]) -> int:
    weighted_total = 0.0
    for dimension in dimensions:
        weighted_total += dimension.score * DIMENSION_WEIGHTS.get(dimension.dimension, 0.0)
    return clamp_score(weighted_total)


def calculate_profile_scores(
    dimensions: list[DimensionResult],
    eye_evidence: Mapping[str, object] | None = None,
) -> list[AudienceLensScore]:
    profiles: list[AudienceLensScore] = []
    for name, config in PROFILE_LENS_CONFIG.items():
        weights = config["weights"]
        weighted_total = 0.0
        for dimension_name, weight in weights.items():
            weighted_total += resolve_dimension_score(dimensions, str(dimension_name)) * float(weight)
        profile_score = clamp_score(weighted_total)
        profiles.append(
            AudienceLensScore(
                name=name,
                score=apply_eye_evidence_adjustment(profile_score, eye_evidence),
                summary=str(config["summary"]),
            )
        )
    return profiles


def apply_eye_evidence_adjustment(
    heuristic_score: int,
    eye_evidence: Mapping[str, object] | None,
) -> int:
    if not eye_evidence:
        return heuristic_score

    try:
        eye_score = float(eye_evidence.get("score", heuristic_score))
        adjustment_weight = float(eye_evidence.get("adjustment_weight", 0))
    except (TypeError, ValueError):
        return heuristic_score

    if adjustment_weight <= 0:
        return heuristic_score

    bounded_weight = min(0.10, max(0.0, adjustment_weight))
    adjusted_score = ((1 - bounded_weight) * heuristic_score) + (bounded_weight * eye_score)
    return clamp_score(adjusted_score)


def calculate_overall_score(
    dimensions: list[DimensionResult],
    eye_evidence: Mapping[str, object] | None = None,
) -> AnalysisResult:
    weighted_average = calculate_weighted_average(dimensions)
    min_dimension_score = min((dimension.score for dimension in dimensions), default=0)
    overall_score = clamp_score((0.4 * min_dimension_score) + (0.6 * weighted_average))
    profile_scores = calculate_profile_scores(dimensions, eye_evidence=eye_evidence)

    return AnalysisResult(
        overall_score=overall_score,
        weighted_average=weighted_average,
        min_dimension_score=min_dimension_score,
        dimensions=dimensions,
        profile_scores=profile_scores,
    )
