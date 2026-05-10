from __future__ import annotations

from math import log
from typing import Any, Iterable

def clamp_score(score: float) -> int:
    return max(0, min(100, round(score)))

PRIMARY_ELEMENT_WEIGHTS = {
    "headings": 0.25,
    "interactive": 0.35,
    "main_text": 0.30,
    "media": 0.10,
}
RISK_SCORE_BY_LEVEL = {
    "low": 15,
    "medium": 45,
    "high": 85,
}
INTERACTIVE_LOW_SHARE = 0.08
INTERACTIVE_HIGH_CANDIDATE_SHARE = 0.03
INTERACTIVE_BORDERLINE_LOW = 0.025
INTERACTIVE_BORDERLINE_HIGH = 0.065
INTERACTIVE_LOW_FIRST_FIXATION_MS = 10_000
INTERACTIVE_HIGH_FIRST_FIXATION_MS = 18_000
INTERACTIVE_HIGH_DURATION_MS = 20_000
PRIMARY_ACTION_LOW_SHARE = 0.03
PRIMARY_ACTION_HIGH_SHARE = 0.015
ELEMENT_TYPE_ALIASES = {
    "heading": "headings",
    "headings": "headings",
    "interactive": "interactive",
    "interactive elements": "interactive",
    "button": "interactive",
    "link": "interactive",
    "main": "main_text",
    "main text": "main_text",
    "main_text": "main_text",
    "text": "main_text",
    "media": "media",
    "image": "media",
    "images": "media",
    "images/media": "media",
}


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

    session_count = len(session_scores)
    aggregate_risk = sum(
        score["overall_eye_evidence_risk"] for score in session_scores
    ) / session_count
    aggregate_reliability = sum(
        score["data_reliability_score"] for score in session_scores
    ) / session_count

    confidence = _confidence_label(aggregate_reliability)
    risk_level = _risk_level(aggregate_risk)
    return {
        # Risk and confidence are intentionally separate: reliability affects confidence,
        # not the Eye Evidence Risk Index itself.
        "overall_eye_evidence_risk": clamp_score(aggregate_risk),
        "risk_level": risk_level,
        "risk_label": f"{risk_level.title()} risk",
        "score": clamp_score(100 - aggregate_risk),
        "confidence": confidence,
        "evidence_confidence": confidence,
        "adjustment_weight": _adjustment_weight(confidence),
        "session_count": session_count,
        "element_hit_risk": clamp_score(
            sum(score["element_hit_risk"] for score in session_scores) / session_count
        ),
        "attention_distribution_risk": clamp_score(
            sum(score["attention_distribution_risk"] for score in session_scores) / session_count
        ),
        "task_duration_risk": clamp_score(
            sum(score["task_duration_risk"] for score in session_scores) / session_count
        ),
        "attention_distribution_label": _most_common_label(
            score["attention_distribution_label"] for score in session_scores
        ),
        "attention_distribution_reason": _most_common_label(
            score["attention_distribution_reason"] for score in session_scores
        ),
        "attention_focus_score": clamp_score(
            sum(score["attention_focus_score"] for score in session_scores) / session_count
        ),
        "task_efficiency_score": clamp_score(
            sum(score["task_efficiency_score"] for score in session_scores) / session_count
        ),
        "data_reliability_score": clamp_score(aggregate_reliability),
        "model": {
            "formula": (
                "Eye Evidence Risk Index = 0.85 * Element Hit Risk "
                "+ 0.10 * Attention Distribution Risk + 0.05 * Task Duration Risk"
            ),
            "lens_adjustment": (
                "Adjusted Lens Score = (1 - w) * Heuristic Lens Score "
                "+ w * Eye Evidence Compatibility Score"
            ),
            "basis": (
                "Uses element-level attention risks as the primary signal, with "
                "balanced distribution and task duration as weak auxiliary evidence. "
                "Missing element groups are marked not applicable and excluded from "
                "the weighted element risk. Sample adequacy controls confidence only."
            ),
        },
    }


