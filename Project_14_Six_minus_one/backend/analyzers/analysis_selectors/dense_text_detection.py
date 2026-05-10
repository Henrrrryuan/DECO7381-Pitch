from __future__ import annotations

import os
import json
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
        raw_text = tag.get_text(" ", strip=True)
        text = visible_text(tag)
        words = tokenize_alpha_words(text)
        sentences = split_sentences(text)
        word_count = len(words)
        sentence_count = len(sentences)
        passes_words = word_count > DENSE_TEXT_WORD_THRESHOLD
        passes_sentences = sentence_count > DENSE_TEXT_SENTENCE_THRESHOLD
        triggered = passes_words or passes_sentences
        if forensic:
            attrs = tag.attrs if hasattr(tag, "attrs") else {}
            case_id = attrs.get("data-case-id") if isinstance(attrs, dict) else None
            rejection_reason = ""
            if not triggered:
                rejection_reason = f"words<={DENSE_TEXT_WORD_THRESHOLD} and sentences<={DENSE_TEXT_SENTENCE_THRESHOLD}"
            payload = {
                "tag": (tag.name or ""),
                "id": (tag.get("id") if hasattr(tag, "get") else None),
                "case": case_id,
                "raw_text_length": len(raw_text or ""),
                "normalized_word_count": word_count,
                "normalized_sentence_count": sentence_count,
                "threshold_operator": ">",
                "threshold_value": {"words": DENSE_TEXT_WORD_THRESHOLD, "sentences": DENSE_TEXT_SENTENCE_THRESHOLD},
                "passes_threshold": bool(triggered),
                "passes_words": bool(passes_words),
                "passes_sentences": bool(passes_sentences),
                "rejection_reason": rejection_reason,
                "preview": " ".join(str(text or "").split())[:80],
                "in_article": bool(tag.find_parent("article")) if hasattr(tag, "find_parent") else False,
            }
            print("[DT-1 candidate]")
            print(json.dumps(payload, ensure_ascii=False))
        if triggered:
            dense_blocks.append(tag_location(tag, word_count=word_count, sentence_count=sentence_count))
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
