"""Grounding-only regression for EI-1 location selectors and AMC-1 media selectors."""

from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors import interaction_helpers as interaction_rules
from backend.analyzers.analysis_selectors.interaction_helpers import extract_js_hints, extract_style_hints, get_candidate_regions
from backend.analyzers.analysis_selectors.excessive_interruptions import detect_excessive_interruptions
from backend.analyzers.location_utils import select_safely
from backend.services.analysis_service import analyze_html

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)


class AmcGroundingTests(unittest.TestCase):
    def test_multiple_iframes_only_autoplay_target_is_unique_single_match(self) -> None:
        html = """<!DOCTYPE html><html><body>
        <iframe src="https://a.example/widget?autoplay=1"></iframe>
        <iframe src="https://b.example/static/nothing"></iframe>
        </body></html>"""
        soup = BeautifulSoup(html, "html.parser")
        payload = analyze_html(html)
        amc_issue = None
        for d in payload.dimensions:
            for i in d.issues:
                if i.rule_id == "AMC-1":
                    amc_issue = i
                    break
            if amc_issue is not None:
                break
        self.assertIsNotNone(amc_issue)
        locs = list(amc_issue.locations or [])  # type: ignore[union-attr]
        self.assertEqual(len(locs), 1)
        sel = str(locs[0].get("selector") or "")
        self.assertTrue(sel)
        self.assertEqual(len(select_safely(soup, sel)), 1)

    def test_multiple_autoplay_videos_selectors_unique(self) -> None:
        html = """<!DOCTYPE html><html><body>
        <video autoplay muted id="vx" src="/a.mp4"></video>
        <video autoplay id="vy" src="/b.mp4"></video>
        </body></html>"""
        soup = BeautifulSoup(html, "html.parser")
        payload = analyze_html(html)
        sels = [
            loc.get("selector")
            for d in payload.dimensions
            for iss in d.issues
            if iss.rule_id == "AMC-1"
            for loc in iss.locations or []
        ]
        self.assertGreaterEqual(len(sels), 2)
        uniq = set()
        for s in sels:
            self.assertTrue(s)
            self.assertEqual(len(select_safely(soup, str(s))), 1)
            uniq.add(str(s))
        self.assertEqual(len(uniq), 2)


class EiGroundingTests(unittest.TestCase):
    def test_single_dialog_open_emits_selector(self) -> None:
        html = """<!DOCTYPE html><html><body><main><p>Enough text content for primary region heuristics.</p></main>
        <dialog open id="privacy-dlg">We use cookies</dialog>
        </body></html>"""
        soup = BeautifulSoup(html, "html.parser")
        payload = analyze_html(html)
        locs = [
            loc
            for d in payload.dimensions
            for iss in d.issues
            if iss.rule_id == "EI-1"
            for loc in iss.locations or []
        ]
        self.assertGreaterEqual(len(locs), 1)
        dom_locations = [loc for loc in locs if loc.get("interrupt_type") != "script"]
        self.assertTrue(dom_locations)
        for loc in dom_locations:
            sel = loc.get("selector")
            self.assertTrue(sel, msg=f"missing grounding selector loc={loc!r}")
            self.assertEqual(len(select_safely(soup, str(sel))), 1)

    def test_script_only_locations_have_empty_selector(self) -> None:
        html = '<!DOCTYPE html><html><body><main><p>x</p></main></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        regions = get_candidate_regions(soup)
        style_hints = extract_style_hints(soup)
        js_hints = extract_js_hints(
            ["fetch(); showModal(window); toastNotification(); consentBanner(); overlayOpen(); cookiePopup(); drawerOpen();\n"],
        )
        issues = interaction_rules.detect_id3_dynamic_interruptions(soup, regions, style_hints, js_hints)
        self.assertEqual(len(issues), 1)
        locs = list(issues[0].locations or [])
        dom_locs = [loc for loc in locs if str(loc.get("interrupt_type")) == "script"]
        self.assertTrue(dom_locs, msg="expected script-only interruption evidence")
        for loc in dom_locs:
            self.assertFalse(loc.get("selector"))

    def test_detect_excessive_interruptions_propagates_selectors_when_unique(self) -> None:
        html = """<!DOCTYPE html><html><body><main><p>Enough text content for primary region heuristics.</p></main>
        <dialog open id="d-propagate">Text</dialog>
        </body></html>"""
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_excessive_interruptions(
            soup,
            get_candidate_regions(soup),
            extract_style_hints(soup),
            extract_js_hints([]),
        )
        self.assertIsNotNone(issue)
        assert issue is not None
        self.assertEqual(issue.rule_id, "EI-1")
        dom = [loc for loc in issue.locations or [] if loc.get("interrupt_type") != "script"]
        self.assertTrue(dom)
        for loc in dom:
            self.assertTrue(loc.get("selector"))
            self.assertEqual(len(select_safely(soup, str(loc.get("selector")))), 1)


class Fixture111NonRegressionTests(unittest.TestCase):
    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture missing")
    def test_full_analysis_still_returns_dimensions(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        payload = analyze_html(html)
        self.assertTrue(payload.dimensions)


if __name__ == "__main__":
    unittest.main()
