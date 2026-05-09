from __future__ import annotations

import re

COMPLEX_WORD_RATIO_THRESHOLD = 0.18
LONG_WORD_LENGTH_THRESHOLD = 9

LATIN_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")
ALPHA_WORD_PATTERN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
SENTENCE_SPLIT_PATTERN = re.compile(r"[.!?。！？]+")
VOWEL_GROUP_PATTERN = re.compile(r"[aeiouy]+", re.IGNORECASE)


def split_sentences(text: str) -> list[str]:
    fragments = [fragment.strip() for fragment in SENTENCE_SPLIT_PATTERN.split(text)]
    return [fragment for fragment in fragments if fragment]


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
