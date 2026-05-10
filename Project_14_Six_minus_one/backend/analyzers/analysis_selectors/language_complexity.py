from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from .shared import REGULAR_BASE_PENALTY, make_issue, tag_location, visible_text
from .text_utils import COMPLEX_WORD_RATIO_THRESHOLD, is_complex_word, tokenize_alpha_words

LANGUAGE_SELECTOR = "p, li, td, th, label, button, a"


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
        if ratio > 0.15:
            complex_regions.append(
                tag_location(
                    tag,
                    word_count=len(words),
                    complex_word_count=len(complex_words),
                    complex_word_ratio=round(ratio, 2),
                    sample_words=complex_words[:6],
                )
            )
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
        locations=complex_regions[:8],
    )
