from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db_connection, get_event_profile, seed_historical_event_profiles
from backend.executive_summary import (
    generate_fallback_briefing,
    generate_recovery_briefing,
    _parse_event_context,
)


def setup_module():
    """Ensure database schema and profiles are seeded before tests run."""
    conn = get_db_connection()
    seed_historical_event_profiles(conn)
    conn.close()


class TestEventContextSchemaAndSeeding:
    def test_database_has_seeded_profiles(self):
        conn = get_db_connection()
        cursor = conn.cursor()

        # Event 1: typhoon-kalmaegi-2025
        cursor.execute(
            """
            SELECT event_type, disaster_category, root_cause_summary, infrastructure_impact
            FROM events WHERE id = 'typhoon-kalmaegi-2025'
            """
        )
        kalmaegi = cursor.fetchone()
        assert kalmaegi is not None
        assert kalmaegi["event_type"] == "Tropical Cyclone"
        assert kalmaegi["disaster_category"] == "Category 3 Landfall"
        assert "185 km/h" in kalmaegi["root_cause_summary"]
        assert "hardware replacement" in kalmaegi["infrastructure_impact"]

        # Event 2: panay-grid-collapse-2024
        cursor.execute(
            """
            SELECT event_type, disaster_category, root_cause_summary, infrastructure_impact
            FROM events WHERE id = 'panay-grid-collapse-2024'
            """
        )
        panay = cursor.fetchone()
        assert panay is not None
        assert panay["event_type"] == "Grid Disturbance / Frequency Trip"
        assert panay["disaster_category"] == "Cascading System Separation"
        assert "PEDC and PCPC" in panay["root_cause_summary"]
        assert "V-shaped recovery curve" in panay["infrastructure_impact"]

        # Event 3: typhoon-odette-2021
        cursor.execute(
            """
            SELECT event_type, disaster_category, root_cause_summary, infrastructure_impact
            FROM events WHERE id = 'typhoon-odette-2021'
            """
        )
        odette = cursor.fetchone()
        assert odette is not None
        assert odette["event_type"] == "Super Typhoon"
        assert odette["disaster_category"] == "Category 5 Landfall"
        assert "transmission tower toppling" in odette["root_cause_summary"]
        assert "temporary bypass towers" in odette["infrastructure_impact"]

        conn.close()

    def test_get_event_profile_helper(self):
        prof = get_event_profile("typhoon-kalmaegi-2025")
        assert prof is not None
        assert prof["event_type"] == "Tropical Cyclone"

        grid_prof = get_event_profile("panay-grid-collapse-2024")
        assert grid_prof is not None
        assert "Frequency Trip" in grid_prof["event_type"]


