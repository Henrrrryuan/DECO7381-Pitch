from __future__ import annotations

import re
from html.parser import HTMLParser
from math import ceil
from typing import Any

from ..schemas import DimensionResult, Issue, Severity
from ..scoring import calculate_dimension_score, calculate_penalty

AVERAGE_SENTENCE_THRESHOLD = 20
PARAGRAPH_SENTENCE_THRESHOLD = 4
REGULAR_BASE_PENALTY = 3

VAGUE_CONTROL_TEXTS = {
    "next",
    "click here",
    "read more",
    "learn more",
    "more",
    "submit",
}

LATIN_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")
CJK_CHAR_PATTERN = re.compile(r"[\u4e00-\u9fff]")
SENTENCE_SPLIT_PATTERN = re.compile(r"[.!?。！？]+")
WHITESPACE_PATTERN = re.compile(r"\s+")


class ReadabilityHTMLExtractor(HTMLParser):
    """Extracts visible text, paragraph text, and control labels from HTML.

    This MVP parser only supports HTML strings or snippets. It intentionally
    ignores PDFs, images, and live URL fetching.
    """

    ignored_tags = {"script", "style", "noscript"}
    text_block_tags = {"p", "li", "blockquote", "dd", "dt"}
    control_tags = {"a", "button"}

    def __init__(self) -> None:
        super().__init__()
        self._ignored_depth = 0
        self._text_block_stack: list[dict[str, Any]] = []
        self._control_stack: list[dict[str, Any]] = []
        self.all_text_parts: list[str] = []
        self.text_blocks: list[dict[str, Any]] = []
        self.controls: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized_tag = tag.lower()
        attributes = {key.lower(): value or "" for key, value in attrs}

        if normalized_tag in self.ignored_tags:
            self._ignored_depth += 1
            return

        if self._ignored_depth:
            return

        if normalized_tag in self.text_block_tags:
            self._text_block_stack.append(
                {
                    "tag": normalized_tag,
                    "buffer": [],
                }
            )

        if normalized_tag in self.control_tags:
            self._control_stack.append(
                {
                    "tag": normalized_tag,
                    "attrs": attributes,
                    "buffer": [],
                }
            )

        if normalized_tag == "input":
            input_type = attributes.get("type", "").lower()
            if input_type in {"button", "submit", "reset"}:
                label = normalize_text(attributes.get("value", ""))
                if label:
                    self.controls.append(
                        {
                            "tag": normalized_tag,
                            "text": label,
                            "attrs": attributes,
                        }
                    )

    def handle_endtag(self, tag: str) -> None:
        normalized_tag = tag.lower()

        if normalized_tag in self.ignored_tags:
            if self._ignored_depth > 0:
                self._ignored_depth -= 1
            return

        if self._ignored_depth:
            return

        if normalized_tag in self.text_block_tags and self._text_block_stack:
            text_block = self._text_block_stack.pop()
            text = normalize_text(" ".join(text_block["buffer"]))
            if text:
                self.text_blocks.append(
                    {
                        "tag": text_block["tag"],
                        "text": text,
                    }
                )

        if normalized_tag in self.control_tags and self._control_stack:
            control = self._control_stack.pop()
            text = normalize_text(" ".join(control["buffer"]))
            if text:
                self.controls.append(
                    {
                        "tag": control["tag"],
                        "text": text,
                        "attrs": control["attrs"],
                    }
                )

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return

        cleaned = normalize_text(data)
        if not cleaned:
            return

        self.all_text_parts.append(cleaned)

        if self._text_block_stack:
            self._text_block_stack[-1]["buffer"].append(cleaned)

        if self._control_stack:
            self._control_stack[-1]["buffer"].append(cleaned)


def normalize_text(text: str) -> str:
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def split_sentences(text: str) -> list[str]:
    fragments = [fragment.strip() for fragment in SENTENCE_SPLIT_PATTERN.split(text)]
    return [fragment for fragment in fragments if fragment]


