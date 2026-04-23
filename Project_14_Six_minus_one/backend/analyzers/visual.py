from __future__ import annotations

from collections import defaultdict
from html.parser import HTMLParser
import re
from typing import Iterable

from ..schemas import DimensionResult, Issue, Severity
from ..scoring import calculate_dimension_score, calculate_penalty

FIRST_VIEWPORT_TAG_WINDOW = 120
IO1_THRESHOLD = 10
IO2_THRESHOLD = 6
IO3_THRESHOLD = 2
IO4_THRESHOLD = 4
PRIMARY_TASK_CONFLICT_THRESHOLD = 2

FOCUS_TAGS = {
    "a",
    "button",
    "form",
    "h1",
    "h2",
    "h3",
    "iframe",
    "img",
    "input",
    "select",
    "textarea",
    "video",
}

PROMINENT_HEADING_TAGS = {"h1", "h2"}
CTA_TAGS = {"a", "button", "input"}
ACTIONABLE_INPUT_TYPES = {"button", "submit", "image", "reset"}

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
CTA_HINT_KEYWORDS = (
    "cta",
    "primary",
    "hero",
    "start",
    "continue",
    "next",
    "submit",
    "signup",
    "sign-up",
    "sign-in",
    "register",
    "apply",
    "buy",
    "book",
    "download",
    "checkout",
)
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
    """Collect structural signals for information-overload heuristics."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.focus_elements_count = 0
        self.sidebar_banner_count = 0
        self.competing_action_count = 0
        self.prominent_heading_count = 0
        self.start_tag_count = 0
        self.detected_sidebar_banner_keywords: set[str] = set()
        self.focus_element_locations: list[dict[str, str]] = []
        self.sidebar_banner_locations: list[dict[str, str]] = []
        self.competing_action_locations: list[dict[str, str]] = []
        self.prominent_heading_locations: list[dict[str, str]] = []

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
        attrs_map = self._attrs_map(attrs)
        attrs_text = self._attrs_text(attrs)

        self.start_tag_count += 1
        self._node_seq += 1
        node_id = f"n{self._node_seq}"
        is_region = tag in REGION_TAGS
        self._stack.append((tag, node_id, is_region))
        if is_region:
            self._region_tags[node_id] = tag
            self._region_summaries[node_id] = self._tag_summary(tag, attrs)

        is_first_viewport = self.start_tag_count <= FIRST_VIEWPORT_TAG_WINDOW
        if is_first_viewport and (
            tag in FOCUS_TAGS
            or self._contains_any(attrs_text, ITEM_HINT_KEYWORDS)
            or self._contains_any(attrs_text, CTA_HINT_KEYWORDS)
        ):
            self.focus_elements_count += 1
            if len(self.focus_element_locations) < 12:
                self.focus_element_locations.append(
                    {
                        "tag": tag,
                        "summary": self._tag_summary(tag, attrs),
                    }
                )

        if is_first_viewport and self._is_competing_action(tag, attrs_text, attrs_map):
            self.competing_action_count += 1
            if len(self.competing_action_locations) < 10:
                self.competing_action_locations.append(
                    {
                        "tag": tag,
                        "summary": self._tag_summary(tag, attrs),
                    }
                )

        if is_first_viewport and tag in PROMINENT_HEADING_TAGS:
            self.prominent_heading_count += 1
            if len(self.prominent_heading_locations) < 5:
                self.prominent_heading_locations.append(
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
    def _attrs_map(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {
            key.lower(): (value or "").lower()
            for key, value in attrs
            if key
        }

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
    def _matched_sidebar_banner_keywords(text: str, keywords: Iterable[str]) -> set[str]:
        lowered = text.lower()
        matched: set[str] = set()
        for keyword in keywords:
            pattern = rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])"
            if re.search(pattern, lowered):
                matched.add(keyword)
        return matched

    @staticmethod
    def _is_competing_action(tag: str, attrs_text: str, attrs_map: dict[str, str]) -> bool:
        if tag == "button":
            return True
        if tag == "a" and attrs_map.get("href") and not attrs_map["href"].startswith("#"):
            return True
        if tag == "input" and attrs_map.get("type", "text") in ACTIONABLE_INPUT_TYPES:
            return True
        if attrs_map.get("role") == "button":
            return True
        return any(keyword in attrs_text for keyword in CTA_HINT_KEYWORDS)

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

    def primary_task_conflict(self) -> tuple[int, list[str]]:
        score = 0
        reasons: list[str] = []

        if self.prominent_heading_count == 0:
            score += 2
            reasons.append("no clear top-level heading anchors the page")
        elif self.prominent_heading_count > 2:
            score += self.prominent_heading_count - 2
            reasons.append("multiple headings compete for the main reading path")

        if self.competing_action_count == 0:
            score += 1
            reasons.append("no obvious next step is signalled")
        elif self.competing_action_count > IO4_THRESHOLD:
            score += self.competing_action_count - IO4_THRESHOLD
            reasons.append("too many actions appear with similar prominence")

        return score, reasons

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


def _mental_effort_evidence(
    *,
    blocks_primary_task: bool,
    confusion_distraction_level: int,
    cumulative_load_level: int,
    affected_users: str,
) -> dict[str, object]:
    return {
        "blocks_primary_task": blocks_primary_task,
        "confusion_distraction_level": confusion_distraction_level,
        "cumulative_load_level": cumulative_load_level,
        "affected_users": affected_users,
        "focus_group": "People with reading difficulties or dyslexia who rely on clear chunking, obvious task hierarchy, and low-distraction reading paths.",
    }


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
    """Analyze information overload using reading-path oriented heuristics."""

    parser = _VisualHTMLParser()
    parser.feed(html or "")
    parser.close()
    resource_hints = extract_resource_visual_hints(css_sources or [], js_sources or [])

    max_items_in_region, max_items_region_tag, max_items_region_summary = parser.max_items_in_region()
    primary_task_conflict_score, primary_task_conflict_reasons = parser.primary_task_conflict()

    issues: list[Issue] = []

    if parser.focus_elements_count > IO1_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="IO-1",
                title="Too many competing focal points on the first screen",
                severity=_severity_from_excess(parser.focus_elements_count - IO1_THRESHOLD),
                base_penalty=3,
                description="Too many first-screen focal points force users to decide what deserves attention before they can start reading. For people with reading difficulties or dyslexia, this can slow entry into the page and make the main path harder to recognise.",
                suggestion="Reduce the number of high-salience elements shown at once and make one reading path or primary task clearly dominant above supporting content.",
                evidence={
                    "focus_elements_count": parser.focus_elements_count,
                    "threshold": IO1_THRESHOLD,
                    "first_viewport_tag_window": FIRST_VIEWPORT_TAG_WINDOW,
                    **_mental_effort_evidence(
                        blocks_primary_task=True,
                        confusion_distraction_level=3,
                        cumulative_load_level=2,
                        affected_users="Readers who need a clear starting point may struggle when headings, media, and actions compete equally for attention.",
                    ),
                },
                locations=parser.focus_element_locations[:8],
            )
        )

    if max_items_in_region > IO2_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="IO-2",
                title="Too much information is packed into one region",
                severity=_severity_from_excess(max_items_in_region - IO2_THRESHOLD),
                base_penalty=3,
                description="When too many cards or items appear in one region, users have to compare and filter information repeatedly. This increases reading effort and weakens chunking, which can be especially difficult for people who need shorter, more structured information groups.",
                suggestion="Split this region into smaller chunks, reveal secondary content progressively, or reduce the number of visible items that need to be compared at the same time.",
                evidence={
                    "max_items_in_region": max_items_in_region,
                    "threshold": IO2_THRESHOLD,
                    "region_tag": max_items_region_tag,
                    "region_summary": max_items_region_summary,
                    **_mental_effort_evidence(
                        blocks_primary_task=False,
                        confusion_distraction_level=2,
                        cumulative_load_level=3,
                        affected_users="Readers who rely on chunked content may lose track of what matters when one region asks them to process too much at once.",
                    ),
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
    if effective_sidebar_banner_count >= IO3_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="IO-3",
                title="Peripheral content competes with the reading path",
                severity=_severity_from_excess(effective_sidebar_banner_count - IO3_THRESHOLD),
                base_penalty=4,
                description="Sidebars, banners, and floating elements interrupt the reading path and pull attention away from the main content. This can raise confusion and distraction, especially for users who need a calmer, more predictable page structure to stay oriented.",
                suggestion="Remove or demote non-essential sidebars, banners, or floating panels so the core reading path and main task stay visually dominant.",
                evidence={
                    "sidebar_banner_count": parser.sidebar_banner_count,
                    "resource_sidebar_banner_signal_count": resource_hints["sidebar_banner_signal_count"],
                    "effective_sidebar_banner_count": effective_sidebar_banner_count,
                    "threshold": IO3_THRESHOLD,
                    "matched_keywords": sorted(
                        parser.detected_sidebar_banner_keywords | resource_hints["matched_keywords"]
                    ),
                    **_mental_effort_evidence(
                        blocks_primary_task=False,
                        confusion_distraction_level=3,
                        cumulative_load_level=2,
                        affected_users="Readers who are easily distracted may find it harder to stay with the main content when peripheral panels keep competing for attention.",
                    ),
                },
                locations=parser.sidebar_banner_locations[:5],
            )
        )

    if parser.competing_action_count > IO4_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="IO-4",
                title="Too many competing actions are shown at once",
                severity=_severity_from_excess(parser.competing_action_count - IO4_THRESHOLD),
                base_penalty=4,
                description="Showing too many actions at the same level makes it harder to know what to do next. For people with reading difficulties, this can create extra decision load because they must interpret and compare several possible paths before acting.",
                suggestion="Keep one primary call to action visually dominant, group secondary actions together, and delay low-priority choices until after the main task is clear.",
                evidence={
                    "competing_action_count": parser.competing_action_count,
                    "threshold": IO4_THRESHOLD,
                    **_mental_effort_evidence(
                        blocks_primary_task=True,
                        confusion_distraction_level=3,
                        cumulative_load_level=2,
                        affected_users="Readers who need a clear next step may struggle when several buttons or links compete with equal prominence.",
                    ),
                },
                locations=parser.competing_action_locations[:6],
            )
        )

    if parser.focus_elements_count > 8 and primary_task_conflict_score >= PRIMARY_TASK_CONFLICT_THRESHOLD:
        issues.append(
            _build_issue(
                rule_id="IO-5",
                title="The primary reading path is not clear",
                severity=_severity_from_excess(primary_task_conflict_score),
                base_penalty=5,
                description="The page does not provide a stable, obvious reading path through a single dominant heading and a clear next step. This can make users spend more effort working out how to start, which is particularly difficult for people with dyslexia or reading fatigue.",
                suggestion="Strengthen one top-level heading, reduce competing headings or equally prominent actions, and make the main next step easier to identify before secondary content.",
                evidence={
                    "primary_task_conflict_score": primary_task_conflict_score,
                    "prominent_heading_count": parser.prominent_heading_count,
                    "competing_action_count": parser.competing_action_count,
                    "reasons": primary_task_conflict_reasons,
                    **_mental_effort_evidence(
                        blocks_primary_task=True,
                        confusion_distraction_level=3,
                        cumulative_load_level=3,
                        affected_users="Readers who need a strong heading and a predictable next step may struggle when the page offers no clear reading anchor.",
                    ),
                },
                locations=(parser.prominent_heading_locations + parser.competing_action_locations)[:6],
            )
        )

    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score(total_penalty)

    return DimensionResult(
        dimension="Information Overload",
        score=score,
        issues=issues,
        metadata={
            "implemented_rules": ["IO-1", "IO-2", "IO-3", "IO-4", "IO-5"],
            "pending_rules": [],
            "metrics": {
                "focus_elements_count": parser.focus_elements_count,
                "max_items_in_region": max_items_in_region,
                "max_items_region_tag": max_items_region_tag,
                "sidebar_banner_count": parser.sidebar_banner_count,
                "resource_sidebar_banner_signal_count": resource_hints["sidebar_banner_signal_count"],
                "competing_action_count": parser.competing_action_count,
                "prominent_heading_count": parser.prominent_heading_count,
                "primary_task_conflict_score": primary_task_conflict_score,
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
