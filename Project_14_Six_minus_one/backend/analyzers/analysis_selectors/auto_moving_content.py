from __future__ import annotations

import os
from typing import Any

from bs4 import BeautifulSoup, Tag

from ...schemas import Issue
from . import interaction_helpers as interaction_rules


def _amc_audit_enabled() -> bool:
    return os.environ.get("AMC_AUDIT") == "1"


def _amc_location_subtype(underlying_rule_id: str, loc: dict[str, Any]) -> str:
    """Best-effort subtype taxonomy; non-breaking extra metadata only."""
    rid = str(underlying_rule_id or "")
    tag = str(loc.get("tag") or "").lower()
    summary = str(loc.get("summary") or "").lower()
    snippet = str(loc.get("html_snippet") or "").lower()
    blob = f"{tag} {summary} {snippet}"

    if rid == "ID-1":
        if tag == "video":
            return "autoplay_video"
        if tag == "audio":
            return "autoplay_audio"
        if tag == "iframe":
            return "autoplay_iframe"
        if tag == "script":
            return "autoplay_script"
        return "autoplay_media"

    # ID-2: animated/motion evidence (region scoped + JS motion signals)
    if any(hint in blob for hint in ("carousel", "slider", "swiper", "ticker", "marquee")):
        return "carousel_motion"
    if str(loc.get("region") or "").strip():
        return "moving_region"
    return "distracting_animation"


def _amc_location_label(subtype: str, loc: dict[str, Any]) -> str:
    st = str(subtype or "")
    if st.startswith("autoplay_"):
        return {
            "autoplay_video": "Autoplay video",
            "autoplay_audio": "Autoplay audio",
            "autoplay_iframe": "Autoplay iframe",
            "autoplay_script": "Script autoplay signal",
        }.get(st, "Autoplay media")
    if st == "carousel_motion":
        return "Carousel / rotator motion"
    if st == "moving_region":
        region = str(loc.get("region") or "").strip()
        return f"Moving region ({region})" if region else "Moving region"
    if st == "distracting_animation":
        return "Distracting animation"
    return "Motion signal"


def _amc_location_signature(loc: dict[str, Any]) -> str:
    """Stable-ish dedupe key without DOM selectors."""
    tag = str(loc.get("tag") or "")
    summary = str(loc.get("summary") or "")
    region = str(loc.get("region") or "")
    src = str(loc.get("src") or "")
    muted = "muted" if loc.get("muted") is True else ""
    snippet = str(loc.get("html_snippet") or "")
    snippet_short = snippet[:80]
    return "|".join([tag, summary, region, src, muted, snippet_short])


def _amc_group_bucket(movement_subtype: str) -> str:
    st = str(movement_subtype or "")
    if st.startswith("autoplay_") or st == "autoplay_media":
        return "Autoplay Media"
    if st == "distracting_animation":
        return "Distracting Animations"
    if st == "moving_region":
        return "Moving Regions"
    if st == "carousel_motion":
        return "Carousel Motion"
    return "Other Motion"


def _amc_bucket_order(bucket: str) -> int:
    order = {
        "Autoplay Media": 1,
        "Distracting Animations": 2,
        "Moving Regions": 3,
        "Carousel Motion": 4,
        "Other Motion": 5,
    }
    return order.get(str(bucket or ""), 99)


