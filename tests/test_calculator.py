from typing import List, Optional
from backend.calculator import interpret_score, calculate_recovery_metrics

class TestInterpretScore:
    """
    Tests for interpret_score verifying the harmonized 3-tier operational standard:
    - R(t) >= 0.90 (>= 90%): "Normal Operating Conditions"
    - 0.60 <= R(t) < 0.90 (60%–89%): "Active Restoration"
    - R(t) < 0.60 (< 60%): "Critical Deficit / Blackout"
    - R(t) is None: "No Data / Cloud Masked"
    """

    def test_interpret_score_none(self):
        assert interpret_score(None) == "No Data / Cloud Masked"

    def test_explicit_boundary_tests(self):
        # Explicit boundary tests required by Phase 1: 0.59, 0.60, 0.89, 0.90, and None
        assert interpret_score(0.59) == "Critical Deficit / Blackout"
        assert interpret_score(0.60) == "Active Restoration"
        assert interpret_score(0.89) == "Active Restoration"
        assert interpret_score(0.90) == "Normal Operating Conditions"
        assert interpret_score(None) == "No Data / Cloud Masked"

    def test_legacy_scores_between_0_30_and_0_59_are_critical_deficit(self):
        # Scores between 0.30 and 0.59 previously asserted "Partial Power / Brownouts".
        # Under the harmonized standard, they must now assert "Critical Deficit / Blackout".
        legacy_test_scores = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.58, 0.599]
        for score in legacy_test_scores:
            result = interpret_score(score)
            assert result == "Critical Deficit / Blackout", (
                f"Score {score} expected 'Critical Deficit / Blackout', got '{result}'"
            )
            assert result != "Partial Power / Brownouts"

    def test_near_full_recovery(self):
        assert interpret_score(0.90) == "Normal Operating Conditions"
        assert interpret_score(0.95) == "Normal Operating Conditions"
        assert interpret_score(1.0) == "Normal Operating Conditions"
        assert interpret_score(1.25) == "Normal Operating Conditions"

    def test_active_restoration(self):
        assert interpret_score(0.60) == "Active Restoration"
        assert interpret_score(0.65) == "Active Restoration"
        assert interpret_score(0.75) == "Active Restoration"
        assert interpret_score(0.85) == "Active Restoration"
        assert interpret_score(0.8999) == "Active Restoration"

    def test_critical_deficit_low_scores(self):
        assert interpret_score(0.0) == "Critical Deficit / Blackout"
        assert interpret_score(0.15) == "Critical Deficit / Blackout"
        assert interpret_score(0.29) == "Critical Deficit / Blackout"
        assert interpret_score(-0.05) == "Critical Deficit / Blackout"


class TestCalculateRecoveryMetrics:
    def test_empty_series(self):
        res = calculate_recovery_metrics(10.0, [])
        assert res["status"] == "Error: Empty radiance series provided"

    def test_all_masked_series(self):
        res = calculate_recovery_metrics(10.0, [None, None])
        assert res["status"] == "Error: All days in series are masked (cloud cover)"

    def test_metrics_calculation(self):
        series: List[Optional[float]] = [2.0, 5.0, 8.0, 10.0]
        res = calculate_recovery_metrics(10.0, series)
        assert res["baseline_radiance"] == 10.0
        assert res["minimum_radiance"] == 2.0
        assert res["latest_radiance"] == 10.0
        assert res["recovery_percentage"] == 100.0
        assert res["recovery_time_days"] == 3
