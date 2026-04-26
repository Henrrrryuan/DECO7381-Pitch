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
    from backend.scoring import (
        PENALTY_FORMULA_TEXT,
        SCORING_FORMULA_TEXT,
        calculate_dimension_score,
        calculate_penalty,
    )
else:
    from ..schemas import DimensionResult, Issue, Severity
    from ..scoring import (
        PENALTY_FORMULA_TEXT,
        SCORING_FORMULA_TEXT,
        calculate_dimension_score,
        calculate_penalty,
    )

DIMENSION_NAME = "Interaction & Distraction"

REGULAR_BASE_PENALTY = 3
SERIOUS_BASE_PENALTY = 4

ANIMATION_THRESHOLD = 2
INTERRUPTION_SCORE_THRESHOLD = 4

INTERRUPTION_HINTS = (
    "popup",
    "modal",
    "dialog",
    "overlay",
    "toast",
    "notification",
    "chat",
    "consent",
    "cookie",
    "sticky",
    "drawer",
    "interstitial",
)
NON_INTERRUPTIVE_HINTS = (
    "launcher",
    "bubble",
    "fab",
    "chip",
)
DISMISS_LABEL_HINTS = (
    "close",
    "dismiss",
    "accept",
    "allow",
    "continue",
    "got it",
    "ok",
)
HIGH_Z_INDEX_PATTERN = re.compile(r"z-index\s*:\s*([1-9][0-9]{2,})", re.IGNORECASE)
FIXED_STICKY_PATTERN = re.compile(r"position\s*:\s*(fixed|sticky)", re.IGNORECASE)
FULL_SCREEN_PATTERN = re.compile(
    r"(inset\s*:\s*0|top\s*:\s*0[^;]*bottom\s*:\s*0|width\s*:\s*100(?:vw|%)|height\s*:\s*100(?:vh|%))",
    re.IGNORECASE,
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
PRIMARY_REGION_TAGS = ("main", "article", "form")

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
JS_INTERRUPTION_PATTERN = re.compile(
    r"showModal\s*\(|modal|popup|toast|notification|cookie|consent|chat|interstitial|overlay|drawer|body\.style\.overflow\s*=\s*['\"]hidden['\"]|classList\.add\s*\([^)]*(modal-open|no-scroll|overflow-hidden)",
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
            + detect_id3_dynamic_interruptions(soup, candidate_regions, style_hints, js_hints)
        )
        if issue is not None
    ]

    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score(DIMENSION_NAME, total_penalty)

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
                "interruption_signals": js_hints["interruption_count"],
            },
            "total_penalty": total_penalty,
            "scoring_model": {
                "formula": SCORING_FORMULA_TEXT,
                "penalty_formula": PENALTY_FORMULA_TEXT,
                "dimension_penalty_cap": 30,
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
            description="Autoplay media can capture attention before users understand the page structure. Unexpected sound or motion may interrupt comprehension, create sensory distraction, and reduce users' sense of control.",
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
            description="Multiple moving elements compete for sustained attention and can repeatedly pull focus away from the main task. This increases task-switching effort and may be especially disruptive for users with attention regulation difficulties.",
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


def detect_id3_dynamic_interruptions(
    soup: BeautifulSoup,
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
    js_hints: dict[str, Any],
) -> list[Issue]:
    primary_region = infer_primary_task_region(soup, candidate_regions)
    interruption_candidates: list[dict[str, Any]] = []

    for tag in soup.find_all(True):
        if has_interruption_candidate_ancestor(tag, style_hints):
            continue
        candidate = describe_interruption_candidate(tag, primary_region, style_hints)
        if candidate is None:
            continue
        if candidate["interrupt_score"] >= INTERRUPTION_SCORE_THRESHOLD:
            interruption_candidates.append(candidate)

    js_interrupt_count = js_hints["interruption_count"]
    if not interruption_candidates and js_interrupt_count == 0:
        return []

    max_interrupt_score = max((item["interrupt_score"] for item in interruption_candidates), default=0)
    severe_interrupt_present = any(
        item["blocks_scroll"] and item["covers_primary_region"]
        for item in interruption_candidates
    )

    if severe_interrupt_present or max_interrupt_score >= 7 or len(interruption_candidates) >= 3 or js_interrupt_count >= 3:
        severity: Severity = "critical"
    elif (
        max_interrupt_score >= 5
        or len(interruption_candidates) >= 2
        or js_interrupt_count >= 2
        or any(item["overlay_like"] and item["initial_load_visible"] for item in interruption_candidates)
    ):
        severity = "major"
    else:
        severity = "minor"

    locations: list[dict[str, Any]] = []
    candidate_summaries: list[dict[str, Any]] = []
    for item in sorted(interruption_candidates, key=lambda candidate: candidate["interrupt_score"], reverse=True):
        candidate_summaries.append(
            {
                "interrupt_type": item["interrupt_type"],
                "summary": item["summary"],
                "interrupt_score": item["interrupt_score"],
                "initial_load_visible": item["initial_load_visible"],
                "fixed_or_sticky": item["fixed_or_sticky"],
                "overlay_like": item["overlay_like"],
                "blocks_scroll": item["blocks_scroll"],
                "covers_primary_region": item["covers_primary_region"],
            }
        )
        locations.append(
            {
                "summary": item["summary"],
                "html_snippet": item["html_snippet"],
                "interrupt_type": item["interrupt_type"],
                "initial_load_visible": item["initial_load_visible"],
                "fixed_or_sticky": item["fixed_or_sticky"],
                "overlay_like": item["overlay_like"],
                "blocks_scroll": item["blocks_scroll"],
                "takes_focus": item["takes_focus"],
                "covers_primary_region": item["covers_primary_region"],
                "dismiss_required": item["dismiss_required"],
            }
        )

    for sample in js_hints["interruption_samples"][:2]:
        locations.append(
            {
                "summary": "scripted interruption signal",
                "html_snippet": sample,
                "interrupt_type": "script",
            }
        )

    primary_region_summary = get_tag_summary(primary_region) if primary_region is not None else "body"

    return [
        build_issue(
            rule_id="ID-3",
            title="Dynamic interruptions shift attention away from the main task",
            severity=severity,
            base_penalty=REGULAR_BASE_PENALTY,
            description="Popups, sticky prompts, overlays, or similar dynamic layers can interrupt the current reading or task path before users are ready. This sudden attention shift can be especially disruptive when it covers the main content, captures focus, or requires dismissal before the page can be used normally.",
            suggestion="Reserve popups, sticky prompts, and overlay CTAs for essential moments only. Avoid showing them on initial load when they cover the main task path, and keep optional prompts collapsed until the user asks for them.",
            evidence={
                "primary_region": primary_region_summary,
                "interrupting_element_count": len(interruption_candidates),
                "max_interrupt_score": max_interrupt_score,
                "js_interruption_signal_count": js_interrupt_count,
                "elements": candidate_summaries[:5],
            },
            locations=locations[:5],
        )
    ]


def infer_primary_task_region(soup: BeautifulSoup, candidate_regions: list[Tag]) -> Tag | None:
    for tag_name in PRIMARY_REGION_TAGS:
        for region in candidate_regions:
            if region.name == tag_name:
                return region

    for region in candidate_regions:
        if region.find(["h1", "h2"]):
            return region

    if candidate_regions:
        return candidate_regions[0]

    root = soup.body if soup.body is not None else soup
    return root if isinstance(root, Tag) else None


def has_interruption_candidate_ancestor(tag: Tag, style_hints: dict[str, set[str]]) -> bool:
    current = tag.parent
    while isinstance(current, Tag):
        if looks_like_interruption_candidate(current, style_hints):
            return True
        current = current.parent
    return False


def describe_interruption_candidate(
    tag: Tag,
    primary_region: Tag | None,
    style_hints: dict[str, set[str]],
) -> dict[str, Any] | None:
    if not looks_like_interruption_candidate(tag, style_hints):
        return None

    initial_load_visible = is_initially_visible(tag)
    if not initial_load_visible:
        return None

    if is_non_interruptive_launcher(tag):
        return None

    fixed_or_sticky = has_fixed_or_sticky(tag, style_hints)
    overlay_like = is_overlay_like(tag)
    takes_focus = takes_focus_like(tag)
    dismiss_required = has_dismiss_control(tag)
    blocks_scroll = blocks_page_scroll(tag)
    motion_related = candidate_has_attention_grabbing_motion(tag, style_hints)
    covers_primary_region = covers_primary_task_proxy(tag, primary_region, fixed_or_sticky, overlay_like)

    interrupt_score = 1
    if fixed_or_sticky:
        interrupt_score += 1
    if overlay_like:
        interrupt_score += 2
    if takes_focus:
        interrupt_score += 1
    if dismiss_required:
        interrupt_score += 1
    if blocks_scroll:
        interrupt_score += 2
    if covers_primary_region:
        interrupt_score += 2
    if motion_related:
        interrupt_score += 1

    return {
        "tag": tag,
        "summary": get_tag_summary(tag),
        "html_snippet": get_tag_snippet(tag),
        "interrupt_type": classify_interrupt_type(tag),
        "interrupt_score": interrupt_score,
        "initial_load_visible": initial_load_visible,
        "fixed_or_sticky": fixed_or_sticky,
        "overlay_like": overlay_like,
        "takes_focus": takes_focus,
        "dismiss_required": dismiss_required,
        "blocks_scroll": blocks_scroll,
        "covers_primary_region": covers_primary_region,
        "motion_related": motion_related,
    }


def looks_like_interruption_candidate(tag: Tag, style_hints: dict[str, set[str]]) -> bool:
    if not isinstance(tag, Tag):
        return False

    if tag.name == "dialog":
        return True

    attrs_text = interruption_context_text(tag)
    classes = {item.lower() for item in tag.get("class", [])}
    element_id = (tag.get("id") or "").lower()
    role = (tag.get("role") or "").lower()
    aria_live = (tag.get("aria-live") or "").lower()

    if role in {"dialog", "alertdialog"}:
        return True
    if tag.get("aria-modal", "").lower() == "true":
        return True
    if aria_live in {"assertive", "polite"}:
        return True
    if classes & style_hints["fixed_classes"]:
        return True
    if element_id and element_id in style_hints["fixed_ids"]:
        return True
    if FIXED_STICKY_PATTERN.search(tag.get("style", "")):
        return True
    if HIGH_Z_INDEX_PATTERN.search(tag.get("style", "")):
        return True
    return any(hint in attrs_text for hint in INTERRUPTION_HINTS)


def interruption_context_text(tag: Tag) -> str:
    return " ".join(
        [
            tag.name or "",
            tag.get("id", ""),
            " ".join(tag.get("class", [])),
            tag.get("role", ""),
            tag.get("style", ""),
            tag.get("aria-label", ""),
            tag.get("aria-live", ""),
            tag.get("aria-modal", ""),
            tag.get("title", ""),
        ]
    ).lower()


def is_initially_visible(tag: Tag) -> bool:
    if tag.has_attr("hidden"):
        return False
    if tag.get("aria-hidden", "").lower() == "true":
        return False
    if tag.name == "dialog" and not tag.has_attr("open"):
        return False

    style = tag.get("style", "").lower().replace(" ", "")
    if any(fragment in style for fragment in ("display:none", "visibility:hidden", "opacity:0")):
        return False

    attrs_text = interruption_context_text(tag)
    return not any(keyword in attrs_text for keyword in ("hidden", "collapsed", "is-hidden", "sr-only"))


def is_non_interruptive_launcher(tag: Tag) -> bool:
    attrs_text = interruption_context_text(tag)
    if tag.get("aria-modal", "").lower() == "true" or (tag.get("role") or "").lower() in {"dialog", "alertdialog"}:
        return False
    if tag.get("aria-expanded", "").lower() == "true":
        return False

    descendant_count = len(tag.find_all(True))
    text_length = len(normalize_text(tag.get_text(" ", strip=True)))
    return (
        any(hint in attrs_text for hint in NON_INTERRUPTIVE_HINTS)
        and descendant_count <= 3
        and text_length <= 24
    )


def has_fixed_or_sticky(tag: Tag, style_hints: dict[str, set[str]]) -> bool:
    classes = {item.lower() for item in tag.get("class", [])}
    element_id = (tag.get("id") or "").lower()
    if classes & style_hints["fixed_classes"]:
        return True
    if element_id and element_id in style_hints["fixed_ids"]:
        return True
    return bool(FIXED_STICKY_PATTERN.search(tag.get("style", "")))


def is_overlay_like(tag: Tag) -> bool:
    attrs_text = interruption_context_text(tag)
    style = tag.get("style", "")
    return (
        tag.name == "dialog"
        or (tag.get("role") or "").lower() in {"dialog", "alertdialog"}
        or tag.get("aria-modal", "").lower() == "true"
        or any(hint in attrs_text for hint in ("overlay", "modal", "popup", "dialog", "interstitial", "lightbox"))
        or bool(FULL_SCREEN_PATTERN.search(style))
    )


def takes_focus_like(tag: Tag) -> bool:
    role = (tag.get("role") or "").lower()
    tabindex = tag.get("tabindex")
    return (
        role in {"dialog", "alertdialog"}
        or tag.get("aria-modal", "").lower() == "true"
        or tag.has_attr("autofocus")
        or (tabindex is not None and str(tabindex).strip() not in {"", "-1"})
    )


def has_dismiss_control(tag: Tag) -> bool:
    for control in tag.find_all(["button", "a", "input"]):
        label = normalize_text(
            control.get_text(" ", strip=True)
            or control.get("aria-label", "")
            or control.get("title", "")
            or control.get("value", "")
        ).lower()
        if any(hint in label for hint in DISMISS_LABEL_HINTS):
            return True
    return tag.name == "dialog"


def blocks_page_scroll(tag: Tag) -> bool:
    if tag.get("aria-modal", "").lower() == "true":
        return True

    body = tag.find_parent("body")
    if body is not None:
        body_context = " ".join([body.get("style", ""), " ".join(body.get("class", []))]).lower().replace(" ", "")
        if any(fragment in body_context for fragment in ("overflow:hidden", "modal-open", "no-scroll", "overflow-hidden")):
            return True

    attrs_text = interruption_context_text(tag)
    return any(hint in attrs_text for hint in ("scroll-lock", "lock-scroll", "modal-open", "overflow-hidden"))


def candidate_has_attention_grabbing_motion(tag: Tag, style_hints: dict[str, set[str]]) -> bool:
    if looks_distracting_animation(tag, style_hints):
        return True
    return any(
        has_autoplay_media(descendant) or looks_distracting_animation(descendant, style_hints)
        for descendant in tag.find_all(True)
    )


def covers_primary_task_proxy(
    tag: Tag,
    primary_region: Tag | None,
    fixed_or_sticky: bool,
    overlay_like: bool,
) -> bool:
    if overlay_like:
        return True

    if primary_region is None:
        return fixed_or_sticky

    if tag is primary_region or primary_region in tag.find_all(True):
        return False

    if primary_region in tag.parents:
        return False

    attrs_text = interruption_context_text(tag)
    content_size = len(normalize_text(tag.get_text(" ", strip=True)))
    descendant_count = len(tag.find_all(True))

    return fixed_or_sticky and (
        content_size >= 60
        or descendant_count >= 4
        or any(hint in attrs_text for hint in ("consent", "cookie", "chat", "subscribe", "promo"))
    )


def classify_interrupt_type(tag: Tag) -> str:
    attrs_text = interruption_context_text(tag)
    if any(hint in attrs_text for hint in ("cookie", "consent")):
        return "consent"
    if "chat" in attrs_text:
        return "chat"
    if any(hint in attrs_text for hint in ("toast", "notification", "alert")):
        return "notification"
    if any(hint in attrs_text for hint in ("modal", "dialog", "popup", "interstitial", "lightbox")):
        return "modal"
    if any(hint in attrs_text for hint in ("sticky", "drawer", "overlay")):
        return "sticky-overlay"
    return "interruptive-layer"


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
    fixed_classes: set[str] = set()
    fixed_ids: set[str] = set()

    for style_tag in soup.find_all("style"):
        css = style_tag.get_text(" ", strip=True)
        for selector_group, declarations in STYLE_RULE_PATTERN.findall(css):
            normalized_declarations = declarations.lower()
            selector_classes = {match.lower() for match in CLASS_SELECTOR_PATTERN.findall(selector_group)}
            selector_ids = {match.lower() for match in ID_SELECTOR_PATTERN.findall(selector_group)}

            if "animation" in normalized_declarations:
                animated_classes.update(selector_classes)
                animated_ids.update(selector_ids)

            if FIXED_STICKY_PATTERN.search(normalized_declarations) or HIGH_Z_INDEX_PATTERN.search(normalized_declarations):
                fixed_classes.update(selector_classes)
                fixed_ids.update(selector_ids)

    return {
        "animated_classes": animated_classes,
        "animated_ids": animated_ids,
        "fixed_classes": fixed_classes,
        "fixed_ids": fixed_ids,
    }


def extract_js_hints(js_sources: list[str]) -> dict[str, Any]:
    autoplay_samples: list[str] = []
    motion_samples: list[str] = []
    interruption_samples: list[str] = []

    autoplay_count = 0
    motion_count = 0
    interruption_count = 0

    for source in js_sources:
        normalized = normalize_text(source)
        if not normalized:
            continue

        autoplay_matches = JS_AUTOPLAY_PATTERN.findall(source)
        motion_matches = JS_MOTION_PATTERN.findall(source)
        interruption_matches = JS_INTERRUPTION_PATTERN.findall(source)

        autoplay_count += len(autoplay_matches)
        motion_count += len(motion_matches)
        interruption_count += len(interruption_matches)

        if autoplay_matches and len(autoplay_samples) < 3:
            autoplay_samples.append(source[:180].strip())
        if motion_matches and len(motion_samples) < 3:
            motion_samples.append(source[:180].strip())
        if interruption_matches and len(interruption_samples) < 3:
            interruption_samples.append(source[:180].strip())

    return {
        "autoplay_count": autoplay_count,
        "motion_count": motion_count,
        "interruption_count": interruption_count,
        "autoplay_samples": autoplay_samples,
        "motion_samples": motion_samples,
        "interruption_samples": interruption_samples,
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
