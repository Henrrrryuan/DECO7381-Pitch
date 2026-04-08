from __future__ import annotations

from pathlib import Path
import re
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
PRIMARY_CTA_SCORE_THRESHOLD = 3

CTA_HINTS = (
    "cta",
    "primary",
    "submit",
    "hero",
    "checkout",
    "signup",
    "subscribe",
    "purchase",
)

CTA_TEXT_HINTS = (
    "buy now",
    "start",
    "get started",
    "sign up",
    "subscribe",
    "book now",
    "download",
    "join now",
    "try now",
    "start free trial",
    "create account",
    "checkout",
    "立即注册",
    "确认支付",
    "申请会员",
    "立即购买",
    "立即订阅",
    "开始使用",
    "免费试用",
    "提交申请",
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
    "upload",
    "load",
    "open",
    "filter",
    "sort",
    "preview",
)

ANIMATED_CLASS_HINTS = (
    "animate",
    "animated",
    "animation",
    "moving",
    "motion",
    "carousel",
    "slider",
    "swiper",
    "ticker",
    "marquee",
    "pulse",
    "blink",
    "spin",
    "spinner",
    "bounce",
)

STYLE_RULE_PATTERN = re.compile(r"([^{]+)\{([^}]*)\}", re.DOTALL)
CLASS_SELECTOR_PATTERN = re.compile(r"\.([A-Za-z0-9_-]+)")
ID_SELECTOR_PATTERN = re.compile(r"#([A-Za-z0-9_-]+)")