def estimate_word_equivalents(text: str) -> int:
    """Estimate sentence length across English, Chinese, or mixed text.

    For English-like text we count word tokens directly.
    For Chinese text we approximate one word as roughly two characters.
    This keeps the RD-1 threshold usable without claiming true linguistic parsing.
    """

    latin_word_count = len(LATIN_WORD_PATTERN.findall(text))
    cjk_char_count = len(CJK_CHAR_PATTERN.findall(text))
    cjk_word_equivalents = ceil(cjk_char_count / 2) if cjk_char_count else 0
    return latin_word_count + cjk_word_equivalents


def compute_average_sentence_length(sentences: list[str]) -> float:
    if not sentences:
        return 0.0
    total_word_equivalents = sum(estimate_word_equivalents(sentence) for sentence in sentences)
    return total_word_equivalents / len(sentences)


def detect_rd1_average_sentence_length(text_blocks: list[dict[str, Any]], fallback_text: str) -> Issue | None:
    """Detect long-sentence burden at the text-block level.

    Why block-level:
    A page may contain one or two very dense paragraphs plus several short helper
    sentences. If we average across the whole page, those short sentences can dilute
    the signal and hide the difficult paragraph. For this MVP, we treat RD-1 as
    triggered when any meaningful text block has an average sentence length above
    the threshold.
    """

    block_metrics: list[dict[str, Any]] = []

    for index, block in enumerate(text_blocks, start=1):
        sentences = split_sentences(block["text"])
        if not sentences:
            continue

        average_length = compute_average_sentence_length(sentences)
        longest_sentence = max(sentences, key=estimate_word_equivalents)
        block_metrics.append(
            {
                "block_index": index,
                "tag": block["tag"],
                "average_sentence_length": average_length,
                "sentence_count": len(sentences),
                "longest_sentence": longest_sentence,
                "longest_sentence_length": estimate_word_equivalents(longest_sentence),
            }
        )

    if not block_metrics and fallback_text:
        fallback_sentences = split_sentences(fallback_text)
        if fallback_sentences:
            fallback_average = compute_average_sentence_length(fallback_sentences)
            block_metrics.append(
                {
                    "block_index": 1,
                    "tag": "fallback",
                    "average_sentence_length": fallback_average,
                    "sentence_count": len(fallback_sentences),
                    "longest_sentence": max(fallback_sentences, key=estimate_word_equivalents),
                    "longest_sentence_length": max(
                        estimate_word_equivalents(sentence) for sentence in fallback_sentences
                    ),
                }
            )

    overloaded_blocks = [
        metric
        for metric in block_metrics
        if metric["average_sentence_length"] > AVERAGE_SENTENCE_THRESHOLD
    ]
    if not overloaded_blocks:
        return None

    highest_average = max(
        metric["average_sentence_length"] for metric in overloaded_blocks
    )

    if len(overloaded_blocks) >= 3 or highest_average >= 30:
        severity: Severity = "critical"
    elif len(overloaded_blocks) >= 2 or highest_average >= 24:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    locations = [
        {
            "block_index": metric["block_index"],
            "tag": metric["tag"],
            "average_sentence_length": round(metric["average_sentence_length"], 2),
            "sentence_count": metric["sentence_count"],
            "sentence_preview": metric["longest_sentence"][:160],
            "estimated_word_equivalents": metric["longest_sentence_length"],
        }
        for metric in sorted(
            overloaded_blocks,
            key=lambda item: item["average_sentence_length"],
            reverse=True,
        )[:3]
    ]

    return Issue(
        rule_id="RD-1",
        title="Average sentence length is too long",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Long average sentence length increases working-memory demand because users have to hold more information before the meaning is clear. This can cause rereading and slower comprehension, especially for users with processing or communication difficulties.",
        suggestion="Split long sentences into shorter, more direct statements, and try to keep each sentence focused on one main idea.",
        evidence={
            "overloaded_block_count": len(overloaded_blocks),
            "highest_block_average_sentence_length": round(highest_average, 2),
            "threshold": AVERAGE_SENTENCE_THRESHOLD,
            "text_block_count": len(text_blocks),
        },
        locations=locations,
    )


