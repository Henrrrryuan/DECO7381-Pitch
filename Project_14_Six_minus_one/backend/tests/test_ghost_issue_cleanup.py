from __future__ import annotations

import unittest

from backend.analyzers.location_utils import (
    _drop_post_sanitize_ghost_issues,
    _issue_can_survive_without_locations,
    _issue_should_remain_after_sanitize,
    _location_is_intentional_structural_finding,
    sanitize_analysis_locations,
)
from backend.schemas import AnalysisResult, DimensionResult, Issue


class GhostIssueCleanupTests(unittest.TestCase):
    def test_structural_location_helpers(self) -> None:
        structural = {
            "documentStructuralFinding": True,
            "highlightable": False,
            "tag": "document",
            "selector": "",
        }
        self.assertTrue(_location_is_intentional_structural_finding(structural))
        self.assertFalse(_location_is_intentional_structural_finding({"tag": "p", "selector": "p"}))

    def test_issue_survives_with_structural_evidence_only(self) -> None:
        issue = Issue(
            rule_id="PHS-1",
            title="Poor Heading Structure",
            base_penalty=3,
            penalty=3,
            description="",
            suggestion="",
            evidence={"documentStructuralFinding": True},
            locations=[],
        )
        self.assertTrue(_issue_can_survive_without_locations(issue))
        self.assertTrue(_issue_should_remain_after_sanitize(issue))

    def test_empty_locations_issue_dropped(self) -> None:
        ghost = Issue(
            rule_id="VO-1",
            title="Visual Overload",
            base_penalty=3,
            penalty=3,
            description="",
            suggestion="",
            evidence={"overload_count": 3},
            locations=[],
        )
        kept = Issue(
            rule_id="DT-1",
            title="Dense Text",
            base_penalty=3,
            penalty=3,
            description="",
            suggestion="",
            evidence={},
            locations=[{"selector": "p", "tag": "p", "text": "sample"}],
        )
        result = _drop_post_sanitize_ghost_issues([ghost, kept])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].rule_id, "DT-1")

    def test_sanitize_analysis_locations_drops_post_sanitize_ghosts(self) -> None:
        html = "<html><body><p id='hidden' hidden>Secret</p></body></html>"
        ghost_issue = Issue(
            rule_id="LC-1",
            title="Language Complexity",
            base_penalty=3,
            penalty=3,
            description="",
            suggestion="",
            evidence={"complex_word_ratio": 0.9},
            locations=[
                {
                    "selector": "#hidden",
                    "tag": "p",
                    "text": "Secret",
                    "preview": "Secret",
                }
            ],
        )
        analysis = AnalysisResult(
            dimensions=[
                DimensionResult(dimension="Language Complexity", issues=[ghost_issue]),
            ]
        )
        sanitize_analysis_locations(analysis, html)
        self.assertEqual(analysis.dimensions[0].issues, [])


if __name__ == "__main__":
    unittest.main()
