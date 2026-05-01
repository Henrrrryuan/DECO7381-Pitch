from __future__ import annotations

import re
from html.parser import HTMLParser
from math import ceil
from typing import Any

from ..schemas import DimensionResult, Issue, Severity
from ..scoring import (
    PENALTY_FORMULA_TEXT,
    SCORING_FORMULA_TEXT,
    calculate_dimension_score,
    calculate_penalty,
)

AVERAGE_SENTENCE_THRESHOLD = 20
PARAGRAPH_SENTENCE_THRESHOLD = 4
COMPLEX_WORD_RATIO_THRESHOLD = 0.18
LONG_WORD_LENGTH_THRESHOLD = 9
COMPLEX_INSTRUCTION_SENTENCE_THRESHOLD = 2
INSTRUCTION_QUALIFIER_THRESHOLD = 2
CHUNKING_SENTENCE_THRESHOLD = 3
CHUNKING_WORD_THRESHOLD = 55
LIST_SUPPORT_RATIO_THRESHOLD = 0.25
REGULAR_BASE_PENALTY = 3

VAGUE_CONTROL_TEXTS = {
    "next",
    "click here",
    "read more",
    "learn more",
    "more",
    "submit",
    "continue",
    "proceed",
    "confirm",
    "done",
    "ok",
    "start",
    "go",
    "view",
    "details",
}

GENERIC_ACTION_VERBS = {
    "continue",
    "proceed",
    "confirm",
    "done",
    "ok",
    "start",
    "go",
    "view",
    "open",
    "show",
    "submit",
    "learn",
    "read",
    "click",
}

GENERIC_ACTION_OBJECTS = {
    "more",
    "details",
    "detail",
    "info",
    "information",
    "here",
    "page",
    "item",
    "this",
    "that",
}

INSTRUCTION_HINTS = {
    "please",
    "ensure",
    "make sure",
    "must",
    "should",
    "select",
    "choose",
    "enter",
    "provide",
    "complete",
    "review",
    "remember",
    "note",
    "upload",
    "download",
    "confirm",
    "submit",
    "tick",
    "check",
}

INSTRUCTION_QUALIFIER_HINTS = {
    "if",
    "unless",
    "before",
    "after",
    "once",
    "while",
    "when",
    "where",
    "provided",
    "including",
    "except",
    "without",
    "until",
}

LATIN_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")
ALPHA_WORD_PATTERN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
CJK_CHAR_PATTERN = re.compile(r"[\u4e00-\u9fff]")
SENTENCE_SPLIT_PATTERN = re.compile(r"[.!?。！？]+")
WHITESPACE_PATTERN = re.compile(r"\s+")
VOWEL_GROUP_PATTERN = re.compile(r"[aeiouy]+", re.IGNORECASE)


class ReadabilityHTMLExtractor(HTMLParser):
    """Extract visible text, paragraph text, and control labels from HTML."""

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
                    "attrs": attributes,
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
                        "attrs": text_block["attrs"],
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


def tokenize_alpha_words(text: str) -> list[str]:
    return [token.lower() for token in ALPHA_WORD_PATTERN.findall(text)]


def estimate_word_equivalents(text: str) -> int:
    """Estimate sentence length across English, Chinese, or mixed text."""

    latin_word_count = len(LATIN_WORD_PATTERN.findall(text))
    cjk_char_count = len(CJK_CHAR_PATTERN.findall(text))
    cjk_word_equivalents = ceil(cjk_char_count / 2) if cjk_char_count else 0
    return latin_word_count + cjk_word_equivalents


def compute_average_sentence_length(sentences: list[str]) -> float:
    if not sentences:
        return 0.0
    total_word_equivalents = sum(estimate_word_equivalents(sentence) for sentence in sentences)
    return total_word_equivalents / len(sentences)


def estimate_syllables(word: str) -> int:
    vowel_groups = VOWEL_GROUP_PATTERN.findall(word.lower())
    syllable_count = len(vowel_groups)
    if word.lower().endswith("e") and syllable_count > 1:
        syllable_count -= 1
    return max(1, syllable_count)


def is_complex_word(word: str) -> bool:
    return len(word) >= LONG_WORD_LENGTH_THRESHOLD or estimate_syllables(word) >= 3


def summarize_block(block: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "tag": block.get("tag", ""),
        "preview": block.get("text", "")[:160],
    }
    if extra:
        payload.update(extra)
    return payload


def generic_control_label(control_text: str) -> bool:
    normalized_text = normalize_text(control_text).lower()
    if not normalized_text:
        return False

    if normalized_text in VAGUE_CONTROL_TEXTS:
        return True

    tokens = tokenize_alpha_words(normalized_text)
    if not tokens or len(tokens) > 2:
        return False

    if all(token in GENERIC_ACTION_VERBS or token in GENERIC_ACTION_OBJECTS for token in tokens):
        return True

    if tokens[0] in GENERIC_ACTION_VERBS and len(tokens) == 1:
        return True

    if (
        tokens[0] in GENERIC_ACTION_VERBS
        and len(tokens) == 2
        and tokens[1] in GENERIC_ACTION_OBJECTS
    ):
        return True

    return False


