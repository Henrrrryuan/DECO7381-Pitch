from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.poor_heading_structure import detect_poor_heading_structure
from backend.analyzers.location_utils import sanitize_issue_locations, select_safely

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)

_MULTI_H1_HTML = """
<html><body>
<section id="alpha"><header><h1 class="main-title">Alpha Title</h1></header></section>
<section id="beta"><header><h1 class="main-title">Beta Title</h1></header></section>
<section id="gamma"><header><h1 class="main-title">Gamma Title</h1></header></section>
</body></html>
"""


def _multiple_h1_locations(soup: BeautifulSoup) -> list[dict]:
    issue = detect_poor_heading_structure(soup)
    assert issue is not None
    return [
        loc
        for loc in issue.locations
        if isinstance(loc, dict) and loc.get("violationType") == "multiple_h1"
    ]


class Phs1SanitizeTests(unittest.TestCase):
    def test_missing_h1_does_not_duplicate_first_heading_not_h1(self) -> None:
        soup = BeautifulSoup("<html><body><main><h2>Students</h2><p>Directory content.</p></main></body></html>", "html.parser")
        issue = detect_poor_heading_structure(soup)
        self.assertIsNotNone(issue)
        violation_types = [loc.get("violationType") for loc in issue.locations if isinstance(loc, dict)]
        self.assertEqual(violation_types.count("missing_h1"), 1)
        self.assertNotIn("first_heading_not_h1", violation_types)

    def test_first_heading_not_h1_reported_when_h1_exists_later(self) -> None:
        soup = BeautifulSoup("<html><body><main><h2>Students</h2><h1>Directory</h1></main></body></html>", "html.parser")
        issue = detect_poor_heading_structure(soup)
        self.assertIsNotNone(issue)
        violation_types = [loc.get("violationType") for loc in issue.locations if isinstance(loc, dict)]
        self.assertIn("first_heading_not_h1", violation_types)
        self.assertNotIn("missing_h1", violation_types)

    def test_first_heading_h1_has_no_h1_boundary_violation(self) -> None:
        soup = BeautifulSoup("<html><body><main><h1>Students</h1><h2>Directory</h2></main></body></html>", "html.parser")
        issue = detect_poor_heading_structure(soup)
        violation_types = [loc.get("violationType") for loc in (issue.locations if issue else []) if isinstance(loc, dict)]
        self.assertNotIn("missing_h1", violation_types)
        self.assertNotIn("first_heading_not_h1", violation_types)

    def test_multiple_h1_count_preserved_after_sanitize(self) -> None:
        soup = BeautifulSoup(_MULTI_H1_HTML, "html.parser")
        raw = _multiple_h1_locations(soup)
        self.assertEqual(len(raw), 2)
        sanitized = sanitize_issue_locations(soup, raw, "Poor Heading Structure", "PHS-1")
        self.assertEqual(len(sanitized), 2)

    def test_multiple_h1_selectors_are_unique_and_resolve_correct_text(self) -> None:
        soup = BeautifulSoup(_MULTI_H1_HTML, "html.parser")
        raw = _multiple_h1_locations(soup)
        sanitized = sanitize_issue_locations(soup, raw, "Poor Heading Structure", "PHS-1")
        selectors = [str(loc.get("selector") or "") for loc in sanitized]
        self.assertEqual(len(selectors), len(set(selectors)))
        for loc in sanitized:
            selector = str(loc.get("selector") or "")
            self.assertTrue(selector)
            matched = select_safely(soup, selector)
            self.assertEqual(len(matched), 1)
            expected = str(loc.get("text") or loc.get("preview") or "").strip()
            self.assertEqual(matched[0].get_text(" ", strip=True), expected)

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_111_multiple_h1_seven_unique_selectors(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_poor_heading_structure(soup)
        self.assertIsNotNone(issue)
        raw = [
            loc
            for loc in issue.locations
            if isinstance(loc, dict) and loc.get("violationType") == "multiple_h1"
        ]
        self.assertEqual(len(raw), 7)
        sanitized = sanitize_issue_locations(soup, raw, "Poor Heading Structure", "PHS-1")
        self.assertEqual(len(sanitized), 7)
        selectors = [str(loc.get("selector") or "") for loc in sanitized]
        self.assertEqual(len(selectors), len(set(selectors)))
        for loc in sanitized:
            selector = str(loc.get("selector") or "")
            matched = select_safely(soup, selector)
            self.assertEqual(len(matched), 1)
            expected = str(loc.get("text") or loc.get("preview") or "").strip()
            self.assertEqual(matched[0].get_text(" ", strip=True), expected)

    def test_missing_headings_structural_row_survives_sanitize(self) -> None:
        html = "<html><body><main><p>No headings here.</p></main></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_poor_heading_structure(soup)
        self.assertIsNotNone(issue)
        sanitized = sanitize_issue_locations(
            soup,
            issue.locations,
            "Poor Heading Structure",
            "PHS-1",
        )
        missing = [loc for loc in sanitized if loc.get("violationType") == "missing_headings"]
        self.assertEqual(len(missing), 1)
        self.assertTrue(missing[0].get("documentStructuralFinding"))


if __name__ == "__main__":
    unittest.main()
