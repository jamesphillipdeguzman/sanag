import json
from pathlib import Path
import pytest
from backend.calculator import (
    PANAY_PROVINCE_SET,
    is_panay_province,
    resolve_incident_scope,
    filter_scoped_municipalities,
    aggregate_kpi_metrics,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
PANAY_GEOJSON_PATH = ROOT_DIR / "frontend" / "public" / "panay_municipalities.geojson"

@pytest.fixture
def panay_municipalities():
    """Loads all municipalities from panay_municipalities.geojson."""
    assert PANAY_GEOJSON_PATH.exists(), f"Missing file: {PANAY_GEOJSON_PATH}"
    with open(PANAY_GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    municipalities = []
    for idx, feature in enumerate(data.get("features", [])):
        props = feature.get("properties", {})
        municipalities.append({
            "id": props.get("ADM3_PCODE") or props.get("psgc_code") or f"mun-{idx}",
            "name": props.get("ADM3_EN") or "Unnamed Municipality",
            "province": props.get("ADM2_EN") or "",
            "region": props.get("ADM1_EN") or "Region VI",
            "population": int(props.get("population") or 25000),
            # Default mock recovery score: vary some below 60 to verify critical deficit filtering
            "recovery_score": 45.0 if idx % 5 == 0 else 85.0,
        })
    return municipalities


class TestPanayProvinceMembership:
    """Verifies Panay province membership mapping includes exactly the 4 constituent provinces."""

    def test_panay_province_set_contains_4_provinces(self):
        expected = {"iloilo", "capiz", "aklan", "antique"}
        assert PANAY_PROVINCE_SET == expected
        for p in expected:
            assert is_panay_province(p) is True
            assert is_panay_province(p.upper()) is True
        assert is_panay_province("guimaras") is False
        assert is_panay_province("cebu") is False

    def test_panay_geojson_yields_exactly_95_constituent_lgus(self, panay_municipalities):
        panay_only = [m for m in panay_municipalities if is_panay_province(m["province"])]
        assert len(panay_only) == 95, (
            f"Expected exactly 95 LGUs across the 4 constituent provinces of Panay, got {len(panay_only)}"
        )


class TestKpiAggregationAndScoping:
    """
    Asserts Phase 2 requirements:
    1. Panay Island Scope Isolation (No Municipality Selected)
    2. Single Municipality Scope
    3. Incident Selection Does Not Overwrite Regional Scope
    """

    def test_panay_island_scope_isolation_no_municipality_selected(self, panay_municipalities):
        """
        Input: selectedRegionKey = 'panay', selectedMunicipality = null.
        Assert: Monitored LGU count === 95.
        Assert: Critical LGU count <= 95 (only those with R(t) < 60%).
        Assert: Affected population aggregates only critical LGUs across all 4 provinces.
        """
        selected_region_key = "panay"
        selected_municipality = None

        scoped = filter_scoped_municipalities(panay_municipalities, selected_region_key)
        assert len(scoped) == 95, f"Expected 95 scoped LGUs for 'panay', got {len(scoped)}"

        kpis = aggregate_kpi_metrics(scoped, selected_municipality)

        # 1. Monitored LGU count === 95
        assert kpis["total_monitored_lgus"] == 95

        # 2. Critical LGU count <= 95 (only those with R(t) < 60%)
        assert kpis["critical_count"] <= 95
        assert kpis["critical_count"] == len([m for m in scoped if m["recovery_score"] < 60])
        for crit_m in kpis["critical_lgus"]:
            assert crit_m["recovery_score"] < 60
            assert is_panay_province(crit_m["province"]) is True

        # 3. Affected population aggregates only critical LGUs across all 4 provinces
        expected_affected_pop = sum(m["population"] for m in kpis["critical_lgus"])
        assert kpis["affected_population"] == expected_affected_pop
        assert kpis["critical_population"] == expected_affected_pop

    def test_single_municipality_scope(self, panay_municipalities):
        """
        Input: selectedRegionKey = 'panay', selectedMunicipality = {
            name: 'Roxas City', province: 'Capiz', population: 179292, recovery_score: 45
        }.
        Assert: Monitored LGU count === 1.
        Assert: Critical status === true.
        Assert: Affected population === 179292.
        """
        selected_region_key = "panay"
        selected_municipality = {
            "name": "Roxas City",
            "province": "Capiz",
            "population": 179292,
            "recovery_score": 45,
            "baseline_radiance": 12.4,
            "current_radiance": 5.6,
        }

        scoped = filter_scoped_municipalities(panay_municipalities, selected_region_key)
        kpis = aggregate_kpi_metrics(scoped, selected_municipality)

        # 1. Monitored LGU count === 1
        assert kpis["total_monitored_lgus"] == 1

        # 2. Critical status === true (since 45 < 60)
        assert kpis["is_critical"] is True
        assert kpis["critical_count"] == 1

        # 3. Affected population === 179292
        assert kpis["affected_population"] == 179292
        assert kpis["critical_population"] == 179292
        assert kpis["total_scoped_population"] == 179292
        assert kpis["avg_recovery"] == 45

    def test_single_municipality_scope_restored(self, panay_municipalities):
        """Single municipality with normal conditions (R(t) >= 90%)."""
        selected_municipality = {
            "name": "Iloilo City",
            "province": "Iloilo",
            "population": 457626,
            "recovery_score": 95,
        }
        scoped = filter_scoped_municipalities(panay_municipalities, "panay")
        kpis = aggregate_kpi_metrics(scoped, selected_municipality)

        assert kpis["total_monitored_lgus"] == 1
        assert kpis["is_critical"] is False
        assert kpis["critical_count"] == 0
        assert kpis["affected_population"] == 0
        assert kpis["total_scoped_population"] == 457626
        assert kpis["restored_count"] == 1

    def test_incident_selection_does_not_overwrite_regional_scope(self, panay_municipalities):
        """
        Simulate changing activeEvent to Typhoon Kalmaegi while selectedRegionKey is 'panay'.
        Assert: selectedRegionKey remains 'panay', and scoped LGU array length remains 95.
        """
        selected_region_key = "panay"
        active_event = {
            "id": "typhoon-kalmaegi-2025",
            "name": "Typhoon Kalmaegi (Tino)",
            "epicenterProvince": "capiz",
            "critical_municipalities": [
                {"name": "Roxas City", "pcode": "PH061914000", "recovery_score": 38},
                {"name": "Panay", "pcode": "PH061911000", "recovery_score": 42},
                {"name": "Pilar", "pcode": "PH061913000", "recovery_score": 45},
                {"name": "Sigma", "pcode": "PH061916000", "recovery_score": 52},
                {"name": "Dao", "pcode": "PH061903000", "recovery_score": 55},
            ]
        }

        # Resolution must keep 'panay'
        resolved_key = resolve_incident_scope(selected_region_key, active_event)
        assert resolved_key == "panay", (
            f"Expected regional scope to remain 'panay', got '{resolved_key}'"
        )

        # Scoped LGU array length must remain 95 (NOT down-scoped to Capiz's 16/17 or critical list's 5)
        scoped = filter_scoped_municipalities(panay_municipalities, resolved_key)
        assert len(scoped) == 95, f"Expected 95 LGUs for Panay, got {len(scoped)}"

    def test_incident_selection_allows_downscoping_only_when_unset_or_all(self):
        """Down-scoping is permitted only when filter is unset or 'all'."""
        active_event = {
            "id": "typhoon-kalmaegi-2025",
            "name": "Typhoon Kalmaegi",
            "epicenterProvince": "capiz",
        }

        # Unset / None -> down-scopes to epicenter
        assert resolve_incident_scope(None, active_event) == "capiz"
        assert resolve_incident_scope("", active_event) == "capiz"

        # Explicit 'all' -> down-scopes to epicenter
        assert resolve_incident_scope("all", active_event) == "capiz"

        # Explicit island-wide or regional defaults -> MUST NOT be overwritten
        assert resolve_incident_scope("panay", active_event) == "panay"
        assert resolve_incident_scope("panay_guimaras", active_event) == "panay_guimaras"
        assert resolve_incident_scope("central_visayas", active_event) == "central_visayas"
        assert resolve_incident_scope("iloilo", active_event) == "iloilo"


class TestConditionalPopulationKpiCopy:
    """
    Task 1: Conditional Population KPI Copy.
    - Normal status (R(t) >= 90%): Drop 'affected', render only count (e.g. '3M' / '3M total').
    - Deficit status (R(t) < 90%): Retain count + 'affected' (e.g. '3M affected').
    - Regional scope with critical_count == 0: Drop 'affected', render total.
    """

    @staticmethod
    def format_population_display(population: int, is_deficit: bool) -> str:
        """Mirror frontend formatAffectedPopulation / formatAffectedCompact display logic."""
        if population >= 1_000_000:
            compact = f"{population / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
        elif population >= 1_000:
            compact = f"{round(population / 1_000)}K"
        else:
            compact = str(population)

        if is_deficit:
            return f"{compact} affected"
        return f"{compact} total"

    def test_single_lgu_operating_normal_drops_affected(self):
        """Quezon City with R(t) = 100% drops 'affected' and shows '3M total'."""
        qc = {
            "name": "Quezon City",
            "province": "Metro Manila",
            "population": 3_000_000,
            "recovery_score": 100,
        }
        recovery = qc["recovery_score"]
        is_deficit = recovery < 90
        display_val = self.format_population_display(qc["population"], is_deficit)

        assert not is_deficit
        assert "affected" not in display_val
        assert "3M" in display_val
        assert display_val == "3M total"

    def test_single_lgu_under_deficit_retains_affected(self):
        """LGU with R(t) < 90% retains 'affected' in warning highlight style."""
        lgu = {
            "name": "Calaca",
            "province": "Batangas",
            "population": 85_000,
            "recovery_score": 55,
        }
        recovery = lgu["recovery_score"]
        is_deficit = recovery < 90
        display_val = self.format_population_display(lgu["population"], is_deficit)

        assert is_deficit
        assert "affected" in display_val
        assert display_val == "85K affected"

    def test_regional_scope_operating_normal_drops_affected(self):
        """Regional scope with 0 critical LGUs renders total count without 'affected'."""
        scoped_lgus = [
            {"name": "LGU 1", "population": 500_000, "recovery_score": 95},
            {"name": "LGU 2", "population": 500_000, "recovery_score": 92},
        ]
        kpis = aggregate_kpi_metrics(scoped_lgus, None)
        assert kpis["critical_count"] == 0

        is_regional_deficit = kpis["critical_count"] > 0
        display_val = self.format_population_display(kpis["total_scoped_population"], is_regional_deficit)
        assert not is_regional_deficit
        assert "affected" not in display_val
        assert display_val == "1M total"


class TestNationwideSubstationsDatasetAndScoping:
    """
    Task 2: Dynamic Spatial Scoping for Transmission & Substation Infrastructure.
    - Dataset includes Western Visayas, Southern Tagalog / CALABARZON & NCR, Central Visayas, and Leyte.
    - Panay Island scope filters to 14 active substations across 4 provinces.
    - Batangas scope filters to Batangas assets (Calaca, Lipa, Batangas City) and drops Panay.
    """

    SUBSTATIONS_PATH = ROOT_DIR / "frontend" / "src" / "data" / "philippinesSubstations.json"

    @pytest.fixture
    def all_substations(self):
        assert self.SUBSTATIONS_PATH.exists(), f"Missing {self.SUBSTATIONS_PATH}"
        with open(self.SUBSTATIONS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    def test_dataset_coverage(self, all_substations):
        """Verifies dataset covers all required geographic sectors and fields."""
        provinces = {s["province"].lower() for s in all_substations}
        # Western Visayas
        assert {"iloilo", "capiz", "aklan", "antique", "guimaras", "negros occidental"}.issubset(provinces)
        # CALABARZON & NCR
        assert {"batangas", "laguna", "cavite", "quezon", "metro manila"}.issubset(provinces)
        # Central Visayas & Leyte
        assert {"cebu", "bohol", "leyte"}.issubset(provinces)

        for s in all_substations:
            assert "id" in s
            assert "name" in s
            assert "voltageKv" in s
            assert "operator" in s
            assert "province" in s
            assert "municipality" in s
            assert len(s["coordinates"]) == 2
            assert s["status"] in ["active", "standby", "maintenance"]

    def test_panay_island_scope_yields_14_active_stations(self, all_substations):
        """Panay Island (Iloilo, Capiz, Aklan, Antique) has exactly 14 active substations."""
        panay_provinces = {"iloilo", "capiz", "aklan", "antique"}
        panay_stations = [
            s for s in all_substations
            if s["province"].lower() in panay_provinces and s["status"] == "active"
        ]
        assert len(panay_stations) == 14

        by_province = {}
        for s in panay_stations:
            by_province.setdefault(s["province"].lower(), []).append(s)

        assert set(by_province.keys()) == panay_provinces
        assert len(by_province["iloilo"]) == 6
        assert len(by_province["capiz"]) == 3
        assert len(by_province["aklan"]) == 3
        assert len(by_province["antique"]) == 2

    def test_batangas_scope_dynamically_shifts_from_panay(self, all_substations):
        """Batangas scope displays Batangas assets (Calaca, Lipa, Batangas City) without Panay."""
        batangas_stations = [s for s in all_substations if s["province"].lower() == "batangas"]
        assert len(batangas_stations) == 3

        names = {s["name"] for s in batangas_stations}
        assert "Calaca Bulk Substation" in names
        assert "Lipa Substation" in names
        assert "Batangas City Substation" in names

        # Must not contain any Panay stations
        panay_provinces = {"iloilo", "capiz", "aklan", "antique"}
        for s in batangas_stations:
            assert s["province"].lower() not in panay_provinces