def instruction_hint_count(text: str) -> int:
    normalized_text = normalize_text(text).lower()
    count = 0
    for hint in INSTRUCTION_HINTS:
        if hint in normalized_text:
            count += 1
    return count


def instruction_qualifier_count(text: str) -> int:
    tokens = tokenize_alpha_words(text)
    return sum(1 for token in tokens if token in INSTRUCTION_QUALIFIER_HINTS)


def detect_rd1_average_sentence_length(text_blocks: list[dict[str, Any]], fallback_text: str) -> Issue | None:
    """Detect long-sentence burden at the text-block level."""

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
            longest_sentence = max(fallback_sentences, key=estimate_word_equivalents)
            block_metrics.append(
                {
                    "block_index": 1,
                    "tag": "fallback",
                    "average_sentence_length": fallback_average,
                    "sentence_count": len(fallback_sentences),
                    "longest_sentence": longest_sentence,
                    "longest_sentence_length": estimate_word_equivalents(longest_sentence),
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
        description="Long average sentence length increases working-memory demand because users have to hold more information before the meaning is clear. This can cause rereading and slower comprehension, especially for users with reading difficulties.",
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
        if generic_control_label(control["text"]):
            # Keep enough element context for the report UI to distinguish
            # separate generic controls that share the same tag, e.g. two buttons.
            vague_controls.append(
                {
                    "tag": control["tag"],
                    "text": control["text"],
                    "attrs": control.get("attrs", {}),
                }
            )

    if not vague_controls:
        return None

    if len(vague_controls) >= 4:
        severity: Severity = "critical"
    elif len(vague_controls) >= 2:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    return Issue(
        rule_id="RD-3",
        title="Action label is vague or underspecified",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Vague action labels reduce predictability because users cannot quickly infer what will happen after activation. This adds interpretation effort and can make task completion feel less certain.",
        suggestion="Replace generic labels with specific actions, such as \"View event details\" or \"Continue to payment\".",
        evidence={
            "vague_control_count": len(vague_controls),
            "matched_texts": [control["text"] for control in vague_controls],
        },
        locations=vague_controls,
    )


def detect_rd4_word_complexity(text_blocks: list[dict[str, Any]], fallback_text: str) -> Issue | None:
    complex_blocks: list[dict[str, Any]] = []

    candidate_blocks = text_blocks or [{"tag": "fallback", "text": fallback_text}]
    for index, block in enumerate(candidate_blocks, start=1):
        words = tokenize_alpha_words(block["text"])
        if len(words) < 8:
            continue

        complex_words = [word for word in words if is_complex_word(word)]
        long_words = [word for word in words if len(word) >= LONG_WORD_LENGTH_THRESHOLD]
        complex_ratio = len(complex_words) / len(words)

        if complex_ratio >= COMPLEX_WORD_RATIO_THRESHOLD and len(complex_words) >= 4:
            complex_blocks.append(
                {
                    "block_index": index,
                    "tag": block["tag"],
                    "word_count": len(words),
                    "complex_word_count": len(complex_words),
                    "long_word_count": len(long_words),
                    "complex_word_ratio": round(complex_ratio, 2),
                    "preview": block["text"][:160],
                    "sample_words": complex_words[:6],
                }
            )

    if not complex_blocks:
        return None

    highest_ratio = max(block["complex_word_ratio"] for block in complex_blocks)
    if len(complex_blocks) >= 3 or highest_ratio >= 0.30:
        severity: Severity = "critical"
    elif len(complex_blocks) >= 2 or highest_ratio >= 0.24:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    return Issue(
        rule_id="RD-4",
        title="Word complexity is too high",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Long or complex words can increase decoding effort, especially when many of them appear in the same text block. This may slow reading and make the page harder to process at a glance.",
        suggestion="Use simpler, more familiar words where possible, and replace dense technical wording with plainer language.",
        evidence={
            "complex_block_count": len(complex_blocks),
            "highest_complex_word_ratio": highest_ratio,
            "threshold": COMPLEX_WORD_RATIO_THRESHOLD,
        },
        locations=complex_blocks[:3],
    )


def detect_rd5_complex_instructions(text_blocks: list[dict[str, Any]]) -> Issue | None:
    instruction_blocks: list[dict[str, Any]] = []

    for index, block in enumerate(text_blocks, start=1):
        hint_count = instruction_hint_count(block["text"])
        if hint_count == 0:
            continue

        sentences = split_sentences(block["text"])
        sentence_count = len(sentences)
        qualifier_count = instruction_qualifier_count(block["text"])
        average_sentence_length = compute_average_sentence_length(sentences) if sentences else 0.0

        if (
            sentence_count >= COMPLEX_INSTRUCTION_SENTENCE_THRESHOLD
            or qualifier_count >= INSTRUCTION_QUALIFIER_THRESHOLD
            or average_sentence_length >= 18
        ):
            instruction_blocks.append(
                {
                    "block_index": index,
                    "tag": block["tag"],
                    "sentence_count": sentence_count,
                    "instruction_hint_count": hint_count,
                    "qualifier_count": qualifier_count,
                    "average_sentence_length": round(average_sentence_length, 2),
                    "preview": block["text"][:160],
                }
            )

    if not instruction_blocks:
        return None

    max_qualifier_count = max(block["qualifier_count"] for block in instruction_blocks)
    max_sentence_count = max(block["sentence_count"] for block in instruction_blocks)

    if len(instruction_blocks) >= 3 or max_qualifier_count >= 4 or max_sentence_count >= 4:
        severity: Severity = "critical"
    elif len(instruction_blocks) >= 2 or max_qualifier_count >= 3:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    return Issue(
        rule_id="RD-5",
        title="Instructions are too complex or indirect",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Complex instructions increase comprehension effort because users must hold several conditions, qualifiers, or indirect steps in mind before acting. This can make form completion and task flow feel less clear.",
        suggestion="Rewrite instructions as shorter, direct steps, and separate conditions or exceptions into small, easy-to-scan chunks.",
        evidence={
            "instruction_block_count": len(instruction_blocks),
            "max_qualifier_count": max_qualifier_count,
            "max_sentence_count": max_sentence_count,
        },
        locations=instruction_blocks[:3],
    )


def detect_rd6_missing_chunking(text_blocks: list[dict[str, Any]]) -> Issue | None:
    if not text_blocks:
        return None

    list_item_count = sum(1 for block in text_blocks if block["tag"] == "li")
    list_support_ratio = list_item_count / len(text_blocks)
    long_prose_blocks: list[dict[str, Any]] = []

    for index, block in enumerate(text_blocks, start=1):
        if block["tag"] == "li":
            continue

        sentence_count = len(split_sentences(block["text"]))
        word_equivalents = estimate_word_equivalents(block["text"])
        if (
            sentence_count >= CHUNKING_SENTENCE_THRESHOLD
            and word_equivalents >= CHUNKING_WORD_THRESHOLD
            and list_support_ratio < LIST_SUPPORT_RATIO_THRESHOLD
        ):
            long_prose_blocks.append(
                {
                    "block_index": index,
                    "tag": block["tag"],
                    "sentence_count": sentence_count,
                    "estimated_word_equivalents": word_equivalents,
                    "preview": block["text"][:160],
                }
            )

    if not long_prose_blocks:
        return None

    max_word_equivalents = max(block["estimated_word_equivalents"] for block in long_prose_blocks)
    if len(long_prose_blocks) >= 3 or max_word_equivalents >= 110:
        severity: Severity = "critical"
    elif len(long_prose_blocks) >= 2 or max_word_equivalents >= 85:
        severity = "major"
    else:
        severity = "minor"

    base_penalty = REGULAR_BASE_PENALTY
    penalty = calculate_penalty(base_penalty, severity)

    return Issue(
        rule_id="RD-6",
        title="Dense text is not sufficiently chunked",
        severity=severity,
        base_penalty=base_penalty,
        penalty=penalty,
        description="Long prose without enough chunking can make users search through a block of text instead of quickly scanning it. This increases rereading burden and makes the main message or step harder to find.",
        suggestion="Break long prose into smaller grouped chunks, and use lists, short sub-sections, or clearly separated steps to reduce scanning effort.",
        evidence={
            "long_prose_block_count": len(long_prose_blocks),
            "list_item_count": list_item_count,
            "list_support_ratio": round(list_support_ratio, 2),
            "threshold": LIST_SUPPORT_RATIO_THRESHOLD,
        },
        locations=long_prose_blocks[:3],
    )


def analyze_readability(html: str) -> DimensionResult:
    """Analyze readability from an HTML string or snippet."""

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
            detect_rd4_word_complexity(extractor.text_blocks, visible_text),
            detect_rd5_complex_instructions(extractor.text_blocks),
            detect_rd6_missing_chunking(extractor.text_blocks),
        ]
        if issue is not None
    ]

    total_penalty = sum(issue.penalty for issue in issues)
    score = calculate_dimension_score("Readability", total_penalty)

    return DimensionResult(
        dimension="Readability",
        score=score,
        issues=issues,
        metadata={
            "implemented_rules": ["RD-1", "RD-2", "RD-3", "RD-4", "RD-5", "RD-6"],
            "pending_rules": [],
            "input_scope": ["html_file", "html_snippet"],
            "out_of_scope": ["pdf", "image", "live_url_fetch", "multi_source_mixed_input"],
            "text_stats": {
                "text_block_count": len(extractor.text_blocks),
                "control_count": len(extractor.controls),
                "visible_text_length": len(visible_text),
            },
            "scoring_model": {
                "formula": SCORING_FORMULA_TEXT,
                "penalty_formula": PENALTY_FORMULA_TEXT,
                "dimension_penalty_cap": 54,
            },
        },
    )
