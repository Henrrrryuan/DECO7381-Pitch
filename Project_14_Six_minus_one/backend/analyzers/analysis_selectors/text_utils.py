from __future__ import annotations

import re

COMPLEX_WORD_RATIO_THRESHOLD = 0.15
LONG_WORD_LENGTH_THRESHOLD = 9

LATIN_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")
ALPHA_WORD_PATTERN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
SENTENCE_SPLIT_PATTERN = re.compile(r"[.!?]+")
DOTTED_NUMERIC_PATTERN = re.compile(r"\b\d+(?:\.\d+)+\b")
VOWEL_GROUP_PATTERN = re.compile(r"[aeiouy]+", re.IGNORECASE)


def _mask_dotted_numeric_tokens(text: str) -> tuple[str, list[str]]:
    """Replace dotted version numbers (e.g. WCAG 2.2.2) so period splits stay sentence boundaries."""
    tokens: list[str] = []

    def _replace(match: re.Match[str]) -> str:
        key = f"__NUM{len(tokens)}__"
        tokens.append(match.group(0))
        return key

    return DOTTED_NUMERIC_PATTERN.sub(_replace, text), tokens


def _restore_dotted_numeric_tokens(fragment: str, tokens: list[str]) -> str:
    restored = fragment
    for index, token in enumerate(tokens):
        restored = restored.replace(f"__NUM{index}__", token)
    return restored


def split_sentences(text: str) -> list[str]:
    masked, numeric_tokens = _mask_dotted_numeric_tokens(text)
    fragments = [fragment.strip() for fragment in SENTENCE_SPLIT_PATTERN.split(masked)]
    return [
        _restore_dotted_numeric_tokens(fragment, numeric_tokens)
        for fragment in fragments
        if fragment
    ]


def tokenize_alpha_words(text: str) -> list[str]:
    return [token.lower() for token in ALPHA_WORD_PATTERN.findall(text)]


def estimate_syllables(word: str) -> int:
    vowel_groups = VOWEL_GROUP_PATTERN.findall(word.lower())
    syllable_count = len(vowel_groups)
    if word.lower().endswith("e") and syllable_count > 1:
        syllable_count -= 1
    return max(1, syllable_count)


def is_complex_word(word: str) -> bool:
    return len(word) >= LONG_WORD_LENGTH_THRESHOLD or estimate_syllables(word) >= 3
