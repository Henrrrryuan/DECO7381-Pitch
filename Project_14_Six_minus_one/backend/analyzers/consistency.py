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
CONSISTENCY_PENALTY_CAP = 48

LOCATION_CUE_KEYWORDS = ("breadcrumb", "step", "steps", "stepper", "progress", "wizard", "checkout")
HEADING_SELECTORS = ("h1", "h2", "h3", "h4", "h5", "h6")
GENERIC_PAGE_PURPOSE_TEXTS = {"home", "homepage", "welcome", "welcome page", "main", "index", "start"}
GENERIC_NAV_TEXTS = {"click here", "here", "more", "read more", "learn more", "details", "view", "open", "go"}
CONTROL_RELATIONSHIP_ROLES = {"", "tab", "button", "switch", "menuitem", "treeitem"}

STEP_TEXT_PATTERN = re.compile(r"\bstep\s*\d+\b|\b\d+\s*of\s*\d+\b|\b\d+\s*/\s*\d+\b", re.IGNORECASE)
PATH_TEXT_PATTERN = re.compile(r"\b\w+\s*(?:>|/|->|»|›)\s*\w+")
SEARCH_TEXT_PATTERN = re.compile(r"\bsearch\b", re.IGNORECASE)


def analyze_consistency(html: str) -> DimensionResult:
    """Analyze predictable structure, navigation, and wayfinding risks."""

    soup = BeautifulSoup(html or "", "html.parser")
    headings = get_headings(soup)
    navs = soup.find_all("nav")

    location_cue_metrics = collect_location_cue_metrics(soup, headings, navs)
    issues = [
        issue
        for issue in (
            detect_cs1_heading_hierarchy(headings),
            detect_cs2_missing_location_cue(location_cue_metrics),
            detect_cs3_missing_progress_cue(location_cue_metrics),
            detect_cs4_unclear_page_purpose(soup, headings),
            detect_cs5_unclear_navigation_structure(soup, navs, headings),
            detect_cs6_missing_or_unclear_search(soup, headings, navs),
            detect_cs7_unclear_controls(soup),
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
            "implemented_rules": ["CS-1", "CS-2", "CS-3", "CS-4", "CS-5", "CS-6", "CS-7"],
            "pending_rules": ["CS-8 cross-page repeated navigation consistency for ZIP input"],
            "input_scope": ["html_file", "html_snippet"],
            "out_of_scope": ["pdf", "image", "live_url_fetch", "cross_page_consistency"],
            "heading_count": len(headings),
            "nav_count": len(navs),
            "has_breadcrumb": location_cue_metrics["has_breadcrumb"],
            "has_progress_indicator": location_cue_metrics["has_progress"],
            "has_aria_current_page": location_cue_metrics["has_aria_current_page"],
            "has_search": has_search(soup),
            "total_penalty": total_penalty,
            "scoring_model": {
                "formula": SCORING_FORMULA_TEXT,
                "penalty_formula": PENALTY_FORMULA_TEXT,
                "dimension_penalty_cap": CONSISTENCY_PENALTY_CAP,
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
        return build_issue(
            rule_id="CS-1",
            title="Heading structure is inconsistent",
            severity="major",
            base_penalty=REGULAR_BASE_PENALTY,
            description="A page without headings gives users fewer structural anchors for scanning and wayfinding. This makes the page harder to predict and increases memory load for users who rely on clear section structure.",
            suggestion="Add a clear h1 for the page purpose and use lower-level headings to mark major sections in order.",
            evidence={"heading_count": 0, "violations_count": 1, "violations": [{"type": "missing_headings"}]},
        )

    violations: list[dict[str, Any]] = []
    first_heading_level = headings[0]["level"]
    h1_headings = [heading for heading in headings if heading["level"] == 1]
    seen_texts: dict[str, dict[str, Any]] = {}

    if not h1_headings:
        violations.append({"type": "missing_h1", "tag": None, "text": "", "previous_level": None, "current_level": None})
    elif len(h1_headings) > 1:
        for heading in h1_headings[1:]:
            violations.append({"type": "multiple_h1", "tag": heading["tag"], "text": heading["text"], "previous_level": 1, "current_level": 1})

    if first_heading_level != 1:
        violations.append({"type": "first_heading_not_h1", "tag": headings[0]["tag"], "text": headings[0]["text"], "previous_level": None, "current_level": first_heading_level})

    jump_count = 0
    empty_heading_count = 0
    duplicate_heading_count = 0
    previous_level = headings[0]["level"]

    for heading in headings:
        normalized_heading = normalize_text(heading["text"]).lower()
        if not normalized_heading:
            empty_heading_count += 1
            violations.append({"type": "empty_heading", "tag": heading["tag"], "text": "", "previous_level": None, "current_level": heading["level"]})
        elif normalized_heading in seen_texts:
            duplicate_heading_count += 1
            violations.append({"type": "duplicate_heading_text", "tag": heading["tag"], "text": heading["text"], "previous_level": seen_texts[normalized_heading]["level"], "current_level": heading["level"]})
        else:
            seen_texts[normalized_heading] = heading

    for heading in headings[1:]:
        current_level = heading["level"]
        if current_level > previous_level + 1:
            jump_count += 1
            violations.append({"type": "hierarchy_gap", "tag": heading["tag"], "text": heading["text"], "previous_level": previous_level, "current_level": current_level})
        previous_level = current_level

    if not violations:
        return None

    if jump_count >= 3 or first_heading_level > 2 or not h1_headings:
        severity: Severity = "critical"
    elif jump_count >= 2 or first_heading_level != 1 or duplicate_heading_count >= 2:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-1",
        title="Heading structure is inconsistent",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="Missing, repeated, empty, or skipped headings weaken the mental model of the page. Users who rely on structure to scan or navigate may struggle to predict relationships between sections, increasing orientation and memory load.",
        suggestion="Use one clear h1 for the page purpose, keep headings descriptive, and follow a continuous hierarchy without jumping across levels.",
        evidence={
            "heading_count": len(headings),
            "violations_count": len(violations),
            "first_heading_level": first_heading_level,
            "h1_count": len(h1_headings),
            "jump_count": jump_count,
            "empty_heading_count": empty_heading_count,
            "duplicate_heading_count": duplicate_heading_count,
            "violations": violations,
        },
        locations=violations[:5],
    )


def detect_cs2_missing_location_cue(metrics: dict[str, Any]) -> Issue | None:
    if not metrics["requires_current_location_cue"] or metrics["has_current_location_cue"]:
        return None

    severity: Severity = "major" if metrics["current_location_reason_type"] in {"breadcrumb_trace", "strong_information_architecture"} else "minor"
    return build_issue(
        rule_id="CS-2",
        title="Missing current location cue",
        severity=severity,
        base_penalty=SERIOUS_BASE_PENALTY,
        description="A multi-level page without a current-location cue forces users to remember where they are. This increases wayfinding and memory load, and can make users feel lost or uncertain about the site hierarchy.",
        suggestion="Add breadcrumbs or mark the active navigation item with aria-current so users can confirm their current location.",
        evidence={
            "requires_current_location_cue": metrics["requires_current_location_cue"],
            "reason": metrics["current_location_reason"],
            "has_breadcrumb": metrics["has_breadcrumb"],
            "has_aria_current_page": metrics["has_aria_current_page"],
            "heading_count": metrics["heading_count"],
            "nav_count": metrics["nav_count"],
        },
        locations=metrics["current_location_locations"][:5],
    )


def detect_cs3_missing_progress_cue(metrics: dict[str, Any]) -> Issue | None:
    if not metrics["requires_progress_cue"] or metrics["has_progress"]:
        return None

    if metrics["form_step_count"] >= 3:
        severity: Severity = "critical"
    elif metrics["multi_step_signal_count"] >= 2:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-3",
        title="Missing multi-step progress cue",
        severity=severity,
        base_penalty=SERIOUS_BASE_PENALTY,
        description="A multi-step task without visible progress feedback makes users remember how far they have gone and what remains. This can increase uncertainty and task abandonment for users with memory or attention difficulties.",
        suggestion="Add a stepper, progress text such as 'Step 2 of 4', a progress element, or aria-current='step' on the active step.",
        evidence={
            "requires_progress_cue": metrics["requires_progress_cue"],
            "has_progress": metrics["has_progress"],
            "multi_step_signal_count": metrics["multi_step_signal_count"],
            "form_step_count": metrics["form_step_count"],
        },
        locations=metrics["progress_locations"][:5],
    )


def detect_cs4_unclear_page_purpose(soup: BeautifulSoup, headings: list[dict[str, Any]]) -> Issue | None:
    title_text = get_document_title(soup)
    h1_headings = [heading for heading in headings if heading["level"] == 1]
    first_h1_text = h1_headings[0]["text"] if h1_headings else ""
    main_text = get_main_intro_text(soup)

    violations: list[dict[str, Any]] = []
    if not title_text:
        violations.append({"type": "missing_title", "text": ""})
    elif is_generic_purpose_text(title_text):
        violations.append({"type": "generic_title", "text": title_text})

    if not h1_headings:
        violations.append({"type": "missing_h1", "text": ""})
    elif is_generic_purpose_text(first_h1_text):
        violations.append({"type": "generic_h1", "text": first_h1_text})

    if not main_text and len(soup.find_all(["section", "article", "nav", "form"])) >= 3:
        violations.append({"type": "missing_introductory_purpose_text", "text": ""})

    if not violations:
        return None

    if any(item["type"] in {"missing_h1", "missing_title"} for item in violations) and len(violations) >= 2:
        severity: Severity = "critical"
    elif len(violations) >= 2:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-4",
        title="Page purpose is unclear",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="When the page title, main heading, or introductory text does not clearly state the page purpose, users must infer what the page is for before they can navigate or act. This increases orientation effort at the first point of interaction.",
        suggestion="Use a specific document title, a descriptive h1, and a short introductory cue that explains the page's purpose or primary task.",
        evidence={"title": title_text, "first_h1": first_h1_text, "has_introductory_text": bool(main_text), "violations": violations},
        locations=violations[:5],
    )


