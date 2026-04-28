"""Analyzer modules for each dashboard dimension."""

from .consistency import analyze_consistency
from .information_overload import analyze_information_overload
from .interaction import analyze_interaction
from .readability import analyze_readability
from .visual_complexity import (
    analyze_rendered_visual_complexity,
    analyze_visual_complexity,
)

__all__ = [
    "analyze_consistency",
    "analyze_information_overload",
    "analyze_interaction",
    "analyze_rendered_visual_complexity",
    "analyze_readability",
    "analyze_visual_complexity",
]
