from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from .shared import REGULAR_BASE_PENALTY, make_issue, tag_location, visible_text
from .text_utils import split_sentences, tokenize_alpha_words

SENTENCE_WORD_THRESHOLD = 25
SENTENCE_COMMA_THRESHOLD = 3
SENTENCE_CONJUNCTION_THRESHOLD = 3
TEXT_BLOCK_SELECTOR = "p, li, td, th"
CONJUNCTION_PATTERN = re.compile(r"\b(and|but|or|because|although|while|whereas|since|unless|however|therefore)\b", re.I)


def detect_sentence_complexity_selector(context: dict[str, Any]):
    return detect_sentence_complexity(context["soup"])


def detect_sentence_complexity(soup: BeautifulSoup):
    complex_blocks: list[dict[str, Any]] = []
    for tag in soup.select(TEXT_BLOCK_SELECTOR):
        for sentence in split_sentences(visible_text(tag)):
            word_count = len(tokenize_alpha_words(sentence))
            comma_count = sentence.count(",")
            conjunction_count = len(CONJUNCTION_PATTERN.findall(sentence))
            if (
                word_count > SENTENCE_WORD_THRESHOLD
                or comma_count > SENTENCE_COMMA_THRESHOLD
                or conjunction_count > SENTENCE_CONJUNCTION_THRESHOLD
            ):
                complex_blocks.append(
                    tag_location(
                        tag,
                        sentence_preview=sentence[:180],
                        sentence_word_count=word_count,
                        comma_count=comma_count,
                        conjunction_count=conjunction_count,
                    )
                )
                break
    if not complex_blocks:
        return None
    return make_issue(
        rule_id="SC-1",
        title="Sentence Complexity",
        base_penalty=REGULAR_BASE_PENALTY,
        description="Long and heavily connected sentences increase comprehension burden.",
        suggestion="Split long sentences and reduce nested clauses so each sentence carries one main idea.",
        evidence={
            "complex_sentence_block_count": len(complex_blocks),
            "threshold": {
                "maxSentenceWords": SENTENCE_WORD_THRESHOLD,
                "maxCommas": SENTENCE_COMMA_THRESHOLD,
                "maxConjunctions": SENTENCE_CONJUNCTION_THRESHOLD,
            },
        },
        locations=complex_blocks[:8],
    )
