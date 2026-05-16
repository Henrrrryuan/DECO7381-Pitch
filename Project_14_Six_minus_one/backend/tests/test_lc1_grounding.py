from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.language_complexity import detect_language_complexity
from backend.analyzers.location_utils import sanitize_issue_locations, select_safely

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)


class LC1GroundingFixture111Tests(unittest.TestCase):
    """Real-page grounding: avoid repeated header:nth-of-type(...) collisions on sanitize."""

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_first_sanitized_location_resolves_exactly_one_node(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        assert issue is not None

        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Language Complexity",
            "LC-1",
        )
        self.assertGreater(len(sanitized), 0)

        soup2 = BeautifulSoup(html, "html.parser")
        first_sel = str(sanitized[0].get("selector") or "").strip()
        self.assertTrue(first_sel)
        self.assertEqual(len(select_safely(soup2, first_sel)), 1)

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_all_sanitized_lc_selectors_resolve_uniquely(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        assert issue is not None

        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Language Complexity",
            "LC-1",
        )
        self.assertGreater(len(sanitized), 0)

        soup2 = BeautifulSoup(html, "html.parser")
        for idx, loc in enumerate(sanitized):
            sel = str(loc.get("selector") or "").strip()
            self.assertTrue(sel, msg=f"sanitized[{idx}] missing selector")
            n = len(select_safely(soup2, sel))
            self.assertEqual(n, 1, msg=f"sanitized[{idx}] selector {sel[:160]!r}")


if __name__ == "__main__":
    unittest.main()
