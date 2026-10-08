import pytest
from fastapi.testclient import TestClient
from backend.main import app, compute_distance_decay_ratio, haversine_distance_km

client = TestClient(app)

def test_distance_decay_formula_bands():
    # Band 1: Ground zero (d < 45 km): 5% - 25% radiance (Critical Deficit)
    r0, s0 = compute_distance_decay_ratio(0.0)
    assert 0.05 <= r0 <= 0.25
    assert s0 == "critical"

    r20, s20 = compute_distance_decay_ratio(20.0)
    assert 0.05 <= r20 <= 0.25
    assert s20 == "critical"

    r44, s44 = compute_distance_decay_ratio(44.9)
    assert 0.05 <= r44 <= 0.25
    assert s44 == "critical"

    # Band 2: Severe impact (45 <= d < 90 km): 35% - 55% radiance (Critical Deficit)
    r45, s45 = compute_distance_decay_ratio(45.0)
    assert 0.35 <= r45 <= 0.55
    assert s45 == "critical"

    r70, s70 = compute_distance_decay_ratio(70.0)
    assert 0.35 <= r70 <= 0.55
    assert s70 == "critical"

    r89, s89 = compute_distance_decay_ratio(89.9)
    assert 0.35 <= r89 <= 0.55
    assert s89 == "critical"

    # Band 3: Moderate impact (90 <= d < 150 km): 60% - 85% radiance (Active Restoration)
    r90, s90 = compute_distance_decay_ratio(90.0)
    assert 0.60 <= r90 <= 0.85
    assert s90 == "warning"

    r120, s120 = compute_distance_decay_ratio(120.0)
    assert 0.60 <= r120 <= 0.85
    assert s120 == "warning"

    r149, s149 = compute_distance_decay_ratio(149.9)
    assert 0.60 <= r149 <= 0.85
    assert s149 == "warning"

    # Band 4: Normal / Near-Full (d >= 150 km): >= 90%
    r150, s150 = compute_distance_decay_ratio(150.0)
    assert r150 >= 0.90
    assert s150 == "restored"

    r300, s300 = compute_distance_decay_ratio(300.0)
    assert r300 >= 0.90
    assert s300 == "restored"


def test_haversine_distance():
    # Distance from Yolanda epicenter (11.1000, 125.3000) to Tacloban City (~11.2444, 125.0039)
    dist_tacloban = haversine_distance_km(11.1000, 125.3000, 11.2444, 125.0039)
    # Approx 36-37 km (Ground zero band < 45 km)
    assert dist_tacloban < 45.0

    # Distance from Yolanda epicenter to Ormoc City (~11.0050, 124.6075)
    dist_ormoc = haversine_distance_km(11.1000, 125.3000, 11.0050, 124.6075)
    # Approx 76 km (Band 2: 45 - 90 km)
    assert 45.0 <= dist_ormoc < 90.0

    # Distance from Yolanda epicenter to Panay (Iloilo City ~10.7202, 122.5621)
    dist_iloilo = haversine_distance_km(11.1000, 125.3000, 10.7202, 122.5621)
    # Approx 300+ km (Band 4: >= 150 km)
    assert dist_iloilo >= 150.0


def test_simulate_event_endpoint_haiyan():
    response = client.get("/api/v1/events/typhoon-haiyan-2013/simulate")
    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == "typhoon-haiyan-2013"
    assert data["simulation_model"] == "distance_decay_viirs_radiance"
    assert data["event_coordinates"] == [11.1000, 125.3000]

    sim_records = data["data"]
    # Tacloban should be in ground zero (<45 km, recovery ratio < 0.26, status critical)
    tacloban = sim_records.get("PH083747000") or sim_records.get("tacloban city")
    assert tacloban is not None
    assert tacloban["recovery_ratio"] <= 0.25
    assert tacloban["status"] == "critical"
    assert tacloban["distance_km"] < 45.0

    # Ormoc should be in 45-90 km band (recovery ratio 0.35-0.55, status critical)
    ormoc = sim_records.get("PH083734000") or sim_records.get("ormoc city")
    assert ormoc is not None
    assert 0.35 <= ormoc["recovery_ratio"] <= 0.55
    assert ormoc["status"] == "critical"
    assert 45.0 <= ormoc["distance_km"] < 90.0

    # Panay (Iloilo) should be >= 150 km (recovery ratio >= 0.90, status restored)
    iloilo = sim_records.get("PH063022000") or sim_records.get("iloilo city (panay)")
    assert iloilo is not None
    assert iloilo["recovery_ratio"] >= 0.90
    assert iloilo["status"] == "restored"
    assert iloilo["distance_km"] >= 150.0