def detect_cs5_unclear_navigation_structure(soup: BeautifulSoup, navs: list[Tag], headings: list[dict[str, Any]]) -> Issue | None:
    all_links = soup.find_all("a")
    section_count = len(soup.find_all(["section", "article"]))
    page_is_complex = len(all_links) >= 8 or section_count >= 4 or len(headings) >= 6
    violations: list[dict[str, Any]] = []

    if page_is_complex and not navs:
        violations.append({"type": "missing_primary_navigation", "link_count": len(all_links), "section_count": section_count})

    for nav_index, nav in enumerate(navs, start=1):
        links = nav.find_all("a")
        label = normalize_text(nav.get("aria-label", "") or nav.get("aria-labelledby", ""))
        if len(navs) > 1 and not label:
            violations.append({"type": "unlabelled_navigation_landmark", "nav_index": nav_index, "summary": get_tag_summary(nav)})
        if len(links) > 12:
            violations.append({"type": "too_many_navigation_links", "nav_index": nav_index, "link_count": len(links), "summary": get_tag_summary(nav)})
        if page_is_complex and len(links) <= 1:
            violations.append({"type": "navigation_too_sparse_for_complex_page", "nav_index": nav_index, "link_count": len(links), "summary": get_tag_summary(nav)})

        seen_link_texts: set[str] = set()
        for link in links:
            text = accessible_name(link)
            normalized_text = text.lower()
            if not text:
                violations.append({"type": "empty_navigation_link", "nav_index": nav_index, "summary": get_tag_summary(link)})
            elif normalized_text in GENERIC_NAV_TEXTS:
                violations.append({"type": "generic_navigation_link", "nav_index": nav_index, "text": text, "summary": get_tag_summary(link)})
            elif normalized_text in seen_link_texts:
                violations.append({"type": "duplicate_navigation_link_text", "nav_index": nav_index, "text": text, "summary": get_tag_summary(link)})
            else:
                seen_link_texts.add(normalized_text)

    if not violations:
        return None

    if any(item["type"] == "missing_primary_navigation" for item in violations) or len(violations) >= 5:
        severity: Severity = "critical"
    elif len(violations) >= 3:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-5",
        title="Navigation structure is unclear",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="Navigation that is missing, overloaded, unlabelled, duplicated, or too generic makes the site hierarchy harder to understand. Users may need to inspect more options before they can predict where a link will take them.",
        suggestion="Provide a clear primary navigation landmark, label multiple navigation regions, keep navigation groups focused, and use specific link names.",
        evidence={"nav_count": len(navs), "link_count": len(all_links), "section_count": section_count, "page_is_complex": page_is_complex, "violations_count": len(violations), "violations": violations[:10]},
        locations=violations[:5],
    )


