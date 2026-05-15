from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.language_complexity import detect_language_complexity

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)


class LcCardDedupeTests(unittest.TestCase):
    def test_fixture_a_card_anchor_does_not_trigger(self) -> None:
        html = """
        <html><body>
        <a class="card-link ref-modal-trigger">
        <h3>axe DevTools</h3>
        <p>
        Accessibility barriers frequently emerge from inconsistent interaction patterns
        </p>
        </a>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        tags = {loc.get("tag") for loc in issue.locations}
        self.assertNotIn("a", tags)

    def test_fixture_b_inner_paragraph_still_triggers(self) -> None:
        html = """
        <html><body>
        <a class="card-link ref-modal-trigger">
        <h3>axe DevTools</h3>
        <p>
        Accessibility barriers frequently emerge from inconsistent interaction patterns
        </p>
        </a>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        self.assertTrue(any(loc.get("tag") == "p" for loc in issue.locations))

    def test_fixture_c_plain_text_link_still_triggers(self) -> None:
        # Plain anchor text only (no block descendants); >= 8 words for LC gate.
        html = """
        <html><body>
        <a>Accessibility recommendations frequently require personalization support and comprehension assistance</a>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        self.assertTrue(any(loc.get("tag") == "a" for loc in issue.locations))

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_111_html_card_link_anchors_excluded(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        for loc in issue.locations:
            self.assertNotEqual(loc.get("tag"), "a")
            cls = str(loc.get("attrs", {}).get("class", ""))
            self.assertNotIn("card-link", cls)
            self.assertNotIn("ref-modal-trigger", cls)


if __name__ == "__main__":
    unittest.main()
