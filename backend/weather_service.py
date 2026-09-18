import httpx
from typing import Dict, Any

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Centroid for Panay Island
DEFAULT_LAT = 11.15
DEFAULT_LON = 122.50

async def fetch_historical_weather(
    latitude: float = DEFAULT_LAT,
    longitude: float = DEFAULT_LON,
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-05"
) -> Dict[str, Any]:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max"
        ],
        "timezone": "Asia/Manila"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=15.0)
        response.raise_for_status()
        return response.json()