from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from .shared import SERIOUS_BASE_PENALTY, make_issue, tag_location, visible_text
from .text_utils import tokenize_alpha_words

LONG_SECTION_WORD_THRESHOLD = 300
LONG_ARTICLE_WORD_THRESHOLD = 600
SECTION_SELECTOR = "main, article, section"


def detect_long_content_without_chunking_selector(context: dict[str, Any]):
    return detect_long_content_without_chunking(context["soup"])


def detect_long_content_without_chunking(soup: BeautifulSoup):
    violations: list[dict[str, Any]] = []
    for tag in soup.select(SECTION_SELECTOR):
        words = tokenize_alpha_words(visible_text(tag))
        heading_count = len(tag.find_all(re.compile("^h[1-6]$")))
        list_count = len(tag.find_all(["ul", "ol", "li"]))
        paragraph_count = len(tag.find_all("p"))
        is_article = tag.name == "article"
        too_long = len(words) > (LONG_ARTICLE_WORD_THRESHOLD if is_article else LONG_SECTION_WORD_THRESHOLD)
        lacks_chunking = heading_count == 0 and list_count == 0
        if too_long and lacks_chunking:
            violations.append(
                tag_location(
                    tag,
                    word_count=len(words),
                    heading_count=heading_count,
                    list_count=list_count,
                    paragraph_count=paragraph_count,
                )
            )
    if not violations:
        return None
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
