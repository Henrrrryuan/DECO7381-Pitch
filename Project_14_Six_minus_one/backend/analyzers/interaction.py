from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, Tag


DIMENSION_NAME = "Interaction & Distraction"

SEVERITY_MULTIPLIER = {
    "minor": 1,
    "major": 2,
    "critical": 3,
}

BASE_PENALTY = {
    "ID-1": 4,
    "ID-2": 3,
    "ID-3": 3,
}

CTA_HINTS = [
    "btn",
    "button",
    "cta",
    "primary",
    "action",
    "submit",
]

CTA_TEXT_HINTS = [
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
]

ANIMATION_HINTS = [
    "carousel",
    "slider",
    "swiper",
    "marquee",
    "animate",
    "animation",
    "motion",
    "rotator",
    "ticker",
]

CONTAINER_TAGS = ["section", "form", "article", "main", "header", "nav", "aside"]


@dataclass
class Issue:
    rule_id: str
    rule_name: str
    severity: str
    penalty: int
    message: str
    reason: str
    suggestion: str
    evidence: dict[str, Any]


def make_issue(
    rule_id: str,
    rule_name: str,
    severity: str,
    message: str,
    reason: str,
    suggestion: str,
    evidence: dict[str, Any] | None = None,
) -> Issue:
    return Issue(
        rule_id=rule_id,
        rule_name=rule_name,
        severity=severity,
        penalty=BASE_PENALTY[rule_id] * SEVERITY_MULTIPLIER[severity],
        message=message,
        reason=reason,
        suggestion=suggestion,
        evidence=evidence or {},
    )


