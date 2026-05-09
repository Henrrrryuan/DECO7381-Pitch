from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Severity = Literal["minor", "major", "critical"]
IssueCategory = Literal["content", "structure", "motion", "forms"]
DimensionName = Literal[
    "Dense Text Detection",
    "Language Complexity",
    "Sentence Complexity",
    "Long Content Without Chunking",
    "Poor Heading Structure",
    "Navigation Complexity",
    "Weak Information Prominence",
    "Visual Overload",
    "Auto-Moving Content",
    "Excessive Interruptions",
]

ISSUE_CATEGORY_LABELS = {
    "content": "Content Issues",
    "structure": "Structure Issues",
    "motion": "Motion Issues",
    "forms": "Forms Issues",
}

DIMENSION_ISSUE_CATEGORY_KEYS = {
    "Dense Text Detection": "content",
    "Language Complexity": "content",
    "Sentence Complexity": "content",
    "Long Content Without Chunking": "content",
    "Poor Heading Structure": "structure",
    "Navigation Complexity": "structure",
    "Weak Information Prominence": "structure",
    "Visual Overload": "structure",
    "Auto-Moving Content": "motion",
    "Excessive Interruptions": "motion",
}

COGNITIVE_DIMENSION_LABELS = {
    "Dense Text Detection": "Reading Load / Working Memory",
    "Language Complexity": "Comprehension Speed",
    "Sentence Complexity": "Comprehension Burden",
    "Long Content Without Chunking": "Scanning / Memory Support",
    "Poor Heading Structure": "Orientation / Page Understanding",
    "Navigation Complexity": "Wayfinding / Decision Load",
    "Weak Information Prominence": "Task Discovery",
    "Visual Overload": "Attention / Focus",
    "Auto-Moving Content": "Attention Regulation",
    "Excessive Interruptions": "Task Continuity",
}

FINAL_CATEGORY_BY_RULE_PREFIX = {
    "DT": "content",
    "LC": "content",
    "SC": "content",
    "LCC": "content",
    "PHS": "structure",
    "NC": "structure",
    "WIP": "structure",
    "VO": "structure",
    "AMC": "motion",
    "EI": "motion",
}

DETECTOR_BY_RULE_ID = {
    "DT-1": "Dense Text Detection",
    "LC-1": "Language Complexity",
    "SC-1": "Sentence Complexity",
    "LCC-1": "Long Content Without Chunking",
    "PHS-1": "Poor Heading Structure",
    "NC-1": "Navigation Complexity",
    "WIP-1": "Weak Information Prominence",
    "VO-1": "Visual Overload",
    "AMC-1": "Auto-Moving Content",
    "EI-1": "Excessive Interruptions",
}

COGA_PATTERNS_BY_RULE_PREFIX = {
    "DT": ["Clear Language", "Chunking"],
    "LC": ["Use Clear Words"],
    "SC": ["Avoid Nested Clauses"],
    "LCC": ["Provide Summaries", "Separate Content"],
    "PHS": ["Clear Navigation", "Structure"],
    "NC": ["Findable", "Clear Navigation"],
    "WIP": ["Make Important Tasks Easy to Find"],
    "VO": ["Avoid Too Much Content"],
    "AMC": ["Limit Interruptions"],
    "EI": ["Limit Interruptions"],
}

ISO_PRINCIPLES_BY_RULE_PREFIX = {
    "DT": ["Efficiency", "Satisfaction"],
    "LC": ["Efficiency"],
    "SC": ["Efficiency"],
    "LCC": ["Efficiency", "Satisfaction"],
    "PHS": ["Effectiveness"],
    "NC": ["Effectiveness"],
    "WIP": ["Effectiveness"],
    "VO": ["Efficiency", "Satisfaction"],
    "AMC": ["Satisfaction"],
    "EI": ["Satisfaction"],
}

THRESHOLD_BY_RULE_ID: dict[str, dict[str, int | float]] = {
    "DT-1": {"maxWords": 120, "maxSentences": 4},
    "LC-1": {"maxComplexWordRatio": 0.15},
    "SC-1": {"maxSentenceWords": 25, "maxCommas": 3, "maxConjunctions": 3},
    "LCC-1": {"maxSectionWordsWithoutChunking": 300, "maxArticleWordsWithoutChunking": 600},
    "PHS-1": {"maxSkippedHeadingLevels": 1},
    "NC-1": {"maxNavLinks": 12, "maxNestingDepth": 2},
    "WIP-1": {"maxCompetingCtasNearby": 3},
    "VO-1": {"maxVisibleElements": 20, "maxInteractiveElements": 8},
    "AMC-1": {"maxAutoplayElements": 0, "maxInfiniteAnimations": 0},
    "EI-1": {"maxOverlayViewportShare": 0.2},
}


