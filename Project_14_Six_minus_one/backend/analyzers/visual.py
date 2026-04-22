from __future__ import annotations

from collections import defaultdict
from html.parser import HTMLParser
import re
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
    "ads",
    "ad-banner",
    "floating",
    "sticky",
    "popup",
    "modal",
)
FIXED_POSITION_PATTERN = re.compile(r"position\s*:\s*(fixed|sticky)", re.IGNORECASE)


class _VisualHTMLParser(HTMLParser):
    """Collect lightweight structural metrics for visual-complexity heuristics."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.focus_elements_count = 0
        self.sidebar_banner_count = 0
        self.start_tag_count = 0
        self.detected_sidebar_banner_keywords: set[str] = set()
        self.focus_element_locations: list[dict[str, str]] = []
        self.sidebar_banner_locations: list[dict[str, str]] = []

        self._stack: list[tuple[str, str, bool]] = []
        self._node_seq = 0
        self._region_item_counts: dict[str, int] = defaultdict(int)
        self._region_tags: dict[str, str] = {"root": "body"}
        self._region_summaries: dict[str, str] = {"root": "body"}

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
            self._region_summaries[node_id] = self._tag_summary(tag, attrs)

        if self.start_tag_count <= FIRST_VIEWPORT_TAG_WINDOW and (
            tag in FOCUS_TAGS or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS)
        ):
            self.focus_elements_count += 1
            if len(self.focus_element_locations) < 12:
                self.focus_element_locations.append(
                    {
                        "tag": tag,
                        "summary": self._tag_summary(tag, attrs),
                    }
                )

        if tag in ITEM_TAGS or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS):
            region_id = self._nearest_region_id()
            self._region_item_counts[region_id] += 1

        matched_keywords = self._matched_sidebar_banner_keywords(
            attrs_text,
            SIDEBAR_BANNER_KEYWORDS,
        )
        is_sidebar_banner = tag == "aside" or bool(matched_keywords)
        if is_sidebar_banner:
            self.sidebar_banner_count += 1
            self.detected_sidebar_banner_keywords.update(matched_keywords)
            if len(self.sidebar_banner_locations) < 8:
                self.sidebar_banner_locations.append(
                    {
                        "tag": tag,
                        "summary": self._tag_summary(tag, attrs),
                    }
                )

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

    @staticmethod
    def _matched_sidebar_banner_keywords(text: str, keywords: Iterable[str]) -> set[str]:
        lowered = text.lower()
        matched: set[str] = set()
        for keyword in keywords:
            pattern = rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])"
            if re.search(pattern, lowered):
                matched.add(keyword)
        return matched

    def max_items_in_region(self) -> tuple[int, str, str]:
        if not self._region_item_counts:
            return 0, "body", "body"
        region_id, max_count = max(
            self._region_item_counts.items(),
            key=lambda item: item[1],
        )
        return (
            max_count,
            self._region_tags.get(region_id, "body"),
            self._region_summaries.get(region_id, self._region_tags.get(region_id, "body")),
        )

    @staticmethod
    def _tag_summary(tag: str, attrs: list[tuple[str, str | None]]) -> str:
        element_id = ""
        classes: list[str] = []
        for key, value in attrs:
            if key == "id" and value:
                element_id = f"#{value}"
            if key == "class" and value:
                classes.extend(value.split())
        class_text = "." + ".".join(classes) if classes else ""
        return f"{tag}{element_id}{class_text}"


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
    locations: list[dict[str, object]] | None = None,
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
        locations=locations or [],
    )


def analyze_visual(
    html: str,
    *,
    css_sources: list[str] | None = None,
    js_sources: list[str] | None = None,
) -> DimensionResult:
    """rukou Analyze visual complexity using shared MVP rules VC-1/VC-2/VC-3."""

    parser = _VisualHTMLParser()
    parser.feed(html or "")
    parser.close()
    resource_hints = extract_resource_visual_hints(css_sources or [], js_sources or [])

    max_items_in_region, max_items_region_tag, max_items_region_summary = parser.max_items_in_region()

    issues: list[Issue] = []

    if parser.focus_elements_count > VC1_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="VC-1",
                title="Too many elements on the first screen",
                severity=_severity_from_excess(parser.focus_elements_count - VC1_THRESHOLD),
                base_penalty=3,
                description="Too many first-screen elements fragment attention and make it harder to decide where to look first. This increases visual scanning effort and can delay task start for users who rely on clear hierarchy and focus cues.",
                suggestion="Reduce the number of elements competing for attention on the first screen simultaneously, and highlight 1 to 2 main task entry points.",
                evidence={
                    "focus_elements_count": parser.focus_elements_count,
                    "threshold": VC1_THRESHOLD,
                    "first_viewport_tag_window": FIRST_VIEWPORT_TAG_WINDOW,
                },
                locations=parser.focus_element_locations[:8],
            )
        )

    if max_items_in_region > VC2_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="VC-2",
                title="Content blocks are too dense",
                severity=_severity_from_excess(max_items_in_region - VC2_THRESHOLD),
                base_penalty=3,
                description="Dense groups of cards or items make information harder to separate into meaningful chunks. Users may need to compare too many options at once, which increases selection effort and reduces scannability.",
                suggestion="Split the content into multiple partitions, or introduce folding/pagination to reduce the density of a single screen.",
                evidence={
                    "max_items_in_region": max_items_in_region,
                    "threshold": VC2_THRESHOLD,
                    "region_tag": max_items_region_tag,
                    "region_summary": max_items_region_summary,
                },
                locations=[
                    {
                        "tag": max_items_region_tag,
                        "summary": max_items_region_summary,
                    }
                ],
            )
        )

    effective_sidebar_banner_count = parser.sidebar_banner_count + resource_hints["sidebar_banner_signal_count"]
    if effective_sidebar_banner_count >= VC3_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="VC-3",
                title="Excessive interference from sidebars or banners",
                severity=_severity_from_excess(effective_sidebar_banner_count - VC3_THRESHOLD),
                base_penalty=4,
                description="Sidebars, banners, and floating elements compete with the main task for attention. This can interrupt focus, make the primary content less obvious, and increase cognitive effort for users sensitive to visual distraction.",
                suggestion="Merge or remove non-critical sidebars/banners, retaining only auxiliary information that supports the main task.",
                evidence={
                    "sidebar_banner_count": parser.sidebar_banner_count,
                    "resource_sidebar_banner_signal_count": resource_hints["sidebar_banner_signal_count"],
                    "effective_sidebar_banner_count": effective_sidebar_banner_count,
                    "threshold": VC3_THRESHOLD,
                    "matched_keywords": sorted(
                        parser.detected_sidebar_banner_keywords | resource_hints["matched_keywords"]
                    ),
                },
                locations=parser.sidebar_banner_locations[:5],
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
                "resource_sidebar_banner_signal_count": resource_hints["sidebar_banner_signal_count"],
            },
        },
    )


def extract_resource_visual_hints(
    css_sources: list[str],
    js_sources: list[str],
) -> dict[str, object]:
    matched_keywords: set[str] = set()
    sidebar_banner_signal_count = 0

    for css_text in css_sources:
        lowered = css_text.lower()
        keyword_hits = {keyword for keyword in SIDEBAR_BANNER_KEYWORDS if keyword in lowered}
        matched_keywords.update(keyword_hits)
        if keyword_hits:
            sidebar_banner_signal_count += len(keyword_hits)
        if FIXED_POSITION_PATTERN.search(css_text):
            sidebar_banner_signal_count += 1

    for js_text in js_sources:
        lowered = js_text.lower()
        keyword_hits = {keyword for keyword in SIDEBAR_BANNER_KEYWORDS if keyword in lowered}
        matched_keywords.update(keyword_hits)
        if keyword_hits:
            sidebar_banner_signal_count += len(keyword_hits)

    return {
        "sidebar_banner_signal_count": sidebar_banner_signal_count,
        "matched_keywords": matched_keywords,
    }