def calculate_eye_evidence_for_session(session: dict[str, Any]) -> dict[str, Any] | None:
    sample_count = max(0, int(session.get("sample_count") or 0))
    duration_ms = max(0, int(session.get("duration_ms") or 0))
    cell_counts = _normalise_cell_counts(session.get("cell_counts"))
    if sample_count <= 0 or duration_ms <= 0 or not cell_counts:
        return None

    attention_distribution = calculate_attention_distribution_risk(cell_counts)
    element_risk = calculate_element_hit_risk(session.get("summary"), duration_ms=duration_ms)
    task_duration_risk = calculate_task_duration_risk(duration_ms)
    data_reliability_score = calculate_data_reliability_score(sample_count, duration_ms)
    raw_overall_risk = (
        (0.85 * element_risk["element_hit_risk"])
        + (0.10 * attention_distribution["risk_score"])
        + (0.05 * task_duration_risk)
    )
    gated_risk = _apply_risk_gates(raw_overall_risk, element_risk)

    return {
        "overall_eye_evidence_risk": gated_risk["risk_score"],
        "raw_eye_evidence_risk": clamp_score(raw_overall_risk),
        "risk_level": gated_risk["risk_level"],
        "risk_label": f"{gated_risk['risk_level'].title()} risk",
        "score": clamp_score(100 - gated_risk["risk_score"]),
        "element_hit_risk": element_risk["element_hit_risk"],
        "element_risks": element_risk["element_risks"],
        "risk_gate": gated_risk["gate"],
        "attention_distribution_risk": attention_distribution["risk_score"],
        "attention_distribution_label": attention_distribution["label"],
        "attention_distribution_reason": attention_distribution["reason"],
        "normalized_entropy": attention_distribution["normalized_entropy"],
        "task_duration_risk": task_duration_risk,
        "attention_focus_score": clamp_score(100 - attention_distribution["risk_score"]),
        "task_efficiency_score": clamp_score(100 - task_duration_risk),
        "data_reliability_score": data_reliability_score,
        "confidence": _confidence_label(data_reliability_score),
        "evidence_confidence": _confidence_label(data_reliability_score),
    }


def calculate_attention_focus_score(cell_counts: list[int]) -> int:
    """Compatibility score: higher means lower attention distribution risk."""
    return clamp_score(100 - calculate_attention_distribution_risk(cell_counts)["risk_score"])


def calculate_attention_distribution_risk(cell_counts: list[int]) -> dict[str, Any]:
    total = sum(max(0, count) for count in cell_counts)
    active_counts = [max(0, count) for count in cell_counts if count > 0]
    if total <= 0 or not active_counts:
        return {
            "risk_score": 85,
            "label": "insufficient_attention_data",
            "reason": "Attention distribution could not be assessed from the available gaze cells.",
            "normalized_entropy": None,
        }
    if len(active_counts) == 1:
        normalized_entropy = 0.0
    else:
        entropy = -sum((count / total) * log(count / total) for count in active_counts)
        normalized_entropy = entropy / log(len(active_counts))

    if normalized_entropy < 0.35:
        return {
            "risk_score": _linear_risk(normalized_entropy, 0.0, 0.35, 85, 40),
            "label": "over_focus",
            "reason": "Attention is concentrated in too few regions, so users may miss supporting structure or actions.",
            "normalized_entropy": round(normalized_entropy, 4),
        }
    if normalized_entropy <= 0.75:
        return {
            "risk_score": 25,
            "label": "balanced",
            "reason": "Attention distribution appears balanced across the page regions.",
            "normalized_entropy": round(normalized_entropy, 4),
        }
    return {
        "risk_score": _linear_risk(normalized_entropy, 0.75, 1.0, 40, 85),
        "label": "scattered_attention",
        "reason": "Attention is spread across many regions, which may make the task path harder to maintain.",
        "normalized_entropy": round(normalized_entropy, 4),
    }


