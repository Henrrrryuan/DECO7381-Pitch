from __future__ import annotations

import logging
import math
import os
import re
import hashlib
from typing import Any

_logger = logging.getLogger(__name__)

from bs4 import BeautifulSoup, Tag

from ..schemas import AnalysisResult, Issue

def _coerce_sc_count_metric(raw: Any) -> int | None:
    """Normalize SC-1 numeric metrics for JSON (ints only; bool and non-finite floats rejected)."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float) and math.isfinite(raw) and raw == int(raw):
        return int(raw)
    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return None
        try:
            return int(stripped, 10)
        except ValueError:
            return None
    return None


def _finalize_sc_location_sentence_fields(payload: dict[str, Any], original: dict[str, Any]) -> None:
    """Re-apply SC sentence-level fields after base payload merge so sanitize never drops them."""
    preview = original.get("sentence_preview")
    if isinstance(preview, str):
        payload["sentence_preview"] = preview
    for key in ("sentence_word_count", "comma_count", "conjunction_count"):
        payload.pop(key, None)
        coerced = _coerce_sc_count_metric(original.get(key))
        if coerced is not None:
            payload[key] = coerced


def _debug_warn_sc_metrics_if_incomplete(
    payload: dict[str, Any],
    original: dict[str, Any],
    rule_id: str | None,
) -> None:
    """Temporary SC-1 persistence check (remove once metrics regressions are cleared)."""
    if rule_id != "SC-1":
        return
    missing = [
        key
        for key in ("sentence_word_count", "comma_count", "conjunction_count")
        if key not in payload
    ]
    if not missing:
        return
    _logger.warning(
        "SC-1 sanitize: incomplete sentence metrics missing=%s tag=%s selector=%s "
        "original_present=%s",
        missing,
        payload.get("tag"),
        payload.get("selector"),
        [k for k in ("sentence_word_count", "comma_count", "conjunction_count") if k in original],
    )


BAD_TARGET_TAGS = {
    "html", "head", "body", "script", "style", "meta", "link",
    "noscript", "template", "defs", "path", "symbol", "clippath", "mask", "title",
}
STRUCTURAL_TAGS = {"section", "article", "main", "header", "footer", "nav", "ul", "ol", "form", "fieldset", "table"}
GENERIC_SELECTOR_TAGS = {"a", "button", "div", "section", "p", "li", "img", "input", "article", "nav", "main"}
READABILITY_TAGS = {
    "p", "li", "td", "th", "caption", "figcaption", "label", "legend",
    "h1", "h2", "h3", "h4", "h5", "h6", "abbr", "acronym",
}
INTERACTION_TAGS = {"a", "button", "input", "select", "textarea", "dialog"}
MEDIA_TAGS = {"img", "video", "audio"}
FOCAL_POINT_TAGS = INTERACTION_TAGS | MEDIA_TAGS | {"h1", "h2", "h3", "nav", "header", "section", "article"}

SUMMARY_SELECTOR_PATTERN = re.compile(r"^[a-z][a-z0-9-]*(?:#[A-Za-z0-9_-]+)?(?:\.[A-Za-z0-9_-]+)*$", re.I)


def _location_is_intentional_structural_finding(location: Any) -> bool:
    """Document-level or other rows that deliberately omit normal DOM highlight targets."""
    if not isinstance(location, dict):
        return False
    if location.get("documentStructuralFinding") is True:
        return True
    if location.get("highlightable") is False and str(location.get("tag") or "").lower() == "document":
        return True
    return False


def _issue_can_survive_without_locations(issue: Issue) -> bool:
    """True when an issue may remain in the report with zero post-sanitize locations."""
    evidence = issue.evidence if isinstance(issue.evidence, dict) else {}
    return evidence.get("documentStructuralFinding") is True


def _issue_should_remain_after_sanitize(issue: Issue) -> bool:
    locations = issue.locations if isinstance(issue.locations, list) else []
    if locations:
        return True
    return _issue_can_survive_without_locations(issue)


def _drop_post_sanitize_ghost_issues(issues: list[Issue]) -> list[Issue]:
    """Remove issues whose locations were fully stripped by sanitize (empty issue cards)."""
    return [issue for issue in issues if _issue_should_remain_after_sanitize(issue)]


def sanitize_analysis_locations(analysis: AnalysisResult, html: str) -> AnalysisResult:
    soup = BeautifulSoup(html or "", "html.parser")
    for dimension in analysis.dimensions:
        for issue in dimension.issues:
            if _dt1_lineage_enabled() and issue.rule_id == "DT-1":
                _dt1_lineage_log("sanitize.input", issue.locations)
            if _lcc_audit_enabled() and issue.rule_id == "LCC-1":
                _lcc_lineage_log("sanitize.input", issue.locations)
            if _amc_audit_enabled() and issue.rule_id == "AMC-1":
                _amc_lineage_log("sanitize.input", issue.locations)
            if _ei_audit_enabled() and issue.rule_id == "EI-1":
                _ei_lineage_log("sanitize.input", issue.locations)
            issue.locations = sanitize_issue_locations(
                soup,
                issue.locations,
                dimension.dimension,
                issue.rule_id,
            )
            if _dt1_lineage_enabled() and issue.rule_id == "DT-1":
                _dt1_lineage_log("sanitize.output", issue.locations)
            if _lcc_audit_enabled() and issue.rule_id == "LCC-1":
                _lcc_lineage_log("sanitize.output", issue.locations)
            if _amc_audit_enabled() and issue.rule_id == "AMC-1":
                _amc_lineage_log("sanitize.output", issue.locations)
            if _ei_audit_enabled() and issue.rule_id == "EI-1":
                _ei_lineage_log("sanitize.output", issue.locations)
        dimension.issues = _drop_post_sanitize_ghost_issues(dimension.issues)
    return analysis


def _dt1_lineage_enabled() -> bool:
    return os.environ.get("DT1_LINEAGE") == "1"


def _dt1_loc_text(loc: dict[str, Any]) -> str:
    for key in ("text", "preview", "sentence_preview", "label"):
        value = loc.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _dt1_lineage_id(loc: dict[str, Any], index: int) -> str:
    selector = str(loc.get("selector") or "")
    tag = str(loc.get("tag") or "")
    attrs = loc.get("attrs") if isinstance(loc.get("attrs"), dict) else {}
    dom_id = str(attrs.get("id") or "")
    case_id = str(attrs.get("data-case-id") or "")
    text = _dt1_loc_text(loc)
    digest = hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()[:10] if text else ""
    return f"dt:{index}:{selector}:{tag}:{dom_id}:{case_id}:{digest}"


def _dt1_lineage_log(stage: str, locations: list[dict[str, Any]] | None) -> None:
    locs = locations or []
    selectors = [str(loc.get("selector") or "") for loc in locs]
    texts = [_dt1_loc_text(loc) for loc in locs]
    ids = [_dt1_lineage_id(loc, idx) for idx, loc in enumerate(locs)]
    dup_selector_count = sum(1 for s in set(selectors) if s and selectors.count(s) > 1)
    dup_text_count = sum(1 for t in set(texts) if t and texts.count(t) > 1)
    print("[DT-1 locations]", stage, {
        "dt_location_count": len(locs),
        "dt_location_ids": ids,
        "selectors": selectors,
        "duplicate_selector_count": dup_selector_count,
        "duplicate_text_count": dup_text_count,
    })


def _lcc_audit_enabled() -> bool:
    return os.environ.get("LCC_AUDIT") == "1"


def _lcc_loc_id(loc: dict[str, Any], index: int) -> str:
    attrs = loc.get("attrs") if isinstance(loc.get("attrs"), dict) else {}
    dom_id = str(attrs.get("id") or "")
    case_id = str(attrs.get("data-case-id") or "")
    selector = str(loc.get("selector") or "")
    tag = str(loc.get("tag") or "")
    wc = str(loc.get("word_count") or "")
    hc = str(loc.get("heading_count") or "")
    lc = str(loc.get("list_count") or "")
    pc = str(loc.get("paragraph_count") or "")
    return f"lcc:{index}:{selector}:{tag}:{dom_id}:{case_id}:{wc}:{hc}:{lc}:{pc}"


def _lcc_lineage_log(stage: str, locations: list[dict[str, Any]] | None) -> None:
    locs = locations or []
    selectors = [str(loc.get("selector") or "") for loc in locs if isinstance(loc, dict)]
    ids = []
    for idx, loc in enumerate(locs):
        if not isinstance(loc, dict):
            continue
        ids.append(_lcc_loc_id(loc, idx))
    dup_selector_count = sum(1 for s in set(selectors) if s and selectors.count(s) > 1)
    print("[LCC lineage]", stage, {
        "location_count": len(locs),
        "location_ids": ids,
        "selectors": selectors,
        "duplicate_selector_count": dup_selector_count,
    })


def _amc_audit_enabled() -> bool:
    return os.environ.get("AMC_AUDIT") == "1"


def _amc_loc_id(loc: dict[str, Any], index: int) -> str:
    summary = str(loc.get("summary") or "")
    tag = str(loc.get("tag") or "")
    region = str(loc.get("region") or "")
    muted = str(loc.get("muted") or "")
    src = str(loc.get("src") or "")
    return f"amc:{index}:{tag}:{region}:{muted}:{len(summary)}:{len(src)}"


def _amc_lineage_log(stage: str, locations: list[dict[str, Any]] | None) -> None:
    locs = locations or []
    ids: list[str] = []
    summaries: list[str] = []
    for idx, loc in enumerate(locs):
        if not isinstance(loc, dict):
            continue
        ids.append(_amc_loc_id(loc, idx))
        summaries.append(str(loc.get("summary") or ""))
    dup_summary_count = sum(1 for s in set(summaries) if s and summaries.count(s) > 1)
    print("[AMC lineage]", stage, {
        "location_count": len(locs),
        "location_ids": ids,
        "duplicate_summary_count": dup_summary_count,
    })


def _ei_audit_enabled() -> bool:
    return os.environ.get("EI_AUDIT") == "1"


def _ei_loc_id(loc: dict[str, Any], index: int) -> str:
    summary = str(loc.get("summary") or "")
    interrupt_type = str(loc.get("interrupt_type") or "")
    overlay_like = str(loc.get("overlay_like") or "")
    fixed_or_sticky = str(loc.get("fixed_or_sticky") or "")
    aria = ""
    attrs = loc.get("attrs") if isinstance(loc.get("attrs"), dict) else {}
    if attrs.get("aria-label"):
        aria = str(attrs.get("aria-label") or "")
    return f"ei:{index}:{interrupt_type}:{overlay_like}:{fixed_or_sticky}:{len(summary)}:{len(aria)}"


def _ei_lineage_log(stage: str, locations: list[dict[str, Any]] | None) -> None:
    locs = locations or []
    ids: list[str] = []
    types: list[str] = []
    for idx, loc in enumerate(locs):
        if not isinstance(loc, dict):
            continue
        ids.append(_ei_loc_id(loc, idx))
        types.append(str(loc.get("interrupt_type") or ""))
    dup_type_count = sum(1 for t in set(types) if t and types.count(t) > 1)
    print("[EI lineage]", stage, {
        "location_count": len(locs),
        "location_ids": ids,
        "interrupt_types": types,
        "duplicate_interrupt_type_count": dup_type_count,
    })


def _phs_location_dedupe_identity(location: dict[str, Any]) -> str:
    """Disambiguate PHS rows when post-resolve stable_selector collides across distinct headings."""
    if _phs_structural_pass_through(location):
        return ""
    text = normalize_text(_phs_first_nonempty_text_field(location)).lower()
    if text:
        return text
    incoming_selector = str(location.get("selector") or "").strip()
    if incoming_selector:
        return incoming_selector
    attrs = location.get("attrs")
    if isinstance(attrs, dict) and attrs.get("id"):
        return f"id:{attrs['id']}"
    tag_name = str(location.get("tag") or "").lower()
    heading_level = location.get("headingLevel")
    if tag_name and heading_level is not None:
        return f"{tag_name}:{heading_level}"
    return ""


def _location_dedupe_key(rule_id: str, selector: str, location: dict[str, Any]) -> Any:
    if rule_id == "PHS-1":
        return (
            selector,
            str(location.get("violationType") or ""),
            _phs_location_dedupe_identity(location),
        )
    return selector


def _candidate_used(
    tag: Tag,
    location: dict[str, Any],
    rule_id: str,
    used_keys: set[Any],
) -> bool:
    selector = stable_selector(tag)
    key = _location_dedupe_key(rule_id, selector, location)
    return key in used_keys


def _max_sanitized_locations(rule_id: str) -> int | None:
    """Return None for no cap (preserve every detector-supplied location)."""
    if rule_id == "WIP-1":
        return None
    if rule_id == "AMC-1":
        return None
    if rule_id == "EI-1":
        return None
    return 8


def _lc1_forensic() -> bool:
    return os.environ.get("LC1_FORENSIC") == "1"


def _lc1_incoming_case_id(location: dict[str, Any]) -> str | None:
    attrs = location.get("attrs")
    if isinstance(attrs, dict):
        raw = attrs.get("data-case-id")
        return str(raw) if raw else None
    return None


def _lc1_sanitize_log(
    location: dict[str, Any],
    resolved: dict[str, Any] | None,
    *,
    survived: bool,
) -> None:
    if not _lc1_forensic():
        return
    print(
        "[LC-1 sanitize]",
        location.get("selector"),
        _lc1_incoming_case_id(location),
        (resolved or {}).get("selector"),
        (resolved or {}).get("tag"),
        "survived" if survived else "lost",
    )


def _phs_structural_pass_through(location: dict[str, Any]) -> bool:
    """PHS-1 document-level finding: do not resolve to body/main or aggregate page text."""
    if not isinstance(location, dict):
        return False
    if location.get("documentStructuralFinding") is True:
        return True
    if location.get("highlightable") is False:
        return True
    if str(location.get("tag") or "").lower() == "document":
        return True
    return False


def build_structural_phs_sanitized_payload(original: dict[str, Any]) -> dict[str, Any]:
    """Stable payload for structural-only PHS rows (no DOM highlight)."""
    payload: dict[str, Any] = {
        "tag": "document",
        "selector": "",
        "summary": "",
        "label": "Document structure",
        "preview": "",
        "highlightable": False,
        "documentStructuralFinding": True,
    }
    for key in (
        "violationType",
        "headingLevel",
        "previousHeadingLevel",
        "currentHeadingLevel",
        "attrs",
    ):
        if key in original:
            payload[key] = original[key]
    return payload


PHS_HEADING_TAG_NAMES = frozenset({"h1", "h2", "h3", "h4", "h5", "h6"})
PHS_HEADING_TAGS_LIST = ["h1", "h2", "h3", "h4", "h5", "h6"]


def _phs_first_nonempty_text_field(location: dict[str, Any]) -> str:
    for key in ("text", "preview", "sentence_preview", "label"):
        raw = str(location.get(key) or "").strip()
        if raw:
            return raw
    return ""


def _phs_normalize_heading_plain(tag: Tag) -> str:
    return normalize_text(tag.get_text(" ", strip=True)).lower()


def _phs_narrow_tags_by_exact_heading_text(sel_tags: list[Tag], location: dict[str, Any]) -> list[Tag]:
    """When a selector matches multiple nodes, keep only headings whose text equals the location payload."""
    target = normalize_text(_phs_first_nonempty_text_field(location)).lower()
    if not target:
        return []
    out: list[Tag] = []
    for tag in sel_tags:
        if not isinstance(tag, Tag):
            continue
        if (tag.name or "").lower() not in PHS_HEADING_TAG_NAMES:
            continue
        if _phs_normalize_heading_plain(tag) == target:
            out.append(tag)
    return dedupe_tags(out)


def _find_by_text_phs_strict(soup: BeautifulSoup, text: str) -> list[Tag]:
    """PHS-1: exact normalized match on h1–h6 only; no substring / fuzzy overlap."""
    normalized = normalize_text(text).lower()
    if not normalized:
        return []
    matches: list[Tag] = []
    for tag in soup.find_all(PHS_HEADING_TAGS_LIST):
        if not isinstance(tag, Tag):
            continue
        if _phs_normalize_heading_plain(tag) == normalized:
            matches.append(tag)
    return matches


def _find_candidate_tags_phs(soup: BeautifulSoup, location: dict[str, Any]) -> list[Tag]:
    """PHS-1 only: selector-first; strict heading text fallback (no global find_by_text)."""
    selector = str(location.get("selector") or "").strip()
    if selector:
        sel_tags = select_safely(soup, selector)
        if len(sel_tags) == 1:
            return sel_tags
        if len(sel_tags) > 1:
            narrowed = _phs_narrow_tags_by_exact_heading_text(sel_tags, location)
            if narrowed:
                return narrowed

    candidates: list[Tag] = []
    summary = str(location.get("summary") or location.get("region") or "").strip()
    if is_usable_summary_selector(summary):
        candidates.extend(select_safely(soup, summary))

    attrs = location.get("attrs") if isinstance(location.get("attrs"), dict) else {}
    tag_name = normalized_tag(location.get("tag"))
    if attrs:
        candidates.extend(find_by_attrs(soup, tag_name, attrs))

    if location.get("block_index"):
        block = block_by_index(soup, int(location.get("block_index") or 0))
        if block is not None:
            return [block]

    for text_key in ("text", "preview", "sentence_preview", "label"):
        text = str(location.get(text_key) or "").strip()
        if text:
            candidates.extend(_find_by_text_phs_strict(soup, text))

    return dedupe_tags(candidates)


def _phs_extended_heading_selector_path(tag: Tag) -> str:
    """Ancestor chain for repeated section > header > h1 blocks (unique per section id/nth)."""
    parts: list[str] = []
    current: Tag | None = tag
    while isinstance(current, Tag) and (current.name or "").lower() not in {"[document]", "html", "body"}:
        name = (current.name or "").lower()
        if not name or name in BAD_TARGET_TAGS:
            break
        element_id = current.get("id")
        if element_id:
            parts.append(f"{name}#{css_identifier_escape(str(element_id))}")
            break
        siblings: list[Tag] = []
        if isinstance(current.parent, Tag):
            siblings = [
                sibling
                for sibling in current.parent.find_all(name, recursive=False)
                if isinstance(sibling, Tag)
            ]
        index = 1
        for i, sibling in enumerate(siblings):
            if sibling is current:
                index = i + 1
                break
        parts.append(f"{name}:nth-of-type({index})")
        current = current.parent if isinstance(current.parent, Tag) else None
        if len(parts) >= 10:
            break
    return " > ".join(reversed(parts))


def _phs_grounding_selector(soup: BeautifulSoup, tag: Tag) -> str:
    """Unique highlight selector for a resolved PHS heading (never re-emit ambiguous stable_selector)."""
    if not isinstance(tag, Tag):
        return ""
    tag_name = (tag.name or "").lower()
    if tag_name not in PHS_HEADING_TAG_NAMES:
        return stable_selector(tag)

    cognilens_id = tag.get("data-cognilens-id")
    if cognilens_id:
        cognilens_sel = f'[data-cognilens-id="{css_attr_escape(str(cognilens_id))}"]'
        if len(select_safely(soup, cognilens_sel)) == 1:
            return cognilens_sel

    element_id = tag.get("id")
    if element_id:
        id_sel = f"#{css_identifier_escape(str(element_id))}"
        if len(select_safely(soup, id_sel)) == 1:
            return id_sel

    extended = _phs_extended_heading_selector_path(tag)
    if extended and len(select_safely(soup, extended)) == 1:
        return extended

    stable = stable_selector(tag)
    if stable and len(select_safely(soup, stable)) == 1:
        return stable

    return extended or stable


def sanitize_issue_locations(
    soup: BeautifulSoup,
    locations: list[dict[str, Any]],
    dimension_name: str,
    rule_id: str,
) -> list[dict[str, Any]]:
    # AMC-1 locations are evidence dictionaries (often selector/snippet based) and
    # must be preserved without selector-lock dedupe collapsing aggregated evidence.
    if rule_id == "AMC-1":
        return list(locations or [])
    # EI-1 locations are snippet-based evidence dictionaries (summary/html_snippet/interrupt_type/flags)
    # and must be preserved as-is (no grounding/dedupe/canonicalization).
    if rule_id == "EI-1":
        return list(locations or [])
    sanitized: list[dict[str, Any]] = []
    used_keys: set[Any] = set()
    cap = _max_sanitized_locations(rule_id)
    for location in locations or []:
        if rule_id == "PHS-1" and _phs_structural_pass_through(location):
            dedupe_key = _location_dedupe_key(rule_id, str(location.get("selector") or ""), location)
            if dedupe_key in used_keys:
                continue
            used_keys.add(dedupe_key)
            sanitized.append(build_structural_phs_sanitized_payload(location))
            if cap is not None and len(sanitized) >= cap:
                break
            continue

        if rule_id == "PHS-1" and not _phs_structural_pass_through(location):
            locked_tag = _phs_try_lock_unique_selector_heading(soup, location, dimension_name, rule_id)
            if locked_tag is not None:
                selector = _phs_grounding_selector(soup, locked_tag)
                if selector:
                    dedupe_key = _location_dedupe_key(rule_id, selector, location)
                    if dedupe_key in used_keys:
                        continue
                    used_keys.add(dedupe_key)
                    sanitized.append(build_location_payload(locked_tag, location, selector, rule_id))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        if rule_id == "VO-1":
            locked_vo = _vo_try_lock_unique_selector(soup, location, dimension_name, rule_id)
            if locked_vo is not None:
                selector_vo = stable_selector(locked_vo)
                if selector_vo:
                    dedupe_key_vo = _location_dedupe_key(rule_id, selector_vo, location)
                    if dedupe_key_vo in used_keys:
                        continue
                    used_keys.add(dedupe_key_vo)
                    sanitized.append(build_location_payload(locked_vo, location, selector_vo, rule_id))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        if rule_id == "WIP-1" and not (
            location.get("highlightable") is False or location.get("documentStructuralFinding") is True
        ):
            locked_wip = _wip_try_lock_unique_selector_cta(soup, location, dimension_name, rule_id)
            if locked_wip is not None:
                selector_wip = stable_selector(locked_wip)
                if selector_wip:
                    dedupe_key_wip = _location_dedupe_key(rule_id, selector_wip, location)
                    if dedupe_key_wip in used_keys:
                        continue
                    used_keys.add(dedupe_key_wip)
                    sanitized.append(build_location_payload(locked_wip, location, selector_wip, rule_id))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        if rule_id == "NC-1" and not (
            location.get("highlightable") is False or location.get("documentStructuralFinding") is True
        ):
            locked_nc = _nc_try_lock_unique_selector_nav(soup, location, dimension_name, rule_id)
            if locked_nc is not None:
                selector_nc = stable_selector(locked_nc)
                if selector_nc:
                    dedupe_key_nc = _location_dedupe_key(rule_id, selector_nc, location)
                    if dedupe_key_nc in used_keys:
                        continue
                    used_keys.add(dedupe_key_nc)
                    sanitized.append(build_location_payload(locked_nc, location, selector_nc, rule_id))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        if rule_id == "SC-1" and not (
            location.get("highlightable") is False or location.get("documentStructuralFinding") is True
        ):
            locked_sc = _sc_try_lock_unique_selector_text_block(soup, location, dimension_name, rule_id)
            if locked_sc is not None:
                selector_sc = stable_selector(locked_sc)
                if selector_sc:
                    dedupe_key_sc = _location_dedupe_key(rule_id, selector_sc, location)
                    if dedupe_key_sc in used_keys:
                        continue
                    used_keys.add(dedupe_key_sc)
                    sanitized.append(build_location_payload(locked_sc, location, selector_sc, rule_id))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        if rule_id == "LC-1" and not (
            location.get("highlightable") is False or location.get("documentStructuralFinding") is True
        ):
            locked_lc = _lc_try_lock_unique_selector_text_block(soup, location, dimension_name, rule_id)
            if locked_lc is not None:
                selector_lc = stable_selector(locked_lc)
                if selector_lc:
                    dedupe_key_lc = _location_dedupe_key(rule_id, selector_lc, location)
                    if dedupe_key_lc in used_keys:
                        if _lc1_forensic():
                            print(
                                "[LC-1 missing]",
                                _lc1_incoming_case_id(location),
                                "sanitize",
                                "dedupe_collapsed",
                            )
                        continue
                    used_keys.add(dedupe_key_lc)
                    payload_lc = build_location_payload(locked_lc, location, selector_lc, rule_id)
                    sanitized.append(payload_lc)
                    _lc1_sanitize_log(location, payload_lc, survived=True)
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        if rule_id == "DT-1" and not (
            location.get("highlightable") is False or location.get("documentStructuralFinding") is True
        ):
            locked_dt = _dt_try_lock_unique_selector_text_block(soup, location, dimension_name, rule_id)
            if locked_dt is not None:
                selector_dt = stable_selector(locked_dt)
                if selector_dt:
                    dedupe_key_dt = _location_dedupe_key(rule_id, selector_dt, location)
                    if dedupe_key_dt in used_keys:
                        continue
                    used_keys.add(dedupe_key_dt)
                    sanitized.append(build_location_payload(locked_dt, location, selector_dt, rule_id))
                    if cap is not None and len(sanitized) >= cap:
                        break
                    continue

        candidate = best_candidate_for_location(soup, location, dimension_name, rule_id, used_keys)
        if candidate is None:
            if rule_id == "LC-1" and _lc1_forensic():
                print(
                    "[LC-1 missing]",
                    _lc1_incoming_case_id(location),
                    "sanitize",
                    "no_resolvable_candidate",
                )
            continue
        if rule_id == "NC-1" and (candidate.name or "").lower() != "nav":
            continue
        if rule_id == "SC-1" and (candidate.name or "").lower() not in SC_TEXT_BLOCK_TAG_NAMES:
            continue
        if rule_id == "LC-1" and (candidate.name or "").lower() not in LC_TEXT_BLOCK_TAG_NAMES:
            if _lc1_forensic():
                print(
                    "[LC-1 missing]",
                    _lc1_incoming_case_id(location),
                    "sanitize",
                    "candidate_tag_not_in_lc_scope",
                )
            continue
        if rule_id == "DT-1" and (candidate.name or "").lower() not in DT_TEXT_BLOCK_TAG_NAMES:
            continue
        if rule_id == "PHS-1" and (candidate.name or "").lower() in PHS_HEADING_TAG_NAMES:
            selector = _phs_grounding_selector(soup, candidate)
        else:
            selector = stable_selector(candidate)
        if not selector:
            if rule_id == "LC-1" and _lc1_forensic():
                print(
                    "[LC-1 missing]",
                    _lc1_incoming_case_id(location),
                    "sanitize",
                    "empty_stable_selector",
                )
            continue
        dedupe_key = _location_dedupe_key(rule_id, selector, location)
        if dedupe_key in used_keys:
            if rule_id == "LC-1" and _lc1_forensic():
                print(
                    "[LC-1 missing]",
                    _lc1_incoming_case_id(location),
                    "sanitize",
                    "dedupe_collapsed",
                )
            continue
        used_keys.add(dedupe_key)
        payload_gen = build_location_payload(candidate, location, selector, rule_id)
        sanitized.append(payload_gen)
        if rule_id == "LC-1":
            _lc1_sanitize_log(location, payload_gen, survived=True)
        if cap is not None and len(sanitized) >= cap:
            break
    return sanitized


def best_candidate_for_location(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
    used_keys: set[Any],
) -> Tag | None:
    candidates = [
        candidate
        for candidate in find_candidate_tags(soup, location, dimension_name, rule_id)
        if is_candidate_highlightable(candidate, dimension_name, rule_id)
        and (
            rule_id != "SC-1"
            or (candidate.name or "").lower() in SC_TEXT_BLOCK_TAG_NAMES
        )
        and (
            rule_id != "LC-1"
            or (candidate.name or "").lower() in LC_TEXT_BLOCK_TAG_NAMES
        )
        and (
            rule_id != "DT-1"
            or (candidate.name or "").lower() in DT_TEXT_BLOCK_TAG_NAMES
        )
    ]
    if not candidates:
        return None
    chosen = sorted(
        candidates,
        key=lambda tag: (
            _candidate_used(tag, location, rule_id, used_keys),
            structural_penalty(tag, dimension_name, rule_id),
            document_order_index(tag),
        ),
    )[0]
    if rule_id == "DT-1" and (chosen.name or "").lower() not in DT_TEXT_BLOCK_TAG_NAMES:
        return None
    return chosen


def find_candidate_tags(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> list[Tag]:
    if not isinstance(location, dict):
        return []

    if rule_id == "PHS-1" and _phs_structural_pass_through(location):
        return []

    if rule_id == "PHS-1":
        return _find_candidate_tags_phs(soup, location)

    if rule_id == "VO-1":
        return _find_candidate_tags_vo(soup, location)

    candidates: list[Tag] = []
    selector = str(location.get("selector") or "").strip()
    if selector:
        candidates.extend(select_safely(soup, selector))

    summary = str(location.get("summary") or location.get("region") or "").strip()
    if is_usable_summary_selector(summary):
        candidates.extend(select_safely(soup, summary))

    attrs = location.get("attrs") if isinstance(location.get("attrs"), dict) else {}
    tag_name = normalized_tag(location.get("tag"))
    if attrs:
        candidates.extend(find_by_attrs(soup, tag_name, attrs))

    if location.get("block_index"):
        block = block_by_index(soup, int(location.get("block_index") or 0))
        if block is not None:
            # Text selectors index their own block stream. Keep that exact
            # block ahead of fuzzy matches against short nested labels.
            return [block]

    for text_key in ("text", "preview", "sentence_preview", "label"):
        text = str(location.get(text_key) or "").strip()
        if text:
            candidates.extend(find_by_text(soup, tag_name, text, dimension_name, rule_id))

    return dedupe_tags(candidates)


def select_safely(soup: BeautifulSoup, selector: str) -> list[Tag]:
    if is_too_generic_selector(selector):
        return []
    try:
        return [tag for tag in soup.select(selector) if isinstance(tag, Tag)]
    except Exception:
        return []


def _phs_try_lock_unique_selector_heading(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """PHS-1: when detector selector resolves to exactly one heading, lock identity (skip candidate ranking)."""
    if rule_id != "PHS-1" or _phs_structural_pass_through(location):
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if (tag.name or "").lower() not in PHS_HEADING_TAG_NAMES:
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


VO_STRICT_TEXT_TAG_NAMES = [
    "a",
    "article",
    "aside",
    "audio",
    "button",
    "div",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "iframe",
    "img",
    "input",
    "li",
    "main",
    "nav",
    "p",
    "section",
    "select",
    "span",
    "textarea",
    "ul",
    "ol",
    "video",
]


def _vo_normalize_plain(tag: Tag) -> str:
    return normalize_text(tag.get_text(" ", strip=True)).lower()


def _vo_narrow_tags_by_exact_text(sel_tags: list[Tag], location: dict[str, Any]) -> list[Tag]:
    target = normalize_text(_phs_first_nonempty_text_field(location)).lower()
    if not target:
        return []
    out: list[Tag] = []
    for tag in sel_tags:
        if isinstance(tag, Tag) and _vo_normalize_plain(tag) == target:
            out.append(tag)
    return dedupe_tags(out)


def _find_by_text_vo_strict(soup: BeautifulSoup, tag_name: str, text: str) -> list[Tag]:
    """VO-1: exact normalized full-text match only (no substring drift)."""
    normalized = normalize_text(text).lower()
    if not normalized:
        return []
    tn = normalized_tag(tag_name)
    if tn and tn not in BAD_TARGET_TAGS:
        matches: list[Tag] = []
        for tag in soup.find_all(tn):
            if isinstance(tag, Tag) and _vo_normalize_plain(tag) == normalized:
                matches.append(tag)
        return matches
    matches: list[Tag] = []
    for tag in soup.find_all(VO_STRICT_TEXT_TAG_NAMES):
        if isinstance(tag, Tag) and _vo_normalize_plain(tag) == normalized:
            matches.append(tag)
    return dedupe_tags(matches)


def _find_candidate_tags_vo(soup: BeautifulSoup, location: dict[str, Any]) -> list[Tag]:
    """VO-1: selector-first, strict text, no focal-point invention."""
    selector = str(location.get("selector") or "").strip()
    if selector:
        sel_tags = select_safely(soup, selector)
        if len(sel_tags) == 1:
            return sel_tags
        if len(sel_tags) > 1:
            narrowed = _vo_narrow_tags_by_exact_text(sel_tags, location)
            if narrowed:
                return narrowed

    candidates: list[Tag] = []
    summary = str(location.get("summary") or location.get("region") or "").strip()
    if is_usable_summary_selector(summary):
        candidates.extend(select_safely(soup, summary))

    attrs = location.get("attrs") if isinstance(location.get("attrs"), dict) else {}
    tag_name = normalized_tag(location.get("tag"))
    if attrs:
        candidates.extend(find_by_attrs(soup, tag_name, attrs))

    if location.get("block_index"):
        block = block_by_index(soup, int(location.get("block_index") or 0))
        if block is not None:
            return [block]

    for text_key in ("text", "preview", "sentence_preview", "label"):
        text = str(location.get(text_key) or "").strip()
        if text:
            candidates.extend(_find_by_text_vo_strict(soup, tag_name, text))

    return dedupe_tags(candidates)


def _vo_try_lock_unique_selector(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """VO-1: when detector selector resolves to exactly one node, lock identity (skip ranking/fuzzy)."""
    if rule_id != "VO-1":
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


def _wip_tag_matches_locked_cta_shape(tag: Tag) -> bool:
    """Matches WIP-1 detector's direct CTA nodes (button, link, role button/link, submit/button inputs)."""
    if not isinstance(tag, Tag):
        return False
    name = (tag.name or "").lower()
    role = str(tag.get("role") or "").strip().lower()
    if role in {"button", "link"}:
        return True
    if name == "button":
        return True
    if name == "a":
        href = str(tag.get("href") or "").strip()
        return bool(href) and not href.startswith("#")
    if name == "input":
        return str(tag.get("type") or "text").lower() in {"button", "submit"}
    return False


