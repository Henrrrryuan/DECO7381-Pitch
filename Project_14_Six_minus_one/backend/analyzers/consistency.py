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

DIMENSION_NAME = "Consistency"

REGULAR_BASE_PENALTY = 3
SERIOUS_BASE_PENALTY = 4

LOCATION_CUE_KEYWORDS = ("breadcrumb", "step", "steps", "stepper", "progress", "wizard", "checkout")
HEADING_SELECTORS = ("h1", "h2", "h3", "h4", "h5", "h6")
STRUCTURE_REGION_TAGS = ("nav", "main", "section", "article")
ACTIONABLE_CONTROL_TAGS = ("a", "button", "input")
INPUT_ACTION_TYPES = {"button", "submit", "reset"}
STEP_TEXT_PATTERN = re.compile(
    r"\bstep\s*\d+\b|\b\d+\s*of\s*\d+\b|\b\d+\s*/\s*\d+\b",
    re.IGNORECASE,
)
PATH_TEXT_PATTERN = re.compile(r"\b\w+\s*(?:>|/|›|»)\s*\w+")
ACTION_LABEL_GROUPS: dict[str, set[str]] = {
    "next_step": {"next", "continue", "proceed"},
    "previous_step": {"back", "go back", "previous", "prev"},
    "confirm_submit": {"submit", "confirm", "finish", "complete", "done"},
}


def analyze_consistency(html: str) -> DimensionResult:
    """Analyze structure and wayfinding consistency risks for HTML input."""

    soup = BeautifulSoup(html or "", "html.parser")

    headings = get_headings(soup)
    navs = soup.find_all("nav")

    heading_issue = detect_cs1_heading_hierarchy(headings)
    location_cue_metrics = collect_location_cue_metrics(soup, headings, navs)
    location_issue = detect_cs2_missing_location_cue(location_cue_metrics)
    action_label_issue = detect_cs3_inconsistent_action_labels(soup)

    issues = [
        issue
        for issue in (heading_issue, location_issue, action_label_issue)
        if issue is not None
    ]
    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score(DIMENSION_NAME, total_penalty)

    return DimensionResult(
        dimension=DIMENSION_NAME,
        score=score,
        issues=issues,
        metadata={
            "implemented_rules": ["CS-1", "CS-2", "CS-3"],
            "pending_rules": [],
            "input_scope": ["html_file", "html_snippet"],
            "out_of_scope": ["pdf", "image", "live_url_fetch", "multi_source_mixed_input"],
            "heading_count": len(headings),
            "nav_count": len(navs),
            "has_breadcrumb": location_cue_metrics["has_breadcrumb"],
            "has_progress_indicator": location_cue_metrics["has_progress"],
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


def detect_cs1_heading_hierarchy(headings: list[dict[str, Any]]) -> Issue | None:
    if not headings:
        return None

    violations: list[dict[str, Any]] = []
    first_heading_level = headings[0]["level"]

    if first_heading_level != 1:
        violations.append(
            {
                "type": "first_heading_not_h1",
                "tag": headings[0]["tag"],
                "text": headings[0]["text"],
                "previous_level": None,
                "current_level": first_heading_level,
            }
        )

    jump_count = 0
    previous_level = headings[0]["level"]
    for heading in headings[1:]:
        current_level = heading["level"]
        if current_level > previous_level + 1:
            jump_count += 1
            violations.append(
                {
                    "type": "hierarchy_gap",
                    "tag": heading["tag"],
                    "text": heading["text"],
                    "previous_level": previous_level,
                    "current_level": current_level,
                }
            )
        previous_level = current_level

    if not violations:
        return None

    if jump_count >= 3 or first_heading_level > 2:
        severity: Severity = "critical"
    elif jump_count >= 2 or first_heading_level != 1:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-1",
        title="Heading structure gap",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="Skipped heading levels weaken the mental model of the page. Users who rely on structure to scan or navigate may struggle to predict relationships between sections, increasing orientation and memory load.",
        suggestion="Use headings in a continuous hierarchy, preferably starting from h1, and avoid jumping directly from a shallow level to a much deeper one.",
        evidence={
            "heading_count": len(headings),
            "violations_count": len(violations),
            "first_heading_level": first_heading_level,
            "violations": violations,
        },
        locations=violations[:5],
    )


def detect_cs2_missing_location_cue(metrics: dict[str, Any]) -> Issue | None:
    if not metrics["requires_location_cue"] or metrics["has_location_cue"]:
        return None

    if metrics["reason_type"] == "multi_step_flow":
        severity: Severity = "critical"
    elif metrics["reason_type"] in {"breadcrumb_trace", "strong_information_architecture"}:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-2",
        title="Missing breadcrumb or progress indicator",
        severity=severity,
        base_penalty=SERIOUS_BASE_PENALTY,
        description="A multi-step or multi-level page without a current-location cue forces users to remember where they are. This increases wayfinding and memory load, and can make users feel lost or uncertain about progress.",
        suggestion="Add breadcrumbs, a stepper, progress text, or use aria-current to indicate the current location in multi-level or multi-step interfaces.",
        evidence={
            "requires_location_cue": metrics["requires_location_cue"],
            "reason": metrics["reason"],
            "has_breadcrumb": metrics["has_breadcrumb"],
            "has_progress": metrics["has_progress"],
            "has_aria_current_page": metrics["has_aria_current_page"],
            "heading_count": metrics["heading_count"],
            "nav_count": metrics["nav_count"],
        },
        locations=metrics["locations"][:5],
    )


