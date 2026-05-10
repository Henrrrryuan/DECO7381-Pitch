from __future__ import annotations

import os
from typing import Any

from bs4 import BeautifulSoup

from ..location_utils import get_tag_summary, stable_selector
from .shared import REGULAR_BASE_PENALTY, make_issue, tag_location, visible_text
from .text_utils import COMPLEX_WORD_RATIO_THRESHOLD, is_complex_word, tokenize_alpha_words

LANGUAGE_SELECTOR = "p, li, td, th, label, button, a"

LC1_MAX_LOCATIONS = 8  # system-standard issue row cap (aligned with _max_sanitized_locations default)


def _lc1_forensic() -> bool:
    return os.environ.get("LC1_FORENSIC") == "1"


def detect_language_complexity_selector(context: dict[str, Any]):
    return detect_language_complexity(context["soup"])


def detect_language_complexity(soup: BeautifulSoup):
    complex_regions: list[dict[str, Any]] = []
    for tag in soup.select(LANGUAGE_SELECTOR):
        words = tokenize_alpha_words(visible_text(tag))
        if len(words) < 8:
            continue
        complex_words = [word for word in words if is_complex_word(word)]
        ratio = len(complex_words) / len(words)
        if _lc1_forensic():
            print(
                "[LC-1 detector]",
                tag.name,
                tag.get("id"),
                tag.get("data-case-id"),
                len(words),
                len(complex_words),
                round(ratio, 2),
            )
        if ratio > COMPLEX_WORD_RATIO_THRESHOLD:
            if _lc1_forensic():
                print(
                    "[LC-1 TRIGGER]",
                    tag.name,
                    tag.get("id"),
                    tag.get("data-case-id"),
                    stable_selector(tag),
                )
            loc = tag_location(
                tag,
                word_count=len(words),
                complex_word_count=len(complex_words),
                complex_word_ratio=round(ratio, 2),
                sample_words=complex_words[:6],
            )
            loc["selector"] = stable_selector(tag)
            loc["summary"] = get_tag_summary(tag)
            complex_regions.append(loc)
    if not complex_regions:
        return None
    return make_issue(
        rule_id="LC-1",
        title="Language Complexity",
        base_penalty=REGULAR_BASE_PENALTY,
        description="Complex vocabulary reduces comprehension speed and increases cognitive effort.",
        suggestion="Replace uncommon or jargon-heavy wording with clear, familiar language.",
        evidence={
            "complex_region_count": len(complex_regions),
            "highest_complex_word_ratio": max(item["complex_word_ratio"] for item in complex_regions),
            "threshold": {"maxComplexWordRatio": COMPLEX_WORD_RATIO_THRESHOLD},
        },
        locations=complex_regions[:LC1_MAX_LOCATIONS],
    )
