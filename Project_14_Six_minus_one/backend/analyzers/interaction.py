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
)

CTA_TEXT_HINTS = (
    "buy now",
    "get started",
    "sign up",
    "download",
    "create account",
    "checkout",
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
    "carousel",
    "slider",
    "swiper",
    "ticker",
    "marquee",
)

JS_AUTOPLAY_PATTERN = re.compile(
    r"autoplay\s*[:=]\s*(?:true|1)|\.play\s*\(",
    re.IGNORECASE,
)
JS_MOTION_PATTERN = re.compile(
    r"new\s+Swiper\s*\(|carousel|slider|marquee|requestAnimationFrame\s*\(|setInterval\s*\(|gsap|anime\s*\(",
    re.IGNORECASE,
)
JS_CTA_PATTERN = re.compile(
    r"createElement\s*\(\s*['\"]button['\"]\s*\)|insertAdjacentHTML\s*\(|innerHTML\s*=|appendChild\s*\(|classList\.add\s*\([^)]*(cta|primary|hero-cta)",
    re.IGNORECASE,
)

STYLE_RULE_PATTERN = re.compile(r"([^{]+)\{([^}]*)\}", re.DOTALL)
CLASS_SELECTOR_PATTERN = re.compile(r"\.([A-Za-z0-9_-]+)")
ID_SELECTOR_PATTERN = re.compile(r"#([A-Za-z0-9_-]+)")
SEVERITY_RANK: dict[Severity, int] = {"minor": 1, "major": 2, "critical": 3}


