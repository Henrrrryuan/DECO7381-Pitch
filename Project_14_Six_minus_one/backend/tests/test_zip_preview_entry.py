from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.app.routers.analysis import _find_preview_entry_file


class ZipPreviewEntryTests(unittest.TestCase):
    def test_prefers_root_index_html(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview_dir = Path(temp_dir)
            root_index = preview_dir / "index.html"
            root_index.write_text("<html></html>", encoding="utf-8")
            (preview_dir / "page.html").write_text("<html></html>", encoding="utf-8")

            self.assertEqual(_find_preview_entry_file(preview_dir), root_index)

    def test_uses_nested_index_htm_before_other_html(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview_dir = Path(temp_dir)
            nested_dir = preview_dir / "site"
            nested_dir.mkdir()
            nested_index = nested_dir / "index.htm"
            nested_index.write_text("<html></html>", encoding="utf-8")
            (preview_dir / "aaa.html").write_text("<html></html>", encoding="utf-8")

            self.assertEqual(_find_preview_entry_file(preview_dir), nested_index)

    def test_falls_back_to_non_index_html(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview_dir = Path(temp_dir)
            site_dir = preview_dir / "DECO7381-Pitch"
            site_dir.mkdir()
            entry_file = site_dir / "111.html"
            entry_file.write_text("<html></html>", encoding="utf-8")

            self.assertEqual(_find_preview_entry_file(preview_dir), entry_file)

    def test_falls_back_to_non_index_htm(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview_dir = Path(temp_dir)
            entry_file = preview_dir / "home.htm"
            entry_file.write_text("<html></html>", encoding="utf-8")

            self.assertEqual(_find_preview_entry_file(preview_dir), entry_file)


if __name__ == "__main__":
    unittest.main()
