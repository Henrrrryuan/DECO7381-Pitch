from __future__ import annotations

import io
import os
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.language_complexity import LANGUAGE_SELECTOR, detect_language_complexity
from backend.analyzers.analysis_selectors.shared import visible_text
from backend.analyzers.analysis_selectors.text_utils import (
    COMPLEX_WORD_RATIO_THRESHOLD,
    is_complex_word,
    tokenize_alpha_words,
)
from backend.analyzers.location_utils import (
    LC_TEXT_BLOCK_TAG_NAMES,
    best_candidate_for_location,
    sanitize_issue_locations,
)

_FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
_LC_COVERAGE_HTML_PATH = _FIXTURE_DIR / "lc1_coverage.html"

LC_COVERAGE_TRIGGER_CASE_IDS = frozenset(
    {
        "case-2",
        "case-3",
        "case-4",
        "case-5",
        "case-6a",
        "case-6b",
        "case-8",
        "case-10",
    }
)

LC_COVERAGE_NON_TRIGGER_CASE_IDS = frozenset({"case-1", "case-7", "case-9"})

LC_COVERAGE_EXPECTED_ISSUE_CASE_IDS = LC_COVERAGE_TRIGGER_CASE_IDS

LC_COVERAGE_TRIGGER_ORDER = [
    "case-2",
    "case-3",
    "case-4",
    "case-5",
    "case-6a",
    "case-6b",
    "case-8",
    "case-10",
]

LC_COVERAGE_EXPECTED_ISSUE_TOTAL = 8


def _lc_coverage_html() -> str:
    return _LC_COVERAGE_HTML_PATH.read_text(encoding="utf-8")


def _lc_fixture_html() -> str:
    """Minimal duplicate-paragraph fixture (legacy tests)."""
    return """
    <html><body>
    <section>
    <p id="lc-dup-a">The internationalization extraordinarily unnecessarily dramatically
    significantly sophisticatedly demonstrates complexity undoubtedly phenomenal</p>
    <p id="lc-dup-b">The internationalization extraordinarily unnecessarily dramatically
    significantly sophisticatedly demonstrates complexity undoubtedly phenomenal</p>
    </section>
    <article><p id="lc-other">Short text</p></article>
    </body></html>
    """


def _case_ids_from_locations(locations: list[dict]) -> set[str]:
    out: set[str] = set()
    for loc in locations:
        attrs = loc.get("attrs")
        if isinstance(attrs, dict):
            cid = attrs.get("data-case-id")
            if cid:
                out.add(str(cid))
    return out


def _pre_cap_lc_trigger_case_ids_in_order(html: str) -> list[str]:
    """Same firing rules as detect_language_complexity, uncapped — for forensic expectations."""
    soup = BeautifulSoup(html, "html.parser")
    ordered: list[str] = []
    for tag in soup.select(LANGUAGE_SELECTOR):
        words = tokenize_alpha_words(visible_text(tag))
        if len(words) < 8:
            continue
        complex_words = [word for word in words if is_complex_word(word)]
        ratio = len(complex_words) / len(words)
        if ratio > COMPLEX_WORD_RATIO_THRESHOLD:
            cid = tag.get("data-case-id")
            if cid:
                ordered.append(str(cid))
    return ordered


def _simulate_lc_highlight_resolution(html: str, sanitized_locations: list[dict]) -> tuple[list[int], list[str]]:
    """Markup-only stand-in for LC findElementsForLocation: selector match count per location."""
    soup = BeautifulSoup(html, "html.parser")
    counts: list[int] = []
    tags: list[str] = []
    for loc in sanitized_locations:
        sel = str(loc.get("selector") or "").strip()
        if not sel:
            counts.append(0)
            tags.append("")
            continue
        try:
            matched = soup.select(sel)
        except Exception:
            counts.append(-1)
            tags.append("")
            continue
        lc_ok = [t for t in matched if (t.name or "").lower() in LC_TEXT_BLOCK_TAG_NAMES]
        counts.append(len(lc_ok))
        tags.append((lc_ok[0].name or "").lower() if len(lc_ok) == 1 else "ambiguous")
    return counts, tags


