from __future__ import annotations

from collections import defaultdict
from html.parser import HTMLParser
from typing import Iterable

from ..schemas import DimensionResult, Issue, Severity
from ..scoring import calculate_dimension_score, calculate_penalty

FIRST_VIEWPORT_TAG_WINDOW = 120
VC1_THRESHOLD = 12
VC2_THRESHOLD = 6
VC3_THRESHOLD = 2

FOCUS_TAGS = {
    "a",
    "article",
    "aside",
    "button",
    "form",
    "h1",
    "h2",
    "h3",
    "iframe",
    "img",
    "input",
    "li",
    "nav",
    "p",
    "section",
    "select",
    "textarea",
    "video",
}

REGION_TAGS = {
    "article",
    "aside",
    "body",
    "div",
    "footer",
    "header",
    "main",
    "nav",
    "ol",
    "section",
    "ul",
}

ITEM_TAGS = {"article", "li"}
ITEM_HINT_KEYWORDS = ("card", "item", "tile", "product", "post", "entry", "panel")
SIDEBAR_BANNER_KEYWORDS = (
    "sidebar",
    "side-bar",
    "banner",
    "promo",
    "advert",
    "ad",
    "floating",
    "sticky",
    "popup",
    "modal",
)


class _VisualHTMLParser(HTMLParser):
    """Collect lightweight structural metrics for visual-complexity heuristics."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.focus_elements_count = 0
        self.sidebar_banner_count = 0
        self.start_tag_count = 0
        self.detected_sidebar_banner_keywords: set[str] = set()

        self._stack: list[tuple[str, str, bool]] = []
        self._node_seq = 0
        self._region_item_counts: dict[str, int] = defaultdict(int)
        self._region_tags: dict[str, str] = {"root": "body"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs)
        self._pop_until(tag)

    def handle_endtag(self, tag: str) -> None:
        self._pop_until(tag)

    def _on_start(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_text = self._attrs_text(attrs)

        self.start_tag_count += 1
        self._node_seq += 1
        node_id = f"n{self._node_seq}"
        is_region = tag in REGION_TAGS
        self._stack.append((tag, node_id, is_region))
        if is_region:
            self._region_tags[node_id] = tag

        if self.start_tag_count <= FIRST_VIEWPORT_TAG_WINDOW and (
            tag in FOCUS_TAGS or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS)
        ):
            self.focus_elements_count += 1

        if tag in ITEM_TAGS or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS):
            region_id = self._nearest_region_id()
            self._region_item_counts[region_id] += 1

        matched_keywords = self._matched_keywords(attrs_text, SIDEBAR_BANNER_KEYWORDS)
        is_sidebar_banner = tag == "aside" or bool(matched_keywords)
        if is_sidebar_banner:
            self.sidebar_banner_count += 1
            self.detected_sidebar_banner_keywords.update(matched_keywords)

    def _nearest_region_id(self) -> str:
        for _tag, node_id, is_region in reversed(self._stack[:-1]):
            if is_region:
                return node_id
        return "root"

    def _pop_until(self, tag: str) -> None:
        for index in range(len(self._stack) - 1, -1, -1):
            open_tag, _, _ = self._stack[index]
            if open_tag == tag:
                del self._stack[index:]
                return

    @staticmethod
    def _attrs_text(attrs: list[tuple[str, str | None]]) -> str:
        parts: list[str] = []
        for key, value in attrs:
            if not key:
                continue
            parts.append(key.lower())
            if value:
                parts.append(value.lower())
        return " ".join(parts)

    @staticmethod
    def _contains_any(text: str, keywords: Iterable[str]) -> bool:
        lowered = text.lower()
        return any(keyword in lowered for keyword in keywords)

    @staticmethod
    def _matched_keywords(text: str, keywords: Iterable[str]) -> set[str]:
        lowered = text.lower()
        return {keyword for keyword in keywords if keyword in lowered}

    def max_items_in_region(self) -> tuple[int, str]:
        if not self._region_item_counts:
            return 0, "body"
        region_id, max_count = max(
            self._region_item_counts.items(),
            key=lambda item: item[1],
        )
        return max_count, self._region_tags.get(region_id, "body")


def _severity_from_excess(excess: int) -> Severity:
    if excess <= 2:
        return "minor"
    if excess <= 6:
        return "major"
    return "critical"


def _build_issue(
    *,
    rule_id: str,
    title: str,
    severity: Severity,
    base_penalty: int,
    description: str,
    suggestion: str,
    evidence: dict[str, object],
) -> Issue:
    return Issue(
        rule_id=rule_id,
        title=title,
        severity=severity,
        base_penalty=base_penalty,
        penalty=calculate_penalty(base_penalty, severity),
        description=description,
        suggestion=suggestion,
        evidence=evidence,
        locations=[],
    )


def analyze_visual(html: str) -> DimensionResult:
    """Analyze visual complexity using shared MVP rules VC-1/VC-2/VC-3."""

    parser = _VisualHTMLParser()
    parser.feed(html or "")
    parser.close()

    max_items_in_region, max_items_region_tag = parser.max_items_in_region()

    issues: list[Issue] = []

    if parser.focus_elements_count > VC1_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="VC-1",
                title="Too many elements on the first screen",
                severity=_severity_from_excess(parser.focus_elements_count - VC1_THRESHOLD),
                base_penalty=3,
                description="The number of key elements in the first screen area is excessive, which may increase the burden of visual scanning and selection.",
                suggestion="Reduce the number of elements competing for attention on the first screen simultaneously, and highlight 1 to 2 main task entry points.",
                evidence={
                    "focus_elements_count": parser.focus_elements_count,
                    "threshold": VC1_THRESHOLD,
                    "first_viewport_tag_window": FIRST_VIEWPORT_TAG_WINDOW,
                },
            )
        )

    if max_items_in_region > VC2_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="VC-2",
                title="Content blocks are too dense",
                severity=_severity_from_excess(max_items_in_region - VC2_THRESHOLD),
                base_penalty=3,
                description="An excessive number of projects within the same region results in high information density, which may reduce scannability.",
                suggestion="Split the content into multiple partitions, or introduce folding/pagination to reduce the density of a single screen.",
                evidence={
                    "max_items_in_region": max_items_in_region,
                    "threshold": VC2_THRESHOLD,
                    "region_tag": max_items_region_tag,
                },
            )
        )

    if parser.sidebar_banner_count >= VC3_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="VC-3",
                title="Excessive interference from sidebars or banners",
                severity=_severity_from_excess(parser.sidebar_banner_count - VC3_THRESHOLD),
                base_penalty=4,
                description="The page contains numerous sidebars, banners, or floating interference areas, which may distract users' attention.",
                suggestion="Merge or remove non-critical sidebars/banners, retaining only auxiliary information that supports the main task.",
                evidence={
                    "sidebar_banner_count": parser.sidebar_banner_count,
                    "threshold": VC3_THRESHOLD,
                    "matched_keywords": sorted(parser.detected_sidebar_banner_keywords),
                },
            )
        )

    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score(total_penalty)

    return DimensionResult(
        dimension="Visual Complexity",
        score=score,
        issues=issues,
        metadata={
            "implemented_rules": ["VC-1", "VC-2", "VC-3"],
            "pending_rules": [],
            "metrics": {
                "focus_elements_count": parser.focus_elements_count,
                "max_items_in_region": max_items_in_region,
                "max_items_region_tag": max_items_region_tag,
                "sidebar_banner_count": parser.sidebar_banner_count,
            },
        },
    )