def detect_cs6_missing_or_unclear_search(soup: BeautifulSoup, headings: list[dict[str, Any]], navs: list[Tag]) -> Issue | None:
    search_nodes = find_search_nodes(soup)
    all_links = soup.find_all("a")
    section_count = len(soup.find_all(["section", "article"]))
    nav_link_count = count_nav_links(navs)
    content_heavy = len(all_links) >= 20 or nav_link_count >= 10 or section_count >= 6 or len(headings) >= 8
    malformed_search_nodes = [node_to_location(node) for node in search_nodes if not search_node_has_label_or_submit(node)]

    if search_nodes and not malformed_search_nodes:
        return None
    if not content_heavy and not malformed_search_nodes:
        return None

    if content_heavy and not search_nodes:
        severity: Severity = "critical" if len(all_links) >= 35 else "major"
        title = "Search is missing on a content-heavy page"
        description = "A content-heavy page without search makes users browse and remember more navigation options before finding what they need. This can increase cognitive load and frustration for users who rely on direct lookup."
        suggestion = "Add a clearly labelled search landmark or search field so users can filter information instead of scanning every section."
        locations: list[dict[str, Any]] = []
    else:
        severity = "major" if len(malformed_search_nodes) > 1 else "minor"
        title = "Search control is unclear"
        description = "A search feature without a clear label, placeholder, or submit control may be harder to identify and use predictably."
        suggestion = "Give the search field an accessible label or placeholder and pair it with a clear search submit button."
        locations = malformed_search_nodes[:5]

    return build_issue(
        rule_id="CS-6",
        title=title,
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description=description,
        suggestion=suggestion,
        evidence={
            "content_heavy": content_heavy,
            "link_count": len(all_links),
            "nav_link_count": nav_link_count,
            "section_count": section_count,
            "heading_count": len(headings),
            "search_node_count": len(search_nodes),
            "malformed_search_node_count": len(malformed_search_nodes),
        },
        locations=locations,
    )


