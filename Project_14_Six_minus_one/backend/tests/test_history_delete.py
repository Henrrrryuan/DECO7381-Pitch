from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.adapters.persistence.history_store import (
    delete_history_run,
    get_history_run,
    get_latest_visual_complexity_for_run,
    has_history_run,
    init_history_store,
    list_eye_tracking_sessions,
    list_history_runs,
    save_analysis_run,
    save_eye_tracking_session,
    save_visual_complexity_result,
)
from backend.schemas import AnalysisResult, DimensionResult, Issue
from backend.tests.test_visual_complexity_history import _sample_vicram_result


def _load_test_client():
    try:
        from fastapi.testclient import TestClient

        return TestClient
    except (ImportError, RuntimeError):  # pragma: no cover
        return None


class HistoryDeleteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.db_path = Path(self.temp_dir.name) / "test_history.sqlite3"
        init_history_store(self.db_path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _save_run(self, *, source_name: str = "demo.html") -> str:
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
        summary = save_analysis_run(
            analysis,
            "<html><body>test</body></html>",
            source_name,
            self.db_path,
        )
        return summary.run_id

    def _attach_linked_evidence(self, run_id: str) -> None:
        save_visual_complexity_result(run_id, _sample_vicram_result(), db_path=self.db_path)
        save_eye_tracking_session(
            run_id=run_id,
            source_name="demo.html",
            target_url="https://example.com",
            html_snapshot="<html></html>",
            sample_count=12,
            duration_ms=5000,
            coverage_percent=4.5,
            grid_cols=4,
            grid_rows=4,
            cell_counts=[1, 0, 0, 0],
            summary={"attention_summary": []},
            db_path=self.db_path,
        )

    def test_delete_existing_run_returns_true(self) -> None:
        run_id = self._save_run()
        self._attach_linked_evidence(run_id)
        self.assertTrue(delete_history_run(run_id, db_path=self.db_path))

    def test_deleted_run_not_in_list_or_detail(self) -> None:
        run_id = self._save_run()
        self._attach_linked_evidence(run_id)
        self.assertTrue(delete_history_run(run_id, db_path=self.db_path))
        self.assertFalse(has_history_run(run_id, db_path=self.db_path))
        self.assertIsNone(get_history_run(run_id, db_path=self.db_path))
        listed = list_history_runs(limit=10, db_path=self.db_path)
        self.assertEqual(listed.total, 0)

    def test_linked_visual_complexity_removed(self) -> None:
        run_id = self._save_run()
        self._attach_linked_evidence(run_id)
        self.assertTrue(delete_history_run(run_id, db_path=self.db_path))
        self.assertIsNone(get_latest_visual_complexity_for_run(run_id, db_path=self.db_path))

    def test_linked_eye_sessions_removed(self) -> None:
        run_id = self._save_run()
        self._attach_linked_evidence(run_id)
        self.assertTrue(delete_history_run(run_id, db_path=self.db_path))
        eye_list = list_eye_tracking_sessions(limit=10, run_id=run_id, db_path=self.db_path)
        self.assertEqual(eye_list.total, 0)

    def test_delete_missing_run_returns_false(self) -> None:
        self.assertFalse(delete_history_run("missing-run", db_path=self.db_path))

    def test_delete_does_not_remove_other_runs(self) -> None:
        keep_id = self._save_run(source_name="keep.html")
        delete_id = self._save_run(source_name="delete.html")
        self._attach_linked_evidence(delete_id)
        self.assertTrue(delete_history_run(delete_id, db_path=self.db_path))
        self.assertTrue(has_history_run(keep_id, db_path=self.db_path))
        listed = list_history_runs(limit=10, db_path=self.db_path)
        self.assertEqual(listed.total, 1)
        self.assertEqual(listed.items[0].run_id, keep_id)


class HistoryDeleteApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.test_client_cls = _load_test_client()
        if cls.test_client_cls is None:
            raise unittest.SkipTest("fastapi TestClient is not available")

    def test_api_delete_missing_returns_404(self) -> None:
        from unittest.mock import patch

        from backend.app.main import app

        client = self.test_client_cls(app)
        with patch("backend.app.routers.history.delete_history_run", return_value=False):
            response = client.delete("/history/missing-run")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "History run not found.")

    def test_api_delete_success_returns_json(self) -> None:
        from unittest.mock import patch

        from backend.app.main import app

        client = self.test_client_cls(app)
        with patch("backend.app.routers.history.delete_history_run", return_value=True):
            response = client.delete("/history/abc123")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"deleted": True, "run_id": "abc123"})


if __name__ == "__main__":
    unittest.main()
