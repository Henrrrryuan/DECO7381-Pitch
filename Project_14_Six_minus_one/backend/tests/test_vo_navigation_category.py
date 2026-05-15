from __future__ import annotations

import unittest
from collections import Counter
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.visual_overload import (
    detect_visual_overload,
    vo_contributor_category,
)
from backend.analyzers.analysis_selectors.visual_parser import VisualHTMLParser

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)


class VoNavigationCategoryTests(unittest.TestCase):
    def test_fixture_a_nav_ul_is_navigation_density(self) -> None:
        html = """
        <html><body><nav><ul><li>Core Functions</li></ul></nav></body></html>
        """
        tag = BeautifulSoup(html, "html.parser").find("ul")
        assert tag is not None
        self.assertEqual(vo_contributor_category(tag), "navigation_density")

    def test_fixture_b_sub_nav_wrapper_ul_is_navigation_density(self) -> None:
        html = """
        <html><body><div class="sub-nav"><ul><li>Item</li></ul></div></body></html>
        """
        tag = BeautifulSoup(html, "html.parser").find("ul")
        assert tag is not None
        self.assertEqual(vo_contributor_category(tag), "navigation_density")

    def test_fixture_c_card_grid_ul_stays_card_grid_density(self) -> None:
        html = """
        <html><body><ul class="card-grid"><li>Card A</li><li>Card B</li></ul></body></html>
        """
        tag = BeautifulSoup(html, "html.parser").find("ul")
        assert tag is not None
        self.assertEqual(vo_contributor_category(tag), "card_grid_density")

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_111_html_nav_lists_not_labeled_card_grid(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        parser = VisualHTMLParser()
        parser.feed(html)
        parser.close()
        issue = detect_visual_overload(soup, parser)
        self.assertIsNotNone(issue)
        categories = Counter(loc.get("contributorCategory") for loc in issue.locations)
        self.assertEqual(categories.get("card_grid_density", 0), 0)
        self.assertGreaterEqual(categories.get("navigation_density", 0), 5)
        for loc in issue.locations:
            summary = str(loc.get("summary") or "")
            if summary.startswith("ul"):
                self.assertEqual(loc.get("contributorCategory"), "navigation_density")


if __name__ == "__main__":
    unittest.main()
