from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup

from .shared import REGULAR_BASE_PENALTY, make_issue, tag_location, visible_text
from .text_utils import split_sentences, tokenize_alpha_words

DENSE_TEXT_WORD_THRESHOLD = 120
DENSE_TEXT_SENTENCE_THRESHOLD = 4
TEXT_BLOCK_SELECTOR = "p, li, td, th"


def detect_dense_text_selector(context: dict[str, Any]):
    return detect_dense_text(context["soup"])


def detect_dense_text(soup: BeautifulSoup):
    dense_blocks: list[dict[str, Any]] = []
    for tag in soup.select(TEXT_BLOCK_SELECTOR):
        text = visible_text(tag)
        words = tokenize_alpha_words(text)
        sentences = split_sentences(text)
        if len(words) > DENSE_TEXT_WORD_THRESHOLD or len(sentences) > DENSE_TEXT_SENTENCE_THRESHOLD:
            dense_blocks.append(tag_location(tag, word_count=len(words), sentence_count=len(sentences)))
    if not dense_blocks:
        return None
    return make_issue(
        rule_id="DT-1",
        title="Dense Text Detection",
        base_penalty=REGULAR_BASE_PENALTY,
        description="Dense uninterrupted text increases reading effort and working memory load.",
        suggestion="Break dense paragraphs into shorter blocks with clear visual or text breaks.",
        evidence={
            "dense_block_count": len(dense_blocks),
            "max_word_count": max(item["word_count"] for item in dense_blocks),
            "max_sentence_count": max(item["sentence_count"] for item in dense_blocks),
            "threshold": {"maxWords": DENSE_TEXT_WORD_THRESHOLD, "maxSentences": DENSE_TEXT_SENTENCE_THRESHOLD},
        },
        locations=dense_blocks[:8],
    )