def _amc_merge_locations(issues: list[Issue]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Aggregate ID-1 + ID-2 locations with subtype provenance and safe caps."""
    id1 = next((issue for issue in issues if getattr(issue, "rule_id", "") == "ID-1"), None)
    id2 = next((issue for issue in issues if getattr(issue, "rule_id", "") == "ID-2"), None)
    id1_locs = list(getattr(id1, "locations", []) or []) if id1 is not None else []
    id2_locs = list(getattr(id2, "locations", []) or []) if id2 is not None else []

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    discarded_duplicates: list[str] = []

    def _append_from(rule_id: str, locs: list[dict[str, Any]]) -> None:
        for loc in locs:
            if not isinstance(loc, dict):
                continue
            loc = dict(loc)  # do not mutate original dict objects
            # Prefer unique selectors produced in interaction_helpers (`ID-1` / `ID-2` payloads):
            # stable_selector(unique) -> media `[src*="..."]` when needed. Only fall back to
            # legacy `summary` (often `iframe`/`video`/tag-shape) when no unique grounding was found.
            if not loc.get("selector") and isinstance(loc.get("summary"), str) and loc.get("summary").strip():
                loc["selector"] = loc.get("summary").strip()
            sig = _amc_location_signature(loc)
            if sig in seen:
                discarded_duplicates.append(sig)
                continue
            seen.add(sig)

            subtype = _amc_location_subtype(rule_id, loc)
            loc.setdefault("underlying_issue", rule_id)
            loc.setdefault("movement_subtype", subtype)
            loc.setdefault("original_rule_id", rule_id)
            loc.setdefault("aggregation_source", "amc.aggregate.v1")
            loc.setdefault("label", _amc_location_label(subtype, loc))
            merged.append(loc)

    # Preserve stable ordering: autoplay evidence first, then animation evidence.
    _append_from("ID-1", id1_locs)
    _append_from("ID-2", id2_locs)

    # Cap to max 5 locations per subtype bucket (without dropping entire buckets).
    capped: list[dict[str, Any]] = []
    bucket_counts: dict[str, int] = {}
    discarded_by_cap: list[str] = []
    for loc in merged:
        bucket = _amc_group_bucket(str(loc.get("movement_subtype") or ""))
        bucket_counts.setdefault(bucket, 0)
        if bucket_counts[bucket] >= 5:
            discarded_by_cap.append(_amc_location_signature(loc))
            continue
        bucket_counts[bucket] += 1
        capped.append(loc)

    subgroup_counts = {bucket: count for bucket, count in bucket_counts.items() if count > 0}
    subgroup_counts = dict(sorted(subgroup_counts.items(), key=lambda item: _amc_bucket_order(item[0])))
    evidence = {
        "id1_location_count": len(id1_locs),
        "id2_location_count": len(id2_locs),
        "merged_location_count": len(merged),
        "subgroup_counts": subgroup_counts,
        "deduped_count": len(capped),
        "discarded_duplicates": len(discarded_duplicates),
        "discarded_by_cap": len(discarded_by_cap),
    }
    return capped, evidence


def detect_auto_moving_content_selector(context: dict[str, Any]):
    return detect_auto_moving_content(
        context["soup"],
        context["candidate_regions"],
        context["style_hints"],
        context["js_hints"],
    )


def detect_auto_moving_content(
    soup: BeautifulSoup,
    candidate_regions: list[Tag],
    style_hints: dict[str, set[str]],
    js_hints: dict[str, Any],
) -> Issue | None:
    if _amc_audit_enabled():
        print("[AMC contract audit]", {
            "rule_id": "AMC-1",
            "dimension_name": "Auto-Moving Content",
            "scanned_tags": {
                "autoplay_media": ["video[autoplay]", "audio[autoplay]", "iframe[src*='autoplay=1|true']"],
                "animated_elements": "candidate_regions scoped tags where looks_distracting_animation(tag, style_hints) == True",
                "candidate_region_tags": list(getattr(interaction_rules, "CANDIDATE_REGION_TAGS", ())),
            },
            "candidate_selector_logic": {
                "issue_sources": ["ID-1 (autoplay media)", "ID-2 (too many animated elements)"],
                "autoplay_scan": "soup.select(video[autoplay], audio[autoplay]) + soup.find_all(iframe) src contains autoplay=1|true + js_hints.autoplay_count",
                "animation_scan": "within each candidate region, tags where looks_distracting_animation==True, but only when nearest candidate region is that region",
            },
            "autoplay_definition": "video/audio with autoplay attr OR iframe src contains autoplay=1|autoplay=true OR JS_AUTOPLAY_PATTERN hits",
            "movement_definition": "looks_distracting_animation(tag) OR JS_MOTION_PATTERN hits",
            "css_animation_detection": "inline style contains 'animation' OR CSS <style> rules containing 'animation' contribute class/id hints",
            "css_transition_detection": "inline style contains 'transition' is a hint for looks_animated(), but transitions are excluded from looks_distracting_animation() continuous-motion counting",
            "marquee_detection": "tag.name == 'marquee' => moving",
            "gif_detection": "not implemented (no explicit GIF/media-type detection; only attribute/class/style hints)",
            "video_autoplay_detection": "video[autoplay] counted; muted tracked; autoplay media excluded from ID-2 animated counting",
            "carousel_detection": "class/id/style/data-* contains carousel/slider/swiper/ticker etc OR JS_MOTION_PATTERN hits",
            "js_mutation_detection": "not implemented as DOM mutation observers; only static JS regex hints (requestAnimationFrame/setInterval/gsap/anime)",
            "timing_thresholds": {
                "too_many_animated_elements_per_region_gt": getattr(interaction_rules, "ANIMATION_THRESHOLD", None),
                "js_motion_signal_count": "js_hints.motion_count (no explicit time window; regex count)",
                "js_autoplay_signal_count": "js_hints.autoplay_count (no explicit time window; regex count)",
            },
            "visibility_requirements": "none (static HTML heuristics; no rendered visibility/viewport measurement)",
            "viewport_requirements": "none (regions are a proxy; note in evidence: approximate shared viewport)",
            "iframe_exclusions": "ID-2 excludes autoplay media iframe/video/audio from animation count; ID-1 includes autoplay iframe via src query only",
            "user_interaction_exclusions": "not implemented (no user-initiated vs auto distinction beyond 'autoplay' + heuristic hints)",
            "pause_control_requirements": "not implemented (no pause/control detection)",
            "trigger_formula": "If any ID-1 or ID-2 issue exists, aggregate evidence from both and publish one AMC-1 issue",
            "grouping_strategy": "single AMC-1 issue aggregating all underlying motion evidence (ID-1 + ID-2), grouped by movement_subtype in UI",
            "location_strategy": "locations are inherited dicts from ID-1/ID-2 with extra metadata: underlying_issue, movement_subtype, original_rule_id, aggregation_source",
        })

    issues = (
        interaction_rules.detect_id1_autoplay_media(soup, js_hints)
        + interaction_rules.detect_id2_too_many_animated_elements(candidate_regions, style_hints, js_hints)
    )
    if not issues:
        if _amc_audit_enabled():
            print("[AMC lineage]", {
                "raw_candidate_count": None,
                "issue_count": 0,
                "location_count_before_sanitize": 0,
                "location_count_after_sanitize": None,
                "rendered_location_count": None,
                "grouped_into_single_issue": False,
                "grouping_reason": "",
                "collapse_detected": False,
                "collapse_stage": "",
            })
        return None

    winner = max(issues, key=lambda item: (item.penalty, item.rule_id))
    merged_locations, aggregation_evidence = _amc_merge_locations(issues)

    # Preserve the "max underlying issue wins" severity while aggregating evidence.
    winner.rule_id = "AMC-1"
    winner.title = "Auto-Moving Content"
    winner.description = "Static autoplay or motion signals can pull attention away from the main task and reduce users' sense of control."
    winner.suggestion = "Disable non-essential autoplay or continuous motion by default; this signal does not verify full WCAG pause, stop, hide compliance."
    winner.locations = merged_locations
    winner.evidence = {
        **(winner.evidence or {}),
        "aggregation": {
            **aggregation_evidence,
            "grouping_contract": "aggregate_all_motion_evidence",
        },
    }

    if _amc_audit_enabled():
        subgroup_counts = aggregation_evidence.get("subgroup_counts") or {}
        print("[AMC aggregation]", {
            "id1_location_count": aggregation_evidence.get("id1_location_count"),
            "id2_location_count": aggregation_evidence.get("id2_location_count"),
            "merged_location_count": aggregation_evidence.get("merged_location_count"),
            "subgroup_counts": subgroup_counts,
            "deduped_count": aggregation_evidence.get("deduped_count"),
            "discarded_duplicates": aggregation_evidence.get("discarded_duplicates"),
            "rendered_group_count": len(subgroup_counts),
        })
        print("[AMC lineage]", {
            "raw_candidate_count": None,
            "issue_count": 1,
            "location_count_before_sanitize": len(merged_locations),
            "location_count_after_sanitize": None,
            "rendered_location_count": None,
            "grouped_into_single_issue": True,
            "grouping_reason": "aggregate_id1_id2_union",
            "collapse_detected": False,
            "collapse_stage": "",
        })

    return winner