def analyze_interaction(html: str, js_sources: list[str] | None = None) -> DimensionResult:
    """Analyze interaction and distraction risks for HTML input.

    Scope limits:
    - Supports HTML files or HTML snippets only
    - Detects proxy indicators of distraction and cognitive load
    - Does not model human cognition or provide compliance certification
    """

    soup = BeautifulSoup(html or "", "html.parser")

    candidate_regions = get_candidate_regions(soup)
    style_hints = extract_style_hints(soup)
    js_hints = extract_js_hints(js_sources or [])

    issues = [
        issue
        for issue in (
            detect_id1_autoplay_media(soup, js_hints)
            + detect_id2_too_many_animated_elements(candidate_regions, style_hints, js_hints)
            + detect_id3_cta_competition(candidate_regions, style_hints, js_hints)
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
            "js_signal_summary": {
                "autoplay_signals": js_hints["autoplay_count"],
                "motion_signals": js_hints["motion_count"],
                "cta_injection_signals": js_hints["cta_count"],
            },
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


def detect_id1_autoplay_media(
    soup: BeautifulSoup,
    js_hints: dict[str, Any],
) -> list[Issue]:
    autoplay_locations: list[dict[str, Any]] = []
    autoplay_videos = 0
    autoplay_muted_videos = 0
    autoplay_audios = 0
    autoplay_iframes = 0

    for video in soup.select("video[autoplay]"):
        autoplay_videos += 1
        muted = video.has_attr("muted")
        if muted:
            autoplay_muted_videos += 1
        autoplay_locations.append(
            {
                "summary": get_tag_summary(video),
                "html_snippet": get_tag_snippet(video),
                "tag": "video",
                "muted": muted,
            }
        )

    for audio in soup.select("audio[autoplay]"):
        autoplay_audios += 1
        autoplay_locations.append(
            {
                "summary": get_tag_summary(audio),
                "html_snippet": get_tag_snippet(audio),
                "tag": "audio",
                "muted": audio.has_attr("muted"),
            }
        )

    for iframe in soup.find_all("iframe"):
        src = iframe.get("src", "")
        src_lower = src.lower()
        if "autoplay=1" in src_lower or "autoplay=true" in src_lower:
            autoplay_iframes += 1
            autoplay_locations.append(
                {
                    "summary": get_tag_summary(iframe),
                    "html_snippet": get_tag_snippet(iframe),
                    "tag": "iframe",
                    "src": src,
                }
            )

    total_autoplay_media = autoplay_videos + autoplay_audios + autoplay_iframes
    js_autoplay_count = js_hints["autoplay_count"]
    if total_autoplay_media == 0 and js_autoplay_count == 0:
        return []

    has_unmuted_video = autoplay_videos > autoplay_muted_videos
    if autoplay_audios >= 1 or total_autoplay_media >= 3 or has_unmuted_video or js_autoplay_count >= 2:
        severity: Severity = "critical"
    elif total_autoplay_media >= 2 or autoplay_iframes >= 1 or js_autoplay_count >= 1:
        severity = "major"
    else:
        severity = "minor"

    locations = autoplay_locations[:5]
    for sample in js_hints["autoplay_samples"][:2]:
        locations.append(
            {
                "summary": "script-triggered autoplay signal",
                "html_snippet": sample,
                "tag": "script",
            }
        )

    return [
        build_issue(
            rule_id="ID-1",
            title="Autoplay media",
            severity=severity,
            base_penalty=SERIOUS_BASE_PENALTY,
            description="The page contains autoplay media, which can interrupt attention before users understand the page structure and can increase cognitive load.",
            suggestion="Disable autoplay by default. Only consider using it when it is directly related to the main task, and prefer a user-initiated trigger instead.",
            evidence={
                "autoplay_video_count": autoplay_videos,
                "autoplay_muted_video_count": autoplay_muted_videos,
                "autoplay_audio_count": autoplay_audios,
                "autoplay_iframe_count": autoplay_iframes,
                "total_autoplay_media": total_autoplay_media,
                "js_autoplay_signal_count": js_autoplay_count,
            },
            locations=locations,
        )
    ]


def detect_id2_too_many_animated_elements(
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
    js_hints: dict[str, Any],
) -> list[Issue]:
    violating_regions: list[dict[str, Any]] = []

    for region in candidate_regions:
        animated_tags = get_region_scoped_tags(
            region,
            candidate_regions,
            lambda tag: looks_distracting_animation(tag, style_hints),
        )
        animated_count = len(animated_tags)
        if animated_count <= ANIMATION_THRESHOLD:
            continue
        violating_regions.append(
            {
                "region": region,
                "animated_count": animated_count,
                "animated_tags": animated_tags,
            }
        )

    js_motion_count = js_hints["motion_count"]
    if not violating_regions and js_motion_count == 0:
        return []

    max_animated_count = max((item["animated_count"] for item in violating_regions), default=0)
    total_animated_elements = sum(item["animated_count"] for item in violating_regions)
    effective_motion_count = max_animated_count + js_motion_count
    if effective_motion_count >= 6 or len(violating_regions) >= 3 or js_motion_count >= 3:
        severity: Severity = "critical"
    elif effective_motion_count >= 4 or len(violating_regions) >= 2 or js_motion_count >= 2:
        severity = "major"
    else:
        severity = "minor"

    locations: list[dict[str, Any]] = []
    region_summaries: list[dict[str, Any]] = []
    for item in sorted(violating_regions, key=lambda region: region["animated_count"], reverse=True):
        region_summaries.append(
            {
                "region": get_tag_summary(item["region"]),
                "animated_count": item["animated_count"],
            }
        )
        for tag in item["animated_tags"][:3]:
            locations.append(
                {
                    "summary": get_tag_summary(tag),
                    "html_snippet": get_tag_snippet(tag),
                    "region": get_tag_summary(item["region"]),
                }
            )

    for sample in js_hints["motion_samples"][:2]:
        locations.append(
            {
                "summary": "script-driven motion signal",
                "html_snippet": sample,
                "region": "script",
            }
        )

    return [
        build_issue(
            rule_id="ID-2",
            title="Too many animated elements",
            severity=severity,
            base_penalty=REGULAR_BASE_PENALTY,
            description="The page has regions where animated elements exceed the threshold, so multiple moving objects compete for attention and weaken focus on the main task.",
            suggestion="Reduce non-essential motion, limit auto-rotating or continuously moving components, and try to keep each main region to 1 or 2 animated elements.",
            evidence={
                "threshold": ANIMATION_THRESHOLD,
                "violating_region_count": len(violating_regions),
                "max_animated_count_in_region": max_animated_count,
                "js_motion_signal_count": js_motion_count,
                "effective_motion_count": effective_motion_count,
                "total_animated_elements_in_violating_regions": total_animated_elements,
                "regions": region_summaries[:5],
                "note": "The MVP uses major content regions as an approximate proxy for a shared viewport.",
            },
            locations=locations[:5],
        )
    ]


def detect_id3_cta_competition(
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
    js_hints: dict[str, Any],
) -> list[Issue]:
    violating_regions: list[dict[str, Any]] = []

    for region in candidate_regions:
        ctas = get_region_primary_ctas(region, candidate_regions, style_hints)
        cta_count = len(ctas)
        if cta_count <= CTA_THRESHOLD:
            continue

        violating_regions.append(
            {
                "region": region,
                "ctas": ctas,
                "cta_count": cta_count,
            }
        )

    js_cta_count = js_hints["cta_count"]
    if not violating_regions and js_cta_count == 0:
        return []

    highest_risk_region = (
        max(
            violating_regions,
            key=lambda item: (
                SEVERITY_RANK[classify_cta_severity(item["region"], item["ctas"])],
                item["cta_count"],
            ),
        )
        if violating_regions
        else None
    )
    max_cta_count = max((item["cta_count"] for item in violating_regions), default=0)
    effective_cta_count = max_cta_count + js_cta_count
    if effective_cta_count >= 5 or len(violating_regions) >= 3 or js_cta_count >= 3:
        severity: Severity = "critical"
    elif effective_cta_count >= 4 or len(violating_regions) >= 2 or js_cta_count >= 2:
        severity = "major"
    else:
        severity = (
            classify_cta_severity(highest_risk_region["region"], highest_risk_region["ctas"])
            if highest_risk_region is not None
            else "minor"
        )

    locations: list[dict[str, Any]] = []
    region_summaries: list[dict[str, Any]] = []
    for item in sorted(violating_regions, key=lambda region: region["cta_count"], reverse=True):
        region_summaries.append(
            {
                "region": get_tag_summary(item["region"]),
                "cta_count": item["cta_count"],
                "cta_examples": [get_cta_label(tag) or get_tag_summary(tag) for tag in item["ctas"][:3]],
            }
        )
        for tag in item["ctas"][:3]:
            locations.append(
                {
                    "summary": get_tag_summary(tag),
                    "label": get_cta_label(tag),
                    "region": get_tag_summary(item["region"]),
                }
            )

    for sample in js_hints["cta_samples"][:2]:
        locations.append(
            {
                "summary": "script-generated CTA signal",
                "label": "dynamic button injection",
                "region": "script",
                "html_snippet": sample,
            }
        )

    return [
        build_issue(
            rule_id="ID-3",
            title="Competing CTAs",
            severity=severity,
            base_penalty=REGULAR_BASE_PENALTY,
            description="The page has regions with more than 2 primary action buttons, which can increase decision load and make the next step harder to identify.",
            suggestion="Keep 1 primary CTA in each main region where possible, and convert the others into secondary buttons or text links to clarify action hierarchy.",
            evidence={
                "threshold": CTA_THRESHOLD,
                "violating_region_count": len(violating_regions),
                "max_cta_count_in_region": max_cta_count,
                "js_cta_signal_count": js_cta_count,
                "effective_cta_count": effective_cta_count,
                "regions": region_summaries[:5],
            },
            locations=locations[:5],
        )
    ]


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

    if tag.name == "input" and tag.get("type", "").lower() not in {"submit", "button"}:
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
    if any(class_name in {"btn-primary", "primary-btn", "hero-cta"} for class_name in classes):
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
            class_name in {"btn-primary", "primary-btn", "hero-cta"}
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
                if any(hint in selector_group.lower() for hint in ("cta", "primary", "hero", "submit", "btn")):
                    primary_cta_classes.update(selector_classes)
                    primary_cta_ids.update(selector_ids)

    return {
        "animated_classes": animated_classes,
        "animated_ids": animated_ids,
        "primary_cta_classes": primary_cta_classes,
        "primary_cta_ids": primary_cta_ids,
    }


def extract_js_hints(js_sources: list[str]) -> dict[str, Any]:
    autoplay_samples: list[str] = []
    motion_samples: list[str] = []
    cta_samples: list[str] = []

    autoplay_count = 0
    motion_count = 0
    cta_count = 0

    for source in js_sources:
        normalized = normalize_text(source)
        if not normalized:
            continue

        autoplay_matches = JS_AUTOPLAY_PATTERN.findall(source)
        motion_matches = JS_MOTION_PATTERN.findall(source)
        cta_matches = JS_CTA_PATTERN.findall(source)

        autoplay_count += len(autoplay_matches)
        motion_count += len(motion_matches)
        cta_count += len(cta_matches)

        if autoplay_matches and len(autoplay_samples) < 3:
            autoplay_samples.append(source[:180].strip())
        if motion_matches and len(motion_samples) < 3:
            motion_samples.append(source[:180].strip())
        if cta_matches and len(cta_samples) < 3:
            cta_samples.append(source[:180].strip())

    return {
        "autoplay_count": autoplay_count,
        "motion_count": motion_count,
        "cta_count": cta_count,
        "autoplay_samples": autoplay_samples,
        "motion_samples": motion_samples,
        "cta_samples": cta_samples,
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
