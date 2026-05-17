from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.adapters.persistence.history_store import (
    get_history_run,
    has_history_run,
    init_history_store,
    list_history_runs,
    save_analysis_run,
    save_visual_complexity_result,
    _vicram_risk_from_vcs,
)
from backend.schemas import AnalysisResult, DimensionResult, Issue


def _sample_vicram_result(*, vcs: float = 5.8) -> dict:
    return {
        "source_type": "url",
        "title": "Example",
        "page": {
            "width": 1280,
            "height": 720,
            "vcs": vcs,
            "word_count": 120,
            "images": 3,
            "tlc": 8,
        },
        "grid": {
            "rows": 2,
            "columns": 2,
            "cells": [
                {"row": 0, "column": 0, "vcs": 4.2, "word_count": 40, "images": 1, "tlc": 2},
                {"row": 0, "column": 1, "vcs": 6.1, "word_count": 30, "images": 0, "tlc": 1},
            ],
        },
        "artifacts": {"overlay_svg_base64": "PHN2Zy8+"},
        "summary_report": "======= Web Page Visual Complexity =======",
        "debug": {"text_rects": 10},
    }


class VisualComplexityHistoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_history.sqlite3"
        init_history_store(self.db_path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _save_run(self) -> str:
        analysis = AnalysisResult(
            dimensions=[
                DimensionResult(
                    dimension="Dense Text Detection",
                    issues=[
                        Issue(
                            rule_id="DT-1",
                            title="Dense text",
                            base_penalty=10,
                            penalty=10,
                            description="desc",
                            suggestion="fix",
                            evidence={},
                            locations=[],
                        )
                    ],
                )
            ]
        )
        summary = save_analysis_run(analysis, "<html><body>test</body></html>", "demo.html", self.db_path)
        return summary.run_id

    def test_risk_mapping(self) -> None:
        self.assertEqual(_vicram_risk_from_vcs(2.5), ("low", "Low visual complexity"))
        self.assertEqual(_vicram_risk_from_vcs(5.0), ("medium", "Moderate visual complexity"))
        self.assertEqual(_vicram_risk_from_vcs(8.0), ("high", "High visual complexity"))

    def test_save_and_list_summary(self) -> None:
        run_id = self._save_run()
        saved = save_visual_complexity_result(run_id, _sample_vicram_result(), db_path=self.db_path)
        self.assertTrue(saved.available)
        self.assertAlmostEqual(saved.vcs or 0, 5.8)
        self.assertEqual(saved.risk_level, "medium")

        listed = list_history_runs(limit=10, db_path=self.db_path)
        self.assertEqual(listed.total, 1)
        item = listed.items[0]
        self.assertTrue(item.visual_complexity_summary.available)
        self.assertEqual(item.visual_complexity_summary.risk_level, "medium")

    def test_detail_includes_overlay(self) -> None:
        run_id = self._save_run()
        save_visual_complexity_result(run_id, _sample_vicram_result(), db_path=self.db_path)
        detail = get_history_run(run_id, db_path=self.db_path)
        self.assertIsNotNone(detail)
        assert detail is not None
        self.assertTrue(detail.visual_complexity_detail.available)
        self.assertEqual(
            detail.visual_complexity_detail.artifacts.get("overlay_svg_base64"),
            "PHN2Zy8+",
        )

    def test_missing_visual_complexity_is_unavailable(self) -> None:
        run_id = self._save_run()
        detail = get_history_run(run_id, db_path=self.db_path)
        self.assertIsNotNone(detail)
        assert detail is not None
        self.assertFalse(detail.visual_complexity_detail.available)
        self.assertFalse(detail.run.visual_complexity_summary.available)

    def test_save_requires_existing_run(self) -> None:
        with self.assertRaises(ValueError):
            save_visual_complexity_result("missing-run", _sample_vicram_result(), db_path=self.db_path)
        self.assertFalse(has_history_run("missing-run", db_path=self.db_path))


if __name__ == "__main__":
    unittest.main()
