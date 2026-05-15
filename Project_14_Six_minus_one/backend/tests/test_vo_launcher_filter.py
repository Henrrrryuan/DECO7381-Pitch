from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.interaction_helpers import _looks_like_modal_trigger
from backend.analyzers.analysis_selectors.visual_overload import (
    detect_visual_overload,
    is_interactive,
)
from backend.analyzers.analysis_selectors.visual_parser import VisualHTMLParser

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)


def _first_viewport_interactive_count(soup: BeautifulSoup) -> int:
    elements = [
        tag
        for index, tag in enumerate(soup.find_all(True), start=1)
        if index <= 120
        and tag.name not in {"html", "head", "body", "script", "style", "meta", "link"}
    ]
    return len([tag for tag in elements if is_interactive(tag)])


def _interactive_competition_locations(issue) -> list[dict]:
    if issue is None:
        return []
    return [
        loc
        for loc in issue.locations
        if loc.get("contributorCategory") == "interactive_competition"
    ]


class VoLauncherFilterTests(unittest.TestCase):
    def test_fixture_a_card_modal_trigger_not_interactive(self) -> None:
        html = """
        <html><body>
        <a class="card-link ref-modal-trigger" href="#">WAVE</a>
        </body></html>
        """
        tag = BeautifulSoup(html, "html.parser").find("a")
        assert tag is not None
        self.assertTrue(_looks_like_modal_trigger(tag))
        self.assertFalse(is_interactive(tag))

    def test_fixture_b_ref_modal_trigger_not_interactive(self) -> None:
        html = """
        <html><body>
        <a class="ref-modal-trigger" href="/open">Accessibility Insights</a>
        </body></html>
        """
        tag = BeautifulSoup(html, "html.parser").find("a")
        assert tag is not None
        self.assertTrue(_looks_like_modal_trigger(tag))
        self.assertFalse(is_interactive(tag))

    def test_fixture_c_plain_anchor_still_interactive(self) -> None:
        html = """
        <html><body>
        <a href="/page">Learn accessibility recommendations</a>
        </body></html>
        """
        tag = BeautifulSoup(html, "html.parser").find("a")
        assert tag is not None
        self.assertFalse(_looks_like_modal_trigger(tag))
        self.assertTrue(is_interactive(tag))

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_111_html_launcher_cards_excluded_from_interactive_competition(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        parser = VisualHTMLParser()
        parser.feed(html)
        parser.close()

        interactive_count = _first_viewport_interactive_count(soup)
        self.assertEqual(interactive_count, 7)

        issue = detect_visual_overload(soup, parser)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.evidence.get("interactive_element_count"), 7)

        ic_locs = _interactive_competition_locations(issue)
        self.assertEqual(len(ic_locs), 0)
        for loc in issue.locations:
            cls = str(loc.get("attrs", {}).get("class", ""))
            self.assertNotIn("card-link", cls)
            self.assertNotIn("ref-modal-trigger", cls)


if __name__ == "__main__":
    unittest.main()
