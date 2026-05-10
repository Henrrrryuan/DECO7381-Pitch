from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.dense_text_detection import (
    DENSE_TEXT_SENTENCE_THRESHOLD,
    DENSE_TEXT_WORD_THRESHOLD,
    TEXT_BLOCK_SELECTOR,
    detect_dense_text,
)
from backend.analyzers.analysis_selectors.shared import visible_text
from backend.analyzers.analysis_selectors.text_utils import split_sentences, tokenize_alpha_words
from backend.analyzers.location_utils import (
    DT_TEXT_BLOCK_TAG_NAMES,
    best_candidate_for_location,
    sanitize_issue_locations,
)

_FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
_DT_COVERAGE_HTML_PATH = _FIXTURE_DIR / "dt1_coverage.html"

DT_COVERAGE_TRIGGER_CASE_IDS = frozenset(
    {
        "dup-a",
        "dup-b",
        "case-p",
        "case-article",
        "case-li",
        "case-th",
        "case-td",
    }
)

DT_COVERAGE_NON_TRIGGER_CASE_IDS = frozenset({"non-short", "non-li"})

DT_COVERAGE_EXPECTED_ISSUE_TOTAL = 7


def _dt_coverage_html() -> str:
    return _DT_COVERAGE_HTML_PATH.read_text(encoding="utf-8")


def _case_ids_from_locations(locations: list[dict]) -> set[str]:
    out: set[str] = set()
    for loc in locations:
        attrs = loc.get("attrs")
        if isinstance(attrs, dict):
            cid = attrs.get("data-case-id")
            if cid:
                out.add(str(cid))
    return out


def _pre_cap_dt_trigger_case_ids_in_order(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    ordered: list[str] = []
    for tag in soup.select(TEXT_BLOCK_SELECTOR):
        words = tokenize_alpha_words(visible_text(tag))
        sentences = split_sentences(visible_text(tag))
        if len(words) <= DENSE_TEXT_WORD_THRESHOLD and len(sentences) <= DENSE_TEXT_SENTENCE_THRESHOLD:
            continue
        cid = tag.get("data-case-id")
        if cid:
            ordered.append(str(cid))
    return ordered


def _simulate_dt_highlight_resolution(html: str, sanitized_locations: list[dict]) -> tuple[list[int], list[str]]:
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
        dt_ok = [t for t in matched if (t.name or "").lower() in DT_TEXT_BLOCK_TAG_NAMES]
        counts.append(len(dt_ok))
        tags.append((dt_ok[0].name or "").lower() if len(dt_ok) == 1 else "ambiguous")
    return counts, tags


class DT1SanitizeTests(unittest.TestCase):
    def test_dt_scope_tags_match_text_block_selector(self) -> None:
        self.assertEqual(
            DT_TEXT_BLOCK_TAG_NAMES,
            frozenset({"p", "li", "td", "th"}),
        )

    def test_duplicate_paragraphs_get_distinct_selectors_after_sanitize(self) -> None:
        html = _dt_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_dense_text(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        raw_locs = issue.locations
        dup_ids = [loc for loc in raw_locs if (loc.get("attrs") or {}).get("data-case-id") in ("dup-a", "dup-b")]
        self.assertEqual(len(dup_ids), 2)
        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            raw_locs,
            "Dense Text Detection",
            "DT-1",
        )
        selectors = [loc.get("selector") for loc in sanitized if (loc.get("attrs") or {}).get("data-case-id") in ("dup-a", "dup-b")]
        self.assertEqual(set(selectors), {"#dup-a", "#dup-b"})

    def test_sanitized_payload_preserves_counts_and_rule_id(self) -> None:
        html = _dt_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_dense_text(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Dense Text Detection",
            "DT-1",
        )
        self.assertTrue(sanitized)
        for loc in sanitized:
            self.assertEqual(loc.get("rule_id"), "DT-1")
            self.assertIn("word_count", loc)
            self.assertIn("sentence_count", loc)
            self.assertIsInstance(loc["word_count"], int)
            self.assertIsInstance(loc["sentence_count"], int)
            tag = (loc.get("tag") or "").lower()
            self.assertIn(tag, DT_TEXT_BLOCK_TAG_NAMES)

    def test_best_candidate_never_selects_section_for_dt(self) -> None:
        long = " ".join(f"w{i}" for i in range(130))
        html = f"""
        <html><body>
        <section id="outer"><p id="inner">{long}</p></section>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_dense_text(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        loc = issue.locations[0]
        cand = best_candidate_for_location(soup, loc, "Dense Text Detection", "DT-1", set())
        self.assertIsNotNone(cand)
        assert cand is not None
        self.assertEqual((cand.name or "").lower(), "p")


class DT1CoverageFixtureTests(unittest.TestCase):
    def test_pre_cap_triggers_in_document_order(self) -> None:
        html = _dt_coverage_html()
        ordered = _pre_cap_dt_trigger_case_ids_in_order(html)
        self.assertEqual(len(ordered), DT_COVERAGE_EXPECTED_ISSUE_TOTAL)
        self.assertEqual(frozenset(ordered), DT_COVERAGE_TRIGGER_CASE_IDS)
        self.assertFalse(set(ordered) & DT_COVERAGE_NON_TRIGGER_CASE_IDS)

    def test_issue_locations_match_detector_count(self) -> None:
        html = _dt_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_dense_text(soup)
        self.assertIsNotNone(issue)
        assert issue is not None
        self.assertEqual(len(issue.locations), DT_COVERAGE_EXPECTED_ISSUE_TOTAL)
        found = _case_ids_from_locations(issue.locations)
        self.assertEqual(found, DT_COVERAGE_TRIGGER_CASE_IDS)

    def test_sanitize_preserves_distinct_selectors_and_only_text_block_tags(self) -> None:
        html = _dt_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_dense_text(soup)
        assert issue is not None
        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Dense Text Detection",
            "DT-1",
        )
        self.assertEqual(len(sanitized), DT_COVERAGE_EXPECTED_ISSUE_TOTAL)
        selectors = [loc.get("selector") for loc in sanitized]
        self.assertEqual(len(selectors), len(set(selectors)))
        tags_lower = {(loc.get("tag") or "").lower() for loc in sanitized}
        self.assertTrue(tags_lower <= set(DT_TEXT_BLOCK_TAG_NAMES))
        self.assertNotIn("article", tags_lower)
        self.assertNotIn("section", tags_lower)
        self.assertNotIn("div", tags_lower)

    def test_each_sanitized_selector_resolves_to_one_dt_tag(self) -> None:
        html = _dt_coverage_html()
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_dense_text(soup)
        assert issue is not None
        sanitized = sanitize_issue_locations(
            BeautifulSoup(html, "html.parser"),
            issue.locations,
            "Dense Text Detection",
            "DT-1",
        )
        counts, tags = _simulate_dt_highlight_resolution(html, sanitized)
        self.assertTrue(all(c == 1 for c in counts), msg=f"per-location DT match counts: {counts}")
        for t in tags:
            self.assertIn(t, DT_TEXT_BLOCK_TAG_NAMES)
        self.assertNotIn("section", tags)
        self.assertNotIn("article", tags)


if __name__ == "__main__":
    unittest.main()