def analyze_interaction(html: str) -> DimensionResult:
    """Analyze interaction and distraction risks for HTML input.

    Scope limits:
    - Supports HTML files or HTML snippets only
    - Detects proxy indicators of distraction and cognitive load
    - Does not model human cognition or provide compliance certification
    """

    soup = BeautifulSoup(html or "", "html.parser")

    candidate_regions = get_candidate_regions(soup)
    style_hints = extract_style_hints(soup)

    issues = [
        issue
        for issue in (
            detect_id1_autoplay_media(soup)
            + detect_id2_too_many_animated_elements(candidate_regions, style_hints)
            + detect_id3_cta_competition(candidate_regions, style_hints)
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


def detect_id2_too_many_animated_elements(
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
) -> list[Issue]:
    issues: list[Issue] = []

    for region in candidate_regions:
        animated_tags = get_region_scoped_tags(
            region,
            candidate_regions,
            lambda tag: looks_distracting_animation(tag, style_hints),
        )
        animated_count = len(animated_tags)
        if animated_count <= ANIMATION_THRESHOLD:
            continue

        if animated_count >= 6:
            severity: Severity = "critical"
        elif animated_count >= 4:
            severity = "major"
        else:
            severity = "minor"
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


def detect_id3_cta_competition(
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
) -> list[Issue]:
    issues: list[Issue] = []

    for region in candidate_regions:
        ctas = get_region_primary_ctas(region, candidate_regions, style_hints)
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


def looks_distracting_animation(tag: Tag, style_hints: dict[str, set[str]]) -> bool:
    """Count only likely attention-grabbing motion for ID-2.

    Autoplay media is handled by ID-1 already, so we avoid counting it again here.
    We also exclude plain transitions because they are often harmless state changes
    rather than continuous motion competing for attention.
    """

    if not isinstance(tag, Tag):
        return False

    if tag.name in {"video", "audio", "iframe"} and has_autoplay_media(tag):
        return False

    if tag.name == "marquee":
        return True

    classes = {item.lower() for item in tag.get("class", [])}
    element_id = (tag.get("id") or "").lower()
    if classes & style_hints["animated_classes"]:
        return True
    if element_id and element_id in style_hints["animated_ids"]:
        return True
    if any(hint in class_name for class_name in classes for hint in ANIMATED_CLASS_HINTS):
        return True

    combined = " ".join(
        [
            tag.get("id", ""),
            " ".join(tag.get("class", [])),
            tag.get("style", ""),
            " ".join(str(tag.get(attr, "")) for attr in ["data-animation", "data-aos", "data-swiper", "role"]),
        ]
    ).lower()

    strong_hints = ("carousel", "slider", "swiper", "marquee", "animate", "animation", "rotator", "ticker")
    if any(hint in combined for hint in strong_hints):
        return True

    style = tag.get("style", "").lower()
    return "animation" in style


def has_autoplay_media(tag: Tag) -> bool:
    if tag.name in {"video", "audio"}:
        return tag.has_attr("autoplay")
    if tag.name == "iframe":
        src = tag.get("src", "").lower()
        return "autoplay=1" in src or "autoplay=true" in src
    return False


def looks_like_cta(tag: Tag, style_hints: dict[str, set[str]]) -> bool:
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

    classes = {item.lower() for item in tag.get("class", [])}
    element_id = (tag.get("id") or "").lower()
    score = 0
    if any(keyword in combined for keyword in CTA_PRIMARY_HINTS):
        score += 2
    if any(phrase in label for phrase in CTA_TEXT_HINTS):
        score += 2
    if classes & style_hints["primary_cta_classes"]:
        score += 2
    if element_id and element_id in style_hints["primary_cta_ids"]:
        score += 2
    if any(class_name in {"btn-main", "main-btn", "primary-btn", "hero-cta"} for class_name in classes):
        score += 2

    style = tag.get("style", "").lower()
    if "background" in style or "font-weight:bold" in style or "font-weight: bold" in style:
        score += 1

    is_button_like = tag.get("role", "").lower() == "button"
    is_submit_input = tag.name == "input" and tag.get("type", "").lower() == "submit"
    is_submit_button = tag.name == "button" and tag.get("type", "").lower() == "submit"
    if is_button_like:
        score += 1
    if is_submit_input or is_submit_button:
        score += 2

    if tag.name == "button":
        score += 1

    return score >= PRIMARY_CTA_SCORE_THRESHOLD


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
        classes = {item.lower() for item in cta.get("class", [])}
        if any(hint in combined for hint in CTA_PRIMARY_HINTS) or any(
            class_name in {"btn-main", "main-btn", "primary-btn", "hero-cta"}
            for class_name in classes
        ):
            prominent_cta_count += 1

    if cta_count >= 5:
        return "critical"

    if cta_count >= 4 or prominent_cta_count >= 2:
        return "major"

    if any(tag_name in region_summary for tag_name in ("header", "hero", "main")):
        return "major"

    return "minor"


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


def get_region_primary_ctas(
    region: Tag,
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
) -> list[Tag]:
    ctas: list[Tag] = []
    for tag in region.find_all(["button", "a", "input"]):
        if not looks_like_cta(tag, style_hints):
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


def extract_style_hints(soup: BeautifulSoup) -> dict[str, set[str]]:
    animated_classes: set[str] = set()
    animated_ids: set[str] = set()
    primary_cta_classes: set[str] = set()
    primary_cta_ids: set[str] = set()

    for style_tag in soup.find_all("style"):
        css = style_tag.get_text(" ", strip=True)
        for selector_group, declarations in STYLE_RULE_PATTERN.findall(css):
            normalized_declarations = declarations.lower()
            selector_classes = {match.lower() for match in CLASS_SELECTOR_PATTERN.findall(selector_group)}
            selector_ids = {match.lower() for match in ID_SELECTOR_PATTERN.findall(selector_group)}

            if "animation" in normalized_declarations:
                animated_classes.update(selector_classes)
                animated_ids.update(selector_ids)

            if "background" in normalized_declarations or "font-weight" in normalized_declarations:
                if any(
                    hint in selector_group.lower()
                    for hint in ("cta", "primary", "btn-main", "main-btn", "hero-cta", "submit")
                ):
                    primary_cta_classes.update(selector_classes)
                    primary_cta_ids.update(selector_ids)

    return {
        "animated_classes": animated_classes,
        "animated_ids": animated_ids,
        "primary_cta_classes": primary_cta_classes,
        "primary_cta_ids": primary_cta_ids,
    }


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