def detect_cs7_unclear_controls(soup: BeautifulSoup) -> Issue | None:
    violations: list[dict[str, Any]] = []
    controls = soup.find_all(["button", "a", "input", "select", "textarea"])

    for control in controls:
        if not isinstance(control, Tag):
            continue
        if control.name == "input" and (control.get("type") or "text").lower() == "hidden":
            continue

        name = accessible_name(control)
        role = (control.get("role") or "").lower()
        has_icon_child = bool(control.find(["svg", "img", "i"]))
        has_visible_text = bool(normalize_text(control.get_text(" ", strip=True)))

        if not name:
            violations.append({"type": "empty_control_name", "tag": control.name, "summary": get_tag_summary(control)})
        elif has_icon_child and not has_visible_text and not (control.get("aria-label") or control.get("aria-labelledby") or control.get("title")):
            violations.append({"type": "icon_only_control_without_accessible_label", "tag": control.name, "summary": get_tag_summary(control)})

        if control.has_attr("aria-expanded") and not control.has_attr("aria-controls") and role in CONTROL_RELATIONSHIP_ROLES:
            violations.append({"type": "expandable_control_without_target_relationship", "tag": control.name, "text": name, "summary": get_tag_summary(control)})

        if role in {"tab", "switch"} and not control.has_attr("aria-controls"):
            violations.append({"type": "stateful_control_without_controlled_region", "tag": control.name, "role": role, "text": name, "summary": get_tag_summary(control)})

    if not violations:
        return None

    if len(violations) >= 6:
        severity: Severity = "critical"
    elif len(violations) >= 3:
        severity = "major"
    else:
        severity = "minor"

    return build_issue(
        rule_id="CS-7",
        title="Controls are not clearly identified",
        severity=severity,
        base_penalty=REGULAR_BASE_PENALTY,
        description="Controls without clear names or relationships make users guess what will happen or what content will change. This weakens predictability and can make interaction flows harder to follow.",
        suggestion="Give every control a clear accessible name and connect tabs, accordions, menus, or expand/collapse controls to the content they affect.",
        evidence={"control_count": len(controls), "violations_count": len(violations), "violations": violations[:10]},
        locations=violations[:5],
    )


