from __future__ import annotations

from .auto_moving_content import detect_auto_moving_content_selector
from .dense_text_detection import detect_dense_text_selector
from .excessive_interruptions import detect_excessive_interruptions_selector
from .language_complexity import detect_language_complexity_selector
from .long_content_without_chunking import detect_long_content_without_chunking_selector
from .navigation_complexity import detect_navigation_complexity_selector
from .poor_heading_structure import detect_poor_heading_structure_selector
from .sentence_complexity import detect_sentence_complexity_selector
from .visual_overload import detect_visual_overload_selector
from .weak_information_prominence import detect_weak_information_prominence_selector

SELECTORS = [
    ("Dense Text Detection", "DT-1", detect_dense_text_selector),
    ("Language Complexity", "LC-1", detect_language_complexity_selector),
    ("Sentence Complexity", "SC-1", detect_sentence_complexity_selector),
    ("Long Content Without Chunking", "LCC-1", detect_long_content_without_chunking_selector),
    ("Poor Heading Structure", "PHS-1", detect_poor_heading_structure_selector),
    ("Navigation Complexity", "NC-1", detect_navigation_complexity_selector),
    ("Weak Information Prominence", "WIP-1", detect_weak_information_prominence_selector),
    ("Visual Overload", "VO-1", detect_visual_overload_selector),
    ("Auto-Moving Content", "AMC-1", detect_auto_moving_content_selector),
    ("Excessive Interruptions", "EI-1", detect_excessive_interruptions_selector),
]

__all__ = ["SELECTORS"]