def issue_category_key_for_rule(rule_id: str) -> str:
    prefix = str(rule_id or "").split("-")[0]
    return FINAL_CATEGORY_BY_RULE_PREFIX.get(prefix, "structure")


def issue_category_key_for_dimension(dimension: str) -> str:
    return DIMENSION_ISSUE_CATEGORY_KEYS.get(dimension, "structure")


def issue_category_label(category_key: str) -> str:
    return ISSUE_CATEGORY_LABELS.get(category_key, "Structure Issues")


def issue_category_label_for_dimension(dimension: str) -> str:
    return issue_category_label(issue_category_key_for_dimension(dimension))


def final_category_for_rule(rule_id: str) -> IssueCategory:
    prefix = str(rule_id or "").split("-")[0]
    return FINAL_CATEGORY_BY_RULE_PREFIX.get(prefix, "structure")  # type: ignore[return-value]


def detector_name_for_rule(rule_id: str, fallback_title: str) -> str:
    return DETECTOR_BY_RULE_ID.get(rule_id, fallback_title or "Cognitive Accessibility Detector")


def standards_for_rule(rule_id: str) -> dict[str, list[str]]:
    prefix = str(rule_id or "").split("-")[0]
    return {
        "cogaPatterns": COGA_PATTERNS_BY_RULE_PREFIX.get(prefix, ["Cognitive Accessibility"]),
        "isoPrinciples": ISO_PRINCIPLES_BY_RULE_PREFIX.get(prefix, ["Effectiveness"]),
    }


def issue_id_for_rule(rule_id: str) -> str:
    safe = str(rule_id or "issue").lower().replace("-", "_")
    return f"issue_{safe}"


@dataclass
class Issue:
    rule_id: str
    title: str
    severity: Severity
    base_penalty: int
    penalty: int
    description: str
    suggestion: str
    evidence: dict[str, Any] = field(default_factory=dict)
    locations: list[dict[str, Any]] = field(default_factory=list)

    def to_issue_object(self) -> dict[str, Any]:
        locations = self.locations if isinstance(self.locations, list) else []
        first_location = locations[0] if locations and isinstance(locations[0], dict) else {}
        metrics = self.evidence if isinstance(self.evidence, dict) else {}
        recommendations = [self.suggestion] if self.suggestion else []
        detector = detector_name_for_rule(self.rule_id, self.title)
        final_category = final_category_for_rule(self.rule_id)

        return {
            "id": issue_id_for_rule(self.rule_id),
            "detector": detector,
            "rule": {
                "id": self.rule_id,
                "name": self.title,
            },
            "category": final_category,
            "target": {
                "selector": str(first_location.get("selector") or ""),
                "elementType": str(first_location.get("tag") or ""),
                "textSnippet": str(first_location.get("preview") or first_location.get("label") or "")[:220],
                "boundingBox": first_location.get("boundingBox"),
            },
            "metrics": metrics,
            "threshold": THRESHOLD_BY_RULE_ID.get(self.rule_id, {}),
            "evidence": detected_evidence_text(metrics, first_location),
            "explanation": self.description,
            "recommendations": recommendations,
            "standards": standards_for_rule(self.rule_id),
            "highlight": {
                "strategy": "outline",
                "color": "#f59e0b" if final_category == "content" else "#3b82f6",
            },
        }

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        category_key = issue_category_key_for_rule(self.rule_id)
        category_label = issue_category_label(category_key)
        issue_object = self.to_issue_object()

        payload["id"] = issue_object["id"]
        payload["detector"] = issue_object["detector"]
        payload["rule"] = issue_object["rule"]
        payload["category"] = issue_object["category"]
        payload["target"] = issue_object["target"]
        payload["metrics"] = issue_object["metrics"]
        payload["threshold"] = issue_object["threshold"]
        payload["evidence_text"] = issue_object["evidence"]
        payload["explanation"] = issue_object["explanation"]
        payload["recommendations"] = issue_object["recommendations"]
        payload["standards"] = issue_object["standards"]
        payload["highlight"] = issue_object["highlight"]
        payload["issue_object"] = issue_object
        payload["issue_category_key"] = category_key
        payload["issue_category_label"] = category_label
        payload["issue_category"] = {
            "key": category_key,
            "label": category_label,
        }
        return payload


def detected_evidence_text(metrics: dict[str, Any], location: dict[str, Any]) -> str:
    readable_pairs = []
    for key, value in metrics.items():
        if isinstance(value, (str, int, float, bool)):
            readable_pairs.append(f"{key}: {value}")
    if readable_pairs:
        return "; ".join(readable_pairs[:4])
    if location.get("selector"):
        return f"Element matched selector {location['selector']}."
    return "Detector evidence is available in the metrics object."


