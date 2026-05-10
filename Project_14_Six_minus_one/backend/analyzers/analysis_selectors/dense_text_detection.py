from __future__ import annotations

import os
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
    forensic = os.environ.get("DT1_FORENSIC") == "1"
    for tag in soup.select(TEXT_BLOCK_SELECTOR):
        text = visible_text(tag)
        words = tokenize_alpha_words(text)
        sentences = split_sentences(text)
        triggered = len(words) > DENSE_TEXT_WORD_THRESHOLD or len(sentences) > DENSE_TEXT_SENTENCE_THRESHOLD
        if forensic:
            preview = " ".join(str(text or "").split())[:80]
            attrs = tag.attrs if hasattr(tag, "attrs") else {}
            case_id = attrs.get("data-case-id") if isinstance(attrs, dict) else None
            print("[DT-1 detector]")
            print(f"tag={(tag.name or '')}")
            print(f"id={tag.get('id') if hasattr(tag, 'get') else None}")
            print(f"case={case_id}")
            print(f"words={len(words)}")
            print(f"sentences={len(sentences)}")
            print(f"trigger={str(bool(triggered)).lower()}")
            print(f"preview={preview}")
        if triggered:
            dense_blocks.append(tag_location(tag, word_count=len(words), sentence_count=len(sentences)))
    if forensic:
        print("[DT-1 final]")
        print(f"dense_blocks={len(dense_blocks)}")
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
