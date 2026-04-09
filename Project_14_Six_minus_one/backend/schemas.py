from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Severity = Literal["minor", "major", "critical"]
DimensionName = Literal[
    "Readability",
    "Visual Complexity",
    "Interaction & Distraction",
    "Consistency",
]


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

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DimensionResult:
    dimension: DimensionName
    score: int
    issues: list[Issue] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "dimension": self.dimension,
            "score": self.score,
            "issues": [issue.to_dict() for issue in self.issues],
            "metadata": self.metadata,
        }


@dataclass
class AnalysisResult:
    overall_score: int
    weighted_average: int
    min_dimension_score: int
    dimensions: list[DimensionResult]

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "weighted_average": self.weighted_average,
            "min_dimension_score": self.min_dimension_score,
            "dimensions": [dimension.to_dict() for dimension in self.dimensions],
        }


@dataclass
class HistoryRunSummary:
    run_id: str
    created_at: str
    source_name: str
    overall_score: int
    weighted_average: int
    min_dimension_score: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


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

    def to_dict(self) -> dict[str, Any]:
        return {
            "items": [item.to_dict() for item in self.items],
        }


@dataclass
class AnalyzeRequest:
    html: str
    source_name: str | None = None
    baseline_run_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