class LC1SanitizeTests(unittest.TestCase):
    def test_lc_scope_tags_match_language_selector(self) -> None:
        self.assertEqual(
            LC_TEXT_BLOCK_TAG_NAMES,
            frozenset({"p", "li", "td", "th", "label", "button", "a"}),
        )

    def test_detector_threshold_metadata_is_point_one_five(self) -> None:
        soup = BeautifulSoup(_lc_fixture_html(), "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        thresh = issue.evidence.get("threshold", {})
        self.assertEqual(thresh.get("maxComplexWordRatio"), 0.15)

    def test_duplicate_paragraphs_get_distinct_selectors_after_sanitize(self) -> None:
        html = _lc_fixture_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        raw_locs = issue.locations
        self.assertGreaterEqual(len(raw_locs), 2)
        sel_a = {loc.get("selector") for loc in raw_locs if loc.get("attrs", {}).get("id") == "lc-dup-a"}
        sel_b = {loc.get("selector") for loc in raw_locs if loc.get("attrs", {}).get("id") == "lc-dup-b"}
        self.assertIn("#lc-dup-a", sel_a)
        self.assertIn("#lc-dup-b", sel_b)

        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            raw_locs,
            "Language Complexity",
            "LC-1",
        )
        self.assertGreaterEqual(len(sanitized), 2)
        selectors = [loc.get("selector") for loc in sanitized]
        self.assertEqual(len(selectors), len(set(selectors)), msg="sanitized selectors must be unique")

    def test_sanitized_payload_preserves_lexical_fields(self) -> None:
        html = _lc_fixture_html()
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
        self.assertTrue(sanitized)
        loc = sanitized[0]
        self.assertEqual(loc.get("rule_id"), "LC-1")
        self.assertIn("word_count", loc)
        self.assertIn("sample_words", loc)
        self.assertIsInstance(loc["sample_words"], list)
        self.assertIn("complex_word_ratio", loc)
        self.assertIn("complex_word_count", loc)
        tag = (loc.get("tag") or "").lower()
        self.assertIn(tag, LC_TEXT_BLOCK_TAG_NAMES)

    def test_best_candidate_never_selects_section_for_lc(self) -> None:
        html = """
        <html><body>
        <section id="outer"><p id="inner">The internationalization extraordinarily
        unnecessarily dramatically significantly sophisticatedly demonstrates complexity
        undoubtedly phenomenal</p></section>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        loc = issue.locations[0]
        cand = best_candidate_for_location(soup, loc, "Language Complexity", "LC-1", set())
        self.assertIsNotNone(cand)
        assert cand is not None
        self.assertEqual((cand.name or "").lower(), "p")


class LC1CoverageFixtureTests(unittest.TestCase):
    """Coverage fixture: exactly 8 LC hits; case-1 / case-7 / case-9 do not fire."""

    def test_pre_cap_eight_triggers_in_document_order(self) -> None:
        html = _lc_coverage_html()
        ordered = _pre_cap_lc_trigger_case_ids_in_order(html)
        self.assertEqual(ordered, LC_COVERAGE_TRIGGER_ORDER)
        self.assertEqual(frozenset(ordered), LC_COVERAGE_TRIGGER_CASE_IDS)

    def test_issue_has_eight_locations_no_non_triggers(self) -> None:
        html = _lc_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        self.assertEqual(len(issue.locations), LC_COVERAGE_EXPECTED_ISSUE_TOTAL)
        found = _case_ids_from_locations(issue.locations)
        self.assertEqual(found, LC_COVERAGE_EXPECTED_ISSUE_CASE_IDS)
        self.assertFalse(found & LC_COVERAGE_NON_TRIGGER_CASE_IDS)

    def test_sanitize_preserves_eight_distinct_selectors_and_interactive_types(self) -> None:
        html = _lc_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        assert issue is not None
        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Language Complexity",
            "LC-1",
        )
        self.assertEqual(len(sanitized), LC_COVERAGE_EXPECTED_ISSUE_TOTAL)
        found = _case_ids_from_locations(sanitized)
        self.assertEqual(found, LC_COVERAGE_EXPECTED_ISSUE_CASE_IDS)
        selectors = [loc.get("selector") for loc in sanitized]
        self.assertEqual(len(selectors), len(set(selectors)))

        tags_lower = {(loc.get("tag") or "").lower() for loc in sanitized}
        self.assertIn("button", tags_lower)
        self.assertIn("a", tags_lower)
        self.assertIn("label", tags_lower)
        self.assertIn("td", tags_lower)
        self.assertIn("p", tags_lower)

    def test_coverage_each_sanitized_selector_resolves_to_one_lc_tag(self) -> None:
        html = _lc_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_language_complexity(soup)
        assert issue is not None
        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Language Complexity",
            "LC-1",
        )
        counts, tags = _simulate_lc_highlight_resolution(html, sanitized)
        self.assertTrue(all(c == 1 for c in counts), msg=f"per-location LC match counts: {counts}")
        for t in tags:
            self.assertIn(t, LC_TEXT_BLOCK_TAG_NAMES)
        self.assertNotIn("section", tags)
        self.assertNotIn("article", tags)
        self.assertNotIn("div", tags)

    def test_forensic_logging_does_not_break_when_enabled(self) -> None:
        html = _lc_coverage_html()
        with patch.dict(os.environ, {"LC1_FORENSIC": "1"}):
            buf = io.StringIO()
            with redirect_stdout(buf):
                soup = BeautifulSoup(html, "html.parser")
                issue = detect_language_complexity(soup)
                assert issue is not None
                sanitize_issue_locations(
                    BeautifulSoup(html, "html.parser"),
                    issue.locations,
                    "Language Complexity",
                    "LC-1",
                )
            self.assertIn("[LC-1 detector]", buf.getvalue())
            self.assertIn("[LC-1 sanitize]", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