@dataclass
class DimensionResult:
    dimension: DimensionName
    score: int
    issues: list[Issue] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        category_key = issue_category_key_for_dimension(self.dimension)
        category_label = issue_category_label(category_key)
        return {
            "dimension": self.dimension,
            "display_name": category_label,
            "label": category_label,
            "issue_category_key": category_key,
            "issue_category_label": category_label,
            "issue_category": {
                "key": category_key,
                "label": category_label,
            },
            "cognitive_dimension": COGNITIVE_DIMENSION_LABELS.get(
                self.dimension,
                "Cognitive Accessibility",
            ),
            "score": self.score,
            "issues": [issue.to_dict() for issue in self.issues],
            "metadata": self.metadata,
        }


@dataclass
class AudienceLensScore:
    name: str
    score: int
    summary: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AnalysisResult:
    overall_score: int
    weighted_average: int
    min_dimension_score: int
    dimensions: list[DimensionResult]
    profile_scores: list[AudienceLensScore] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "weighted_average": self.weighted_average,
            "min_dimension_score": self.min_dimension_score,
            "dimensions": [dimension.to_dict() for dimension in self.dimensions],
            "profile_scores": [profile.to_dict() for profile in self.profile_scores],
        }


@dataclass
class EyeTrackingSummaryForHistory:
    """Lightweight behavioral-evidence summary for history list.

    Eye evidence risk describes possible cognitive-accessibility friction.
    Confidence describes gaze-data reliability and must not change the risk index.
    """

    available: bool = False
    coverage_percent: float | None = None
    sample_count: int | None = None
    duration_ms: int | None = None
    attention_summary: list[dict[str, Any]] = field(default_factory=list)
    eye_evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        if not self.available:
            return {"available": False}
        return {
            "available": True,
            "coverage_percent": float(self.coverage_percent)
            if self.coverage_percent is not None
            else None,
            "sample_count": int(self.sample_count) if self.sample_count is not None else None,
            "duration_ms": int(self.duration_ms) if self.duration_ms is not None else None,
            "attention_summary": self.attention_summary,
            "eye_evidence": self.eye_evidence,
        }


@dataclass
class HistoryRunSummary:
    run_id: str
    created_at: str
    source_name: str
    overall_score: int
    weighted_average: int
    min_dimension_score: int
    eye_tracking_summary: EyeTrackingSummaryForHistory = field(
        default_factory=lambda: EyeTrackingSummaryForHistory(available=False),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "created_at": self.created_at,
            "source_name": self.source_name,
            "overall_score": self.overall_score,
            "weighted_average": self.weighted_average,
            "min_dimension_score": self.min_dimension_score,
            "eye_tracking_summary": self.eye_tracking_summary.to_dict(),
        }


@dataclass
class HistoryRunDetail:
    run: HistoryRunSummary
    html_content: str
    analysis: AnalysisResult

    def to_dict(self) -> dict[str, Any]:
        return {
            "run": self.run.to_dict(),
            "html_content": self.html_content,
            "analysis": self.analysis.to_dict(),
        }


@dataclass
class HistoryListResponse:
    items: list[HistoryRunSummary]
    total: int = 0
    limit: int = 10
    offset: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "items": [item.to_dict() for item in self.items],
            "total": self.total,
            "limit": self.limit,
            "offset": self.offset,
        }


@dataclass
class EyeTrackingSessionSummary:
    session_id: str
    run_id: str | None
    created_at: str
    source_name: str
    target_url: str
    sample_count: int
    duration_ms: int
    coverage_percent: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class EyeTrackingSessionDetail:
    session: EyeTrackingSessionSummary
    html_snapshot: str
    grid_cols: int
    grid_rows: int
    cell_counts: list[int]
    summary: dict[str, Any] = field(default_factory=dict)
    eye_evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session": self.session.to_dict(),
            "html_snapshot": self.html_snapshot,
            "grid_cols": self.grid_cols,
            "grid_rows": self.grid_rows,
            "cell_counts": self.cell_counts,
            "summary": self.summary,
            "eye_evidence": self.eye_evidence,
        }


@dataclass
class EyeTrackingSessionListResponse:
    items: list[EyeTrackingSessionSummary]
    total: int = 0
    limit: int = 20
    offset: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "items": [item.to_dict() for item in self.items],
            "total": self.total,
            "limit": self.limit,
            "offset": self.offset,
        }


@dataclass
class AnalyzeRequest:
    html: str
    source_name: str | None = None
    baseline_run_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
