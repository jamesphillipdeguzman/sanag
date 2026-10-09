from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_system_status_endpoints():
    for endpoint in ["/status", "/api/status", "/api/v1/status", "/api/summary", "/api/v1/summary"]:
        response = client.get(endpoint)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["active_stations_count"] >= 14
        assert data["total_stations_count"] >= 14
        assert data["panay_lgus_count"] == 95
        assert data["nationwide_hubs_count"] == 187
        assert isinstance(data["stations"], list)
        assert len(data["stations"]) >= 14
        assert "stations_by_province" in data
        assert len(data["stations_by_province"]) == 4


def test_stations_by_province_endpoints():
    for endpoint in ["/stations/by-province", "/api/stations/by-province", "/api/v1/stations/by-province"]:
        response = client.get(endpoint)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4
        provinces = {item["province"]: item for item in data}
        assert "Iloilo" in provinces
        assert "Capiz" in provinces
        assert "Aklan" in provinces
        assert "Antique" in provinces
        assert provinces["Iloilo"]["count"] == 6
        assert provinces["Capiz"]["count"] == 3
        assert provinces["Aklan"]["count"] == 3
        assert provinces["Antique"]["count"] == 2
        total_count = sum(p["count"] for p in data)
        assert total_count == 14
