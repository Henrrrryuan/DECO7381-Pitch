"""Analyzer modules for each dashboard dimension."""

from .consistency import analyze_consistency
from .interaction import analyze_interaction
from .readability import analyze_readability
from .visual import analyze_visual

__all__ = [
    "analyze_consistency",
    "analyze_interaction",
    "analyze_readability",
    "analyze_visual",
]
