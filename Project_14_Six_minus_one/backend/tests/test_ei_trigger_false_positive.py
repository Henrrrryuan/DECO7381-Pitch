from __future__ import annotations

import unittest

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.excessive_interruptions import detect_excessive_interruptions
from backend.analyzers.analysis_selectors.interaction_helpers import (
    _looks_like_modal_trigger,
    describe_interruption_candidate,
    extract_js_hints,
    extract_style_hints,
    is_overlay_like,
    looks_like_interruption_candidate,
)


def _primary_region(soup: BeautifulSoup):
    return soup.find("main") or soup.body


class EiModalTriggerTests(unittest.TestCase):
    def test_ref_modal_trigger_links_are_not_interruption_candidates(self) -> None:
        html = """
        <html><body>
        <main><h1>Page</h1><p>Content</p></main>
        <a class="ref-modal-trigger" href="#">View details</a>
        <a class="card-link ref-modal-trigger" href="#">Learn more</a>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        style_hints = extract_style_hints(soup)
        primary = _primary_region(soup)
        for tag in soup.select("a.ref-modal-trigger"):
            self.assertTrue(_looks_like_modal_trigger(tag))
            self.assertFalse(looks_like_interruption_candidate(tag, style_hints))
            self.assertFalse(is_overlay_like(tag))
            self.assertIsNone(describe_interruption_candidate(tag, primary, style_hints))

    def test_open_dialog_still_detected(self) -> None:
        html = """
        <html><body>
        <main><h1>Page</h1></main>
        <dialog open class="cookie-consent" id="consent-banner">
          <p>We use cookies.</p>
        </dialog>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        style_hints = extract_style_hints(soup)
        candidate_regions = [soup.find("main")]
        issue = detect_excessive_interruptions(
            soup, candidate_regions, style_hints, extract_js_hints([])
        )
        self.assertIsNotNone(issue)
        self.assertEqual(issue.rule_id, "EI-1")
        self.assertGreater(len(issue.locations), 0)

    def test_modal_triggers_do_not_fire_ei_on_fixture_page(self) -> None:
        html = """
        <html><body>
        <main><h1>Demo</h1></main>
        <a class="ref-modal-trigger" href="#">Open</a>
        <a class="card-link ref-modal-trigger" href="#">Show</a>
        <div id="ref-modal" class="ref-modal" hidden aria-hidden="true">
          <h2 id="ref-modal-title"></h2>
        </div>
        </body></html>
        """
        soup = BeautifulSoup(html, "html.parser")
        issue = detect_excessive_interruptions(
            soup,
            [soup.find("main")],
            extract_style_hints(soup),
            extract_js_hints([]),
        )
        self.assertIsNone(issue)


if __name__ == "__main__":
    unittest.main()