def detect_rd2_dense_paragraphs(text_blocks: list[dict[str, Any]]) -> Issue | None:
    if not text_blocks:
        return None

    overloaded_blocks: list[dict[str, Any]] = []
    max_sentence_count = 0

    for index, block in enumerate(text_blocks, start=1):
        sentence_count = len(split_sentences(block["text"]))
        max_sentence_count = max(max_sentence_count, sentence_count)
        if sentence_count > PARAGRAPH_SENTENCE_THRESHOLD:
            overloaded_blocks.append(
                {
                    "block_index": index,
                    "tag": block["tag"],
                    "sentence_count": sentence_count,
                    "preview": block["text"][:120],
                }
            )

    if not overloaded_blocks:
        return None

    if len(overloaded_blocks) >= 3 or max_sentence_count >= 8:
        severity: Severity = "critical"
    elif len(overloaded_blocks) >= 2 or max_sentence_count >= 6:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    return Issue(
        rule_id="RD-2",
        title="Paragraph is too long",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Dense paragraphs reduce chunking and scanning cues, so users must search inside a large text block to find the main point. This increases comprehension effort and can make the page feel harder to navigate.",
        suggestion="Break long paragraphs or list items into shorter chunks, and add subheadings, lists, or emphasis where needed.",
        evidence={
            "overloaded_block_count": len(overloaded_blocks),
            "max_sentence_count": max_sentence_count,
            "threshold": PARAGRAPH_SENTENCE_THRESHOLD,
        },
        locations=overloaded_blocks,
    )


def detect_rd3_vague_controls(controls: list[dict[str, Any]]) -> Issue | None:
    vague_controls: list[dict[str, Any]] = []

    for control in controls:
        normalized_text = normalize_text(control["text"]).lower()
        if normalized_text in VAGUE_CONTROL_TEXTS:
            vague_controls.append(
                {
                    "tag": control["tag"],
                    "text": control["text"],
                }
            )

    if not vague_controls:
        return None

    if len(vague_controls) >= 3:
        severity: Severity = "critical"
    elif len(vague_controls) >= 2:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    return Issue(
        rule_id="RD-3",
        title="Button or link label is vague",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Vague controls reduce predictability because the next action is not clear from the label. Users may hesitate, make errors, or lose confidence when they cannot infer what will happen after activation.",
        suggestion="Replace vague labels with specific actions, such as \"View course details\" or \"Submit application form\".",
        evidence={
            "vague_control_count": len(vague_controls),
            "matched_texts": [control["text"] for control in vague_controls],
        },
        locations=vague_controls,
    )


def analyze_readability(html: str) -> DimensionResult:
    """Analyze readability from an HTML string or snippet.

    Scope limits:
    - Supports HTML files or HTML snippets only
    - Detects proxy indicators of cognitive load
    - Does not model human cognition or produce compliance certification
    """

    extractor = ReadabilityHTMLExtractor()
    extractor.feed(html)
    extractor.close()

    visible_text = normalize_text(" ".join(extractor.all_text_parts))

    issues = [
        issue
        for issue in [
            detect_rd1_average_sentence_length(extractor.text_blocks, visible_text),
            detect_rd2_dense_paragraphs(extractor.text_blocks),
            detect_rd3_vague_controls(extractor.controls),
        ]
        if issue is not None
    ]

    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score(total_penalty)

    return DimensionResult(
        dimension="Readability",
        score=score,
        issues=issues,
        metadata={
            "implemented_rules": ["RD-1", "RD-2", "RD-3"],
            "pending_rules": [],
            "input_scope": ["html_file", "html_snippet"],
            "out_of_scope": ["pdf", "image", "live_url_fetch", "multi_source_mixed_input"],
            "text_stats": {
                "text_block_count": len(extractor.text_blocks),
                "control_count": len(extractor.controls),
                "visible_text_length": len(visible_text),
            },
            "scoring_model": {
                "formula": "Dimension Score = max(0, 100 - Sum(Penalties))",
                "penalty_formula": "Penalty = Base Penalty * Severity",
            },
        },
    )