def calculate_element_hit_risk(summary: object, duration_ms: int = 0) -> dict[str, Any]:
    items = _extract_attention_items(summary)
    availability = _extract_attention_group_availability(summary)
    by_group: dict[str, dict[str, Any]] = {}
    seen_groups: set[str] = set()
    for item in items:
        group = _normalise_element_group(item.get("key") or item.get("label"))
        if group not in PRIMARY_ELEMENT_WEIGHTS:
            continue
        seen_groups.add(group)
        hit_count = _safe_int(item.get("hit_count"), 0)
        group_available = _is_attention_group_available(availability, group, default=True) or bool(
            item.get("element_available")
        )
        if hit_count <= 0 and not group_available:
            continue
        risk_level = _resolve_element_risk_level(
            group,
            item,
            duration_ms=duration_ms,
            group_available=group_available,
        )
        risk_score = RISK_SCORE_BY_LEVEL[risk_level]
        current = by_group.get(group)
        if current is None or risk_score > current["risk_score"]:
            by_group[group] = _build_element_risk(group, item, risk_level)

    element_risks: dict[str, dict[str, Any]] = {}
    weighted_total = 0.0
    available_weight = 0.0
    for group, weight in PRIMARY_ELEMENT_WEIGHTS.items():
        group_available = _is_attention_group_available(
            availability,
            group,
            default=group in seen_groups,
        )
        resolved = by_group.get(group)
        if resolved is None and group_available:
            item = {
                "key": group,
                "label": _element_label(group),
                "hit_count": 0,
                "exact_hit_count": 0,
                "near_hit_count": 0,
                "weighted_hit_score": 0,
                "weighted_share": 0,
                "first_fixation_ms": None,
                "element_available": True,
            }
            risk_level = _resolve_element_risk_level(
                group,
                item,
                duration_ms=duration_ms,
                group_available=True,
            )
            resolved = _build_element_risk(group, item, risk_level)
        if resolved is None:
            resolved = {
                "element_type": group,
                "label": _element_label(group),
                "risk_level": "unknown",
                "risk_label": "Not applicable",
                "risk_score": None,
                "risk_reason": "No element-level evidence was recorded for this group.",
                "missing": True,
                "status": "not_applicable",
            }
        element_risks[group] = resolved
        if not resolved.get("missing"):
            weighted_total += float(resolved["risk_score"]) * weight
            available_weight += weight

    return {
        "element_hit_risk": clamp_score(weighted_total / available_weight)
        if available_weight > 0
        else 0,
        "element_risks": element_risks,
        "available_element_weight": round(available_weight, 4),
    }


def calculate_task_efficiency_score(duration_ms: int) -> int:
    """Compatibility score: higher means lower task duration risk."""
    return clamp_score(100 - calculate_task_duration_risk(duration_ms))


def calculate_task_duration_risk(duration_ms: int) -> int:
    seconds = max(0.0, duration_ms / 1000)
    if seconds <= 0:
        return 85
    if seconds <= 30:
        return 20
    if seconds <= 90:
        return _linear_risk(seconds, 30, 90, 20, 35)
    if seconds <= 180:
        return _linear_risk(seconds, 90, 180, 35, 55)
    if seconds <= 300:
        return _linear_risk(seconds, 180, 300, 55, 75)
    return 85


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


def _extract_attention_items(summary: object) -> list[dict[str, Any]]:
    if not isinstance(summary, dict):
        return []
    items = summary.get("attention_summary")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _extract_attention_group_availability(summary: object) -> dict[str, bool] | None:
    if not isinstance(summary, dict):
        return None
    raw = summary.get("attention_group_availability")
    if not isinstance(raw, dict):
        return None
    availability: dict[str, bool] = {}
    for key, value in raw.items():
        group = _normalise_element_group(key)
        if group not in PRIMARY_ELEMENT_WEIGHTS:
            continue
        if isinstance(value, dict):
            availability[group] = bool(value.get("available"))
        else:
            availability[group] = bool(value)
    return availability


def _is_attention_group_available(
    availability: dict[str, bool] | None,
    group: str,
    *,
    default: bool,
) -> bool:
    if availability is None:
        return default
    return bool(availability.get(group, False))


def _normalise_element_group(value: object) -> str:
    key = str(value or "").strip().lower()
    return ELEMENT_TYPE_ALIASES.get(key, key)


