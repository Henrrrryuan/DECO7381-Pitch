from __future__ import annotations

from io import BytesIO
import unittest
from zipfile import ZipFile

from backend.adapters.input.zip_input import extract_web_bundle_from_zip_bytes


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


class ZipInputTests(unittest.TestCase):
    def test_extracts_non_index_html_from_mixed_case_folder(self) -> None:
        payload = _zip_bytes(
            {
                "DECO7381-Pitch/111.html": "<html><head><link rel='stylesheet' href='styles.css'></head><body></body></html>",
                "DECO7381-Pitch/styles.css": "body { color: red; }",
            }
        )

        bundle = extract_web_bundle_from_zip_bytes(payload)

        self.assertEqual(bundle.entry_name, "DECO7381-Pitch/111.html")
        self.assertIn("body { color: red; }", bundle.inlined_html)
        self.assertIn("DECO7381-Pitch/styles.css", bundle.css_files)


if __name__ == "__main__":
    unittest.main()
