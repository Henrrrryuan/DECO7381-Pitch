from __future__ import annotations

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from backend.analyzers.analysis_selectors.dense_text_detection import detect_dense_text
from backend.analyzers.analysis_selectors.shared import visible_text
from backend.analyzers.analysis_selectors.text_utils import split_sentences

_FIXTURE_111 = (
    Path(__file__).resolve().parents[2].parent
    / "Cognitive Accessibility Assistant for Web Content"
    / "111.html"
)


class DtSentenceSplitTests(unittest.TestCase):
    def test_fixture_a_wcag_version_numbers_do_not_over_split(self) -> None:
        text = "WCAG 2.2.2 Pause, Stop, Hide · WCAG 2.3.1 Three Flashes"
        sentences = split_sentences(text)
        self.assertLessEqual(len(sentences), 2)
        self.assertIn("2.2.2", sentences[0])
        self.assertIn("2.3.1", sentences[-1])

    def test_fixture_b_iso_and_wcag_reference_line(self) -> None:
        text = "ISO 9241-11 Usability standard · WCAG 3.1.5 Reading Level"
        sentences = split_sentences(text)
        self.assertLessEqual(len(sentences), 2)

    def test_fixture_c_two_real_sentences(self) -> None:
        text = "One sentence. Second sentence."
        self.assertEqual(len(split_sentences(text)), 2)

    def test_fixture_d_five_real_sentences(self) -> None:
        text = (
            "Sentence one. Sentence two. Sentence three. "
            "Sentence four. Sentence five."
        )
        self.assertEqual(len(split_sentences(text)), 5)

    @unittest.skipUnless(_FIXTURE_111.is_file(), "111.html fixture not present")
    def test_111_html_dt_issue_removed_after_numeric_masking(self) -> None:
        html = _FIXTURE_111.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")

        previously_triggered: list[tuple[str, int, int]] = []
        for tag in soup.select("p.standard-value, p.insight-standard"):
            text = visible_text(tag)
            sentence_count = len(split_sentences(text))
            word_count = len(text.split())  # informational only
            if sentence_count > 4:
                previously_triggered.append((text[:80], word_count, sentence_count))

        issue = detect_dense_text(soup)
        self.assertIsNone(
            issue,
            msg=(
                "DT-1 should not trigger on 111.html after dotted-number masking; "
                f"previously hot blocks={previously_triggered!r}"
            ),
        )

        for tag in soup.select("p.standard-value"):
            self.assertLessEqual(
                len(split_sentences(visible_text(tag))),
                4,
                msg=f"standard-value still over-split: {visible_text(tag)!r}",
            )


if __name__ == "__main__":
    unittest.main()
