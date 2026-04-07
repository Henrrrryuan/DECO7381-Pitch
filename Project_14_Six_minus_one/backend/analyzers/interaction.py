from __future__ import annotations

from pathlib import Path
import sys
from typing import Any

from bs4 import BeautifulSoup, Tag

if __package__ in {None, ""}:
    project_root = Path(__file__).resolve().parents[2]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    from backend.schemas import DimensionResult, Issue, Severity
    from backend.scoring import calculate_dimension_score, calculate_penalty
else:
    from ..schemas import DimensionResult, Issue, Severity
    from ..scoring import calculate_dimension_score, calculate_penalty

DIMENSION_NAME = "Interaction & Distraction"

REGULAR_BASE_PENALTY = 3
SERIOUS_BASE_PENALTY = 4

ANIMATION_THRESHOLD = 2
CTA_THRESHOLD = 2

CTA_HINTS = (
    "btn",
    "button",
    "cta",
    "primary",
    "action",
    "submit",
)

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

CANDIDATE_REGION_TAGS = ("header", "main", "section", "article", "form", "nav")
CTA_PRIMARY_HINTS = CTA_HINTS + ("hero", "main")
NON_CTA_LABEL_HINTS = (
    "cancel",
    "back",
    "go back",
    "close",
    "dismiss",
    "menu",
    "previous",
    "prev",
    "skip",
)


def analyze_interaction(html: str) -> DimensionResult:
    """Analyze interaction and distraction risks for HTML input.

    Scope limits:
    - Supports HTML files or HTML snippets only
    - Detects proxy indicators of distraction and cognitive load
    - Does not model human cognition or provide compliance certification
    """

    soup = BeautifulSoup(html or "", "html.parser")

    candidate_regions = get_candidate_regions(soup)

    issues = [
        issue
        for issue in (
            detect_id1_autoplay_media(soup)
            + detect_id2_too_many_animated_elements(candidate_regions)
            + detect_id3_cta_competition(candidate_regions)
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
            "region_count": len(candidate_regions),
            "total_penalty": total_penalty,
            "scoring_model": {
                "formula": "Dimension Score = max(0, 100 - Sum(Penalties))",
                "penalty_formula": "Penalty = Base Penalty * Severity",
            },
        },
    )


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


def detect_id1_autoplay_media(soup: BeautifulSoup) -> list[Issue]:
    issues: list[Issue] = []

    for video in soup.select("video[autoplay]"):
        muted = video.has_attr("muted")
        severity: Severity = "major" if muted else "critical"
        issues.append(
            build_issue(
                rule_id="ID-1",
                title="自动播放媒体",
                severity=severity,
                base_penalty=SERIOUS_BASE_PENALTY,
                description="页面存在 autoplay 视频，可能在用户理解页面结构前直接打断注意力。",
                suggestion="默认关闭 autoplay；如必须自动播放，请静音并避免放在主任务区域。",
                evidence={
                    "tag": "video",
                    "muted": muted,
                },
                locations=[{"summary": get_tag_summary(video), "html_snippet": get_tag_snippet(video)}],
            )
        )

    for audio in soup.select("audio[autoplay]"):
        issues.append(
            build_issue(
                rule_id="ID-1",
                title="自动播放媒体",
                severity="critical",
                base_penalty=SERIOUS_BASE_PENALTY,
                description="页面存在 autoplay 音频，会在用户尚未建立页面理解时直接干扰阅读与定位。",
                suggestion="要求用户主动触发音频播放，不要默认自动播放。",
                evidence={"tag": "audio"},
                locations=[{"summary": get_tag_summary(audio), "html_snippet": get_tag_snippet(audio)}],
            )
        )

    for iframe in soup.find_all("iframe"):
        src = iframe.get("src", "")
        src_lower = src.lower()
        if "autoplay=1" in src_lower or "autoplay=true" in src_lower:
            issues.append(
                build_issue(
                    rule_id="ID-1",
                    title="自动播放媒体",
                    severity="major",
                    base_penalty=SERIOUS_BASE_PENALTY,
                    description="页面中存在启用 autoplay 的嵌入媒体，可能在用户聚焦主内容前造成额外干扰。",
                    suggestion="关闭嵌入媒体 autoplay，除非它与用户当前主任务直接相关。",
                    evidence={
                        "tag": "iframe",
                        "src": src,
                    },
                    locations=[{"summary": get_tag_summary(iframe), "html_snippet": get_tag_snippet(iframe)}],
                )
            )

    return issues


def detect_id2_too_many_animated_elements(candidate_regions: list[Tag]) -> list[Issue]:
    issues: list[Issue] = []

    for region in candidate_regions:
        animated_tags = get_region_scoped_tags(region, candidate_regions, looks_animated)
        animated_count = len(animated_tags)
        if animated_count <= ANIMATION_THRESHOLD:
            continue

        severity: Severity = "critical" if animated_count >= 5 else "major"
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
                    "threshold": ANIMATION_THRESHOLD,
                    "region": get_tag_summary(region),
                    "note": "MVP 以 major content region 作为同一视口的近似代理。",
                },
                locations=[
                    {"summary": get_tag_summary(tag), "html_snippet": get_tag_snippet(tag)}
                    for tag in animated_tags[:5]
                ],
            )
        )

    return issues


