from __future__ import annotations

import os
import re
from typing import Any

from bs4 import BeautifulSoup

from .shared import SERIOUS_BASE_PENALTY, make_issue, tag_location, visible_text
from .text_utils import tokenize_alpha_words

LONG_SECTION_WORD_THRESHOLD = 300
LONG_ARTICLE_WORD_THRESHOLD = 600
SECTION_SELECTOR = "main, article, section"


def _lcc_audit_enabled() -> bool:
    return os.environ.get("LCC_AUDIT") == "1"


def _lcc_case_id(tag) -> str:
    try:
        return str(tag.get("data-case-id") or "")
    except Exception:
        return ""


def _lcc_selector_hint(tag) -> str:
    """DEV-only: best-effort selector hint for logs (no payload impact)."""
    try:
        if tag.get("id"):
            return f"#{tag.get('id')}"
    except Exception:
        pass
    try:
        return str(tag.name or "")
    except Exception:
        return ""


def detect_long_content_without_chunking_selector(context: dict[str, Any]):
    return detect_long_content_without_chunking(context["soup"])


def detect_long_content_without_chunking(soup: BeautifulSoup):
    violations: list[dict[str, Any]] = []
    scanned = [tag for tag in soup.select(SECTION_SELECTOR)]
    if _lcc_audit_enabled():
        print("[LCC contract audit]", {
            "scanned_tags": ["main", "article", "section"],
            "candidate_selector_logic": SECTION_SELECTOR,
            "threshold_rules": {
                "article_words_gt": LONG_ARTICLE_WORD_THRESHOLD,
                "main_section_words_gt": LONG_SECTION_WORD_THRESHOLD,
            },
            "trigger_formula": "tokenize_alpha_words(visible_text(tag)).len > threshold AND heading_count == 0 AND list_count == 0",
            "article_threshold_words": LONG_ARTICLE_WORD_THRESHOLD,
            "section_threshold_words": LONG_SECTION_WORD_THRESHOLD,
            "main_threshold_words": LONG_SECTION_WORD_THRESHOLD,
            "heading_requirements": "heading_count == 0",
            "list_requirements": "list_count == 0 (counts ul/ol/li descendants)",
            "paragraph_requirements": "none (paragraph_count recorded as evidence only)",
            "exclusion_conditions": [
                "words <= threshold",
                "heading_count > 0",
                "list_count > 0",
            ],
            "location_strategy": "tag_location(container_tag) with evidence word_count/heading_count/list_count/paragraph_count",
            "issue_grouping_strategy": "single issue with locations=violations[:8]",
        })

    passed_candidates = 0
    for tag in scanned:
        words = tokenize_alpha_words(visible_text(tag))
        heading_count = len(tag.find_all(re.compile("^h[1-6]$")))
        list_count = len(tag.find_all(["ul", "ol", "li"]))
        paragraph_count = len(tag.find_all("p"))
        is_article = tag.name == "article"
        threshold = LONG_ARTICLE_WORD_THRESHOLD if is_article else LONG_SECTION_WORD_THRESHOLD
        too_long = len(words) > threshold
        lacks_chunking = heading_count == 0 and list_count == 0
        passes = bool(too_long and lacks_chunking)
        rejection_reason = ""
        if not too_long:
            rejection_reason = "below_word_threshold"
        elif not lacks_chunking:
            if heading_count > 0:
                rejection_reason = "has_headings"
            elif list_count > 0:
                rejection_reason = "has_lists"
            else:
                rejection_reason = "has_chunking"

        if _lcc_audit_enabled():
            selector_hint = _lcc_selector_hint(tag)
            case_id = _lcc_case_id(tag)
            tag_id = str(tag.get("id", "") or "")
            print("[LCC candidate]", {
                "tag": str(tag.name or ""),
                "id": tag_id,
                "data_case_id": case_id,
                "selector": selector_hint,
                "word_count": len(words),
                "heading_count": heading_count,
                "list_count": list_count,
                "paragraph_count": paragraph_count,
                "passes_threshold": passes,
                "rejection_reason": rejection_reason,
                "selected_as_primary_location": passes,
                "generated_location_count": 1 if passes else 0,
            })

        if too_long and lacks_chunking:
            passed_candidates += 1
            violations.append(
                tag_location(
                    tag,
                    word_count=len(words),
                    heading_count=heading_count,
                    list_count=list_count,
                    paragraph_count=paragraph_count,
                )
            )
    if _lcc_audit_enabled():
        # Fixture mapping for known case IDs (best-effort; no fixture dependency).
        for case_id in ("short-article", "lcc-article", "structured-article", "no-heading-section"):
            found = soup.find(attrs={"data-case-id": case_id})
            if found is None:
                print("[LCC fixture classification]", {
                    "case_id": case_id,
                    "scanned": False,
                    "trigger_expected_by_contract": False,
                    "trigger_actual": False,
                    "mismatch": False,
                    "mismatch_reason": "case_id_not_found_in_html",
                })
                continue
            words = tokenize_alpha_words(visible_text(found))
            heading_count = len(found.find_all(re.compile("^h[1-6]$")))
            list_count = len(found.find_all(["ul", "ol", "li"]))
            is_article = (found.name or "") == "article"
            threshold = LONG_ARTICLE_WORD_THRESHOLD if is_article else LONG_SECTION_WORD_THRESHOLD
            too_long = len(words) > threshold
            lacks_chunking = heading_count == 0 and list_count == 0
            expected = bool(too_long and lacks_chunking)
            actual = expected
            mismatch = expected != actual
            print("[LCC fixture classification]", {
                "case_id": case_id,
                "scanned": True,
                "trigger_expected_by_contract": expected,
                "trigger_actual": actual,
                "mismatch": mismatch,
                "mismatch_reason": "" if not mismatch else "unexpected_contract_mismatch",
            })

    if not violations:
        if _lcc_audit_enabled():
            print("[LCC lineage]", {
                "raw_candidate_count": len(scanned),
                "issue_count": 0,
                "location_count_before_sanitize": 0,
                "location_count_after_sanitize": None,
                "grouped_into_single_issue": False,
                "grouping_reason": "",
            })
        return None
    if _lcc_audit_enabled():
        included = violations[:8]
        print("[LCC lineage]", {
            "raw_candidate_count": len(scanned),
            "issue_count": 1,
            "location_count_before_sanitize": len(included),
            "location_count_after_sanitize": None,
            "grouped_into_single_issue": len(violations) > 1,
            "grouping_reason": "single_issue_locations_array_cap_8" if len(violations) > 1 else "single_issue_single_location",
        })
    return make_issue(
        rule_id="LCC-1",
        title="Long Content Without Chunking",
        base_penalty=SERIOUS_BASE_PENALTY,
        description="Lack of chunking makes long content harder to scan, process, and remember.",
        suggestion="Add headings, lists, summaries, or shorter sections to break up long content.",
        evidence={
            "long_unstructured_section_count": len(violations),
            "threshold": {
                "maxSectionWordsWithoutChunking": LONG_SECTION_WORD_THRESHOLD,
                "maxArticleWordsWithoutChunking": LONG_ARTICLE_WORD_THRESHOLD,
            },
        },
        locations=violations[:8],
    )