def _build_element_risk(
    group: str,
    item: dict[str, Any],
    risk_level: str,
) -> dict[str, Any]:
    weighted_share = _attention_share(item)
    return {
        "element_type": group,
        "label": _element_label(group),
        "risk_level": risk_level,
        "risk_label": f"{risk_level.title()} risk",
        "risk_score": RISK_SCORE_BY_LEVEL[risk_level],
        "risk_reason": str(item.get("risk_reason") or _element_risk_reason(group, risk_level)),
        "missing": False,
        "hit_count": _safe_int(item.get("hit_count"), 0),
        "exact_hit_count": _safe_int(item.get("exact_hit_count"), 0),
        "near_hit_count": _safe_int(item.get("near_hit_count"), 0),
        "weighted_hit_score": round(_safe_float(item.get("weighted_hit_score"), 0.0), 2),
        "weighted_share": round(max(0.0, min(1.0, weighted_share)), 4),
        "first_fixation_ms": _safe_optional_int(item.get("first_fixation_ms")),
    }


def _resolve_element_risk_level(
    group: str,
    item: dict[str, Any],
    *,
    duration_ms: int = 0,
    group_available: bool = True,
) -> str:
    raw_level = str(item.get("risk_level") or "").strip().lower()
    has_share_signal = item.get("weighted_share") is not None or item.get("share") is not None
    if group != "interactive" and raw_level in RISK_SCORE_BY_LEVEL:
        return raw_level
    if group == "interactive" and raw_level in RISK_SCORE_BY_LEVEL and not has_share_signal:
        return raw_level
    share = _attention_share(item)
    if group == "headings":
        if share < 0.05:
            return "high"
        if share < 0.10 or share > 0.25:
            return "medium"
        return "low"
    if group == "interactive":
        return _resolve_interactive_risk_level(
            item,
            share=share,
            duration_ms=duration_ms,
            clear_interactive_elements_exist=group_available,
        )
    if group == "main_text":
        if share < 0.20:
            return "high"
        if share < 0.35 or share > 0.65:
            return "medium"
        return "low"
    if group == "media":
        if share > 0.25:
            return "high"
        if share > 0.10:
            return "medium"
        return "low"
    return "medium"


def _resolve_interactive_risk_level(
    item: dict[str, Any],
    *,
    share: float,
    duration_ms: int,
    clear_interactive_elements_exist: bool,
) -> str:
    if not clear_interactive_elements_exist:
        return "low"

    first_fixation_ms = _safe_optional_int(item.get("first_fixation_ms"))
    primary_action_share = _safe_optional_float(item.get("primary_action_share"))
    exact_hits = _safe_int(item.get("exact_hit_count"), 0)
    near_hits = _safe_int(item.get("near_hit_count"), 0)
    has_primary_action_hits = _safe_int(item.get("primary_action_exact_hit_count"), 0) + _safe_int(
        item.get("primary_action_near_hit_count"),
        0,
    )

    if (
        share >= INTERACTIVE_LOW_SHARE
        or (primary_action_share is not None and primary_action_share >= PRIMARY_ACTION_LOW_SHARE)
        or (first_fixation_ms is not None and first_fixation_ms <= INTERACTIVE_LOW_FIRST_FIXATION_MS)
    ):
        return "low"

    is_high_candidate = share < INTERACTIVE_HIGH_CANDIDATE_SHARE
    delayed_or_missing_attention = (
        first_fixation_ms is None
        or first_fixation_ms > INTERACTIVE_HIGH_FIRST_FIXATION_MS
        or (primary_action_share is not None and primary_action_share < PRIMARY_ACTION_HIGH_SHARE)
        or (has_primary_action_hits <= 0 and exact_hits + near_hits <= 0)
    )
    if (
        is_high_candidate
        and duration_ms > INTERACTIVE_HIGH_DURATION_MS
        and clear_interactive_elements_exist
        and delayed_or_missing_attention
    ):
        return "high"

    if INTERACTIVE_BORDERLINE_LOW <= share <= INTERACTIVE_BORDERLINE_HIGH:
        return "medium"
    if INTERACTIVE_HIGH_CANDIDATE_SHARE <= share < INTERACTIVE_LOW_SHARE:
        return "medium"
    if (
        first_fixation_ms is not None
        and INTERACTIVE_LOW_FIRST_FIXATION_MS < first_fixation_ms <= INTERACTIVE_HIGH_FIRST_FIXATION_MS
    ):
        return "medium"
    if is_high_candidate:
        return "medium"
    return "low"


def _element_label(group: str) -> str:
    return {
        "headings": "Headings",
        "interactive": "Interactive elements",
        "main_text": "Main text",
        "media": "Images/media",
    }.get(group, "Other")