def _wip_try_lock_unique_selector_cta(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """WIP-1: unique selector resolves to one CTA-shaped node — lock identity (skip fuzzy sanitize path)."""
    if rule_id != "WIP-1":
        return None
    if location.get("highlightable") is False or location.get("documentStructuralFinding") is True:
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if not _wip_tag_matches_locked_cta_shape(tag):
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


def _nc_try_lock_unique_selector_nav(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """NC-1: unique selector resolves to exactly one <nav> — lock identity (skip fuzzy sanitize path)."""
    if rule_id != "NC-1":
        return None
    if location.get("highlightable") is False or location.get("documentStructuralFinding") is True:
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if (tag.name or "").lower() != "nav":
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


SC_TEXT_BLOCK_TAG_NAMES = frozenset({"p", "li", "td", "th"})

# Must match dense_text_detection.TEXT_BLOCK_SELECTOR (p, li, td, th).
DT_TEXT_BLOCK_TAG_NAMES = frozenset({"p", "li", "td", "th"})

# Must match analysis_selectors.language_complexity.LANGUAGE_SELECTOR (p, li, td, th, label, button, a).
LC_TEXT_BLOCK_TAG_NAMES = frozenset({"p", "li", "td", "th", "label", "button", "a"})


def _sc_try_lock_unique_selector_text_block(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """SC-1: unique selector resolves to exactly one p/li/td/th — lock identity (skip fuzzy sanitize path)."""
    if rule_id != "SC-1":
        return None
    if location.get("highlightable") is False or location.get("documentStructuralFinding") is True:
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if (tag.name or "").lower() not in SC_TEXT_BLOCK_TAG_NAMES:
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


def _lc_try_lock_unique_selector_text_block(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """LC-1: unique selector resolves to exactly one allowed text/interaction block — lock identity."""
    if rule_id != "LC-1":
        return None
    if location.get("highlightable") is False or location.get("documentStructuralFinding") is True:
        return None
    raw_selector = str(location.get("selector") or "").strip()
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if (tag.name or "").lower() not in LC_TEXT_BLOCK_TAG_NAMES:
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


def _dt_incoming_selector_for_lock(location: dict[str, Any]) -> str:
    """DT-1: prefer explicit selector; else stable #id from attrs (detector may omit selector)."""
    raw = str(location.get("selector") or "").strip()
    if raw:
        return raw
    attrs = location.get("attrs") if isinstance(location.get("attrs"), dict) else {}
    if attrs.get("id"):
        return f"#{css_identifier_escape(str(attrs['id']))}"
    return ""


def _dt_try_lock_unique_selector_text_block(
    soup: BeautifulSoup,
    location: dict[str, Any],
    dimension_name: str,
    rule_id: str,
) -> Tag | None:
    """DT-1: unique selector resolves to exactly one p/li/td/th — lock identity (no fuzzy path)."""
    if rule_id != "DT-1":
        return None
    if location.get("highlightable") is False or location.get("documentStructuralFinding") is True:
        return None
    raw_selector = _dt_incoming_selector_for_lock(location)
    if not raw_selector:
        return None
    sel_tags = select_safely(soup, raw_selector)
    if len(sel_tags) != 1:
        return None
    tag = sel_tags[0]
    if (tag.name or "").lower() not in DT_TEXT_BLOCK_TAG_NAMES:
        return None
    if not is_candidate_highlightable(tag, dimension_name, rule_id):
        return None
    return tag


def find_by_attrs(soup: BeautifulSoup, tag_name: str, attrs: dict[str, Any]) -> list[Tag]:
    if attrs.get("id"):
        found = soup.find(id=str(attrs["id"]))
        return [found] if isinstance(found, Tag) else []

    selectors: list[str] = []
    if attrs.get("href") and tag_name == "a":
        selectors.append(f'a[href="{css_attr_escape(str(attrs["href"]))}"]')
    if attrs.get("aria-label"):
        selector_tag = tag_name if tag_name else "*"
        selectors.append(f'{selector_tag}[aria-label="{css_attr_escape(str(attrs["aria-label"]))}"]')
    if attrs.get("alt") and tag_name == "img":
        selectors.append(f'img[alt="{css_attr_escape(str(attrs["alt"]))}"]')

    candidates: list[Tag] = []
    for selector in selectors:
        candidates.extend(select_safely(soup, selector))

    classes = str(attrs.get("class") or "").split()
    if classes:
        tag_filter = tag_name if tag_name else True
        for class_name in classes[:2]:
            candidates.extend(
                tag for tag in soup.find_all(tag_filter, class_=class_name) if isinstance(tag, Tag)
            )
    return dedupe_tags(candidates)


def block_by_index(soup: BeautifulSoup, block_index: int) -> Tag | None:
    if block_index <= 0:
        return None
    blocks = [
        tag for tag in soup.select("p, li, td, th, caption, figcaption")
        if isinstance(tag, Tag) and text_preview(tag)
    ]
    return blocks[block_index - 1] if block_index <= len(blocks) else None


def find_by_text(
    soup: BeautifulSoup,
    tag_name: str,
    text: str,
    dimension_name: str,
    rule_id: str,
) -> list[Tag]:
    normalized = normalize_text(text).lower()
    if not normalized:
        return []
    tags = allowed_tags_for_dimension(dimension_name, rule_id)
    if tag_name and tag_name not in BAD_TARGET_TAGS:
        tags = {tag_name} | tags
    matches: list[Tag] = []
    for tag in soup.find_all(list(tags)):
        if not isinstance(tag, Tag):
            continue
        candidate = normalize_text(tag.get_text(" ", strip=True)).lower()
        if not candidate:
            continue
        if candidate in normalized or text_matches_without_short_false_positive(candidate, normalized):
            matches.append(tag)
    return matches


def text_matches_without_short_false_positive(candidate: str, target: str) -> bool:
    if target in candidate:
        return True
    if len(candidate) < 24:
        return False
    if candidate in target:
        return True
    candidate_words = set(candidate.split())
    target_words = set(target.split())
    if not candidate_words or not target_words:
        return False
    overlap = len(candidate_words & target_words) / max(1, min(len(candidate_words), len(target_words)))
    return overlap >= 0.7


def is_candidate_highlightable(tag: Tag, dimension_name: str, rule_id: str) -> bool:
    tag_name = normalized_tag(tag.name)
    if rule_id == "PHS-1" and tag_name in {"main", "article", "body"}:
        return False
    if tag_name in BAD_TARGET_TAGS:
        return False
    if is_hidden_static(tag):
        return False
    if tag_name == "input" and (tag.get("type") or "").lower() == "hidden":
        return False
    if tag_name == "svg":
        return bool(tag.get("aria-label") or tag.get("role") == "img")
    if dimension_name in {
        "Dense Text Detection",
        "Language Complexity",
        "Sentence Complexity",
        "Long Content Without Chunking",
        "Poor Heading Structure",
        "Navigation Complexity",
        "Weak Information Prominence",
        "Visual Overload",
        "Auto-Moving Content",
        "Excessive Interruptions",
    }:
        return (
            tag_name in (READABILITY_TAGS | INTERACTION_TAGS | MEDIA_TAGS | STRUCTURAL_TAGS)
            or looks_like_visual_component(tag)
        )
    if rule_id == "VO-1":
        return tag_name in FOCAL_POINT_TAGS or looks_like_visual_component(tag)
    if tag_name in STRUCTURAL_TAGS:
        return first_highlightable_child(tag, dimension_name, rule_id) is None or looks_like_visual_component(tag)
    return True


def first_highlightable_child(tag: Tag, dimension_name: str, rule_id: str) -> Tag | None:
    for child in tag.find_all(["a", "button", "input", "img", "h1", "h2", "h3", "p", "li", "td", "th", "video", "audio"]):
        if isinstance(child, Tag) and is_candidate_highlightable(child, dimension_name, rule_id):
            return child
    return None


def build_location_payload(tag: Tag, original: dict[str, Any], selector: str, rule_id: str | None = None) -> dict[str, Any]:
    if rule_id == "NC-1" and (tag.name or "").lower() == "nav":
        label = "Navigation Region"
        n_links = original.get("nav_link_count")
        n_depth = original.get("nesting_depth")
        preview_parts: list[str] = []
        if isinstance(n_links, int):
            preview_parts.append(f"{n_links} navigation links")
        if isinstance(n_depth, int):
            preview_parts.append(f"nesting depth {n_depth}")
        preview = (" · ".join(preview_parts) if preview_parts else "Navigation region")[:160]
    else:
        label = accessible_label(tag) or text_preview(tag) or human_tag_label(tag)
        preview = text_preview(tag)[:160]
    payload: dict[str, Any] = {
        "tag": tag.name or "unknown",
        "selector": selector,
        "summary": get_tag_summary(tag),
        "label": label[:90],
        "preview": preview,
        "highlightable": True,
    }
    if tag.get("data-cognilens-id"):
        payload["cognilensId"] = str(tag.get("data-cognilens-id"))
    bounding_box = original.get("boundingBox") or original.get("rect") or parse_rendered_rect(tag)
    if isinstance(bounding_box, dict):
        payload["boundingBox"] = bounding_box
    for key in (
        "average_sentence_length",
        "sentence_count",
        "complex_word_ratio",
        "complex_word_count",
        "instruction_hint_count",
        "qualifier_count",
        "interrupt_type",
        "animated_count",
        "region",
        "violationType",
        "headingLevel",
        "previousHeadingLevel",
        "currentHeadingLevel",
        "text",
        "attrs",
        "contributorCategory",
        "nav_link_count",
        "nesting_depth",
        "sentence_preview",
        "sentence_word_count",
        "comma_count",
        "conjunction_count",
        "word_count",
        "sample_words",
    ):
        if key in original:
            payload[key] = original[key]
    if rule_id == "NC-1":
        payload["rule_id"] = "NC-1"
        payload.pop("text", None)
    elif rule_id == "SC-1":
        payload["rule_id"] = "SC-1"
        _finalize_sc_location_sentence_fields(payload, original)
        _debug_warn_sc_metrics_if_incomplete(payload, original, rule_id)
    elif rule_id == "LC-1":
        payload["rule_id"] = "LC-1"
    elif rule_id == "DT-1":
        payload["rule_id"] = "DT-1"
    return payload


def stable_selector(tag: Tag) -> str:
    cognilens_id = tag.get("data-cognilens-id")
    if cognilens_id:
        return f'[data-cognilens-id="{css_attr_escape(str(cognilens_id))}"]'

    if tag.get("id"):
        return f"#{css_identifier_escape(str(tag['id']))}"

    attr_selector = attribute_selector(tag)
    if attr_selector and len(select_in_root(tag, attr_selector)) == 1:
        return attr_selector

    class_selector = class_selector_for(tag)
    if class_selector and len(select_in_root(tag, class_selector)) == 1:
        return class_selector

    path = nth_of_type_path(tag)
    if path and not is_too_generic_selector(path):
        return path

    structural_root = (tag.name or "").lower()
    if structural_root in {"main", "article", "body"}:
        return structural_root

    return ""


def attribute_selector(tag: Tag) -> str:
    tag_name = tag.name or ""
    if tag.name == "a" and tag.get("href"):
        return f'a[href="{css_attr_escape(str(tag["href"]))}"]'
    if tag.get("aria-label"):
        return f'{tag_name}[aria-label="{css_attr_escape(str(tag["aria-label"]))}"]'
    if tag.get("title"):
        return f'{tag_name}[title="{css_attr_escape(str(tag["title"]))}"]'
    if tag.name == "img" and tag.get("alt"):
        return f'img[alt="{css_attr_escape(str(tag["alt"]))}"]'
    if tag.name == "input" and tag.get("name"):
        return f'input[name="{css_attr_escape(str(tag["name"]))}"]'
    return ""


def class_selector_for(tag: Tag) -> str:
    classes = [str(item) for item in tag.get("class", []) if str(item).strip()]
    if not classes:
        return ""
    tag_name = tag.name or ""
    return tag_name + "".join(f".{css_identifier_escape(class_name)}" for class_name in classes[:2])


def nth_of_type_path(tag: Tag) -> str:
    parts: list[str] = []
    current: Tag | None = tag
    while isinstance(current, Tag) and current.name not in {"[document]", "html"}:
        name = current.name or ""
        if name in BAD_TARGET_TAGS:
            break
        if current.get("id"):
            parts.append(f"{name}#{css_identifier_escape(str(current['id']))}")
            break
        siblings = (
            [
                sibling
                for sibling in current.parent.find_all(name, recursive=False)
                if isinstance(sibling, Tag)
            ]
            if isinstance(current.parent, Tag)
            else []
        )
        # BeautifulSoup Tag __eq__ compares structure; identical sibling nodes compare equal,
        # so list.index(tag) would return the first match. DOM nth-of-type must use identity.
        index = 1
        for i, sib in enumerate(siblings):
            if sib is current:
                index = i + 1
                break
        parts.append(f"{name}:nth-of-type({index})")
        if name in {"main", "header", "nav"} or len(parts) >= 5:
            break
        current = current.parent if isinstance(current.parent, Tag) else None
    return " > ".join(reversed(parts))


def select_in_root(tag: Tag, selector: str) -> list[Tag]:
    root = tag
    while isinstance(root.parent, Tag):
        root = root.parent
    try:
        return [match for match in root.select(selector) if isinstance(match, Tag)]
    except Exception:
        return []


def allowed_tags_for_dimension(dimension_name: str, rule_id: str) -> set[str]:
    if rule_id == "LC-1":
        return set(LC_TEXT_BLOCK_TAG_NAMES)
    if rule_id == "DT-1":
        return set(DT_TEXT_BLOCK_TAG_NAMES)
    if dimension_name in {"Dense Text Detection", "Language Complexity", "Sentence Complexity"}:
        return READABILITY_TAGS | {"a", "button"}
    if dimension_name in {"Auto-Moving Content", "Excessive Interruptions"}:
        return INTERACTION_TAGS | MEDIA_TAGS | {"marquee"}
    if dimension_name in {"Poor Heading Structure", "Navigation Complexity", "Weak Information Prominence"}:
        return READABILITY_TAGS | INTERACTION_TAGS | {"nav"}
    if rule_id == "VO-1":
        return FOCAL_POINT_TAGS
    return FOCAL_POINT_TAGS | {"p", "li", "td", "th", "article", "section"}


def is_usable_summary_selector(value: str) -> bool:
    return bool(value and SUMMARY_SELECTOR_PATTERN.match(value) and not is_too_generic_selector(value))


def is_too_generic_selector(selector: str) -> bool:
    normalized = selector.strip().lower()
    if normalized in {"main", "article", "body"}:
        return False
    return normalized in GENERIC_SELECTOR_TAGS or normalized in BAD_TARGET_TAGS


def is_hidden_static(tag: Tag) -> bool:
    current: Tag | None = tag
    while isinstance(current, Tag):
        if current.has_attr("hidden") or (current.get("aria-hidden") or "").lower() == "true":
            return True
        style = str(current.get("style") or "").lower().replace(" ", "")
        if any(fragment in style for fragment in ("display:none", "visibility:hidden", "opacity:0")):
            return True
        current = current.parent if isinstance(current.parent, Tag) else None
    return False


def structural_penalty(tag: Tag, dimension_name: str, rule_id: str) -> int:
    tag_name = normalized_tag(tag.name)
    if tag_name in {"a", "button", "input", "img", "h1", "h2", "h3", "p", "li", "td", "th", "video", "audio"}:
        return 0
    if tag_name in STRUCTURAL_TAGS:
        return 2
    return 1


def looks_like_visual_component(tag: Tag) -> bool:
    attrs_blob = " ".join([tag.get("id", ""), " ".join(tag.get("class", [])), tag.get("role", "")]).lower()
    return any(keyword in attrs_blob for keyword in ("logo", "hero", "card", "tile", "button", "cta", "banner", "modal", "popup", "overlay", "nav"))


def document_order_index(tag: Tag) -> int:
    root = tag
    while isinstance(root.parent, Tag):
        root = root.parent
    for index, candidate in enumerate(root.find_all(True)):
        if candidate is tag:
            return index
    return 999999


def accessible_label(tag: Tag) -> str:
    for attr in ("aria-label", "title", "alt", "value", "placeholder"):
        value = tag.get(attr)
        if isinstance(value, str) and normalize_text(value):
            return normalize_text(value)
    return normalize_text(tag.get_text(" ", strip=True))


def text_preview(tag: Tag) -> str:
    return normalize_text(tag.get_text(" ", strip=True))


def human_tag_label(tag: Tag) -> str:
    return {
        "a": "Link",
        "button": "Button",
        "img": "Image",
        "h1": "Main heading",
        "h2": "Section heading",
        "h3": "Subsection heading",
        "video": "Video",
        "audio": "Audio",
        "iframe": "Embedded frame",
    }.get(tag.name or "", (tag.name or "Element").title())


def parse_rendered_rect(tag: Tag) -> dict[str, float] | None:
    raw = str(tag.get("data-rendered-rect") or "").strip()
    if not raw:
        return None
    rect: dict[str, float] = {}
    for part in raw.split(","):
        key, _, value = part.partition(":")
        key = key.strip()
        if key not in {"x", "y", "width", "height"}:
            continue
        try:
            rect[key] = float(value)
        except ValueError:
            return None
    return rect if {"x", "y", "width", "height"}.issubset(rect) else None


def get_tag_summary(tag: Tag) -> str:
    tag_name = tag.name or "unknown"
    element_id = f"#{tag.get('id')}" if tag.get("id") else ""
    classes = "." + ".".join(tag.get("class", [])) if tag.get("class") else ""
    return f"{tag_name}{element_id}{classes}"


def dedupe_tags(tags: list[Tag]) -> list[Tag]:
    seen: set[int] = set()
    result: list[Tag] = []
    for tag in tags:
        marker = id(tag)
        if marker not in seen:
            seen.add(marker)
            result.append(tag)
    return result


def normalized_tag(value: Any) -> str:
    return str(value or "").lower()


def normalize_text(text: str) -> str:
    return " ".join(str(text or "").split())


def css_identifier_escape(value: str) -> str:
    return re.sub(r"([^A-Za-z0-9_-])", r"\\\1", value)


def css_attr_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')
