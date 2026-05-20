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

    def test_complex_nav_reports_container_not_nested_links(self) -> None:
        links = "".join(
            f'<li><a href="/section-{index}">Section {index}</a></li>'
            for index in range(1, 18)
        )
        html = f"""
        <html><body>
          <header><h1>Service Portal</h1></header>
          <nav id="complex-primary-nav" aria-label="Primary">
            <ul class="primary-menu">{links}</ul>
          </nav>
          <main>
            <p>Short page content keeps the navigation contributor easy to inspect.</p>
          </main>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        parser = VisualHTMLParser()
        parser.feed(html)
        parser.close()

        issue = detect_visual_overload(soup, parser)
        self.assertIsNotNone(issue)

        navigation_locations = [
            loc for loc in issue.locations
            if loc.get("contributorCategory") == "navigation_density"
        ]
        self.assertEqual(len(navigation_locations), 1)
        self.assertEqual(navigation_locations[0].get("tag"), "nav")
        self.assertEqual(navigation_locations[0].get("selector"), "#complex-primary-nav")

        nav_child_tags = {
            loc.get("tag")
            for loc in navigation_locations
            if loc.get("tag") in {"ul", "ol", "li", "a"}
        }
        self.assertEqual(nav_child_tags, set())

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
        self.assertGreaterEqual(categories.get("navigation_density", 0), 1)
        for loc in issue.locations:
            summary = str(loc.get("summary") or "")
            if summary.startswith(("ul", "ol", "li")):
                self.assertNotEqual(loc.get("contributorCategory"), "card_grid_density")


if __name__ == "__main__":
    unittest.main()