class TestExecutiveSummaryRootCauseIntegration:
    def test_parse_event_context_extracts_root_cause(self):
        sample_context = """
Disaster Incident: Typhoon Kalmaegi (2025-11-03)
Classification: Tropical Cyclone (Category 3 Landfall)
Primary Driver: High sustained winds exceeding 185 km/h and fallen distribution poles.
Physical Grid Impact: Heavy on-the-ground hardware replacement required.
Total Municipalities Monitored: 95
Average Recovery Score: 78%
Municipalities >= 90% Restored: 30
Municipalities in Critical/Warning State (<60%): 12
"""
        data = _parse_event_context(sample_context)
        assert data["event_type"] == "Tropical Cyclone"
        assert data["disaster_category"] == "Category 3 Landfall"
        assert "185 km/h" in data["root_cause_summary"]
        assert "hardware replacement" in data["infrastructure_impact"]

    def test_generate_fallback_briefing_deterministic_markdown(self):
        context = """
Disaster Incident: Typhoon Kalmaegi (2025-11-03)
Incident Severity: High
Category: Typhoon
Total Municipalities Monitored: 95
Average Recovery Score: 65%
Municipalities >= 90% Restored: 10
Municipalities in Critical/Warning State (<60%): 25
Top Critical Outage LGUs: Barbaza; Laua-an; Valderrama
"""
        briefing = generate_fallback_briefing(context)

        # Must contain exact header and formatting
        assert "### Event Context & Root Cause" in briefing
        assert "- **Classification:**" in briefing
        assert "- **Primary Driver:**" in briefing
        assert "- **Physical Grid Impact:**" in briefing
        assert "Tropical Cyclone" in briefing
        assert "Category 3 Landfall" in briefing

    def test_generate_recovery_briefing_prompt_assembly_and_fallback(self):
        # Without GEMINI_API_KEY, generate_recovery_briefing falls back gracefully
        briefing = generate_recovery_briefing(
            "Incident: Panay Island Grid Collapse (2024-01-02)\nSeverity: Severe",
            event_type="Grid Disturbance / Frequency Trip",
            disaster_category="Cascading System Separation",
            root_cause_summary="Unplanned tripping of base-load generation units.",
            infrastructure_impact="Zero structural physical damage; steep V-shaped curve.",
        )
        assert "### Event Context & Root Cause" in briefing or "### Event Profile & Root Cause" in briefing
        assert "Grid Disturbance / Frequency Trip" in briefing
        assert "Cascading System Separation" in briefing

    def test_volcanic_eruption_taal_context_parsing(self):
        sample_context = """
Disaster Incident: Eruption Taal (2024-10-05)
Incident Severity: Moderate
Category: Volcanic Eruption
Total Municipalities Monitored: 95
Average Recovery Score: 82%
Municipalities >= 90% Restored: 60
Municipalities in Critical/Warning State (<60%): 5
"""
        data = _parse_event_context(sample_context)
        assert data["event_type"] == "Volcanic Eruption"
        assert data["disaster_category"] == "Volcanic Eruption"
        assert "tephra/ashfall" in data["root_cause_summary"]
        assert "insulator strings" in data["infrastructure_impact"]

        briefing = generate_fallback_briefing(sample_context)
        assert "- **Classification:** Volcanic Eruption (Volcanic Eruption)" in briefing
        assert "Heavy tephra/ashfall accumulation on sub-transmission insulators" in briefing
        assert "high-pressure water washing of substation transformer bushings" in briefing

    def test_gdacs_vo_hazard_code_briefing(self):
        sample_context = """
Disaster Incident: Taal Volcano
Classification: Tropical Cyclone (Volcanic Eruption)
Primary Driver: Severe weather or mechanical system disruption...
Incident Severity: High | Category: VO
Total Municipalities Monitored: 95
"""
        briefing = generate_fallback_briefing(sample_context)
        assert "- **Classification:** Volcanic Eruption (Volcanic Eruption)" in briefing
        assert "tephra/ashfall" in briefing

    def test_unmapped_hazard_not_defaulted_to_tropical_cyclone(self):
        sample_context = """
Disaster Incident: Geological Subsidence Event (2025-05-01)
Incident Severity: Moderate
Category: Geological / Natural Hazard
Total Municipalities Monitored: 95
"""
        briefing = generate_fallback_briefing(sample_context)
        assert "Tropical Cyclone" not in briefing
        assert "Geological / Natural Hazard" in briefing


class TestBackendAPISerialization:
    @classmethod
    def setup_class(cls):
        cls.client = TestClient(app)

    def test_get_events_endpoint_contains_context_fields(self):
        response = self.client.get("/api/v1/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        events = data["events"]
        assert len(events) > 0

        # Check typhoon-kalmaegi-2025 in events list
        kalmaegi = next((e for e in events if e["id"] == "typhoon-kalmaegi-2025"), None)
        assert kalmaegi is not None
        assert kalmaegi["event_type"] == "Tropical Cyclone"
        assert kalmaegi["disaster_category"] == "Category 3 Landfall"
        assert kalmaegi["root_cause_summary"] is not None
        assert kalmaegi["infrastructure_impact"] is not None

    def test_get_single_event_kalmaegi(self):
        response = self.client.get("/api/v1/events/typhoon-kalmaegi-2025")
        assert response.status_code == 200
        event = response.json()
        assert event["id"] == "typhoon-kalmaegi-2025"
        assert event["event_type"] == "Tropical Cyclone"
        assert event["disaster_category"] == "Category 3 Landfall"
        assert "185 km/h" in event["root_cause_summary"]
        assert "hardware replacement" in event["infrastructure_impact"]

    def test_get_single_event_panay_grid_collapse(self):
        response = self.client.get("/api/v1/events/panay-grid-collapse-2024")
        assert response.status_code == 200
        event = response.json()
        assert event["event_type"] == "Grid Disturbance / Frequency Trip"
        assert event["disaster_category"] == "Cascading System Separation"
        assert "PEDC and PCPC" in event["root_cause_summary"]
        assert "V-shaped recovery curve" in event["infrastructure_impact"]

    def test_get_single_event_typhoon_odette(self):
        response = self.client.get("/api/v1/events/typhoon-odette-2021")
        assert response.status_code == 200
        event = response.json()
        assert event["event_type"] == "Super Typhoon"
        assert event["disaster_category"] == "Category 5 Landfall"
        assert "transmission tower toppling" in event["root_cause_summary"]
        assert "temporary bypass towers" in event["infrastructure_impact"]

    def test_get_single_event_not_found(self):
        response = self.client.get("/api/v1/events/non-existent-disaster-9999")
        assert response.status_code == 404

    def test_viirs_scale_calibration_image_endpoint(self):
        response = self.client.get("/images/viirs-scale-calibration.jpg")
        assert response.status_code == 200
        assert "image/jpeg" in response.headers.get("content-type", "")
        assert len(response.content) > 100000
