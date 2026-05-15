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


class LcNavigationFilterTests(unittest.TestCase):
    def test_fixture_a_nav_parent_li_does_not_trigger(self) -> None:
        html = """
        <html><body><nav><ul><li>
        Core Functions
        1 Cognitive Accessibility Analysis
        2 Insight Recommendation Validation
        </li></ul></nav></body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        self.assertIsNone(detect_language_complexity(soup))

    def test_fixture_b_aside_list_does_not_trigger(self) -> None:
        html = """
        <html><body><aside><li>
        Problem Research
        System Workflow
        Ethical Considerations
        </li></aside></body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        self.assertIsNone(detect_language_complexity(soup))

    def test_fixture_c_prose_paragraph_still_triggers(self) -> None:
        html = """
        <html><body><p>
        Accessibility barriers frequently emerge from inconsistent interaction patterns and cognitive overload.
        </p></body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        self.assertEqual(issue.rule_id, "LC-1")
        self.assertGreater(len(issue.locations), 0)

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_111_html_nav_locations_excluded_from_lc(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        for loc in issue.locations:
            text = str(loc.get("text") or loc.get("preview") or "")
            self.assertNotIn(
                "Core Functions 1.",
                text,
                msg="nav sidebar aggregation should not appear in LC locations",
            )
            self.assertNotIn(
                "Technical Skills 1.",
                text,
                msg="nav sidebar aggregation should not appear in LC locations",
            )


if __name__ == "__main__":
    unittest.main()
