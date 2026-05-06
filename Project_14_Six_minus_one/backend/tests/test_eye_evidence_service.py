from __future__ import annotations

import unittest

from backend.services.eye_evidence_service import (
    calculate_element_hit_risk,
    calculate_eye_evidence_for_session,
)


def _summary(
    *items: dict[str, object],
    availability: dict[str, bool] | None = None,
) -> dict[str, object]:
    summary: dict[str, object] = {"attention_summary": list(items)}
    if availability is not None:
        summary["attention_group_availability"] = {
            key: {"available": available, "element_count": 1 if available else 0}
            for key, available in availability.items()
        }
    return summary


def _item(key: str, risk_level: str, **extra: object) -> dict[str, object]:
    return {
        "key": key,
        "label": key,
        "hit_count": 10,
        "risk_level": risk_level,
        **extra,
    }


def _share_item(key: str, share: float, weighted_share: float) -> dict[str, object]:
    return {
        "key": key,
        "label": key,
        "hit_count": 10,
        "near_hit_count": 4,
        "weighted_hit_score": 7,
        "share": share,
        "weighted_share": weighted_share,
    }


def _interactive_item(
    weighted_share: float,
    *,
    hit_count: int = 10,
    exact_hit_count: int = 0,
    near_hit_count: int = 0,
    weighted_hit_score: float = 0,
    first_fixation_ms: int | None = None,
) -> dict[str, object]:
    return {
        "key": "interactive",
        "label": "interactive",
        "hit_count": hit_count,
        "exact_hit_count": exact_hit_count,
        "near_hit_count": near_hit_count,
        "weighted_hit_score": weighted_hit_score,
        "weighted_share": weighted_share,
        "first_fixation_ms": first_fixation_ms,
    }


def _session(
    *,
    cell_counts: list[int],
    summary: dict[str, object],
    sample_count: int = 600,
    duration_ms: int = 60_000,
) -> dict[str, object]:
    return {
        "sample_count": sample_count,
        "duration_ms": duration_ms,
        "cell_counts": cell_counts,
        "summary": summary,
    }


