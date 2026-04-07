from __future__ import annotations

from html.parser import HTMLParser
from typing import Any

from ..schemas import DimensionResult, Issue, Severity
from ..scoring import calculate_dimension_score, calculate_penalty

DIMENSION_NAME = "Interaction & Distraction"

REGULAR_BASE_PENALTY = 3
SERIOUS_BASE_PENALTY = 4

CTA_HINTS = ("btn", "button", "cta", "primary", "action", "submit")
CTA_TEXT_HINTS = (
    "buy now",
    "start",
    "get started",
    "continue",
    "sign up",
    "subscribe",
    "book now",
    "download",
    "join now",
    "try now",
    "learn more",
)
ANIMATION_HINTS = (
    "carousel",
    "slider",
    "swiper",
    "marquee",
    "animate",
    "animation",
    "motion",
    "rotator",
    "ticker",
)
CONTAINER_TAGS = {"section", "form", "article", "main", "header", "nav", "aside"}
CANDIDATE_REGION_TAGS = ("header", "main", "section", "article", "form")


class InteractionHTMLExtractor(HTMLParser):
    """Collect lightweight structural signals for interaction/distraction rules."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._stack: list[dict[str, Any]] = []
        self._node_seq = 0
        self._region_seq = 0
        self._current_region_id: str | None = None

        self.regions: dict[str, dict[str, Any]] = {}
        self.autoplay_media: list[dict[str, Any]] = []
        self.embedded_autoplay_media: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs, is_self_closing=False)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs, is_self_closing=True)

    def handle_endtag(self, tag: str) -> None:
        normalized_tag = tag.lower()
        for index in range(len(self._stack) - 1, -1, -1):
            entry = self._stack[index]
            if entry["tag"] == normalized_tag:
                self._stack = self._stack[:index]
                self._current_region_id = self._find_current_region_id()
                return

    def _on_start(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
        *,
        is_self_closing: bool,
    ) -> None:
        normalized_tag = tag.lower()
        attributes = {key.lower(): (value or "") for key, value in attrs}
        self._node_seq += 1

        entry = {
            "tag": normalized_tag,
            "attrs": attributes,
            "node_id": f"n{self._node_seq}",
            "region_id": self._current_region_id,
        }

        if normalized_tag in CANDIDATE_REGION_TAGS:
            self._region_seq += 1
            region_id = f"r{self._region_seq}"
            region_summary = summarize_tag(normalized_tag, attributes)
            self.regions[region_id] = {
                "tag": normalized_tag,
                "summary": region_summary,
                "animated_elements": [],
                "ctas": [],
            }
            entry["region_id"] = region_id
            self._current_region_id = region_id

        self._record_autoplay_media(normalized_tag, attributes)
        self._record_animated_hint(normalized_tag, attributes, entry["region_id"])
        self._record_cta(normalized_tag, attributes, entry["region_id"])

        if not is_self_closing:
            self._stack.append(entry)
        else:
            self._current_region_id = self._find_current_region_id()

    def _find_current_region_id(self) -> str | None:
        for entry in reversed(self._stack):
            if entry["tag"] in CANDIDATE_REGION_TAGS and entry["region_id"] is not None:
                return entry["region_id"]
        return None

    def _record_autoplay_media(self, tag: str, attrs: dict[str, str]) -> None:
        if tag in {"video", "audio"} and "autoplay" in attrs:
            self.autoplay_media.append(
                {
                    "tag": tag,
                    "muted": "muted" in attrs,
                    "summary": summarize_tag(tag, attrs),
                }
            )

        if tag == "iframe":
            src = attrs.get("src", "").lower()
            if "autoplay=1" in src or "autoplay=true" in src:
                self.embedded_autoplay_media.append(
                    {
                        "tag": tag,
                        "src": attrs.get("src", ""),
                        "summary": summarize_tag(tag, attrs),
                    }
                )

    def _record_animated_hint(self, tag: str, attrs: dict[str, str], region_id: str | None) -> None:
        if region_id is None:
            return

        if looks_animated(tag, attrs):
            self.regions[region_id]["animated_elements"].append(
                {
                    "tag": tag,
                    "summary": summarize_tag(tag, attrs),
                }
            )

    def _record_cta(self, tag: str, attrs: dict[str, str], region_id: str | None) -> None:
        if region_id is None:
            return

        if looks_like_primary_cta(tag, attrs):
            self.regions[region_id]["ctas"].append(
                {
                    "tag": tag,
                    "text": extract_control_label(attrs),
                    "summary": summarize_tag(tag, attrs),
                }
            )


def normalize_text(text: str) -> str:
    return " ".join(text.split())


def attrs_text(attrs: dict[str, str]) -> str:
    parts: list[str] = []
    for key, value in attrs.items():
        parts.append(key.lower())
        if value:
            parts.append(value.lower())
    return " ".join(parts)


def summarize_tag(tag: str, attrs: dict[str, str]) -> str:
    element_id = f"#{attrs.get('id')}" if attrs.get("id") else ""
    classes = "." + ".".join(attrs.get("class", "").split()) if attrs.get("class") else ""
    return f"{tag}{element_id}{classes}"


def extract_control_label(attrs: dict[str, str]) -> str:
    return normalize_text(
        attrs.get("aria-label", "")
        or attrs.get("title", "")
        or attrs.get("value", "")
        or attrs.get("data-text", "")
    )


def looks_animated(tag: str, attrs: dict[str, str]) -> bool:
    if tag == "marquee":
        return True

    if tag in {"video", "audio"} and "autoplay" in attrs:
        return True

    combined = attrs_text(attrs)
    return any(hint in combined for hint in ANIMATION_HINTS)


def looks_like_primary_cta(tag: str, attrs: dict[str, str]) -> bool:
    if tag not in {"button", "a", "input"}:
        return False

    if tag == "input" and attrs.get("type", "").lower() not in {"submit", "button"}:
        return False

    combined = attrs_text(attrs)
    label = extract_control_label(attrs).lower()

    has_primary_hint = any(keyword in combined for keyword in CTA_HINTS)
    has_action_text = any(phrase in label for phrase in CTA_TEXT_HINTS)

    return has_primary_hint or has_action_text


def build_issue(
    *,
    rule_id: str,
    title: str,
    severity: Severity,
    base_penalty: int,
    description: str,
    suggestion: str,
    evidence: dict[str, Any],
    locations: list[dict[str, Any]] | None = None,
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


def detect_id1_autoplay_media(extractor: InteractionHTMLExtractor) -> list[Issue]:
    issues: list[Issue] = []

    for media in extractor.autoplay_media:
        if media["tag"] == "audio":
            severity: Severity = "critical"
        elif media["muted"]:
            severity = "major"
        else:
            severity = "critical"

        issues.append(
            build_issue(
                rule_id="ID-1",
                title="自动播放媒体",
                severity=severity,
                base_penalty=SERIOUS_BASE_PENALTY,
                description="页面存在 autoplay 音频或视频，可能在用户建立页面理解前直接打断注意力。",
                suggestion="默认关闭 autoplay；如必须自动播放，请静音并避免放在主任务区域。",
                evidence={
                    "tag": media["tag"],
                    "muted": media["muted"],
                },
                locations=[{"summary": media["summary"]}],
            )
        )

    for embedded in extractor.embedded_autoplay_media:
        issues.append(
            build_issue(
                rule_id="ID-1",
                title="自动播放媒体",
                severity="major",
                base_penalty=SERIOUS_BASE_PENALTY,
                description="页面存在启用 autoplay 的嵌入媒体，可能在用户浏览主内容前造成额外干扰。",
                suggestion="关闭嵌入媒体的 autoplay，除非它与用户当前主任务直接相关。",
                evidence={
                    "tag": embedded["tag"],
                    "src": embedded["src"],
                },
                locations=[{"summary": embedded["summary"]}],
            )
        )

    return issues


def detect_id2_too_many_animated_elements(extractor: InteractionHTMLExtractor) -> list[Issue]:
    issues: list[Issue] = []

    for region in extractor.regions.values():
        animated_elements = region["animated_elements"]
        animated_count = len(animated_elements)
        if animated_count <= 2:
            continue

        if animated_count >= 5:
            severity: Severity = "critical"
        else:
            severity = "major"

        issues.append(
            build_issue(
                rule_id="ID-2",
                title="动画元素过多",
                severity=severity,
                base_penalty=REGULAR_BASE_PENALTY,
                description="同一区域内存在过多动态元素，可能同时争夺用户注意力并削弱主任务聚焦。",
                suggestion="减少非必要动效，限制自动轮播或持续运动组件，并保留一个必要动态元素即可。",
                evidence={
                    "animated_count": animated_count,
                    "threshold": 2,
                    "region": region["summary"],
                },
                locations=animated_elements[:5],
            )
        )

    return issues


def detect_id3_cta_competition(extractor: InteractionHTMLExtractor) -> list[Issue]:
    issues: list[Issue] = []

    for region in extractor.regions.values():
        ctas = region["ctas"]
        cta_count = len(ctas)
        if cta_count <= 2:
            continue

        if cta_count >= 4:
            severity: Severity = "critical"
        else:
            severity = "major"

        issues.append(
            build_issue(
                rule_id="ID-3",
                title="CTA 竞争",
                severity=severity,
                base_penalty=REGULAR_BASE_PENALTY,
                description="同一区域主操作按钮超过 2 个，容易增加决策负担，使用户难以判断下一步操作。",
                suggestion="保留 1 个主 CTA，其余改为次按钮或文本链接，明确操作层级。",
                evidence={
                    "cta_count": cta_count,
                    "threshold": 2,
                    "region": region["summary"],
                    "cta_examples": [cta["text"] or cta["summary"] for cta in ctas[:5]],
                },
                locations=ctas[:5],
            )
        )

    return issues


def analyze_interaction(html: str) -> DimensionResult:
    """Analyze interaction and distraction risks for HTML input.

    Scope limits:
    - Supports HTML files or HTML snippets only
    - Detects proxy indicators of distraction and cognitive load
    - Does not model human cognition or provide compliance certification
    """

    extractor = InteractionHTMLExtractor()
    extractor.feed(html or "")
    extractor.close()

    issues = [
        issue
        for issue in (
            detect_id1_autoplay_media(extractor)
            + detect_id2_too_many_animated_elements(extractor)
            + detect_id3_cta_competition(extractor)
        )
        if issue is not None
    ]

    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score(total_penalty)

    return DimensionResult(
        dimension=DIMENSION_NAME,
        score=score,
        issues=issues,
        metadata={
            "implemented_rules": ["ID-1", "ID-2", "ID-3"],
            "pending_rules": [],
            "input_scope": ["html_file", "html_snippet"],
            "out_of_scope": ["pdf", "image", "live_url_fetch", "multi_source_mixed_input"],
            "region_count": len(extractor.regions),
            "autoplay_media_count": len(extractor.autoplay_media) + len(extractor.embedded_autoplay_media),
            "scoring_model": {
                "formula": "Dimension Score = max(0, 100 - Sum(Penalties))",
                "penalty_formula": "Penalty = Base Penalty * Severity",
            },
        },
    )