def collect_location_cue_metrics(soup: BeautifulSoup, headings: list[dict[str, Any]], navs: list[Tag]) -> dict[str, Any]:
    heading_count = len(headings)
    nav_count = len(navs)
    unique_heading_levels = sorted({heading["level"] for heading in headings})
    breadcrumb_nodes = find_breadcrumb_nodes(soup)
    progress_nodes = find_progress_nodes(soup)
    path_trace_nodes = find_path_trace_nodes(soup)
    multi_step_nodes = find_multi_step_signal_nodes(soup)
    form_step_count = count_form_step_regions(soup)

    has_breadcrumb = bool(breadcrumb_nodes)
    has_progress = bool(progress_nodes)
    has_aria_current_page = any(nav.select('[aria-current="page"]') for nav in navs) and count_nav_links(navs) > 2
    has_current_location_cue = has_breadcrumb or has_aria_current_page
    structure_signal = (
        heading_count >= 4
        and len(unique_heading_levels) >= 3
        and nav_count >= 1
        and bool(soup.find("main"))
        and (len(soup.find_all("section")) + len(soup.find_all("article"))) >= 2
    )

    requires_current_location_cue = False
    current_location_reason = "none"
    current_location_reason_type = "none"
    current_location_locations: list[dict[str, Any]] = []

    if has_breadcrumb or has_aria_current_page:
        requires_current_location_cue = True
        current_location_reason = "page already contains current-location navigation cues"
        current_location_reason_type = "existing_cue"
        current_location_locations.extend(node_to_location(node) for node in breadcrumb_nodes[:3])
    elif path_trace_nodes:
        requires_current_location_cue = True
        current_location_reason = "breadcrumb-like hierarchy traces detected"
        current_location_reason_type = "breadcrumb_trace"
        current_location_locations.extend(node_to_location(node) for node in path_trace_nodes[:3])
    elif structure_signal:
        requires_current_location_cue = True
        current_location_reason = "page has strong multi-level information architecture"
        current_location_reason_type = "strong_information_architecture"
        current_location_locations.extend({"tag": heading["tag"], "text": heading["text"], "level": heading["level"]} for heading in headings[:3])

    return {
        "requires_current_location_cue": requires_current_location_cue,
        "has_current_location_cue": has_current_location_cue,
        "current_location_reason": current_location_reason,
        "current_location_reason_type": current_location_reason_type,
        "current_location_locations": current_location_locations,
        "requires_progress_cue": bool(multi_step_nodes) or form_step_count >= 2,
        "has_breadcrumb": has_breadcrumb,
        "has_progress": has_progress,
        "has_aria_current_page": has_aria_current_page,
        "heading_count": heading_count,
        "nav_count": nav_count,
        "multi_step_signal_count": len(multi_step_nodes),
        "progress_locations": [node_to_location(node) for node in multi_step_nodes[:5]],
        "form_step_count": form_step_count,
    }


def get_headings(soup: BeautifulSoup) -> list[dict[str, Any]]:
    headings: list[dict[str, Any]] = []
    for tag in soup.find_all(HEADING_SELECTORS):
        if isinstance(tag, Tag):
            headings.append({"tag": tag.name, "text": normalize_text(tag.get_text(" ", strip=True)), "level": int(tag.name[1]), "node": tag})
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
        elif "breadcrumb" in attrs_blob:
            nodes.append(tag)
        elif text and PATH_TEXT_PATTERN.search(text):
            nodes.append(tag)
    return dedupe_tags(nodes)


def find_progress_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))
        if tag.name == "progress":
            nodes.append(tag)
        elif (tag.get("aria-current") or "").lower() == "step":
            nodes.append(tag)
        elif any(keyword in attrs_blob for keyword in ("progress", "stepper", "steps")):
            nodes.append(tag)
        elif text and STEP_TEXT_PATTERN.search(text):
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
        elif text and STEP_TEXT_PATTERN.search(text):
            nodes.append(tag)
    return dedupe_tags(nodes)


def find_path_trace_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        text = normalize_text(tag.get_text(" ", strip=True))
        attrs_blob = get_attr_blob(tag)
        if "breadcrumb" in attrs_blob or (text and PATH_TEXT_PATTERN.search(text)):
            nodes.append(tag)
    return dedupe_tags(nodes)


def find_search_nodes(soup: BeautifulSoup) -> list[Tag]:
    nodes: list[Tag] = []
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))
        input_type = (tag.get("type") or "").lower()
        role = (tag.get("role") or "").lower()
        if role == "search" or tag.name == "search":
            nodes.append(tag)
        elif tag.name == "input" and input_type == "search":
            nodes.append(tag)
        elif tag.name == "form" and ("search" in attrs_blob or SEARCH_TEXT_PATTERN.search(text)):
            nodes.append(tag)
    return dedupe_tags(nodes)


def count_form_step_regions(soup: BeautifulSoup) -> int:
    count = 0
    for tag in soup.find_all(["section", "article", "div", "li"]):
        if not isinstance(tag, Tag):
            continue
        attrs_blob = get_attr_blob(tag)
        text = normalize_text(tag.get_text(" ", strip=True))
        if any(keyword in attrs_blob for keyword in ("step", "wizard", "checkout")) or (text and STEP_TEXT_PATTERN.search(text)):
            count += 1
    return count