def _element_risk_reason(group: str, risk_level: str) -> str:
    reasons = {
        "headings": {
            "high": "Users may not notice the page structure clearly.",
            "medium": "The page structure may not be immediately clear to users.",
            "low": "Users appear to notice the page structure appropriately.",
        },
        "interactive": {
            "high": "Users may struggle to find the next action.",
            "medium": "Key actions may need stronger visual cues.",
            "low": "Interactive elements appear to receive appropriate attention.",
        },
        "main_text": {
            "high": "Users may not process the core content effectively.",
            "medium": "Users may either miss key content or spend too much effort reading.",
            "low": "Users appear to process the main content within a balanced attention range.",
        },
        "media": {
            "high": "Media may be drawing attention away from the main task.",
            "medium": "Media may be attracting attention but not necessarily supporting the task.",
            "low": "Media does not appear to create a major attention risk.",
        },
    }
    return reasons.get(group, {}).get(
        risk_level,
        "Attention pattern needs checking against the page's intended user journey.",
    )


def _safe_int(value: object, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _attention_share(item: dict[str, Any]) -> float:
    value = item.get("weighted_share")
    if value is None or value == "":
        value = item.get("share")
    return max(0.0, min(1.0, _safe_float(value, 0.0)))


def _safe_optional_int(value: object) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: object, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_optional_float(value: object) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _risk_level(score: float) -> str:
    if score >= 75:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


def _apply_risk_gates(
    raw_score: float,
    element_risk: dict[str, Any],
) -> dict[str, Any]:
    element_risks = element_risk.get("element_risks")
    if not isinstance(element_risks, dict):
        element_risks = {}

    available = {
        str(key): value
        for key, value in element_risks.items()
        if isinstance(value, dict) and not value.get("missing")
    }
    high_count = sum(1 for item in available.values() if item.get("risk_level") == "high")
    medium_count = sum(1 for item in available.values() if item.get("risk_level") == "medium")
    element_hit_risk = float(element_risk.get("element_hit_risk") or 0)

    interactive_high = available.get("interactive", {}).get("risk_level") == "high"
    interactive_medium = available.get("interactive", {}).get("risk_level") == "medium"
    structure_or_content_medium = available.get("headings", {}).get("risk_level") == "medium" or available.get(
        "main_text",
        {},
    ).get("risk_level") == "medium"
    another_concern_with_interactive = any(
        key != "interactive" and value.get("risk_level") in {"medium", "high"}
        for key, value in available.items()
    )

    medium_supported = (
        medium_count >= 2
        or high_count >= 1
        or (interactive_medium and structure_or_content_medium)
        or element_hit_risk >= 50
    )
    high_supported = (
        high_count >= 2
        or (interactive_high and another_concern_with_interactive)
        or element_hit_risk >= 75
    )

    if high_count == 0 and medium_count < 2:
        medium_supported = False
    if not (
        high_count >= 2
        or (interactive_high and another_concern_with_interactive)
        or element_hit_risk >= 75
    ):
        high_supported = False

    if raw_score >= 75 and high_supported:
        risk_score = raw_score
        gate = "high_supported"
    elif medium_supported:
        risk_score = min(74, max(50, raw_score))
        gate = "medium_supported"
    else:
        risk_score = min(49, raw_score)
        gate = "low_gate"

    risk_score = clamp_score(risk_score)
    return {
        "risk_score": risk_score,
        "risk_level": _risk_level(risk_score),
        "gate": {
            "status": gate,
            "high_driver_count": high_count,
            "medium_driver_count": medium_count,
            "medium_supported": medium_supported,
            "high_supported": high_supported,
        },
    }


def _most_common_label(values: Iterable[object]) -> str:
    counts: dict[str, int] = {}
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        counts[text] = counts.get(text, 0) + 1
    if not counts:
        return ""
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _linear_score(
    value: float,
    start: float,
    end: float,
    start_score: float,
    end_score: float,
) -> int:
    progress = min(1.0, max(0.0, (value - start) / (end - start)))
    return clamp_score(start_score + ((end_score - start_score) * progress))


def _linear_risk(
    value: float,
    start: float,
    end: float,
    start_score: float,
    end_score: float,
) -> int:
    return _linear_score(value, start, end, start_score, end_score)


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