def detect_cs3_inconsistent_action_labels(soup: BeautifulSoup) -> Issue | None:
    grouped_labels: dict[str, set[str]] = {group: set() for group in ACTION_LABEL_GROUPS}
    grouped_locations: dict[str, list[dict[str, Any]]] = {
        group: [] for group in ACTION_LABEL_GROUPS
    }

    for tag in soup.find_all(ACTIONABLE_CONTROL_TAGS):
        if not isinstance(tag, Tag):
            continue

        label = normalize_control_label(tag)
        if not label:
            continue

        group = label_group_for_action(label)
        if not group:
            continue

        grouped_labels[group].add(label)
        grouped_locations[group].append(
            {
                "tag": tag.name or "unknown",
                "label": label,
                "summary": get_tag_summary(tag),
            }
        )

    inconsistent_groups = {
        group: sorted(labels)
        for group, labels in grouped_labels.items()
        if len(labels) >= 2
    }
    if not inconsistent_groups:
        return None

    max_label_variants = max(len(labels) for labels in inconsistent_groups.values())
    if len(inconsistent_groups) >= 2 or max_label_variants >= 3:
        severity: Severity = "major"
    else:
        severity = "minor"

    locations: list[dict[str, Any]] = []
    for group in inconsistent_groups:
        seen_labels: set[str] = set()
        for item in grouped_locations[group]:
            if item["label"] in seen_labels:
                continue
            seen_labels.add(item["label"])
            locations.append(item)
            if len(locations) >= 6:
                break
        if len(locations) >= 6:
            break

    return build_issue(
        rule_id="CS-3",
        title="Action labels are inconsistent",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="Using different labels for the same action pattern can break predictability. Users may pause to reinterpret whether buttons mean the same thing, which increases decision and memory load.",
        suggestion="Use one consistent label for each repeated action pattern (for example, always use 'Continue' for forward flow and one stable term for submission).",
        evidence={
            "inconsistent_groups": inconsistent_groups,
            "group_count": len(inconsistent_groups),
            "max_label_variants": max_label_variants,
        },
        locations=locations,
    )


def collect_location_cue_metrics(
    soup: BeautifulSoup,
    headings: list[dict[str, Any]],
    navs: list[Tag],
) -> dict[str, Any]:
    heading_count = len(headings)
    nav_count = len(navs)
    unique_heading_levels = sorted({heading["level"] for heading in headings})

    breadcrumb_nodes = find_breadcrumb_nodes(soup)
    progress_nodes = find_progress_nodes(soup)
    has_breadcrumb = bool(breadcrumb_nodes)
    has_progress = bool(progress_nodes)
    has_aria_current_page = any(nav.select('[aria-current="page"]') for nav in navs) and count_nav_links(navs) > 2
    has_location_cue = has_breadcrumb or has_progress or has_aria_current_page

    path_trace_nodes = find_path_trace_nodes(soup)
    multi_step_nodes = find_multi_step_signal_nodes(soup)
    form_step_count = count_form_step_regions(soup)
    structure_signal = (
        heading_count >= 4
        and len(unique_heading_levels) >= 3
        and nav_count >= 1
        and bool(soup.find("main"))
        and (len(soup.find_all("section")) + len(soup.find_all("article"))) >= 2
    )

    requires_location_cue = False
    reason = "none"
    reason_type = "none"
    locations: list[dict[str, Any]] = []

    if has_breadcrumb or has_progress or has_aria_current_page:
        requires_location_cue = True
        reason = "page already contains breadcrumb/progress style navigation cues"
        reason_type = "existing_cue"
        locations.extend(node_to_location(node) for node in (breadcrumb_nodes + progress_nodes)[:3])
    elif multi_step_nodes or form_step_count >= 3:
        requires_location_cue = True
        reason = "multi-step flow signals detected"
        reason_type = "multi_step_flow"
        locations.extend(node_to_location(node) for node in multi_step_nodes[:3])
    elif path_trace_nodes:
        requires_location_cue = True
        reason = "breadcrumb-like hierarchy traces detected"
        reason_type = "breadcrumb_trace"
        locations.extend(node_to_location(node) for node in path_trace_nodes[:3])
    elif structure_signal:
        requires_location_cue = True
        reason = "page has strong multi-level information architecture"
        reason_type = "strong_information_architecture"
        locations.extend(
            {
                "tag": heading["tag"],
                "text": heading["text"],
                "level": heading["level"],
            }
            for heading in headings[:3]
        )

    return {
        "requires_location_cue": requires_location_cue,
        "has_location_cue": has_location_cue,
        "reason": reason,
        "reason_type": reason_type,
        "has_breadcrumb": has_breadcrumb,
        "has_progress": has_progress,
        "has_aria_current_page": has_aria_current_page,
        "heading_count": heading_count,
        "nav_count": nav_count,
        "locations": locations,
        "form_step_count": form_step_count,
    }