def count_nav_links(navs: list[Tag]) -> int:
    return sum(len(nav.find_all("a")) for nav in navs)


def has_search(soup: BeautifulSoup) -> bool:
    return bool(find_search_nodes(soup))


def search_node_has_label_or_submit(node: Tag) -> bool:
    if node.name == "input":
        return input_has_label(node) or bool(node.get("placeholder"))

    search_inputs = [input_tag for input_tag in node.find_all("input") if isinstance(input_tag, Tag)]
    has_labelled_input = any((input_tag.get("type") or "").lower() == "search" and (input_has_label(input_tag) or bool(input_tag.get("placeholder"))) for input_tag in search_inputs)
    has_submit = any((tag.name == "button" or (tag.name == "input" and (tag.get("type") or "").lower() in {"submit", "button"})) for tag in node.find_all(["button", "input"]))
    return has_labelled_input or has_submit or bool(node.get("aria-label") or node.get("aria-labelledby"))


def input_has_label(input_tag: Tag) -> bool:
    input_id = input_tag.get("id")
    if input_tag.get("aria-label") or input_tag.get("aria-labelledby") or input_tag.get("title"):
        return True
    root = input_tag
    while isinstance(root.parent, Tag):
        root = root.parent
    if input_id and root.find("label", attrs={"for": input_id}):
        return True
    parent = input_tag.parent
    while isinstance(parent, Tag):
        if parent.name == "label":
            return True
        parent = parent.parent
    return False


def get_document_title(soup: BeautifulSoup) -> str:
    title_tag = soup.find("title")
    return normalize_text(title_tag.get_text(" ", strip=True)) if isinstance(title_tag, Tag) else ""


def get_main_intro_text(soup: BeautifulSoup) -> str:
    main = soup.find("main") or soup.find("body") or soup
    if not isinstance(main, Tag):
        return ""
    for tag in main.find_all(["p", "h1", "h2"], limit=4):
        text = normalize_text(tag.get_text(" ", strip=True))
        if len(text.split()) >= 4:
            return text
    return ""


def is_generic_purpose_text(text: str) -> bool:
    normalized = normalize_text(text).lower().strip(" .:-|")
    return normalized in GENERIC_PAGE_PURPOSE_TEXTS or len(normalized) <= 2


def accessible_name(tag: Tag) -> str:
    labelledby = tag.get("aria-labelledby")
    if isinstance(labelledby, str):
        root = tag
        while isinstance(root.parent, Tag):
            root = root.parent
        parts: list[str] = []
        for label_id in labelledby.split():
            label = root.find(id=label_id)
            if isinstance(label, Tag):
                parts.append(normalize_text(label.get_text(" ", strip=True)))
        labelled_name = normalize_text(" ".join(parts))
        if labelled_name:
            return labelled_name

    for attr in ("aria-label", "title", "alt", "value", "placeholder"):
        value = tag.get(attr)
        if isinstance(value, str) and normalize_text(value):
            return normalize_text(value)

    return normalize_text(tag.get_text(" ", strip=True))


def dedupe_tags(tags: list[Tag]) -> list[Tag]:
    seen: set[int] = set()
    result: list[Tag] = []
    for tag in tags:
        marker = id(tag)
        if marker not in seen:
            seen.add(marker)
            result.append(tag)
    return result


def node_to_location(tag: Tag) -> dict[str, Any]:
    return {"tag": tag.name or "unknown", "summary": get_tag_summary(tag), "text": normalize_text(tag.get_text(" ", strip=True))[:120]}


def get_attr_blob(tag: Tag) -> str:
    parts = [
        tag.get("id", ""),
        " ".join(tag.get("class", [])),
        tag.get("role", ""),
        tag.get("aria-label", ""),
        tag.get("aria-current", ""),
        tag.get("type", ""),
        tag.get("placeholder", ""),
    ]
    return " ".join(parts).lower()


def get_tag_summary(tag: Tag) -> str:
    tag_name = tag.name or "unknown"
    element_id = f"#{tag.get('id')}" if tag.get("id") else ""
    classes = "." + ".".join(tag.get("class", [])) if tag.get("class") else ""
    return f"{tag_name}{element_id}{classes}"


def normalize_text(text: str) -> str:
    return " ".join(text.split())


def load_html_from_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8")


def main() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Analyze the Consistency dimension for an HTML file.")
    parser.add_argument("html_file", help="Path to an HTML file")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    args = parser.parse_args()

    html = load_html_from_file(args.html_file)
    result = analyze_consistency(html).to_dict()

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