class EyeEvidenceServiceTest(unittest.TestCase):
    def test_all_low_with_balanced_entropy_and_normal_duration_is_low(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[80, 20, 0, 0],
                summary=_summary(
                    _item("headings", "low"),
                    _item("interactive", "low"),
                    _item("main_text", "low"),
                    _item("media", "low"),
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["risk_level"], "low")
        self.assertLess(result["overall_eye_evidence_risk"], 50)
        self.assertEqual(result["attention_distribution_label"], "balanced")

    def test_one_medium_element_risk_still_stays_low(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[80, 20, 0, 0],
                summary=_summary(
                    _item("headings", "low"),
                    _item("interactive", "medium"),
                    _item("main_text", "low"),
                    _item("media", "low"),
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["risk_level"], "low")
        self.assertEqual(result["risk_gate"]["medium_driver_count"], 1)

    def test_two_medium_element_risks_become_medium(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[80, 20, 0, 0],
                summary=_summary(
                    _item("headings", "medium"),
                    _item("interactive", "medium"),
                    _item("main_text", "low"),
                    _item("media", "low"),
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["risk_level"], "medium")
        self.assertEqual(result["overall_eye_evidence_risk"], 50)

    def test_one_high_interactive_risk_is_medium_without_supporting_concern(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[80, 20, 0, 0],
                summary=_summary(
                    _item("headings", "low"),
                    _item("interactive", "high"),
                    _item("main_text", "low"),
                    _item("media", "low"),
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["risk_level"], "medium")
        self.assertFalse(result["risk_gate"]["high_supported"])

    def test_scattered_entropy_with_covered_key_elements_is_not_automatically_high(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[10, 10, 10, 10],
                summary=_summary(
                    _item("headings", "low"),
                    _item("interactive", "low"),
                    _item("main_text", "low"),
                    _item("media", "low"),
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["attention_distribution_label"], "scattered_attention")
        self.assertEqual(result["risk_level"], "low")

    def test_reliability_changes_confidence_not_risk_index(self) -> None:
        base = _session(
            cell_counts=[80, 20, 0, 0],
            summary=_summary(
                _item("headings", "low"),
                _item("interactive", "medium"),
                _item("main_text", "low"),
                _item("media", "low"),
            ),
            duration_ms=60_000,
        )
        high_reliability = calculate_eye_evidence_for_session({**base, "sample_count": 600})
        low_reliability = calculate_eye_evidence_for_session({**base, "sample_count": 10})

        self.assertIsNotNone(high_reliability)
        self.assertIsNotNone(low_reliability)
        assert high_reliability is not None
        assert low_reliability is not None
        self.assertEqual(
            high_reliability["overall_eye_evidence_risk"],
            low_reliability["overall_eye_evidence_risk"],
        )
        self.assertEqual(high_reliability["confidence"], "high")
        self.assertEqual(low_reliability["confidence"], "low")

    def test_missing_media_group_does_not_default_to_medium(self) -> None:
        first = calculate_element_hit_risk(
            _summary(
                _item("headings", "low"),
                _item("interactive", "low"),
                _item("main_text", "low"),
            )
        )
        second = calculate_element_hit_risk(
            _summary(
                _item("headings", "low"),
                _item("interactive", "low"),
                _item("main_text", "low"),
            )
        )

        self.assertEqual(first, second)
        self.assertEqual(first["element_risks"]["media"]["risk_level"], "unknown")
        self.assertTrue(first["element_risks"]["media"]["missing"])
        self.assertEqual(first["element_hit_risk"], 15)

    def test_weighted_near_hits_reduce_false_interactive_and_heading_risk(self) -> None:
        result = calculate_element_hit_risk(
            _summary(
                _share_item("interactive", share=0.03, weighted_share=0.13),
                _share_item("headings", share=0.03, weighted_share=0.12),
                _item("main_text", "low"),
            )
        )

        self.assertEqual(result["element_risks"]["interactive"]["risk_level"], "low")
        self.assertEqual(result["element_risks"]["headings"]["risk_level"], "low")
        self.assertEqual(result["element_hit_risk"], 15)

    def test_normal_scan_without_media_remains_low(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[80, 20, 0, 0],
                summary=_summary(
                    _share_item("headings", share=0.08, weighted_share=0.12),
                    _share_item("main_text", share=0.48, weighted_share=0.48),
                    _share_item("interactive", share=0.09, weighted_share=0.14),
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["risk_level"], "low")
        self.assertEqual(result["element_risks"]["media"]["risk_level"], "unknown")

    def test_exact_button_hit_counts_as_interactive_full_weight(self) -> None:
        result = calculate_element_hit_risk(
            _summary(
                _interactive_item(
                    0.10,
                    hit_count=1,
                    exact_hit_count=1,
                    near_hit_count=0,
                    weighted_hit_score=1,
                ),
                availability={"interactive": True},
            ),
            duration_ms=30_000,
        )

        interactive = result["element_risks"]["interactive"]
        self.assertEqual(interactive["risk_level"], "low")
        self.assertEqual(interactive["exact_hit_count"], 1)
        self.assertEqual(interactive["near_hit_count"], 0)
        self.assertEqual(interactive["weighted_hit_score"], 1)

    def test_near_button_hit_counts_as_partial_weight_without_high_risk(self) -> None:
        result = calculate_element_hit_risk(
            _summary(
                _interactive_item(
                    0.05,
                    hit_count=1,
                    exact_hit_count=0,
                    near_hit_count=1,
                    weighted_hit_score=0.5,
                    first_fixation_ms=12_000,
                ),
                availability={"interactive": True},
            ),
            duration_ms=60_000,
        )

        interactive = result["element_risks"]["interactive"]
        self.assertEqual(interactive["risk_level"], "medium")
        self.assertEqual(interactive["near_hit_count"], 1)
        self.assertEqual(interactive["weighted_hit_score"], 0.5)

    def test_interactive_borderline_values_keep_same_severity(self) -> None:
        lower = calculate_element_hit_risk(
            _summary(
                _interactive_item(0.049, hit_count=8, exact_hit_count=4, weighted_hit_score=4),
                availability={"interactive": True},
            ),
            duration_ms=60_000,
        )
        upper = calculate_element_hit_risk(
            _summary(
                _interactive_item(0.051, hit_count=8, exact_hit_count=4, weighted_hit_score=4),
                availability={"interactive": True},
            ),
            duration_ms=60_000,
        )

        self.assertEqual(
            lower["element_risks"]["interactive"]["risk_level"],
            upper["element_risks"]["interactive"]["risk_level"],
        )
        self.assertEqual(lower["element_risks"]["interactive"]["risk_level"], "medium")

    def test_single_medium_interactive_share_does_not_force_overall_medium(self) -> None:
        result = calculate_eye_evidence_for_session(
            _session(
                cell_counts=[80, 20, 0, 0],
                summary=_summary(
                    _share_item("headings", share=0.12, weighted_share=0.12),
                    _interactive_item(0.05, hit_count=8, exact_hit_count=4, weighted_hit_score=4),
                    _share_item("main_text", share=0.45, weighted_share=0.45),
                    availability={"headings": True, "interactive": True, "main_text": True},
                ),
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["element_risks"]["interactive"]["risk_level"], "medium")
        self.assertEqual(result["risk_level"], "low")

    def test_interactive_high_requires_duration_and_delayed_or_missing_cta_attention(self) -> None:
        high = calculate_element_hit_risk(
            _summary(
                _interactive_item(
                    0.01,
                    hit_count=0,
                    exact_hit_count=0,
                    near_hit_count=0,
                    weighted_hit_score=0,
                    first_fixation_ms=25_000,
                ),
                availability={"interactive": True},
            ),
            duration_ms=30_000,
        )
        short = calculate_element_hit_risk(
            _summary(
                _interactive_item(
                    0.01,
                    hit_count=0,
                    exact_hit_count=0,
                    near_hit_count=0,
                    weighted_hit_score=0,
                    first_fixation_ms=25_000,
                ),
                availability={"interactive": True},
            ),
            duration_ms=15_000,
        )

        self.assertEqual(high["element_risks"]["interactive"]["risk_level"], "high")
        self.assertEqual(short["element_risks"]["interactive"]["risk_level"], "medium")

    def test_no_interactive_elements_are_unknown_and_excluded(self) -> None:
        result = calculate_element_hit_risk(
            _summary(
                _share_item("headings", share=0.12, weighted_share=0.12),
                _share_item("main_text", share=0.45, weighted_share=0.45),
                availability={
                    "headings": True,
                    "interactive": False,
                    "main_text": True,
                    "media": False,
                },
            )
        )

        self.assertEqual(result["element_risks"]["interactive"]["risk_level"], "unknown")
        self.assertTrue(result["element_risks"]["interactive"]["missing"])
        self.assertEqual(result["element_risks"]["media"]["risk_level"], "unknown")
        self.assertEqual(result["element_hit_risk"], 15)


if __name__ == "__main__":
    unittest.main()
