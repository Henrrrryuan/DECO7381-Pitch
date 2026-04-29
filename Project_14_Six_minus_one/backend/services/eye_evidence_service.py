from __future__ import annotations

from math import log
from typing import Any, Iterable

from ..scoring import clamp_score


def calculate_eye_evidence_for_sessions(
    sessions: Iterable[dict[str, Any]],
) -> dict[str, Any] | None:
    session_scores = [
        calculate_eye_evidence_for_session(session)
        for session in sessions
    ]
    session_scores = [score for score in session_scores if score is not None]
    if not session_scores:
        return None

    total_weight = sum(max(score["data_reliability_score"], 1) for score in session_scores)
    aggregate_score = sum(
        score["score"] * max(score["data_reliability_score"], 1)
        for score in session_scores
    ) / total_weight
    aggregate_reliability = sum(
        score["data_reliability_score"] * max(score["data_reliability_score"], 1)
        for score in session_scores
    ) / total_weight

    confidence = _confidence_label(aggregate_reliability)
    return {
        "score": clamp_score(aggregate_score),
        "confidence": confidence,
        "adjustment_weight": _adjustment_weight(confidence),
        "session_count": len(session_scores),
        "attention_focus_score": clamp_score(
            sum(score["attention_focus_score"] for score in session_scores) / len(session_scores)
        ),
        "task_efficiency_score": clamp_score(
            sum(score["task_efficiency_score"] for score in session_scores) / len(session_scores)
        ),
        "data_reliability_score": clamp_score(aggregate_reliability),
        "model": {
            "formula": (
                "Eye Evidence Score = 0.70 * Gaze Focus "
                "+ 0.30 * Task Efficiency"
            ),
            "lens_adjustment": (
                "Adjusted Lens Score = (1 - w) * Heuristic Lens Score "
                "+ w * Eye Evidence Score"
            ),
            "basis": (
                "Uses normalized gaze entropy, task duration, and sample adequacy "
                "as optional HCI usability evidence. Gaze focus and task duration "
                "form the behavioural score; sample adequacy controls the final "
                "adjustment weight so short or sparse sessions have limited impact."
            ),
        },
    }


def calculate_eye_evidence_for_session(session: dict[str, Any]) -> dict[str, Any] | None:
    sample_count = max(0, int(session.get("sample_count") or 0))
    duration_ms = max(0, int(session.get("duration_ms") or 0))
    cell_counts = _normalise_cell_counts(session.get("cell_counts"))
    if sample_count <= 0 or duration_ms <= 0 or not cell_counts:
        return None

    attention_focus_score = calculate_attention_focus_score(cell_counts)
    task_efficiency_score = calculate_task_efficiency_score(duration_ms)
    data_reliability_score = calculate_data_reliability_score(sample_count, duration_ms)
    score = (0.70 * attention_focus_score) + (0.30 * task_efficiency_score)

    return {
        "score": clamp_score(score),
        "attention_focus_score": attention_focus_score,
        "task_efficiency_score": task_efficiency_score,
        "data_reliability_score": data_reliability_score,
    }


def calculate_attention_focus_score(cell_counts: list[int]) -> int:
    total = sum(max(0, count) for count in cell_counts)
    active_counts = [max(0, count) for count in cell_counts if count > 0]
    if total <= 0 or not active_counts:
        return 0
    if len(active_counts) == 1:
        return 100

    entropy = -sum((count / total) * log(count / total) for count in active_counts)
    normalized_entropy = entropy / log(len(active_counts))
    return clamp_score(100 * (1 - normalized_entropy))


def calculate_task_efficiency_score(duration_ms: int) -> int:
    seconds = max(0.0, duration_ms / 1000)
    if seconds <= 0:
        return 0
    if seconds <= 30:
        return 90
    if seconds <= 90:
        return _linear_score(seconds, 30, 90, 90, 70)
    if seconds <= 180:
        return _linear_score(seconds, 90, 180, 70, 45)
    if seconds <= 300:
        return _linear_score(seconds, 180, 300, 45, 25)
    return 20


def calculate_data_reliability_score(sample_count: int, duration_ms: int) -> int:
    sample_score = min(100, (max(0, sample_count) / 600) * 100)
    duration_score = min(100, (max(0, duration_ms) / 20000) * 100)
    return clamp_score((0.65 * sample_score) + (0.35 * duration_score))


def _normalise_cell_counts(raw_counts: object) -> list[int]:
    if not isinstance(raw_counts, list):
        return []
    counts: list[int] = []
    for value in raw_counts:
        try:
            counts.append(max(0, int(value)))
        except (TypeError, ValueError):
            counts.append(0)
    return counts


def _linear_score(
    value: float,
    start: float,
    end: float,
    start_score: float,
    end_score: float,
) -> int:
    progress = min(1.0, max(0.0, (value - start) / (end - start)))
    return clamp_score(start_score + ((end_score - start_score) * progress))


def _confidence_label(reliability_score: float) -> str:
    if reliability_score >= 75:
        return "high"
    if reliability_score >= 45:
        return "moderate"
    return "low"


def _adjustment_weight(confidence: str) -> float:
    if confidence == "high":
        return 0.10
    if confidence == "moderate":
        return 0.06
    return 0.03