def detect_id3_cta_competition(candidate_regions: list[Tag]) -> list[Issue]:
    issues: list[Issue] = []

    for region in candidate_regions:
        ctas = get_region_primary_ctas(region, candidate_regions)
        cta_count = len(ctas)
        if cta_count <= CTA_THRESHOLD:
            continue

        severity = classify_cta_severity(region, ctas)
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
                    "threshold": CTA_THRESHOLD,
                    "region": get_tag_summary(region),
                    "cta_examples": [get_cta_label(tag) or get_tag_summary(tag) for tag in ctas[:5]],
                },
                locations=[
                    {"summary": get_tag_summary(tag), "label": get_cta_label(tag)}
                    for tag in ctas[:5]
                ],
            )
        )

    return issues


def looks_animated(tag: Tag) -> bool:
    if not isinstance(tag, Tag):
        return False

    if tag.name == "marquee":
        return True

    if tag.name in {"video", "audio"} and tag.has_attr("autoplay"):
        return True

    combined = " ".join(
        [
            tag.get("id", ""),
            " ".join(tag.get("class", [])),
            tag.get("style", ""),
            " ".join(str(tag.get(attr, "")) for attr in ["data-animation", "data-aos", "data-swiper", "role"]),
        ]
    ).lower()

    if any(hint in combined for hint in ANIMATION_HINTS):
        return True

    style = tag.get("style", "").lower()
    return "animation" in style or "transition" in style


def looks_like_cta(tag: Tag) -> bool:
    if not isinstance(tag, Tag):
        return False

    if tag.name not in {"button", "a", "input"}:
        return False

    combined = " ".join(
        [
            tag.get("id", ""),
            " ".join(tag.get("class", [])),
            tag.get("role", ""),
            tag.get("style", ""),
        ]
    ).lower()
    label = get_cta_label(tag).lower()

    if any(hint in label for hint in NON_CTA_LABEL_HINTS):
        return False

    has_primary_hint = any(keyword in combined for keyword in CTA_PRIMARY_HINTS)
    has_action_text = any(phrase in label for phrase in CTA_TEXT_HINTS)
    is_button_like = tag.get("role", "").lower() == "button"
    is_submit_input = tag.name == "input" and tag.get("type", "").lower() == "submit"
    is_submit_button = tag.name == "button" and tag.get("type", "").lower() == "submit"

    return has_primary_hint or has_action_text or is_button_like or is_submit_input or is_submit_button


def classify_cta_severity(region: Tag, ctas: list[Tag]) -> Severity:
    cta_count = len(ctas)
    region_summary = get_tag_summary(region).lower()

    prominent_cta_count = 0
    for cta in ctas:
        combined = " ".join(
            [
                cta.get("id", ""),
                " ".join(cta.get("class", [])),
                cta.get("style", ""),
            ]
        ).lower()
        if any(hint in combined for hint in CTA_PRIMARY_HINTS):
            prominent_cta_count += 1

    if cta_count >= 4 or prominent_cta_count >= 2:
        return "critical"

    if any(tag_name in region_summary for tag_name in ("header", "hero", "main")):
        return "major"

    return "major"


def get_candidate_regions(soup: BeautifulSoup) -> list[Tag]:
    root = soup.body if soup.body is not None else soup

    regions: list[Tag] = []
    for selector in CANDIDATE_REGION_TAGS:
        regions.extend(root.find_all(selector))

    if regions:
        return regions

    direct_children = [child for child in root.find_all(recursive=False) if isinstance(child, Tag)]
    if direct_children:
        return direct_children

    if isinstance(root, Tag):
        return [root]

    return []


def get_region_primary_ctas(region: Tag, candidate_regions: list[Tag]) -> list[Tag]:
    ctas: list[Tag] = []
    for tag in region.find_all(["button", "a", "input"]):
        if not looks_like_cta(tag):
            continue

        nearest_region = get_nearest_candidate_region(tag, candidate_regions)
        if nearest_region is region:
            ctas.append(tag)

    return ctas


def get_region_scoped_tags(
    region: Tag,
    candidate_regions: list[Tag],
    predicate: Any,
) -> list[Tag]:
    scoped_tags: list[Tag] = []
    for tag in region.find_all(True):
        if not predicate(tag):
            continue

        nearest_region = get_nearest_candidate_region(tag, candidate_regions)
        if nearest_region is region:
            scoped_tags.append(tag)

    return scoped_tags


def get_nearest_candidate_region(tag: Tag, candidate_regions: list[Tag]) -> Tag | None:
    region_ids = {id(region) for region in candidate_regions}
    current = tag
    while current is not None:
        if isinstance(current, Tag) and id(current) in region_ids:
            return current
        current = current.parent
    return None


def get_cta_label(tag: Tag) -> str:
    if tag.name == "input":
        return normalize_text(tag.get("value", "") or tag.get("aria-label", "") or tag.get("name", ""))
    return normalize_text(tag.get_text(" ", strip=True) or tag.get("aria-label", "") or tag.get("title", ""))


def get_tag_summary(tag: Tag) -> str:
    tag_name = tag.name or "unknown"
    element_id = f"#{tag.get('id')}" if tag.get("id") else ""
    classes = "." + ".".join(tag.get("class", [])) if tag.get("class") else ""
    return f"{tag_name}{element_id}{classes}"


def get_tag_snippet(tag: Tag, max_length: int = 180) -> str:
    snippet = str(tag)
    if len(snippet) <= max_length:
        return snippet
    return snippet[: max_length - 3] + "..."


def normalize_text(text: str) -> str:
    return " ".join(text.split())


def load_html_from_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def main() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(
        description="Analyze the Interaction & Distraction dimension for an HTML file."
    )
    parser.add_argument("html_file", help="Path to an HTML file")
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output",
    )
    args = parser.parse_args()

    html = load_html_from_file(args.html_file)
    result = analyze_interaction(html).to_dict()

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