def get_headings(soup: BeautifulSoup) -> list[dict[str, Any]]:
    headings: list[dict[str, Any]] = []
    for tag in soup.find_all(HEADING_SELECTORS):
        if not isinstance(tag, Tag):
            continue
        headings.append(
            {
                "tag": tag.name,
                "text": normalize_text(tag.get_text(" ", strip=True)),
                "level": int(tag.name[1]),
                "node": tag,
            }
        )
    return headings


def find_breadcrumb_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        aria_label = (tag.get("aria-label") or "").lower()
        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))

        if tag.name == "nav" and "breadcrumb" in aria_label:
            nodes.append(tag)
            continue
        if "breadcrumb" in attrs_blob:
            nodes.append(tag)
            continue
        if text and PATH_TEXT_PATTERN.search(text):
            nodes.append(tag)
    return dedupe_tags(nodes)


def find_progress_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        if tag.name == "progress":
            nodes.append(tag)
            continue
        if (tag.get("aria-current") or "").lower() == "step":
            nodes.append(tag)
            continue

        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))
        if any(keyword in attrs_blob for keyword in ("progress", "stepper", "steps")):
            nodes.append(tag)
            continue
        if text and STEP_TEXT_PATTERN.search(text):
            nodes.append(tag)
    return dedupe_tags(nodes)


def find_multi_step_signal_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))
        if any(keyword in attrs_blob for keyword in LOCATION_CUE_KEYWORDS):
            nodes.append(tag)
            continue
        if text and STEP_TEXT_PATTERN.search(text):
            nodes.append(tag)
    return dedupe_tags(nodes)


def find_path_trace_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        text = normalize_text(tag.get_text(" ", strip=True))
        attrs_blob = get_attr_blob(tag)
        if "breadcrumb" in attrs_blob:
            nodes.append(tag)
            continue
        if text and PATH_TEXT_PATTERN.search(text):
            nodes.append(tag)
    return dedupe_tags(nodes)


def count_form_step_regions(soup: BeautifulSoup) -> int:
    count = 0
    for tag in soup.find_all(["section", "article", "div", "li"]):
        if not isinstance(tag, Tag):
            continue
        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))
        if any(keyword in attrs_blob for keyword in ("step", "wizard", "checkout")) or (
            text and STEP_TEXT_PATTERN.search(text)
        ):
            count += 1
    return count


def count_nav_links(navs: list[Tag]) -> int:
    return sum(len(nav.find_all("a")) for nav in navs)


def dedupe_tags(tags: list[Tag]) -> list[Tag]:
    seen: set[int] = set()
    result: list[Tag] = []
    for tag in tags:
        marker = id(tag)
        if marker in seen:
            continue
        seen.add(marker)
        result.append(tag)
    return result


def node_to_location(tag: Tag) -> dict[str, Any]:
    return {
        "tag": tag.name or "unknown",
        "summary": get_tag_summary(tag),
        "text": normalize_text(tag.get_text(" ", strip=True))[:120],
    }


def get_attr_blob(tag: Tag) -> str:
    parts = [
        tag.get("id", ""),
        " ".join(tag.get("class", [])),
        tag.get("role", ""),
        tag.get("aria-label", ""),
        tag.get("aria-current", ""),
    ]
    return " ".join(parts).lower()


def get_tag_summary(tag: Tag) -> str:
    tag_name = tag.name or "unknown"
    element_id = f"#{tag.get('id')}" if tag.get("id") else ""
    classes = "." + ".".join(tag.get("class", [])) if tag.get("class") else ""
    return f"{tag_name}{element_id}{classes}"


def normalize_text(text: str) -> str:
    return " ".join(text.split())


def normalize_control_label(tag: Tag) -> str:
    if tag.name == "input":
        input_type = (tag.get("type") or "").lower()
        if input_type and input_type not in INPUT_ACTION_TYPES:
            return ""
        label = (
            tag.get("value")
            or tag.get("aria-label")
            or tag.get("title")
            or ""
        )
        return normalize_text(label).lower()

    label = (
        tag.get_text(" ", strip=True)
        or tag.get("aria-label")
        or tag.get("title")
        or ""
    )
    return normalize_text(label).lower()


def label_group_for_action(label: str) -> str | None:
    normalized = normalize_text(label).lower()
    if not normalized:
        return None

    for group, variants in ACTION_LABEL_GROUPS.items():
        if normalized in variants:
            return group

    # Handle short phrases such as "continue to payment".
    for group, variants in ACTION_LABEL_GROUPS.items():
        if any(normalized.startswith(f"{variant} ") for variant in variants):
            return group
    return None


def load_html_from_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def main() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(
        description="Analyze the Consistency dimension for an HTML file."
    )
    parser.add_argument("html_file", help="Path to an HTML file")
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output",
    )
    args = parser.parse_args()

    html = load_html_from_file(args.html_file)
    result = analyze_consistency(html).to_dict()

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