def analyze_interaction_distraction(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")

    issues: list[Issue] = []
    issues.extend(detect_autoplay_media(soup))
    issues.extend(detect_too_many_animated_elements(soup))
    issues.extend(detect_cta_competition(soup))

    total_penalty = sum(issue.penalty for issue in issues)
    score = max(0, 100 - total_penalty)

    return {
        "dimension": DIMENSION_NAME,
        "score": score,
        "total_penalty": total_penalty,
        "issue_count": len(issues),
        "issues": [asdict(issue) for issue in issues],
    }


def detect_autoplay_media(soup: BeautifulSoup) -> list[Issue]:
    issues: list[Issue] = []

    for video in soup.select("video[autoplay]"):
        muted = video.has_attr("muted")
        severity = "major" if muted else "critical"
        issues.append(
            make_issue(
                rule_id="ID-1",
                rule_name="Autoplay Media",
                severity=severity,
                message="Detected autoplay video.",
                reason=(
                    "Autoplay video can pull attention away from the main task "
                    "before the user has understood the page structure."
                ),
                suggestion=(
                    "Disable autoplay by default. If autoplay is necessary, mute "
                    "the video and avoid placing it in the primary task area."
                ),
                evidence={
                    "tag": "video",
                    "muted": muted,
                    "html_snippet": get_tag_snippet(video),
                },
            )
        )

    for audio in soup.select("audio[autoplay]"):
        issues.append(
            make_issue(
                rule_id="ID-1",
                rule_name="Autoplay Media",
                severity="critical",
                message="Detected autoplay audio.",
                reason=(
                    "Autoplay audio is highly disruptive and can interrupt reading, "
                    "orientation, and task focus immediately."
                ),
                suggestion="Require explicit user action to start audio playback.",
                evidence={
                    "tag": "audio",
                    "html_snippet": get_tag_snippet(audio),
                },
            )
        )

    for iframe in soup.find_all("iframe"):
        src = iframe.get("src", "")
        src_lower = src.lower()
        if "autoplay=1" in src_lower or "autoplay=true" in src_lower:
            issues.append(
                make_issue(
                    rule_id="ID-1",
                    rule_name="Autoplay Media",
                    severity="major",
                    message="Detected embedded media with autoplay enabled.",
                    reason=(
                        "Embedded autoplay media can distract users before they establish "
                        "focus on the main content."
                    ),
                    suggestion=(
                        "Disable autoplay in embedded media unless it is essential to the "
                        "user's primary task."
                    ),
                    evidence={
                        "tag": "iframe",
                        "src": src,
                        "html_snippet": get_tag_snippet(iframe),
                    },
                )
            )

    return issues


def detect_too_many_animated_elements(soup: BeautifulSoup) -> list[Issue]:
    issues: list[Issue] = []
    candidate_regions = get_candidate_regions(soup)

    for region in candidate_regions:
        animated_tags = [tag for tag in region.find_all(True) if looks_animated(tag)]
        if len(animated_tags) <= 2:
            continue

        if len(animated_tags) <= 4:
            severity = "major"
        else:
            severity = "critical"

        issues.append(
            make_issue(
                rule_id="ID-2",
                rule_name="Too Many Animated Elements",
                severity=severity,
                message=f"Detected {len(animated_tags)} animated or motion-heavy elements in the same region.",
                reason=(
                    "Multiple moving or motion-signalling elements can compete for attention "
                    "and reduce focus on the main content."
                ),
                suggestion=(
                    "Reduce non-essential motion, limit auto-rotating components, and keep "
                    "only one necessary animated element in the main task area."
                ),
                evidence={
                    "animated_count": len(animated_tags),
                    "region": get_tag_summary(region),
                    "examples": [get_tag_summary(tag) for tag in animated_tags[:5]],
                    "note": (
                        "This MVP checks each major content region separately as a proxy "
                        "for same-viewport distraction risk."
                    ),
                },
            )
        )

    return issues


def detect_cta_competition(soup: BeautifulSoup) -> list[Issue]:
    issues: list[Issue] = []
    containers = soup.find_all(CONTAINER_TAGS)

    for container in containers:
        ctas = get_region_primary_ctas(container)
        if len(ctas) <= 2:
            continue

        severity = classify_cta_severity(container, ctas)

        issues.append(
            make_issue(
                rule_id="ID-3",
                rule_name="CTA Competition",
                severity=severity,
                message=f"Detected {len(ctas)} CTA-like controls in the same region.",
                reason=(
                    "Multiple competing calls-to-action increase decision burden and make "
                    "it harder to identify the primary next step."
                ),
                suggestion=(
                    "Keep one primary CTA and downgrade the others to secondary buttons "
                    "or text links."
                ),
                evidence={
                    "cta_count": len(ctas),
                    "container": get_tag_summary(container),
                    "cta_examples": [get_cta_label(tag) for tag in ctas[:5]],
                },
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
            " ".join(
                str(tag.get(attr, ""))
                for attr in ["data-animation", "data-aos", "data-swiper", "role"]
            ),
        ]
    ).lower()

    if any(hint in combined for hint in ANIMATION_HINTS):
        return True

    style = tag.get("style", "").lower()
    if "animation" in style or "transition" in style:
        return True

    return False


def looks_like_cta(tag: Tag) -> bool:
    if not isinstance(tag, Tag):
        return False

    class_text = " ".join(tag.get("class", []))
    id_text = tag.get("id", "")
    role_text = tag.get("role", "")
    style_text = tag.get("style", "")
    combined = f"{class_text} {id_text} {role_text} {style_text}".lower()
    text = normalize_text(
        tag.get_text(" ", strip=True)
        or tag.get("aria-label", "")
        or tag.get("title", "")
        or tag.get("value", "")
    ).lower()

    has_primary_hint = any(keyword in combined for keyword in CTA_HINTS)
    has_action_text = any(phrase in text for phrase in CTA_TEXT_HINTS)

    if tag.name == "button":
        return has_primary_hint or has_action_text

    if tag.name == "input" and tag.get("type", "").lower() in {"submit", "button"}:
        return has_primary_hint or has_action_text

    if tag.name == "a":
        return has_primary_hint or has_action_text

    return False


def classify_cta_severity(container: Tag, ctas: list[Tag]) -> str:
    cta_count = len(ctas)
    container_summary = get_tag_summary(container).lower()
    labels = [get_cta_label(tag).lower() for tag in ctas]

    prominent_cta_count = 0
    for cta in ctas:
        combined = " ".join(
            [
                cta.get("id", ""),
                " ".join(cta.get("class", [])),
                cta.get("style", ""),
            ]
        ).lower()
        if any(hint in combined for hint in ["primary", "cta", "hero", "main", "action"]):
            prominent_cta_count += 1

    if cta_count >= 4:
        return "critical"

    if prominent_cta_count >= 2:
        return "critical"

    if any(tag in container_summary for tag in ["header", "hero", "main"]):
        return "major"

    if len(set(labels)) < len(labels):
        return "major"

    return "major"


def get_cta_label(tag: Tag) -> str:
    if tag.name == "input":
        return normalize_text(tag.get("value", "") or tag.get("aria-label", "") or tag.get("name", ""))
    return normalize_text(tag.get_text(" ", strip=True) or tag.get("aria-label", "") or tag.get("title", ""))


def get_candidate_regions(soup: BeautifulSoup) -> list[Tag]:
    body = soup.body
    if body is None:
        return []

    regions: list[Tag] = []
    for selector in ["header", "main", "section", "article", "form"]:
        regions.extend(body.find_all(selector))

    if regions:
        return regions

    direct_children = [child for child in body.find_all(recursive=False) if isinstance(child, Tag)]
    if direct_children:
        return direct_children

    return [body]


def get_region_primary_ctas(container: Tag) -> list[Tag]:
    ctas: list[Tag] = []
    for tag in container.find_all(["button", "a", "input"]):
        if not looks_like_cta(tag):
            continue

        nearest = get_nearest_container_ancestor(tag)
        if nearest is container:
            ctas.append(tag)

    return ctas


def get_nearest_container_ancestor(tag: Tag) -> Tag | None:
    current = tag
    while current is not None:
        if isinstance(current, Tag) and current.name in CONTAINER_TAGS:
            return current
        current = current.parent
    return None


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
    result = analyze_interaction_distraction(html)

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
